'use strict';

const CON_PREFIX = '\x1b[35m[BTDevicelink]\x1b[0m';

const BLE = require('./ble');
const ClientService = require('../mbed-client-service-library-js');
const DeviceDb = require('./device-db');
const startWebserver = require('./webserver/webserver');

// During startup, first read the content of the /devices folder and see which devices are already there...
(async function startup() {
    try {
        // mbed Client Service reference, and add a device database
        let clientService = new ClientService('http://apm-lora-eu2.cloudapp.net:3030');
        let deviceDb = new DeviceDb(clientService);

        // load devices from disk
        let devices = await deviceDb.loadAllDevices();

        console.log(CON_PREFIX, `Started... Loaded ${Object.keys(devices).length} devices`);

        // instantiate the BLE library
        let ble = new BLE(devices, false);
        ble.startScanning();

        // events from the db
        deviceDb.on('add', device => {
            if (devices[device.address]) return;

            devices[device.address] = device;

            // @todo: register in mbed Cloud
        });
        deviceDb.on('change', (address, definition) => {
            let device = devices[address];

            device.cloudDefinition = definition;
            device.bleModelUpdated(device.lastReceivedBleModel);
        });
        deviceDb.on('remove', address => {
            ble.disconnectDevice(address);

            // @todo: also deregister in mbed Cloud...

            delete devices[address];
        });

        // Start the webserver
        startWebserver(devices, ble, deviceDb, clientService);
    }
    catch (ex) {
        console.error(CON_PREFIX, 'Startup failed', ex);
        process.exit(1);
    }
})();


