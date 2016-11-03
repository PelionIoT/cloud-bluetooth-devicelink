(function() {
  function generate(m) {
    var model = {
      read: {
        "mbedGarden/0/temperature": function (m) {
            var tempArray = m['da7ec78bfe9c116b6e9e151fb040f0a4']['e053ef720fcd5e97b7edec010bef4d27'];
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        },
        "mbedGarden/0/humidity": function (m) {
            var tempArray = m['da7ec78bfe9c116b6e9e151fb040f0a4']['4ed5adc4f6ab5e52857d2d3854e081d3'];
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        },
        "mbedGarden/0/ambientLight": function (m) {
            var tempArray = m['da7ec78bfe9c116b6e9e151fb040f0a4']['f671e6ba85205e398b03afc9f55ba42b'];
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        },
        "mbedGarden/0/soilMoisture": function (m) {
            var tempArray = m['da7ec78bfe9c116b6e9e151fb040f0a4']['a9f3fa17ed7a5ac9a9f12b0ad3fa201f'];
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            var wetness = (0.8083953857421875 - dv.getFloat32(0)) / (0.8083953857421875 - 0.3910064697265625);
            return wetness;
        },
        "mbedGarden/0/soilResistance": function (m) {
            var tempArray = m['da7ec78bfe9c116b6e9e151fb040f0a4']['695bdc56e39c53cda43a4aaded7291eb'];
            var buffer = new ArrayBuffer(4);
            var intView = new Uint32Array(buffer);
            intView[0] = 0;
            for (var i = 0; i < 3; i++) {
                intView[0] += tempArray[3 - i] << (i * 8);
            }
            var dv = new DataView(buffer);
            return dv.getFloat32(0);
        }
      },
      write: {
      }
    };
    return model;
  }

  window.knownServices.register('da7ec78bfe9c116b6e9e151fb040f0a4', 'mbed Garden monitoring service', generate);
})();
