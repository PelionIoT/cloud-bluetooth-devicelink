const NrfLegacyDfu = require('web-bluetooth-dfu').dfu;
const hex2bin = require('web-bluetooth-dfu').hex2bin;
const EventEmitter = require('events');

function getAddress(id) {
    return new Uint8Array(id.split(':').map(n => parseInt(n, 16)));
}

module.exports = {
    supportsUpdate: function(bleModel) {
        if ('000015301212efde1523785feabcd123' in bleModel) {
            return 'nrfLegacy';
        }

        return false;
    },

    applyUpdate: function(supportsUpdate, bleDevice, firmware, progressCallback) {
        switch (supportsUpdate) {
            case 'nrfLegacy':
                return this.applyUpdateNrfLegacy(bleDevice, firmware, progressCallback);
            default:
                return Promise.reject('Unsupported update target "' + supportsUpdate + '"');
        }
    },

    applyUpdateNrfLegacy: async function(bleDevice, firmware, progressCallback) {
        let log = console.log.bind(console, '\x1b[35m[DFUService]\x1b[0m');
        let ee = new EventEmitter();
        let dfu = new NrfLegacyDfu(ee);
        dfu.addLogger(log);

        function writeToControlCharAndWaitForDisconnect() {
            let controlChar;
            try {
                controlChar = bleDevice.model['000015301212efde1523785feabcd123']['000015311212efde1523785feabcd123'].char;
            }
            catch (ex) {}
            if (!controlChar) return Promise.reject('Could not find controlChar');

            return new Promise((resolve, reject) => {
                let disconnectTimeout = setTimeout(() => {
                    reject('Did not disconnect within 10 seconds after writing to controlChar');
                }, 10000);

                bleDevice.peripheral.once('disconnect', () => {
                    clearTimeout(disconnectTimeout);
                    resolve();
                });

                // and write to the control char
                controlChar.write(Buffer.from([ 1 /* START_DFU */, 4 /* APPLICATION */ ]));
            });
        }

        try {
            // bleDevice is our own device, so we should already have the control character...

            progressCallback('Switching to DFU mode');
            await writeToControlCharAndWaitForDisconnect();
            progressCallback('Switched to DFU mode, finding DFU target');

            let dfuDevice = await dfu.findDevice({ name: 'DfuTarg'});
            progressCallback('Found DFU target');

            if (getAddress(bleDevice.peripheral.address)[5] + 1 !== getAddress(dfuDevice.id)[5]) {
                throw 'Address mismatch. Expected last octet to be ' + (getAddress(bleDevice.peripheral.address)[5] + 1).toString(16) +
                    ', but was ' + getAddress(dfuDevice.id)[5];
            }

            let hex = firmware.toString();
            let buffer = hex2bin.convert(hex);

            ee.on('provision-progress', progress => {
                progressCallback('Progress: ' + (progress * 100 | 0) + '%');
            });

            progressCallback('Starting update');
            await dfu.provision(dfuDevice, buffer);
            progressCallback('Finished update, restarting device');

            return true;
        }
        catch (ex) {
            // cleanup?

            throw ex;
        }
    }
};
