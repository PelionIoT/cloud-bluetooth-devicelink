const CON_PREFIX = '\x1b[32m[DeviceDB]\x1b[0m';

const EventEmitter = require('events');
const BtDevicelinkDevice = require('./bt-devicelink-device');
const vm = require('vm');
const Path = require('path');
const fs = require('fs');
const promisify = require('es6-promisify');
const chokidar = require('chokidar');
const verify = require('./verify-device');

function DeviceDb(folder, clientService) {
    EventEmitter.call(this);

    this.folder = folder;
    this.clientService = clientService;

    let watcher = this.watcher = chokidar.watch(Path.join(this.folder), {
        recursive: false,
        ignoreInitial: true,
    });

    watcher
        .on('add', path => {
            if (!this.isAddressPath(path)) return;

            console.log(CON_PREFIX, 'Add', path);

            this.emit('add', this.getAddressFromPath(path));
        })
        .on('change', path => {
            if (!this.isAddressPath(path)) return;

            console.log(CON_PREFIX, 'Change', path);

            (async function() {
                let definition = await this.loadDeviceDefinitionFile(path);

                this.emit('change', this.getAddressFromPath(path), definition)
            }).call(this);

        })
        .on('unlink', path => {
            if (!this.isAddressPath(path)) return;

            console.log(CON_PREFIX, 'Remove', path);

            this.emit('remove', this.getAddressFromPath(path));
        })
      .on('error', err => console.error('watch err', err));
}

DeviceDb.prototype = Object.create(EventEmitter.prototype);

DeviceDb.prototype.getAddressFromPath = function (path) {
    return Path.basename(path, '.js');
};

DeviceDb.prototype.isAddressPath = function (path) {
    return /\.js$/.test(path);
};

DeviceDb.prototype.loadDeviceDefinitionFile = async function (address) {
    if (/\.js$/.test(address)) address = this.getAddressFromPath(address);

    let definition = await promisify(fs.readFile.bind(fs))(Path.join(this.folder, address + '.js'), 'utf-8');

    let sandbox = { module: {} };
    let context = new vm.createContext(sandbox);
    let script = new vm.Script(definition);
    script.runInContext(context);

    try {
        verify(context.module.exports);
    }
    catch (err) {
        context.module.exports.error = err;
    }

    return context.module.exports;
};

DeviceDb.prototype.loadDevice = async function (address) {
    let definition = await this.loadDeviceDefinitionFile(address);
    let cloudDevice = await this.clientService.getDevice(definition.security.mbed_endpoint_name);

    return new BtDevicelinkDevice(address, definition, cloudDevice);
};

DeviceDb.prototype.loadAllDevices = async function() {
    let devices = await Promise.all(fs.readdirSync(Path.join(this.folder))
        .filter(f => /\.js$/.test(f))
        .map(f => Path.basename(f, '.js'))
        .map(f => this.loadDevice(f)));

    return devices.reduce((curr, d) => {
        curr[d.address] = d;
        return curr;
    }, {});
};

DeviceDb.prototype.saveNewDevice = async function(address, data) {
    // @todo: this stuff can potentially trigger a race condition when the filesystem trigger goes off before device creation succeeded...
    await promisify(fs.writeFile.bind(fs))(Path.join(this.folder, address + '.js'), data, 'utf-8');

    this.emit('add', address);
};

DeviceDb.prototype.saveDevice = async function(address, data) {
    await promisify(fs.writeFile.bind(fs))(Path.join(this.folder, address + '.js'), data, 'utf-8');

    let definition = await this.loadDeviceDefinitionFile(address);
    this.emit('change', address, definition);
};

DeviceDb.prototype.deleteDevice = async function(address) {
    // @todo: similar as above, potential race condition material...
    await promisify(fs.unlink.bind(fs))(Path.join(this.folder, address + '.js'));

    // trigger straight away, don't wait for the filesystem event to come through
    this.emit('remove', address);
};

module.exports = DeviceDb;
