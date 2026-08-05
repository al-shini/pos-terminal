const crypto = require('crypto');
const bop = require('../public/bopVisa.js');

let failures = 0;
const check = (label, ok, detail) => {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  ' + detail : ''));
    if (!ok) failures++;
};

// --- framing ---------------------------------------------------------------
const json = '{"resp_code":0,"type":"INIT"}';
check('buildFrame pads to 4 digits', bop.buildFrame(json).startsWith('~PCNC~0029~'), bop.buildFrame(json).slice(0, 11));
check('buildFrame counts bytes not chars', bop.buildFrame('{"a":"عربي"}').startsWith('~PCNC~0016~'), bop.buildFrame('{"a":"عربي"}').slice(0, 11));
check('framed round trip', bop.takeMessage(Buffer.from(bop.buildFrame(json))).body === json);
check('bare JSON accepted', bop.takeMessage(Buffer.from(json)).body === json);
check('partial frame returns null', bop.takeMessage(Buffer.from(bop.buildFrame(json).slice(0, 20))) === null);
check('partial bare JSON returns null', bop.takeMessage(Buffer.from(json.slice(0, 12))) === null);
check('leading noise skipped', bop.takeMessage(Buffer.concat([Buffer.from([0x00, 0x15]), Buffer.from(json)])).body === json);

const long = 'x'.repeat(12345);
check('length field wider than 4 digits', bop.takeMessage(Buffer.from(bop.buildFrame(long))).body.length === 12345);

const braces = '{"a":"}","b":"esc \\" }"}';
check('braces inside strings ignored', bop.takeMessage(Buffer.from(braces + 'TAIL')).body === braces);

const two = Buffer.from(bop.buildFrame('{"a":1}') + bop.buildFrame('{"b":2}'));
const first = bop.takeMessage(two);
check('back-to-back frames', first.body === '{"a":1}' && bop.takeMessage(first.rest).body === '{"b":2}');

const utf8 = '{"msg":"عربي"}';
const utf8Taken = bop.takeMessage(Buffer.concat([Buffer.from(utf8), Buffer.from('AFTER')]));
check('utf-8 body offsets', utf8Taken.body === utf8 && utf8Taken.rest.toString() === 'AFTER');

// --- stalled-transmission recovery ------------------------------------------
// Production pattern from a reader whose sends stalled after one FIFO (RTS held
// low by a wired handshake cable): the same frame restarted over and over, each
// attempt truncated, until one finally made it through complete. The parser
// must skip the dead attempts and read the survivor.
const fullFrame = bop.buildFrame(json);
// Header plus part of the body — genuinely cut off mid-frame.
const stalledAttempt = fullFrame.slice(0, 25);
check('stalled frame followed by complete retry',
    bop.takeMessage(Buffer.from(stalledAttempt + fullFrame)).body === json);
check('several stalled attempts then a complete retry',
    bop.takeMessage(Buffer.from(stalledAttempt + stalledAttempt + stalledAttempt + fullFrame)).body === json);
check('lone stalled frame still waits for the rest',
    bop.takeMessage(Buffer.from(stalledAttempt)) === null);

// The live incident began with a HEADLESS fragment (caught mid-frame), so the
// buffer led with bare JSON that never closes. The scan must not "balance"
// braces across the next frame header, and a complete frame behind the
// fragment must still be found.
const headlessFragment = '{"d":"Xoi8N9F+s8Nq3F6lC91F2mN34JtRSlUVU70RGNaSKm66j';
check('bare fragment cannot swallow the frame behind it',
    bop.takeMessage(Buffer.from(headlessFragment + fullFrame)).body === json);
check('bare fragment plus stalled retries then a survivor',
    bop.takeMessage(Buffer.from(headlessFragment + stalledAttempt + fullFrame)).body === json);

// A lossy line tore bytes out of a header's middle in production
// ("~PCNC~15oAI5Bb..."). Corruption must never be fatal — it is noise to scan
// past, so a clean retry behind it still parses, and a buffer of pure garbage
// just keeps waiting for the exchange deadline instead of aborting the sale.
const tornHeader = '~PCNC~15oAI5BbQQBase64Junk';
check('torn header alone keeps waiting', bop.takeMessage(Buffer.from(tornHeader)) === null);
check('torn header then clean retry parses',
    bop.takeMessage(Buffer.from(tornHeader + fullFrame)).body === json);
check('corrupt length field skipped',
    bop.takeMessage(Buffer.from('~PCNC~xx~junk' + fullFrame)).body === json);
check('reader spam then clean frame',
    bop.takeMessage(Buffer.from(':"1"}'.repeat(400) + fullFrame)).body === json);

// --- crypto ----------------------------------------------------------------
const peer = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Encrypt to the peer, then decrypt as the peer would: this exercises the
// 48-byte key||IV wrap and the portable PKCS#1 unwrap together.
const envelope = bop.encryptObject({ type: 'SALE', amt: 100, cur: 376 }, bop.fixRsaFormat(peer.publicKey));
check('envelope has k and d', !!envelope.k && !!envelope.d);
check('wrapped key is modulus sized', Buffer.from(envelope.k, 'base64').length === 512);
check('key blob is 48 bytes', bop.rsaUnwrapPkcs1(peer.privateKey, Buffer.from(envelope.k, 'base64')).length === 48);

const decrypted = bop.decryptObject(JSON.stringify(envelope), peer.privateKey);
check('decryptObject round trip', JSON.parse(decrypted).amt === 100, decrypted);

// The terminal escapes '=' as \u003d; JSON.parse must undo that transparently.
const escaped = JSON.stringify(envelope).replace(/=/g, '\\u003d');
check('handles \\u003d escaping', JSON.parse(bop.decryptObject(escaped, peer.privateKey)).cur === 376);

// Wrong key must fail loudly rather than return garbage.
const other = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
let threw = false;
try { bop.decryptObject(JSON.stringify(envelope), other.privateKey); } catch (e) { threw = true; }
check('mismatched key rejected', threw);

// --- target detection ------------------------------------------------------
check('COM1 is serial', bop.isSerialTarget('COM1') === true);
check('COM12 is serial', bop.isSerialTarget('COM12') === true);
check('lowercase com5 is serial', bop.isSerialTarget('com5') === true);
check('IP is not serial', bop.isSerialTarget('192.168.1.50') === false);
check('empty is not serial', bop.isSerialTarget('') === false);

console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
