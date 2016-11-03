# Bluetooth bridge

This is an *experimental* bridge to connect Bluetooth Low Energy devices into mbed Device Connector.

## Setup

1. Install [mbed-client-linux-gateway](https://github.com/armmbed/mbed-client-linux-gateway).
    * You can run mbed-client-linux-gateway in an Ubuntu VM and this bridge on your main OS.
2. Install [node.js 6+](https://nodejs.org/en/).

Then, on Ubuntu/Debian:

```bash
$ sudo apt-get install libudev-dev
$ npm install
$ node bt.js
```

On macOS:

```bash
$ npm install
$ node bt.js
```

The bridge opens a webserver on `localhost:3000` and a TCP socket on `localhost:1337`. Start mbed-client-linux-gateway and connect it to the TCP socket for the full bridge to work.

Now navigate to the web interface at http://localhost:3000 and add your device.

### Options

* `--log-seen-devices` - logs all devices seen, useful for debugging.

## Mapping from BLE to LWM2M

Because BLE devices use GATT services and characteristics and mbed Device Connector uses LWM2M resource models, we need to define a mapping between the two.

In the web interface there are two editors, one for read-mappings and one for write-mappings. In both of these you can use JavaScript to write the mappings.

### Known-services

You can re-use mappings. See the 'webserver/public/known-services' folder. If the bridge encounters these services it will autogenerate the mapping.

### Read mapping

Defines what should happen when translating BLE GATT characteristic value into LWM2M resource value. Is automatically called when a BLE NOTIFY event happens as well.

```js
{
    // led/0/color is LWM2M resource here

    "led/0/color": function (m) {
        // m contains the full BLE GATT model (e.g. m['180a'] is the 180a service)
        // and m['180a']['2a29'] is char 2a29 under that service
        // Characteristics always return a Buffer, so you'll need to do some work to 'un-buffer' it.

        // read characteristics like: m['180a']['2a29'].toString('ascii'))
        var a = m['9900']['9901'];
        return (a[2] << 16) + (a[1] << 8) + a[2];
    }
}
```

### Write mapping

Defines what should happen when a resource was updated in mbed Device Connector, and what command should be sent to the BLE device.

```js
{
    // actuator/0/action is the LWM2M resource

    "actuator/0/action": function (value, write) {
        // 'value' contains the new value (seen from Connector) as a *string*
        // write is a function which you can use to write to a characteristic. it has 2 arguments
        //    * BLE path => '180a/2a29' for char 2a29 under service 180a
        //    * Buffer => array of bytes to be sent to this characteristic
        // example: write('180a/2a29', [ 0x10, 0x30 ])

        var v = Number(value);

        write('9900/9901', [ 0x23, v ]);
    }
}
```

## TODO

* Can only connect to unprotected devices (no security features).
* [status-change](https://github.com/armmbed/mbed-client-linux-gateway#status-in-connector-changed) events are not handled.
