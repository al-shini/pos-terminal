/**
 * End-to-end exercise of public/bopVisa.js against a mock BOP terminal.
 *
 * Uses the TCP transport so it can run without hardware: the framing, the
 * crypto, the envelope handling and the INIT -> SALE sequencing are the same
 * code paths the serial transport uses.
 */
const net = require('net');
const crypto = require('crypto');
const bop = require('../public/bopVisa.js');

let failures = 0;
const check = (label, ok, detail) => {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  ' + detail : ''));
    if (!ok) failures++;
};

// The terminal's own long-lived key pair.
const device = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

let pcPublicKey = null;   // learned at INIT, used to encrypt replies
let lastSaleRequest = null;
// 'approve' | 'decline' | 'silent' | 'garbage' | 'stringcode' | 'wrongamount'
// | 'chatty' (stock error arrives late, then the real approval) | 'nocode'
let saleBehaviour = 'approve';

const frame = (text) => bop.buildFrame(text);

const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const taken = bop.takeMessage(buffer);
        if (!taken) return;
        buffer = taken.rest;

        const request = JSON.parse(taken.body);

        if (request.type === 'INIT') {
            pcPublicKey = request.rsaPubKey;
            socket.write(frame(JSON.stringify({
                resp_code: 0,
                rsaPubKey: bop.fixRsaFormat(device.publicKey),
                type: 'INIT'
            })));
            return;
        }

        // Anything else is an encrypted envelope.
        lastSaleRequest = JSON.parse(bop.decryptObject(taken.body, device.privateKey));

        if (saleBehaviour === 'silent') return;
        if (saleBehaviour === 'garbage') {
            socket.write(frame('{"not":"an envelope"}'));
            return;
        }

        const approval = {
            resp_code: 0,
            type: 'SALE',
            auth_code: '123456',
            sale: { amt: lastSaleRequest.amt, cur: lastSaleRequest.cur },
            card: { pan: '4111********1111' }
        };

        let reply;
        switch (saleBehaviour) {
            case 'decline':
                reply = { resp_code: 51, type: 'SALE', error_msg: 'INSUFFICIENT FUNDS' };
                break;
            case 'stringcode':
                reply = Object.assign({}, approval, { resp_code: '0' });
                break;
            case 'nocode':
                reply = { type: 'SALE', error_msg: 'NO CODE' };
                break;
            case 'wrongamount':
                reply = Object.assign({}, approval, {
                    sale: { amt: lastSaleRequest.amt - 500, cur: lastSaleRequest.cur }
                });
                break;
            case 'majorunits':
                // Same amount, echoed as 123.45 rather than 12345.
                reply = Object.assign({}, approval, {
                    sale: { amt: lastSaleRequest.amt / 100, cur: lastSaleRequest.cur }
                });
                break;
            default:
                reply = approval;
        }

        const envelope = frame(JSON.stringify(bop.encryptObject(reply, pcPublicKey)));

        if (saleBehaviour === 'chatty') {
            // The terminal's stock answer to the wake-up junk turns up late,
            // after the sale request has already gone out. This is the shape
            // that made a real approval look like garbage: whoever reads the
            // first message off the wire gets the error, not the approval.
            socket.write(frame(JSON.stringify({
                resp_code: -1,
                error_msg: 'Client-Server settings not initialized'
            })));
            setTimeout(() => socket.write(envelope), 150);
            return;
        }

        socket.write(envelope);
    });

    socket.on('error', () => {});
});

const run = async () => {
    await new Promise((resolve) => server.listen(7800, '127.0.0.1', resolve));

    // --- INIT ---
    const pairing = await bop.init({ target: '127.0.0.1' });
    check('INIT returns the device public key', !!pairing.visaPublicRsaKey);
    check('INIT returns a usable PC key pair',
        pairing.privateKey.includes('PRIVATE KEY') && pairing.publicKey.includes('PUBLIC KEY'));
    check('device received our public key', pcPublicKey === bop.fixRsaFormat(pairing.publicKey));

    const saleOptions = {
        target: '127.0.0.1',
        visaPublicRsaKey: pairing.visaPublicRsaKey,
        privateKey: pairing.privateKey,
        amt: 12345,
        cur: 376,
        rcpt: 'ABC123'
    };

    // --- approved sale ---
    const approved = await bop.sale(saleOptions);
    check('approved sale decrypts', approved.resp_code === 0, JSON.stringify(approved.sale));
    check('auth code round trips', approved.auth_code === '123456');
    check('device saw the exact amount', lastSaleRequest.amt === 12345 && lastSaleRequest.cur === 376);
    check('device saw the receipt ref', lastSaleRequest.rcpt === 'ABC123');
    check('request was a SALE', lastSaleRequest.type === 'SALE');

    // --- declined sale: resolves, does NOT throw ---
    saleBehaviour = 'decline';
    const declined = await bop.sale(saleOptions);
    check('decline resolves with resp_code', declined.resp_code === 51);
    check('decline carries the reason', declined.error_msg === 'INSUFFICIENT FUNDS');

    // --- no reply at all: must be flagged as an unknown outcome ---
    saleBehaviour = 'silent';
    try {
        await bop.sale(Object.assign({}, saleOptions, { timeoutMs: 1500 }));
        check('silent terminal rejects', false);
    } catch (ex) {
        check('silent terminal rejects', true);
        check('silent terminal marks outcome unknown', ex.outcomeUnknown === true);
        check('silent terminal reports the receipt ref', ex.rcpt === 'ABC123');
    }

    // --- a reply that is not an envelope: skipped, then reported on timeout.
    // It is never accepted as the answer, because doing so would call a charged
    // card a failure; but the timeout must name what it did hear.
    saleBehaviour = 'garbage';
    try {
        await bop.sale(Object.assign({}, saleOptions, { timeoutMs: 2000 }));
        check('undecryptable reply rejects', false);
    } catch (ex) {
        check('undecryptable reply rejects', true);
        check('undecryptable reply marks outcome unknown', ex.outcomeUnknown === true);
        check('timeout reports what the terminal actually said',
            ex.message.includes('not') && ex.message.includes('envelope'), ex.message);
    }

    // --- a stock error arriving late must not be mistaken for the answer ---
    // This is the failure that showed "call a supervisor" on a card that had
    // just been charged.
    saleBehaviour = 'chatty';
    const chatty = await bop.sale(saleOptions);
    check('late stock error is skipped, approval is read', chatty.resp_code === 0);
    check('late stock error does not leak its message', !chatty.error_msg);

    // --- resp_code as a string must not read as a decline ---
    saleBehaviour = 'stringcode';
    const stringCode = await bop.sale(saleOptions);
    check('string "0" resp_code is an approval', stringCode.resp_code === 0);
    check('resp_code is normalised to a number', typeof stringCode.resp_code === 'number');

    // --- approved for the wrong amount: money moved, never record ours ---
    saleBehaviour = 'wrongamount';
    try {
        await bop.sale(saleOptions);
        check('approval for a different amount rejects', false);
    } catch (ex) {
        check('approval for a different amount rejects', true);
        check('  flagged as an amount mismatch', ex.amountMismatch === true);
        check('  parked as an unknown outcome', ex.outcomeUnknown === true);
        check('  keeps the auth code for reconciliation', ex.authCode === '123456');
    }

    // --- the same amount echoed in major units is still the same amount ---
    saleBehaviour = 'majorunits';
    const majorUnits = await bop.sale(saleOptions);
    check('amount echoed as major units is accepted', majorUnits.resp_code === 0);

    // --- a reply with no usable resp_code is never treated as approved ---
    saleBehaviour = 'nocode';
    try {
        await bop.sale(saleOptions);
        check('reply without resp_code rejects', false);
    } catch (ex) {
        check('reply without resp_code rejects', true);
        check('  parked as an unknown outcome', ex.outcomeUnknown === true);
    }

    // --- unusable stored keys must be caught BEFORE anything is charged ---
    saleBehaviour = 'approve';
    const sawRequest = lastSaleRequest;
    const badKeys = [
        ['truncated private key', { privateKey: saleOptions.privateKey.slice(0, 400) }],
        ['empty private key', { privateKey: '   ' }],
        ['garbage terminal public key', { visaPublicRsaKey: 'not-a-key' }]
    ];
    for (const [label, override] of badKeys) {
        try {
            await bop.sale(Object.assign({}, saleOptions, override));
            check('refuses to charge with a ' + label, false);
        } catch (ex) {
            check('refuses to charge with a ' + label, true);
            check('  and never reached the reader', lastSaleRequest === sawRequest);
            check('  and is not an unknown outcome', !ex.outcomeUnknown);
        }
    }

    // A short but structurally valid key is still the wrong key for this
    // pairing, and must be refused rather than used to read a live reply.
    const weak = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    try {
        await bop.sale(Object.assign({}, saleOptions, { privateKey: weak.privateKey }));
        check('refuses to charge with a wrong-sized private key', false);
    } catch (ex) {
        check('refuses to charge with a wrong-sized private key', true);
        check('  and never reached the reader', lastSaleRequest === sawRequest);
    }

    // --- input validation ---
    saleBehaviour = 'approve';
    const invalid = [
        ['non-integer amount', { amt: 10.5 }],
        ['zero amount', { amt: 0 }],
        ['negative amount', { amt: -100 }],
        ['missing receipt ref', { rcpt: '' }],
        ['missing keys', { visaPublicRsaKey: null }]
    ];
    for (const [label, override] of invalid) {
        try {
            await bop.sale(Object.assign({}, saleOptions, override));
            check('rejects ' + label, false);
        } catch (ex) {
            check('rejects ' + label, true);
        }
    }

    // --- concurrency: the second sale must not interleave with the first ---
    const order = [];
    const a = bop.sale(saleOptions).then(() => order.push('a'));
    const b = bop.sale(saleOptions).then(() => order.push('b'));
    await Promise.all([a, b]);
    check('concurrent sales are serialised', order.join(',') === 'a,b', order.join(','));
    check('queue drains to idle', bop.getActiveOperation() === null);

    // --- a failed operation must not wedge the queue ---
    try { await bop.sale(Object.assign({}, saleOptions, { amt: -1 })); } catch (ex) { /* expected */ }
    const afterFailure = await bop.sale(saleOptions);
    check('queue survives a failed operation', afterFailure.resp_code === 0);

    // --- unreachable target ---
    try {
        await bop.sale(Object.assign({}, saleOptions, { target: '127.0.0.1', timeoutMs: 1000 }));
    } catch (ex) { /* ignored */ }

    server.close();
    console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
};

run().catch((ex) => {
    console.error('HARNESS ERROR', ex);
    process.exit(1);
});
