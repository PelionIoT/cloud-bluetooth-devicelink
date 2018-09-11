/*
{
    "3/0/0": function (m) {
        return m['180a']['2a29'].toString('ascii');
    },
    "3/0/1": function (m) {
        return m['180a']['2a24'].toString('ascii');
    },
    "3/0/2": function (m) {
        return m['180a']['2a25'].toString('ascii');
    },
    "3/0/18": function (m) {
        return m['180a']['2a27'].toString('ascii');
    },
    "3/0/3": function (m) {
        return m['180a']['2a26'].toString('ascii');
    },
    "3/0/19": function (m) {
        return m['180a']['2a28'].toString('ascii');
    },
    "temp/0/3": function(m) {
        return m['a002']['a003'][0];
    },
    "temp/0/4": function(m) {
        var tempArray = m['a002']['a004']
        var buffer = new ArrayBuffer(4);
        var intView = new Uint32Array(buffer);
        intView[0] = 0;
        for (var i = 0; i < 3; i++) {
            intView[0] += tempArray[3 - i] << (i * 8);
        }
        var dv = new DataView(buffer);
        return dv.getFloat32(0);
    },
    "temp/0/5": function(m) {
        var t = m['a002']['a005']
        return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
    },
    "temp/0/6": function(m) {
        var tempArray = m['a002']['a006']
        var buffer = new ArrayBuffer(4);
        var intView = new Uint32Array(buffer);
        intView[0] = 0;
        for (var i = 0; i < 3; i++) {
            intView[0] += tempArray[3 - i] << (i * 8);
        }
        var dv = new DataView(buffer);
        return dv.getFloat32(0);
    },
    "temp/0/7": function(m) {
        var tempArray = m['a002']['a007']
        var buffer = new ArrayBuffer(4);
        var intView = new Uint32Array(buffer);
        intView[0] = 0;
        for (var i = 0; i < 3; i++) {
            intView[0] += tempArray[3 - i] << (i * 8);
        }
        var dv = new DataView(buffer);
        return dv.getFloat32(0);
    },
    "temp/0/8": function(m) {
        var t = m['a002']['a008']
        return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
    },
    "temp/0/9": function(m) {
        var tempArray = m['a002']['a009']
        var buffer = new ArrayBuffer(4);
        var intView = new Uint32Array(buffer);
        intView[0] = 0;
        for (var i = 0; i < 3; i++) {
            intView[0] += tempArray[3 - i] << (i * 8);
        }
        var dv = new DataView(buffer);
        return dv.getFloat32(0);
    },
    "temp/0/a": function(m) {
        var t = m['a002']['a00a']
        return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
    }
}
*/

(function () {
    function generate(m) {
        return {
            read: {
                // DEVICE_ACTIVED_CHARACTERISTIC_UUID
                "7141/0/3347": function(m) {
                    return m['a002']['a003'][0];
                },
                // START_TEMP_CHARACTERISTIC_UUID
                "7141/0/3303": function(m) {
                    var tempArray = m['a002']['a004']
                    var buffer = new ArrayBuffer(4);
                    var intView = new Uint32Array(buffer);
                    intView[0] = 0;
                    for (var i = 0; i < 3; i++) {
                        intView[0] += tempArray[3 - i] << (i * 8);
                    }
                    var dv = new DataView(buffer);
                    return dv.getFloat32(0);
                },
                // TIME_TO_MINIMA_CHARACTERISTIC_UUID
                "7141/0/3350": function(m) {
                    var t = m['a002']['a005']
                    return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
                },
                // MINI_TEMP_CHARACTERISTIC_UUID
                "7141/0/3320": function(m) {
                    var tempArray = m['a002']['a006']
                    var buffer = new ArrayBuffer(4);
                    var intView = new Uint32Array(buffer);
                    intView[0] = 0;
                    for (var i = 0; i < 3; i++) {
                        intView[0] += tempArray[3 - i] << (i * 8);
                    }
                    var dv = new DataView(buffer);
                    return dv.getFloat32(0);
                },
                // MAX_STORAGE_TEMP_CHARACTERISTIC_UUID
                "7141/1/3303": function(m) {
                    var tempArray = m['a002']['a007']
                    var buffer = new ArrayBuffer(4);
                    var intView = new Uint32Array(buffer);
                    intView[0] = 0;
                    for (var i = 0; i < 3; i++) {
                        intView[0] += tempArray[3 - i] << (i * 8);
                    }
                    var dv = new DataView(buffer);
                    return dv.getFloat32(0);
                },
                // TIME_ABOVE_SAFE_TEMP_CHARACTERISTIC_UUID
                "7141/0/6006": function(m) {
                    var t = m['a002']['a008']
                    return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
                },
                // TEMP_AT_RECOVERY_CHARACTERISTIC_UUID
                "7141/1/3320": function(m) {
                    var tempArray = m['a002']['a009']
                    var buffer = new ArrayBuffer(4);
                    var intView = new Uint32Array(buffer);
                    intView[0] = 0;
                    for (var i = 0; i < 3; i++) {
                        intView[0] += tempArray[3 - i] << (i * 8);
                    }
                    var dv = new DataView(buffer);
                    return dv.getFloat32(0);
                },
                // MINUTES_SINCE_INJECTION_CHARACTERISTIC_UUID
                "7141/1/6006": function(m) {
                    var t = m['a002']['a00a']
                    return (t[0]) + (t[1] << 8) + (t[2] << 16) + (t[3] << 24);
                }
            },
            write: {

            }
        };
    }

    window.knownServices.register('a002', 'Arm Auto-Injector Service', generate);
})();
