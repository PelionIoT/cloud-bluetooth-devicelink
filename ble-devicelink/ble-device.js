const EventEmitter = require('events');
const promisify = require('es6-promisify');

function BLEDevice(peripheral, localName) {
    EventEmitter.call(this);

    this.peripheral = peripheral;
    this.localName = localName;
    this.model = {};
}

BLEDevice.prototype = Object.create(EventEmitter.prototype);

BLEDevice.prototype.connect = function() {
    // attach a disconnect handler
    this.onDisconnectCallback = this.onDisconnect.bind(this);
    this.peripheral.on('disconnect', this.onDisconnectCallback);

    let p = this.peripheral;
    let log = this.log.bind(this);
    let model = this.model = {};
    let self = this;

    (async function connect() {
        try {
            log('Connecting');

            self.emit('state-change', 'connecting');

            await promisify(p.connect.bind(p))();
            log('Connected, discovering services');

            self.emit('state-change', 'discovering-services');

            let services = await promisify(p.discoverServices.bind(p))([]);
            log(`Discovered ${services.length} services, reading characteristics`);

            for (let service of services) {
                log('Reading characteristics for ' + service.uuid);

                self.emit('state-change', 'discovering-characteristics');

                model[service.uuid] = {};

                let chars;
                try {
                    chars = await promisify(service.discoverCharacteristics.bind(service))([]);
                }
                catch (ex) {
                    log('Discovering characteristics for ' + service.uuid + ' failed', ex);
                    continue;
                }

                for (let char of chars) {
                    self.emit('state-change', 'reading-characteristics');

                    model[service.uuid][char.uuid] = {
                        char: char,
                        value: null
                    };

                    if (char.properties.indexOf('read') > -1) {
                        log('Reading', service.uuid, char.uuid);
                        model[service.uuid][char.uuid].value = await promisify(char.read.bind(char))();
                        log('OK Read', service.uuid, char.uuid, model[service.uuid][char.uuid].value);
                    }

                    if (char.properties.indexOf('notify') > -1) {
                        log('Subscribing', service.uuid, char.uuid);

                        // @todo: unsubscribe on disconnect!
                        char.on('read', v => {
                            model[service.uuid][char.uuid].value = v;
                            self.emit('model-change', model);
                        });

                        await promisify(char.notify.bind(char))(true);
                        log('OK Subscribing', service.uuid, char.uuid);
                    }
                }
            }

            log('Connected');

            self.emit('model-change', model);
            self.emit('state-change', 'connected');
        }
        catch (ex) {
            self.emit('state-change', 'connection-failed', ex);
            log('Failed to connect...', ex);

            p.removeListener('disconnect', self.onDisconnectCallback);
            p.disconnect();
        }

    })();
};

BLEDevice.prototype.log = function(msg) {
    let arg = [].slice.call(arguments, 1);
    msg = `\x1b[36m[BLE]\x1b[0m [${this.peripheral.address}] ${msg}`;
    arg = [msg].concat(arg);
    console.log.apply(console, arg);
};

BLEDevice.prototype.onDisconnect = function() {
    this.log('Disconnected');

    this.peripheral.removeListener('disconnect', this.onDisconnectCallback);

    this.emit('state-change', 'disconnected');
};

BLEDevice.prototype.disconnect = function() {
    this.peripheral.disconnect();
};

module.exports = BLEDevice;
