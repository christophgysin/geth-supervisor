# geth-supervisor

Supervises an Ethereum client for running it in AWS ECS.

## Features

* Waits for synchronization to complete before registering
with AWS Application Load Balancer.
* Deregisters from ALB if client goes out of sync.
* Deregisters from ALB if container is shutting down.

## Configuration

Following environment variables can be configured:

| variable         | required | default   | description    |
| ---------------- | -------- | --------- | -------------- |
| AWS_REGION       |    x     |           |                |
| GETH_ADDRESS     |          | localhost |                |
| GETH_PORT        |          | 8545      |                |
| TARGET_GROUP_ARN |    x     |           |                |
| POLL_INTERVAL    |          | 10000     | Interval in ms |
| LOG_LEVEL        |          | info      |                |
