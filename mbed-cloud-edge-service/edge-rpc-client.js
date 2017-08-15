const net = require('net');
const EventEmitter = require('events');
const promisify = require('es6-promisify');

const CON_PR = '\x1b[34m[ClientService]\x1b[0m';

const FSTRM_CONTROL_ACCEPT = 0x01;
const FSTRM_CONTROL_START = 0x02;
const FSTRM_CONTROL_STOP = 0x03;
const FSTRM_CONTROL_READY = 0x04;
const FSTRM_CONTROL_FINISH = 0x05;

function EdgeRpcClient(host, port) {
    EventEmitter.call(this);

    this.host = host;
    this.port = port;
    this._rpcId = 0;

    this._is_open = false;
}

EdgeRpcClient.prototype = Object.create(EventEmitter.prototype);

EdgeRpcClient.prototype.is_open = function() {
    return this._is_open;
};

EdgeRpcClient.prototype._writeControlCommand = function(buffer) {
    let newBuffer = new Buffer(buffer.length + 8);
    newBuffer.fill(0);
    newBuffer.writeUInt32BE(buffer.length, 4);

    buffer.copy(newBuffer, 8);

    // console.log(CON_PR, 'writeControlCommand', newBuffer);

    this.client.write(newBuffer);
};

EdgeRpcClient.prototype.sendControlCommand = function(buffer, waitForResponse) {
    if (!waitForResponse) return this._writeControlCommand(buffer);

    let client = this.client;

    return new Promise((res, rej) => {
        let to = setTimeout(() => {
            rej('Timeout');
        }, 10000);

        client.once('data', data => {
            clearTimeout(to);

            if (data.length < 8) return rej('Expected at least 8 bytes, but got ' + data.length);

            // @todo: also read first uint32??
            let length = data.readUInt32BE(4, 8);

            if (data.readUInt32BE(0, 4) !== 0) {
                // no cmd
                return;
            }

            if (data.length - 8 !== length) {
                console.log(CON_PR, '[CmdResponse] Did not get full length in this frame... Need to implement a buffer. Very annoying',
                    data.length, length);
                return rej('Length mismatch');
            }

            res(data.slice(8));
        });

        this._writeControlCommand(buffer);
    });
};

EdgeRpcClient.prototype.sendJsonRpc = async function(method, params) {
    let id = ++this._rpcId;
    let client = this.client;

    let cmd = Buffer.from(JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: id
    }), 'utf-8');

    // console.log(CON_PR, 'JSONRPC', cmd.toString('utf-8'));

    let sendBuffer = new Buffer(cmd.length + 4);
    sendBuffer.writeUInt32BE(cmd.length, 0);
    cmd.copy(sendBuffer, 4, 0);

    // console.log(CON_PR, 'JSONRPC sending...', sendBuffer);
    client.write(sendBuffer);

    return new Promise((res, rej) => {
        let to = setTimeout(() => {
            client.removeListener('data', onData);
            rej('Timeout');
        }, 10000);

        function onData(data) {
            let length = data.readUInt32BE(0, 4);

            if (length === 0) { // datacmd frame
                return;
            }

            if (data.length - 4 !== length) {
                console.log(CON_PR, '[JSONRPC] Did not get full length in this frame... Need to implement a buffer. Very annoying',
                    data.length, length);
                return;
            }

            // so the data is in data.slice(4)
            try {
                let json = JSON.parse(data.slice(4).toString('utf-8'));
                // console.log(CON_PR, 'got json?', json);
                if (json.jsonrpc === '2.0' && json.id === id) {
                    // ok got the message
                    clearTimeout(to);
                    client.removeListener('data', onData);

                    if (json.result) {
                        res(json.result);
                    }
                    else if (json.error) {
                        rej(json.error);
                    }
                    else {
                        rej('No result or error field on RPC result');
                    }
                }
            }
            catch (ex) {
                console.log(CON_PR, 'expected json but got', data.slice(4).toString('utf-8'));
            }
        }

        client.on('data', onData);
    });
}

EdgeRpcClient.prototype.init = async function() {
    let client = this.client = new net.Socket();

    client.on('error', error => {
        console.log(CON_PR, 'socket error', error);
    });

    client.on('close', () => {
        console.log(CON_PR, 'socket closed');

        this._is_open = false;

        // does close() fire when calling destroy() ?
        // should re-connect here
    });

    console.log(CON_PR, 'Connecting to mbed Cloud Edge on ' + this.host + ':' + this.port);

    await promisify(client.connect.bind(client))(this.port, this.host);

    console.log(CON_PR, 'Connected to mbed Cloud Edge');

    // now we need to send that we're gonna be ready...
    let readyCmd = new Buffer(4);
    readyCmd.writeUInt32BE(FSTRM_CONTROL_READY, 0);

    let acceptRes = await this.sendControlCommand(readyCmd, true);
    if (acceptRes.readUInt32BE(0) !== FSTRM_CONTROL_ACCEPT) {
        throw 'Expected FSTRM_CONTROL_ACCEPT but got ' + acceptRes.readUInt32BE(0);
    }

    // console.log(CON_PR, 'Got FSTRM_CONTROL_ACCEPT... Gonna send START now');

    // 00 00 00 02 00 00 00 01 00 00 00 07 6a 73 6f 6e 72 70 63
    let startCmd = new Buffer(acceptRes.length);
    startCmd.writeUInt32BE(FSTRM_CONTROL_START, 0);
    acceptRes.copy(startCmd, 4, 4); // seems to just echo..?

    // so this command does not reply... pff
    await this.sendControlCommand(startCmd, false);

    // start should send a reply
    await this.wait(200);

    // ok... so let's see what we can do now
    // @todo: move this name into config, and then use MAC address there or something
    await this.sendJsonRpc('protocol_translator_register', { name: 'bluetooth_devicelink' });

    this._is_open = true;

    // console.log(CON_PR, 'Protocol translator registered');
};

EdgeRpcClient.prototype.deinit = async function() {
    if (!this._is_open) return true;

    let stopCmd = new Buffer(4);
    stopCmd.writeUInt32BE(FSTRM_CONTROL_STOP, 0);
    let stopRes = await this.sendControlCommand(stopCmd, true);

    if (stopRes.readUInt32BE(0) === FSTRM_CONTROL_FINISH) {
        console.log(CON_PR, 'Stopped successfully');
        this.client && this.client.destroy();
        this.client = null;
    }
    else {
        throw 'Did not receive FINISH command: ' + stopRes.readUInt32BE(0);
    }
};

EdgeRpcClient.prototype.wait = async function(ms) {
    return new Promise((res, rej) => {
        setTimeout(res, ms);
    });
};

module.exports = EdgeRpcClient;
