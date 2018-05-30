const AWS = require('aws-sdk');
const request = require('request-promise-native');
const log = require('bunyan-wrapper')('supervisor:alb');

class ALB {
  constructor(targetGroupArn, port) {
    this.targetGroupArn = targetGroupArn;
    this.port = port;
    this.registered = false;
    this.elbv2 = new AWS.ELBv2({ apiVersion: '2015-12-01' });
  }

  async getParams() {
    if (this.params) {
      return this.params;
    }
    const instanceId = await request('http://169.254.169.254/latest/meta-data/instance-id');
    this.params = {
      TargetGroupArn: this.targetGroupArn,
      Targets: [
        {
          Id: instanceId,
          Port: this.port,
        },
      ],
    };

    return this.params;
  }

  async register() {
    if (this.registered) {
      return;
    }

    const params = await this.getParams();
    log.info('Registering port %s with ALB %s', this.port, this.targetGroupArn);
    try {
      await this.elbv2.registerTargets(params).promise();
      log.info('Successfully registered');
      this.registered = true;
    } catch (error) {
      log.error('Registration failed! (%s)', error.message);
    }
  }

  async deregister() {
    if (!this.registered) {
      return;
    }

    const params = await this.getParams();
    log.info('Deregistering port %s from ALB %s', this.port, this.targetGroupArn);
    try {
      await this.elbv2.deregisterTargets(params).promise();
      log.info('Successfully deregistered');
      this.registered = false;
    } catch (error) {
      log.error('Deregistration failed! (%s)', error.message);
    }
  }
}

module.exports = {
  ALB,
};
