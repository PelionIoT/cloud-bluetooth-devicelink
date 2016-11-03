(function() {
  function generate(m) {
    return {
      read: {
        "button/0/count": function (m) {
          return m['9800']['9801'][0];
        }
      }
    };
  }

  window.knownServices.register('9800', 'Button Counter Service', generate);
})();
