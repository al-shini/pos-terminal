/**
 * BOP Visa terminal test harness — SERIAL (COM) transport.
 *
 * This is a standalone diagnostic script that mirrors exactly what
 * public/electron.js does over TCP (`/linkTerminalWithBopVisa` +
 * `/bopVisaSale`), but drives the payment terminal through a COM port
 * instead of a network socket.
 *
 * The crypto and the `~PCNC~<4-digit length>~` framing match production and
 * BOP's own serial toolkit:
 *   - RSA 4096 key pair generation (spki/pkcs8 PEM)
 *   - INIT handshake to obtain the terminal's RSA public key
 *   - AES-256-ECB payload encryption with an RSA(PKCS#1 v1.5) wrapped key
 *
 * Serial also needs a junk-string wake-up before the first real request and a
 * `print` field on INIT, both copied from BOP's toolkit. The line settings
 * match it too: 115200 8N1 with DTR and RTS left low.
 *
 * Usage (PowerShell, from the pos-terminal folder):
 *
 *   node scripts/bopvisa-serial-test.js --list
 *   node scripts/bopvisa-serial-test.js --port COM5 --baud 115200
 *   node scripts/bopvisa-serial-test.js --port COM5 --init-only
 *   node scripts/bopvisa-serial-test.js --port COM5 --sale-only --amt 100 --cur 376
 *
 * Link diagnostics, for when the terminal answers with nothing at all:
 *
 *   --framing none      send bare JSON instead of `~PCNC~` frames
 *   --wake false        skip the junk-string wake-up
 *   --key-blob 32       RSA-wrap only the AES key, as the TCP path does
 *   --loopback          verify the adapter/cable with pins 2-3 jumpered
 *   --listen [seconds]  passively dump anything the terminal transmits
 *   --scan              send INIT at every common baud rate and watch for bytes
 *
 * Keys and the terminal public key are cached under --keys (default
 * ./bopvisa-test-keys) so a --sale-only run can reuse a previous handshake.
 * A full log of the session, including hex dumps of every byte in and out,
 * is written to ./logs/bopvisa-serial-test.log.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SerialPort } = require('serialport');
const { createLogger, format, transports } = require('winston');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const parseArgs = (argv) => {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            args._.push(token);
            continue;
        }
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
            args[key] = true;
        } else {
            args[key] = next;
            i++;
        }
    }
    return args;
};

const argv = parseArgs(process.argv.slice(2));

// "--dtr false" / "--rts 0" style booleans, so the control lines can be
// forced either way while hunting for a link.
const boolArg = (value, fallback) => {
    if (value === undefined) return fallback;
    if (value === true) return true;
    return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
};

const options = {
    list: !!argv.list,
    port: argv.port || 'COM5',
    baudRate: parseInt(argv.baud || '115200', 10),
    dataBits: parseInt(argv.databits || '8', 10),
    stopBits: parseInt(argv.stopbits || '1', 10),
    parity: argv.parity || 'none',
    rtscts: !!argv.rtscts,
    // Left low to match BOP's tool, which sets only BaudRate, DataBits, Parity
    // and ReadTimeout on its SerialPort and so inherits .NET's defaults of
    // DtrEnable=false, RtsEnable=false and Handshake.None.
    dtr: boolArg(argv.dtr, false),
    rts: boolArg(argv.rts, false),
    // BOP's own toolkit frames serial messages exactly like the TCP transport,
    // so `pcnc` is the correct default. An unframed message happens to be
    // answered too, but only the framed form is the documented behaviour.
    // Responses are auto-detected either way.
    framing: (argv.framing || 'pcnc').toString().toLowerCase(),
    // The terminal ignores the first real request after the port is opened
    // unless it has been woken. BOP's toolkit does this by writing a junk
    // string and discarding whatever comes back.
    wake: boolArg(argv.wake, true),
    wakePayload: typeof argv['wake-payload'] === 'string' ? argv['wake-payload'] : 'rubbish data',
    // BOP's INIT carries a `print` field that ours never sent. Pass
    // `--print off` to leave it out.
    print: argv.print === undefined ? 3 : (String(argv.print).toLowerCase() === 'off' ? null : parseInt(argv.print, 10)),
    keyBlob: parseInt(argv['key-blob'] || '48', 10),
    keysDir: argv.keys || path.join(__dirname, 'bopvisa-test-keys'),
    initOnly: !!argv['init-only'],
    saleOnly: !!argv['sale-only'],
    loopback: !!argv.loopback,
    listen: argv.listen !== undefined,
    listenSeconds: parseInt(argv.listen === true ? '60' : (argv.listen || '60'), 10),
    scan: !!argv.scan,
    scanBauds: (argv.bauds || '9600,19200,38400,57600,115200,4800,2400')
        .toString().split(',').map((b) => parseInt(b.trim(), 10)).filter((b) => b > 0),
    scanTimeout: parseInt(argv['scan-timeout'] || '6', 10) * 1000,
    // Amount is sent in minor units, the same way Terminal.js computes it
    // (e.g. 100 == 1.00). Currency is the ISO 4217 numeric code:
    // 376 ILS, 400 JOD, 840 USD.
    amt: parseInt(argv.amt || '100', 10),
    cur: parseInt(argv.cur || '376', 10),
    lang: parseInt(argv.lang || '0', 10),
    rcpt: argv.rcpt || `TEST${Date.now().toString().slice(-8)}`,
    initTimeout: parseInt(argv['init-timeout'] || '120', 10) * 1000,
    saleTimeout: parseInt(argv['sale-timeout'] || '180', 10) * 1000
};

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.printf(({ level, message, timestamp }) => `[${level}] [${timestamp}] - ${message}`)
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: path.join(logDir, 'bopvisa-serial-test.log'), level: 'debug' })
    ],
    level: 'debug'
});

// Byte-level view of the wire. Payment terminals are unforgiving about
// framing, so seeing the exact bytes is usually what solves a bad link.
const hexDump = (buffer) => {
    const lines = [];
    for (let offset = 0; offset < buffer.length; offset += 16) {
        const slice = buffer.subarray(offset, offset + 16);
        const hex = slice.toString('hex').match(/.{1,2}/g).join(' ').padEnd(47, ' ');
        const ascii = Array.from(slice)
            .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
            .join('');
        lines.push(`  ${offset.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
    }
    return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Crypto — copied verbatim from public/electron.js so the test exercises the
// exact same key material and payload format as production.
// ---------------------------------------------------------------------------

const fixRsaFormat = (data) => {
    data = data.replace('-----BEGIN PUBLIC KEY-----', '');
    data = data.replace('-----END PUBLIC KEY-----', '');
    data = data.replace('-----BEGIN PRIVATE KEY-----', '');
    data = data.replace('-----END PRIVATE KEY-----', '');
    data = data.replace(/(\r\n|\n|\r)/gm, '');
    return data;
};

const generateEncryptedKeyFromVisaPubKey = (visaPublicRsaKey, keyBlobBytes) => {
    const key = crypto.randomBytes(32);
    // BOP's toolkit RSA-wraps the AES key followed by a 16-byte IV, so the
    // terminal expects a 48-byte blob and uses the first 32 bytes as the key.
    // Production's TCP path wraps the bare 32-byte key; `--key-blob 32`
    // reproduces that.
    const blob = keyBlobBytes === 48 ? Buffer.concat([key, crypto.randomBytes(16)]) : key;
    const prefixedKey = '-----BEGIN PUBLIC KEY-----\n'.concat(visaPublicRsaKey).concat('\n-----END PUBLIC KEY-----');
    const encryptedKey = crypto.publicEncrypt({
        key: prefixedKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    }, blob);

    return { key, encryptedKey };
};

// Same as production's encryptObject, but it also hands back the plaintext
// session key. Production discards it; the terminal may well encrypt its reply
// with that same key, in which case we need it to read the response.
const encryptObjectKeepingKey = (object, visaPublicRsaKey, keyBlobBytes) => {
    const objectAsText = JSON.stringify(object);
    const _key = generateEncryptedKeyFromVisaPubKey(visaPublicRsaKey, keyBlobBytes);
    const cipher = crypto.createCipheriv('aes-256-ecb', _key.key, '');
    let encryptedObject = cipher.update(objectAsText, 'utf-8', 'base64');
    encryptedObject += cipher.final('base64');

    return {
        envelope: {
            k: _key.encryptedKey.toString('base64'),
            d: encryptedObject
        },
        sessionKey: _key.key
    };
};

const encryptObject = (object, visaPublicRsaKey) => encryptObjectKeepingKey(object, visaPublicRsaKey).envelope;

const decryptObject = (cipherJson, terminalPrivateRsaKey) => {
    const encryptedMsg = JSON.parse(cipherJson);
    const plainAesKey = crypto.privateDecrypt({
        key: terminalPrivateRsaKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    }, Buffer.from(encryptedMsg.k, 'base64'));

    const aes32Key = Buffer.alloc(32);
    plainAesKey.copy(aes32Key, 0, 0, 32);

    const decCipher = crypto.createDecipheriv('aes-256-ecb', aes32Key, '');
    return decCipher.update(encryptedMsg.d, 'base64', 'utf-8') + decCipher.final('utf-8');
};

/**
 * Work out how the terminal actually encrypted a reply.
 *
 * The production scheme (RSA PKCS#1 unwrap, then AES-256-ECB over the first
 * 32 bytes of the unwrapped key) is only one of several plausible ones, and a
 * "bad decrypt" says nothing about which part is wrong. This walks the
 * combinations and reports the one that yields readable JSON, so the finding
 * can be folded back into electron.js.
 */
const diagnoseDecrypt = (cipherJson, terminalPrivateRsaKey, requestSessionKey, visaPublicRsaKey) => {
    const envelope = JSON.parse(cipherJson);
    const ciphertext = Buffer.from(envelope.d, 'base64');

    logger.info(`Ciphertext: ${ciphertext.length} bytes (${ciphertext.length % 16 === 0 ? 'a whole number of AES blocks' : 'NOT a multiple of 16 — not a raw block cipher output'})`);

    const tryKey = (label, key, algorithms) => {
        for (const algorithm of algorithms) {
            try {
                const iv = algorithm.endsWith('-cbc') ? Buffer.alloc(16) : '';
                const decipher = crypto.createDecipheriv(algorithm, key, iv);
                const plain = decipher.update(ciphertext, undefined, 'utf-8') + decipher.final('utf-8');
                if (/^\s*[[{]/.test(plain)) {
                    logger.info(`  MATCH — ${algorithm} using ${label}: ${plain}`);
                    return plain;
                }
            } catch (ex) {
                // Wrong key: expected for every candidate but the right one.
            }
        }
        return null;
    };

    // Cheapest hypothesis first: the terminal answered using the session key
    // from our own request rather than minting a new one.
    if (requestSessionKey) {
        const hit = tryKey('the session key from our request', requestSessionKey, ['aes-256-ecb', 'aes-256-cbc']);
        if (hit) {
            return hit;
        }
        logger.info('  The session key from our request does not decrypt the reply.');
    }

    const wrappedKey = Buffer.from(envelope.k, 'base64');

    const unwrapAttempts = [
        ['our private key, PKCS#1 v1.5', () => crypto.privateDecrypt({ key: terminalPrivateRsaKey, padding: crypto.constants.RSA_PKCS1_PADDING }, wrappedKey)],
        ['our private key, OAEP SHA-1', () => crypto.privateDecrypt({ key: terminalPrivateRsaKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, wrappedKey)],
        ['our private key, OAEP SHA-256', () => crypto.privateDecrypt({ key: terminalPrivateRsaKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, wrappedKey)]
    ];

    // The terminal handed us its public key during INIT. If replies were
    // encrypted to *our* public key that key would have no purpose, so it is
    // worth testing whether the terminal wraps with its own private key and
    // expects us to unwrap with the public one.
    if (visaPublicRsaKey) {
        const visaPem = '-----BEGIN PUBLIC KEY-----\n'.concat(visaPublicRsaKey).concat('\n-----END PUBLIC KEY-----');
        unwrapAttempts.push(["the terminal's public key, PKCS#1 v1.5", () => crypto.publicDecrypt({ key: visaPem, padding: crypto.constants.RSA_PKCS1_PADDING }, wrappedKey)]);
        unwrapAttempts.push(["the terminal's public key, no padding", () => crypto.publicDecrypt({ key: visaPem, padding: crypto.constants.RSA_NO_PADDING }, wrappedKey)]);
    }

    for (const [rsaLabel, run] of unwrapAttempts) {
        let unwrapped;
        try {
            unwrapped = run();
        } catch (ex) {
            logger.info(`Unwrap with ${rsaLabel}: failed (${ex.message.split('\n')[0]})`);
            continue;
        }

        logger.info(`Unwrap with ${rsaLabel}: got ${unwrapped.length} byte(s) -> ${unwrapped.toString('hex').slice(0, 128)}`);
        if (![16, 24, 32].includes(unwrapped.length)) {
            // OpenSSL 3.x answers a failed PKCS#1 v1.5 unpad with deterministic
            // pseudorandom bytes instead of an error, so an odd length here
            // means the unwrap did not really succeed.
            logger.info(`  ${unwrapped.length} bytes is not an AES key size — most likely a silently rejected unwrap rather than real plaintext.`);
        }

        // The unwrapped blob might be the raw key, a padded/truncated version
        // of it, or an ASCII (hex/base64) encoding of it.
        const candidateKeys = [['raw', unwrapped]];

        const padded32 = Buffer.alloc(32);
        unwrapped.copy(padded32, 0, 0, Math.min(unwrapped.length, 32));
        candidateKeys.push(['first 32 bytes, zero padded', padded32]);

        if (unwrapped.length >= 16) candidateKeys.push(['first 16 bytes', unwrapped.subarray(0, 16)]);

        const asText = unwrapped.toString('utf-8');
        if (/^[0-9a-fA-F]+$/.test(asText) && asText.length % 2 === 0) {
            candidateKeys.push(['hex-decoded', Buffer.from(asText, 'hex')]);
        }
        candidateKeys.push(['sha256 of blob', crypto.createHash('sha256').update(unwrapped).digest()]);

        for (const [keyLabel, key] of candidateKeys) {
            const algorithms = [];
            if (key.length === 16) algorithms.push('aes-128-ecb', 'aes-128-cbc');
            if (key.length === 24) algorithms.push('aes-192-ecb');
            if (key.length === 32) algorithms.push('aes-256-ecb', 'aes-256-cbc');
            if (!algorithms.length) continue;

            for (const algorithm of algorithms) {
                try {
                    const iv = algorithm.endsWith('-cbc') ? Buffer.alloc(16) : '';
                    const decipher = crypto.createDecipheriv(algorithm, key, iv);
                    const plain = decipher.update(ciphertext, undefined, 'utf-8') + decipher.final('utf-8');
                    if (/^\s*[[{]/.test(plain)) {
                        logger.info(`  MATCH — RSA ${rsaLabel} + ${algorithm} using the ${keyLabel}: ${plain}`);
                        return plain;
                    }
                    logger.info(`  ${algorithm} / ${keyLabel}: decrypted but the result is not JSON: ${JSON.stringify(plain.slice(0, 60))}`);
                } catch (ex) {
                    logger.info(`  ${algorithm} / ${keyLabel}: ${ex.message.split('\n')[0]}`);
                }
            }
        }

        // The unwrapped blob is far bigger than a key, so the real key may be
        // embedded at some offset in it. Sweep every window rather than guess.
        for (let offset = 0; offset + 32 <= unwrapped.length; offset++) {
            const hit = tryKey(`bytes ${offset}..${offset + 32} of the unwrapped blob`, unwrapped.subarray(offset, offset + 32), ['aes-256-ecb'])
                || tryKey(`bytes ${offset}..${offset + 16} of the unwrapped blob`, unwrapped.subarray(offset, offset + 16), ['aes-128-ecb']);
            if (hit) {
                return hit;
            }
        }
        logger.info(`  No 16- or 32-byte window of the ${rsaLabel} blob decrypts the reply either.`);
    }

    return null;
};

// ---------------------------------------------------------------------------
// `~PCNC~LLLL~` framing
// ---------------------------------------------------------------------------

const FRAME_PREFIX = '~PCNC~';

const buildFrame = (payload) => {
    let length = payload.length;
    while ((length + '').length < 4) {
        length = '0' + length;
    }
    return `${FRAME_PREFIX}${length}~${payload}`;
};

/**
 * Scan out one balanced JSON object.
 *
 * Unlike the TCP transport, the terminal answers the serial port with bare
 * JSON and no `~PCNC~` header, so there is no declared length to rely on —
 * brace depth is the only way to know the reply is complete. Braces inside
 * string literals (and escaped quotes) must not count.
 */
const takeJsonObject = (buffer) => {
    const text = buffer.toString('utf-8');
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
                const consumed = Buffer.byteLength(text.slice(0, i + 1), 'utf-8');
                return { frame: body, body, framed: false, rest: buffer.subarray(consumed) };
            }
        }
    }
    return null; // object still arriving
};

/** Accept either transport framing: `~PCNC~` frame, or a bare JSON object. */
const takeMessage = (buffer) => {
    const frameIndex = buffer.indexOf(FRAME_PREFIX, 0, 'ascii');
    const braceIndex = buffer.indexOf(0x7b /* { */);

    if (frameIndex >= 0 && (braceIndex < 0 || frameIndex < braceIndex)) {
        return takeFrame(buffer);
    }
    if (braceIndex >= 0) {
        return takeJsonObject(buffer);
    }
    return null;
};

/**
 * Pull one complete frame out of the receive buffer.
 *
 * Returns { frame, body, rest } once the declared payload has fully arrived,
 * or null while the frame is still incomplete. Any garbage preceding the
 * `~PCNC~` marker is discarded (line noise on a freshly opened COM port is
 * common).
 */
const takeFrame = (buffer) => {
    const start = buffer.indexOf(FRAME_PREFIX, 0, 'ascii');
    if (start < 0) {
        return null;
    }
    // The length field is normally zero-padded to 4 digits, but a payload over
    // 9999 bytes makes it wider, so read digits up to the closing "~" instead
    // of assuming a fixed header width.
    const digitsStart = start + FRAME_PREFIX.length;
    const searchEnd = Math.min(buffer.length, digitsStart + 8);
    let delimiter = -1;
    for (let i = digitsStart; i < searchEnd; i++) {
        if (buffer[i] === 0x7e /* ~ */) {
            delimiter = i;
            break;
        }
    }
    if (delimiter < 0) {
        if (searchEnd - digitsStart >= 8) {
            throw new Error(`Malformed frame header: ${JSON.stringify(buffer.toString('ascii', start, searchEnd))}`);
        }
        return null; // header still arriving
    }

    const declared = parseInt(buffer.toString('ascii', digitsStart, delimiter), 10);
    if (Number.isNaN(declared)) {
        throw new Error(`Malformed frame header: ${JSON.stringify(buffer.toString('ascii', start, delimiter + 1))}`);
    }

    const bodyStart = delimiter + 1;
    const end = bodyStart + declared;
    if (buffer.length < end) {
        return null;
    }
    return {
        frame: buffer.subarray(start, end).toString('utf-8'),
        body: buffer.subarray(bodyStart, end).toString('utf-8'),
        framed: true,
        rest: buffer.subarray(end)
    };
};

// ---------------------------------------------------------------------------
// Serial link
// ---------------------------------------------------------------------------

class VisaSerialLink {
    constructor(config) {
        this.config = config;
        this.port = null;
        this.buffer = Buffer.alloc(0);
        this.pending = null; // { resolve, reject, timer, heartbeat }
        this.rxTotal = 0;
    }

    get settingsLabel() {
        const parity = this.config.parity[0].toUpperCase();
        return `${this.config.baudRate} ${this.config.dataBits}${parity}${this.config.stopBits}`
            + `${this.config.rtscts ? ' rtscts' : ''} dtr=${this.config.dtr} rts=${this.config.rts}`;
    }

    open() {
        return new Promise((resolve, reject) => {
            logger.info(`Opening ${this.config.port} @ ${this.settingsLabel}`);

            this.port = new SerialPort({
                path: this.config.port,
                baudRate: this.config.baudRate,
                dataBits: this.config.dataBits,
                stopBits: this.config.stopBits,
                parity: this.config.parity,
                rtscts: this.config.rtscts,
                autoOpen: false
            });

            this.port.on('error', (err) => {
                logger.error(`Serial port error: ${err.message}`);
                this.failPending(err);
            });

            this.port.on('close', () => {
                logger.info('Serial port closed');
                this.failPending(new Error('Serial port closed before a complete response arrived'));
            });

            this.port.on('data', (chunk) => this.onData(chunk));

            this.port.open((err) => {
                if (err) {
                    reject(new Error(`Could not open ${this.config.port}: ${err.message}`));
                    return;
                }
                logger.info(`${this.config.port} open`);
                // Some terminals only enable their transmitter once the host
                // asserts DTR/RTS; others need them low. Set them explicitly
                // rather than relying on the driver default.
                this.port.set({ dtr: this.config.dtr, rts: this.config.rts }, (setErr) => {
                    if (setErr) {
                        logger.warn(`Could not set DTR/RTS: ${setErr.message}`);
                    }
                    this.logSignals('after open').then(resolve).catch(() => resolve());
                });
            });
        });
    }

    /**
     * Read the incoming modem control lines. On a live RS-232 peer that wires
     * them up, DSR/CTS go high; all-false usually means an unplugged cable, a
     * powered-off terminal, or a 3-wire cable that omits the handshake pins.
     */
    signals() {
        return new Promise((resolve) => {
            if (!this.port || !this.port.isOpen) {
                resolve(null);
                return;
            }
            this.port.get((err, status) => resolve(err ? null : status));
        });
    }

    async logSignals(context) {
        const status = await this.signals();
        if (!status) {
            logger.warn(`Modem signals unavailable (${context})`);
            return;
        }
        logger.info(`Modem signals ${context}: CTS=${status.cts} DSR=${status.dsr} DCD=${status.dcd}`);
    }

    close() {
        return new Promise((resolve) => {
            if (this.port && this.port.isOpen) {
                this.port.close(() => resolve());
            } else {
                resolve();
            }
        });
    }

    onData(chunk) {
        this.rxTotal += chunk.length;
        logger.info(`RX ${chunk.length} byte(s)\n${hexDump(chunk)}`);
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.drain();
    }

    drain() {
        if (!this.pending) {
            return;
        }
        let taken;
        try {
            taken = takeMessage(this.buffer);
        } catch (ex) {
            this.failPending(ex);
            return;
        }
        if (!taken) {
            return;
        }
        this.buffer = taken.rest;
        const { resolve, timer, heartbeat } = this.pending;
        clearTimeout(timer);
        clearInterval(heartbeat);
        this.pending = null;
        logger.info(`Received ${taken.framed ? '~PCNC~ frame' : 'bare JSON'} (${taken.body.length} byte body)`);
        resolve(taken);
    }

    failPending(error) {
        if (!this.pending) {
            return;
        }
        const { reject, timer, heartbeat } = this.pending;
        clearTimeout(timer);
        clearInterval(heartbeat);
        this.pending = null;
        reject(error);
    }

    send(payload) {
        const framed = this.config.framing !== 'none';
        const message = framed ? buildFrame(payload) : payload;
        const bytes = Buffer.from(message, 'utf-8');
        logger.info(`Sending ${framed ? '~PCNC~ frame' : 'bare JSON'} (${payload.length} byte body)`);
        logger.info(`TX ${bytes.length} byte(s)\n${hexDump(bytes)}`);

        return new Promise((resolve, reject) => {
            this.port.write(bytes, (err) => {
                if (err) {
                    reject(new Error(`Write failed: ${err.message}`));
                    return;
                }
                this.port.drain((drainErr) => {
                    if (drainErr) {
                        reject(new Error(`Drain failed: ${drainErr.message}`));
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    awaitFrame(timeoutMs) {
        if (this.pending) {
            return Promise.reject(new Error('A response is already being awaited'));
        }
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();

            const timer = setTimeout(() => {
                clearInterval(heartbeat);
                this.pending = null;
                const partial = this.buffer.length
                    ? ` Partial buffer (${this.buffer.length} bytes):\n${hexDump(this.buffer)}`
                    : ' Nothing was received.';
                reject(new Error(`Timed out after ${timeoutMs}ms waiting for a response.${partial}`));
            }, timeoutMs);

            // A silent 80-second wait tells you nothing. Report progress and
            // the modem lines every few seconds so a cable being unplugged (or
            // the terminal rebooting) is visible while it happens.
            const heartbeat = setInterval(async () => {
                const elapsed = Math.round((Date.now() - startedAt) / 1000);
                const status = await this.signals();
                const signalText = status ? `CTS=${status.cts} DSR=${status.dsr} DCD=${status.dcd}` : 'unavailable';
                logger.info(`Waiting... ${elapsed}s elapsed, ${this.rxTotal} byte(s) received so far, signals ${signalText}`);
            }, 5000);

            this.pending = { resolve, reject, timer, heartbeat };
            // Data may already be sitting in the buffer from a previous read.
            this.drain();
        });
    }

    /**
     * Wake/flush handshake, copied from BOP's toolkit.
     *
     * The terminal ignores the first framed request after the port is opened.
     * Their DLL works around it by writing a junk string and swallowing the
     * reply — the terminal answers unrecognised input with a stock
     * "Client-Server settings not initialized" error — and only then sends the
     * real request. Without this step a framed INIT gets no response at all.
     */
    async wake(payload) {
        logger.info(`Wake-up: sending ${JSON.stringify(payload)} and discarding the reply (this is what BOP's toolkit does)`);
        await this.writeRaw(Buffer.from(payload, 'ascii'));

        for (let attempt = 0; attempt < 4; attempt++) {
            await sleep(1000);
            if (this.buffer.length && this.buffer.toString('utf-8').trimEnd().endsWith('}')) {
                break;
            }
        }

        if (this.buffer.length) {
            logger.info(`Wake-up reply (discarded): ${this.buffer.toString('utf-8')}`);
        } else {
            logger.warn('Wake-up produced no reply. The terminal may be powered off or not in ECR mode.');
        }

        this.buffer = Buffer.alloc(0);
        this.rxTotal = 0;
    }

    /** Raw write with no framing — used by the wake-up and loopback checks. */
    writeRaw(bytes) {
        logger.info(`TX raw ${bytes.length} byte(s)\n${hexDump(bytes)}`);
        return new Promise((resolve, reject) => {
            this.port.write(bytes, (err) => {
                if (err) {
                    reject(new Error(`Write failed: ${err.message}`));
                } else {
                    this.port.drain(() => resolve());
                }
            });
        });
    }

    async request(payload, timeoutMs) {
        await this.send(payload);
        return this.awaitFrame(timeoutMs);
    }
}

// ---------------------------------------------------------------------------
// Key storage
// ---------------------------------------------------------------------------

const keyPaths = () => ({
    privateKey: path.join(options.keysDir, 'private.key'),
    publicKey: path.join(options.keysDir, 'public.key'),
    visaPublicKey: path.join(options.keysDir, 'visa-public.key')
});

const generateTerminalKeyPair = () => {
    logger.info('Generating RSA 4096 key pair for the terminal (this takes a few seconds)...');
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
};

/**
 * Only ever called once the terminal has accepted the handshake. Writing the
 * key pair before that point would overwrite a working pairing with one the
 * terminal never acknowledged, leaving nothing that can decrypt its replies.
 */
const persistKeys = ({ publicKey, privateKey, visaPublicRsaKey }) => {
    const paths = keyPaths();
    fs.mkdirSync(options.keysDir, { recursive: true });

    // Archive whatever pairing is already on disk. Only the private key that
    // the terminal paired with can read its replies, so losing it means the
    // terminal has to be re-paired from its own menus.
    if (fs.existsSync(paths.privateKey)) {
        const archiveDir = path.join(options.keysDir, 'archive', new Date().toISOString().replace(/[:.]/g, '-'));
        fs.mkdirSync(archiveDir, { recursive: true });
        Object.values(paths).forEach((p) => {
            if (fs.existsSync(p)) {
                fs.copyFileSync(p, path.join(archiveDir, path.basename(p)));
            }
        });
        logger.info(`Previous pairing archived to ${archiveDir}`);
    }

    fs.writeFileSync(paths.privateKey, privateKey);
    fs.writeFileSync(paths.publicKey, publicKey);
    fs.writeFileSync(paths.visaPublicKey, visaPublicRsaKey);
    logger.info(`Key pair and terminal public key written to ${options.keysDir}`);
};

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

const buildInitRequest = (publicKey) => {
    // Field order follows BOP's toolkit. A conforming JSON parser would not
    // care, but there is no reason to differ from the one payload we know the
    // terminal accepts.
    const request = { lang: options.lang };
    if (options.print !== null && !Number.isNaN(options.print)) {
        request.print = options.print;
    }
    request.rsaPubKey = fixRsaFormat(publicKey);
    request.type = 'INIT';
    return JSON.stringify(request);
};

const runInit = async (link) => {
    const { publicKey, privateKey } = generateTerminalKeyPair();

    const initRequestObject = buildInitRequest(publicKey);

    logger.info('--- INIT handshake ---');
    let response;
    try {
        response = await link.request(initRequestObject, options.initTimeout);
    } catch (ex) {
        if (link.rxTotal === 0) {
            logger.error('The terminal sent back nothing at all. Things to try, in order:');
            if (!options.wake) {
                logger.error('  0. Drop --wake false. A framed request sent without the wake-up is ignored.');
            }
            logger.error('  1. node scripts/bopvisa-serial-test.js --port ' + options.port + ' --loopback   (proves the adapter and cable)');
            logger.error('  2. node scripts/bopvisa-serial-test.js --port ' + options.port + ' --scan       (tries every common baud rate)');
            logger.error('  3. node scripts/bopvisa-serial-test.js --port ' + options.port + ' --listen 60  (passive; trigger something on the terminal itself)');
            logger.error('  Also confirm the terminal is switched to serial/ECR mode, and that the cable is the right type (null-modem vs straight-through).');
        }
        throw ex;
    }

    logger.info(`INIT response body: ${response.body}`);

    let initResponse;
    try {
        initResponse = JSON.parse(response.body);
    } catch (ex) {
        throw new Error(`Could not parse INIT response as JSON: ${ex.message}`);
    }

    if (!initResponse || !initResponse.rsaPubKey) {
        if (initResponse && initResponse.d && initResponse.k) {
            throw new Error('The terminal answered INIT with an encrypted envelope instead of its public key. It only sends the key in the clear on a first pairing, so the existing pairing is still in force — run with --sale-only to reuse the stored keys.');
        }
        throw new Error(`Invalid INIT response from the terminal: ${JSON.stringify(initResponse)}`);
    }

    persistKeys({ publicKey, privateKey, visaPublicRsaKey: initResponse.rsaPubKey });

    return { publicKey, privateKey, visaPublicRsaKey: initResponse.rsaPubKey };
};

const loadStoredKeys = () => {
    const paths = keyPaths();
    const missing = Object.entries(paths).filter(([, p]) => !fs.existsSync(p)).map(([name]) => name);
    if (missing.length) {
        throw new Error(`Cannot run --sale-only: missing ${missing.join(', ')} in ${options.keysDir}. Run the INIT handshake first.`);
    }
    // The two files are written together by a successful handshake, so a
    // private key newer than the terminal key means a later INIT replaced our
    // half of a pairing the terminal still holds the old public key for.
    if (fs.statSync(paths.privateKey).mtimeMs > fs.statSync(paths.visaPublicKey).mtimeMs + 1000) {
        logger.warn('private.key is newer than visa-public.key: these two are from different handshakes, so the terminal is very likely still paired with an older public key and its replies will not decrypt. Look under the archive folder for the matching pair.');
    }

    return {
        privateKey: fs.readFileSync(paths.privateKey, 'utf-8'),
        publicKey: fs.readFileSync(paths.publicKey, 'utf-8'),
        visaPublicRsaKey: fs.readFileSync(paths.visaPublicKey, 'utf-8').trim()
    };
};

const runSale = async (link, keys) => {
    logger.info('--- SALE transaction ---');
    logger.info(`amt=${options.amt} (minor units) cur=${options.cur} rcpt=${options.rcpt}`);

    const { envelope, sessionKey } = encryptObjectKeepingKey({
        lang: options.lang,
        type: 'SALE',
        amt: options.amt,
        cur: options.cur,
        rcpt: options.rcpt
    }, keys.visaPublicRsaKey, options.keyBlob);

    logger.info('Follow the prompts on the payment terminal (card / PIN)...');
    const response = await link.request(JSON.stringify(envelope), options.saleTimeout);
    logger.info(`SALE response envelope: ${response.body}`);

    // `response.body` is the {k,d} envelope with any transport framing already
    // removed, which is what the TCP path gets after slicing off its 11-byte
    // prefix.
    let plain;
    try {
        plain = decryptObject(response.body, keys.privateKey);
    } catch (ex) {
        logger.error(`The production decryption scheme failed: ${ex.message}`);
        logger.info('--- Trying other schemes to identify what this firmware uses ---');
        plain = diagnoseDecrypt(response.body, keys.privateKey, sessionKey, keys.visaPublicRsaKey);
        if (!plain) {
            throw ex;
        }
    }
    logger.info(`SALE response (decrypted): ${plain}`);

    const saleResponse = JSON.parse(plain);
    if (saleResponse.resp_code === 0) {
        const card = saleResponse.card || {};
        const sale = saleResponse.sale || saleResponse;
        logger.info(`APPROVED — auth_code=${saleResponse.auth_code} pan=${card.pan || 'n/a'} amt=${sale.amt} cur=${sale.cur}`);
    } else {
        logger.warn(`DECLINED / ERROR — resp_code=${saleResponse.resp_code} error_msg=${saleResponse.error_msg}`);
    }

    return saleResponse;
};

const listPorts = async () => {
    const ports = await SerialPort.list();
    if (!ports.length) {
        logger.warn('No serial ports found');
        return;
    }
    ports.forEach((p) => {
        logger.info(`${p.path} — ${p.manufacturer || 'unknown manufacturer'} ${p.friendlyName ? `(${p.friendlyName})` : ''}`);
    });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Proves the USB adapter, the driver and the cable up to the jumper are all
 * working: with pins 2 and 3 shorted, whatever we transmit must come straight
 * back. If this fails, nothing else in this script can possibly work.
 */
const runLoopback = async () => {
    logger.info('--- Loopback test ---');
    logger.info('Short pins 2 (RXD) and 3 (TXD) on the DB9 end, then let this run.');

    const link = new VisaSerialLink(options);
    await link.open();

    try {
        const probe = Buffer.from('LOOPBACK-0123456789');
        await link.writeRaw(probe);
        await sleep(1500);

        const echoed = link.buffer;
        if (echoed.length === 0) {
            logger.error('Nothing came back. The adapter, the driver or the cable up to the jumper is faulty — or pins 2/3 are not actually shorted.');
        } else if (echoed.toString('utf-8').includes(probe.toString('utf-8'))) {
            logger.info('Loopback OK — the adapter and cable are fine, so the problem is beyond this point (terminal side).');
        } else {
            // A connected terminal rejects the probe as an unknown message,
            // which is an even better result than an echo: it proves the whole
            // link works and the line settings are right.
            logger.info(`Different bytes came back, so this is not an echo — the terminal itself answered, and the link is good at these settings.\nSent:\n${hexDump(probe)}\nGot:\n${hexDump(echoed)}`);
        }
    } finally {
        await link.close();
    }
};

/**
 * Passive monitor. Never transmits, so it can also be used while the terminal
 * is driven from its own menus — if the terminal is configured for serial ECR
 * at the baud rate we opened, key presses or a menu-driven test print usually
 * produce traffic here.
 */
const runListen = async () => {
    logger.info(`--- Passive listen for ${options.listenSeconds}s (nothing will be transmitted) ---`);
    logger.info('Try triggering something on the terminal itself (a menu test, a card swipe) and watch for bytes.');

    const link = new VisaSerialLink(options);
    await link.open();

    try {
        for (let elapsed = 0; elapsed < options.listenSeconds; elapsed += 5) {
            await sleep(Math.min(5000, (options.listenSeconds - elapsed) * 1000));
            await link.logSignals(`at ${elapsed + 5}s (${link.rxTotal} byte(s) received)`);
        }

        if (link.rxTotal === 0) {
            logger.warn('The terminal transmitted nothing at all during the listen window.');
        } else {
            logger.info(`Total received: ${link.rxTotal} byte(s). Full buffer:\n${hexDump(link.buffer)}`);
        }
    } finally {
        await link.close();
    }
};

/**
 * Send the same INIT frame at each candidate baud rate. Even a reply that
 * decodes as garbage is a useful result: it means the terminal is listening
 * and only the line settings are wrong.
 */
const runScan = async () => {
    logger.info(`--- Baud scan: ${options.scanBauds.join(', ')} ---`);

    // Generate the key pair once; regenerating a 4096-bit pair per baud rate
    // would dominate the runtime for no benefit.
    const { publicKey } = generateTerminalKeyPair();
    const initRequestObject = buildInitRequest(publicKey);

    const results = [];

    for (const baudRate of options.scanBauds) {
        const link = new VisaSerialLink({ ...options, baudRate });
        try {
            await link.open();
            if (options.wake) {
                await link.wake(options.wakePayload);
            }
            await link.send(initRequestObject);
            await sleep(options.scanTimeout);
            results.push({ baudRate, bytes: link.rxTotal, sample: link.buffer.subarray(0, 64) });
            logger.info(`${baudRate}: ${link.rxTotal} byte(s) received`);
        } catch (ex) {
            logger.error(`${baudRate}: ${ex.message}`);
            results.push({ baudRate, bytes: 0, error: ex.message });
        } finally {
            await link.close();
            await sleep(300); // let the driver release the port between opens
        }
    }

    logger.info('--- Scan summary ---');
    results.forEach((r) => {
        const detail = r.error ? `error: ${r.error}`
            : r.bytes === 0 ? 'silent'
            : `${r.bytes} byte(s):\n${hexDump(r.sample)}`;
        logger.info(`${String(r.baudRate).padStart(6)} — ${detail}`);
    });

    const responsive = results.filter((r) => r.bytes > 0);
    if (!responsive.length) {
        logger.warn('Every baud rate was silent. The terminal is not transmitting at all, which points at wiring, the cable type (straight vs null-modem), or the terminal not being switched to serial ECR mode.');
    } else {
        logger.info(`Got bytes at: ${responsive.map((r) => r.baudRate).join(', ')}. Re-run the handshake with --baud <that value>.`);
    }
};

const main = async () => {
    if (options.list) {
        await listPorts();
        return;
    }
    if (options.loopback) {
        await runLoopback();
        return;
    }
    if (options.listen) {
        await runListen();
        return;
    }
    if (options.scan) {
        await runScan();
        return;
    }

    if (options.initOnly && options.saleOnly) {
        throw new Error('--init-only and --sale-only are mutually exclusive');
    }

    const link = new VisaSerialLink(options);
    await link.open();

    try {
        if (options.wake) {
            await link.wake(options.wakePayload);
        }

        let keys;
        if (options.saleOnly) {
            keys = loadStoredKeys();
            logger.info(`Reusing keys from ${options.keysDir}`);
        } else {
            keys = await runInit(link);
        }

        if (!options.initOnly) {
            await runSale(link, keys);
        }
    } finally {
        await link.close();
    }
};

if (require.main === module) {
    main()
        .then(() => {
            logger.info('Done');
            process.exit(0);
        })
        .catch((ex) => {
            logger.error(ex && ex.stack ? ex.stack : String(ex));
            process.exit(1);
        });
}

module.exports = { buildFrame, takeFrame, takeJsonObject, takeMessage, encryptObject, decryptObject, fixRsaFormat };
