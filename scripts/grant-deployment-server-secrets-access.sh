#!/bin/bash

# Grant Deployment Server Access to Existing Database Secret
# Uses existing RDS secret instead of creating new ones

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

print_status $BLUE "🚀 Granting deployment server access to existing database secret..."

# Configuration
DEPLOYMENT_SERVER_ID="i-03efd7f3ab0fa76ad"
EXISTING_SECRET_ARN="arn:aws:secretsmanager:us-west-1:992382576482:secret:rdscluster-2cc47963-bf79-4426-8b61-6aac4f194a15-BS8pVs"
AWS_ACCOUNT_ID="992382576482"
REGION="us-west-1"

print_status $GREEN "✅ Deployment Server: $DEPLOYMENT_SERVER_ID"
print_status $GREEN "✅ Database Secret: rdscluster-2cc47963-bf79-4426-8b61-6aac4f194a15"

# Step 1: Create IAM policy for existing secret access
print_status $BLUE "📋 Step 1: Creating IAM policy for existing secret access..."

IAM_POLICY_NAME="DeploymentServerExistingSecretsAccess"

# Create IAM policy document for existing secret
cat > /tmp/existing-secrets-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowExistingSecretAccess",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret"
            ],
            "Resource": [
                "$EXISTING_SECRET_ARN"
            ]
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
                    "kms:ViaService": "secretsmanager.$REGION.amazonaws.com"
                }
            }
        }
    ]
}
EOF

# Create IAM policy
aws iam create-policy \
  --policy-name "$IAM_POLICY_NAME" \
  --policy-document file:///tmp/existing-secrets-policy.json \
  --description "Allows deployment server to access existing RDS database secret" \
  --region $REGION > /dev/null 2>&1 || print_status $YELLOW "   Policy may already exist"

print_status $GREEN "✅ IAM policy created/verified: $IAM_POLICY_NAME"

# Step 2: Get or create IAM role for deployment server
print_status $BLUE "📋 Step 2: Configuring deployment server IAM access..."

# Check if deployment server has an instance profile
CURRENT_PROFILE=$(aws ec2 describe-instances \
  --instance-ids $DEPLOYMENT_SERVER_ID \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn' \
  --output text \
  --region $REGION 2>/dev/null || echo "None")

if [ "$CURRENT_PROFILE" = "None" ] || [ -z "$CURRENT_PROFILE" ]; then
    print_status $YELLOW "⚠️  No IAM instance profile attached to deployment server"
    print_status $YELLOW "   Creating new role and instance profile..."
    
    # Create IAM role for deployment server
    ROLE_NAME="DeploymentServerRole"
    
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
      --description "Role for deployment server with database and SSM access" > /dev/null 2>&1 || print_status $YELLOW "   Role may already exist"
    
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
      --region $REGION
    
    print_status $GREEN "✅ New IAM role created and attached to deployment server"
    
else
    print_status $GREEN "✅ Deployment server already has IAM instance profile"
    print_status $BLUE "   Current profile: $CURRENT_PROFILE"
    
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

# Step 3: Test access to existing secret
print_status $BLUE "📋 Step 3: Testing access to existing database secret..."

print_status $YELLOW "Testing RDS secret access..."
SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "rdscluster-2cc47963-bf79-4426-8b61-6aac4f194a15" \
  --region $REGION \
  --query 'SecretString' \
  --output text 2>/dev/null || echo "FAILED")

if [ "$SECRET_VALUE" != "FAILED" ]; then
    print_status $GREEN "   ✅ RDS secret accessible"
    
    # Parse and validate secret structure
    DB_HOST=$(echo $SECRET_VALUE | jq -r '.host // empty' 2>/dev/null || echo "")
    DB_USERNAME=$(echo $SECRET_VALUE | jq -r '.username // empty' 2>/dev/null || echo "")
    
    if [ -n "$DB_HOST" ] && [ -n "$DB_USERNAME" ]; then
        print_status $GREEN "   ✅ Secret contains valid database credentials"
        print_status $BLUE "      Host: $DB_HOST"
        print_status $BLUE "      Username: $DB_USERNAME"
    else
        print_status $YELLOW "   ⚠️  Secret structure may need validation"
    fi
else
    print_status $RED "   ❌ Cannot access RDS secret - IAM permissions may need time to propagate"
fi

# Cleanup temp files
rm -f /tmp/existing-secrets-policy.json /tmp/trust-policy.json

print_status $GREEN "🎉 Setup completed!"
print_status $BLUE "📋 Next steps:"
print_status $BLUE "   1. Wait 5-10 minutes for IAM changes to propagate to EC2 instance"
print_status $BLUE "   2. SSH to deployment server: ssh ubuntu@54.193.129.127"
print_status $BLUE "   3. Test migration: cd /opuzen-efs/dev/opms-api && ./scripts/migrate-environment.sh auto --dry-run"
print_status $BLUE "   4. If successful, run actual migration: ./scripts/migrate-environment.sh auto"

print_status $YELLOW "⚠️  Note: IAM role changes may take 5-10 minutes to take effect on the EC2 instance."
print_status $YELLOW "⚠️  If access fails initially, wait and try again."
