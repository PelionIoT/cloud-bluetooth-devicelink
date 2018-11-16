(function() {
  function generate(m) {
    return {
      read: {
        // temperature value
        "3303/0/5700": function (m)
        {
          var c = m['1809']['2a1c'];

          function getFloatValue(value, offset) {
            var negative = value.getInt8(offset + 2) >>> 31;

            var b0 = value.getUint8(offset);
            var b1 = value.getUint8(offset + 1);
            var b2 = value.getUint8(offset + 2);
            var exponent = value.getInt8(offset + 3);

            var mantissa = b0 | (b1 << 8) | (b2 << 16);
            if (negative) {
                mantissa |= 255 << 24;
            }

            return mantissa * Math.pow(10, exponent);
          }
          return getFloatValue(new DataView(new Uint8Array(c).buffer), 1);
        },
        // temperature units
        "3303/0/5701": function (m)
        {
          var c = m['1809']['2a1c'];

          return c[0] & 0b00000001 === 1 ? 'Fahrenheit' : 'Celcius';
        }
      }
    };
  }

  window.knownServices.register('1809', 'Temperature service', generate);
})();
