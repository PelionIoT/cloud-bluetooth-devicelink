(function() {
  function generate(m) {
    var read = {
      '3/0/0': function (m) {
        return m['180a']['2a29'].toString('ascii');
      },
      '3/0/1': function (m) {
        return m['180a']['2a24'].toString('ascii');
      },
      '3/0/2': function (m) {
        return m['180a']['2a25'].toString('ascii');
      },
      '3/0/18': function (m) {
        return m['180a']['2a27'].toString('ascii');
      },
      '3/0/3': function (m) {
        return m['180a']['2a26'].toString('ascii');
      },
      '3/0/19': function (m) {
        return m['180a']['2a28'].toString('ascii');
      }
    };

    if (!m['180a']['2a29']) delete read['3/0/0'];
    if (!m['180a']['2a24']) delete read['3/0/1'];
    if (!m['180a']['2a25']) delete read['3/0/2'];
    if (!m['180a']['2a27']) delete read['3/0/18'];
    if (!m['180a']['2a26']) delete read['3/0/3'];
    if (!m['180a']['2a28']) delete read['3/0/19'];

    return { read: read };
  }

  window.knownServices.register('180a', 'Device information service', generate);
})();
