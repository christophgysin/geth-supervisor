const request = require('request-promise-native');
const log = require('bunyan-wrapper')('supervisor:geth');
const { spawn } = require('child_process');

class Geth {
  constructor(url) {
    this.url = url;
  }

  async spawn(args, onshutdown) {
    this.child = spawn('geth', args);

    // eslint-disable-next-line no-console
    this.child.stdout.on('data', data => console.log(data.toString().trim()));
    // eslint-disable-next-line no-console
    this.child.stderr.on('data', data => console.log(data.toString().trim()));

    this.child.on('close', async (code) => {
      log.error(`child process exited with code ${code}`);
      await onshutdown();
      process.exit(code);
    });
  }

  terminate() {
    this.child.kill('SIGTERM');
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
