# ALB Node Deployment Scripts

## 🎯 Overview

These scripts automatically deploy code updates to your ALB (Application Load Balancer) nodes when code is pushed to the EFS server. They solve the problem of code being updated on EFS but not deployed to the running ALB instances.

## 🏗️ How It Works

```
Code Push → EFS Server → ALB Node Detection → Sequential Deployment → Health Verification
```

1. **Detects ALB nodes** automatically using AWS CLI
2. **Finds healthy instances** in your target group
3. **Deploys to each node** sequentially (one at a time)
4. **Fixes permissions** and installs dependencies
5. **Restarts the application** with new code
6. **Verifies health** of each deployment

## 📁 Scripts

### **`deploy-to-alb-nodes.sh`** - Main Deployment Script
- **Full-featured** deployment script with error handling
- **Automatic ALB detection** and node discovery
- **Sequential deployment** to prevent conflicts
- **Comprehensive logging** and status reporting

### **`deploy.sh`** - Simple Wrapper
- **Easy-to-use** wrapper script
- **Calls the main script** with proper parameters
- **Simple syntax** for quick deployments

## 🚀 Usage

### **Basic Deployment (Dev Environment)**
```bash
./scripts/deploy.sh dev
```

### **Specific Environment**
```bash
./scripts/deploy.sh qa
./scripts/deploy.sh prod
```

### **Direct Usage**
```bash
./scripts/deploy-to-alb-nodes.sh dev
```

## ⚙️ Configuration

### **Environment Variables**
```bash
export AWS_PROFILE=aws_cli_admin
export AWS_REGION=us-west-1
```

### **Script Configuration**
```bash
# Edit these variables in deploy-to-alb-nodes.sh
ALB_NAME="ALB-OPMS-API-ALL"
TARGET_GROUP_NAME="TG-OPMS-API-DEV"
EFS_PATH="/opuzen-efs/${ENVIRONMENT}/opms-api"
```

## 🔧 Prerequisites

### **Required Software**
- **AWS CLI** - For AWS API access
- **jq** - For JSON parsing
- **Bash** - For script execution

### **AWS Permissions**
- **EC2** - Describe instances
- **ELBv2** - Describe load balancers and target groups
- **SSM** - Send commands to instances
- **IAM** - Instance profile with SSM access

### **Instance Requirements**
- **SSM Agent** - Must be running on ALB instances
- **Proper IAM Role** - For SSM command execution
- **EFS Access** - Mounted at `/opuzen-efs/`

## 📋 What the Script Does

### **1. Discovery Phase**
- Finds your ALB by name
- Identifies the target group
- Discovers healthy instances
- Gets instance details (ID, IP, name)

### **2. Deployment Phase**
- **Sequential execution** (one instance at a time)
- **Git pull** from deployDev branch
- **Permission fixes** (critical for npm install)
- **Dependency installation** (npm install)
- **Application restart** (using restart.sh or manual)
- **Health verification** (process + endpoint check)

### **3. Verification Phase**
- Checks if Node.js process is running
- Tests health endpoint (`/api/health`)
- Reports success/failure for each instance
- Provides deployment summary

## 🚨 Error Handling

### **Automatic Retries**
- **SSM command failures** are detected and reported
- **Deployment failures** don't stop other instances
- **Detailed error logs** for troubleshooting

### **Common Issues & Solutions**
- **Permission denied** → Script fixes ownership automatically
- **npm install fails** → Script retries with proper permissions
- **App won't start** → Script provides detailed error logs
- **SSM timeout** → Script waits and reports status

## 📊 Output & Logging

### **Colored Output**
- **🔵 Blue** - Information messages
- **🟢 Green** - Success messages
- **🟡 Yellow** - Warning messages
- **🔴 Red** - Error messages

### **Logging Levels**
- **Instance discovery** - Shows found instances
- **Deployment progress** - Shows current instance being deployed
- **Success/failure** - Clear status for each instance
- **Summary report** - Final deployment statistics

## 🔄 Integration with GitHub Actions

### **Post-Push Deployment**
```bash
# After pushing code to deployDev branch
git push origin deployDev

# Then deploy to ALB nodes
./scripts/deploy.sh dev
```

### **Automated Workflow**
1. **Code pushed** to GitHub
2. **EFS server** pulls latest code
3. **Run deployment script** to update ALB nodes
4. **All instances** get the latest code and restart

## 🎯 Benefits

### **Solves Your Current Problem**
- ✅ **No more 502 errors** after code updates
- ✅ **Automatic permission fixes** (npm install works)
- ✅ **Sequential deployment** (no conflicts)
- ✅ **Health verification** (ensures app is running)

### **Future-Proof**
- 🔄 **Handles auto-scaling** (finds new instances automatically)
- 🚀 **Works with any number** of ALB instances
- 📊 **Provides clear feedback** on deployment status
- 🛠️ **Easy to modify** for different environments

## 🚀 Quick Start

### **First Time Setup**
```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Set AWS profile
export AWS_PROFILE=aws_cli_admin

# 3. Test deployment
./scripts/deploy.sh dev
```

### **Regular Usage**
```bash
# After every code push to deployDev
./scripts/deploy.sh dev

# Check deployment status
echo "Deployment completed successfully! 🎉"
```

## 🔍 Troubleshooting

### **Common Issues**
1. **AWS credentials** - Check profile and permissions
2. **SSM access** - Ensure instances have proper IAM roles
3. **EFS mounting** - Verify EFS is accessible on instances
4. **Node.js process** - Check if app is running after deployment

### **Debug Mode**
```bash
# Add debug output
bash -x ./scripts/deploy.sh dev
```

---

**This deployment system eliminates the gap between EFS code updates and ALB node deployments! 🎯**
