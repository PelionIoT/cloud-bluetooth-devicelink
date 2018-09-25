const EventEmitter = require('events');
const fota = require('./firmware-updates');
const fs = require('fs');
const Path = require('path');
const CON_PREFIX = '\x1b[35m[BTDevicelink]\x1b[0m';

// !!! NOTE: this is all hard-coded now, needs to move to the device declaration !!!
const vendorId = 'fa6b4a53-d5ad-5fdf-be9d-e663e4d41ffe';
const classId = '316d1676-a93b-544c-9b7b-be43a3d5bfa9';
const updateCertificateBuffer = fs.readFileSync(Path.join(__dirname, '..', 'firmware', '.update-certificates', 'default.der'));

/**
 * Create a new BtDeviceLinkDevice
 * @param address The BLE address of the device
 * @param cloudDefinition Information required to bridge this device into Pelion Device Management
 * @param cloudDevice Instance of the object from mbed-client-service
 */
function BtDeviceLinkDevice(address, cloudDefinition, cloudDevice) {
    EventEmitter.call(this);

    // BLE address
    this.address = address;

    // Current BLE state
    this.state = 'disconnected';
    this.stateError = null;

    // model contains the model that is currently synced with mbed-client-service
    this.model = [];

    // cloudDefinition contains security certs and read/write mappings
    this.cloudDefinition = cloudDefinition;

    // cloudDevice is the device representation in mbed-client-service
    this.cloudDevice = cloudDevice;
    this.cloudDevice.on('put', this.onPut.bind(this));
    this.cloudDevice.on('fota', this.onFota.bind(this));

    this.modelUpdateInProgress = false;

    // bleModel contains the model that holds the BLE characteristics (and current value of chars)
    this.bleModel = {};

    // registered with Pelion Device Management
    this.registered = false;

    // check registration status
    (async function() {
        try {
            let status = await this.cloudDevice.getRegistrationStatus();
            console.log(CON_PREFIX, '[' + this.address + ']', 'Registration status is', status);

            // when we create this object and its registered, we want to deregister...
            if (status === true) {
                console.log(CON_PREFIX, '[' + this.address + ']', 'Deregistering');
                await this.cloudDevice.deregister();
                console.log(CON_PREFIX, '[' + this.address + ']', 'Deregistering OK');
            }
        }
        catch (ex) {
            console.log(CON_PREFIX, '[' + this.address + ']', 'Retrieving registration status failed', ex);
        }
    }).call(this);

    // deregister and register whenever the device comes online/offline
    this.on('statechange', ev => {
        switch (ev) {
            case 'connected':
                if (this.registered) return;

                console.log(CON_PREFIX, '[' + this.address + ']', 'Registering');
                this.cloudDevice.register(this.model, this.supportsUpdate, vendorId, classId, updateCertificateBuffer)
                    .then(() => {
                        this.registered = true;
                        this.registrationError = null;
                        this.emit('endpointchange', this.cloudDevice.endpoint);
                        console.log(CON_PREFIX, '[' + this.address + ']', 'Registered', this.cloudDevice.endpoint);
                    })
                    .catch((err) => {
                        this.registered = false;
                        this.registrationError = err;
                        this.emit('registrationfailed', err);
                        console.log(CON_PREFIX, '[' + this.address + ']', 'Registration failed', err);
                    });
                break;
            case 'disconnected':
                if (!this.registered) return;
                if (this.inFotaMode) return; // don't de-register during FOTA

                console.log(CON_PREFIX, '[' + this.address + ']', 'Deregistering');
                this.cloudDevice.deregister()
                    .then(() => console.log(CON_PREFIX, '[' + this.address + ']', 'Deregistered'))
                    .catch((err) => console.log(CON_PREFIX, '[' + this.address + ']', 'Deregistration failed', err))
                    .then(() => {
                        this.registered = false;
                        this.emit('endpointchange', this.cloudDevice.endpoint);
                    });
                break;
        }
    });
}

BtDeviceLinkDevice.prototype = Object.create(EventEmitter.prototype);

/**
 * Update the Bluetooth state of the device
 */
BtDeviceLinkDevice.prototype.updateState = function(state, error) {
    this.state = state;
    this.stateError = error;
    this.emit('statechange', state, error);
};

/**
 * Build a LwM2M model to be sent to Pelion, based on the r/w definition and the current model
 */
BtDeviceLinkDevice.prototype.generateLwm2mModel = function(model) {
    let definition = this.cloudDefinition;

    let readKeys = Object.keys(definition.read);
    let writeKeys = Object.keys(definition.write);
    let allKeys = readKeys.concat(writeKeys);

    model = this.createSimplifiedModel(model);

    allKeys = allKeys.filter((v, i, a) => a.indexOf(v) === i);

    return allKeys.map(k => {
        let op = [];
        if (readKeys.indexOf(k) > -1) op.push('GET');
        if (writeKeys.indexOf(k) > -1) op.push('PUT');

        let v = '';
        try {
            v = (readKeys.indexOf(k) > -1 ? definition.read[k](model) : '').toString();
        }
        catch (ex) { /* no-op in case the JS is not valid */ }

        if (!v && (this.cloudDevice.resources['/' + k])) {
            v = this.cloudDevice.resources['/' + k].value;
        }

        return {
            path: '/' + k,
            valueType: 'dynamic',
            operation: op,
            value: v,
            observable: (readKeys.indexOf(k) > -1 ? true : undefined)
        };
    });
};

BtDeviceLinkDevice.prototype.createSimplifiedModel = function(model) {
    let m = {};

    for (let service of Object.keys(model)) {
        m[service] = {};

        for (let char of Object.keys(model[service])) {
            m[service][char] = model[service][char].value;
        }
    }

    return m;
};

/**
 * Device model is updated over BLE
 */
BtDeviceLinkDevice.prototype.bleModelUpdated = function(model) {
    this.emit('ble-model-updated', model);

    // we need to compare curr and old, and see what changed...
    let curr = this.generateLwm2mModel(model);
    let old = this.model;

    this.bleModel = model;
    this.supportsUpdate = fota.supportsUpdate(model); // either a string or false
    this.emit('supports-update-change', this.supportsUpdate);

    (async function() {
        try {
            if (this.modelUpdateInProgress) {
                console.log(CON_PREFIX, '[' + this.address + ']', 'Model update came in for device that is already updating');
                return;
            }

            this.modelUpdateInProgress = true;

            // there are two checks that we need to do now...
            // 1. see if this.cloudDevice.resources has changed vs. curr. Because if so, we need to re-register...
            // 2. see if values have changed between old & curr, because if so, we need to update values...

            // 1. Compare the schemas
            function getSchema(model) {
                return JSON.stringify(model.map(rule => {
                    rule = Object.assign({}, rule);
                    delete rule.value;
                    delete rule.rpcType;
                    return rule;
                }));
            }

            let currSchema = getSchema(curr);
            let oldSchema = getSchema(Object.keys(this.cloudDevice.resources).map(r => this.cloudDevice.resources[r]));

            if (currSchema !== oldSchema && this.registered) {
                // Schema change!
                console.log(CON_PREFIX, '[' + this.address + ']', `Schema change to`, curr);

                console.log(CON_PREFIX, '[' + this.address + ']', 'Deregister');
                await this.cloudDevice.deregister();
                console.log(CON_PREFIX, '[' + this.address + ']', 'OK Deregister');

                console.log(CON_PREFIX, '[' + this.address + ']', 'Register');
                await this.cloudDevice.register(curr, this.supportsUpdate, vendorId, classId, updateCertificateBuffer);
                console.log(CON_PREFIX, '[' + this.address + ']', 'OK Register');

                this.modelUpdateInProgress = false;
                return;
            }

            // 2:
            for (let rule of curr) {
                let oldValue;

                let oldRule = old.find(r => r.path === rule.path);
                if (!oldRule && (this.cloudDevice.resources[rule.path])) {
                    oldValue = this.cloudDevice.resources[rule.path].value;
                }
                else if (oldRule) {
                    oldValue = oldRule.value;
                }

                if (rule.value !== oldValue && this.registered) {
                    console.log(CON_PREFIX, '[' + this.address + ']', `Update value for`, rule.path, 'to', rule.value);
                    await this.cloudDevice.resources[rule.path].setValue(rule.value);
                    console.log(CON_PREFIX, '[' + this.address + ']', `OK Update value for`, rule.path, 'to', rule.value);
                }
            }

            this.modelUpdateInProgress = false;
        }
        catch (ex) {
            console.log(CON_PREFIX, '[' + this.address + ']', `Model update failed`, ex);
            this.modelUpdateInProgress = false;
        }
        finally {
            this.model = curr;
        }

    }).call(this);
};

BtDeviceLinkDevice.prototype.onPut = function(path, value) {
    if (!this.cloudDefinition.write || !this.cloudDefinition.write[path.substr(1)]) {
        console.log(CON_PREFIX, '[' + this.address + ']', `Write for ${path} came in, but no 'write' rule`);
        return;
    }

    let self = this;

    console.log(CON_PREFIX, '[' + this.address + ']', `Write from Pelion for ${path}, value ${value}`);

    function write(path, aData) {
        if (!Array.isArray(aData)) aData = [ aData ];

        console.log(CON_PREFIX, '[' + self.address + ']', `Writing to BLE char ${path}, value`, '[ ' + aData.join(', ') + ' ]');
        var s = path.split('/');
        let service = s[0], char = s[1];

        if (self.bleModel[service] && self.bleModel[service][char]) {
            self.bleModel[service][char].char.write(Buffer.from(aData));
        }
        else {
            console.log(CON_PREFIX, '[' + self.address + ']', `Could not find characteristic for this ID`);
        }
    }

    this.cloudDefinition.write[path.substr(1)](value, write);
};

BtDeviceLinkDevice.prototype.onFota = async function(firmware) {
    if (!this.bleDevice) {
        console.log(CON_PREFIX, '[' + this.address + ']', `FOTA came in, but no bleDevice`);
        return;
    }

    try {
        this.inFotaMode = true;

        this.cloudDevice.setFotaUpdating();

        await fota.applyUpdate(this.supportsUpdate, this.bleDevice, firmware, progress => {
            this.emit('fota-progress', progress);
        });

        await this.cloudDevice.setFotaComplete();
        this.emit('fota-complete');
    }
    catch (ex) {
        this.emit('fota-error', ex);
        console.log(CON_PREFIX, '[' + this.address + ']', `FOTA failed`, ex);
        this.cloudDevice.setFotaError(ex);
    }
    finally {
        this.inFotaMode = false;

        // if we're still disconnected, then deregister from Cloud as well
        if (this.bleDevice.peripheral.state === 'disconnected') {
            this.emit('statechange', 'disconnected');
        }
    }
};

BtDeviceLinkDevice.prototype.localNameChanged = function(localName) {
    this.emit('localnamechange', localName);
};

module.exports = BtDeviceLinkDevice;
