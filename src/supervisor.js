const { Geth } = require('./geth');
const { ALB } = require('./alb');
const log = require('bunyan-wrapper')('supervisor');

const { TARGET_GROUP_ARN } = process.env;
const POLL_INTERVAL = process.env.POLL_INTERVAL || 10000;
const GETH_ADDRESS = process.env.GETH_ADDRESS || 'localhost';
const GETH_PORT = process.env.GETH_PORT || '8545';
const GETH_RPC_URL = `http://${GETH_ADDRESS}:${GETH_PORT}`;

const geth = new Geth(GETH_RPC_URL);
const alb = new ALB(TARGET_GROUP_ARN, GETH_PORT);

const isSynced = async () => {
  let peers;

  try {
    peers = await geth.getPeers();
  } catch (error) {
    log.error('failed to get peers (%s)', error.message);
    return false;
  }

  if (peers < 3) {
    log.info('peers:', peers);
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

process.once('SIGTERM', () => {
  alb.deregister()
    .then(process.exit);
});

const sleep = ms => new Promise(done => setTimeout(done, ms));

const supervisor = async () => {
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
