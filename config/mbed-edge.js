let fs = require('fs');
let Path = require('path');

let logSeenDevicesIx = process.argv.indexOf('--log-seen-devices');
let logSeenDevices = logSeenDevicesIx  > -1 ? process.argv[logSeenDevicesIx] : false;

let edgeUrlIx = process.argv.indexOf('--edge-url');
let edgeUrl;

if (edgeUrlIx === -1) {
    edgeUrl = 'ws+unix:///tmp/edge.sock';
} else {
    edgeUrl = process.argv[edgeUrlIx + 1];
}

let macOsFix = process.argv.indexOf('--mac-os-fix') > -1;

console.log('\x1b[35m[BTDevicelink]\x1b[0m', 'Starting...');

module.exports = {
    clientService: 'mbed-cloud-edge',
    cloudEdge: {
        url: edgeUrl,
        name: 'bluetooth_devicelink'
    },
    logSeenDevices: logSeenDevices,
    deviceFolder: Path.join(__dirname, '../devices'),
    macOsFix: macOsFix
};
