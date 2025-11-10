# Unix Permissions Guide for OPMS API Deployment

## Overview

This document explains the Unix permission system used in the OPMS API deployment infrastructure, specifically the `drwxrwsr-x (2775)` pattern that enables seamless collaboration between different user accounts and system processes.

## Permission Breakdown: `drwxrwsr-x (2775)`

### Position Analysis
```
d rwx rws r-x
│ │   │   │
│ │   │   └── Others: read + execute (5)
│ │   └────── Group: read + write + execute + sticky bit (7)
│ └────────── Owner: read + write + execute (7)
└──────────── Directory flag (d)
```

### Detailed Explanation

#### 1. **Directory Flag (`d`)**
- Indicates this is a directory, not a file
- Required for EFS mount points and application directories

#### 2. **Owner Permissions (`rwx`)**
- **User**: `ubuntu` (deployment user)
- **Permissions**: Full read, write, and execute access
- **Purpose**: Allows ubuntu to perform Git operations, file management, and deployment tasks

#### 3. **Group Permissions (`rws`)**
- **Group**: `www-data` (web server group)
- **Permissions**: Read, write, execute + **sticky bit**
- **Purpose**: Enables web server processes to access and modify application files

#### 4. **Others Permissions (`r-x`)**
- **Scope**: All other system users and processes
- **Permissions**: Read and execute only (no write access)
- **Purpose**: Allows system processes to traverse directories and read files

### The Sticky Bit (`s`)

#### What It Is
The sticky bit is a special permission that modifies how file ownership works within a directory.

#### How It Works
- **Normal Behavior**: Files inherit the ownership of the user who creates them
- **With Sticky Bit**: Files automatically inherit the **group ownership** of the directory
- **Result**: Files created by `ubuntu` automatically belong to the `www-data` group

#### Why It's Critical
```bash
# Without sticky bit: ubuntu creates file, only ubuntu can modify
ubuntu:ubuntu myfile.txt

# With sticky bit: ubuntu creates file, both ubuntu and www-data can modify
ubuntu:www-data myfile.txt
```

## Numeric Representation: 2775

### Calculation
- **2** = Sticky bit (special permission)
- **7** = Owner permissions (rwx = 4+2+1 = 7)
- **7** = Group permissions (rwx = 4+2+1 = 7)
- **5** = Others permissions (r-x = 4+0+1 = 5)

### Command to Set
```bash
chmod 2775 /opuzen-efs/dev/opms-api
```

## Why This Permission Set is Perfect

### ✅ **Multi-User Collaboration**
- `ubuntu` can deploy and manage code
- `www-data` can serve web requests
- Both can modify the same files without conflicts

### ✅ **Security**
- Others cannot write (no unauthorized modifications)
- Others can read (system processes work normally)
- Sticky bit ensures proper group inheritance

### ✅ **Deployment Workflow**
- GitHub Actions → `ubuntu` user → Git operations
- Web server → `www-data` user → File serving
- Both work seamlessly in the same directory

## Real-World Example

### Directory Structure
```
/opuzen-efs/dev/
├── opms/          (drwxrwsr-x - working OPMS setup)
├── opms-api/      (drwxrwsr-x - new API deployment)
├── roadkit/       (drwxrwsr-x - other applications)
└── website/       (drwxrwsr-x - web content)
```

### File Creation Flow
1. **GitHub Actions** triggers deployment
2. **ubuntu** user clones repository to `/opuzen-efs/dev/opms-api/`
3. **Sticky bit** ensures all files are `ubuntu:www-data`
4. **Web server** can immediately serve the application
5. **Both users** can modify files as needed

## Troubleshooting Permission Issues

### Common Problems

#### 1. **"Permission Denied" Errors**
```bash
# Check current permissions
ls -la /opuzen-efs/dev/opms-api/

# Fix if incorrect
chmod 2775 /opuzen-efs/dev/opms-api/
chown ubuntu:www-data /opuzen-efs/dev/opms-api/
```

#### 2. **Git "Dubious Ownership" Errors**
```bash
# Add safe directory configuration
git config --global --add safe.directory /opuzen-efs/dev/opms-api
```

#### 3. **Web Server Cannot Access Files**
```bash
# Verify group ownership
ls -la /opuzen-efs/dev/opms-api/

# Ensure www-data group has access
groups www-data
```

### Verification Commands
```bash
# Check directory permissions
ls -ld /opuzen-efs/dev/opms-api/

# Check file ownership patterns
ls -la /opuzen-efs/dev/opms-api/ | head -10

# Verify sticky bit
stat /opuzen-efs/dev/opms-api/ | grep Access
```

## Node.js Application Permissions

### **File Type Permissions for Node.js**

#### **1. Directories (2775)**
```bash
# All directories should have sticky bit permissions
chmod 2775 /opuzen-efs/dev/opms-api/
find /opuzen-efs/dev/opms-api -type d -exec chmod 2775 {} \;
```

#### **2. JavaScript Files (755)**
```bash
# Executable permissions for Node.js scripts
find /opuzen-efs/dev/opms-api -name '*.js' -exec chmod 755 {} \;
```

#### **3. Regular Files (664)**
```bash
# Read/write for configuration and data files
find /opuzen-efs/dev/opms-api -type f ! -name '*.js' ! -name '*.sh' -exec chmod 664 {} \;
```

#### **4. Shell Scripts (755)**
```bash
# Executable permissions for deployment scripts
find /opuzen-efs/dev/opms-api -name '*.sh' -exec chmod 755 {} \;
```

### **Why These Permissions Work for Node.js**

#### **✅ Application Execution**
- **JS files (755)**: Node.js can execute application code
- **Directories (2775)**: Node.js can traverse and access files
- **Config files (664)**: Application can read configuration

#### **✅ Process Management**
- **PM2 compatibility**: Can manage Node.js processes
- **Log file access**: Application can write to log directories
- **Environment files**: Can read `.env` and configuration

#### **✅ Development Workflow**
- **Git operations**: `ubuntu` user can manage repository
- **File serving**: `www-data` group can access web files
- **Collaboration**: Both users can modify as needed

### **Permission Verification for Node.js**
```bash
# Check JavaScript file permissions
find /opuzen-efs/dev/opms-api -name '*.js' | head -5 | xargs ls -l

# Verify directory permissions
find /opuzen-efs/dev/opms-api -type d | head -5 | xargs ls -ld

# Check configuration file access
ls -la /opuzen-efs/dev/opms-api/package.json
ls -la /opuzen-efs/dev/opms-api/src/config/
```

## Best Practices

### ✅ **Do**
- Use `2775` for shared application directories
- Set `ubuntu:www-data` ownership
- Configure Git safe directories
- Test permissions after deployment
- Use `755` for JavaScript and shell files
- Use `664` for configuration and data files

### ❌ **Don't**
- Use `777` (too permissive)
- Use `755` for directories (no group write access)
- Forget to set sticky bit
- Ignore Git ownership warnings
- Make JS files non-executable
- Use restrictive permissions for config files

## Related Documentation

- [OPMS API Deployment Strategy](./OPMS-API-Deployment-Strategy.md)
- [GitHub Actions Workflow Guide](./GitHub-Actions-Workflow-Guide.md)
- [EFS Directory Structure](./EFS-Directory-Structure.md)

---

**Note**: This permission pattern has been proven to work in the existing OPMS infrastructure and should be replicated exactly for the new opms-api deployment.
