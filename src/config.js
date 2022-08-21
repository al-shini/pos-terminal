

let deviceId = null;
let serverIp = null;

let query = new URLSearchParams(global.location.search);

if (query.get("deviceId")) {
    deviceId = query.get("deviceId");
} 

if (query.get("serverIp")) {
    serverIp = query.get("serverIp");
} 

const config = {
    deviceId: deviceId ? deviceId : '11-1',
    serverIp: serverIp ? serverIp : '192.168.2.66',
    visa: '3d757906-76ce-43eb-acbc-ef41e88b32261655196183639',
    jawwalPay: 'JawwalPay',
    voucher: 'Voucher',
    onAccount: 'OnAccount',
};

console.log(config);

export default config;