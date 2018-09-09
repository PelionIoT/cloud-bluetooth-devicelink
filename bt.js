'use strict';

const CON_PREFIX = '\x1b[35m[BTDevicelink]\x1b[0m';

const Path = require('path');
const BLE = require('./ble-devicelink/ble');
const DeviceDb = require('./ble-devicelink/device-db');
const startWebserver = require('./webserver/webserver');
const config = require('./config/mbed-edge');
const CloudEdgeService = require('mbed-edge-js');

let clientService; // needs to be accessible from SIGINT

// During startup, first read the content of the /devices folder and see which devices are already there...
(async function startup() {
    try {
        clientService = new CloudEdgeService(config.cloudEdge.url, config.cloudEdge.name);
        await clientService.init();

        // add a device database
        let deviceDb = new DeviceDb(config.deviceFolder, clientService);

        // load devices from disk
        let devices = await deviceDb.loadAllDevices();

        // attach listeners to all devices
        Object.keys(devices).forEach(dk => {
            // fota hands control over to bleat. re-start scanning when done...
            devices[dk].on('fota-complete', () => ble.startScanning());
            devices[dk].on('fota-error', () => ble.startScanning());
        });

        console.log(CON_PREFIX, `Started... Loaded ${Object.keys(devices).length} devices`);

        // instantiate the BLE library
        let ble = new BLE(devices, config.logSeenDevices, config.macOsFix);
        ble.startScanning();

        // events from the db
        deviceDb.on('add', address => {
            if (devices[address]) {
                // fota hands control over to bleat. re-start scanning when done...
                devices[address].on('fota-complete', () => ble.startScanning());
                devices[address].on('fota-error', () => ble.startScanning());
                return;
            }

            deviceDb.loadDevice(address).then(device => {
                devices[address] = device;

                // fota hands control over to bleat. re-start scanning when done...
                device.on('fota-complete', () => ble.startScanning());
                device.on('fota-error', () => ble.startScanning());

            }).catch(err => console.error(CON_PREFIX, 'Error loading device', address, err));
        });
        deviceDb.on('change', (address, definition) => {
            let device = devices[address];

            device.cloudDefinition = definition;
            device.bleModelUpdated(device.bleModel);

            // if schema changed, the new schema is sent to mbed-client-service in `bleModelUpdated`...
        });
        deviceDb.on('remove', address => {
            if (!devices[address]) return;

            ble.disconnectDevice(address);

            clientService.deleteDevice(devices[address].cloudDevice.id);

            delete devices[address];
        });

        // Start the webserver
        startWebserver(devices, ble, deviceDb, clientService);

        // @todo: unregister devices when the process is killed
    }
    catch (ex) {
        console.error(CON_PREFIX, 'Startup failed', ex);
        process.exit(1);
    }
})();

// SIGINT handler
let firstSigint = true;
process.on('SIGINT', function () {
    if (!firstSigint) process.exit(1);
    firstSigint = false;

    console.log(CON_PREFIX, 'SIGINT received - unregistering devices');

    Promise.all(clientService.getAllRegisteredDevices().map(d => {
        return d.deregister();
    })).then(() => {
        console.log(CON_PREFIX, 'Unregistered devices, de-initializing clientService');
        if (!clientService.deinit) return Promise.resolve();

        return clientService.deinit();
    }).then(() => {
        console.log(CON_PREFIX, 'Cleanup complete');
        process.exit(1);
    }).catch(err => {
        console.log(CON_PREFIX, 'Cleanup failed', err);
        process.exit(1);
    });
});


