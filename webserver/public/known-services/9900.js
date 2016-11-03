(function() {
  function generate(m) {
    return {
      read: {
        "led/0/color": function (m) {
          // read characteristics like: m['180a']['2a29'].toString('ascii'))
          var a = m['9900']['9901'];
          return (a[2] << 16) + (a[1] << 8) + a[2];
        }
      },
      write: {
        "led/0/color": function (value, write) {
          // write characteristics like: write('180a/2a29', [ 0x10, 0x30 ])
          // note: value is string
          var v = Number(value);
          var r = v >> 16 & 0xff;
          var g = v >> 8 & 0xff;
          var b = v & 0xff;
          write('9900/9901', [ b, g, r, 0x00 ]);
        }
      }
    };
  }

  window.knownServices.register('9900', 'RGB LED Service', generate);
})();
