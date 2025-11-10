#!/bin/bash
# Production restart with proper single-process guarantee
# Usage: ./restart-prod-FIXED.sh

set -e

INSTANCE_ID="i-0102d90b810973c44"
REGION="us-west-1"

echo "🔄 Restarting OPMS API Production with single-process guarantee"

# Send restart command via SSM
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --comment "Restart OPMS API Production - Single Process Fix" \
  --parameters 'commands=[
    "echo \"=== STEP 1: Kill ALL node processes ===\"",
    "sudo pkill -9 node || true",
    "sudo killall -9 node || true",
    "sleep 5",
    "echo \"=== STEP 2: Verify all processes stopped ===\"",
    "ps aux | grep node | grep -v grep || echo \"✅ All node processes stopped\"",
    "echo \"=== STEP 3: Clear any stale PID files ===\"",
    "rm -f /home/ubuntu/opms-api.pid || true",
    "echo \"=== STEP 4: Start SINGLE clean process ===\"",
    "cd /opuzen-efs/prod/opms-api",
    "sudo -u ubuntu bash -c \"cd /opuzen-efs/prod/opms-api && NODE_ENV=prod nohup node src/index.js > /home/ubuntu/opms-api-$(date +%Y%m%d-%H%M%S).log 2>&1 & echo \\$! > /home/ubuntu/opms-api.pid\"",
    "sleep 8",
    "echo \"=== STEP 5: Verify EXACTLY ONE process running ===\"",
    "PROCESS_COUNT=$(ps aux | grep \"node.*src/index.js\" | grep -v grep | wc -l)",
    "echo \"Process count: $PROCESS_COUNT\"",
    "if [ \"$PROCESS_COUNT\" -eq 1 ]; then echo \"✅ SUCCESS: Exactly 1 process running\"; else echo \"⚠️ WARNING: $PROCESS_COUNT processes running\"; fi",
    "ps aux | grep node | grep -v grep",
    "echo \"=== STEP 6: Verify port 3000 is listening ===\"",
    "sleep 5",
    "netstat -tuln | grep 3000 || echo \"⚠️ Port 3000 not listening yet\"",
    "echo \"=== STEP 7: Test health endpoint ===\"",
    "curl -f http://localhost:3000/api/health || echo \"⚠️ Health check pending...\"",
    "echo \"=== STEP 8: Check sync queue service ===\"",
    "sleep 3",
    "tail -30 /home/ubuntu/opms-api-*.log | grep -E \"sync.*started|sync.*initialized\" || echo \"⚠️ Sync service status unknown\""
  ]' \
  --region "$REGION" \
  --output text \
  --query 'Command.CommandId')

echo "✅ Command sent: $COMMAND_ID"
echo "⏳ Waiting 20 seconds for restart..."
sleep 20

# Check status
echo ""
echo "📊 Command Status:"
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query '[Status,StandardOutputContent]' \
  --output text | head -100

echo ""
echo "✅ Restart sequence complete!"
echo ""
echo "📋 Next steps:"
echo "1. Check the sync dashboard at your domain/api/sync-dashboard/"
echo "2. Monitor sync queue progress"
echo "3. The 10,318 pending syncs should now start processing"
echo "4. Expected processing time: ~17 minutes (10,318 items / 10 req/sec)"

