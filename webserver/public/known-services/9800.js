(function() {
  function generate(m) {
    return {
      read: {
        "3347/0/5501": function (m) {
          // Total button count
          return m['9800']['9801'][0];
        }
      }
    };
  }

  window.knownServices.register('9800', 'Button Counter Service', generate);
})();
