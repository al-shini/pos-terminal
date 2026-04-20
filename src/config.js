

let deviceId = null;
let serverIp = null;
let admin = null;
let scale = null;
let scaleAlphabet = null;
let autoUpdate = null;
let arabiVisaCom = null;
let systemCurrency = null;

// Collect query params from BOTH the normal search string AND the hash
// fragment. The customer display window is opened with a HashRouter URL
// like "…/index.html#/customer?serverIp=…&deviceId=…", which means the
// "?" ends up inside the hash and `location.search` is empty. Without this,
// the customer window falls back to serverIp=127.0.0.1 and can't talk to
// the backend (all other state reaches it via redux-state-sync, which is
// why only HTTP-backed features — the images/news carousel — were broken).
const searchParams = new URLSearchParams(global.location.search);
const hash = global.location.hash || '';
const hashQueryIndex = hash.indexOf('?');
const hashParams = hashQueryIndex >= 0
    ? new URLSearchParams(hash.substring(hashQueryIndex + 1))
    : new URLSearchParams();

const query = {
    get: (key) => searchParams.get(key) || hashParams.get(key)
};

if (query.get("deviceId")) {
    deviceId = query.get("deviceId");
}

if (query.get("serverIp")) {
    serverIp = query.get("serverIp");
}

if (query.get("admin")) {
    admin = query.get("admin");
}

if (query.get("scale")) {
    scale = query.get("scale");
}

if (query.get("scaleAlphabet")) {
    scaleAlphabet = query.get("scaleAlphabet");
}

if (query.get("autoUpdate")) {
    autoUpdate = query.get("autoUpdate");
}

if (query.get("arabiVisaCom")) {
    arabiVisaCom = query.get("arabiVisaCom");
}

if (query.get("systemCurrency")) {
    systemCurrency = 'JOD';//query.get("systemCurrency");
}

    // const _visa = '3d757906-76ce-43eb-acbc-ef41e88b32261655196183639';
    const _visa = 'Visa';


const config = {
    deviceId:  deviceId ? deviceId : 'test',
    serverIp:  serverIp ? serverIp : '127.0.0.1',
    admin: admin ? admin : false,
    scale: scale ? scale : false,
    scaleAlphabet: scaleAlphabet ? scaleAlphabet : false,
    autoUpdate: autoUpdate ? autoUpdate : false,
    visa: _visa,
    mobiCash: 'MobiCash',
    talabat: 'Talabat',
    wfp: 'WFP',
    visaArabi: 'VISA_AB',
    jawwalPay: 'JawwalPay',
    voucher: 'Voucher',
    onAccount: 'OnAccount',
    cashBack: 'Cashback',
    employeeExtra: 'EmployeeExtra',
    cashDroEnabled: true,
    arabiVisaCom: arabiVisaCom ? arabiVisaCom : false,
    systemCurrency: systemCurrency ? systemCurrency : 'JOD'
}; 

console.log(config);

export default config;