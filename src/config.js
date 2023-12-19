

let deviceId = null;
let serverIp = null;
let admin = null;

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


const config = {
    deviceId:  deviceId ? deviceId : 'test',
    serverIp: serverIp ? serverIp : '127.0.0.1',
    admin: admin ? admin : false,
    visa: '3d757906-76ce-43eb-acbc-ef41e88b32261655196183639',
    jawwalPay: 'JawwalPay',
    voucher: 'Voucher',
    onAccount: 'OnAccount',
    cashBack: 'CashBack',
    employeeExtra: 'EmployeeExtra',
    cashDroEnabled: false
}; 

console.log(config);

export default config;