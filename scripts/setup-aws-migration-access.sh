#!/bin/bash

# AWS Setup Script for Environment-Aware Database Migrations
# Sets up Secrets Manager access for deployment server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_status $BLUE "🚀 Setting up AWS Secrets Manager access for deployment server..."

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
print_status $GREEN "✅ AWS Account ID: $AWS_ACCOUNT_ID"

# Deployment server instance ID
DEPLOYMENT_SERVER_ID="i-03efd7f3ab0fa76af"
print_status $GREEN "✅ Deployment Server: $DEPLOYMENT_SERVER_ID"

# Step 1: Create database secrets (if they don't exist)
print_status $BLUE "📋 Step 1: Creating database secrets..."

# You'll need to replace these with your actual database credentials
read -p "Enter database host (e.g., your-rds-endpoint.amazonaws.com): " DB_HOST
read -p "Enter database username: " DB_USERNAME
read -s -p "Enter database password: " DB_PASSWORD
echo

# Create DEV secret
print_status $YELLOW "Creating DEV database secret..."
aws secretsmanager create-secret \
  --name "opuzen-dev-database-credentials" \
  --description "Database credentials for OPMS API development environment" \
  --secret-string "{\"username\":\"$DB_USERNAME\",\"password\":\"$DB_PASSWORD\",\"host\":\"$DB_HOST\",\"port\":\"3306\"}" \
  --region us-west-1 \
  --output text > /dev/null 2>&1 || print_status $YELLOW "   DEV secret may already exist"

# Create QA secret  
print_status $YELLOW "Creating QA database secret..."
aws secretsmanager create-secret \
  --name "opuzen-qa-database-credentials" \
  --description "Database credentials for OPMS API QA environment" \
  --secret-string "{\"username\":\"$DB_USERNAME\",\"password\":\"$DB_PASSWORD\",\"host\":\"$DB_HOST\",\"port\":\"3306\"}" \
  --region us-west-1 \
  --output text > /dev/null 2>&1 || print_status $YELLOW "   QA secret may already exist"

# Create PROD secret
print_status $YELLOW "Creating PROD database secret..."
aws secretsmanager create-secret \
  --name "opuzen-prod-database-credentials" \
  --description "Database credentials for OPMS API production environment" \
  --secret-string "{\"username\":\"$DB_USERNAME\",\"password\":\"$DB_PASSWORD\",\"host\":\"$DB_HOST\",\"port\":\"3306\"}" \
  --region us-west-1 \
  --output text > /dev/null 2>&1 || print_status $YELLOW "   PROD secret may already exist"

print_status $GREEN "✅ Database secrets created/verified"

# Step 2: Create IAM policy for Secrets Manager access
print_status $BLUE "📋 Step 2: Creating IAM policy..."

IAM_POLICY_NAME="DeploymentServerSecretsAccess"

# Create IAM policy document
cat > /tmp/secrets-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowSecretsManagerAccess",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": [
                "arn:aws:secretsmanager:us-west-1:$AWS_ACCOUNT_ID:secret:opuzen-dev-database-credentials*",
                "arn:aws:secretsmanager:us-west-1:$AWS_ACCOUNT_ID:secret:opuzen-qa-database-credentials*",
                "arn:aws:secretsmanager:us-west-1:$AWS_ACCOUNT_ID:secret:opuzen-prod-database-credentials*"
            ],
            "Condition": {
                "StringEquals": {
                    "aws:RequestedRegion": "us-west-1"
                }
            }
        },
        {
            "Sid": "AllowKMSDecryption",
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "kms:ViaService": "secretsmanager.us-west-1.amazonaws.com"
                }
            }
        }
    ]
}
EOF

# Create IAM policy
aws iam create-policy \
  --policy-name "$IAM_POLICY_NAME" \
  --policy-document file:///tmp/secrets-policy.json \
  --description "Allows deployment server to access database credentials from Secrets Manager" \
  --region us-west-1 > /dev/null 2>&1 || print_status $YELLOW "   Policy may already exist"

print_status $GREEN "✅ IAM policy created/verified: $IAM_POLICY_NAME"

# Step 3: Get current instance profile and role
print_status $BLUE "📋 Step 3: Configuring deployment server IAM access..."

# Get current instance profile
CURRENT_PROFILE=$(aws ec2 describe-instances \
  --instance-ids $DEPLOYMENT_SERVER_ID \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' \
  --output text \
  --region us-west-1)

if [ "$CURRENT_PROFILE" = "None" ] || [ -z "$CURRENT_PROFILE" ]; then
    print_status $YELLOW "⚠️  No IAM instance profile attached to deployment server"
    print_status $YELLOW "   Creating new role and instance profile..."
    
    # Create IAM role for deployment server
    ROLE_NAME="DeploymentServerDatabaseRole"
    
    cat > /tmp/trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ec2.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
    
    aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document file:///tmp/trust-policy.json \
      --description "Role for deployment server database access" > /dev/null 2>&1 || print_status $YELLOW "   Role may already exist"
    
    # Create instance profile
    aws iam create-instance-profile \
      --instance-profile-name "$ROLE_NAME" > /dev/null 2>&1 || print_status $YELLOW "   Instance profile may already exist"
    
    # Add role to instance profile
    aws iam add-role-to-instance-profile \
      --instance-profile-name "$ROLE_NAME" \
      --role-name "$ROLE_NAME" > /dev/null 2>&1 || print_status $YELLOW "   Role may already be in profile"
    
    # Attach our Secrets Manager policy
    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::$AWS_ACCOUNT_ID:policy/$IAM_POLICY_NAME"
    
    # Attach SSM managed policy (for deployment functionality)
    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
    
    # Associate instance profile with deployment server
    print_status $YELLOW "Associating IAM role with deployment server..."
    aws ec2 associate-iam-instance-profile \
      --instance-id $DEPLOYMENT_SERVER_ID \
      --iam-instance-profile Name="$ROLE_NAME" \
      --region us-west-1
    
    print_status $GREEN "✅ New IAM role created and attached to deployment server"
    
else
    print_status $GREEN "✅ Deployment server already has IAM instance profile"
    
    # Extract role name from profile ARN
    ROLE_NAME=$(echo $CURRENT_PROFILE | sed 's/.*instance-profile\///' | sed 's/\/.*//')
    print_status $BLUE "   Current role: $ROLE_NAME"
    
    # Attach our Secrets Manager policy to existing role
    print_status $YELLOW "Attaching Secrets Manager policy to existing role..."
    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::$AWS_ACCOUNT_ID:policy/$IAM_POLICY_NAME" || print_status $YELLOW "   Policy may already be attached"
    
    print_status $GREEN "✅ Secrets Manager policy attached to existing role"
fi

# Step 4: Test access
print_status $BLUE "📋 Step 4: Testing Secrets Manager access..."

print_status $YELLOW "Testing DEV secret access..."
aws secretsmanager describe-secret \
  --secret-id opuzen-dev-database-credentials \
  --region us-west-1 \
  --query 'Name' \
  --output text > /dev/null && print_status $GREEN "   ✅ DEV secret accessible"

print_status $YELLOW "Testing QA secret access..."
aws secretsmanager describe-secret \
  --secret-id opuzen-qa-database-credentials \
  --region us-west-1 \
  --query 'Name' \
  --output text > /dev/null && print_status $GREEN "   ✅ QA secret accessible"

print_status $YELLOW "Testing PROD secret access..."
aws secretsmanager describe-secret \
  --secret-id opuzen-prod-database-credentials \
  --region us-west-1 \
  --query 'Name' \
  --output text > /dev/null && print_status $GREEN "   ✅ PROD secret accessible"

# Cleanup temp files
rm -f /tmp/secrets-policy.json /tmp/trust-policy.json

print_status $GREEN "🎉 AWS setup completed successfully!"
print_status $BLUE "📋 Next steps:"
print_status $BLUE "   1. Wait 5-10 minutes for IAM changes to propagate"
print_status $BLUE "   2. Test on deployment server with: ssh ubuntu@54.193.129.127"
print_status $BLUE "   3. Run migration test: cd /opuzen-efs/dev/opms-api && ./scripts/migrate-environment.sh auto --dry-run"

print_status $YELLOW "⚠️  Note: It may take 5-10 minutes for IAM role changes to take effect on the EC2 instance."
