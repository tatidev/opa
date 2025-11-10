# Deployment Scripts

This directory contains scripts for deploying and maintaining the OPMS API application on AWS instances.

## 📁 Scripts

### **`fix-permissions-and-deploy.sh`**
**Purpose**: Fixes file permission issues and deploys the application on ALB instances.

**What it does**:
1. **Changes directory** to `/opuzen-efs/dev/opms-api`
2. **Fixes ownership** for all files (`sudo chown -R ubuntu:www-data .`)
3. **Fixes specific files** that commonly have permission issues
4. **Verifies permissions** by showing directory listing
5. **Installs dependencies** (`npm install`)
6. **Restarts the application** (`./restart.sh`)

**Usage**:
```bash
# Make executable (first time only)
chmod +x fix-permissions-and-deploy.sh

# Run the script
./fix-permissions-and-deploy.sh
```

**When to use**:
- After code updates on EFS
- When experiencing permission denied errors
- When npm install fails due to ownership issues
- After instance replacements that need fresh deployments

## 🔧 Prerequisites

- **sudo access** on the target instance
- **Node.js** installed and accessible
- **EFS mounted** at `/opuzen-efs/`
- **Git repository** cloned in the target directory

## 🚨 Important Notes

- **Run as ubuntu user** (not root)
- **Script exits on first error** (fail-fast behavior)
- **Requires sudo** for permission changes
- **Assumes restart.sh exists** in the target directory

## 🔍 Troubleshooting

**Common issues**:
1. **Permission denied** → Script fixes this automatically
2. **npm install fails** → Usually resolved by ownership fix
3. **restart.sh not found** → Ensure the script exists in target directory

**Debug mode**:
```bash
# Run with verbose output
bash -x fix-permissions-and-deploy.sh
```

---

**This script solves the common deployment issues that cause 502 errors after code updates! 🎯**
