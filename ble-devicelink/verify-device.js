'use strict';

function assert(real, expected, message) {
    if (real !== expected)
        throw message + ' should be ' + expected + ' (was ' + real + ')';
}

module.exports = function verifyDevice(device) {
    assert(typeof device, 'object', 'device');

    assert(typeof device.type, 'string', 'device.type');
    assert(device.type, 'create-device', 'device.type');
    assert(typeof device.deveui, 'string', 'device.deveui');
    assert(typeof device.security, 'object', 'device.security');
    assert(typeof device.security.mbed_domain, 'string', 'device.security.mbed_domain');
    assert(typeof device.security.mbed_endpoint_name, 'string', 'device.security.mbed_endpoint_name');
    assert(typeof device.security.access_key, 'string', 'device.security.access_key');
    assert(typeof device.read, 'object', 'device.read');

    Object.keys(device.read).forEach(k => {
        let rule = device.read[k];
        let split = k.split('/');
        assert(split.length, 3, k + ' segment length');
        assert(isNaN(Number(split[1])), false, k + ' segment[1] is number');
        assert(typeof rule, 'function', 'typeof rule ' + k);
    });
};
