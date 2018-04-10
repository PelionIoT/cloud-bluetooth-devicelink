const rpc = require('msgpack-rpc');
const promisify = require('es6-promisify');
const EventEmitter = require('events');

/**
 * RPCClient for mbed Cloud Devicelink Server
 * @param {*} host Hostname of the RPC Host
 * @param {*} port Port of the RPC Host
 */
function RPCClient(host, port) {
    EventEmitter.call(this);

    this.host = host;
    this.port = port;
    this.is_open = false;
    this.routes = {};

    this.is_registered = false;

    this._getQueueIv = setInterval(this._getQueue.bind(this), 200);
}

RPCClient.prototype = Object.create(EventEmitter.prototype);

/**
 * Open the RPC Channel
 * @return Returns a promise
 */
RPCClient.prototype.open = function() {
    return new Promise((res, rej) => {
        // @todo, handle disconnects as well...
        this.rpcClient = rpc.createClient(this.port, this.host, (err) => {
            if (err) return rej(err);

            this.is_open = true;

            res();
        });
    });
};

RPCClient.prototype.invoke = function() {
    return promisify(this.rpcClient.invoke.bind(this.rpcClient)).apply(this.rpcClient, arguments);
};

RPCClient.prototype._setValue = function(route, newValue) {
    if (route.indexOf('/') === 0) route = route.substr(1); // should be fixed higher up but f&@ it

    if (!this.is_open) return Promise.reject('RPC Channel is closed');
    if (!this.routes[route]) return Promise.reject(`Unknown route '${route}'`);

    let r = this.routes[route];
    if (r.type === 'function') return Promise.reject('Route type is function, cannot set value');

    r.value = newValue;

    return this.invoke('set-resource-' + r.type, route, newValue);
};

RPCClient.prototype._getQueue = function() {
    if (!this.is_open) return;

    this.rpcClient.invoke('get-queue', (err, res) => {
        if (err) return console.error('[RPCClient] get-queue call failed', err);

        for (let msg of res) {
            try {
                msg = JSON.parse(msg);
            }
            catch (ex) { console.error('[RPCClient] msg was not JSON...', msg); continue; }

            if (msg.type === 'connector-state') {
                this.is_registered = msg.state === 'registered';

                this.emit('connector-state', msg.state, msg.endpoint);
            }
            else if (msg.type === 'resource-updated') {
                this.routes[msg.route].value = msg.value;
                if (this.routes[msg.route] && this.routes[msg.route].callback) {
                    this.routes[msg.route].callback(msg.value);
                }
                this.emit('resource-updated', msg.route, msg.value);
            }
            else if (msg.type === 'resource-executed') {
                let data = new Buffer(msg.data, 'base64');
                if (this.routes[msg.route] && this.routes[msg.route].callback) {
                    this.routes[msg.route].callback(data);
                }
                this.emit('resource-executed', msg.route, data);
            }
            else {
                console.warn('[RPCClient] Unknown message over RPC Channel', msg);
            }
        }
    });
};

RPCClient.prototype._createResource = function(type, route, value, opr, observable, callback) {
    let self = this;

    if (!this.is_open) return Promise.reject('RPC Channel is closed');
    if (!/^(\w)+\/\d\/(\w+)$/.test(route)) return Promise.reject('route should be of format "obj/0/res"');
    if (typeof value === 'undefined') return Promise.reject('value is required');

    if (typeof opr === 'function') {
        callback = opr;
        opr = undefined;
    }
    else if (typeof observable === 'function') {
        callback = observable;
        observable = undefined;
    }

    if (typeof opr === 'undefined') opr = RPCClient.GET_PUT_ALLOWED;
    if (typeof observable === 'undefined') observable = true;

    let obj = this.routes[route] = {
        type: type,
        value: value,
        opr: opr,
        observable: observable,
        callback: callback
    };

    return this.invoke('add-resource-' + type, route, value, opr, observable).then(() => {
        return {
            get route() {
                return route;
            },
            get value() {
                return obj.value;
            },
            setValue: self._setValue.bind(self, route)
        }
    })
};

RPCClient.prototype.createResourceString = function(route, value, opr, observable, callback) {
    return this._createResource('string', route, value, opr, observable, callback);
};

RPCClient.prototype.createResourceInt = function(route, value, opr, observable, callback) {
    return this._createResource('int', route, value, opr, observable, callback);
};

RPCClient.prototype.createResourceFloat = function(route, value, opr, observable, callback) {
    return this._createResource('float', route, value, opr, observable, callback);
};

RPCClient.prototype.createFunction = function(route, callback) {
    if (!this.is_open) return Promise.reject('RPC Channel is closed');
    if (!/^(\w)+\/\d\/(\w+)$/.test(route)) return Promise.reject('route should be of format "obj/0/res"');
    if (typeof callback !== 'function') return Promise.reject('callback is required');

    this.routes[route] = {
        type: 'function',
        get route() {
            return route;
        },
        callback: callback
    };

    return this.invoke('add-resource-function', route);
};

RPCClient.prototype.register = function() {
    return this.invoke('register').then(() => {
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                reject('Did not register within 20 seconds');
            }, 20 * 1000);

            this.once('connector-state', (state, endpoint) => {
                clearTimeout(timeout);

                if (state === 'registered') {
                    resolve(endpoint);
                }
                else {
                    reject(state);
                }
            })
        });
    });
};

RPCClient.prototype.unregister = function() {
    return this.invoke('unregister').then(() => {
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                reject('Did not unregister within 20 seconds');
            }, 20 * 1000);

            this.once('connector-state', state => {
                clearTimeout(timeout);

                if (state === 'unregistered') {
                    resolve();
                }
                else {
                    reject(state);
                }
            })
        });
    });
};

RPCClient.prototype.terminate = function() {
    clearInterval(this._getQueueIv);

    this.invoke('terminate');
    return Promise.resolve();
}

RPCClient.NOT_ALLOWED                 = 0x00;
RPCClient.GET_ALLOWED                 = 0x01;
RPCClient.PUT_ALLOWED                 = 0x02;
RPCClient.GET_PUT_ALLOWED             = 0x03;
RPCClient.POST_ALLOWED                = 0x04;
RPCClient.GET_POST_ALLOWED            = 0x05;
RPCClient.PUT_POST_ALLOWED            = 0x06;
RPCClient.GET_PUT_POST_ALLOWED        = 0x07;
RPCClient.DELETE_ALLOWED              = 0x08;
RPCClient.GET_DELETE_ALLOWED          = 0x09;
RPCClient.PUT_DELETE_ALLOWED          = 0x0A;
RPCClient.GET_PUT_DELETE_ALLOWED      = 0x0B;
RPCClient.POST_DELETE_ALLOWED         = 0x0C;
RPCClient.GET_POST_DELETE_ALLOWED     = 0x0D;
RPCClient.PUT_POST_DELETE_ALLOWED     = 0x0E;
RPCClient.GET_PUT_POST_DELETE_ALLOWED = 0x0F;

module.exports = RPCClient;
