(function() {
  var templates = window.templates || {};
  window.templates = templates;

  Handlebars.registerHelper("showAssociate", function(identity, address) {
    return new Handlebars.SafeString(
      '<a href="#" class="associate" data-to="'
      + identity
      + '" data-address="' + address + '"> to '
      + identity + '</a>'
    );
  });
  Handlebars.registerHelper("showTx", function(txid) {
    return new Handlebars.SafeString(
      '<a href="https://insight.bitpay.com/tx/'
      + txid
      + '" target="_blank">'
      + txid.substr(0, 8) + '...' + txid.substr(txid.length - 4)
      + '</a>'
    );
  });
  Handlebars.registerHelper("showAddr", function(hash) {
    return new Handlebars.SafeString(
      '<a href="https://insight.bitpay.com/address/'
      + hash
      + '" target="_blank">'
      + hash.substr(0, 6) + '...' + hash.substr(hash.length - 4)
      + '</a>'
    );
  });
  Handlebars.registerHelper("shortAddr", function(text) {
    return text.substr(0, 6) + '...' + text.substr(text.length - 4);
  });
  Handlebars.registerHelper("shortTx", function(text) {
    return text.substr(0, 8) + '...' + text.substr(text.length - 4);
  });
  Handlebars.registerHelper("printSat", function(number) {
    var text = number + '';
    if (number < 1e3) {
      return text + ' satoshis';
    }
    if (number < 1e6) {
      return (
        text.substr(0, text.length-2) + '.' +
        text.substr(text.length-2) +
        ' bits'
      );
    }
    if (number < 1e9) {
      return (
        text.substr(0, text.length-5) + '.' +
        text.substr(text.length-5, 2) +
        ' mBTC'
      );
    }
    return (
      text.substr(0, text.length-8) + '.' +
      text.substr(text.length-8, 2) +
      ' BTC'
    );
  });
  Handlebars.registerHelper("printPercent", function(value) {
    return ('' + value).substr(0, 5);
  });

  ['identity', 'addresses'].forEach(function(name) {
    $.get("templates/" + name + ".handlebars", function(data) {
      templates[name] = Handlebars.compile(data);
    });
  });
  [
   'listAssociations',
   'incomingOptions',
   'transactionReport',
   'outgoingOptions'
  ].forEach(function(name) {
    $.get("templates/" + name + ".handlebars", function(data) {
      templates[name] = Handlebars.compile(data);
      Handlebars.registerPartial(name, templates[name]);
    });
  });
}());
