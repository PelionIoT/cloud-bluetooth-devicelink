(function() {
  function generate(m) {
    return {
      read: {
        '3346/0/5700': function (m) {
          // Current heart rate
          return (m['180d']['2a37'][0] << 8) + m['180d']['2a37'][1];
        },
        '3346/0/5750': function (m) {
          // Location
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
