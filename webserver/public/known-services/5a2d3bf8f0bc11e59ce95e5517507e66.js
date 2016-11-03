(function() {
  function generate(m) {
    var model = {
      read: {
        'light/0/value': function(m) {
          var c = m['5a2d3bf8f0bc11e59ce95e5517507e66']['5a2d4378f0bc11e59ce95e5517507e66'];
          return (c[0] << 8) + (c[1] || 0);
        },
        'led/0/rgb': function(m) {
          var c = m['5a2d3bf8f0bc11e59ce95e5517507e66']['5a2d429cf0bc11e59ce95e5517507e66'];
          return (c[0] << 16) + (c[1] << 8) + c[0];
        }
      },
      write: {
        'led/0/rgb': function(value, write) {
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
