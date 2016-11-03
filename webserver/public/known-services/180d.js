(function() {
  function generate(m) {
    return {
      read: {
        'heartrate/0/value': function (m) {
          return (m['180d']['2a37'][0] << 8) + m['180d']['2a37'][1];
        },
        'heartrate/0/location': function (m) {
          switch (m['180d']['2a38'][0]) {
            case 0:	return 'Other';
            case 1:	return 'Chest';
            case 2:	return 'Wrist';
            case 3:	return 'Finger';
            case 4:	return 'Hand';
            case 5:	return 'Ear Lobe';
            case 6:	return 'Foot';
            default: return 'Unknown';
          }
        }
      }
    };
  }

  window.knownServices.register('180d', 'Heart rate service', generate);
})();
