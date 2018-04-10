let fs = require('fs');
let Path = require('path');

let logSeenDevicesIx = process.argv.indexOf('--log-seen-devices');
let logSeenDevices = logSeenDevicesIx  > -1 ? process.argv[logSeenDevicesIx] : false;

let rpcHostIx = process.argv.indexOf('--rpc-host');
let rpcUsernameIx = process.argv.indexOf('--rpc-username');
let rpcPrivateKeyIx = process.argv.indexOf('--rpc-private-key');
let rpcBinaryIx = process.argv.indexOf('--rpc-binary');

if (rpcHostIx === -1) throw '--rpc-host is required';
if (rpcUsernameIx === -1) throw '--rpc-username is required';
if (rpcPrivateKeyIx === -1) throw '--rpc-private-key is required';
if (rpcBinaryIx === -1) throw '--rpc-binary is required';

let rpcHost = process.argv[rpcHostIx + 1];
let rpcUsername = process.argv[rpcUsernameIx + 1];
let rpcPrivateKey = process.argv[rpcPrivateKeyIx + 1];
let rpcBinary = process.argv[rpcBinaryIx + 1];

let macOsFix = process.argv.indexOf('--mac-os-fix') > -1;

console.log('\x1b[35m[BTDevicelink]\x1b[0m', 'Starting...');

module.exports = {
    clientService: 'ssh-remote',
    remoteClientService: {
        host: rpcHost,
        username: rpcUsername,
        privateKey: fs.readFileSync(rpcPrivateKey),
        binary: rpcBinary
    },
    logSeenDevices: logSeenDevices,
    deviceFolder: Path.join(__dirname, '../devices'),
    macOsFix: macOsFix
};
