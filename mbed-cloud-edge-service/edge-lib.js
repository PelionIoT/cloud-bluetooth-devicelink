const fs = require('fs');
const MbedDevice = require('./device');
const EdgeRpc = require('./edge-rpc-client');

const CON_PR = '\x1b[34m[ClientService]\x1b[0m';

function RemoteClientService(host, port) {
    this.edgeRpc = new EdgeRpc(host, port);

    this.devices = [];
}

RemoteClientService.prototype.init = async function() {
    return this.edgeRpc.init();
};

RemoteClientService.prototype.deinit = async function() {
    return this.edgeRpc.deinit();
};

/**
 * List all devices registered in the bridge.
 * Returns an array of IDs.
 */
RemoteClientService.prototype.listDevices = async function() {
    return Promise.resolve(this.devices.map(d => d.id));
};

/**
 * Get all devices that are cached in the bridge and are registered with mbed Cloud
 */
RemoteClientService.prototype.getAllRegisteredDevices = function() {
    return this.devices.filter(d => d.getRegistrationStatus());
};

RemoteClientService.prototype.getEndpointForId = function(id) {
    let d = this.devices.find(d => d.id);
    if (!d) return null;

    return d.endpoint; // only returns something when registered though
};

/**
 * Gets the device from the bridge (or from cache if already loaded).
 * Returns an MbedDevice object.
 */
RemoteClientService.prototype.getDevice = async function(id, clientType) {
    let device = this.devices.filter(d => d.id === id)[0];

    if (!device) {
        return this.createCloudDevice(id, clientType);
    }
    return device;
};

RemoteClientService.prototype.createCloudDevice = async function(id, clientType) {
    let sshClient, rpcClient;

    const ID_PR = '[' + id + ']';

    try {
        let device = new MbedDevice(id, clientType, this.edgeRpc);

        this.devices.push(device);

        return device;
    }
    catch (ex) {
        // creating device failed...
        await this.deleteDevice(id);
        throw ex;
    }
};

RemoteClientService.prototype.deleteDevice = async function(id) {
    let device = this.devices.find(d => d.id === id);
    if (device) {
        await device.deregister();
    }

    let cacheIx = this.devices.findIndex(d => d.id === id);
    if (cacheIx > -1) {
        this.devices.splice(cacheIx, 1);
    }
};

module.exports = RemoteClientService;
