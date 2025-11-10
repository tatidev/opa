#!/bin/bash

# deploy-to-alb-nodes.sh
# Automatically detects ALB nodes and deploys code updates to them sequentially
# Usage: ./deploy-to-alb-nodes.sh [environment]
# Example: ./deploy-to-alb-nodes.sh dev

set -e  # Exit on any error

# Configuration
ENVIRONMENT="${1:-dev}"
AWS_PROFILE="${AWS_PROFILE:-aws_cli_admin}"
AWS_REGION="${AWS_REGION:-us-west-1}"
ALB_NAME="ALB-OPMS-API-ALL"
TARGET_GROUP_NAME="TG-OPMS-API-DEV"
EFS_PATH="/opuzen-efs/${ENVIRONMENT}/opms-api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws --profile "$AWS_PROFILE" --region "$AWS_REGION" sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not valid. Please check your profile: $AWS_PROFILE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get ALB information
get_alb_info() {
    log_info "Getting ALB information for: $ALB_NAME"
    
    # Get ALB ARN
    ALB_ARN=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" elbv2 describe-load-balancers \
        --names "$ALB_NAME" \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text 2>/dev/null)
    
    if [ "$ALB_ARN" = "None" ] || [ -z "$ALB_ARN" ]; then
        log_error "ALB '$ALB_NAME' not found"
        exit 1
    fi
    
    log_success "Found ALB: $ALB_ARN"
    echo "$ALB_ARN"
}

# Get target group information
get_target_group_info() {
    log_info "Getting target group information for: $TARGET_GROUP_NAME"
    
    # Get target group ARN
    TARGET_GROUP_ARN=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" elbv2 describe-target-groups \
        --names "$TARGET_GROUP_NAME" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text 2>/dev/null)
    
    if [ "$TARGET_GROUP_ARN" = "None" ] || [ -z "$TARGET_GROUP_ARN" ]; then
        log_error "Target group '$TARGET_GROUP_NAME' not found"
        exit 1
    fi
    
    log_success "Found target group: $TARGET_GROUP_ARN"
    echo "$TARGET_GROUP_ARN"
}

# Get ALB node instances
get_alb_nodes() {
    local target_group_arn="$1"
    
    log_info "Getting ALB node instances..."
    
    # Get target health to find instances
    INSTANCES=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" elbv2 describe-target-health \
        --target-group-arn "$target_group_arn" \
        --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`].Target.Id' \
        --output text 2>/dev/null)
    
    if [ -z "$INSTANCES" ]; then
        log_error "No healthy instances found in target group"
        exit 1
    fi
    
    # Convert to array
    INSTANCE_ARRAY=($INSTANCES)
    
    log_success "Found ${#INSTANCE_ARRAY[@]} healthy instance(s): ${INSTANCE_ARRAY[*]}"
    
    # Get instance details
    log_info "Getting instance details..."
    
    INSTANCE_DETAILS=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 describe-instances \
        --instance-ids "${INSTANCE_ARRAY[@]}" \
        --query 'Reservations[*].Instances[*].[InstanceId,PrivateIpAddress,State.Name,Tags[?Key==`Name`].Value|[0]]' \
        --output json)
    
    echo "$INSTANCE_DETAILS"
}

# Deploy to a single instance
deploy_to_instance() {
    local instance_id="$1"
    local private_ip="$2"
    local instance_name="$3"
    
    log_info "Deploying to instance: $instance_id ($instance_name) at $private_ip"
    
    # Create deployment script content
    local deploy_script="
set -e
echo '🚀 Starting deployment on \$(hostname) at \$(date)'

# Navigate to app directory
cd $EFS_PATH || { echo '❌ EFS path not found: $EFS_PATH'; exit 1; }

# Check git status
echo '📋 Checking git status...'
git status --porcelain

# Pull latest code
echo '🔄 Pulling latest code from deployDev branch...'
git pull origin deployDev || { echo '❌ Git pull failed'; exit 1; }

# Fix permissions (critical for npm install)
echo '🔧 Fixing file permissions...'
sudo chown -R ubuntu:www-data . || { echo '❌ Permission fix failed'; exit 1; }

# Install dependencies
echo '📦 Installing Node.js dependencies...'
npm install || { echo '❌ npm install failed'; exit 1; }

# Restart application
echo '🔄 Restarting application...'
if [ -f ./restart.sh ]; then
    ./restart.sh
else
    echo '⚠️ restart.sh not found, using manual restart...'
    sudo pkill -f 'node.*src/index.js' || true
    sudo -u ubuntu bash -c 'cd $EFS_PATH && nohup node src/index.js > /home/ubuntu/opms-api.log 2>&1 &'
fi

# Wait for app to start
echo '⏳ Waiting for application to start...'
sleep 5

# Verify application is running
echo '🔍 Verifying application health...'
if ps aux | grep -q 'node.*src/index.js' && ! ps aux | grep -q 'grep.*node'; then
    echo '✅ Application is running'
    
    # Test health endpoint
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        echo '✅ Health check passed'
    else
        echo '⚠️ Health check failed, but app is running'
    fi
else
    echo '❌ Application failed to start'
    tail -20 /home/ubuntu/opms-api.log || echo 'No log file found'
    exit 1
fi

echo '🎉 Deployment completed successfully on \$(hostname) at \$(date)'
"

    # Execute deployment via SSM
    log_info "Executing deployment via SSM..."
    
    local command_id=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ssm send-command \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=[$(echo "$deploy_script" | jq -Rs .)]" \
        --query 'Command.CommandId' \
        --output text)
    
    if [ -z "$command_id" ] || [ "$command_id" = "None" ]; then
        log_error "Failed to send SSM command to instance $instance_id"
        return 1
    fi
    
    log_info "SSM command sent: $command_id"
    
    # Wait for command to complete
    log_info "Waiting for deployment to complete..."
    aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ssm wait command-executed \
        --command-id "$command_id" \
        --instance-id "$instance_id"
    
    # Get command results
    local status=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ssm get-command-invocation \
        --command-id "$command_id" \
        --instance-id "$instance_id" \
        --query 'Status' \
        --output text)
    
    if [ "$status" = "Success" ]; then
        log_success "Deployment completed successfully on instance $instance_id"
        return 0
    else
        log_error "Deployment failed on instance $instance_id with status: $status"
        
        # Get error details
        local error_output=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ssm get-command-invocation \
            --command-id "$command_id" \
            --instance-id "$instance_id" \
            --query 'StandardErrorContent' \
            --output text)
        
        if [ -n "$error_output" ]; then
            log_error "Error details: $error_output"
        fi
        
        return 1
    fi
}

# Main deployment function
main() {
    log_info "Starting ALB node deployment for environment: $ENVIRONMENT"
    log_info "Using AWS profile: $AWS_PROFILE"
    log_info "Target EFS path: $EFS_PATH"
    
    # Check prerequisites
    check_prerequisites
    
    # Get ALB and target group info
    ALB_ARN=$(get_alb_info)
    TARGET_GROUP_ARN=$(get_target_group_info)
    
    # Get ALB nodes
    INSTANCE_DETAILS=$(get_alb_nodes "$TARGET_GROUP_ARN")
    
    # Parse instance details
    local instance_count=$(echo "$INSTANCE_DETAILS" | jq 'length')
    local success_count=0
    local failure_count=0
    
    log_info "Starting sequential deployment to $instance_count instance(s)..."
    
    # Deploy to each instance sequentially
    for i in $(seq 0 $((instance_count - 1))); do
        local instance_id=$(echo "$INSTANCE_DETAILS" | jq -r ".[$i][0]")
        local private_ip=$(echo "$INSTANCE_DETAILS" | jq -r ".[$i][1]")
        local state=$(echo "$INSTANCE_DETAILS" | jq -r ".[$i][2]")
        local instance_name=$(echo "$INSTANCE_DETAILS" | jq -r ".[$i][3]")
        
        if [ "$state" = "running" ]; then
            log_info "Deploying to instance $((i + 1)) of $instance_count: $instance_id"
            
            if deploy_to_instance "$instance_id" "$private_ip" "$instance_name"; then
                ((success_count++))
                log_success "Instance $instance_id deployment completed"
            else
                ((failure_count++))
                log_error "Instance $instance_id deployment failed"
            fi
            
            # Wait between deployments (optional)
            if [ $i -lt $((instance_count - 1)) ]; then
                log_info "Waiting 10 seconds before next deployment..."
                sleep 10
            fi
        else
            log_warning "Skipping instance $instance_id (state: $state)"
        fi
    done
    
    # Summary
    log_info "Deployment summary:"
    log_info "  Total instances: $instance_count"
    log_info "  Successful: $success_count"
    log_info "  Failed: $failure_count"
    
    if [ $failure_count -eq 0 ]; then
        log_success "All deployments completed successfully! 🎉"
        exit 0
    else
        log_error "Some deployments failed. Please check the logs above."
        exit 1
    fi
}

# Run main function
main "$@"
