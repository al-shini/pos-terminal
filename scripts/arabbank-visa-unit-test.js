/**
 * Arab Bank Visa integration — dependency-free unit checks.
 *
 *   node scripts/arabbank-visa-unit-test.js
 *
 * Covers the two pure modules the payment flow depends on:
 *   - src/utils/arabBankVisa.js  (renderer: amounts, codes, outcome wording)
 *   - public/arabBankVisa.js     (Electron: settings, port scoring, error mapping)
 * Mirrors scripts/bopvisa-unit-test.js: PASS/FAIL lines, non-zero exit on failure.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

let failures = 0;
const check = (label, ok, detail) => {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail !== undefined ? '  ' + detail : ''));
    if (!ok) failures++;
};

// --- load the ESM renderer util without babel --------------------------------
const loadEsm = (file) => {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/^export const /gm, 'exports.')
        .replace(/^export default [\s\S]*?;\s*$/m, '')
        .replace(/^import [^;]+;\s*$/gm, '');
    // `exports.foo = ...` leaves later references to bare `foo` dangling; alias them.
    const names = [...src.matchAll(/^exports\.(\w+)\s*=/gm)].map((m) => m[1]);
    src += '\n' + names.map((n) => `var ${n} = exports.${n};`).join('\n');
    // hoist aliases: wrap so that the body sees them (functions are arrow consts,
    // evaluated lazily, so declaring the vars after is fine as long as they exist
    // before any call — which they do).
    const m = new Module(file, null);
    m.filename = file;
    m.paths = Module._nodeModulePaths(path.dirname(file));
    m._compile(src, file);
    return m.exports;
};

const ab = loadEsm(path.join(__dirname, '..', 'src', 'utils', 'arabBankVisa.js'));
const el = require(path.join(__dirname, '..', 'public', 'arabBankVisa.js'));

// --- amounts -----------------------------------------------------------------
check('JOD has 3 decimals', ab.toMinorUnits(12.345, 'JOD') === 12345, ab.toMinorUnits(12.345, 'JOD'));
check('JOD float noise rounds', ab.toMinorUnits(0.1 + 0.2, 'JOD') === 300, ab.toMinorUnits(0.1 + 0.2, 'JOD'));
check('USD has 2 decimals', ab.toMinorUnits(10.5, 'USD') === 1050);
check('negative due becomes positive charge', ab.toMinorUnits(-7.25, 'JOD') === 7250);
check('NaN amount is 0', ab.toMinorUnits('abc', 'JOD') === 0);
check('fromMinorUnits JOD', ab.fromMinorUnits(12345, 'JOD') === 12.345);
check('fromMinorUnits USD', ab.fromMinorUnits(1050, 'USD') === 10.5);
check('round trip 0.005 JOD', ab.fromMinorUnits(ab.toMinorUnits(0.005, 'JOD'), 'JOD') === 0.005);

// --- reference ---------------------------------------------------------------
const ref = ab.buildTransIndexCode(new Date(2026, 9, 19, 8, 5, 3));
check('transIndexCode is YYMMDDHHmmss', ref === '261019080503', ref);
check('transIndexCode always 12 digits', /^\d{12}$/.test(ab.buildTransIndexCode()));

// --- response codes ----------------------------------------------------------
check('000 approved', ab.isApprovedCode('000'));
check('numeric 0 approved', ab.isApprovedCode(0));
check('"10" normalises to 010', ab.isApprovedCode('10') && ab.normaliseCode('10') === '010');
check('051 declined', !ab.isApprovedCode('051'));
check('-139 not approved', !ab.isApprovedCode('-139'));
check('-139 keeps sign', ab.normaliseCode('-139') === '-139');
check('describeCode has Arabic', /[\u0600-\u06FF]/.test(ab.describeCode('051').ar));
check('unknown code falls back to RespDesc', ab.describeCode('999', 'Weird').en === 'Weird');

// --- interpretSale -----------------------------------------------------------
const approved = ab.interpretSale({
    approved: true, respCode: '000', amountMinor: 12345, requestedAmountMinor: 12345,
    rrn: '123456789012', authCode: 'AB12', cardNum: '411111******1111', transIndexCode: '261019080503', currencyCode: 400
}, 'JOD');
check('approved kind', approved.kind === 'approved');
check('approved amount from terminal', approved.amount === 12.345);
check('approved not lesser', approved.lesser === false);

const lesser = ab.interpretSale({ approved: true, respCode: '010', amountMinor: 10000, requestedAmountMinor: 12345 }, 'JOD');
check('010 is lesser amount', lesser.kind === 'approved' && lesser.lesser === true && lesser.amount === 10);

const implicitLesser = ab.interpretSale({ approved: true, respCode: '000', amountMinor: 5000, requestedAmountMinor: 12345 }, 'JOD');
check('smaller amount than requested flagged lesser even with 000', implicitLesser.lesser === true);

const cancelled = ab.interpretSale({ approved: false, cancelled: true, respCode: '-139' }, 'JOD');
check('cancelled kind', cancelled.kind === 'cancelled');

const declined = ab.interpretSale({ approved: false, respCode: '051', respDesc: 'Insufficient funds' }, 'JOD');
check('declined kind', declined.kind === 'declined' && declined.desc.en === 'Insufficient funds');

const noAmount = ab.interpretSale({ approved: true, respCode: '000', requestedAmountMinor: 2000 }, 'JOD');
check('missing amountMinor falls back to requested', noAmount.amount === 2);

check('approved flag absent → derive from code', ab.interpretSale({ respCode: '000', amountMinor: 1 }, 'JOD').kind === 'approved');
check('approved=false wins over 000', ab.interpretSale({ approved: false, respCode: '000' }, 'JOD').kind === 'declined');

// --- sourceKey ---------------------------------------------------------------
check('sourceKey uses RRN', ab.buildSourceKey({ rrn: '123', transIndexCode: '999' }) === 'AB-AUTOVISA-123');
check('sourceKey falls back to transIndexCode', ab.buildSourceKey({ rrn: '', transIndexCode: '999' }) === 'AB-AUTOVISA-999');
check('sourceKey never empty', /^AB-AUTOVISA-\d{12}$/.test(ab.buildSourceKey({})));

// --- failure wording ---------------------------------------------------------
check('outcomeUnknown is non-retryable', ab.describeFailure({ code: 'outcomeUnknown' }).retry === false);
check('SERVICE_DOWN retryable', ab.describeFailure({ code: 'SERVICE_DOWN' }).retry === true);
check('busy is warning', ab.describeFailure({ code: 'busy' }).sev === 'warning');
check('unknown code uses error text', ab.describeFailure({ code: 'zzz', error: 'boom' }).en === 'boom');
check('every failure has Arabic', ['outcomeUnknown', 'SERVICE_DOWN', 'terminalNotConnected', 'serialError', 'noComPort', 'portConflict', 'busy', 'clrError', 'other']
    .every((c) => /[\u0600-\u06FF]/.test(ab.describeFailure({ code: c }).ar)));

// =============================================================================
// Electron-side helpers (public/arabBankVisa.js)
// =============================================================================
const s = el.resolveSettings({ arabiVisaCom: ' com9 ', scaleCOM: 'COM1' });
check('settings normalise COM', s.comPort === 'COM9');
check('settings default baud 115200', s.baudRate === 115200);
check('settings default port 9700 url', s.serviceUrl === 'http://127.0.0.1:9700');
check('settings default timeout 90', s.timeoutSec === 90);
const s2 = el.resolveSettings({ arabiVisaServicePort: '9800', arabiVisaBaudRate: 9600, arabiVisaTimeoutSec: 5 });
check('settings honour overrides', s2.servicePort === 9800 && s2.baudRate === 9600, JSON.stringify([s2.servicePort, s2.baudRate]));
check('timeout clamped to minimum', s2.timeoutSec >= 30, s2.timeoutSec);
check('empty config → no comPort', el.resolveSettings({}).comPort === '');
check('null config safe', el.resolveSettings(null).servicePort === 9700);

const ports = [
    { path: 'COM1' },
    { path: 'COM3', manufacturer: 'Microsoft' },
    { path: 'COM9', vendorId: '067b', friendlyName: 'Prolific USB-to-Serial Comm Port (COM9)' },
    { path: 'COM12', manufacturer: 'Standard Serial over Bluetooth link' }
];
const cands = el.pickCandidatePorts(ports, { scaleCOM: 'COM1' }, null);
check('scale port excluded', !cands.some((c) => c.path === 'COM1'));
check('prolific first', cands[0].path === 'COM9', cands.map((c) => c.path + ':' + c.score).join(','));
check('bluetooth last', cands[cands.length - 1].path === 'COM12');
const cands2 = el.pickCandidatePorts(ports, { scaleCOM: 'COM1', arabiVisaCom: 'COM3' }, null);
check('configured port first', cands2[0].path === 'COM3');
check('BOP serial port reserved', !el.pickCandidatePorts(ports, {}, { bopVisaIp: 'COM3' }).some((c) => c.path === 'COM3'));
check('BOP IP not treated as COM', el.pickCandidatePorts(ports, {}, { bopVisaIp: '10.0.0.5' }).some((c) => c.path === 'COM3'));

check('conflict scale == visa', el.comPortConflicts({ scaleCOM: 'COM9', arabiVisaCom: 'com9' }, null).length === 1);
check('no conflict distinct', el.comPortConflicts({ scaleCOM: 'COM1', arabiVisaCom: 'COM9' }, null).length === 0);
check('conflict with BOP serial', el.comPortConflicts({ arabiVisaCom: 'COM9' }, { bopVisaIp: 'COM9' }).length === 1);

const settings = el.resolveSettings({ arabiVisaCom: 'COM9' });
const refused = el.classifySaleError({ code: 'ECONNREFUSED' }, settings);
check('ECONNREFUSED → 503 SERVICE_DOWN', refused.status === 503 && refused.body.code === 'SERVICE_DOWN');
const reset = el.classifySaleError({ code: 'ECONNRESET' }, settings);
check('ECONNRESET → 504 outcomeUnknown', reset.status === 504 && reset.body.code === 'outcomeUnknown');
const timeout = el.classifySaleError({ code: 'ECONNABORTED', message: 'timeout of 1ms exceeded' }, settings);
check('timeout → outcomeUnknown', timeout.status === 504 && timeout.body.outcomeUnknown === true);
const passthrough = el.classifySaleError({ response: { status: 502, data: { ok: false, code: 'terminalNotConnected', error: 'x' } } }, settings);
check('service error passes through', passthrough.status === 502 && passthrough.body.code === 'terminalNotConnected');
const html = el.classifySaleError({ response: { status: 500, data: '<html>oops</html>' } }, settings);
check('non-JSON service body → outcomeUnknown', html.status === 504 && html.body.code === 'outcomeUnknown');

check('sc.exe 1060 → not installed', el.parseScQuery('OpenService FAILED 1060', 1060).state === 'NOT_INSTALLED');
check('sc.exe RUNNING parsed', el.parseScQuery('STATE : 4  RUNNING', 0).state === 'RUNNING' && el.parseScQuery('STATE : 4  RUNNING', 0).installed === true);
check('sc.exe STOPPED parsed', el.parseScQuery('STATE : 1  STOPPED', 0).state === 'STOPPED');

check('describeInstallExit 0', /healthy/i.test(el.describeInstallExit(0)));
check('describeInstallExit 2 mentions port', /port/i.test(el.describeInstallExit(2)));
check('packageStatus on missing dir', el.packageStatus('C:/definitely/not/here').present === false);

// -----------------------------------------------------------------------------
console.log('\n' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILURE(S)'));
process.exit(failures === 0 ? 0 : 1);
