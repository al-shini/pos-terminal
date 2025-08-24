

let deviceId = null;
let serverIp = null;
let admin = null;
let scale = null;
let scaleAlphabet = null;
let autoUpdate = null;
let arabiVisaCom = null;
let systemCurrency = null;

let query = new URLSearchParams(global.location.search);

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
    systemCurrency = query.get("systemCurrency");
}

    const _visa = '3d757906-76ce-43eb-acbc-ef41e88b32261655196183639';


const config = {
    deviceId:  deviceId ? deviceId : 'test',
    serverIp:  serverIp ? serverIp : '127.0.0.1',
    admin: admin ? admin : false,
    scale: scale ? scale : false,
    scaleAlphabet: scaleAlphabet ? scaleAlphabet : false,
    autoUpdate: autoUpdate ? autoUpdate : false,
    visa: _visa,
    mobiCash: 'MobiCash',
    visaArabi: 'VISA_AB',
    jawwalPay: 'JawwalPay',
    voucher: 'Voucher',
    onAccount: 'OnAccount',
    cashBack: 'Cashback',
    employeeExtra: 'EmployeeExtra',
    cashDroEnabled: false,
    arabiVisaCom: arabiVisaCom ? arabiVisaCom : false,
    systemCurrency: systemCurrency ? systemCurrency : 'NIS'
}; 

console.log(config);

export default config;