const request = require('request-promise-native');
const log = require('bunyan-wrapper')('supervisor:geth');

class Geth {
  constructor(url) {
    this.url = url;
  }

  callRpc(method, params = []) {
    return request({
      method: 'POST',
      uri: this.url,
      json: {
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      },
    });
  }

  getPeers() {
    log.debug('getting peers');
    return this.callRpc('net_peerCount')
      .then(response => parseInt(response.result, 16));
  }

  getSyncState() {
    log.debug('getting state');
    return this.callRpc('eth_syncing')
      .then(response => response.result);
  }
}

module.exports = {
  Geth,
};
