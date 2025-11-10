# Production Restart Script

## Quick Start

Restart the production OPMS API with zero downtime from your Mac:

```bash
node scripts/startup-prod.js
```

Or run directly:

```bash
./scripts/startup-prod.js
```

## What It Does

1. **Auto-discovers** production EC2 instances via AWS tags
2. **Fallback discovery** using known instance IDs if tags not found
3. **Zero-downtime restart** using PM2 reload functionality
4. **Health verification** checks API endpoint after restart
5. **Clear reporting** shows PM2 status and recent logs

## How It Works

```
┌─────────────────────────────────────────────────┐
│  Your Mac                                       │
│  ├─ Run: node scripts/startup-prod.js          │
│  └─ AWS CLI authenticates                      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  AWS Systems Manager (SSM)                      │
│  ├─ Discovers production instances             │
│  └─ Sends restart command securely             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Production EC2 Instance(s)                     │
│  ├─ Receives command via SSM                   │
│  ├─ Runs: pm2 reload opms-api                  │
│  ├─ Zero downtime (keeps old process until      │
│  │   new process is ready)                     │
│  └─ Reports status back                        │
└─────────────────────────────────────────────────┘
```

## Prerequisites

### 1. AWS CLI Configuration

Verify your AWS CLI is configured:

```bash
aws sts get-caller-identity
```

Should return your AWS account and user/role information.

### 2. Required AWS Permissions

Your AWS credentials need:
- `ec2:DescribeInstances` - To discover production instances
- `ssm:SendCommand` - To send restart commands
- `ssm:GetCommandInvocation` - To check command status

### 3. Instance Requirements

Production instances must have:
- **SSM Agent** installed and running
- **PM2** installed globally or locally
- **Instance tags** (preferred):
  - `Environment=prod` or `Environment=production`
  - `Application=opms-api`

## Features

### Automatic Instance Discovery

The script tries multiple methods to find production instances:

1. **Primary**: AWS tags (`Environment=prod`, `Application=opms-api`)
2. **Fallback**: Known production instance IDs

### Zero-Downtime Restart

Uses PM2's `reload` command which:
- Starts new process
- Waits for it to be ready
- Switches traffic to new process
- Gracefully shuts down old process
- **No requests are dropped**

### Health Verification

After restart, the script:
- Checks PM2 status
- Tests health endpoint (`/api/health`)
- Shows recent application logs

## Output Example

```
🚀 OPMS API Production Restart Utility
============================================================
Region: us-west-1
App Path: /opuzen-efs/prod/opms-api
PM2 App: opms-api
============================================================

🔍 Discovering production OPMS API instances...
✅ Found 1 production instance(s):
   - i-0641b830fc1add76c (opms-api-prod-node) - 54.153.87.250

🔄 Restarting OPMS API on instance: i-0641b830fc1add76c
============================================================
✅ Command sent: abc123-def456-ghi789
⏳ Waiting 15 seconds for restart to complete...

📊 Restart Results:
============================================================
=== Checking current PM2 status ===
┌────┬────────────┬─────────┬─────────┬──────────┐
│ id │ name       │ mode    │ status  │ restart  │
├────┼────────────┼─────────┼─────────┼──────────┤
│ 0  │ opms-api   │ fork    │ online  │ 42       │
└────┴────────────┴─────────┴─────────┴──────────┘

=== Performing PM2 reload (zero-downtime restart) ===
[PM2] Reloading process opms-api
[PM2] Process opms-api reloaded

=== Testing health endpoint ===
{"status":"ok","timestamp":"2025-10-31T12:00:00.000Z"}

✅ Restart completed successfully!

============================================================
📋 Restart Summary
============================================================
Total instances: 1
Successful restarts: 1
Failed restarts: 0

✅ All instances restarted successfully!

📝 Next Steps:
   1. Check sync dashboard: https://api.opuzen-service.com/api/sync-dashboard/
   2. Monitor application logs via PM2
   3. Verify API health endpoint
```

## Troubleshooting

### "No production instances found"

**Cause**: Script can't find production EC2 instances.

**Solutions**:
1. Check AWS CLI is configured: `aws sts get-caller-identity`
2. Verify instance is running: `aws ec2 describe-instances --region us-west-1`
3. Check instance tags or update known instance IDs in script

### "Access Denied" or "Unauthorized"

**Cause**: AWS credentials lack required permissions.

**Solutions**:
1. Verify you're using correct AWS profile
2. Check IAM permissions for EC2 and SSM
3. Contact AWS administrator for permission grants

### "PM2 not found"

**Cause**: PM2 is not installed on the instance.

**Solutions**:
1. Verify PM2 is installed: Check deployment scripts
2. Ensure PM2 is in PATH for ubuntu user
3. May need to install PM2 globally on instance

### "Health check failed"

**Cause**: API didn't start properly after restart.

**Solutions**:
1. Check PM2 logs: `pm2 logs opms-api`
2. Verify environment variables are set
3. Check database connectivity
4. Review application error logs

## Comparison with Other Scripts

| Script | Method | Downtime | Complexity | Recommended |
|--------|--------|----------|------------|-------------|
| `startup-prod.js` | PM2 reload | None | Simple | ✅ **Yes** |
| `restart-prod-pm2.sh` | PM2 reload | None | Moderate | ✅ Yes |
| `restart-prod-FIXED.sh` | Kill + restart | ~5-10s | High | ⚠️ Only if PM2 broken |
| `restart-prod-simple.sh` | Kill + restart | ~5-10s | Low | ⚠️ Only if PM2 broken |

## Related Documentation

- **Deployment Process**: See memory about `git push origin deployProd`
- **PM2 Configuration**: See `ecosystem.config.js`
- **GitHub Actions Workflow**: See `.github/workflows/deploy-opms-api.yml`
- **Production Operations**: See `DOCS/PRODUCTION-OPERATIONS.md`

## Notes

- This script **restarts the application**, it does **NOT deploy new code**
- To deploy code changes, use: `git pull origin deployProd && git push origin deployProd`
- The script is idempotent - safe to run multiple times
- Uses AWS SSM - no SSH keys or direct server access needed
- Works from any machine with AWS CLI configured

