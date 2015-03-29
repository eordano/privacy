/**
 * Model a graph showing addresses, identities associated with those addresses,
 * and transactions associating addresses.
 *
 * @website moonlabs.io/privacy
 * @author eordano@moonlabs.io
 */

(function(undefined) {

var Address = function(opts) {
  this.id = opts.id || nameAddress(opts.hash);
  this.type = 'address';
  this.hash = opts.hash;
  this.metadata = {};
};

Address.prototype.addMetadata = function(opts) {
  for (key in opts) {
    if (opts.hasOwnProperty(key)) {
      this.metadata[key] = opts[key];
    }
  };
};

var Identity = function(opts) {
  this.id = opts.id;
  this.type = 'identity';
  this.name = opts.name || 'Unknown identity';
  this.extra = opts.extra;
};

var Transaction = function(opts) {
  this.id = opts.id || nameTransaction(opts.txid);
  this.txid = opts.txid;
  this.type = 'transaction';
  this.date = opts.date;
  this.blockhash = opts.blockhash;
  this.metadata = {};
};

var Edge = function(opts) {
  this.id = opts.id || nameEdge(opts.fromId, opts.toId);
  this.fromId = opts.fromId;
  this.toId = opts.toId;
  this.type = opts.type;
  this.satoshis = opts.satoshis;
  this.annotations = opts.annotations;
};

var Graph = function() {
  // Arrays with all the nodes sorted by type
  this.addresses = [];
  this.identities = [];
  this.transactions = [];

  // More info
  this.edges = [];
  this.listeners = [];

  // Some duplicated information here for faster lookups

  // Helps lookups of nodes by id
  this.nodes = {};
  this.addressLookup = {};

  // Helps lookups of nodes by edge
  this.edgesByNodeId = {};
};


var nameIdentity = function(identity) {
  return 'Identity_' + identity;
};

var nameAddress = function(address) {
  return 'Address_' + address;
};

var nameTransaction = function(txId) {
  return 'Transaction_' + txId;
};

var nameEdge = function(from, to) {
  return 'Edge_' + from + '_' + to;
};

/**
 * Get a node of a graph by id
 */
Graph.prototype.getNode = function(id) {
  return this.nodes[id];
};

/**
 * Get a node of an address by transaction hash
 */
Graph.prototype.getAddressNode = function(hash) {
  return this.nodes[nameAddress(hash)];
};

/**
 * Get an identity by address
 */
Graph.prototype.getIdentityByAddress = function(address) {
  var retVal = null;
  var addressNode = this.addressLookup[address];
  var that = this;
  if (!addressNode) {
    return null;
  }
  this.edgesByNodeId[addressNode.id].forEach(function(edge) {
    var otherEnd = edge.from;
    if (otherEnd === addressNode.id) {
      otherEnd = edge.to;
    }
    var otherNode = that.nodes[otherEnd];
    if (otherNode.type === 'identity') {
      retVal = otherNode;
    }
  });
  return retVal;
};

Graph.prototype.getTransactionById = function(txid) {
  return this.nodes[nameTransaction(txid)];
};

/**
 * Helper method to notify all listeners of an event
 */
Graph.prototype.notifyListeners = function(method, args) {
  this.listeners.forEach(function(listener) {
    if (listener[method]) {
      listener[method].apply(listener, args);
    } else {
      console.log('Listener had no ' + method + ' method.');
    }
  });
};

/**
 * Add a new address to the graph. If the address exists, does nothing.
 * This triggers a listener event of type 'addressAdded' otherwise.
 *
 * @param address [String] the address to add to the graph
 */
Graph.prototype.addAddress = function(address) {
  var exists = this.addressLookup[address] !== undefined;
  if (!exists) {
    var node = new Address({
      hash: address
    });
    this.addresses.push(node);
    this.nodes[node.id] = node;
    this.addressLookup[address] = node;
    this.edgesByNodeId[node.id] = [];
    this.notifyListeners('onAddressAdded', [node]);
  }
};

/**
 * Adds information from a transaction to the graph.
 *
 * Triggers the following events for listeners:
 *   - onClusterAdded(cluster): for each new address created that was not
 *       already in a cluster in the graph.
 *   - onTransactionAdded(transaction): only once, before adding the edges
 *   - onEdgeCreated(edge): for each edge from/to this new transaction
 *   - onFinishedAdding(): when all edges and nodes where added to the graph
 *
 * @param transactionRaw Object the info for this transaction:
 * {
 *   'txid': (a String, the transaction id),
 *   'vin': (an Array of objects with the following keys:
 *     addr: (a String, the address of the input),
 *     valueSat: (a Number with the amount of satoshis of the output)
 *   ),
 *   'vout': (an Array of Object with the keys:
 *     value: (a Number with the amount of Bitcoins sent),
 *     scriptPubKey: (an Object with the following keys:
 *       addresses: (an Array with Strings, the addresses of the output),
 *     )
 *   ),
 *   'blockhash': (a String, the block that confirmed this transaction),
 *   'time': (a Number, millis since UNIX epoch the transaction was processed)
 * }
 */
Graph.prototype.processTransaction = function(transactionRaw) {
  var that = this;

  if (this.getNode(nameTransaction(transactionRaw.txid))) {
    return;
  }

  // Create clusters that don't exist yet
  transactionRaw.vin.forEach(function(vin) {
    that.addAddress(vin.addr);
  });
  transactionRaw.vout.forEach(function(vout) {
    vout.scriptPubKey.addresses.forEach(function(addr) {
      that.addAddress(addr);
    });
  });

  // Create transaction node
  var txName = nameTransaction(transactionRaw.txid);
  var transaction = new Transaction({
    id:        txName,
    txid:      transactionRaw.txid,
    date:      transactionRaw.time,
    blockhash: transactionRaw.blockhash
  });
  this.transactions.push(transaction);
  this.nodes[transaction.id] = transaction;
  this.edgesByNodeId[transaction.id] = [];
  this.notifyListeners('onTransactionAdded', [transaction]);

  // Create edges between addresses and this transaction
  var createEdge = function(edgeName, from, to, type, value) {
    var edge = new Edge({
      id:       edgeName,
      fromId:   from,
      toId:     to,
      type:     type,
      satoshis: value
    });
    that.edges.push(edge);
    that.edgesByNodeId[from].push(edge);
    that.edgesByNodeId[to].push(edge);
    that.notifyListeners('onEdgeAdded', [edge]);
  };
  transactionRaw.vin.forEach(function(vin) {
    var targetName = nameAddress(vin.addr);
    var edgeName = nameEdge(targetName, txName);
    createEdge(edgeName, targetName, txName, 'tx input', vin.valueSat);
  });
  transactionRaw.vout.forEach(function(vout) {
    var targetName = nameAddress(vout.scriptPubKey.addresses[0]);
    var edgeName = nameEdge(txName, targetName);
    createEdge(edgeName, txName, targetName, 'tx output', vout.value * 1e8);
  });
  this.notifyListeners('onFinishedAdding', []);
};

/**
 * Add an identity to the graph
 */
Graph.prototype.addIdentity = function(opts) {
  var name = nameIdentity(opts.name);
  var exists = this.getNode(name);
  if (!exists) {
    var node = new Identity({
      id: name,
      name: opts.name
    });
    this.identities.push(node);
    this.nodes[name] = node;
    this.edgesByNodeId[name] = [];
    this.notifyListeners('onIdentityAdded', [node]);
  }
}

/**
 * Associate an address with an identity
 */
Graph.prototype.associateAddress = function(opts) {
  var addressNode = this.getNode(nameAddress(opts.address));
  var identityNode = this.getNode(nameIdentity(opts.identity));
  if (!addressNode || !identityNode) {
    // TODO: Raise error
    return;
  }
  var edge = new Edge({
    fromId: identityNode.id,
    toId: addressNode.id,
    type: 'ownership',
    annotations: opts.annotations
  });
  this.edges.push(edge);
  this.edgesByNodeId[identityNode.id].push(edge);
  this.edgesByNodeId[addressNode.id].push(edge);
};

Graph.prototype.calculateAddressesReport = function(addresses) {
  var result = [];
  var that = this;
  addresses.forEach(function(address) {
    result.push(that.calculateAddressReport({
      address: address
    }));
  });
  return result;
};

Graph.prototype.calculateAddressReport = function(opts) {
  var that = this;
  var outgoing = opts.outgoing || [];
  var incoming = opts.incoming || [];
  var retVal = {};
  var address = opts.address;
  var identity = opts.identity;

  retVal.hash = address.hash;
  retVal.annotations = opts.annotations;
  retVal.expanded = address.metadata.expanded;

  var fillIn = function(edgeType1, edgeType2, bucket) {
    that._neighboursByType(address, edgeType1, function(edge1, tx) {
      that._neighboursByType(tx, edgeType2, function(edge2, other) {
        var otherIdentity = null;
        that._neighboursByType(other, 'ownership', function(edge3, id) {
          otherIdentity = id;
        });
        if (opts.filter) {
          if (opts.filter(address, edge1, tx, edge2, other, otherIdentity)) {
            return;
          }
        }
        bucket.push({
          satoshis:    edge2.satoshis,
          linked:      address.hash,
          address:     other.hash,
          current:     identity,
          other_ids:   that.identities,
          tx:          tx.txid,
          tx_metadata: tx.metadata,
          metadata:    other.metadata,
          expanded:    other.metadata.expanded,
          identity:    otherIdentity ? otherIdentity.name : ''
        });
      });
    });
  };
  fillIn('tx output', 'tx input', incoming);
  fillIn('tx input', 'tx output', outgoing);

  if (!opts.incoming) retVal.incoming = incoming;
  if (!opts.outgoing) retVal.outgoing = outgoing;
  return retVal;
};

Graph.prototype._neighboursByType = function(element, type, callback) {
  if (!element || !this.edgesByNodeId[element.id]) {
    return;
  }
  var that = this;
  this.edgesByNodeId[element.id].forEach(function(edge) {
    if (edge.type === type) {
      callback(edge, that._getOther(element, edge));
    }
  });
};

Graph.prototype._getOther = function(element, edge) {
  var otherId = (edge.fromId === element.id) ? edge.toId : edge.fromId;
  return this.getNode(otherId);
};


Graph.prototype.calculateIdentityReport = function(identity) {
  var that = this;

  var ret = {
    name: identity.name,
    known_addresses: [],
    incoming:        [],
    outgoing:        []
  };
  var addresses = {};
  var addressesArray = [];

  // Fill in the known addresses
  this._neighboursByType(identity, 'ownership', function(edge, addressNode) {
    addressesArray.push(addressNode);
    addresses[addressNode.id] = {
      hash:        addressNode.hash,
      annotations: edge.annotations,
    };
  });

  // Populate with transaction and neighbours info
  addressesArray.forEach(function(address) {
    ret.known_addresses.push(
      that.calculateAddressReport({
        address:  address,
        incoming: ret.incoming,
        outgoing: ret.outgoing,
        identity: identity,
        filter: function(address, edge1, tx, edge2, other, otherIdentity) {
          return (otherIdentity && otherIdentity.id === identity.id) ? true : false;
        }
      })
    );
  });

  return ret;
};

var privacy = {
  Address: Address,
  Identity: Identity,
  Transaction: Transaction,
  Edge: Edge,
  Graph: Graph
};

window.privacy = privacy;

}())
