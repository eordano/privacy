/**
 * Strategies to identify change addresses and possible coinjoin transactions.
 *
 * @website moonlabs.io/privacy
 * @author eordano@moonlabs.io
 */

(function(undefined) {

  var listPossibleLargeSpend = function(opts) {
    var fraction = opts.threshold || 0.90;
    var graph = opts.graph;
    graph.transactions.forEach(function(transaction) {
      var outputTotal = 0;
      var identitiesInput = [];
      var addressesInput = [];
      graph._neighboursByType(transaction, 'tx input', function(_, address) {
        addressesInput.push(address.hash);
        graph._neighboursByType(address, 'ownership', function(_, identity) {
          identitiesInput.push(identity.name);
        });
      });
      graph._neighboursByType(transaction, 'tx output', function(edge, _) {
        outputTotal += edge.satoshis;
      });
      if (outputTotal > 0) {
        graph._neighboursByType(transaction, 'tx output', function(edge, address) {
          if (edge.satoshis / outputTotal > fraction) {
            var largeSpendData = {
              fraction:    edge.satoshis / outputTotal,
              percentage:  edge.satoshis / outputTotal * 100,
              spent:       edge.satoshis,
              total:       outputTotal,
              transaction: transaction.txid,
              addresses:   addressesInput,
              identities:  identitiesInput
            };
            address.metadata.strategy = address.metadata.strategy || {};
            address.metadata.strategy.largeSpend = largeSpendData;
          }
        });
      }
    });
  };

  var listPossibleFiatSpends = function(opts) {
  };

  var listPossibleSameAddressType = function(opts) {
    var graph = opts.graph;
    var execute = function(txType1, txType2) {
      graph.transactions.forEach(function(transaction) {
        var identities = [];
        var addresses = [];
        graph._neighboursByType(transaction, txType1, function(_, address) {
          addresses.push(address.hash);
          graph._neighboursByType(address, 'ownership', function(_, identity) {
            identities.push(identity.name);
          });
        });
        if (addresses.length !== 1 || identities.length !== 1) {
          return;
        }
        var original = addresses[0];
        var identity = identities[0];
        var same = false;
        var different = false;
        graph._neighboursByType(transaction, txType2, function(edge, address) {
          if (original.substr(0, 1) !== address.hash.substr(0, 1)) {
            different = true;
          } else {
            same = true;
          }
        });
        if (same && different) {
          graph._neighboursByType(transaction, txType2, function(edge, address) {
            if (original.substr(0, 1) === address.hash.substr(0, 1)) {
              var sameAddressData = {
                transaction: transaction.txid,
                address:     original,
                identity:    identity
              };
              address.metadata.strategy = address.metadata.strategy || {};
              address.metadata.strategy.sameAddressType = sameAddressData;
            }
          });
        }
      });
    };
    execute('tx input', 'tx output');
    execute('tx output', 'tx input');
  };

  var listPossibleCoinjoinTransactions = function(opts) {
    var graph = opts.graph;
    var threshold = opts.minimum || 12;
    graph.transactions.forEach(function(transaction) {
      var input = [];
      var output = [];
      graph._neighboursByType(transaction, 'tx input', function(_, address) {
        input.push(address.hash);
      });
      graph._neighboursByType(transaction, 'tx output', function(_, address) {
        output.push(address.hash);
      });
      if (input.length > threshold || output.length > threshold) {
        var coinjoinData = {
          inputs:  input.length,
          outputs: output.length,
          coinjoinProbable: true
        };
        transaction.metadata.strategy = transaction.metadata.strategy || {};
        transaction.metadata.strategy.coinjoinDetection = coinjoinData;
      }
    });
  };

  var listPossibleMergeOutputRoute = function(opts) {
  };

  privacy = window.privacy;
  privacy.strategy = {
    listPossibleLargeSpend: listPossibleLargeSpend,
    listPossibleSameAddressType: listPossibleSameAddressType,
    listPossibleCoinjoinTransactions: listPossibleCoinjoinTransactions,
  };

}());
