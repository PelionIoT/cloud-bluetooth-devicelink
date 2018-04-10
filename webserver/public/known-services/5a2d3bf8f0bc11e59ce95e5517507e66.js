(function() {
  function generate(m) {
    var model = {
      read: {
        '3300/0/5501': function(m) {
          // Light sensor
          var c = m['5a2d3bf8f0bc11e59ce95e5517507e66']['5a2d4378f0bc11e59ce95e5517507e66'];
          return (c[0] << 8) + (c[1] || 0);
        },
        '3311/0/5706': function(m) {
          // RGB LED
          var c = m['5a2d3bf8f0bc11e59ce95e5517507e66']['5a2d429cf0bc11e59ce95e5517507e66'];
          return (c[0] << 16) + (c[1] << 8) + c[0];
        }
      },
      write: {
        '3311/0/5706': function(value, write) {
          // RGB LED
          var val = Number(value);
          var buffer = [165, 255, val >> 16 & 0xff, val >> 8 & 0xff, val & 0xff];
          write('5a2d3bf8f0bc11e59ce95e5517507e66/5a2d40eef0bc11e59ce95e5517507e66', buffer);
        }
      }
    };
    return model;
  }

  window.knownServices.register('5a2d3bf8f0bc11e59ce95e5517507e66', 'Red Bear Labs RGB service', generate);
})();
