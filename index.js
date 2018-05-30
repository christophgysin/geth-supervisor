#!/usr/bin/env node

const log = require('bunyan-wrapper')('supervisor');
const supervisor = require('./src/supervisor');

Promise.resolve(supervisor())
  .catch(log.error);
