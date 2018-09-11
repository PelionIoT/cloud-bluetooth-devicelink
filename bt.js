'use strict';

const CON_PREFIX = '\x1b[35m[BTDevicelink]\x1b[0m';

const Path = require('path');
const BLE = require('./ble-devicelink/ble');
const DeviceDb = require('./ble-devicelink/device-db');
const startWebserver = require('./webserver/webserver');
const config = require('./config/mbed-edge');
const CloudEdgeService = require('mbed-edge-js');
const promisify = require('es6-promisify');

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

        ble.on('seen', async function(device) {
            if (device.name.indexOf('arm') > -1) {
                console.log('seen', device);
            }
            if (device.name === 'arm-AutoV1' && device.eui !== 'unknown') {
                try {
                    console.log(CON_PREFIX, 'Auto-adding arm-AutoV1 device', device);

                    // add the device in Mbed Edge
                    let clientDevice = await clientService.createCloudDevice(device.eui, 'test');

                    console.log(CON_PREFIX, 'Created new device in Mbed Edge');

                    var file = JSON.stringify({
                        type: 'create-device',
                        deveui: device.eui,
                        security: {
                            mbed_endpoint_name: clientDevice.id
                        },
                        read: "PLACEHOLDER1",
                        write: {
                        }
                    }, null, 4);

                    file = file.replace('"PLACEHOLDER1"', `{
        // DEVICE_ACTIVED_CHARACTERISTIC_UUID
        "7141/0/3347": function(m) {
            return m['a002']['a003'][0];
        },
        // START_TEMP_CHARACTERISTIC_UUID
        "7141/0/3303": function(m) {
            var tempArray = m['a002']['a004']
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        },
        // TIME_TO_MINIMA_CHARACTERISTIC_UUID
        "7141/0/3350": function(m) {
            var t = m['a002']['a005']
            return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
        },
        // MINI_TEMP_CHARACTERISTIC_UUID
        "7141/0/3320": function(m) {
            var tempArray = m['a002']['a006']
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        },
        // MAX_STORAGE_TEMP_CHARACTERISTIC_UUID
        "7141/1/3303": function(m) {
            var tempArray = m['a002']['a007']
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        },
        // TIME_ABOVE_SAFE_TEMP_CHARACTERISTIC_UUID
        "7141/0/6006": function(m) {
            var t = m['a002']['a008']
            return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
        },
        // TEMP_AT_RECOVERY_CHARACTERISTIC_UUID
        "7141/1/3320": function(m) {
            var tempArray = m['a002']['a009']
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        },
        // MINUTES_SINCE_INJECTION_CHARACTERISTIC_UUID
        "7141/1/6006": function(m) {
            var t = m['a002']['a00a']
            return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
        }
    }\n`);

                    file = 'module.exports = ' + file + ';';

                    await deviceDb.saveNewDevice(device.eui, file);
                }
                catch (ex) {
                    console.error(CON_PREFIX, 'Auto-adding device failed', ex);
                }
            }
        });

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


