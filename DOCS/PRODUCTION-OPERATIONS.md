# Production Operations Guide - OPMS API

## 📋 **Overview**

This guide covers all production operations for the OPMS API deployed on AWS EC2 with Application Load Balancer (ALB).

**Production Environment:**
- **Instance ID**: `i-0102d90b810973c44`
- **Region**: `us-west-1`
- **Instance Name**: `OPMS-API-PROD`
- **Public IP**: `52.53.252.247`
- **Application Path**: `/opuzen-efs/prod/opms-api/`
- **Target Group**: `TG-OPMS-API-PROD`
- **Load Balancer**: `ALB-OPMS-API-ALL-1807308954.us-west-1.elb.amazonaws.com`

---

## 🚀 **Starting, Stopping, and Restarting**

### **Quick Reference**

| Operation | Command | Use Case |
|-----------|---------|----------|
| **Restart (PM2)** | `./deployment-scripts/restart-prod-pm2.sh` | After code deployment (zero-downtime) |
| **Stop** | `aws ssm send-command ...` (see below) | Maintenance, troubleshooting |
| **Start** | `pm2 start ecosystem.config.js` | After stopping |
| **Status** | `pm2 status` (via SSM) | Health check, monitoring |
| **Logs** | `pm2 logs opms-api` (via SSM) | View real-time logs |

---

## 🔄 **Restart Production (PM2 - Recommended Method)**

### **After Code Deployment**

```bash
# From your local machine, run:
cd ~/Documents/True_North_Dev_LLC/____PROJECTS/____Opuzen/__code/github/opuzen-api
./deployment-scripts/restart-prod-pm2.sh
```

**What This Does:**
1. ✅ PM2 performs **zero-downtime reload**
2. ✅ Starts new process with updated code
3. ✅ Gracefully stops old process once new one is ready
4. ✅ **Guarantees single process** (no duplicates)
5. ✅ Sync queue service continues processing
6. ✅ Tests health endpoint
7. ✅ Shows PM2 status and recent logs

**Expected Output:**
```
🔄 Restarting OPMS API Production with PM2
✅ Command sent: abc123-def456-...
⏳ Waiting for reload to complete...

=== Performing PM2 reload (zero-downtime) ===
Use --update-env to update environment variables
[PM2] Applying action reloadProcessId on app [opms-api](ids: [ 0 ])
[PM2] [opms-api](0) ✓

=== Verifying restart ===
┌─────┬──────────┬─────────┬─────────┬──────┬────────┐
│ id  │ name     │ status  │ restart │ cpu  │ memory │
├─────┼──────────┼─────────┼─────────┼──────┼────────┤
│ 0   │ opms-api │ online  │ 1       │ 0.3% │ 95 MB  │
└─────┴──────────┴─────────┴─────────┴──────┴────────┘

=== Testing health endpoint ===
{"status":"OK","message":"Opuzen API is running","timestamp":"..."}
```

**Time Required:** ~15 seconds  
**Downtime:** 0 seconds (zero-downtime reload)

---

## 🛑 **Stop Production**

### **For Maintenance or Troubleshooting**

**Using PM2 (Recommended):**
```bash
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /opuzen-efs/prod/opms-api","sudo -u ubuntu npx pm2 stop opms-api","sudo -u ubuntu npx pm2 status"]' \
  --region us-west-1
```

**Emergency Kill (If PM2 not responding):**
```bash
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo pkill -9 node","ps aux | grep node | grep -v grep || echo \"All processes stopped\""]' \
  --region us-west-1
```

**Verification:**
```bash
# Wait 5 seconds, then check:
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["ps aux | grep node | grep -v grep || echo \"No node processes running\""]' \
  --region us-west-1 \
  --output text \
  --query 'Command.CommandId' | \
  xargs -I {} sh -c 'sleep 5 && aws ssm get-command-invocation --command-id {} --instance-id i-0102d90b810973c44 --region us-west-1 --query StandardOutputContent --output text'
```

---

## ✅ **Check Production Status**

### **Quick PM2 Status Check**

```bash
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /opuzen-efs/prod/opms-api","sudo -u ubuntu npx pm2 status","sudo -u ubuntu npx pm2 monit --no-daemon"]' \
  --region us-west-1 \
  --output text \
  --query 'Command.CommandId' | \
  xargs -I {} sh -c 'sleep 5 && aws ssm get-command-invocation --command-id {} --instance-id i-0102d90b810973c44 --region us-west-1 --query StandardOutputContent --output text'
```

### **Create Detailed Status Check Script** (if not exists)

```bash
cat > deployment-scripts/check-prod-status.sh << 'EOF'
#!/bin/bash
# Check production status
# Usage: ./check-prod-status.sh

INSTANCE_ID="i-0102d90b810973c44"
REGION="us-west-1"

echo "📊 OPMS API Production Status Check"
echo "===================================="

aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "echo \"=== Node.js Processes ===\"",
    "PROCESS_COUNT=$(ps aux | grep \"node.*src/index.js\" | grep -v grep | wc -l)",
    "echo \"Process count: $PROCESS_COUNT\"",
    "ps aux | grep node | grep -v grep || echo \"No processes running\"",
    "echo \"\n=== Port 3000 Status ===\"",
    "netstat -tuln | grep 3000 || echo \"Port 3000 not listening\"",
    "echo \"\n=== Health Check ===\"",
    "curl -f http://localhost:3000/api/health || echo \"Health check failed\"",
    "echo \"\n=== Sync Queue Status ===\"",
    "tail -20 /home/ubuntu/opms-api-*.log | grep -E \"sync.*started|sync.*initialized|Queue.*processing\" | tail -5 || echo \"No sync info in logs\"",
    "echo \"\n=== Recent Errors ===\"",
    "tail -50 /home/ubuntu/opms-api-*.log | grep -i error | tail -10 || echo \"No recent errors\"",
    "echo \"\n=== Disk Space ===\"",
    "df -h /opuzen-efs/prod/opms-api | tail -1"
  ]' \
  --region "$REGION" \
  --output text \
  --query 'Command.CommandId' | \
  xargs -I {} sh -c 'sleep 5 && aws ssm get-command-invocation --command-id {} --instance-id '"$INSTANCE_ID"' --region '"$REGION"' --query StandardOutputContent --output text'
EOF

chmod +x deployment-scripts/check-prod-status.sh
```

**Run Status Check:**
```bash
./deployment-scripts/check-prod-status.sh
```

---

## 📝 **View Production Logs**

### **Real-time Log Monitoring**

```bash
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["tail -100 /home/ubuntu/opms-api-*.log | tail -100"]' \
  --region us-west-1 \
  --output text \
  --query 'Command.CommandId' | \
  xargs -I {} sh -c 'sleep 3 && aws ssm get-command-invocation --command-id {} --instance-id i-0102d90b810973c44 --region us-west-1 --query StandardOutputContent --output text'
```

### **Check for Errors**

```bash
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["grep -i error /home/ubuntu/opms-api-*.log | tail -20"]' \
  --region us-west-1 \
  --output text \
  --query 'Command.CommandId' | \
  xargs -I {} sh -c 'sleep 3 && aws ssm get-command-invocation --command-id {} --instance-id i-0102d90b810973c44 --region us-west-1 --query StandardOutputContent --output text'
```

---

## 🔍 **Troubleshooting**

### **Problem: Duplicate Processes Running**

**Symptoms:**
- Status check shows 2+ processes
- Port conflict errors in logs: `EADDRINUSE: address already in use 0.0.0.0:3000`
- Sync queue not processing items

**Solution:**
```bash
./deployment-scripts/restart-prod-FIXED.sh
```

This script is specifically designed to prevent duplicate processes.

---

### **Problem: Sync Queue Not Processing**

**Symptoms:**
- Dashboard shows thousands of PENDING syncs
- No items moving to COMPLETED
- Logs show: `NetSuite sync queue processing stopped {"totalProcessed":0}`

**Diagnosis:**
```bash
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["tail -100 /home/ubuntu/opms-api-*.log | grep -E \"sync.*initialized|sync.*started|sync.*stopped|EADDRINUSE\""]' \
  --region us-west-1 \
  --output text \
  --query 'Command.CommandId' | \
  xargs -I {} sh -c 'sleep 3 && aws ssm get-command-invocation --command-id {} --instance-id i-0102d90b810973c44 --region us-west-1 --query StandardOutputContent --output text'
```

**Solution:**
1. Restart with the fixed script: `./deployment-scripts/restart-prod-FIXED.sh`
2. Verify single process: Check status shows exactly 1 process
3. Confirm sync queue: Logs should show `NetSuite sync queue processing started`

---

### **Problem: Port 3000 Not Responding**

**Check if process is running:**
```bash
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["netstat -tuln | grep 3000","ps aux | grep node | grep -v grep"]' \
  --region us-west-1 \
  --output text \
  --query 'Command.CommandId' | \
  xargs -I {} sh -c 'sleep 3 && aws ssm get-command-invocation --command-id {} --instance-id i-0102d90b810973c44 --region us-west-1 --query StandardOutputContent --output text'
```

**If not listening:**
- Process crashed - check logs for errors
- Process starting - wait 10 seconds and check again
- Restart: `./deployment-scripts/restart-prod-FIXED.sh`

---

## 📊 **Monitoring**

### **Sync Dashboard**

Access the production sync dashboard at:
```
https://your-domain.com/api/sync-dashboard/
```

**Dashboard Features:**
- Real-time sync metrics (24-hour window)
- Recent OPMS→NetSuite syncs
- Recent NetSuite→OPMS pricing updates
- Success rates and error tracking
- Auto-refresh every 10 seconds

### **Health Check Endpoint**

```bash
curl -s http://ALB-OPMS-API-ALL-1807308954.us-west-1.elb.amazonaws.com/api/health | jq '.'
```

**Expected Response:**
```json
{
  "status": "OK",
  "message": "Opuzen API is running",
  "timestamp": "2025-10-26T17:00:00.000Z"
}
```

---

## 🔧 **Common Operations**

### **After Code Deployment**

```bash
# 1. Code is auto-deployed by GitHub Actions to /opuzen-efs/prod/opms-api/
# 2. Restart to load new code:
./deployment-scripts/restart-prod-FIXED.sh

# 3. Verify deployment:
./deployment-scripts/check-prod-status.sh

# 4. Monitor dashboard for any issues
```

### **Weekly Health Check**

```bash
# Run status check
./deployment-scripts/check-prod-status.sh

# Check sync dashboard for errors
# Access: https://your-domain.com/api/sync-dashboard/

# Review recent logs
# (Use log viewing commands above)
```

### **Emergency Stop**

```bash
# Stop immediately (maintenance/critical issue)
aws ssm send-command \
  --instance-ids i-0102d90b810973c44 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo pkill -9 node"]' \
  --region us-west-1
```

---

## 🚨 **Important Notes**

### **Never Use SSH for Process Management**

❌ **Don't do this:**
```bash
ssh ubuntu@52.53.252.247 "pkill node"  # SSH drops when killing node!
```

✅ **Always use AWS SSM:**
```bash
aws ssm send-command ...  # Reliable for process management
```

**Why?** SSH connections can drop when you kill the Node process, leaving the system in an unknown state.

### **Single Process is Critical**

The application **MUST run as a single process**. Multiple processes cause:
- Port 3000 conflicts
- Sync queue service crashes
- Database connection pool exhaustion
- Unpredictable behavior

**Always use `restart-prod-FIXED.sh`** which guarantees single-process operation.

### **Sync Queue Rate Limiting**

The sync queue respects NetSuite rate limits:
- **10 requests/second maximum**
- **100ms delay between requests**
- **Sequential processing** (one item at a time)

**Processing Time Calculation:**
- 10,000 items ÷ 10 req/sec = **~17 minutes**
- Monitor progress on sync dashboard

---

## 📁 **File Locations**

| Resource | Location |
|----------|----------|
| **Application Code** | `/opuzen-efs/prod/opms-api/` |
| **Application Logs** | `/home/ubuntu/opms-api-*.log` |
| **PID File** | `/home/ubuntu/opms-api.pid` |
| **Environment** | `/opuzen-efs/prod/opms-api/.env` |
| **Restart Scripts** | `./deployment-scripts/` |

---

## 🔐 **Prerequisites**

To run these commands from your local machine, you need:

1. **AWS CLI** configured with valid credentials
   ```bash
   aws configure --profile default
   ```

2. **Proper IAM permissions** for:
   - SSM (Systems Manager) access
   - EC2 describe instances
   - ELB (Elastic Load Balancing) describe

3. **jq** installed (for JSON parsing)
   ```bash
   brew install jq  # macOS
   ```

---

## 📚 **Related Documentation**

- [Deployment Guide](../deployment-scripts/README.md)
- [Sync Dashboard Guide](SYNC-DASHBOARD-ENHANCED-SUMMARY.md)
- [NetSuite Integration](NetSuite-Integrations/README-NetSuite-Integration.md)
- [GitHub Actions Deployment](.github/workflows/deploy-opms-api.yml)

---

## 🆘 **Support**

If you encounter issues not covered in this guide:

1. Check recent logs (see Log Viewing section)
2. Review sync dashboard for error details
3. Run status check: `./deployment-scripts/check-prod-status.sh`
4. Attempt restart: `./deployment-scripts/restart-prod-FIXED.sh`

**Emergency Contact:** [Your escalation procedure here]

---

**Last Updated:** October 26, 2025  
**Production Instance:** `i-0102d90b810973c44` (OPMS-API-PROD)  
**Environment:** AWS EC2 / us-west-1

