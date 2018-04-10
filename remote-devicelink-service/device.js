const EventEmitter = require('events');
const url = require('url');
const RPCClient = require('./rpc-client');
const SSHClient = require('./ssh-client');
const manifestParser = require('../ble-devicelink/manifest-parser');
const fs = require('fs');

const CON_PR = '\x1b[34m[ClientService]\x1b[0m';

const ARM_UC_MONITOR_STATE_NONE              = 0;
const ARM_UC_MONITOR_STATE_DOWNLOADING       = 1;
const ARM_UC_MONITOR_STATE_DOWNLOADED        = 2;
const ARM_UC_MONITOR_STATE_UPDATING          = 3;

const ARM_UC_MONITOR_RESULT_NONE             = 0;
const ARM_UC_MONITOR_RESULT_SUCCESS          = 1;
const ARM_UC_MONITOR_RESULT_ERROR_STORAGE    = 2;
const ARM_UC_MONITOR_RESULT_ERROR_MEMORY     = 3;
const ARM_UC_MONITOR_RESULT_ERROR_CONNECTION = 4;
const ARM_UC_MONITOR_RESULT_ERROR_CRC        = 5;
const ARM_UC_MONITOR_RESULT_ERROR_TYPE       = 6;
const ARM_UC_MONITOR_RESULT_ERROR_URI        = 7;
const ARM_UC_MONITOR_RESULT_ERROR_UPDATE     = 8;

function MbedDevice(id, clientType, rpcHost, rpcUsername, rpcPrivateKey, rpcBinary, rpcClientPort) {
    // inherit from eventemitter
    EventEmitter.call(this);

    // immutable properties
    Object.defineProperty(this, 'id', { get: () => id });

    this.clientType = clientType;
    this.endpoint = '';

    this.rpcHost = rpcHost;
    this.rpcUsername = rpcUsername;
    this.rpcPrivateKey = rpcPrivateKey;
    this.rpcBinary = rpcBinary;
    this.rpcClientPort = rpcClientPort;

    this.ID_PR = '[' + this.id + ']';

    this.$setResources([]); // resources are set in register() call
}

MbedDevice.prototype = Object.create(EventEmitter.prototype);

MbedDevice.prototype.$setResources = function(resources) {
    let self = this;

    // resources is an object with path as keys
    this.resources = resources.reduce((curr, res) => {
        curr[res.path] = res;

        // writeable resource? add a setValue call
        if (res.operation.indexOf('GET') > -1) {
            curr[res.path].setValue = function(v) {
                return self.setValue(res.path, v);
            }
        }

        return curr;
    }, {});
};

MbedDevice.prototype.setValue = async function(path, value) {
    try {
        if (this.rpcClient && this.rpcClient.is_open) {
            await this.rpcClient._setValue(path, value);
        }

        // update value when request succeeded
        this.resources[path].value = value;

        return value;
    }
    catch (ex) {
        // don't update the value
        throw ex;
    }
};

MbedDevice.prototype.deregister = async function() {
    const ID_PR = this.ID_PR;

    if (this.rpcClient && this.rpcClient.is_open) {
        console.log(CON_PR, ID_PR, 'Deregistering');
        try {
            await this.rpcClient.unregister();
        }
        catch (ex) {
            console.log(CON_PR, ID_PR, 'Deregistering failed', ex);
        }
        this.rpcClient.terminate();
    }

    try {
        console.log(CON_PR, ID_PR, 'Terminating SSH Client');
        this.sshClient && this.sshClient.close();
    }
    catch (ex) {}

    this.endpoint = '';
};

MbedDevice.prototype.registerUpdateResources = async function() {
    const ID_PR = this.ID_PR;

    let rpc = this.rpcClient;

    // update resources
    await rpc.createFunction('5/0/1', url => {
        console.log(CON_PR, ID_PR, '5/0/1 Package URL call', url);
    });

    await rpc.createFunction('5/0/2', () => {
        console.log(CON_PR, ID_PR, '5/0/2 Execute firmware update call');
    });

    let fwState = this.fwState = await rpc.createResourceInt('5/0/3', ARM_UC_MONITOR_STATE_NONE, RPCClient.GET_ALLOWED, true);
    let fwResult = this.fwResult = await rpc.createResourceInt('5/0/5', ARM_UC_MONITOR_RESULT_NONE, RPCClient.GET_ALLOWED, true);
    let fwName = this.fwName = await rpc.createResourceString('5/0/6', '', RPCClient.GET_ALLOWED, true); // sha256 hash of the fw
    let fwVersion = this.fwVersion = await rpc.createResourceString('5/0/7', '', RPCClient.GET_ALLOWED, true); // timestamp from manifest

    await rpc.createFunction('5/0/0', async function (package) {
        try {
            console.log(CON_PR, ID_PR, '5/0/0 Firmware manifest was received');

            // reset the state of the resources
            await fwState.setValue(ARM_UC_MONITOR_STATE_NONE);
            await fwResult.setValue(ARM_UC_MONITOR_RESULT_NONE);
            await fwName.setValue('');
            await fwVersion.setValue('');

            // parse and verify manifest
            let manifest;
            try {
                // @todo: these should move to the defintion file...
                manifest = this.manifest = await manifestParser.parseAndVerifyManifest(
                    'fa6b4a53-d5ad-5fdf-be9d-e663e4d41ffe', // vendor ID
                    '316d1676-a93b-544c-9b7b-be43a3d5bfa9', // class ID
                    fs.readFileSync('/Users/janjon01/repos/simple-cloud-client-example/.update-certificates/default.der'), // cert
                    package
                );
            }
            catch (ex) {
                await fwState.setValue(ARM_UC_MONITOR_STATE_NONE);
                await fwResult.setValue(ARM_UC_MONITOR_RESULT_ERROR_UPDATE);
                throw ex;
            }
            console.log(CON_PR, ID_PR, 'manifest', manifest);

            await fwState.setValue(ARM_UC_MONITOR_STATE_DOWNLOADING);
            console.log(CON_PR, ID_PR, 'State is now', 'ARM_UC_MONITOR_STATE_DOWNLOADING');

            // download the firmware
            let firmware;
            try {
                firmware = await manifestParser.downloadAndVerifyFirmware(manifest);
            }
            catch (ex) {
                await fwState.setValue(ARM_UC_MONITOR_STATE_NONE);
                await fwResult.setValue(ARM_UC_MONITOR_RESULT_ERROR_URI);
                throw ex;
            }
            console.log(CON_PR, ID_PR, 'Firmware size is', firmware.length, 'bytes');

            await fwState.setValue(ARM_UC_MONITOR_STATE_DOWNLOADED);
            console.log(CON_PR, ID_PR, 'State is now', 'ARM_UC_MONITOR_STATE_DOWNLOADED');

            this.emit('fota', firmware /* buffer */);
        }
        catch (ex) {
            console.error('Downloading firmware failed...', ex);
        }
    }.bind(this));
};

MbedDevice.prototype.setFotaUpdating = async function () {
    await this.fwState.setValue(ARM_UC_MONITOR_STATE_UPDATING);

    console.log(CON_PR, this.ID_PR, 'Result is now', ARM_UC_MONITOR_STATE_UPDATING);
};

MbedDevice.prototype.setFotaError = async function (error) {
    await this.fwState.setValue(ARM_UC_MONITOR_STATE_NONE);
    await this.fwResult.setValue(ARM_UC_MONITOR_RESULT_ERROR_UPDATE);

    console.log(CON_PR, this.ID_PR, 'Result is now', ARM_UC_MONITOR_RESULT_ERROR_UPDATE);
};

MbedDevice.prototype.setFotaComplete = async function () {
    await this.fwResult.setValue(ARM_UC_MONITOR_RESULT_SUCCESS);
    console.log(CON_PR, this.ID_PR, 'Result is now', 'ARM_UC_MONITOR_RESULT_SUCCESS');

    await this.fwName.setValue(this.manifest.payload.reference.hash);
    await this.fwVersion.setValue(this.manifest.timestamp.toString());
    console.log(CON_PR, this.ID_PR, 'Set fwName and fwVersion');

    await this.fwState.setValue(ARM_UC_MONITOR_STATE_NONE);
    console.log(CON_PR, this.ID_PR, 'State is now', 'ARM_UC_MONITOR_STATE_NONE');
};

MbedDevice.prototype.register = async function(lwm2m, supportsUpdate) {

    let ssh, rpc;

    const ID_PR = this.ID_PR;

    try {
        // set resource model
        this.$setResources(lwm2m);

        console.log(CON_PR, ID_PR, 'Registering with model', lwm2m, 'supporting update', supportsUpdate);

        // first create a new device...
        let ssh = this.sshClient = await SSHClient.spawn(this.rpcHost,
                                                         this.rpcUsername,
                                                         this.rpcPrivateKey,
                                                         this.rpcBinary,
                                                         this.rpcClientPort,
                                                         this.id);

        console.log(CON_PR, ID_PR, 'Spawned SSH Client');

        // then start an RPC channel
        let rpc = this.rpcClient = new RPCClient(this.rpcHost, ssh.port);
        await rpc.open();

        console.log(CON_PR, ID_PR, 'Opened RPC Channel');

        rpc.on('resource-updated', (route, newValue) => {
            console.log('resource updated', route, newValue);
            this.emit('put', '/' + route, newValue);
        });

        rpc.on('resource-executed', (route, data) => {
            this.emit('post', '/' + route, data);
        });

        /*
            { path: '/example/0/rule', value: 'Hello world', valueType: 'dynamic', operation: ['GET', 'PUT'], observable: true }
        */
        let actions = lwm2m.map(l => {
            let path = l.path.replace(/^\//, '');

            if (l.operation.indexOf('POST') > -1) {
                return rpc.createFunction(path);
            }

            let type;
            if (typeof l.value === 'string' || isNaN(l.value)) {
                type = 'String';
            }
            else {
                if (l.value % 1 === 0) {
                    type = 'Int';
                }
                else {
                    type = 'Float';
                }
            }

            // add this info for the device as well
            l.rpcType = type;

            let isGet = l.operation.indexOf('GET') > -1;
            let isPut = l.operation.indexOf('PUT') > -1;
            let opr = RPCClient.NOT_ALLOWED;
            if (isGet && isPut) {
                opr = RPCClient.GET_PUT_ALLOWED;
            }
            else if (isGet) {
                opr = RPCClient.GET_ALLOWED;
            }
            else if (isPut) {
                opr = RPCClient.PUT_ALLOWED;
            }

            return rpc['createResource' + type](path, l.value, opr, l.observable);
        });

        console.log(CON_PR, ID_PR, 'Setting resources');
        await Promise.all(actions);
        if (supportsUpdate) {
            await this.registerUpdateResources();
        }
        console.log(CON_PR, ID_PR, 'Setting resources OK');

        console.log(CON_PR, this.ID_PR, 'Registering');
        this.endpoint = await rpc.register();
        console.log(CON_PR, this.ID_PR, 'Registered with endpoint', this.endpoint);
    }
    catch (ex) {
        console.error(CON_PR, ID_PR, 'Registering device failed', ex);

        if (rpc && rpc.is_open) {
            try {
                await rpc.unregister();
                console.log(CON_PR, ID_PR, 'Unregistered');
            }
            catch (ex) { console.log(CON_PR, ID_PR, 'Unregister failed', ex); }
            rpc.terminate();
            console.log(CON_PR, ID_PR, 'Terminated');
        }
        if (ssh) {
            try {
                ssh.close();
                console.log(CON_PR, ID_PR, 'SSH Client closed');
            }
            catch(ex) {}
        }

        delete this.rpcClient;
        delete this.sshClient;

        throw 'Registration failed ' + ex;
    }

    return this.endpoint;
};

MbedDevice.prototype.getRegistrationStatus = function() {
    if (this.rpcClient && this.rpcClient.is_registered) {
        return true;
    }
    return false;
};

module.exports = MbedDevice;
