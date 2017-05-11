'use strict';

const CON_PREFIX = '\x1b[35m[BTDevicelink]\x1b[0m';

const Path = require('path');
const BLE = require('./ble-devicelink/./ble');
const ClientService = require('../mbed-client-service-library-js');
const DeviceDb = require('./ble-devicelink/device-db');
const startWebserver = require('./webserver/webserver');
const config = require(Path.join(__dirname, 'config', process.argv[2]));

// During startup, first read the content of the /devices folder and see which devices are already there...
(async function startup() {
    try {
        // mbed Client Service reference, and add a device database
        let clientService = new ClientService(config.clientServiceUrl);
        let deviceDb = new DeviceDb(config.deviceFolder, clientService);

        // load devices from disk
        let devices = await deviceDb.loadAllDevices();

        console.log(CON_PREFIX, `Started... Loaded ${Object.keys(devices).length} devices`);

        // instantiate the BLE library
        let ble = new BLE(devices, config.logSeenDevices);
        ble.startScanning();

        // events from the db
        deviceDb.on('add', address => {
            if (devices[address]) return;

            deviceDb.loadDevice(address).then(device => {
                devices[address] = device;
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


