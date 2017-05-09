const EventEmitter = require('events');
const noble = require('noble');
const BLEDevice = require('./ble-device');
const CON_PREFIX = '\x1b[36m[BLE]\x1b[0m';

function BLE(devices, logSeenDevices) {
    EventEmitter.call(this);

    this.devices = devices;
    this.logSeenDevices = logSeenDevices;

    this.seen = {};
    this.bleDevices = {};

    noble.on('discover', this.onDiscover.bind(this));
}

BLE.prototype = Object.create(EventEmitter.prototype);

BLE.prototype.startScanning = function () {
    noble.on('stateChange', function (state) {
        if (state === 'poweredOn') {
            console.log(CON_PREFIX, 'Bluetooth stateChange, start scanning');
            noble.startScanning([], true);
        } else {
            noble.stopScanning();
        }
    });

    console.log(CON_PREFIX, 'Bluetooth state is', noble.state);
    if (noble.state === 'poweredOn') {
        noble.startScanning([], true);
    }
};

BLE.prototype.onDiscover = function (peripheral) {
    let devices = this.devices;
    let ad = peripheral.advertisement;
    let address = peripheral.address;

    // already connected? then ignore
    // @todo, add throttling for connection-failed
    if (devices[address] &&
        ['disconnected', 'connection-failed'].indexOf(devices[address].state) === -1) {
        return;
    }

    if (this.logSeenDevices) {
        if (ad.localName !== undefined || address !== 'unknown') {
            console.log(CON_PREFIX, 'Seen device', ad.localName, address);
        }
    }

    if (!peripheral.connectable) return;
    if (address === 'unknown') return;

    // update the 'seen' database (if the device is not in the devices database yet...)
    if (!devices[address]) {
        let s = this.seen[address] = {
            lastSeen: new Date(),
            name: ad.localName || address,
            eui: address,
            rssi: peripheral.rssi,
            services: ad.serviceUuids
        };
        this.emit('seen', s);
        return;
    }

    // Otherwise, the device is in the database already, so let's connect
    this.connect(devices[address], peripheral, ad.localName);
};

BLE.prototype.connect = function (device, peripheral, localName) {
    console.log(CON_PREFIX, 'Connecting to', localName, peripheral.address);

    // update the state of the device
    device.updateState('connecting');

    let bleDevice = device.bleDevice = new BLEDevice(peripheral, localName);

    bleDevice.on('state-change', (msg, ex) => device.updateState(msg, ex));
    bleDevice.on('model-change', model => {
        device.bleModelUpdated(model);
    });

    bleDevice.connect();

    this.bleDevices[peripheral.address] = bleDevice;
};

BLE.prototype.disconnectDevice = function (address) {
    if (this.bleDevices[address]) {
        this.bleDevices[address].disconnect();
    }
};

BLE.prototype.getLocalName = function (address) {
    return this.bleDevices[address] && this.bleDevices[address].localName;
};

BLE.prototype.getDevice = function (address) {
    return this.bleDevices[address];
};

module.exports = BLE;
