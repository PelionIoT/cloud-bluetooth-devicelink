'use strict';

const noble = require('noble');
const co = require('co');
const promisify = require('es6-promisify');
const net = require('net');
const Path = require('path');
const fs = require('fs');
const vm = require('vm');
const startWebserver = require('./webserver/webserver.js');
const EventEmitter = require('events');
const chokidar = require('chokidar');

var logSeenDevices = process.argv.indexOf('--log-seen-devices') > -1;
var macOsFix = process.argv.indexOf('--mac-os-fix') > -1;

var devices = {};
var seen = {};
var ee = new EventEmitter();

function createDevice(eui) {
  devices[eui] = {
    deveui: eui,
    updateState: function(state, error) {
      this.state = state;
      this.stateError = error;
      this.ee.emit('statechange', state, error);
    },
    state: 'disconnected',
    stateError: null,
    model: {},
    charsModel: {},
    ee: new EventEmitter(),
    updateLwm2m: function() {
      this.lwm2m = this.generateNewLwm2m();
      this.ee.emit('lwm2mchange', this.lwm2m);
    },
    generateNewLwm2m: function() {
      var readKeys = Object.keys(this.definition.read);
      var writeKeys = Object.keys(this.definition.write);
      var allKeys = readKeys.concat(writeKeys);

      return allKeys.reduce((curr, route) => {
        try {
          curr[route] = {
            mode: (readKeys.indexOf(route) > -1 ? 'r' : '') + (writeKeys.indexOf(route) > -1 ? 'w' : ''),
            defaultValue: (readKeys.indexOf(route) > -1 ? this.definition.read[route](this.model) : '').toString()
          };
        }
        catch (ex) { /* ignore if fails */ }
        return curr;
      }, {});
    }
  };
}

fs.readdirSync(Path.join(__dirname, 'devices')).filter(f => {
  return /\.js$/.test(f);
}).map(f => Path.basename(f, '.js')).forEach(f => {
  createDevice(f);
});

startWebserver(devices, seen, ee, createDevice);

console.log('Bluetooth state is', noble.state);

function* loadDeviceDefinition(address) {
  let definition = yield promisify(fs.readFile.bind(fs))(Path.join(__dirname, 'devices', address + '.js'), 'utf-8');
  let sandbox = { module: {} };
  let context = new vm.createContext(sandbox);
  let script = new vm.Script(definition);
  script.runInContext(context);

  return context.module.exports;
}

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    console.log('Bluetooth stateChange, start scanning');
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
  }
});

var connectedOnce = {};

noble.on('discover', co.wrap(function*(peripheral) {
    let ad = peripheral.advertisement;

    // already connected? then ignore
    // @todo, add throttling for connection-failed
    if (devices[peripheral.address] &&
          ['disconnected', 'connection-failed'].indexOf(devices[peripheral.address].state) === -1) {
      return;
    }

    if (logSeenDevices) {
      if (ad.localName !== undefined || peripheral.address !== 'unknown') {
        console.log('Seen device', ad.localName, peripheral.address);
      }
    }

    if (!peripheral.connectable) return;

    // soooo, here's a very weird bug.
    // sometimes with a new device we don't know the address...
    // after connecting once however we know it next time.
    // so dirty hack.
    if (ad.localName && peripheral.address === 'unknown'/* && !connectedOnce[ad.localName]*/) {
      // don't do this for now, seems macOS only...
      if (!macOsFix) {
        return;
      }

      connectedOnce[ad.localName] = true;

      // // connect and disconnect straight away. that should help.
      console.log(`[${ad.localName}] connecting to find out address...`);
      var pto = setTimeout(() => {
        console.log(`[${ad.localName}] failed to connect`);
        peripheral.disconnect();
      }, 10000);
      peripheral.connect(function(err, bla) {
        clearTimeout(pto);
        peripheral.disconnect(function() {});
      });
      return;
    }

    if (peripheral.address === 'unknown') return;

    // delete it here again so we can connect to multiple devices with the same name.
    // delete connectedOnce[ad.localName];

    if (!devices[peripheral.address]) {
      var address = peripheral.address;
      seen[address] = {
        lastSeen: new Date(),
        name: ad.localName || address,
        eui: address,
        rssi: peripheral.rssi,
        services: ad.serviceUuids
      };
      ee.emit('seen', seen[address]);
    }

    // so on slow computers like Rpi, it happens that the call to loadDeviceDefinition takes too long
    // and new ad frame came in, and we try to connect to same device twice
    // and the bt adapter ends up in a weird state...
    // Therefore we do this sync. @todo
    if (!fs.existsSync(Path.join(__dirname, 'devices', peripheral.address + '.js'))) {
      return;
    }

    try {
      if (!devices[peripheral.address]) {
        createDevice(peripheral.address);
      }
      else {
        // set connecting here already, so we cannot connect twice
        devices[peripheral.address].updateState('connecting');
        devices[peripheral.address].localName = ad.localName;
        devices[peripheral.address].model = {};
        devices[peripheral.address].charsModel = {};
      }

      connect(peripheral, yield loadDeviceDefinition(peripheral.address), ad.localName);
    }
    catch (ex) {
      if (ex.code === 'ENOENT') {
        // ignore
      }
      else {
        console.log('Error while loading definition for', peripheral.address, ex);
      }
    }
}));

function replacer(key,value){
  if (key === 'peripheral' || key === 'model' || key === 'definition'
      || key === 'ee' || key === 'state' || key === 'charsModel')
    return undefined;

  return value;
}

var connect = co.wrap(function*(p, definition, localName) {
  devices[p.address].updateState('connecting');
  devices[p.address].peripheral = p;
  devices[p.address].definition = definition;
  devices[p.address].localName = localName;

  function log(msg) {
    let arg = [].slice.call(arguments, 1);
    msg = `[${p.address}] ${msg}`;
    arg = [msg].concat(arg);
    console.log.apply(console, arg);
  }

  function ondisconnect() {
    p.removeListener('disconnect', ondisconnect);

    log('Disconnected');

    if (devices[p.address]) {
      devices[p.address].updateState('disconnected');
    }

    sockets.forEach(socket => {
      socket.write(JSON.stringify({
        type: "delete-device",
        deveui: p.address
      }) + '\n');
    });
  }
  p.on('disconnect', ondisconnect);

  try {
    let model = devices[p.address].model;
    let charsModel = devices[p.address].charsModel;
    let discoveryCompleted = false;

    log('Trying to connect');
    yield promisify(p.connect.bind(p))();
    log('Connected, reading characteristics');
    devices[p.address].updateState('discovering-services');
    var services = yield promisify(p.discoverServices.bind(p))([]);
    log(services);
    devices[p.address].updateState('discovering-characteristics');
    for (let ix = 0; ix < services.length; ix++) {
      let service = services[ix];
      model[service.uuid] = {};
      charsModel[service.uuid] = {};

      log('Discovering services for', service.uuid);
      let chars;
      try {
        chars = yield promisify(service.discoverCharacteristics.bind(service))([]);
      }
      catch (ex) {
        console.error('Something happened...', chars);
        throw ex;
      }
      log('Got characteristics', service.uuid, chars);
      devices[p.address].updateState('reading-characteristics');

      for (let cx = 0; cx < chars.length; cx++) {
        let char = chars[cx];

        if (char.uuid == 9801) continue;

        charsModel[service.uuid][char.uuid] = char;

        if (char.properties.indexOf('read') > -1) {
          log('Reading', char.uuid);
          model[service.uuid][char.uuid] = yield promisify(char.read.bind(char))();
          log(char.uuid, model[service.uuid][char.uuid]);
        }
        if (char.properties.indexOf('notify') > -1) {
          log('Gonna subscribe', char.uuid);
          char.on('read', v => {
            model[service.uuid][char.uuid] = v;

            devices[p.address].ee.emit('modelchange', model);

            if (!discoveryCompleted) return;

            let new_lwm2m = devices[p.address].generateNewLwm2m();

            let changed = Object.keys(new_lwm2m).filter(k => {
              if (!devices[p.address].lwm2m[k]) return true;
              return new_lwm2m[k].defaultValue !== devices[p.address].lwm2m[k].defaultValue
                && new_lwm2m[k].defaultValue !== '-999999'; // magic value
            }).reduce((curr, k) => {
              curr[k] = new_lwm2m[k].defaultValue;
              return curr;
            }, {});

            devices[p.address].updateLwm2m();

            if (Object.keys(changed).length > 0) {
              log('Updated routes', changed);
            }

            sockets.forEach(socket => {
              socket.write(JSON.stringify({
                  type: "new-data-upstream",
                  deveui: p.address,
                  lwm2m: changed
              }) + '\n');
            });
          });
          // enable notify
          yield promisify(char.notify.bind(char))(true);
          log('Subscribed', char.uuid);
        }
      }
    }

    discoveryCompleted = true;
    log('Discovery completed');

    // now to make a device for Connector
    devices[p.address].updateState('connected');
    devices[p.address].type = 'create-device';
    devices[p.address].deveui = definition.deveui;
    devices[p.address].security = definition.security;
    devices[p.address].updateLwm2m();

    devices[p.address].ee.emit('modelchange', model);

    log('Initial model is', Object.keys(devices[p.address].lwm2m).reduce((curr, k) => {
      if (!devices[p.address].lwm2m[k].defaultValue) return curr;
      curr[k] = devices[p.address].lwm2m[k].defaultValue;
      return curr;
    }, {}));

    sockets.forEach(socket => {
      socket.write(JSON.stringify(devices[p.address], replacer) + '\n', 'ascii');
    });
  }
  catch (ex) {
    devices[p.address].updateState('connection-failed', ex);
    console.error('Exception happened', ex);
    p.removeListener('disconnect', ondisconnect);
    p.disconnect();
  }

  noble.startScanning([], true);
});

function add(path) {
  if (/\.js$/.test(path)) {
    var eui = Path.basename(path, '.js');
    if (devices[eui]) return change(path);
    createDevice(eui);
  }
}

function unlink(path) {
  if (/\.js$/.test(path)) {
    var eui = Path.basename(path, '.js');
    if (!devices[eui]) return;

    if (devices[eui].peripheral) {
      devices[eui].peripheral.disconnect();
    }
    devices[eui].updateState('disconnected');
    delete devices[eui];
  }
}

var change = co.wrap(function*(path) {
  if (/\.js$/.test(path)) {
    var eui = Path.basename(path, '.js');
    try {
      var definition = yield loadDeviceDefinition(eui);

      if (!devices[eui]) return add(path);

      devices[eui].definition = definition;
      devices[eui].security = definition.security;
      devices[eui].updateLwm2m();

      // only send update to connector if we're actually connected
      if (devices[eui].state !== 'connected') return;

      sockets.forEach(socket => {
        socket.write(JSON.stringify({
          type: "delete-device",
          deveui: eui
        }) + '\n');
      });

      // re-register after 5s.
      setTimeout(function() {
        sockets.forEach(socket => {
          socket.write(JSON.stringify(devices[eui], replacer) + '\n', 'ascii');
        });
      }, 5000);
    }
    catch (ex) {
      console.error(`[${eui}] Update lwm2m failed`, ex);
    }
  }
});

function setupWatcher() {
    var watcher = chokidar.watch(Path.join(__dirname, 'devices'), {
        recursive: false,
        ignoreInitial: true,
    });
    watcher
        .on('add', path => {
            if (!(/\.js$/.test(path))) return;
            console.log('add', path);

            add(path);
        })
        .on('change', path => {
            console.log('change', path);

            change(path);
        })
        .on('unlink', path => {
            console.log('unlink', path);

            unlink(path);
        })
      .on('error', err => console.error('watch err', err));
}
setupWatcher();

var sockets = [];
var tcpServer = net.createServer(function(socket) {
  sockets.push(socket);

  console.log('New connection came in!');

  Object.keys(devices).forEach(k => {
    if (devices[k].state === 'connected') {
      socket.write(JSON.stringify(devices[k], replacer) + '\n', 'ascii');
    }
  });

  socket.on('close', function() {
    console.log('Bridge socket was closed');

    // remove socket from array
    sockets.splice(sockets.indexOf(socket), 1);
  });

  socket.on('error', err => {
    console.error('Socket error', err);
  });

  socket.on('data', ev => {
    try {
      if (ev.length === 1 && ev[0] === 0x0a) {
        return;
      }

      ev = JSON.parse(ev.toString('ascii'));
    }
    catch (ex) {
      return console.error('Bridge data was not json', ev);
    }

    if (ev.type === 'new-data-downstream') {
      if (!devices[ev.deveui]) {
        return console.log('Downstream data for unknown EUI', ev.deveui);
      }

      if (!devices[ev.deveui].definition.write || !devices[ev.deveui].definition.write[ev.uri]) {
        return console.log('Eui %s does not have write definition for %s', ev.deveui, ev.uri);
      }

      console.log('data is', ev);

      try {
        function write(path, aData) {
          console.log('device', ev.deveui, 'path', path, 'data', aData);
          var s = path.split('/');
          let service = s[0], char = s[1];
          devices[ev.deveui].charsModel[service][char].write(new Buffer(aData));
        }
        devices[ev.deveui].definition.write[ev.uri](ev.value, write);
      }
      catch (ex) {
        console.error('Executing write function failed, eui %s, path %s', ev.deveui, ev.uri, ex);
      }
    }
  });
});

console.log('TCP server listening on port %d!', process.env.TCP_PORT || 1337);
tcpServer.listen(process.env.TCP_PORT || 1337, '0.0.0.0');
