# OPMS API Deployment Strategy Documentation

## Overview

This directory contains comprehensive documentation for the OPMS API deployment strategy, including CI/CD pipeline implementation, infrastructure setup, and operational procedures. All documentation follows the proven patterns established by the existing OPMS infrastructure.

## Documentation Index

### **Core Strategy Documents**

#### 1. [OPMS API Deployment Strategy](./OPMS-API-Deployment-Strategy.md)
- **Complete deployment strategy** overview and architecture
- **CI/CD pipeline** explanation with automated testing
- **Infrastructure components** and environment strategy
- **Security considerations** and monitoring approach
- **Troubleshooting guide** and best practices

#### 2. [Unix Permissions Guide](./Unix-Permissions-Guide.md)
- **Detailed explanation** of `drwxrwsr-x (2775)` permissions
- **Sticky bit** functionality and importance
- **Multi-user collaboration** setup for deployment
- **Permission troubleshooting** and verification commands
- **Best practices** for permission management

#### 3. [GitHub Actions Workflow Guide](./GitHub-Actions-Workflow-Guide.md)
- **Workflow implementation** details and architecture
- **CI/CD stages** and deployment process
- **Testing integration** and quality gates
- **Security features** and OIDC authentication
- **Error handling** and rollback strategies
- **Deployment server setup** and SSH key configuration

## Quick Start Guide

### **For Developers**
1. Read [OPMS API Deployment Strategy](./OPMS-API-Deployment-Strategy.md) for overview
2. Review [Unix Permissions Guide](./Unix-Permissions-Guide.md) for setup requirements
3. Understand [GitHub Actions Workflow](./GitHub-Actions-Workflow-Guide.md) for deployment

### **For DevOps Engineers**
1. Follow [OPMS API Deployment Strategy](./OPMS-API-Deployment-Strategy.md) for infrastructure
2. Reference [Unix Permissions Guide](./Unix-Permissions-Guide.md) for permissions
3. Implement [GitHub Actions Workflow](./GitHub-Actions-Workflow-Guide.md) for automation

### **For System Administrators**
1. Review [Unix Permissions Guide](./Unix-Permissions-Guide.md) for system setup
2. Understand [OPMS API Deployment Strategy](./OPMS-API-Deployment-Strategy.md) for architecture
3. Monitor [GitHub Actions Workflow](./GitHub-Actions-Workflow-Guide.md) for deployments

## Troubleshooting Common Issues

### **Deployment Server Issues**
- **Git Repository Not Found**: Check SSH key configuration and GitHub deploy key
- **Permission Denied**: Verify directory permissions and Git safe directory config
- **SSH Connection Failed**: Test SSH connectivity and key permissions
- **Branch Sync Issues**: Ensure deployment server is on correct branch

### **EFS Access Issues**
- **Code Not Visible**: Check EFS mount and permissions on ALB nodes
- **Permission Errors**: Verify `drwxrwsr-x (2775)` permissions
- **File Ownership**: Ensure `ubuntu:www-data` ownership with sticky bit

### **GitHub Actions Issues**
- **OIDC Authentication Failed**: Check IAM role and trust policy
- **SSM Command Failed**: Verify instance ID and SSM agent status
- **Deployment Timeout**: Check network connectivity and instance health

## Related Documentation

### **Infrastructure Setup**
- [CloudFormation Setup Guide](../cloudFormation/README-CloudFormation-Setup-Guide.md)
- [EFS Directory Structure](../EFS-Directory-Structure.md)

### **Testing and Quality**
- [Testing Strategy](../Testing-Strategy.md)
- [Code Quality Standards](../Code-Quality-Standards.md)

### **Operations and Monitoring**
- [Monitoring Strategy](../Monitoring-Strategy.md)
- [Troubleshooting Guide](../Troubleshooting-Guide.md)

## Deployment Architecture

### **Two-Tier Deployment Model**
The system uses a **deployment server architecture**:

1. **Deployment Server** (`54.193.129.127`):
   - Receives code pushes from GitHub Actions
   - Manages Git repository and code updates
   - Shares code via EFS mount to all environment instances

2. **ALB Nodes** (ASG instances):
   - **DO NOT** receive direct code pushes
   - Access application code via EFS mount from deployment server
   - Run the Node.js application using code from shared EFS storage

### **Infrastructure Deployment**
```bash
1. ALB (Application Load Balancer)
2. Launch Template (with user data scripts)
3. Target Group (for routing)
4. Integration (Listener, Rules, ASG)
```

### **Application Deployment**
```bash
1. Push to deployDev/deployQa/deployProd branch
2. GitHub Actions triggers automated deployment
3. AWS SSM executes deployment commands on deployment server
4. Deployment server updates Git repository and EFS
5. ALB nodes automatically access updated code via EFS
6. Application starts with PM2 process manager
7. Health checks verify successful deployment
```

### **Environment Mapping**
- **`deployDev`** → `/opuzen-efs/dev/opms-api/`
- **`deployQa`** → `/opuzen-efs/qa/opms-api/`
- **`deployProd`** → `/opuzen-efs/prod/opms-api/`

## Key Features

### **✅ CI/CD Pipeline**
- Automated testing on every commit
- Quality gates and code coverage requirements
- Branch-based deployment automation
- Automatic rollback on failures

### **✅ Security & Compliance**
- OIDC authentication (no long-term credentials)
- Least-privilege IAM roles
- Encrypted communication and storage
- Comprehensive audit logging

### **✅ GitHub Integration**
- SSH key-based authentication for deployment server
- Deploy key configuration for secure repository access
- Branch-based deployment triggers
- Automated code synchronization via EFS

### **✅ Deployment Server Architecture**
- Centralized code deployment and management
- EFS-based code sharing to all environment instances
- Single source of truth for application code
- Eliminates Git sync issues between multiple instances

### **✅ Monitoring & Observability**
- Real-time deployment status
- Application health monitoring
- Infrastructure performance tracking
- Automated alerting and notifications

### **✅ Reliability & Scalability**
- Auto-scaling based on demand
- Load balancing across instances
- Persistent storage with EFS
- Disaster recovery planning

## Support and Maintenance

### **Documentation Updates**
- Keep documentation current with code changes
- Update troubleshooting guides based on issues
- Maintain best practices and lessons learned
- Regular review and validation

### **Continuous Improvement**
- Monitor deployment success rates
- Optimize workflow performance
- Enhance security measures
- Improve monitoring and alerting

---

**Note**: This documentation follows the proven patterns established by the existing OPMS infrastructure, ensuring reliability and consistency across all environments.

## Quick Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| [OPMS API Deployment Strategy](./OPMS-API-Deployment-Strategy.md) | Complete strategy overview | All stakeholders |
| [Unix Permissions Guide](./Unix-Permissions-Guide.md) | System permissions setup | DevOps, SysAdmins |
| [GitHub Actions Workflow Guide](./GitHub-Actions-Workflow-Guide.md) | CI/CD implementation | Developers, DevOps |
