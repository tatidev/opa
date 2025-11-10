#!/bin/bash
# Retry Failed Sync Jobs
# Usage: ./retry-failed-syncs.sh [error_pattern]
# Example: ./retry-failed-syncs.sh "colorInfo"

INSTANCE_ID="i-0102d90b810973c44"
REGION="us-west-1"
ERROR_PATTERN="${1:-colorInfo}"

echo "🔄 Retrying Failed Sync Jobs"
echo "============================"
echo "Error Pattern: ${ERROR_PATTERN}"
echo ""

CMDID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters commands='[
    "cd /opuzen-efs/prod/opms-api",
    "echo \"=== Counting Failed Jobs with Pattern ===\"",
    "mysql -h opuzen-aurora-mysql8-cluster.cluster-c7886s6kkcmk.us-west-1.rds.amazonaws.com -u pklopuzen -popuzen_app2024 opuzen_prod_master_app -e \"SELECT COUNT(*) as failed_with_pattern FROM opms_sync_queue WHERE status='"'FAILED'"' AND error_message LIKE '"'%'"$ERROR_PATTERN"'%'"';\"",
    "echo \"\"",
    "echo \"=== Resetting Failed Jobs to PENDING ===\"",
    "mysql -h opuzen-aurora-mysql8-cluster.cluster-c7886s6kkcmk.us-west-1.rds.amazonaws.com -u pklopuzen -popuzen_app2024 opuzen_prod_master_app -e \"UPDATE opms_sync_queue SET status='"'PENDING'"', retry_count=0, error_message=NULL, processed_at=NULL WHERE status='"'FAILED'"' AND error_message LIKE '"'%'"$ERROR_PATTERN"'%'"';\"",
    "echo \"\"",
    "echo \"=== Verification ===\"",
    "mysql -h opuzen-aurora-mysql8-cluster.cluster-c7886s6kkcmk.us-west-1.rds.amazonaws.com -u pklopuzen -popuzen_app2024 opuzen_prod_master_app -e \"SELECT status, COUNT(*) as count FROM opms_sync_queue GROUP BY status;\""
  ]' \
  --region "$REGION" \
  --output text \
  --query 'Command.CommandId')

echo "✅ Command sent: $CMDID"
echo "⏳ Resetting failed jobs..."
sleep 8

echo ""
echo "=== RESULTS ==="
aws ssm get-command-invocation \
  --command-id "$CMDID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query StandardOutputContent \
  --output text

echo ""
echo "✅ Failed jobs have been reset to PENDING"
echo "📊 The sync queue will automatically process them"
echo "⏱️  Monitor progress on the dashboard"

