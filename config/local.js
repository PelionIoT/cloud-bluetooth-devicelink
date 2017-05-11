let fs = require('fs');
let Path = require('path');

let clientServiceIx = process.argv.indexOf('--client-service');
let clientServiceUrl = clientServiceIx  > -1 ? process.argv[clientServiceIx + 1] : 'http://localhost:3030';

let logSeenDevicesIx = process.argv.indexOf('--log-seen-devices');
let logSeenDevices = logSeenDevicesIx  > -1 ? process.argv[logSeenDevicesIx + 1] : false;

console.log('\x1b[35m[BTDevicelink]\x1b[0m', 'Connecting to', clientServiceUrl, '(override via --client-service [url])');

module.exports = {
    clientServiceUrl: clientServiceUrl,
    logSeenDevices: logSeenDevices,
    deviceFolder: Path.join(__dirname, '../devices')
};
