#!/bin/bash
# Update ALB Settings for Long-Running Batch Operations
# This increases the idle timeout to support 2-hour batch re-sync operations

set -e

echo "🔧 Updating ALB Settings for Batch Operations"
echo "=============================================="

# Default timeout: 7200 seconds (2 hours)
IDLE_TIMEOUT=${1:-7200}

echo "Setting ALB idle timeout to ${IDLE_TIMEOUT} seconds (${IDLE_TIMEOUT}/3600 hours)"

# Find the Load Balancer (ALB-OPMS-API-ALL)
LB_ARN=$(aws elbv2 describe-load-balancers \
  --query 'LoadBalancers[?LoadBalancerName==`ALB-OPMS-API-ALL`].LoadBalancerArn' \
  --output text \
  --region us-west-1)

if [ -z "$LB_ARN" ]; then
    echo "❌ Error: Could not find load balancer"
    exit 1
fi

echo "Found Load Balancer: $LB_ARN"

# Update load balancer attributes (idle timeout)
echo "Updating ALB attributes..."
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "$LB_ARN" \
  --attributes Key=idle_timeout.timeout_seconds,Value=${IDLE_TIMEOUT} \
  --region us-west-1 \
  --output json

echo ""
echo "✅ ALB idle timeout updated to ${IDLE_TIMEOUT} seconds"
echo ""
echo "📋 Verification:"
aws elbv2 describe-load-balancer-attributes \
  --load-balancer-arn "$LB_ARN" \
  --region us-west-1 \
  --query 'Attributes[?Key==`idle_timeout.timeout_seconds`]' \
  --output table

echo ""
echo "⚠️  Note: This allows batch re-sync operations to run for up to ${IDLE_TIMEOUT}/3600 hours"
echo "   without timing out at the load balancer level."

