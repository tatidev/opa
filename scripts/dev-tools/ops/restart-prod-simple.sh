#!/bin/bash
# Simple production restart using AWS SSM
# Usage: ./restart-prod-simple.sh

set -e

INSTANCE_ID="i-0102d90b810973c44"
REGION="us-west-1"

echo "🔄 Restarting OPMS API on production instance: $INSTANCE_ID"

# Send restart command via SSM
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Restart OPMS API Production" \
  --parameters commands='["pkill -f \"node.*src/index.js\" || true","sleep 2","cd /opuzen-efs/prod/opms-api","sudo -u ubuntu bash -c \"NODE_ENV=prod nohup node src/index.js > /home/ubuntu/opms-api.log 2>&1 &\"","sleep 3","ps aux | grep node | grep -v grep"]' \
  --region "$REGION" \
  --output text \
  --query 'Command.CommandId')

echo "✅ Command sent: $COMMAND_ID"
echo "⏳ Waiting 10 seconds for restart..."
sleep 10

# Check status
STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Status' \
  --output text)

echo "📊 Command status: $STATUS"

# Get output
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'StandardOutputContent' \
  --output text

echo ""
echo "✅ Restart complete. Testing health endpoint..."
sleep 5
curl -s http://52.53.252.247:3000/api/health | jq '.' || echo "⚠️  Health check failed - app may still be starting"

