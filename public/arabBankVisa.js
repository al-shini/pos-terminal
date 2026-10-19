/**
 * Arab Bank Visa (Jordan) — Electron-side helpers.
 *
 * The card terminal itself is driven by a separate Windows service
 * (arabi-visa-pos-windows-service, bundled Node 18 + edge-js + the bank's
 * CashierAgentDesktopDLL) that listens on 127.0.0.1:<arabiVisaServicePort>.
 * The renderer never talks to that service directly: every call goes through
 * the Electron express app (see the /arabiVisa/* routes in electron.js), which
 * owns the busy lock, the logging, and the install / auto-detect flows.
 *
 * Everything in this file is plain Node (no Electron APIs) so the unit tests
 * under scripts/ can require it.
 */

const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');

const DEFAULT_SERVICE_PORT = 9700;
const DEFAULT_BAUD = 115200;
const DEFAULT_TIMEOUT_SEC = 90;
const DEFAULT_SERVICE_DIR = 'C:/pos/arabi-visa-pos-windows-service';
const SERVICE_ID = 'arabibankvisaservice.exe';
const SERVICE_NAME = 'arabi-bank-visa-service';

// USB vendor ids of the serial adapters the bank ships / we have seen in the
// field. Prolific PL2303 (067B) is the one in the Arab Bank integration kit.
const PREFERRED_VENDOR_IDS = ['067b', '0403', '10c4', '1a86'];

const normaliseComPort = (v) => {
    if (v === undefined || v === null) return '';
    const s = String(v).trim().toUpperCase();
    if (!s) return '';
    if (/^\d+$/.test(s)) return 'COM' + s;
    const m = s.match(/^(?:\\\\\.\\)?COM(\d+)$/);
    return m ? 'COM' + parseInt(m[1], 10) : s;
};

const toInt = (v, def) => {
    if (v === undefined || v === null || v === '') return def;
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : def;
};

/** Mirror of the service's lib/config.js defaults, from the POS's posconfig.json view. */
const resolveSettings = (localConfig) => {
    const cfg = localConfig || {};
    const port = toInt(cfg.arabiVisaServicePort, DEFAULT_SERVICE_PORT);
    const timeoutSec = Math.min(Math.max(toInt(cfg.arabiVisaTimeoutSec, DEFAULT_TIMEOUT_SEC), 30), 180);
    return {
        comPort: normaliseComPort(cfg.arabiVisaCom),
        baudRate: toInt(cfg.arabiVisaBaudRate, DEFAULT_BAUD),
        timeoutSec,
        servicePort: port,
        serviceUrl: 'http://127.0.0.1:' + port,
        serviceDir: cfg.arabiVisaServiceDir ? String(cfg.arabiVisaServiceDir) : DEFAULT_SERVICE_DIR,
        scaleCom: normaliseComPort(cfg.scaleCOM || cfg.scaleCom),
        enableReceipt: cfg.arabiVisaEnableReceipt !== false,
        skipConfirm: cfg.arabiVisaSkipConfirm !== false
    };
};

/** Ports that must not be probed/used for the card terminal, with the reason. */
const reservedPorts = (localConfig, terminal) => {
    const cfg = localConfig || {};
    const out = {};
    const scale = normaliseComPort(cfg.scaleCOM || cfg.scaleCom);
    if (scale) out[scale] = 'scale (scaleCOM)';
    const bop = terminal && terminal.bopVisaIp ? normaliseComPort(terminal.bopVisaIp) : '';
    if (bop && /^COM\d+$/.test(bop)) out[bop] = 'BOP Visa terminal';
    return out;
};

/**
 * Order the machine's serial ports by how likely each is to be the Arab Bank
 * terminal. Returns [{ path, reason, ...port }]; reserved ports are dropped.
 */
const pickCandidatePorts = (ports, localConfig, terminal) => {
    const reserved = reservedPorts(localConfig, terminal);
    const configured = normaliseComPort((localConfig || {}).arabiVisaCom);
    const score = (p) => {
        const vid = String(p.vendorId || '').toLowerCase();
        let s = 0;
        if (configured && normaliseComPort(p.path) === configured) s += 100;
        if (vid && PREFERRED_VENDOR_IDS.indexOf(vid) >= 0) s += 50;
        if (vid === '067b') s += 10; // Prolific: the adapter in the bank's kit
        if (p.usb || p.vendorId || p.productId) s += 20;
        if (/prolific|pl2303|usb/i.test(String(p.friendlyName || p.manufacturer || ''))) s += 5;
        if (/bluetooth/i.test(String(p.friendlyName || p.manufacturer || ''))) s -= 60;
        return s;
    };
    return (ports || [])
        .map((p) => Object.assign({}, p, { path: normaliseComPort(p.path) }))
        .filter((p) => /^COM\d+$/.test(p.path) && !reserved[p.path])
        .map((p) => Object.assign({}, p, { score: score(p) }))
        .sort((a, b) => b.score - a.score || parseInt(a.path.slice(3), 10) - parseInt(b.path.slice(3), 10));
};

/** Conflicts between the configured port and other devices on the station. */
const comPortConflicts = (localConfig, terminal) => {
    const comPort = normaliseComPort((localConfig || {}).arabiVisaCom);
    if (!comPort) return [];
    const reserved = reservedPorts(localConfig, terminal);
    return reserved[comPort] ? [comPort + ' is also used by the ' + reserved[comPort]] : [];
};

/**
 * Translate an axios failure from the service into the { status, body } the
 * renderer should see. Never throws.
 */
const classifySaleError = (err, settings) => {
    const s = settings || {};
    if (err && err.response) {
        const isJson = err.response.data && typeof err.response.data === 'object';
        if (!isJson && err.response.status >= 500) {
            // The service answered but not in its own JSON contract: it may
            // have crashed AFTER handing the sale to the terminal. Unknown.
            return {
                status: 504,
                body: {
                    ok: false,
                    code: 'outcomeUnknown',
                    outcomeUnknown: true,
                    error: 'Unreadable answer from the card service (HTTP ' + err.response.status + '). CHECK THE TERMINAL SLIP before doing anything else.'
                }
            };
        }
        const body = isJson ? err.response.data : { ok: false, error: String(err.response.data || err.message) };
        if (!body.code) body.code = err.response.status === 409 ? 'busy' : 'serviceError';
        return { status: err.response.status, body };
    }
    const code = err && err.code;
    // Refused = nothing listening, the request never left this PC: safe to retry.
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
        return {
            status: 503,
            body: {
                ok: false,
                code: 'SERVICE_DOWN',
                error: 'The Arab Bank Visa service is not running on this PC (port ' + (s.servicePort || DEFAULT_SERVICE_PORT) + ').',
                hint: 'Open Admin > Arab Bank Visa > Setup automatically, or run install.bat in ' + (s.serviceDir || DEFAULT_SERVICE_DIR)
            }
        };
    }
    // Reset / aborted / timed out = the request DID reach the service, which may
    // have put the sale on the terminal before dying. Outcome unknown.
    if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'EPIPE' || /timeout/i.test(String(err && err.message))) {
        return {
            status: 504,
            body: {
                ok: false,
                code: 'outcomeUnknown',
                outcomeUnknown: true,
                error: 'The card terminal service stopped answering mid-transaction (' + (code || 'timeout') + '). CHECK THE TERMINAL SLIP before doing anything else.'
            }
        };
    }
    return {
        status: 502,
        body: { ok: false, code: 'serviceError', error: (err && err.message) || String(err) }
    };
};

// ---------------------------------------------------------------------------
// Windows service state / installer
// ---------------------------------------------------------------------------

/** Parse `sc.exe query` output. */
const parseScQuery = (stdout, exitCode) => {
    const text = String(stdout || '');
    if (/1060|does not exist/i.test(text) || exitCode === 1060) {
        return { installed: false, state: 'NOT_INSTALLED' };
    }
    const m = text.match(/STATE\s*:\s*\d+\s+([A-Z_]+)/i);
    if (m) return { installed: true, state: m[1].toUpperCase() };
    return { installed: null, state: 'UNKNOWN', raw: text.trim() };
};

const queryServiceState = (serviceId) => new Promise((resolve) => {
    if (process.platform !== 'win32') {
        resolve({ installed: false, state: 'NOT_WINDOWS' });
        return;
    }
    execFile('sc.exe', ['query', serviceId || SERVICE_ID], { windowsHide: true, timeout: 5000 }, (err, stdout, stderr) => {
        const code = err && typeof err.code === 'number' ? err.code : 0;
        resolve(parseScQuery(String(stdout || '') + String(stderr || ''), code));
    });
});

const packageStatus = (serviceDir) => {
    const dir = serviceDir || DEFAULT_SERVICE_DIR;
    const has = (rel) => fs.existsSync(path.join(dir, rel));
    return {
        dir,
        present: has('index.js') && has('install.ps1'),
        bundledNode: has(path.join('node', 'node.exe')),
        dll: has('CashierAgentDesktopDLL.dll'),
        nodeModules: has(path.join('node_modules', 'edge-js')) && has(path.join('node_modules', 'node-windows')),
        version: (() => {
            try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version || null; } catch (_) { return null; }
        })()
    };
};

const readInstallResult = (serviceDir) => {
    try {
        const file = path.join(serviceDir || DEFAULT_SERVICE_DIR, 'logs', 'install-result.json');
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    } catch (_) {
        return null;
    }
};

const tailInstallLog = (serviceDir, maxLines) => {
    try {
        const file = path.join(serviceDir || DEFAULT_SERVICE_DIR, 'logs', 'install-latest.log');
        if (!fs.existsSync(file)) return [];
        const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
        return lines.slice(-(maxLines || 40));
    } catch (_) {
        return [];
    }
};

// One installer at a time, process-wide.
let activeInstall = null; // { startedAt, port, promise, exitCode, error, done }

const getActiveInstall = () => (activeInstall ? {
    running: !activeInstall.done,
    startedAt: activeInstall.startedAt,
    port: activeInstall.port,
    exitCode: activeInstall.done ? activeInstall.exitCode : null,
    error: activeInstall.error || null
} : null);

/**
 * Launch install.ps1 (self-elevating → UAC prompt) and resolve with its exit
 * code. The elevated child's console is not ours, so progress is read from
 * logs/install-latest.log and logs/install-result.json afterwards.
 */
const runInstaller = (serviceDir, options) => {
    if (activeInstall && !activeInstall.done) {
        return Promise.reject(Object.assign(new Error('An installation is already running'), { code: 'INSTALL_RUNNING' }));
    }
    const dir = serviceDir || DEFAULT_SERVICE_DIR;
    const script = path.join(dir, 'install.ps1');
    if (!fs.existsSync(script)) {
        return Promise.reject(Object.assign(new Error('install.ps1 not found in ' + dir), { code: 'PACKAGE_MISSING' }));
    }
    const opts = options || {};
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-NonInteractive'];
    if (opts.port) args.push('-Port', String(opts.port));
    if (opts.configPath) args.push('-ConfigPath', String(opts.configPath));

    // Clear the previous run's artefacts so the UI never shows stale success.
    try { fs.unlinkSync(path.join(dir, 'logs', 'install-result.json')); } catch (_) { /* none */ }

    const entry = { startedAt: new Date().toISOString(), port: opts.port || null, done: false, exitCode: null, error: null };
    activeInstall = entry;
    entry.promise = new Promise((resolve) => {
        let child;
        try {
            child = spawn('powershell.exe', args, { cwd: dir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (ex) {
            entry.done = true; entry.exitCode = 1; entry.error = ex.message;
            resolve({ exitCode: 1, error: ex.message });
            return;
        }
        let out = '';
        child.stdout.on('data', (d) => { out += d; });
        child.stderr.on('data', (d) => { out += d; });
        const timer = setTimeout(() => {
            entry.error = 'Installer did not finish within 5 minutes (UAC prompt left unanswered?)';
            try { child.kill(); } catch (_) { /* ignore */ }
        }, 5 * 60 * 1000);
        child.on('error', (ex) => {
            clearTimeout(timer);
            entry.done = true; entry.exitCode = 1; entry.error = ex.message;
            resolve({ exitCode: 1, error: ex.message, output: out });
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            entry.done = true; entry.exitCode = code === null ? 1 : code;
            resolve({ exitCode: entry.exitCode, error: entry.error, output: out });
        });
    });
    return entry.promise;
};

const describeInstallExit = (code) => ({
    0: 'Installed and healthy',
    1: 'Installer failed (see log)',
    2: 'TCP port already in use - change arabiVisaServicePort',
    3: 'Prerequisite missing (.NET 4.x / bundled node / DLL / node_modules)',
    4: 'Service registered but /health did not answer',
    5: 'Service already installed'
}[code] || ('Installer exit code ' + code));

module.exports = {
    DEFAULT_SERVICE_PORT,
    DEFAULT_BAUD,
    DEFAULT_TIMEOUT_SEC,
    DEFAULT_SERVICE_DIR,
    SERVICE_ID,
    SERVICE_NAME,
    PREFERRED_VENDOR_IDS,
    normaliseComPort,
    resolveSettings,
    reservedPorts,
    pickCandidatePorts,
    comPortConflicts,
    classifySaleError,
    parseScQuery,
    queryServiceState,
    packageStatus,
    readInstallResult,
    tailInstallLog,
    getActiveInstall,
    runInstaller,
    describeInstallExit
};
