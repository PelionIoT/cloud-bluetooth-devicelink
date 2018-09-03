let fs = require('fs');
let Path = require('path');

let logSeenDevicesIx = process.argv.indexOf('--log-seen-devices');
let logSeenDevices = logSeenDevicesIx  > -1 ? process.argv[logSeenDevicesIx] : false;

let edgeSocketIx = process.argv.indexOf('--edge-socket');
let edgeSocket;

if (edgeSocketIx === -1) {
    edgeSocket = '/tmp/edge.sock';
} else {
    edgeSocket = process.argv[edgeSocketIx + 1];
}

let macOsFix = process.argv.indexOf('--mac-os-fix') > -1;

console.log('\x1b[35m[BTDevicelink]\x1b[0m', 'Starting...');

module.exports = {
    clientService: 'mbed-cloud-edge',
    cloudEdge: {
        socket: edgeSocket,
        name: 'bluetooth_devicelink'
    },
    logSeenDevices: logSeenDevices,
    deviceFolder: Path.join(__dirname, '../devices'),
    macOsFix: macOsFix
};
