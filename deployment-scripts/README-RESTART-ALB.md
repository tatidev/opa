# ALB Node Restart Script

## Overview
The `restart-alb-nodes.sh` script automatically finds your OPMS API ALB nodes and restarts the application on each one to pick up code updates.

## Prerequisites

### 1. AWS CLI Setup
```bash
# Install AWS CLI if not already installed
brew install awscli  # macOS
# or
sudo apt install awscli  # Ubuntu

# Configure AWS credentials
aws configure --profile default
```

### 2. SSH Key Setup
Place your SSH private key at `~/.ssh/opuzen-key.pem` or set `SSH_KEY_PATH`:
```bash
# Copy your key to the default location
cp /path/to/your-key.pem ~/.ssh/opuzen-key.pem
chmod 400 ~/.ssh/opuzen-key.pem

# OR set custom path
export SSH_KEY_PATH="/path/to/your-custom-key.pem"
```

### 3. Install jq (JSON processor)
```bash
# macOS
brew install jq

# Ubuntu
sudo apt install jq
```

## Usage

### Basic Usage
```bash
# Restart dev environment (default)
./scripts/restart-alb-nodes.sh

# Restart specific environment
./scripts/restart-alb-nodes.sh dev
./scripts/restart-alb-nodes.sh qa
./scripts/restart-alb-nodes.sh prod
```

### With Custom Settings
```bash
# Use specific AWS profile
AWS_PROFILE=myprofile ./scripts/restart-alb-nodes.sh dev

# Use specific SSH key
SSH_KEY_PATH=~/my-key.pem ./scripts/restart-alb-nodes.sh dev

# Use specific AWS region
AWS_REGION=us-east-1 ./scripts/restart-alb-nodes.sh dev
```

## What the Script Does

1. **Finds ALB Instances** - Uses AWS CLI to find healthy instances in the target group
2. **Connects via SSH** - Uses your SSH key to connect to each instance
3. **Updates Code** - Pulls latest code from the deployDev branch
4. **Fixes Permissions** - Ensures proper file ownership
5. **Installs Dependencies** - Runs npm install
6. **Restarts App** - Kills old process and starts new one
7. **Verifies Success** - Checks that the app is running and healthy

## Example Output

```
[INFO] Starting ALB app restart for environment: dev
[INFO] Using AWS profile: default
[INFO] SSH key: ~/.ssh/opuzen-key.pem
[INFO] Checking prerequisites...
[SUCCESS] Prerequisites check passed
[INFO] Getting ALB instances for target group: TG-OPMS-API-DEV
[INFO] Found 2 instance(s) to restart
[INFO] Processing instance 1 of 2: i-1234567890abcdef0
[INFO] Restarting app on: i-1234567890abcdef0 (OPMS-API-Node-1) at 52.8.123.45
[SUCCESS] Successfully restarted app on i-1234567890abcdef0
[INFO] Waiting 5 seconds before next restart...
[INFO] Processing instance 2 of 2: i-0987654321fedcba0
[INFO] Restarting app on: i-0987654321fedcba0 (OPMS-API-Node-2) at 52.8.123.46
[SUCCESS] Successfully restarted app on i-0987654321fedcba0
[INFO] Restart summary:
[INFO]   Total instances: 2
[INFO]   Successful: 2
[INFO]   Failed: 0
[SUCCESS] All app restarts completed successfully!
```

## Troubleshooting

### AWS CLI Issues
```bash
# Test AWS connection
aws sts get-caller-identity

# List available profiles
aws configure list-profiles

# Use specific profile
export AWS_PROFILE=myprofile
```

### SSH Issues
```bash
# Test SSH connection
ssh -i ~/.ssh/opuzen-key.pem ubuntu@YOUR_INSTANCE_IP

# Fix key permissions
chmod 400 ~/.ssh/opuzen-key.pem
```

### Instance Not Found
```bash
# Check target group exists
aws elbv2 describe-target-groups --names TG-OPMS-API-DEV

# Check instances are healthy
aws elbv2 describe-target-health --target-group-arn YOUR_TARGET_GROUP_ARN
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_PROFILE` | `default` | AWS CLI profile to use |
| `AWS_REGION` | `us-west-1` | AWS region |
| `SSH_KEY_PATH` | `~/.ssh/opuzen-key.pem` | Path to SSH private key |

## Safety Features

- **Health checks** - Verifies app is running after restart
- **Error handling** - Continues with other instances if one fails
- **Timeout protection** - SSH connections timeout after 10 seconds
- **Summary report** - Shows success/failure count at the end
