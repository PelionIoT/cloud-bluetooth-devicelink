const promisify = require('es6-promisify');
const EventEmitter = require('events');

/**
 * RPCClient for mbed Cloud Edge
 * @param {*} edgeRpc Instance of edge-rpc-client
 */
function RPCClient(edgeRpc, id) {
    EventEmitter.call(this);

    this.edgeRpc = edgeRpc;
    this.id = id;
    this.rpcId = id.replace(/:/g, '');
    this.is_open = () => edgeRpc.is_open();
    this.routes = {};

    this._onTerminateQueue = [];

    this.is_registered = false;
}

RPCClient.prototype = Object.create(EventEmitter.prototype);

/**
 * Open the RPC Channel
 * @return Returns a promise
 */
RPCClient.prototype.open = function() {
    return Promise.resolve();
};

RPCClient.prototype._setValue = function(route, newValue) {
    if (route.indexOf('/') === 0) route = route.substr(1); // should be fixed higher up but f&@ it

    if (!this.is_open) return Promise.reject('RPC Channel is closed');
    if (!this.routes[route]) return Promise.reject(`Unknown route '${route}'`);

    let r = this.routes[route];
    if (r.type === 'function') return Promise.reject('Route type is function, cannot set value');

    r.value = newValue;

    return this.edgeRpc.sendJsonRpc('write', {
        'device-id': this.rpcId,
        'objects': this._getObjectModel()
    });
};

RPCClient.prototype._createResource = function(type, route, value, opr, observable, callback) {
    let self = this;

    if (!this.is_open()) return Promise.reject('RPC Channel is closed');
    if (!/^(\d)+\/\d\/(\d+)$/.test(route)) return Promise.reject('route should be of format "3200/0/5501"');
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

    let o = this.routes[route] = {
        type: type,
        value: value,
        opr: opr,
        observable: observable,
        callback: callback,
        setValue: newValue => {
            return this._setValue(route, newValue);
        }
    };

    // actual adding happens in register call
    return Promise.resolve(o);
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
    if (!this.is_open()) return Promise.reject('RPC Channel is closed');
    if (!/^(\d)+\/\d\/(\d+)$/.test(route)) return Promise.reject('route should be of format "3200/0/5501"');
    if (typeof callback !== 'function') return Promise.reject('callback is required');

    this.routes[route] = {
        type: 'function',
        opr: RPCClient.POST_ALLOWED,
        get route() {
            return route;
        },
        callback: callback
    };

    var onExecuted = (deviceId, r_route, buff) => {
        if (deviceId !== this.id) return;
        if (route !== r_route) return;

        callback(buff);
    };

    this.edgeRpc.on('resource-executed', onExecuted);

    this._onTerminateQueue.push(() => {
        this.edgeRpc.removeListener('resource-executed', onExecuted);
    })

    // actual adding happens in register call
    return Promise.resolve();
};

RPCClient.prototype._getObjectModel = function() {
    let objs = [];

    for (let route of Object.keys(this.routes)) {
        // mbed Cloud Edge only supports numbers...
        let [objId, objInstId, resId] = route.split('/').map(Number);

        let obj = objs.find(o => o['object-id'] === objId);
        if (!obj) {
            obj = { 'object-id': objId, 'object-instances': [] };
            objs.push(obj);
        }

        let objInst = obj['object-instances'].find(o => o['object-instance-id'] === objInstId);
        if (!objInst) {
            objInst = { 'object-instance-id': objInstId, 'resources': [] };
            obj['object-instances'].push(objInst);
        }

        objInst.resources.push({
            'item-id': resId,
            'operations': this.routes[route].opr,
            'type': this.routes[route].type === 'function' ? 'opaque' : this.routes[route].type,
            'value': (this.routes[route].value || '').toString()
        });
    }

    return objs;
}

RPCClient.prototype.register = async function() {
    await this.edgeRpc.sendJsonRpc('device_register', {
        'lifetime': 86400,
        'queuemode': 'Q',
        'device-id': this.rpcId,
        'objects': this._getObjectModel()
    });

    this.is_registered = true;
};

RPCClient.prototype.unregister = async function() {
    await this.edgeRpc.sendJsonRpc('device_unregister', {
        'device-id': this.rpcId,
    });

    this.is_registered = false;
};

RPCClient.prototype.terminate = function() {
    clearInterval(this._getQueueIv);

    for (let fn of this._onTerminateQueue) {
        fn();
    }

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
