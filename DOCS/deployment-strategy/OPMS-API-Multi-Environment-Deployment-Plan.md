# OPMS API Multi-Environment Deployment Strategy

## 🎯 **OVERVIEW & PURPOSE**

This document outlines the comprehensive strategy for combining the deployment automation from `deployDev` with the NetSuite sync features from `syncNetSuiteToOPMS`, creating a robust multi-environment deployment system that maintains clean separation of concerns while providing consistent deployment automation across all environments.

## 📋 **CURRENT STATE ANALYSIS**

### **Branch Status (as of August 31, 2025):**

#### **deployDev Branch (Deployment Foundation)**
- **Status**: ✅ **EXCELLENT** - Production-ready deployment automation
- **Content**: 25+ commits of deployment automation, git commit watcher, GitHub Actions workflows
- **Key Features**:
  - Complete GitHub Actions deployment workflow
  - Git commit watcher with systemd service
  - EFS shared filesystem architecture
  - Automated ALB instance restarts
  - Production-ready deployment strategy

#### **syncNetSuiteToOPMS Branch (Feature Development)**
- **Status**: 🔄 **IN DEVELOPMENT** - NetSuite sync feature ready for testing
- **Content**: Single feature commit (`8b9f134`) + shared documentation
- **Key Features**:
  - NetSuite to OPMS sync system
  - AI model specification
  - Comprehensive documentation

#### **main Branch (Production)**
- **Status**: ⚠️ **POLLUTED** - Contains test commits and deployment automation
- **Issue**: Merge from deployDev brought test artifacts into production

### **Common Ancestor**
Both branches share commit `607dde5` as their common base, making integration straightforward.

## 🏗️ **TARGET ARCHITECTURE**

### **Branch Hierarchy:**
```
main (production application code)
    ↓
deployDev (deployment foundation + features)
    ↓
syncNetSuiteToOPMS (NetSuite feature + deployment)
    ↓
deployQa (QA environment + deployment)
    ↓
deployProd (production environment + deployment)
```

### **Environment Mapping:**
- **deployDev** → **Development** instances on API ALB
- **deployQa** → **QA** instances on API ALB  
- **deployProd** → **Production** instances on API ALB

### **Deployment Logic:**
- **All branches** inherit the same deployment automation
- **Environment-specific** configuration via GitHub Actions
- **Consistent** deployment process across all environments

## 🚀 **IMPLEMENTATION PLAN**

### **Phase 1: Clean Up deployDev (Remove Test Artifacts)**
**Objective**: Remove test commits that shouldn't be in production

**Commits to Remove:**
- `49ec918` - "PKL TEST: Add test text to API documentation title"
- `931bffb` - "PUSH TEST 01: Fully automated deployment test"
- `3dd0609` - "Test git commit watcher automation"

**Commits to Keep:**
- `ecc46de` - AI Model Spec documentation
- `3a8ad99` - Git safe directory fix
- `901dd54` - Git commit watcher
- All deployment automation commits

### **Phase 2: Rebase syncNetSuiteToOPMS onto deployDev**
**Objective**: Integrate NetSuite features with deployment automation

**Process:**
1. Checkout syncNetSuiteToOPMS
2. Rebase onto clean deployDev
3. Resolve any conflicts
4. Verify feature functionality

### **Phase 3: Create Multi-Environment Branches**
**Objective**: Establish QA and Production deployment branches

**New Branches:**
- `deployQa`: QA environment with deployment + features
- `deployProd`: Production environment with deployment + features

### **Phase 4: Update GitHub Actions for Multi-Environment**
**Objective**: Configure workflow to handle multiple environments

**Changes:**
- Environment detection based on branch
- Environment-specific configuration
- Environment-specific secrets and variables

## 🔧 **TECHNICAL IMPLEMENTATION**

### **Step 1: Clean deployDev Branch**
```bash
# Interactive rebase to remove test commits
git checkout deployDev
git rebase -i 607dde5

# Remove test commits, keep production commits
# Save and continue
```

### **Step 2: Rebase syncNetSuiteToOPMS**
```bash
# Rebase feature branch onto clean deployDev
git checkout syncNetSuiteToOPMS
git rebase deployDev

# Resolve any conflicts
# Continue rebase
```

### **Step 3: Create Environment Branches**
```bash
# Create QA branch
git checkout -b deployQa syncNetSuiteToOPMS

# Create production branch
git checkout -b deployProd syncNetSuiteToOPMS
```

### **Step 4: Update GitHub Actions Workflow**
Modify `.github/workflows/deploy-opms-api.yml`:

```yaml
on:
  push:
    branches: [deployDev, deployQa, deployProd]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Determine Environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/deployDev" ]]; then
            echo "ENVIRONMENT=dev"
            echo "EFS_PATH=/opuzen-efs/dev/opms-api"
          elif [[ "${{ github.ref }}" == "refs/heads/deployQa" ]]; then
            echo "ENVIRONMENT=qa"
            echo "EFS_PATH=/opuzen-efs/qa/opms-api"
          elif [[ "${{ github.ref }}" == "refs/heads/deployProd" ]]; then
            echo "ENVIRONMENT=prod"
            echo "EFS_PATH=/opuzen-efs/prod/opms-api"
          fi
```

## 🛡️ **SECURITY & PROTECTION**

### **Environment-Specific Secrets:**
- **deployDev**: Development credentials and configuration
- **deployQa**: QA environment credentials and configuration
- **deployProd**: Production credentials and configuration

### **Branch Protection Rules:**
```yaml
# deployDev: Development testing
- Requires PR reviews
- No direct pushes to main
- Automated testing required

# deployQa: QA validation
- Requires PR reviews
- Automated testing + manual approval
- No direct pushes

# deployProd: Production deployment
- Requires PR reviews
- Automated testing + manual approval
- No direct pushes
- Deployment approval required
```

### **Sensitive File Protection:**
- Environment variables in GitHub Secrets
- Database credentials per environment
- API keys per environment
- Infrastructure details in CloudFormation

## 📊 **DEPLOYMENT WORKFLOW**

### **Development Workflow:**
1. **Feature Development**: Work in feature branches
2. **Integration**: Merge features into deployDev
3. **Testing**: Test in development environment
4. **Validation**: Verify deployment automation works

### **QA Promotion Workflow:**
1. **Feature Complete**: Features ready for QA testing
2. **Merge to deployQa**: Promote from deployDev
3. **QA Testing**: Validate in QA environment
4. **Approval**: QA team approval for production

### **Production Promotion Workflow:**
1. **QA Approved**: Features validated in QA
2. **Merge to deployProd**: Promote from deployQa
3. **Production Deployment**: Automated deployment to production
4. **Monitoring**: Monitor production deployment

## 🔍 **VALIDATION & TESTING**

### **Pre-Implementation Testing:**
- Verify deployDev is in clean state
- Test deployment automation works
- Validate NetSuite sync features

### **Post-Implementation Testing:**
- Verify all environments deploy correctly
- Test environment-specific configuration
- Validate feature functionality in each environment

### **Rollback Plan:**
- Keep original branches as backup
- Document rollback procedures
- Test rollback scenarios

## 📈 **BENEFITS & OUTCOMES**

### **Immediate Benefits:**
1. **Clean Architecture**: Clear separation of concerns
2. **Reusable Deployment**: All branches inherit deployment automation
3. **No Conflicts**: Features and deployment don't interfere
4. **Environment Isolation**: Each environment has dedicated branch

### **Long-term Benefits:**
1. **Scalable Process**: Easy to add new environments
2. **Consistent Quality**: Same deployment process everywhere
3. **Easy Testing**: Features can be tested systematically
4. **Production Safety**: Proper approval gates for production

### **Risk Mitigation:**
1. **No Test Artifacts**: Production branches stay clean
2. **Rollback Capability**: Easy to revert problematic changes
3. **Environment Isolation**: Issues in one environment don't affect others
4. **Approval Gates**: Multiple levels of validation before production

## 📝 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Cleanup**
- [ ] Backup current branches
- [ ] Clean deployDev (remove test commits)
- [ ] Verify deployDev is production-ready
- [ ] Test deployment automation

### **Phase 2: Integration**
- [ ] Rebase syncNetSuiteToOPMS onto deployDev
- [ ] Resolve any conflicts
- [ ] Test NetSuite features with deployment
- [ ] Verify integration works correctly

### **Phase 3: Environment Setup**
- [ ] Create deployQa branch
- [ ] Create deployProd branch
- [ ] Configure environment-specific settings
- [ ] Test each environment

### **Phase 4: Workflow Updates**
- [ ] Update GitHub Actions for multi-environment
- [ ] Configure environment detection
- [ ] Set up environment-specific secrets
- [ ] Test workflow in each environment

### **Phase 5: Validation**
- [ ] Test complete workflow
- [ ] Validate all environments
- [ ] Document procedures
- [ ] Train team on new process

## 🎯 **SUCCESS CRITERIA**

### **Technical Success:**
- [ ] All branches deploy successfully
- [ ] Environment-specific configuration works
- [ ] Features function in all environments
- [ ] Deployment automation is consistent

### **Process Success:**
- [ ] Clear promotion workflow
- [ ] Proper approval gates
- [ ] Easy feature testing
- [ ] Simple rollback procedures

### **Team Success:**
- [ ] Team understands new workflow
- [ ] Deployment process is reliable
- [ ] Feature development is unblocked
- [ ] Production deployments are safe

---

**Document Status**: ✅ **READY FOR IMPLEMENTATION**  
**Last Updated**: August 31, 2025  
**Next Review**: After implementation completion  
**Maintained By**: API Development Team
