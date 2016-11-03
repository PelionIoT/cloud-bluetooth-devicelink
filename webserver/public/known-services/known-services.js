(function() {
  /*global js_beautify */

  var KnownServices = function() {
    this.registry = {};
  };

  KnownServices.prototype.register = function(uuid, name, generate) {
    if (this.registry[uuid]) {
      throw 'Already a service in the registry with uuid "' + uuid + '"';
    }
    this.registry[uuid] = {
      name: name,
      generate: generate
    };
  };

  /**
   * Pass in a GATT model, and get the known services back as an array of strings
   */
  KnownServices.prototype.getServicesAsString = function(gatt) {
    var self = this;
    var gattKeys = Object.keys(gatt);

    var res = Object.keys(this.registry).filter(function(uuid) {
      return gattKeys.indexOf(uuid) > -1;
    }).map(function(uuid) {
      return uuid + ' - ' + self.registry[uuid].name;
    });

    if (res.length === 0) {
      res = [ 'No known services found' ];
    }

    return res;
  };

  /**
   * Pass in a GATT model and get a read/write model back
   * @return Object with keys { read, write } which contains a string to pass into Ace
   */
  KnownServices.prototype.generateModel = function(gatt) {
    var self = this;
    var gattKeys = Object.keys(gatt);

    var rules = Object.keys(this.registry).filter(function(uuid) {
      return gattKeys.indexOf(uuid) > -1;
    }).map(function(uuid) {
      return self.registry[uuid].generate(gatt);
    });

    rules = rules.reduce(function(curr, rule) {
      // rule has { read, write }
      if (rule.read) {
        Object.keys(rule.read).forEach(function(k) {
          curr.read[k] = rule.read[k];
        });
      }
      if (rule.write) {
        Object.keys(rule.write).forEach(function(k) {
          curr.write[k] = rule.write[k];
        });
      }
      return curr;
    }, { read: [], write: [] });

    function map(obj) {
      var s = '{\n';

      s += Object.keys(obj).map(function(k) {
        return "'" + k + "': " + obj[k].toString();
      }).join(',\n');

      s += '}';

      return js_beautify(s);
    }

    // @todo formatting and whitespace etc.
    return {
      read: map(rules.read),
      write: map(rules.write)
    };
  };

  window.knownServices = new KnownServices();
})();
