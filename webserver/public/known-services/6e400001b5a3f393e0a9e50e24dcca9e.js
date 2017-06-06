(function () {
    function generate(m) {
        var model = {
            read: {
                "heartrate/0/bpm": function (m) {
                    var c = m['6e400001b5a3f393e0a9e50e24dcca9e']['6e400003b5a3f393e0a9e50e24dcca9e'];
                    if ((c[3] == 0xff) && (c[4] == 0x80) && (c[5] == 0xca)) {
                        var data = [c[11], c[12], c[13], c[14]];

                        // Create a buffer
                        var buf = new ArrayBuffer(4);
                        // Create a data view of it
                        var view = new DataView(buf);

                        // set bytes
                        data.forEach(function (b, i) {
                            view.setUint8(i, b);
                        });

                        // Read the bits as a float; note that by doing this, we're implicitly
                        // converting it from a 32-bit float into JavaScript's native 64-bit double
                        var v = view.getFloat32(0);
                        if (v === 0) return -999999;

                        return v;
                    }
                    else {
                        return -999999;
                    }
                },
                "stress/0/value": function (m) {
                    var c = m['6e400001b5a3f393e0a9e50e24dcca9e']['6e400003b5a3f393e0a9e50e24dcca9e'];

                    if ((c[3] == 0xff) && (c[4] == 0x80) && (c[5] == 0xc9)) {
                        var data = [c[11], c[12], c[13], c[14]];

                        // Create a buffer
                        var buf = new ArrayBuffer(4);
                        // Create a data view of it
                        var view = new DataView(buf);

                        // set bytes
                        data.forEach(function (b, i) {
                            view.setUint8(i, b);
                        });

                        // Read the bits as a float; note that by doing this, we're implicitly
                        // converting it from a 32-bit float into JavaScript's native 64-bit double
                        var v = view.getFloat32(0);
                        if (v === 0) return -999999;

                        return v;
                    }
                    else {
                        return -999999;
                    }
                }
            },
            write: {
                "heartrate/0/activate": function (value, write) {
                    write('6e400001b5a3f393e0a9e50e24dcca9e/6e400002b5a3f393e0a9e50e24dcca9e', [
                        0xff, // Mullet BLE sensor ID
                        0x00, // data[1] is number of byte data when the number of bytes transmitted exceeds 20 bytes
                        0x07, // Number of byte data after data[3]
                        0x00, // Mullet BLE command request type
                        0x01, // Activate sensor command
                        0xca, // Heart rate sensor id
                        0x00, // Padding
                        0x01, // Enable gpio interrupt
                        0xff, // Mullet Hub manager id
                        0x00 // Number of parameters after data[10]. data[10] is nothing because data[9] is 0.
                    ]);

                    // write characteristics like: write('180a/2a29', [ 0x10, 0x30 ])
                    // note: value is string
                },
                "heartrate/0/request": function (value, write) {
                    write('6e400001b5a3f393e0a9e50e24dcca9e/6e400002b5a3f393e0a9e50e24dcca9e', [
                        0xff, // Mullet BLE sensor ID
                        0x00, // data[1] is number of byte data when the number of bytes transmitted exceeds 20 bytes
                        0x07, // Number of byte data after data[3]
                        0x00, // Mullet BLE command request type
                        0x03, // Request sensor data command
                        0xca, // Heart rate sensor id
                        0x00, // Padding
                        0x00, // Disable gpio interrupt
                        0xff, // Mullet Hub manager id
                        0x00 // Number of parameters after data[10]. data[10] is nothing because data[9] is 0.
                    ]);
                },
                "stress/0/active": function (value, write) {
                    write('6e400001b5a3f393e0a9e50e24dcca9e/6e400002b5a3f393e0a9e50e24dcca9e', [
                        0xff, // Mullet BLE sensor ID
                        0x00, // data[1] is number of byte data when the number of bytes transmitted exceeds 20 bytes
                        0x07, // Number of byte data after data[3]
                        0x00, // Mullet BLE command request type
                        0x01, // Activate sensor command
                        0xc9, // Stress measure sensor id
                        0x00, // Padding
                        0x01, // Enable gpio interrupt
                        0xff, // Mullet Hub manager id
                        0x00 // Number of parameters after data[10]. data[10] is nothing because data[9] is 0.
                    ]);
                },
                "stress/0/request": function (value, write) {
                    write('6e400001b5a3f393e0a9e50e24dcca9e/6e400002b5a3f393e0a9e50e24dcca9e', [
                        0xff, // Mullet BLE sensor ID
                        0x00, // data[1] is number of byte data when the number of bytes transmitted exceeds 20 bytes
                        0x07, // Number of byte data after data[3]
                        0x00, // Mullet BLE command request type
                        0x03, // Request sensor data command
                        0xc9, // Stress measure sensor id
                        0x00, // Padding
                        0x00, // Enable gpio interrupt
                        0xff, // Mullet Hub manager id
                        0x00 // Number of parameters after data[10]. data[10] is nothing because data[9] is 0.
                    ]);
                }
            }
        };
        return model;
    }

    window.knownServices.register('6e400001b5a3f393e0a9e50e24dcca9e', 'Mullet BLE service', generate);
})();
