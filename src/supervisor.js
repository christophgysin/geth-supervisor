const { Geth } = require('./geth');
const { ALB } = require('./alb');
const log = require('bunyan-wrapper')('supervisor');

const { TARGET_GROUP_ARN } = process.env;
const POLL_INTERVAL = process.env.POLL_INTERVAL || 10000;
const GETH_ADDRESS = process.env.GETH_ADDRESS || 'localhost';
const GETH_PORT = process.env.GETH_PORT || '8545';
const GETH_RPC_URL = `http://${GETH_ADDRESS}:${GETH_PORT}`;

// minimum number of peers needed
const MINIMUM_PEERS = process.env.MINIMUM_PEERS || 3;

// register if this many peers
const REGISTER_PEERS = MINIMUM_PEERS + 1;
// deregister if falling below this many peers
const DEREGISTER_PEERS = MINIMUM_PEERS;

const geth = new Geth(GETH_RPC_URL);
const alb = new ALB(TARGET_GROUP_ARN, GETH_PORT);

let synced = false;

const isSynced = async () => {
  let peers;

  try {
    peers = await geth.getPeers();
  } catch (error) {
    log.error('failed to get peers (%s)', error.message);
    return false;
  }

  const minPeerCount = synced ? DEREGISTER_PEERS : REGISTER_PEERS;

  if (peers < minPeerCount) {
    log.info('peers:', peers);
    synced = false;
    return false;
  }

  let state;
  try {
    state = await geth.getSyncState();
  } catch (error) {
    log.error('failed to get state (%s)', error.message);
    return false;
  }

  if (state === false) {
    synced = true;
    return true;
  }

  Object.keys(state).forEach((key) => {
    state[key] = parseInt(state[key], 16);
  });

  const statesToGo = state.knownStates - state.pulledStates;
  const blocksDone = state.currentBlock - state.startingBlock;
  const blocksToDo = state.highestBlock - state.startingBlock;
  const blocksToGo = blocksToDo - blocksDone;
  const blocksPercent = Math.floor((100 * blocksDone) / blocksToDo);

  log.info('syncing: peers: %s, blocks: %s%% (%s), states: %s',
    peers, blocksPercent, blocksToGo, statesToGo);

  return false;
};

const sleep = ms => new Promise(done => setTimeout(done, ms));

const supervisor = async () => {
  const args = process.argv.slice(2);
  geth.spawn(args, () => alb.deregister());

  process.once('SIGTERM', () => {
    log.debug('got SIGTERM, shutting down');
    alb.deregister()
      .then(() => {
        geth.terminate();
        process.exit(0);
      });
  });

  /* eslint-disable no-await-in-loop,no-constant-condition */
  while (true) {
    while (!(await isSynced())) {
      await sleep(POLL_INTERVAL);
    }
    log.info('sync complete');
    await alb.register();

    while (await isSynced()) {
      await sleep(POLL_INTERVAL);
    }
    log.info('out of sync');
    await alb.deregister();
  }
};

module.exports = supervisor;
