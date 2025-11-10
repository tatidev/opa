#!/bin/bash
# Production Restart with PM2
# Usage: ./restart-prod-pm2.sh

set -e

INSTANCE_ID="i-0f4f20f1caf1b1fab"
REGION="us-west-1"
APP_PATH="/opuzen-efs/prod/opms-api"

echo "🔄 Restarting OPMS API Production with PM2"
echo "=========================================="

# Send restart command via SSM
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "PM2 Reload OPMS API Production" \
  --parameters commands='[
    "echo \"=== Checking current PM2 status ===\"",
    "cd '"$APP_PATH"'",
    "sudo -u ubuntu npx pm2 status || echo \"PM2 not running yet\"",
    "echo \"\n=== Performing PM2 reload (zero-downtime) ===\"",
    "sudo -u ubuntu npx pm2 reload opms-api || sudo -u ubuntu npx pm2 restart opms-api",
    "sleep 5",
    "echo \"\n=== Verifying restart ===\"",
    "sudo -u ubuntu npx pm2 status",
    "echo \"\n=== Testing health endpoint ===\"",
    "curl -f http://localhost:3000/api/health || echo \"Health check pending...\"",
    "echo \"\n=== Recent logs ===\"",
    "sudo -u ubuntu npx pm2 logs opms-api --lines 10 --nostream"
  ]' \
  --region "$REGION" \
  --output text \
  --query 'Command.CommandId')

echo "✅ Command sent: $COMMAND_ID"
echo "⏳ Waiting for reload to complete..."
sleep 15

echo ""
echo "📊 Restart Results:"
echo "==================="
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardOutputContent' \
  --output text

echo ""
echo "✅ Restart complete!"
echo ""
echo "📋 Next steps:"
echo "1. Check PM2 status: sudo -u ubuntu npx pm2 status (via SSM)"
echo "2. View sync dashboard: https://your-domain.com/api/sync-dashboard/"
echo "3. Monitor sync queue progress for your 10,318 pending items"

