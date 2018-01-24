# mbed Cloud Bluetooth Devicelink

This is an *experimental* way to connect Bluetooth Low Energy devices into mbed Cloud.

## Setup with mbed Cloud Edge

1. Install mbed Cloud Edge.
    * You can run mbed Cloud Edge in an Ubuntu VM and this application on your main OS.
1. Install [node.js 7+](https://nodejs.org/en/).

Start via:

```
# start mbed Cloud Edge
$ ./path-to-mbed-cloud-edge -p 9100

# install and start mbed Cloud Bluetooth Devicelink
$ npm install
$ node bt.js mbed-cloud-edge --edge-host 127.0.0.1 --edge-port 9100
```

## Usage

Navigate to the web interface at http://localhost:3000 and add your device.

**Note on macOS:** If you don't see any devices, and `--log-seen-devices` yields your device with an 'unknown' MAC address; start the process with `--mac-os-fix` *once*, then start the process normally.

* `--log-seen-devices` - logs all devices seen, useful for debugging.
* `--client-service [url]` - sets the path to the mbed Cloud Devicelink service.

## Mapping from BLE to LWM2M

Because BLE devices use GATT services and characteristics and mbed Device Connector uses LWM2M resource models, we need to define a mapping between the two.

In the web interface there are two editors, one for read-mappings and one for write-mappings. In both of these you can use JavaScript to write the mappings.

### Known-services

You can re-use mappings. See the 'webserver/public/known-services' folder. If Bluetooth Devicelink encounters these services it will autogenerate the mapping.

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

## Firmware updates

mbed Cloud Bluetooth Devicelink can also handle firmware updates for BLE devices. It does this by intercepting an update that comes in from mbed Cloud, verifying that it was signed by a trusted party, and then hand it off to the native firmware update method. This requires you to sign the update using the manifest-tool, and provision the public key used for this update into Devicelink.

Methods supported are:

* Nordic legacy DFU.

The implementations are pluggable in `ble-devicelink/firmware-updates.js`.

An example firmware (with bootloader), an OTA image, and a pre-signed manifest are already available for the nRF52-DK. See the `firmware/` folder. Flash the `_BOOT` image to your nRF52-DK, provision the device in Devicelink and upload the manifest to mbed Cloud. Then start an update campaign from mbed Cloud to update the device. You can also re-sign new firmware with the certificates provided in this folder.

## TODO

* Passcode screens are handled by the host OS, not by Devicelink itself. This is annoying when you're using a headless computer like a Raspberry Pi. Need to log into the machine to add authenticated devices.
