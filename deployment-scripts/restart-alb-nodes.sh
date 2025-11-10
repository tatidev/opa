#!/bin/bash

# restart-alb-nodes.sh
# Connects to ALB nodes and restarts the OPMS API application
# Usage: ./restart-alb-nodes.sh [environment]
# Example: ./restart-alb-nodes.sh dev

set -e

# Configuration
ENVIRONMENT="${1:-dev}"
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-west-1}"
ALB_NAME="ALB-OPMS-API-ALL"

# Set target group ARN based on environment
case "$ENVIRONMENT" in
    dev)
        TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-west-1:992382576482:targetgroup/TG-OPMS-API-DEV/72a1feb9cc19f831"
        ;;
    qa)
        TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-west-1:992382576482:targetgroup/TG-OPMS-API-QA/YOUR_QA_ARN_HERE"
        ;;
    prod)
        TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-west-1:992382576482:targetgroup/TG-OPMS-API-PROD/14d57d2e9a3f3ccc"
        ;;
    *)
        log_error "Invalid environment: $ENVIRONMENT. Must be dev, qa, or prod"
        exit 1
        ;;
esac

SSH_KEY_PATH="${SSH_KEY_PATH:-/Users/paulleasure/.ssh/id_rsa}"
SSH_USER="ubuntu"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed"
        exit 1
    fi
    
    if ! aws --profile "$AWS_PROFILE" --region "$AWS_REGION" sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not valid for profile: $AWS_PROFILE"
        exit 1
    fi
    
    if [ ! -f "$SSH_KEY_PATH" ]; then
        log_error "SSH key not found: $SSH_KEY_PATH"
        log_info "Set SSH_KEY_PATH environment variable or place key at ~/.ssh/opuzen-key.pem"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get ALB target group instances  
get_alb_instances() {
    # Get healthy instances (no debug output to avoid corrupting JSON return)
    TARGET_HEALTH_RAW=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" elbv2 describe-target-health \
        --target-group-arn "$TARGET_GROUP_ARN" 2>&1)
    
    if ! echo "$TARGET_HEALTH_RAW" | jq . > /dev/null 2>&1; then
        log_error "AWS CLI returned invalid JSON for target health"
        echo "$TARGET_HEALTH_RAW"
        exit 1
    fi
    
    INSTANCES=$(echo "$TARGET_HEALTH_RAW" | jq -r '.TargetHealthDescriptions[]? | select(.TargetHealth.State == "healthy") | .Target.Id' | tr '\n' ' ')
    
    if [ -z "$INSTANCES" ]; then
        log_error "No healthy instances found in target group"
        exit 1
    fi
    
    # Get instance details
    INSTANCE_DETAILS=$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 describe-instances \
        --instance-ids $INSTANCES \
        --query 'Reservations[*].Instances[*].[InstanceId,PublicIpAddress,PrivateIpAddress,State.Name,Tags[?Key==`Name`].Value|[0]]' \
        --output json 2>&1)
    
    if ! echo "$INSTANCE_DETAILS" | jq . > /dev/null 2>&1; then
        log_error "Failed to get valid instance details"
        echo "$INSTANCE_DETAILS"
        exit 1
    fi
    
    # Return only the JSON
    echo "$INSTANCE_DETAILS"
}

# Restart app on a single instance
restart_on_instance() {
    local instance_id="$1"
    local public_ip="$2"
    local private_ip="$3"
    local instance_name="$4"
    
    log_info "Restarting app on: $instance_id ($instance_name) at $public_ip"
    
    # SSH and restart commands
    local restart_commands="
        cd /opuzen-efs/$ENVIRONMENT/opms-api
        echo 'Stopping existing application...'
        sudo pkill -f 'node.*src/index.js' || true
        sleep 2
        echo 'Starting application...'
        sudo -u ubuntu bash -c 'cd /opuzen-efs/$ENVIRONMENT/opms-api && NODE_ENV=$ENVIRONMENT nohup node src/index.js > /home/ubuntu/opms-api.log 2>&1 &'
        sleep 3
        echo 'Verifying application is running...'
        if ps aux | grep -q 'node.*src/index.js' && ! ps aux | grep -q 'grep.*node'; then
            echo 'Application restarted successfully'
            curl -f http://localhost:3000/api/health || echo 'Health check failed but app is running'
        else
            echo 'ERROR: Application failed to start'
            tail -10 /home/ubuntu/opms-api.log
            exit 1
        fi
    "
    
    # Execute via SSH
    if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=10 \
        "$SSH_USER@$public_ip" "$restart_commands"; then
        log_success "Successfully restarted app on $instance_id"
        return 0
    else
        log_error "Failed to restart app on $instance_id"
        return 1
    fi
}

# Main function
main() {
    log_info "Starting ALB app restart for environment: $ENVIRONMENT"
    log_info "Using AWS profile: $AWS_PROFILE"
    log_info "SSH key: $SSH_KEY_PATH"
    log_info "Target Group ARN: $TARGET_GROUP_ARN"
    
    check_prerequisites
    
    # Get instances
    INSTANCE_DETAILS=$(get_alb_instances)
    
    # Parse and restart on each instance
    log_info "DEBUG: Instance details JSON:"
    echo "$INSTANCE_DETAILS"
    
    if ! echo "$INSTANCE_DETAILS" | jq . > /dev/null 2>&1; then
        log_error "Invalid JSON from instance details. Raw output above."
        exit 1
    fi
    
    # Extract instances from the nested AWS CLI structure [[[instance_data]]]
    # The structure is [[[instance1], [instance2], ...]] so we need .[0] to get the instances array
    INSTANCES_ARRAY=$(echo "$INSTANCE_DETAILS" | jq '.[0]')
    local instance_count=$(echo "$INSTANCES_ARRAY" | jq 'length')
    local success_count=0
    local failure_count=0
    
    log_info "Found $instance_count instance(s) to restart"
    
    for i in $(seq 0 $((instance_count - 1))); do
        local instance_id=$(echo "$INSTANCES_ARRAY" | jq -r ".[$i][0]")
        local public_ip=$(echo "$INSTANCES_ARRAY" | jq -r ".[$i][1]")
        local private_ip=$(echo "$INSTANCES_ARRAY" | jq -r ".[$i][2]")
        local state=$(echo "$INSTANCES_ARRAY" | jq -r ".[$i][3]")
        local instance_name=$(echo "$INSTANCES_ARRAY" | jq -r ".[$i][4]")
        
        log_info "DEBUG: Processing instance $i: ID=$instance_id, IP=$public_ip, State=$state"
        
        if [ "$state" = "running" ]; then
            log_info "Processing instance $((i + 1)) of $instance_count: $instance_id"
            
            if restart_on_instance "$instance_id" "$public_ip" "$private_ip" "$instance_name"; then
                ((success_count++))
            else
                ((failure_count++))
            fi
            
            # Wait between restarts
            if [ $i -lt $((instance_count - 1)) ]; then
                log_info "Waiting 5 seconds before next restart..."
                sleep 5
            fi
        else
            log_warning "Skipping instance $instance_id (state: $state)"
        fi
    done
    
    # Summary
    log_info "Restart summary:"
    log_info "  Total instances: $instance_count"
    log_info "  Successful: $success_count"
    log_info "  Failed: $failure_count"
    
    if [ $failure_count -eq 0 ]; then
        log_success "All app restarts completed successfully!"
        exit 0
    else
        log_error "Some restarts failed. Check the output above."
        exit 1
    fi
}

# Help function
show_help() {
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environment variables:"
    echo "  AWS_PROFILE     - AWS CLI profile to use (default: default)"
    echo "  AWS_REGION      - AWS region (default: us-west-1)"
    echo "  SSH_KEY_PATH    - Path to SSH private key (default: ~/.ssh/opuzen-key.pem)"
    echo ""
    echo "Examples:"
    echo "  $0 dev                           # Restart dev environment"
    echo "  AWS_PROFILE=myprofile $0 dev     # Use specific AWS profile"
    echo "  SSH_KEY_PATH=~/my-key.pem $0 dev # Use specific SSH key"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"
