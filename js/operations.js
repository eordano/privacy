/**
 * Operations that add data to a graph
 *
 * @website moonlabs.io/privacy
 * @author eordano@moonlabs.io
 */

(function(undefined) {

  var INSIGHT_TXS_URL = 'https://insight.bitpay.com/api/txs?address=<addr>';

  var expand = function(opts) {
    var address = opts.address;
    var graph = opts.graph;
    var url = INSIGHT_TXS_URL.replace('<addr>', address);

    $.get(url, function(data) {
      data.txs.forEach(function(txData) {
        graph.processTransaction(txData);
        graph.getAddressNode(address).addMetadata({
          expanded: true
        });
        opts.callback(graph);
      });
    });
  };

  privacy.operations = privacy.operations || {};
  privacy.operations.expand = expand;

}());
