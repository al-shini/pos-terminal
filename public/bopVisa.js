/**
 * BOP Visa payment terminal integration.
 *
 * One module for both transports:
 *   - serial: the terminal hangs off a COM port (verified against BOP's own
 *     PinPad_Utils tool on COM1 @ 115200 8N1)
 *   - tcp:    the terminal is reachable over the network on port 7800
 *
 * The application protocol is identical on both: a `~PCNC~<4-digit length>~`
 * header followed by JSON. INIT is sent in the clear and answers with the
 * terminal's RSA public key; everything after that is an AES-256-ECB payload
 * whose key is RSA-wrapped with the peer's public key.
 *
 * Serial needs two extra things that the TCP path does not, both matching
 * BOP's tool:
 *   - a junk-string wake-up before the first real request, otherwise the
 *     terminal ignores it and answers nothing at all
 *   - a `print` field on INIT
 */

const crypto = require('crypto');
const net = require('net');
const { SerialPort } = require('serialport');
const logger = require('./logger');

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const TCP_PORT = 7800;
const SERIAL_DEFAULTS = {
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    // Assert both control lines. RTS is the "you may send to me" signal, and
    // driving it LOW (as an earlier version did, copying the .NET tool's
    // defaults) tells a reader that honours hardware handshake to stop after
    // one FIFO's worth of bytes. On a cable that wires the handshake pins this
    // produced exactly that in production: the reader sent the first ~58 bytes
    // of its 1544-byte reply, stalled, gave up and restarted, over and over,
    // and the sale timed out with an approval/decline sitting in the reader.
    // Cables that leave the pins unwired (like the dev bench one) float the
    // line high, which is why the same code worked there — the .NET defaults
    // only ever "worked" by that accident. Devices that ignore the handshake
    // don't care either way, so asserting is the safe universal choice.
    // Per-station override: pos-config.json bopVisaDtr/bopVisaRts = false.
    dtr: true,
    rts: true
};

const INIT_TIMEOUT_MS = 90 * 1000;
// A cardholder has to read the prompt, insert or tap, and key a PIN. A real
// approval on this hardware has been observed to take close to two minutes.
const SALE_TIMEOUT_MS = 300 * 1000;
// How long to wait for the terminal to start answering the wake-up, and how
// long it must then stay silent before its reply is considered complete. A
// terminal that is present but already in session usually ignores the junk
// entirely, so this budget is paid in full on every request — keep it tight.
const WAKE_REPLY_MS = 2500;
const WAKE_QUIET_MS = 300;
const WAKE_PAYLOAD = 'rubbish data';

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

const FRAME_PREFIX = '~PCNC~';

const buildFrame = (payload) => {
    // Byte length, not character count — the receiver reads bytes, and the two
    // differ the moment anything non-ASCII reaches the payload.
    const length = String(Buffer.byteLength(payload, 'utf-8')).padStart(4, '0');
    return FRAME_PREFIX + length + '~' + payload;
};

const takeFrame = (buffer) => {
    // Walks every header in the buffer, not just the first. A reader whose
    // transmission stalls (seen in production with a mis-asserted RTS line)
    // gives up partway through a frame and RESTARTS it, so the buffer fills
    // with truncated attempts: locking onto the first header means waiting
    // forever for bytes that will never come, while a completed retry sits
    // right behind it. An incomplete frame is only skipped when a later header
    // exists — a lone incomplete frame is simply still arriving.
    let cursor = 0;
    for (;;) {
        const start = buffer.indexOf(FRAME_PREFIX, cursor, 'ascii');
        if (start < 0) {
            return null;
        }
        // Normally zero-padded to 4 digits, but a payload over 9999 bytes makes
        // the field wider, so read up to the closing '~' instead of assuming.
        const digitsStart = start + FRAME_PREFIX.length;
        const searchEnd = Math.min(buffer.length, digitsStart + 8);
        let delimiter = -1;
        for (let i = digitsStart; i < searchEnd; i++) {
            if (buffer[i] === 0x7e) {
                delimiter = i;
                break;
            }
        }
        if (delimiter < 0) {
            if (searchEnd - digitsStart >= 8) {
                // Junk where the length should be. NEVER fatal: production
                // showed a header with bytes torn out of its middle
                // ("~PCNC~15oAI5Bb") on a lossy line, and treating that as an
                // error aborted a sale in 8s that the reader's own retries
                // could still have completed inside the real timeout. Skip
                // this marker and keep scanning; if nothing parseable ever
                // arrives, the exchange deadline reports the buffer anyway.
                cursor = digitsStart;
                continue;
            }
            return null;
        }

        const declared = parseInt(buffer.toString('ascii', digitsStart, delimiter), 10);
        if (isNaN(declared)) {
            // Same policy as above: corrupt length field = noise, not fatal.
            cursor = digitsStart;
            continue;
        }

        const bodyStart = delimiter + 1;
        const end = bodyStart + declared;

        // A real body is JSON and never contains a frame header. One inside
        // the declared range means this attempt was cut off and the sender
        // started over — the declared length is being "filled" by the retry's
        // bytes, and reading them as one body would return garbage spanning
        // both. The retry is the real frame; parse from it instead.
        const embedded = buffer.indexOf(FRAME_PREFIX, bodyStart, 'ascii');
        if (embedded >= 0 && embedded < end) {
            cursor = embedded;
            continue;
        }

        if (buffer.length < end) {
            return null;
        }
        return { body: buffer.toString('utf-8', bodyStart, end), framed: true, rest: buffer.subarray(end) };
    }
};

/**
 * Scan out one balanced JSON object.
 *
 * The terminal answers an unpaired INIT with bare JSON and no header, so there
 * is no declared length to rely on. Braces inside string literals must not
 * count towards the depth.
 */
const takeJsonObject = (buffer, byteLimit) => {
    // A bare JSON reply never contains a frame header, so an object that would
    // have to span one is not an object — it is a truncated fragment followed
    // by the sender's retry. Scanning across the header produced "balanced"
    // garbage that consumed real frames behind it; bounding the scan leaves
    // those frames for takeFrame.
    const scanEnd = byteLimit != null && byteLimit >= 0 ? byteLimit : buffer.length;
    const text = buffer.subarray(0, scanEnd).toString('utf-8');
    const start = text.indexOf('{');
    if (start < 0) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
        } else if (ch === '{') {
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                const body = text.slice(start, i + 1);
                return {
                    body,
                    framed: false,
                    rest: buffer.subarray(Buffer.byteLength(text.slice(0, i + 1), 'utf-8'))
                };
            }
        }
    }
    return null;
};

/** Accept either framing: a `~PCNC~` frame, or a bare JSON object. */
const takeMessage = (buffer) => {
    const frameIndex = buffer.indexOf(FRAME_PREFIX, 0, 'ascii');
    const braceIndex = buffer.indexOf(0x7b);

    if (frameIndex >= 0 && (braceIndex < 0 || frameIndex < braceIndex)) {
        return takeFrame(buffer);
    }
    if (braceIndex >= 0) {
        // Bare JSON leads, but a header behind it caps how far it may reach —
        // and if the leading bytes turn out to be a dead fragment, a complete
        // frame further along must still win.
        const bare = takeJsonObject(buffer, frameIndex >= 0 ? frameIndex : null);
        if (bare) {
            return bare;
        }
        if (frameIndex >= 0) {
            return takeFrame(buffer);
        }
        return null;
    }
    return null;
};

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------

const fixRsaFormat = (data) => String(data)
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/(\r\n|\n|\r)/gm, '');

const toPublicKeyPem = (base64Spki) => {
    const body = fixRsaFormat(base64Spki);
    return '-----BEGIN PUBLIC KEY-----\n' + body + '\n-----END PUBLIC KEY-----';
};

const generateTerminalKeyPair = () => crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

/**
 * Refuse to start a sale unless both keys are actually usable.
 *
 * The private key is only exercised when the terminal's reply comes back —
 * which is after the card has been charged. If it has been damaged in storage
 * (a column too narrow for a 4096-bit PKCS#8 PEM truncates it silently, and the
 * key is far longer than the public one that would have failed earlier), the
 * first symptom is money taken against a reply nobody can read. Checking here
 * turns that into a refusal to charge at all.
 */
const assertUsableKeys = (privateKeyPem, visaPublicRsaKey) => {
    let details;
    try {
        details = crypto.createPrivateKey(privateKeyPem).asymmetricKeyDetails;
    } catch (ex) {
        throw new Error('This station\'s stored private key is unusable (' + ex.message + ').'
            + ' NOTHING has been sent to the reader and no card has been charged.'
            + ' Re-link the payment terminal.');
    }
    if (details && details.modulusLength && details.modulusLength !== 4096) {
        throw new Error('This station\'s stored private key is ' + details.modulusLength
            + '-bit, but the terminal was paired with a 4096-bit key. Nothing has been sent'
            + ' to the reader. Re-link the payment terminal.');
    }

    try {
        crypto.createPublicKey(toPublicKeyPem(visaPublicRsaKey));
    } catch (ex) {
        throw new Error('The terminal public key stored for this station is unusable ('
            + ex.message + '). Nothing has been sent to the reader.'
            + ' Re-link the payment terminal.');
    }
};

/** Short, log-safe view of whatever the terminal sent. */
const preview = (text, limit = 240) => {
    const s = String(text == null ? '' : text);
    return s.length > limit ? s.slice(0, limit) + '…(' + s.length + ' chars)' : s;
};

/**
 * Undo RSA PKCS#1 v1.5 padding by hand.
 *
 * Node refuses `privateDecrypt` with RSA_PKCS1_PADDING since the Marvin
 * mitigation (CVE-2023-46809) and throws outright on newer runtimes, so the
 * block is recovered raw and unpadded here. This keeps the integration working
 * across Electron/Node upgrades instead of depending on a runtime flag.
 */
const rsaUnwrapPkcs1 = (privateKeyPem, ciphertext) => {
    const block = crypto.privateDecrypt({
        key: privateKeyPem,
        padding: crypto.constants.RSA_NO_PADDING
    }, ciphertext);

    let offset = 0;
    if (block[offset] === 0x00) {
        offset++;
    }
    if (block[offset] !== 0x02) {
        throw new Error('RSA block is not PKCS#1 type 2 — the terminal encrypted this with a different key');
    }
    offset++;

    const paddingStart = offset;
    while (offset < block.length && block[offset] !== 0x00) {
        offset++;
    }
    if (offset >= block.length) {
        throw new Error('RSA block has no padding separator');
    }
    if (offset - paddingStart < 8) {
        throw new Error('RSA block padding is too short to be valid');
    }
    return block.subarray(offset + 1);
};

/**
 * Wrap `object` for the terminal.
 *
 * BOP's tool RSA-wraps the AES key followed by a 16-byte IV, so the terminal
 * expects a 48-byte blob and takes the first 32 bytes as the key. The IV is
 * unused because the mode is ECB, but it must be present or the length is
 * wrong.
 */
const encryptObject = (object, visaPublicRsaKey) => {
    const aesKey = crypto.randomBytes(32);
    const keyBlob = Buffer.concat([aesKey, crypto.randomBytes(16)]);

    const wrappedKey = crypto.publicEncrypt({
        key: toPublicKeyPem(visaPublicRsaKey),
        padding: crypto.constants.RSA_PKCS1_PADDING
    }, keyBlob);

    const cipher = crypto.createCipheriv('aes-256-ecb', aesKey, '');
    let payload = cipher.update(JSON.stringify(object), 'utf-8', 'base64');
    payload += cipher.final('base64');

    return { k: wrappedKey.toString('base64'), d: payload };
};

/** Unwrap a `{k,d}` envelope from the terminal. Returns the plaintext JSON. */
const decryptObject = (envelopeJson, terminalPrivateRsaKey) => {
    const envelope = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson;
    if (!envelope || !envelope.k || !envelope.d) {
        throw new Error('Terminal response is not an encrypted envelope: ' + JSON.stringify(envelope));
    }

    const keyBlob = rsaUnwrapPkcs1(terminalPrivateRsaKey, Buffer.from(envelope.k, 'base64'));
    const aesKey = Buffer.alloc(32);
    keyBlob.copy(aesKey, 0, 0, Math.min(keyBlob.length, 32));

    const decipher = crypto.createDecipheriv('aes-256-ecb', aesKey, '');
    return decipher.update(envelope.d, 'base64', 'utf-8') + decipher.final('utf-8');
};

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How long to indulge a driver callback before deciding it is never coming.
// Serial open/write/close complete in milliseconds when they complete at all;
// the close callback in particular is known to simply never fire on some
// Windows USB-serial drivers when the read thread is wedged. Every driver
// callback below is raced against one of these, because a promise that never
// settles here freezes the whole operation chain — the kiosk sat on its
// "waiting for the reader" screen forever with an approved sale already
// decoded, and the only way out was killing the app.
const PORT_CALL_TIMEOUT_MS = 10 * 1000;
const PORT_CLOSE_TIMEOUT_MS = 5 * 1000;

/** Race a driver callback against the clock; a loss becomes a rejection. */
const withDeadline = (promise, ms, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(
        () => reject(new Error(label + ' did not complete within ' + ms + 'ms')),
        ms
    );
    promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); }
    );
});

/** `COM1`, `COM12`, or a `\\.\COM12` style path — anything but an IP. */
const isSerialTarget = (target) => /^(\\\\\.\\)?COM\d+$/i.test(String(target || '').trim());

class SerialTransport {
    constructor(target, options) {
        this.path = String(target).trim();
        this.settings = Object.assign({}, SERIAL_DEFAULTS, options || {});
        this.port = null;
        this.buffer = Buffer.alloc(0);
    }

    open() {
        const opened = new Promise((resolve, reject) => {
            this.port = new SerialPort({
                path: this.path,
                baudRate: this.settings.baudRate,
                dataBits: this.settings.dataBits,
                stopBits: this.settings.stopBits,
                parity: this.settings.parity,
                // Driver-managed hardware flow control (opt-in via
                // pos-config.json bopVisaRtscts). With it off the driver holds
                // RTS wherever we set it and bytes can be lost mid-stream on a
                // marginal link; with it on, the driver toggles RTS as its
                // buffer fills and the reader (which provably honours CTS)
                // pauses instead of dropping. Opt-in because it also gates OUR
                // writes on the reader's CTS — on a cable that wires only one
                // handshake pair, writes would stall (bounded by the 10s write
                // deadline, so it fails loudly, not silently).
                rtscts: this.settings.rtscts === true,
                autoOpen: false
            });

            this.port.on('data', (chunk) => {
                this.buffer = Buffer.concat([this.buffer, chunk]);
                // Deliberately chatty. Diagnosing a dead or lossy line from a
                // store's log needs proof of exactly what reached the port and
                // when — "no response" alone cannot distinguish a silent reader
                // from a parser that choked. A full reply is ~30 chunks; the
                // noise is worth it.
                logger.info('[bopVisa] rx ' + chunk.length + ' byte(s) from ' + this.path
                    + ': ' + preview(chunk.toString('utf-8'), 80));
            });
            // Without a listener an async serial error would crash the main
            // process; the pending request surfaces the failure instead.
            this.port.on('error', (err) => logger.error('[bopVisa] serial error: ' + (err && err.message)));

            this.port.open((err) => {
                if (err) {
                    reject(new Error('Could not open ' + this.path + ': ' + err.message));
                    return;
                }
                // When the driver manages flow control it owns the RTS line;
                // forcing it static would defeat the point.
                const lines = this.settings.rtscts === true
                    ? { dtr: this.settings.dtr }
                    : { dtr: this.settings.dtr, rts: this.settings.rts };
                this.port.set(lines, () => {
                    // Proof in the field log of which settings actually took
                    // effect — a mistyped pos-config key silently changes
                    // nothing, and that has to be visible.
                    logger.info('[bopVisa] opened ' + this.path + ' @' + this.settings.baudRate
                        + ' dtr=' + (this.settings.dtr !== false)
                        + ' rts=' + (this.settings.rts !== false)
                        + ' rtscts=' + (this.settings.rtscts === true));
                    resolve();
                });
            });
        });
        return withDeadline(opened, PORT_CALL_TIMEOUT_MS, 'Opening ' + this.path);
    }

    /**
     * Best-effort, bounded, and never throws.
     *
     * This runs in the finally of every exchange, AFTER the terminal's answer
     * is already in hand. A close callback that never fires must not be
     * allowed to hold that answer hostage — abandoning the handle is strictly
     * better: the next open either succeeds (driver recovered) or fails with
     * a clear "access denied" that surfaces as a readable error instead of an
     * eternal spinner.
     */
    async close() {
        const port = this.port;
        if (!port || !port.isOpen) {
            return;
        }
        try {
            await withDeadline(
                new Promise((resolve) => port.close(() => resolve())),
                PORT_CLOSE_TIMEOUT_MS,
                'Closing ' + this.path
            );
        } catch (ex) {
            logger.error('[bopVisa] abandoning ' + this.path + ' handle: ' + ex.message);
        }
    }

    write(text) {
        const written = new Promise((resolve, reject) => {
            this.port.write(Buffer.from(text, 'utf-8'), (err) => {
                if (err) {
                    reject(new Error('Write to ' + this.path + ' failed: ' + err.message));
                    return;
                }
                this.port.drain((drainErr) => {
                    if (drainErr) {
                        reject(new Error('Drain on ' + this.path + ' failed: ' + drainErr.message));
                        return;
                    }
                    // Drained = handed to the driver in full. Paired with the
                    // rx logging, this splits "reader never answered" from
                    // "our request never left" at a glance.
                    logger.info('[bopVisa] tx ' + Buffer.byteLength(text, 'utf-8') + ' byte(s) to ' + this.path);
                    resolve();
                });
            });
        });
        return withDeadline(written, PORT_CALL_TIMEOUT_MS, 'Writing to ' + this.path);
    }

    /**
     * Poke the terminal and swallow whatever comes back.
     *
     * Skipping this makes the terminal ignore the first real request of the
     * session entirely, which presents as a total timeout with zero bytes.
     *
     * The terminal answers junk with a stock error, and that reply has to be
     * fully consumed before the real request goes out — a straggling byte left
     * in the buffer is read as the answer to the request that follows, which on
     * a sale means an approval is thrown away as garbage after the card has
     * already been charged. So this waits for the reply to stop arriving rather
     * than for a fixed period.
     */
    async wake() {
        await this.write(WAKE_PAYLOAD);

        const firstByteDeadline = Date.now() + WAKE_REPLY_MS;
        while (!this.buffer.length && Date.now() < firstByteDeadline) {
            await sleep(50);
        }

        const answered = this.buffer.length > 0;
        if (answered) {
            // Keep waiting while it is still talking. discardPending below both
            // logs what it was and hands it to the caller for inspection.
            let settled = -1;
            while (settled !== this.buffer.length) {
                settled = this.buffer.length;
                await sleep(WAKE_QUIET_MS);
            }
        } else {
            logger.warn('[bopVisa] wake-up drew no reply from ' + this.path + '; the terminal may be off or not in ECR mode');
        }
        this.discardPending();
        return answered;
    }

    /** Drop anything sitting in the buffer that is not an answer to us. */
    discardPending() {
        if (this.buffer.length) {
            const text = this.buffer.toString('utf-8');
            logger.warn('[bopVisa] discarding ' + this.buffer.length + ' unsolicited byte(s) from '
                + this.path + ': ' + preview(text));
            if (this.onDiscarded) {
                this.onDiscarded(text);
            }
        }
        this.buffer = Buffer.alloc(0);
    }

    async awaitMessage(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const taken = takeMessage(this.buffer);
            if (taken) {
                this.buffer = taken.rest;
                return taken.body;
            }
            if (!this.port || !this.port.isOpen) {
                throw new Error('Serial port ' + this.path + ' closed while awaiting a response');
            }
            await sleep(50);
        }
        throw new Error('Timed out after ' + timeoutMs + 'ms waiting for ' + this.path
            + ' (' + this.buffer.length + ' byte(s) received)');
    }
}

class TcpTransport {
    constructor(target) {
        this.host = String(target).trim();
        this.socket = null;
        this.buffer = Buffer.alloc(0);
        this.failure = null;
        this.closed = false;
    }

    open() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            let settled = false;

            this.socket.on('data', (chunk) => {
                this.buffer = Buffer.concat([this.buffer, chunk]);
            });
            this.socket.on('error', (err) => {
                this.failure = err;
                if (!settled) {
                    settled = true;
                    reject(new Error('Could not reach ' + this.host + ':' + TCP_PORT + ': ' + err.message));
                }
            });
            this.socket.on('close', () => {
                this.closed = true;
            });

            this.socket.connect(TCP_PORT, this.host, () => {
                if (!settled) {
                    settled = true;
                    resolve();
                }
            });
        });
    }

    close() {
        return new Promise((resolve) => {
            if (this.socket && !this.socket.destroyed) {
                this.socket.destroy();
            }
            resolve();
        });
    }

    write(text) {
        return new Promise((resolve, reject) => {
            this.socket.write(text, (err) => (err ? reject(err) : resolve()));
        });
    }

    // TCP peers answer immediately without needing to be woken.
    async wake() { return true; }

    discardPending() {
        if (this.buffer.length) {
            const text = this.buffer.toString('utf-8');
            logger.warn('[bopVisa] discarding ' + this.buffer.length + ' unsolicited byte(s) from '
                + this.host + ': ' + preview(text));
            if (this.onDiscarded) {
                this.onDiscarded(text);
            }
        }
        this.buffer = Buffer.alloc(0);
    }

    async awaitMessage(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const taken = takeMessage(this.buffer);
            if (taken) {
                this.buffer = taken.rest;
                return taken.body;
            }
            if (this.failure) {
                throw new Error('Socket error while awaiting a response: ' + this.failure.message);
            }
            if (this.closed) {
                // Older firmware ends the message by hanging up rather than
                // by honouring the declared length.
                if (this.buffer.length) {
                    throw new Error('Connection closed with an incomplete response ('
                        + this.buffer.length + ' bytes)');
                }
                throw new Error('Connection closed before any response arrived');
            }
            await sleep(25);
        }
        throw new Error('Timed out after ' + timeoutMs + 'ms waiting for ' + this.host);
    }
}

const createTransport = (target, options) => (isSerialTarget(target)
    ? new SerialTransport(target, options)
    : new TcpTransport(target));

// ---------------------------------------------------------------------------
// Operation queue
// ---------------------------------------------------------------------------

// A payment terminal handles exactly one conversation at a time, and a COM
// port cannot be opened twice. Every operation is serialised so a stray second
// request waits its turn instead of corrupting the one in flight or failing
// with an opaque "Access denied" from the driver.
let pendingChain = Promise.resolve();
let activeOperation = null;

const runExclusively = (label, task, backstopMs) => {
    const run = pendingChain.then(async () => {
        activeOperation = { label, startedAt: Date.now() };
        try {
            if (!backstopMs) {
                return await task();
            }
            // Absolute ceiling on the whole operation. Every driver callback
            // below already races its own deadline, but this queue is shared
            // by every future payment on the station: one operation that finds
            // a new way to never settle would wedge them all behind it, and
            // the only recovery would be restarting the app. Better to abandon
            // the operation, answer the caller, and let the next open surface
            // whatever state the port was left in.
            return await withDeadline(task(), backstopMs, label + ' operation').catch((ex) => {
                if (label === 'SALE' && /did not complete within/.test(ex.message || '')) {
                    // The reader may have taken the payment while we were stuck;
                    // that is an unknown outcome, never a clean failure.
                    ex.outcomeUnknown = true;
                }
                throw ex;
            });
        } finally {
            activeOperation = null;
        }
    });
    // Keep the chain alive regardless of this operation's outcome.
    pendingChain = run.then(() => undefined, () => undefined);
    return run;
};

const getActiveOperation = () => (activeOperation
    ? { label: activeOperation.label, elapsedMs: Date.now() - activeOperation.startedAt }
    : null);

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

const exchange = async (target, requestJson, timeoutMs, options, accept, onDiscarded) => {
    const transport = createTransport(target, options);
    transport.onDiscarded = onDiscarded || null;
    await transport.open();
    try {
        const answeredWake = await transport.wake();
        // Anything that arrived between the wake settling and this write is a
        // straggler, not our answer.
        transport.discardPending();
        await transport.write(buildFrame(requestJson));
        let ignored = null;
        try {
            const deadline = Date.now() + timeoutMs;
            for (;;) {
                const remaining = deadline - Date.now();
                let body;
                try {
                    if (remaining <= 0) {
                        throw new Error('Timed out after ' + timeoutMs + 'ms waiting for ' + target);
                    }
                    body = await transport.awaitMessage(remaining);
                } catch (waitEx) {
                    // Say what we did hear. "Timed out" on its own sends people
                    // looking at cables when the terminal was talking all along.
                    if (ignored) {
                        throw new Error('Waited ' + timeoutMs + 'ms for a response from ' + target
                            + ' and only ever got: ' + preview(ignored));
                    }
                    throw waitEx;
                }
                if (!accept || accept(body)) {
                    return body;
                }
                // Not what we asked for — usually the terminal's stock reply to
                // the wake-up arriving late. Skipping it is what stops a real
                // approval being mistaken for garbage, but it is kept so the
                // timeout can report it rather than reporting silence.
                ignored = body;
                logger.warn('[bopVisa] ignoring unsolicited message from ' + target
                    + ' while awaiting a response: ' + preview(body));
                if (onDiscarded) {
                    onDiscarded(body);
                }
            }
        } catch (ex) {
            // A port that answered the wake and then went quiet is a different
            // problem from one that was never there — say which, because the
            // bare timeout sends people looking at the protocol when the cable
            // is in the wrong socket.
            if (!answeredWake) {
                throw new Error('No response from ' + target + '. It did not answer the wake-up either,'
                    + ' so nothing is listening on this port — check the reader is powered on, in ECR mode,'
                    + ' and that this is the port its cable is plugged into. (' + ex.message + ')');
            }
            throw ex;
        }
    } finally {
        await transport.close();
    }
};

/**
 * Pair with the terminal.
 *
 * Generates a fresh RSA key pair, sends it, and returns it together with the
 * terminal's public key. The caller must not persist the pair unless this
 * resolves: replacing a stored private key with one the terminal never
 * acknowledged leaves nothing able to read its replies, and the terminal will
 * not re-pair on demand.
 */
const init = async (options) => {
    const target = options.target;
    const timeoutMs = options.timeoutMs || INIT_TIMEOUT_MS;

    const { publicKey, privateKey } = generateTerminalKeyPair();

    const request = { lang: options.lang || 0 };
    if (options.print !== null && options.print !== undefined) {
        request.print = options.print;
    }
    request.rsaPubKey = fixRsaFormat(publicKey);
    request.type = 'INIT';

    logger.info('[bopVisa] INIT -> ' + target + (isSerialTarget(target) ? ' (serial)' : ' (tcp)'));

    const body = await exchange(target, JSON.stringify(request), timeoutMs, options.serial);

    let response;
    try {
        response = JSON.parse(body);
    } catch (ex) {
        throw new Error('Terminal sent a malformed INIT response: ' + body);
    }

    if (!response.rsaPubKey) {
        if (response.d && response.k) {
            throw new Error('The terminal is already paired and answered with an encrypted envelope. '
                + 'It only returns its public key on a first pairing — unlink and reset the terminal before linking again.');
        }
        throw new Error('Terminal refused INIT: ' + (response.error_msg || body));
    }

    logger.info('[bopVisa] INIT accepted by ' + target);
    return { publicKey, privateKey, visaPublicRsaKey: response.rsaPubKey };
};

/**
 * Run a card sale.
 *
 * Resolves with the terminal's decoded response for both approvals and
 * declines — `resp_code === 0` means approved. It rejects only when the
 * outcome is genuinely unknown, in which case `error.outcomeUnknown` is set:
 * the card may well have been charged, so the caller must not silently retry.
 */
const sale = async (options) => {
    const target = options.target;
    const amt = Number(options.amt);
    const cur = Number(options.cur);
    const rcpt = String(options.rcpt || '');
    const timeoutMs = options.timeoutMs || SALE_TIMEOUT_MS;

    if (!target) {
        throw new Error('Terminal is not linked with a BOP Visa device');
    }
    if (!options.visaPublicRsaKey || !options.privateKey) {
        throw new Error('Terminal is missing its BOP Visa keys — re-link the payment terminal');
    }
    if (!isFinite(amt) || amt <= 0 || Math.floor(amt) !== amt) {
        throw new Error('Sale amount must be a positive whole number of minor units, got ' + options.amt);
    }
    if (!isFinite(cur) || cur <= 0) {
        throw new Error('Sale currency must be an ISO 4217 numeric code, got ' + options.cur);
    }
    if (!rcpt) {
        throw new Error('Sale requires a receipt reference');
    }

    // Before anything reaches the card reader.
    assertUsableKeys(options.privateKey, options.visaPublicRsaKey);

    const envelope = encryptObject({
        lang: options.lang || 0,
        type: 'SALE',
        amt,
        cur,
        rcpt
    }, options.visaPublicRsaKey);

    logger.info('[bopVisa] SALE -> ' + target + ' amt=' + amt + ' cur=' + cur + ' rcpt=' + rcpt);

    // The answer to a sale is always an encrypted envelope. Anything else on
    // the wire is not it.
    const isEnvelope = (text) => {
        try {
            const candidate = JSON.parse(text);
            return !!(candidate && candidate.d && candidate.k);
        } catch (ex) {
            return false;
        }
    };

    /**
     * Inspect anything on the wire that was not an answer to this request.
     *
     * The port is opened and closed per operation, so a reply the terminal sent
     * after we stopped listening is still sitting there when we next open it.
     * If that leftover decrypts to a sale response, a card was charged for a
     * transaction we told somebody had failed — which nobody will ever notice
     * unless it is said out loud, here, with the reference and auth code needed
     * to find it.
     */
    const unclaimed = [];
    const inspectDiscarded = (text) => {
        if (!isEnvelope(text)) {
            return;
        }
        try {
            const stale = JSON.parse(decryptObject(text, options.privateKey));
            unclaimed.push(stale);
            logger.error('[bopVisa] UNCLAIMED SALE RESPONSE found on ' + target
                + ' before this request: rcpt=' + (stale.rcpt || '?')
                + ' resp_code=' + stale.resp_code
                + ' auth_code=' + (stale.auth_code || '-')
                + ' amt=' + (stale.sale ? stale.sale.amt : stale.amt)
                + '. A previous attempt on this reader was answered after we stopped listening'
                + ' — if that sale was reported as failed, the card may have been charged anyway.');
        } catch (ex) {
            logger.warn('[bopVisa] a discarded message looked like an envelope but did not decrypt: '
                + ex.message);
        }
    };

    let body;
    try {
        body = await exchange(target, JSON.stringify(envelope), timeoutMs, options.serial,
            isEnvelope, inspectDiscarded);
    } catch (ex) {
        // The request left this machine but no answer came back, so the card
        // may or may not have been charged. Flagged so the UI can tell the
        // operator to check the terminal rather than imply a clean failure.
        const error = new Error(ex.message);
        error.outcomeUnknown = true;
        error.rcpt = rcpt;
        logger.error('[bopVisa] SALE outcome UNKNOWN for rcpt=' + rcpt + ': ' + ex.message);
        throw error;
    }

    let plain;
    try {
        plain = decryptObject(body, options.privateKey);
    } catch (ex) {
        const error = new Error('Could not decrypt the terminal response (' + ex.message + '). '
            + 'This usually means the stored keys no longer match the terminal — re-link it.');
        error.outcomeUnknown = true;
        error.rcpt = rcpt;
        logger.error('[bopVisa] SALE response undecryptable for rcpt=' + rcpt + ': ' + ex.message
            + ' | raw envelope: ' + preview(body));
        throw error;
    }

    let response;
    try {
        response = JSON.parse(plain);
    } catch (ex) {
        const error = new Error('Terminal sent a malformed SALE response: ' + preview(plain));
        error.outcomeUnknown = true;
        error.rcpt = rcpt;
        logger.error('[bopVisa] SALE response unparseable for rcpt=' + rcpt + ': ' + preview(plain));
        throw error;
    }

    logger.info('[bopVisa] SALE result rcpt=' + rcpt + ' decoded: ' + preview(plain, 600));

    // Some firmware sends the code as a string. Treating "0" as a decline would
    // send a customer away from a card that was actually charged.
    const respCode = Number(response.resp_code);
    if (!Number.isFinite(respCode)) {
        const error = new Error('Terminal response carried no usable resp_code: ' + preview(plain));
        error.outcomeUnknown = true;
        error.rcpt = rcpt;
        error.terminalMessage = response.error_msg || null;
        throw error;
    }
    response.resp_code = respCode;

    if (respCode === 0) {
        // Approved. Confirm it approved the amount we asked for before anyone
        // records a payment against it — an approval for a different figure is
        // a reconciliation problem, not a sale.
        const charged = response.sale || response;
        const chargedAmt = Number(charged.amt);
        // Accept the figure in either encoding. Which one this firmware echoes
        // has not been confirmed against the hardware, and rejecting a good
        // sale because the reader answered in major units would be a worse
        // failure than the one this check exists to catch.
        const asMajor = amt / (cur === 400 ? 1000 : 100);
        const echoedSomethingElse = Number.isFinite(chargedAmt)
            && chargedAmt !== amt
            && Math.abs(chargedAmt - asMajor) > 1e-9;
        if (echoedSomethingElse) {
            const error = new Error('The reader approved ' + chargedAmt + ' minor units but the sale asked for '
                + amt + '. The card HAS been charged — reconcile manually, do not retry.');
            error.outcomeUnknown = true;
            error.amountMismatch = true;
            error.rcpt = rcpt;
            error.authCode = response.auth_code || null;
            logger.error('[bopVisa] SALE amount mismatch rcpt=' + rcpt + ' asked=' + amt + ' charged=' + chargedAmt);
            throw error;
        }
    }

    logger.info('[bopVisa] SALE ' + (respCode === 0 ? 'APPROVED' : 'NOT APPROVED')
        + ' rcpt=' + rcpt + ' resp_code=' + respCode
        + (response.auth_code ? ' auth_code=' + response.auth_code : '')
        + (response.error_msg ? ' error_msg=' + response.error_msg : ''));

    // Carried back so the sale that follows can be reconciled against anything
    // the reader had left over from an earlier attempt.
    if (unclaimed.length) {
        response.unclaimedResponses = unclaimed.map((u) => ({
            rcpt: u.rcpt || null,
            respCode: u.resp_code,
            authCode: u.auth_code || null
        }));
    }

    return response;
};

/** Confirm the device is reachable without starting a transaction. */
const ping = async (options) => {
    const target = options.target;
    const transport = createTransport(target, options.serial);
    await transport.open();
    try {
        await transport.write(WAKE_PAYLOAD);
        // Slightly more patient than the wake-up itself: this runs when someone
        // is actively asking "is it there?", and a false negative sends them
        // hunting for a fault that does not exist.
        const deadline = Date.now() + WAKE_REPLY_MS + 1500;
        while (Date.now() < deadline) {
            await sleep(200);
            const taken = takeMessage(transport.buffer);
            if (taken) {
                return { reachable: true, reply: taken.body };
            }
        }
        return { reachable: false, reply: null };
    } finally {
        await transport.close();
    }
};

const listSerialPorts = async () => {
    const ports = await SerialPort.list();
    return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || null,
        friendlyName: p.friendlyName || null,
        // A reader always arrives on a USB-serial adapter, which reports USB
        // ids. Bluetooth and motherboard COM ports report none, and offering
        // them as equal candidates is how a station ends up pointed at a
        // Bluetooth port that will never answer.
        usb: !!(p.vendorId || p.productId),
        vendorId: p.vendorId || null,
        productId: p.productId || null,
        serialNumber: p.serialNumber || null
    }));
};

// Backstops: generous enough that they can only fire on a genuine hang, since
// every operation already carries its own (shorter) protocol timeout.
module.exports = {
    init: (options) => runExclusively('INIT', () => init(options),
        (options && options.timeoutMs ? options.timeoutMs : INIT_TIMEOUT_MS) + 60 * 1000),
    sale: (options) => runExclusively('SALE', () => sale(options),
        (options && options.timeoutMs ? options.timeoutMs : SALE_TIMEOUT_MS) + 60 * 1000),
    ping: (options) => runExclusively('PING', () => ping(options), 30 * 1000),
    listSerialPorts,
    getActiveOperation,
    isSerialTarget,
    // Exported for tests.
    buildFrame,
    takeMessage,
    encryptObject,
    decryptObject,
    fixRsaFormat,
    rsaUnwrapPkcs1
};
