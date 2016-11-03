(function() {
  function generate(m) {
    var read = {
      'deviceinfo/0/manufacturer': function (m) {
        return m['180a']['2a29'].toString('ascii');
      },
      'deviceinfo/0/model-number': function (m) {
        return m['180a']['2a24'].toString('ascii');
      },
      'deviceinfo/0/serial-number': function (m) {
        return m['180a']['2a25'].toString('ascii');
      },
      'deviceinfo/0/hardware-revision': function (m) {
        return m['180a']['2a27'].toString('ascii');
      },
      'deviceinfo/0/firmware-revision': function (m) {
        return m['180a']['2a26'].toString('ascii');
      },
      'deviceinfo/0/software-revision': function (m) {
        return m['180a']['2a28'].toString('ascii');
      }
    };

    if (!m['180a']['2a29']) delete read['deviceinfo/0/manufacturer'];
    if (!m['180a']['2a24']) delete read['deviceinfo/0/model-number'];
    if (!m['180a']['2a25']) delete read['deviceinfo/0/serial-number'];
    if (!m['180a']['2a27']) delete read['deviceinfo/0/hardware-revision'];
    if (!m['180a']['2a26']) delete read['deviceinfo/0/firmware-revision'];
    if (!m['180a']['2a28']) delete read['deviceinfo/0/software-revision'];

    return { read: read };
  }

  window.knownServices.register('180a', 'Device information service', generate);
})();
