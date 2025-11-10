# GitHub Actions Workflow Guide

## Overview

This document explains the GitHub Actions workflow implementation for the OPMS API deployment, including the CI/CD pipeline, automated testing, and deployment automation. The workflow follows the proven pattern established by the existing OPMS infrastructure.

## Workflow Architecture

### **Deployment Model: Deployment Server Architecture**
The workflow uses a **deployment server model** where:
- **GitHub Actions** → **Deployment Server** (`54.193.129.127`) → **EFS Storage** → **ALB Nodes**

### **Key Architecture Points**
- **Code NEVER goes directly to ALB nodes**
- **Deployment server** is the single deployment target
- **EFS sharing** makes code available to all environment instances
- **ALB nodes** access code via EFS mount, not direct Git operations

### **Workflow Files**
- **`.github/workflows/deploy-opms-api.yml`**: Main deployment workflow (active)
- **`.github/workflows/prev/deploy.yml`**: Previous workflow (archived for reference)

### **Workflow Trigger**
```yaml
on:
  push:
    branches:
      - deployDev    # → /opuzen-efs/dev/opms-api/
      - deployQa     # → /opuzen-efs/qa/opms-api/
      - deployProd   # → /opuzen-efs/prod/opms-api/
```

### **Deployment Flow**
1. **Push to branch** → Triggers GitHub Actions
2. **Tests run** → Validate code quality
3. **SSM deployment** → Execute on deployment server
4. **Git operations** → Update repository on deployment server
5. **EFS sync** → Code available to all ALB nodes
6. **Health check** → Verify deployment success

## CI/CD Pipeline Stages

### **Stage 1: Code Checkout**
```yaml
- name: 🚀 Checkout code
  uses: actions/checkout@v4
```
- **Purpose**: Retrieves the latest code from the triggered branch
- **Trigger**: Automatic on push to deployment branches
- **Output**: Source code available for testing and deployment

### **Stage 2: AWS Authentication (OIDC)**
```yaml
- name: 🔐 Configure AWS Credentials (OIDC)
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsRole-TrueNorthDevLLC-opuzen-multi
    aws-region: us-west-1
    role-session-name: GitHubActionsAPIDeploymentSession
```
- **Method**: OpenID Connect (OIDC) - no long-term credentials
- **Security**: Temporary credentials with least-privilege access
- **Scope**: Limited to deployment operations only

### **Stage 3: AWS Connection Verification**
```yaml
- name: ✅ Verify AWS Connection
  run: |
    echo "🔍 Verifying AWS connection..."
    aws sts get-caller-identity
    echo "✅ Successfully authenticated with AWS using OIDC!"
```
- **Purpose**: Validates AWS authentication before proceeding
- **Output**: Confirms successful connection and identity
- **Failure Handling**: Workflow stops if authentication fails

### **Stage 4: Application Deployment**
```yaml
- name: 🚀 Deploy OPMS API to Deployment Server via SSM (No SSH!)
  run: |
    # Complex deployment logic via AWS SSM
```
- **Method**: AWS Systems Manager (SSM) - no SSH required
- **Target**: **Deployment Server** (`54.193.129.127`) specified in `EC2_INSTANCE_ID` secret
- **Process**: Executes deployment commands on deployment server
- **Result**: Code updated on deployment server and shared via EFS to ALB nodes

## Deployment Process Details

### **SSM Command Execution**
The workflow uses AWS SSM to execute deployment commands on the **deployment server**:

```bash
# Send deployment command via SSM to deployment server
COMMAND_ID=$(aws ssm send-command \
  --instance-ids ${{ secrets.EC2_INSTANCE_ID }} \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[...]' \
  --query 'Command.CommandId' \
  --output text)
```

**Note**: The `EC2_INSTANCE_ID` secret contains the deployment server instance ID, not an ALB node.

### **Deployment Commands Sequence**
The SSM execution runs these commands in sequence:

#### **1. Environment Setup**
```bash
export HOME=/root
export USER=root
git config --global --add safe.directory /opuzen-efs/dev/opms-api
git config --global --add safe.directory /opuzen-efs/qa/opms-api
git config --global --add safe.directory /opuzen-efs/prod/opms-api
```

#### **2. Environment Detection**
```bash
WORKFLOW_ENV=$(echo "${{ github.ref_name }}" | sed "s/deploy//g" | tr "[:upper:]" "[:lower:]")
cd /opuzen-efs/$WORKFLOW_ENV/opms-api
```

#### **3. Git Remote Configuration**
```bash
# Configure Git remote for deployment server
git remote set-url origin git@github.com-opuzen-api:PaulKLeasure/opuzen-api.git
```

#### **4. Code Update**
```bash
# Pull latest changes from deployment branch
git fetch origin
git checkout $WORKFLOW_ENV
git pull origin $WORKFLOW_ENV

# Verify code is updated
git log --oneline -3
```

#### **5. EFS Sharing Verification**
```bash
# Ensure code is accessible via EFS
ls -la /opuzen-efs/$WORKFLOW_ENV/opms-api/
echo "Code updated and available via EFS to ALB nodes"
```

#### **5. Dependencies Installation**
```bash
npm ci --only=production
```

#### **6. Application Deployment**
```bash
if [ -f ./deploy_script.sh ]; then 
  ./deploy_script.sh
else 
  pm2 restart opms-api || pm2 start src/index.js --name "opms-api" --env production
fi
```

## Testing Integration

### **Pre-Deployment Testing**
The workflow assumes tests have been run in a separate CI workflow:

```yaml
# Separate test workflow (recommended)
- name: Run Tests
  run: |
    npm ci
    npm test
    npm run test:integration
    npm run test:api
```

### **Test Requirements**
- **Unit Tests**: Must pass for all components
- **Integration Tests**: Service interaction validation
- **API Tests**: Endpoint functionality verification
- **Code Coverage**: Minimum threshold requirements

### **Quality Gates**
- Tests must pass before deployment
- Code coverage requirements enforced
- Linting and formatting checks
- Security vulnerability scanning

## Environment Management

### **Branch-to-Environment Mapping**
```yaml
deployDev  → /opuzen-efs/dev/opms-api/
deployQa   → /opuzen-efs/qa/opms-api/
deployProd → /opuzen-efs/prod/opms-api/
```

### **Environment-Specific Configuration**
- **DEV**: Development and testing environment
- **QA**: Quality assurance and staging
- **PROD**: Production deployment

### **Environment Variables**
```yaml
env:
  DEPLOY_BRANCH_NAME: ${{ github.ref_name }}
  DEPLOY_NODE_WORK_DIR: ${{ vars.DEPLOY_NODE_WORK_DIR }}
  DEPLOY_APP: opms-api
  APP_NAME: opms-api
  WORKFLOW_ENV: ${{ github.ref_name }}
```

## Deployment Server Setup

### **Required Configuration**
The deployment server must be properly configured before the workflow can function:

#### **1. SSH Key Setup**
```bash
# Generate deployment SSH key
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519-api -C "opuzen-api-deployment"

# Add to GitHub as Deploy Key
# Settings → Deploy keys → Add deploy key
# Title: "opuzen-api-deployment"
# Key: [paste public key content]
# Access: Read/write
```

#### **2. SSH Host Configuration**
```bash
# Edit ~/.ssh/config
Host github.com-opuzen-api
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519-api
    IdentitiesOnly yes
```

#### **3. Git Configuration**
```bash
# Set Git identity
git config --global user.name "Deployment Server"
git config --global user.email "deploy@opuzen-api.com"

# Configure safe directories
git config --global --add safe.directory /opuzen-efs/dev/opms-api
git config --global --add safe.directory /opuzen-efs/qa/opms-api
git config --global --add safe.directory /opuzen-efs/prod/opms-api
```

#### **4. Test GitHub Connectivity**
```bash
# Verify SSH connection works
ssh -T git@github.com-opuzen-api

# Expected: "Hi PaulKLeasure/opuzen-api! You've successfully authenticated..."
```

### **Deployment Server Architecture**
- **Instance**: `i-03efd7f3ab0fa76af` (`54.193.129.127`)
- **Role**: Central code deployment and EFS sharing
- **Access**: Receives code via GitHub Actions → SSM
- **Sharing**: Code shared to ALB nodes via EFS mount

## Security Features

### **OIDC Authentication**
- **No Long-term Credentials**: Temporary AWS credentials
- **Least Privilege**: Limited to deployment operations
- **Audit Trail**: All actions logged and traceable
- **Automatic Rotation**: Credentials expire automatically

### **Secrets Management**
```yaml
# Required GitHub Secrets
secrets:
  AWS_ACCOUNT_ID: "992382576482"
  EC2_INSTANCE_ID: "i-03efd7f3ab0fa76ad"
  GITHUB_TOKEN: "Automatic - provided by GitHub"
```

### **Network Security**
- **No SSH Required**: All communication via AWS SSM
- **VPC Isolation**: Instances in private subnets
- **Security Groups**: Restricted access patterns
- **HTTPS Only**: All external communication encrypted

## Monitoring and Observability

### **Workflow Monitoring**
- **GitHub Actions UI**: Real-time workflow execution status
- **Log Aggregation**: Centralized logging for all deployments
- **Status Reporting**: Automatic success/failure notifications
- **Execution History**: Complete audit trail of all deployments

### **Deployment Monitoring**
```yaml
# Get command results
aws ssm get-command-invocation \
  --command-id $COMMAND_ID \
  --instance-id ${{ secrets.EC2_INSTANCE_ID }} \
  --query '[Status,StandardOutputContent,StandardErrorContent]' \
  --output table
```

### **Health Checks**
- **Application Health**: `/api/health` endpoint verification
- **Process Status**: PM2 process monitoring
- **Resource Utilization**: CPU, memory, and disk monitoring
- **Network Connectivity**: Database and external service connectivity

## Error Handling and Rollback

### **Automatic Error Detection**
```yaml
# Check if deployment was successful
STATUS=$(aws ssm get-command-invocation \
  --command-id $COMMAND_ID \
  --instance-id ${{ secrets.EC2_INSTANCE_ID }} \
  --query 'Status' \
  --output text)

if [ "$STATUS" = "Success" ]; then
  echo "✅ OPMS API deployment completed successfully!"
else
  echo "❌ OPMS API deployment failed with status: $STATUS"
  exit 1
fi
```

### **Rollback Strategies**
- **Automatic Rollback**: On deployment failure
- **Manual Rollback**: Git-based rollback to previous commit
- **Health Check Rollback**: If application becomes unhealthy
- **Configuration Rollback**: If environment setup fails

### **Failure Scenarios**
1. **SSM Command Failure**: Workflow stops, manual intervention required
2. **Git Operations Failure**: Check permissions and network connectivity
3. **Dependency Installation Failure**: Verify npm registry access
4. **Application Startup Failure**: Check logs and configuration

## Performance Optimization

### **Workflow Optimization**
- **Parallel Execution**: Independent steps run concurrently
- **Caching**: npm dependencies and build artifacts
- **Resource Allocation**: Appropriate runner specifications
- **Timeout Management**: Reasonable execution timeouts

### **Deployment Optimization**
- **Incremental Updates**: Only changed files deployed
- **Dependency Caching**: npm cache utilization
- **Parallel Processing**: Multiple deployment steps
- **Resource Monitoring**: Track deployment performance

## Troubleshooting Guide

### **Common Issues**

#### **Authentication Failures**
```bash
# Check OIDC role configuration
aws sts get-caller-identity

# Verify role permissions
aws iam get-role --role-name GitHubActionsRole-TrueNorthDevLLC-opuzen-multi
```

#### **SSM Command Failures**
```bash
# Check command status
aws ssm get-command-invocation --command-id <COMMAND_ID> --instance-id <INSTANCE_ID>

# Verify instance connectivity
aws ssm describe-instance-information --filters "Key=InstanceIds,Values=<INSTANCE_ID>"
```

#### **Deployment Failures**
```bash
# Check application logs
tail -f /var/log/app-deployment.log

# Verify PM2 status
pm2 list
pm2 logs
```

### **Debug Commands**
```bash
# Check workflow execution
gh run list --workflow=deploy-opms-api.yml

# View workflow logs
gh run view <RUN_ID> --log

# Rerun failed workflow
gh run rerun <RUN_ID>
```

## Best Practices

### **Workflow Design**
- **Single Responsibility**: Each workflow has a clear purpose
- **Error Handling**: Comprehensive error handling and reporting
- **Idempotency**: Safe to run multiple times
- **Documentation**: Clear inline documentation

### **Security Practices**
- **Least Privilege**: Minimal required permissions
- **Secret Management**: Secure handling of sensitive data
- **Audit Logging**: Complete action tracking
- **Regular Updates**: Keep actions and dependencies current

### **Monitoring Practices**
- **Health Checks**: Regular application health verification
- **Performance Metrics**: Track deployment and runtime performance
- **Alerting**: Proactive notification of issues
- **Documentation**: Maintain troubleshooting guides

## Related Documentation

- [OPMS API Deployment Strategy](./OPMS-API-Deployment-Strategy.md)
- [Unix Permissions Guide](./Unix-Permissions-Guide.md)
- [CloudFormation Setup Guide](../cloudFormation/README-CloudFormation-Setup-Guide.md)
- [Testing Strategy](./Testing-Strategy.md)

---

**Note**: This workflow follows the proven patterns established by the existing OPMS infrastructure, ensuring reliable and secure deployments across all environments.
