# Environment-Aware Database Migration Setup

**Date:** January 19, 2025  
**Version:** 1.0.0  
**Status:** Ready for Implementation  
**Purpose:** Setup path-based environment detection and AWS Secrets Manager access for database migrations

## 🎯 **SOLUTION OVERVIEW**

This setup enables the deployment server to run database migrations for all environments by:
1. **Path-based environment detection** - Automatically detects dev/qa/prod from EFS directory structure
2. **AWS Secrets Manager integration** - Retrieves environment-specific database credentials
3. **Consistent migration interface** - Single script works across all environments

## 🏗️ **ARCHITECTURE**

### **Environment Detection Strategy**
```bash
# Working directory determines environment:
/opuzen-efs/dev/opms-api/   → Development (opuzen_dev_master_app)
/opuzen-efs/qa/opms-api/    → QA (opuzen_qa_master_app)  
/opuzen-efs/prod/opms-api/  → Production (opuzen_prod_master_app)
Other paths                 → Local development
```

### **Credentials Strategy**
```bash
# AWS Secrets Manager secrets:
opuzen-dev-database-credentials   → Development database
opuzen-qa-database-credentials    → QA database
opuzen-prod-database-credentials  → Production database
```

## 🔧 **IMPLEMENTATION STEPS**

### **Step 1: Deploy IAM Permissions** (Requires AWS Admin)

**Deploy CloudFormation stack:**
```bash
aws cloudformation deploy \
  --template-file DOCS/cloudFormation/deployment-server-secrets-access.yaml \
  --stack-name opuzen-deployment-server-secrets \
  --parameter-overrides \
    AWSAccountId=YOUR_AWS_ACCOUNT_ID \
    DatabaseUsername=YOUR_DB_USERNAME \
    DatabasePassword=YOUR_DB_PASSWORD \
    DatabaseHost=YOUR_DB_HOST \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-west-1
```

### **Step 2: Attach IAM Role to Deployment Server** (Requires AWS Admin)

**Option A: Via AWS Console**
1. Go to EC2 → Instances
2. Select deployment server (`i-03efd7f3ab0fa76af`)
3. Actions → Security → Modify IAM role
4. Select: `DeploymentServerDatabaseAccess`
5. Save changes

**Option B: Via AWS CLI**
```bash
# Associate instance profile with deployment server
aws ec2 associate-iam-instance-profile \
  --instance-id i-03efd7f3ab0fa76af \
  --iam-instance-profile Name=DeploymentServerDatabaseProfile \
  --region us-west-1
```

### **Step 3: Create Database Secrets** (If not already existing)

**Development Environment:**
```bash
aws secretsmanager create-secret \
  --name "opuzen-dev-database-credentials" \
  --description "Database credentials for OPMS API development environment" \
  --secret-string '{"username":"YOUR_DB_USER","password":"YOUR_DB_PASSWORD","host":"YOUR_DB_HOST","port":"3306"}' \
  --region us-west-1
```

**QA Environment:**
```bash
aws secretsmanager create-secret \
  --name "opuzen-qa-database-credentials" \
  --description "Database credentials for OPMS API QA environment" \
  --secret-string '{"username":"YOUR_DB_USER","password":"YOUR_DB_PASSWORD","host":"YOUR_DB_HOST","port":"3306"}' \
  --region us-west-1
```

**Production Environment:**
```bash
aws secretsmanager create-secret \
  --name "opuzen-prod-database-credentials" \
  --description "Database credentials for OPMS API production environment" \
  --secret-string '{"username":"YOUR_DB_USER","password":"YOUR_DB_PASSWORD","host":"YOUR_DB_HOST","port":"3306"}' \
  --region us-west-1
```

### **Step 4: Test Setup** (Deployment Server)

**Verify AWS access:**
```bash
# SSH to deployment server
ssh ubuntu@54.193.129.127

# Test AWS CLI access
aws sts get-caller-identity

# Test Secrets Manager access
aws secretsmanager describe-secret --secret-id opuzen-dev-database-credentials --region us-west-1
```

**Test environment detection:**
```bash
# Test DEV environment detection
cd /opuzen-efs/dev/opms-api/
./scripts/migrate-environment.sh auto --dry-run

# Test QA environment detection  
cd /opuzen-efs/qa/opms-api/
./scripts/migrate-environment.sh auto --dry-run

# Test PROD environment detection
cd /opuzen-efs/prod/opms-api/
./scripts/migrate-environment.sh auto --dry-run
```

## 🚀 **USAGE AFTER SETUP**

### **Simple Migration Commands**

**Development Environment:**
```bash
# SSH to deployment server
ssh ubuntu@54.193.129.127

# Navigate to DEV and migrate
cd /opuzen-efs/dev/opms-api/
./scripts/migrate-environment.sh auto
```

**QA Environment:**
```bash
# SSH to deployment server
ssh ubuntu@54.193.129.127

# Navigate to QA and migrate  
cd /opuzen-efs/qa/opms-api/
./scripts/migrate-environment.sh auto
```

**Production Environment:**
```bash
# SSH to deployment server
ssh ubuntu@54.193.129.127

# Navigate to PROD and migrate (requires confirmation)
cd /opuzen-efs/prod/opms-api/
./scripts/migrate-environment.sh auto
```

### **Advanced Usage**

**Dry Run (Safe Testing):**
```bash
./scripts/migrate-environment.sh auto --dry-run
```

**Explicit Environment:**
```bash
./scripts/migrate-environment.sh dev
./scripts/migrate-environment.sh qa  
./scripts/migrate-environment.sh prod
```

**Help and Options:**
```bash
./scripts/migrate-environment.sh --help
```

## 🛡️ **SAFETY FEATURES**

### **Built-in Safety Checks**
- ✅ **Production confirmation** - Requires typing "YES" for prod migrations
- ✅ **Prerequisites validation** - Checks AWS CLI, Node.js, project structure
- ✅ **Dry run mode** - Preview changes without executing
- ✅ **Error handling** - Exits on any failure
- ✅ **Audit logging** - All actions logged with timestamps

### **Rollback Protection**
- ✅ **Additive only** - Never modifies existing tables
- ✅ **Transaction safety** - Each migration runs in transaction
- ✅ **Rollback available** - `--reset` option for emergency rollback

## 📋 **DEPLOYMENT CHECKLIST**

### **AWS Setup** (One-time, requires AWS Admin)
- [ ] Deploy CloudFormation stack for IAM permissions
- [ ] Attach IAM role to deployment server instance
- [ ] Create database secrets in AWS Secrets Manager
- [ ] Test Secrets Manager access from deployment server

### **Code Deployment** (Per environment)
- [ ] Ensure latest code deployed to EFS directories
- [ ] Verify migration scripts are present in each environment
- [ ] Test dry-run mode before actual migration
- [ ] Execute migration with environment auto-detection

### **Validation** (Post-migration)
- [ ] Verify new tables created in correct database
- [ ] Test API functionality with new tables
- [ ] Confirm original OPMS tables unchanged
- [ ] Validate environment-specific configurations

## 🔍 **TROUBLESHOOTING**

### **Common Issues**

#### **Issue 1: AWS Secrets Manager Access Denied**
**Symptoms**: `AccessDenied` error when retrieving secrets  
**Solution**: Verify IAM role attached to deployment server and permissions are correct

#### **Issue 2: Environment Not Detected**
**Symptoms**: Script defaults to local development  
**Solution**: Ensure you're running from correct EFS directory path

#### **Issue 3: Database Connection Failed**
**Symptoms**: Migration fails with connection error  
**Solution**: Verify database credentials in Secrets Manager and network connectivity

### **Debug Commands**

**Test environment detection:**
```bash
node -e "
const { detectEnvironmentFromPath } = require('./src/db/migrate-env-aware');
console.log('Detected environment:', detectEnvironmentFromPath());
console.log('Current path:', process.cwd());
"
```

**Test AWS access:**
```bash
aws secretsmanager get-secret-value \
  --secret-id opuzen-dev-database-credentials \
  --region us-west-1 \
  --query 'SecretString' \
  --output text
```

## 📈 **BENEFITS**

### **Operational Benefits**
- ✅ **Single command** migrates any environment
- ✅ **No manual credential management** on deployment server
- ✅ **Automatic environment detection** prevents mistakes
- ✅ **Consistent process** across all environments

### **Security Benefits**
- ✅ **Centralized credential management** via AWS Secrets Manager
- ✅ **No hardcoded credentials** in scripts or configuration
- ✅ **Audit trail** for all database access
- ✅ **Least privilege access** - only necessary permissions granted

### **Maintenance Benefits**
- ✅ **Self-documenting** - Environment detected from path
- ✅ **Easy troubleshooting** - Clear error messages and logging
- ✅ **Scalable** - Easy to add new environments
- ✅ **Testable** - Dry-run mode for safe testing

---

## 📝 **NEXT STEPS**

1. **Review and approve** this setup approach
2. **Deploy CloudFormation stack** for IAM permissions
3. **Test environment detection** with dry-run mode
4. **Execute migrations** starting with development environment

**Following .cursorrules.mdc**: This setup requires your **explicit approval** before deployment to AWS infrastructure.

---

**Document Status**: ✅ **READY FOR IMPLEMENTATION**  
**Requires Approval From**: AWS Administrator / Project Owner  
**Next Step**: Deploy CloudFormation stack and test setup  
**Maintained By**: API Development Team
