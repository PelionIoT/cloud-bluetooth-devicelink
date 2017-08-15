let fs = require('fs');
let Path = require('path');

let logSeenDevicesIx = process.argv.indexOf('--log-seen-devices');
let logSeenDevices = logSeenDevicesIx  > -1 ? process.argv[logSeenDevicesIx] : false;

let edgeHostIx = process.argv.indexOf('--edge-host');
let edgePortIx = process.argv.indexOf('--edge-port');

if (edgeHostIx === -1) throw '--edge-host is required';
if (edgePortIx === -1) throw '--edge-port is required';

let edgeHost = process.argv[edgeHostIx + 1];
let edgePort = process.argv[edgePortIx + 1];

let macOsFix = process.argv.indexOf('--mac-os-fix') > -1;

console.log('\x1b[35m[BTDevicelink]\x1b[0m', 'Starting...');

module.exports = {
    clientService: 'mbed-cloud-edge',
    cloudEdge: {
        host: edgeHost,
        port: edgePort
    },
    logSeenDevices: logSeenDevices,
    deviceFolder: Path.join(__dirname, '../devices'),
    macOsFix: macOsFix
};
