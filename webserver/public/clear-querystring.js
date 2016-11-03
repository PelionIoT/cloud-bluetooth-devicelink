(function() {
  // I use querystring to show notifications,
  // it's annoying when you refresh that the banner will be there again...
  // so this clears the querystring...

  if (window.history.replaceState) {
    window.history.replaceState({} , window.title, (window.location + '').replace(window.location.search, ''));
  }
  
  [].forEach.call(document.querySelectorAll('.notification'), function(n) {
    n.onclick = function() {
      n.classList.add('hide');
    };
    
    setTimeout(function() {
      n.classList.add('hide');
    }, 5000);
  });

})();
