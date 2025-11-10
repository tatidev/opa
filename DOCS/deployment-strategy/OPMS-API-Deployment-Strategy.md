# OPMS API Deployment Strategy

## Overview

This document outlines the complete deployment strategy for the OPMS API, including the CI/CD pipeline, infrastructure setup, and deployment workflow. The system follows a proven pattern established by the existing OPMS infrastructure, ensuring reliability and consistency across environments.

## Architecture Overview

### Infrastructure Components
- **Application Load Balancer (ALB)**: Routes traffic to different environments
- **Auto Scaling Groups (ASG)**: Manages EC2 instances per environment
- **Launch Templates**: Define instance configuration and user data scripts
- **Target Groups**: Route traffic to specific environment instances
- **EFS Storage**: Persistent file storage shared across instances
- **GitHub Actions**: Automated CI/CD pipeline
- **Deployment Server**: Central server that receives code updates and shares via EFS

### Deployment Architecture
The system uses a **two-tier deployment model**:

1. **Deployment Server** (`54.193.129.127`):
   - Receives code pushes from GitHub Actions
   - Manages Git repository and code updates
   - Shares code via EFS mount to all environment instances

2. **ALB Nodes** (ASG instances):
   - **DO NOT** receive direct code pushes
   - Access application code via EFS mount from deployment server
   - Run the Node.js application using code from shared EFS storage

This architecture ensures:
- **Single source of truth** for code deployment
- **Consistent codebase** across all instances
- **Eliminates sync issues** between multiple Git repositories
- **Simplified deployment management** through centralized control

### Environment Strategy
- **DEV**: `/opuzen-efs/dev/opms-api/` - Development and testing
- **QA**: `/opuzen-efs/qa/opms-api/` - Quality assurance
- **PROD**: `/opuzen-efs/prod/opms-api/` - Production deployment

## GitHub Configuration & SSH Key Setup

### Repository Structure
- **Repository**: `PaulKLeasure/opuzen-api`
- **Deployment Branches**: 
  - `deployDev` → Development environment
  - `deployQa` → QA environment  
  - `deployProd` → Production environment
- **Main Branch**: `master` (development work)

### SSH Key Configuration

#### **1. Generate Deployment SSH Key**
```bash
# On deployment server (54.193.129.127)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519-api -C "opuzen-api-deployment"
```

#### **2. Add Public Key to GitHub**
```bash
# Copy public key content
cat ~/.ssh/id_ed25519-api.pub

# Add to GitHub repository as Deploy Key:
# Settings → Deploy keys → Add deploy key
# Title: "opuzen-api-deployment"
# Key: [paste public key content]
# Access: Read/write
```

#### **3. Configure SSH Host**
```bash
# On deployment server, edit ~/.ssh/config
Host github.com-opuzen-api
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519-api
    IdentitiesOnly yes
```

#### **4. Update Git Remote**
```bash
# On deployment server, in /opuzen-efs/dev/opms-api/
git remote set-url origin git@github.com-opuzen-api:PaulKLeasure/opuzen-api.git
```

#### **5. Test SSH Connection**
```bash
# Verify GitHub authentication
ssh -T git@github.com-opuzen-api

# Expected output: "Hi PaulKLeasure/opuzen-api! You've successfully authenticated..."
```

### GitHub Actions OIDC Configuration

#### **1. AWS OIDC Provider Setup**
```yaml
# In AWS IAM, create OIDC provider
Provider URL: https://token.actions.githubusercontent.com
Audience: sts.amazonaws.com
```

#### **2. IAM Role for GitHub Actions**
```yaml
# Trust policy for GitHub Actions
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:PaulKLeasure/opuzen-api:ref:refs/heads/deployDev"
        }
      }
    }
  ]
}
```

#### **3. Required Permissions**
```yaml
# IAM policies for deployment
- ssm:SendCommand
- ssm:GetCommandInvocation
- ec2:DescribeInstances
- iam:PassRole
```

### Repository Security

#### **1. Environment File Protection**
```bash
# .gitignore configuration
*.env
!*.env.template
!*.env.example

# Never commit actual credentials
# Use environment variables or AWS Secrets Manager
```

#### **2. Credential Rotation**
- **NetSuite Sandbox**: Rotate OAuth tokens regularly
- **Database Credentials**: Use AWS Secrets Manager
- **API Keys**: Store in environment variables
- **SSH Keys**: Rotate deployment keys annually

## CI/CD Pipeline

### Continuous Integration (CI)
The system implements automated testing and validation:

#### **Automated Tests**
- **Unit Tests**: Run on every commit to validate individual components
- **Integration Tests**: Verify component interactions
- **API Tests**: Ensure endpoints function correctly
- **Database Tests**: Validate data operations

#### **Test Execution**
```bash
# Tests run automatically in GitHub Actions
npm test                    # Unit tests
npm run test:integration   # Integration tests
npm run test:api          # API endpoint tests
npm run test:db           # Database tests
```

#### **Quality Gates**
- All tests must pass before deployment
- Code coverage requirements enforced
- Linting and formatting checks
- Security vulnerability scanning

### Continuous Deployment (CD)
Automated deployment pipeline triggered by branch pushes:

#### **Branch-Based Deployment**
- **`deployDev`** → `/opuzen-efs/dev/opms-api/`
- **`deployQa`** → `/opuzen-efs/qa/opms-api/`
- **`deployProd`** → `/opuzen-efs/prod/opms-api/`

#### **Deployment Flow**
1. **Code Push** → GitHub repository
2. **Automated Testing** → Run test suite
3. **Build Process** → Install dependencies
4. **Deployment** → AWS SSM execution
5. **Health Check** → Verify application status
6. **Rollback** → Automatic if deployment fails

## Deployment Workflow

### 1. **Infrastructure Deployment** (CloudFormation)
Follow the [CloudFormation Setup Guide](../cloudFormation/README-CloudFormation-Setup-Guide.md) to deploy the infrastructure:

```bash
# Deploy in order:
1. ALB (Application Load Balancer)
2. Launch Template (with user data scripts)
3. Target Group (for routing)
4. Integration (Listener, Rules, ASG)
```

### 2. **Application Deployment** (GitHub Actions)
The automated deployment process follows a **deployment server model**:

#### **Deployment Flow**
1. **Code Push** → `deployDev`/`deployQa`/`deployProd` branch
2. **GitHub Actions** → Runs tests and validation
3. **AWS SSM** → Executes deployment commands on deployment server
4. **Deployment Server** → Updates local repository and EFS
5. **ALB Nodes** → Automatically access updated code via EFS mount

#### **Key Architecture Points**
- **Code NEVER goes directly to ALB nodes**
- **Deployment server** (`54.193.129.127`) is the single deployment target
- **EFS sharing** makes code available to all environment instances
- **No Git operations** performed on ALB nodes

#### **Trigger Conditions**
- Push to `deployDev`, `deployQa`, or `deployProd` branch
- All tests must pass
- No merge conflicts
- Valid configuration

#### **Deployment Steps**
```yaml
# From .github/workflows/deploy-opms-api.yml
1. Checkout code
2. Configure AWS credentials (OIDC)
3. Execute deployment via SSM on deployment server
4. Update Git repository on deployment server
5. Verify deployment success
6. Report deployment status
```

### 3. **Instance Configuration** (User Data Scripts)
Three-phase initialization process:

#### **Phase 1: Base Setup**
- EFS mounting and verification
- Database secrets retrieval
- CodeDeploy agent installation
- SSH configuration

#### **Phase 2: Node.js Installation**
- Node.js 18.x LTS installation
- PM2 process manager setup
- Build tools and dependencies
- Environment configuration

#### **Phase 3: Application Deployment**
- Repository cloning
- Dependency installation
- Environment file creation
- Application startup and health checks

## Permission System

### Critical Permission Configuration
The deployment relies on specific Unix permissions to enable multi-user collaboration. See the [Unix Permissions Guide](./Unix-Permissions-Guide.md) for detailed explanation.

#### **Key Permission Pattern**
```bash
drwxrwsr-x (2775) - Group writeable with sticky bit
```

#### **Why This Matters**
- **`ubuntu` user**: Deploys code and manages application
- **`www-data` group**: Web server access and file serving
- **Sticky bit**: Ensures proper group inheritance for new files
- **Collaboration**: Both users can work in the same directory

### Permission Setup Commands
```bash
# Set directory permissions
chmod 2775 /opuzen-efs/dev/opms-api/
chown ubuntu:www-data /opuzen-efs/dev/opms-api/

# Configure Git safe directory (on deployment server)
git config --global --add safe.directory /opuzen-efs/dev/opms-api

# Set recursive permissions for Node.js application
find /opuzen-efs/dev/opms-api -type d -exec chmod 2775 {} \;
find /opuzen-efs/dev/opms-api -name '*.js' -exec chmod 755 {} \;
find /opuzen-efs/dev/opms-api -type f ! -name '*.js' ! -name '*.sh' -exec chmod 664 {} \;
```

### Deployment Server Setup
The deployment server requires specific configuration for the deployment workflow:

#### **1. Directory Structure**
```bash
/opuzen-efs/dev/opms-api/          # Development environment
/opuzen-efs/qa/opms-api/           # QA environment
/opuzen-efs/prod/opms-api/         # Production environment
```

#### **2. Git Configuration**
```bash
# Set Git user identity
git config --global user.name "Deployment Server"
git config --global user.email "deploy@opuzen-api.com"

# Configure safe directories for all environments
git config --global --add safe.directory /opuzen-efs/dev/opms-api
git config --global --add safe.directory /opuzen-efs/qa/opms-api
git config --global --add safe.directory /opuzen-efs/prod/opms-api
```

#### **3. SSH Key Management**
```bash
# Ensure SSH key permissions are correct
chmod 600 ~/.ssh/id_ed25519-api
chmod 644 ~/.ssh/id_ed25519-api.pub
chmod 700 ~/.ssh/

# Test GitHub connectivity
ssh -T git@github.com-opuzen-api
```

## Testing Strategy

### **Pre-Deployment Testing**
- **Unit Tests**: Component-level validation
- **Integration Tests**: Service interaction verification
- **API Tests**: Endpoint functionality and response validation
- **Security Tests**: Vulnerability scanning and access control

### **Post-Deployment Testing**
- **Health Checks**: Application availability verification
- **Smoke Tests**: Basic functionality validation
- **Performance Tests**: Response time and throughput
- **User Acceptance Tests**: Business logic validation

### **Test Automation**
```yaml
# GitHub Actions test workflow
- name: Run Tests
  run: |
    npm ci
    npm run test:all
    npm run test:coverage
```

## Monitoring and Observability

### **Application Monitoring**
- **PM2 Process Manager**: Application lifecycle management
- **Health Endpoints**: `/api/health` for status checks
- **Log Aggregation**: Centralized logging via CloudWatch
- **Metrics Collection**: Performance and usage data

### **Infrastructure Monitoring**
- **CloudWatch Alarms**: Resource utilization and health
- **Auto Scaling**: Automatic instance scaling based on demand
- **Load Balancer Health**: Target group health monitoring
- **EFS Monitoring**: Storage performance and availability

## Security Considerations

### **Authentication & Authorization**
- **OIDC Integration**: GitHub Actions to AWS authentication
- **IAM Roles**: Least-privilege access for instances
- **Secrets Management**: Database credentials via AWS Secrets Manager
- **Network Security**: Security groups and VPC isolation

### **Data Protection**
- **Encryption at Rest**: EFS and RDS encryption
- **Encryption in Transit**: HTTPS/TLS for all communications
- **Access Control**: Role-based permissions and network restrictions
- **Audit Logging**: Comprehensive activity tracking

## Rollback Strategy

### **Automatic Rollback**
- **Health Check Failures**: Automatic rollback on deployment issues
- **Test Failures**: Deployment blocked if tests don't pass
- **Configuration Errors**: Validation before deployment execution

### **Manual Rollback**
```bash
# Rollback to previous deployment
git checkout <previous-commit>
git push origin deployDev --force

# Or restore from backup
aws s3 cp s3://backup-bucket/previous-version ./previous-version
```

## Performance Optimization

### **Application Performance**
- **PM2 Clustering**: Multi-process Node.js deployment
- **Connection Pooling**: Database connection optimization
- **Caching Strategy**: Redis or in-memory caching
- **CDN Integration**: Static asset delivery optimization

### **Infrastructure Performance**
- **Auto Scaling**: Dynamic instance management
- **Load Balancing**: Traffic distribution across instances
- **EFS Optimization**: Storage performance tuning
- **Network Optimization**: VPC and subnet configuration

## Troubleshooting Guide

### **Common Issues**

#### **Deployment Failures**
- Check GitHub Actions logs for error details
- Verify AWS credentials and permissions
- Ensure target directory exists with correct permissions
- Validate user data script execution

#### **Deployment Server Issues**
- **Git Repository Not Found**: Check SSH key configuration and GitHub deploy key
- **Permission Denied**: Verify directory permissions and Git safe directory config
- **SSH Connection Failed**: Test SSH connectivity and key permissions
- **Branch Sync Issues**: Ensure deployment server is on correct branch

#### **Permission Issues**
- Reference [Unix Permissions Guide](./Unix-Permissions-Guide.md)
- Verify directory ownership and permissions
- Check Git safe directory configuration
- Ensure proper group membership

#### **Application Issues**
- Check PM2 process status
- Review application logs
- Verify environment variables
- Test database connectivity

### **Debug Commands**
```bash
# Check application status
pm2 list
pm2 logs

# Verify permissions
ls -la /opuzen-efs/dev/opms-api/

# Check Git configuration
git config --list | grep safe.directory

# Monitor deployment
tail -f /var/log/app-deployment.log

# Deployment server diagnostics
ssh ubuntu@54.193.129.127 "cd /opuzen-efs/dev/opms-api && git status"
ssh ubuntu@54.193.129.127 "cd /opuzen-efs/dev/opms-api && git remote -v"
ssh ubuntu@54.193.129.127 "ssh -T git@github.com-opuzen-api"

# EFS access verification (from ALB node)
ssh ubuntu@54.183.169.238 "ls -la /opuzen-efs/dev/opms-api/"
ssh ubuntu@54.183.169.238 "cd /opuzen-efs/dev/opms-api && git log --oneline -3"
```

## Best Practices

### **Development Workflow**
- **Feature Branches**: Develop in feature branches, merge to deployment branches
- **Code Review**: Require pull request reviews before merging
- **Testing**: Write tests for all new functionality
- **Documentation**: Update documentation with code changes

### **Deployment Practices**
- **Blue-Green Deployment**: Consider for zero-downtime updates
- **Canary Releases**: Gradual rollout for risk mitigation
- **Monitoring**: Watch metrics during and after deployment
- **Communication**: Notify stakeholders of deployment status

### **Infrastructure Management**
- **Infrastructure as Code**: Use CloudFormation for all resources
- **Version Control**: Track infrastructure changes in Git
- **Backup Strategy**: Regular backups of critical data
- **Disaster Recovery**: Plan for infrastructure failures

## Related Documentation

- [Unix Permissions Guide](./Unix-Permissions-Guide.md)
- [CloudFormation Setup Guide](../cloudFormation/README-CloudFormation-Setup-Guide.md)
- [GitHub Actions Workflow Guide](./GitHub-Actions-Workflow-Guide.md)
- [EFS Directory Structure](./EFS-Directory-Structure.md)
- [Testing Strategy](./Testing-Strategy.md)

---

**Note**: This deployment strategy follows the proven patterns established by the existing OPMS infrastructure, ensuring reliability and consistency across all environments.
