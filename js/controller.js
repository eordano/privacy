/**
 * Link behaviour to DOM elements of the privacy explorer
 */

$(function() {

  var privacy = window.privacy;

  var inputField = $('#command_line');
  var inputButton = $('#submit');
  var resultsDiv = $('#results');
  var logDiv = $('#log');
  var helpDiv = $('#help');

  resultsDiv.hide();
  logDiv.hide();

  var debug = true;

  function log(message) {
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    logDiv.append(message + '<br>');
  }

  var applyStrategies = function() {
    privacy.strategy.listPossibleLargeSpend({
      graph: graph
    });
    privacy.strategy.listPossibleSameAddressType({
      graph: graph
    });
    privacy.strategy.listPossibleCoinjoinTransactions({
      graph: graph
    });
  };

  var redraw = function() {
    inputField.val('');
    applyStrategies();
    updateResults();
    resultsDiv.show();
    if (debug) {
      logDiv.show();
    }
  };

  var graph = new privacy.Graph({});

  var addAddress = function(input) {
    if (input[0] === 'address') {
      // TODO: Check base58
      graph.addAddress(input[1]);
      privacy.operations.expand({
        graph:   graph,
        address: input[1],
        callback: redraw
      });
      return true;
    }
  };

  var addIdentity = function(input) {
    if (input[0] === 'identity') {
      graph.addIdentity({
        name: input[1]
      });
      return true;
    }
  };

  var doAssociate = function(address, identity) {
      graph.associateAddress({
        address:  address,
        identity: identity
      });
      privacy.operations.expand({
        graph:   graph,
        address: address,
        callback: redraw
      });
  };

  var associate = function(input) {
    if (input[0] === 'associate') {
      doAssociate(input[1], input[3]);
      return true;
    }
  };

  var expand = function(input, callback) {
    if (input[0] === 'expand') {
      privacy.operations.expand({
        graph:   graph,
        address: input[1],
        callback: redraw
      });
      return true;
    }
  };

  var help = function(input) {
    if (input[0] === 'help') {
      helpDiv.show();
      return true;
    }
  };

  var allFunctions = [addAddress, addIdentity, associate, expand, help];
  window.graphFunctions = allFunctions;

  var applyListeners = function(selectedElements) {
    selectedElements.find('.expand').click(function(ev) {
      privacy.operations.expand({
        graph:   graph,
        address: $(ev.target).attr('data-address'),
        callback: redraw
      });
      ev.preventDefault();
    });
    selectedElements.find('.associate').click(function(ev) {
      doAssociate(
        $(ev.target).attr('data-address'),
        $(ev.target).attr('data-to')
      );
      ev.preventDefault();
    });
    selectedElements.find('.associate-select').click(function(ev) {
      var address = $(ev.target).attr('data-address');
      var to = $(ev.target).prev().val();
      doAssociate(address, to);
      ev.preventDefault();
    });
  };

  var updateResults = function() {
    var resultHtml = '';
    // TODO: Add info about inferred stuff
    // TODO: Cache this

    var seenAddresses = [];
    var isSeen = function(address) {
      var retVal = false;
      seenAddresses.forEach(function(a) {
        if (a === address) { retVal = true; }
      });
      return retVal;
    };
    graph.identities.forEach(function(identity) {
      var context = graph.calculateIdentityReport(identity);
      var raw = templates.identity(context);
      context.known_addresses.forEach(function(known) {
        seenAddresses.push(known.hash);
      });
      resultHtml += raw;
    });
    var unknown = [];
    graph.addresses.forEach(function(address) {
      if (!isSeen(address.hash)) {
        unknown.push(address);
      }
    });
    var unknownReport = graph.calculateAddressesReport(unknown);
    resultHtml += templates.addresses({addresses: unknownReport});
    var elements = $(resultHtml);
    applyListeners(elements);
    resultsDiv.children().remove();
    resultsDiv.append(elements);
  };

  var process = function(info) {
    var change = false;
    allFunctions.forEach(function(f) {
     change = change || f(info);
    });

    return change;
  };

  var processInput = function() {
    var info = inputField.val().replace(/[\t ]+/gi, ' ').split(' ');
    helpDiv.hide();

    // Update display
    if (process(info)) {
      redraw();
    }
  };

  var processEvent = function(ev) {
    if(ev.which == 13) {
      processInput();
    }
  };

  inputButton.click(processInput);
  inputButton.keypress(processEvent);
  inputField.keypress(processEvent);

  if (debug) {
    [
      'address 1M2cjVxx117834dEtTJxC2TWPRq6vPmZ3P',
      'address 17VEQ7mEKWSgSTYJMjJ2Bj8WdYQFvviKh4',
      'identity Jack',
      'identity John',
      'associate 32JFzr9TMJg7zESusnzRhvifc2C7kMfCT8 to Jack',
      'associate 17VEQ7mEKWSgSTYJMjJ2Bj8WdYQFvviKh4 to John',
    ].forEach(function(s) {
      process(s.split(' '));
    });
    redraw();
  }
});
