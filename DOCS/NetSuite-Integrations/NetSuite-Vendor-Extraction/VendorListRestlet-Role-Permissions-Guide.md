# VendorListRestlet - Complete Role & Permissions Setup Guide

## 🎯 **Overview**

This guide explains the complete authentication and authorization setup required for the VendorListRestlet to successfully extract vendor data from NetSuite Production. It documents the actual working configuration tested on October 15, 2025.

## 🏗️ **Four-Layer Authentication Architecture**

The VendorListRestlet uses NetSuite's Token-Based Authentication (TBA) with OAuth 1.0a, which requires four interconnected layers:

```
Layer 1: Integration Record (App Identity)
           ↓
Layer 2: Access Token (User + Role Link)
           ↓
Layer 3: User/Employee (Execution Identity)
           ↓
Layer 4: Role Permissions (What Can Be Done)
           ↓
Layer 5: RESTlet Deployment Audience (Who Can Call It)
```

**Key Principle**: All five layers must align perfectly for authentication to succeed.

---

## 📋 **Layer 1: Integration Record**

### **Purpose**
Establishes the application's identity in NetSuite. Provides Consumer Key/Secret for OAuth signing.

### **Location**
`Setup > Integrations > Manage Integrations`

### **Configuration**

1. **Navigate to**: `Setup > Integrations > Manage Integrations > New`

2. **Fill Required Fields**:
   - **Name**: `OPMS-API` (or your preferred name)
   - **Description**: `OPMS API Integration for Vendor Extraction`
   - **State**: **Enabled** ✅

3. **Token-Based Authentication Section**:
   - **Token-Based Authentication**: **Checked** ✅ (CRITICAL)
   - **TBA: Authorization Flow**: **Checked** ✅ (if available)

4. **Save and Record Credentials**:
   - **Consumer Key**: Copy this (goes to `NETSUITE_CONSUMER_KEY_PROD`)
   - **Consumer Secret**: Copy this (goes to `NETSUITE_CONSUMER_SECRET_PROD`)

### **Verification**
```bash
# In .env file:
NETSUITE_CONSUMER_KEY_PROD=<your_64_character_consumer_key>
NETSUITE_CONSUMER_SECRET_PROD=<your_64_character_consumer_secret>
```

### **Common Issues**
| Issue | Symptom | Solution |
|-------|---------|----------|
| Integration disabled | 401 Unauthorized | Enable the integration |
| TBA not checked | 401 Unauthorized | Check "Token-Based Authentication" |
| Wrong Consumer Key | 401 Unauthorized | Verify Consumer Key matches .env |

---

## 📋 **Layer 2: Access Token**

### **Purpose**
Links the Integration to a specific User + Role combination. This is the "key" that grants access.

### **Location**
`Setup > Users/Roles > Access Tokens`

### **Configuration**

1. **Navigate to**: `Setup > Users/Roles > Access Tokens > New`

2. **Fill Required Fields**:
   - **Token Name**: `OPMS-API - Folio3 Opuzen3, OPMS API Integration Role`
   - **Application Name**: **OPMS-API** (must match Layer 1 Integration name)
   - **User**: **Folio3 Opuzen3** (or your API user employee)
   - **Role**: **OPMS API Integration Role** ⚠️ **CRITICAL - Must match RESTlet audience**

3. **Save and Record Credentials**:
   - **Token ID**: Copy this (goes to `NETSUITE_TOKEN_ID_PROD`)
   - **Token Secret**: Copy this (goes to `NETSUITE_TOKEN_SECRET_PROD`)

### **Verification**
```bash
# In .env file:
NETSUITE_TOKEN_ID_PROD=<your_64_character_token_id>
NETSUITE_TOKEN_SECRET_PROD=<your_64_character_token_secret>
```

### **⚠️ CRITICAL REQUIREMENTS**

1. **Role Must Match RESTlet Audience**: The role selected here MUST be included in the RESTlet deployment's Audience tab.

2. **Token Must Be Active**: Check token status regularly. Expired tokens cause 401 errors.

3. **User Must Have Role Assigned**: The user must have this role assigned in their employee record.

### **Common Issues**
| Issue | Symptom | Solution |
|-------|---------|----------|
| Wrong role selected | 401 Unauthorized | Regenerate token with correct role |
| Token expired | 401 Unauthorized | Check token status, regenerate if needed |
| Role not assigned to user | 401 Unauthorized | Add role to user's Access tab |
| Application name mismatch | 401 Unauthorized | Verify application name matches integration |

---

## 📋 **Layer 3: User/Employee**

### **Purpose**
The identity that executes the RESTlet code. Defines what subsidiaries and data are accessible.

### **How the User Connects Everything**

The User (Employee) is the **central identity** that ties all layers together:

```
Integration (App) ──┐
                    ├──> Access Token ──> Selects User + Role
User (Employee) ────┘                           │
                                                 │
User's Employee Record:                          │
├─ Must have Role assigned ◄─────────────────────┘
├─ Must be Active
├─ Defines subsidiary access
└─ RESTlet executes AS this user

RESTlet Deployment Audience:
├─ Must include User (directly), OR
└─ Must include Role (that user has)
```

**Key Relationships:**

1. **Access Token → User**: When you create an Access Token (Layer 2), you must select:
   - An Integration (Layer 1) - identifies the application
   - A User (Layer 3) - whose identity the RESTlet runs as
   - A Role (Layer 4) - what permissions apply

2. **User → Role**: The selected user MUST have the selected role assigned in their employee record. If the role isn't assigned to the user, authentication fails.

3. **User → RESTlet Execution**: When the RESTlet runs, it executes in the security context of this user:
   - User's subsidiary access applies
   - User's role permissions apply
   - User's record restrictions apply
   - Audit logs show this user's actions

4. **User → RESTlet Audience**: The RESTlet deployment's Audience tab must include EITHER:
   - The specific User (direct user-based access), OR
   - The Role that the user has (role-based access - recommended)

**Example Flow:**
```
You create Access Token "OPMS-API Token":
├─ Integration: OPMS-API
├─ User: Folio3 Opuzen3
└─ Role: OPMS API Integration Role

NetSuite checks:
1. Does Integration "OPMS-API" exist? ✅
2. Does User "Folio3 Opuzen3" exist? ✅
3. Is User "Folio3 Opuzen3" active? ✅
4. Does User have Role "OPMS API Integration Role" assigned? ✅
5. Is Role "OPMS API Integration Role" in RESTlet audience? ✅

RESTlet executes:
├─ As User: Folio3 Opuzen3
├─ With Permissions: OPMS API Integration Role
└─ In Subsidiaries: User's subsidiary access
```

**Why This Matters:**

- **Security Context**: Every RESTlet operation happens as if that user logged in and performed it
- **Audit Trail**: NetSuite logs show this user performed the actions
- **Data Access**: User's subsidiary restrictions limit what records the RESTlet can see
- **Permissions**: User can only do what their assigned role allows

**Common Misunderstanding:**

❌ **Wrong**: "The Integration calls the RESTlet"
✅ **Correct**: "The Integration authenticates, but the User executes the RESTlet with the Role's permissions"

### **Location**
`Lists > Employees > [Employee Name]`

### **Configuration**

1. **Navigate to**: `Lists > Employees > Folio3 Opuzen3` (or your API user)

2. **Access Tab Requirements**:
   - **Roles**: Must include **OPMS API Integration Role** ✅
   - **Permissions**: Inherit from role (no additional permissions needed)

3. **Subsidiary Access** (OneWorld):
   - **Primary Subsidiary**: `Patra Group : Opuzen` (ID: 2)
   - **Restrict to Subsidiaries**: Configure as needed

4. **Classification Tab**:
   - **Employee Status**: Active ✅
   - **Email**: Valid email address (required for some NetSuite operations)

### **Verification**
- Employee record shows OPMS API Integration Role in Access tab
- Employee is Active
- Employee has access to relevant subsidiaries

### **Common Issues**
| Issue | Symptom | Solution |
|-------|---------|----------|
| Role not assigned | 403 Forbidden | Add OPMS API Integration Role to Access tab |
| Employee inactive | 401 Unauthorized | Activate employee |
| Wrong subsidiary | Data not visible | Update subsidiary access |

---

## 📋 **Layer 4: Role Permissions**

### **Purpose**
Defines what operations the API user can perform. Controls access to records, fields, and features.

### **Location**
`Setup > Users/Roles > Manage Roles > OPMS API Integration Role`

### **Required Permissions for VendorListRestlet**

#### **LISTS Permissions**

| Permission | Level | Reason |
|-----------|-------|--------|
| **Vendors** | **View** | ✅ **CRITICAL** - Allows reading vendor records via search.create() |
| Items | View | Optional - Future item queries |
| Subsidiaries | View | Optional - Filter by subsidiary |

#### **SETUP Permissions**

| Permission | Level | Reason |
|-----------|-------|--------|
| **SuiteScript** | **View or Full** | ✅ **CRITICAL** - Allows RESTlet execution |
| Access Token Management | View | Optional - Token validation |

#### **CUSTOMIZATION Permissions**

| Permission | Level | Reason |
|-----------|-------|--------|
| **Web Services** | Full | ✅ Allows RESTlet API calls |

#### **SUBSIDIARY RESTRICTIONS** (OneWorld)

| Subsidiary | Level | Reason |
|-----------|-------|--------|
| **Patra Group : Opuzen (ID: 2)** | **Full** | ✅ Access to Opuzen vendor data |

### **Configuration Steps**

1. **Navigate to**: `Setup > Users/Roles > Manage Roles`

2. **Find or Create**: `OPMS API Integration Role`
   - Click **New** if it doesn't exist
   - Or click the role name to edit

3. **Basic Information**:
   - **Name**: `OPMS API Integration Role`
   - **Center Type**: Standard/Classic (RESTlets don't care)
   - **Web Services Only**: Unchecked
   - **Two-Factor Required**: Optional (recommended: No for API users)

4. **Permissions Tab → Lists**:
   - Find **Vendors** → Set to **View** ✅
   - (Optional) Find **Items** → Set to **View**

5. **Permissions Tab → Setup**:
   - Find **SuiteScript** → Set to **View** or **Full** ✅

6. **Permissions Tab → Customization**:
   - Find **Web Services** → Set to **Full** ✅

7. **Subsidiaries Tab** (OneWorld):
   - Add **Patra Group : Opuzen** → Set to **Full** ✅

8. **Save Role**

### **Verification**
```javascript
// The RESTlet uses these permissions:
search.create({
    type: search.Type.VENDOR,  // Requires: Vendors - View
    filters: [
        ['isinactive', 'is', 'F']
    ],
    columns: [
        'internalid',
        'entityid',
        'companyname',
        'isinactive',
        'subsidiary'
    ]
});
```

### **Common Issues**
| Issue | Symptom | Solution |
|-------|---------|----------|
| Missing Vendors permission | 403 Forbidden | Add "Vendors: View" to role |
| Missing SuiteScript permission | 403 Forbidden | Add "SuiteScript: View" to role |
| Wrong subsidiary | Empty results | Add correct subsidiary to role |
| Web Services not enabled | RESTlet won't run | Add "Web Services: Full" |

---

## 📋 **Layer 5: RESTlet Deployment Audience**

### **Purpose**
Controls WHO can call the RESTlet. Acts as a whitelist for roles, users, and subsidiaries.

### **Location**
`Customization > Scripting > Scripts > [Script] > Deployments > [Deployment]`

### **Configuration**

1. **Navigate to**:
   - `Customization > Scripting > Scripts`
   - Find **Opuzen Vendor List RESTlet** (Script ID: 1762)
   - Click the script name
   - Click **Deployments** subtab
   - Click **Opuzen Vendor List RESTlet 2** (Deploy ID: 2)

2. **Audience Tab Configuration**:

   **Internal roles:**
   - ✅ **OPMS API Integration Role** (MUST be checked)
   - □ All Internal Roles (leave unchecked for security)

   **Employees:**
   - ✅ **Folio3 Opuzen3** (or your API user)
   - □ All Employees (leave unchecked for security)

   **Departments:**
   - (Leave empty or as needed)

   **Subsidiaries:**
   - ✅ **Patra Group : Opuzen**
   - (Add others if needed)

   **Groups:**
   - (Leave empty unless using groups)

   **Partners:**
   - □ All Partners (leave unchecked)

3. **Other Deployment Settings**:
   - **Status**: **Released** ✅
   - **Deployed**: **Checked** ✅
   - **Log Level**: **Debug** (helpful for troubleshooting)

4. **Save Deployment**

### **Verification**

Check that the deployment shows:
```
Audience:
  Internal roles: OPMS API Integration Role
  Employees: Folio3 Opuzen3
  Subsidiaries: Patra Group : Opuzen
```

### **Common Issues**
| Issue | Symptom | Solution |
|-------|---------|----------|
| Role not in audience | 403 Forbidden | Add OPMS API Integration Role to Audience |
| User not in audience | 403 Forbidden | Add user to Audience |
| Deployment not released | RESTlet not accessible | Change Status to Released |
| Deployed unchecked | RESTlet not accessible | Check "Deployed" checkbox |

---

## 🔐 **OAuth Authentication Flow**

### **How It All Works Together**

```javascript
// 1. Application identifies itself with Integration credentials
const oauth = OAuth({
    consumer: {
        key: NETSUITE_CONSUMER_KEY_PROD,     // Layer 1: Integration
        secret: NETSUITE_CONSUMER_SECRET_PROD // Layer 1: Integration
    },
    realm: NETSUITE_REALM_PROD,               // Account identifier
    signature_method: 'HMAC-SHA256'
});

// 2. User + Role authenticate via Access Token
const token = {
    key: NETSUITE_TOKEN_ID_PROD,              // Layer 2: Access Token
    secret: NETSUITE_TOKEN_SECRET_PROD        // Layer 2: Access Token
};

// 3. Generate OAuth signature
const authData = oauth.authorize(requestData, token);

// 4. Construct Authorization header
const authHeader = 
    `OAuth realm="${NETSUITE_REALM_PROD}",` +
    `oauth_consumer_key="${NETSUITE_CONSUMER_KEY_PROD}",` +
    `oauth_token="${NETSUITE_TOKEN_ID_PROD}",` +          // Links to User+Role
    `oauth_signature_method="HMAC-SHA256",` +
    `oauth_timestamp="${authData.oauth_timestamp}",` +
    `oauth_nonce="${authData.oauth_nonce}",` +
    `oauth_version="1.0",` +
    `oauth_signature="${encodeURIComponent(authData.oauth_signature)}"`;

// 5. NetSuite validates:
//    - Consumer Key matches Integration (Layer 1)
//    - Token ID is active and matches User + Role (Layer 2)
//    - User has Role assigned (Layer 3)
//    - Role has required permissions (Layer 4)
//    - Role/User in RESTlet audience (Layer 5)
//    - Signature is valid (proves authenticity)
```

### **Authentication Chain**

```
Request Arrives
    ↓
NetSuite validates Consumer Key → Layer 1 Check ✅
    ↓
NetSuite validates Token ID → Layer 2 Check ✅
    ↓
NetSuite checks User has Role → Layer 3 Check ✅
    ↓
NetSuite checks Role permissions → Layer 4 Check ✅
    ↓
NetSuite checks Deployment Audience → Layer 5 Check ✅
    ↓
OAuth signature verified → Signature Check ✅
    ↓
RESTlet executes with User's permissions
```

---

## 🚨 **Complete Troubleshooting Guide**

### **401 Unauthorized Errors**

| Specific Issue | How to Diagnose | Solution |
|---------------|-----------------|----------|
| Wrong Consumer Key | OAuth signature fails at Layer 1 | Copy Consumer Key from Integration record |
| Wrong Consumer Secret | OAuth signature fails at Layer 1 | Copy Consumer Secret from Integration record |
| Wrong Token ID | Token validation fails at Layer 2 | Copy Token ID from Access Token record |
| Wrong Token Secret | OAuth signature fails at Layer 2 | Copy Token Secret from Access Token record |
| Token expired | Token status check fails | Regenerate Access Token |
| Token role mismatch | Role not in audience | Create new token with correct role |
| Missing realm | OAuth header incomplete | Add NETSUITE_REALM_PROD=11516011 to .env |
| Integration disabled | Integration check fails | Enable Integration record |

**Debug Steps for 401**:
```bash
# 1. Verify all credentials are set
node scripts/test-production-oauth.js

# 2. Check .env file
grep "NETSUITE_.*_PROD" .env

# 3. Verify in NetSuite
# - Integration is Enabled
# - Access Token is Active
# - Token Role matches RESTlet audience
```

### **403 Forbidden Errors**

| Specific Issue | How to Diagnose | Solution |
|---------------|-----------------|----------|
| Missing Vendors permission | Role lacks permission | Add "Vendors: View" to role |
| Missing SuiteScript permission | Role lacks permission | Add "SuiteScript: View" to role |
| Role not in audience | Deployment audience check | Add role to RESTlet Audience tab |
| User not in audience | Deployment audience check | Add user to RESTlet Audience tab |
| User lacks role | User role assignment check | Add role to User's Access tab |
| Wrong subsidiary | Subsidiary restriction | Update role subsidiary access |

**Debug Steps for 403**:
```
# 1. Check role has Vendors permission
Setup > Users/Roles > Manage Roles > [Role] > Permissions > Lists > Vendors

# 2. Check role in audience
Customization > Scripting > Scripts > [Script] > Deployments > [Deploy] > Audience

# 3. Check user has role
Lists > Employees > [User] > Access > Roles

# 4. Check subsidiary access
Setup > Users/Roles > Manage Roles > [Role] > Subsidiaries
```

### **500 Server Errors**

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Unsupported file extension: " | Emoji characters in script | Upload clean ASCII-only script file |
| "Cannot read property..." | Script logic error | Check NetSuite execution logs |
| "Unexpected error" | Missing module dependencies | Verify N/search and N/log modules |

---

## ✅ **Complete Verification Checklist**

Use this checklist to verify all layers are configured correctly:

### **Layer 1: Integration Record**
- [ ] Integration named "OPMS-API" exists
- [ ] Integration State = Enabled
- [ ] Token-Based Authentication is Checked
- [ ] Consumer Key recorded in NETSUITE_CONSUMER_KEY_PROD
- [ ] Consumer Secret recorded in NETSUITE_CONSUMER_SECRET_PROD

### **Layer 2: Access Token**
- [ ] Access Token exists
- [ ] Application Name = "OPMS-API"
- [ ] User = "Folio3 Opuzen3" (or your API user)
- [ ] Role = "OPMS API Integration Role"
- [ ] Token Status = Active
- [ ] Token ID recorded in NETSUITE_TOKEN_ID_PROD
- [ ] Token Secret recorded in NETSUITE_TOKEN_SECRET_PROD

### **Layer 3: User/Employee**
- [ ] User "Folio3 Opuzen3" exists
- [ ] User Status = Active
- [ ] User has "OPMS API Integration Role" in Access tab
- [ ] User has access to "Patra Group : Opuzen" subsidiary

### **Layer 4: Role Permissions**
- [ ] Role "OPMS API Integration Role" exists
- [ ] Lists > Vendors = View ✅
- [ ] Setup > SuiteScript = View or Full ✅
- [ ] Customization > Web Services = Full ✅
- [ ] Subsidiaries > Patra Group : Opuzen = Full ✅

### **Layer 5: RESTlet Deployment Audience**
- [ ] RESTlet Script ID = 1762
- [ ] RESTlet Deploy ID = 2
- [ ] Deployment Status = Released
- [ ] Deployed = Checked
- [ ] Audience > Internal roles includes "OPMS API Integration Role"
- [ ] Audience > Employees includes "Folio3 Opuzen3"
- [ ] Audience > Subsidiaries includes "Patra Group : Opuzen"

### **Environment Variables**
- [ ] NETSUITE_CONSUMER_KEY_PROD is set
- [ ] NETSUITE_CONSUMER_SECRET_PROD is set
- [ ] NETSUITE_TOKEN_ID_PROD is set
- [ ] NETSUITE_TOKEN_SECRET_PROD is set
- [ ] NETSUITE_ACCOUNT_ID_PROD = 11516011
- [ ] NETSUITE_REALM_PROD = 11516011 ⚠️ CRITICAL

### **Script File**
- [ ] Using VendorListRestlet.js (clean version, no emojis)
- [ ] Script file uploaded to NetSuite
- [ ] Script file extension is .js
- [ ] No emoji or special Unicode characters in file

---

## 📊 **Testing the Setup**

### **Test 1: OAuth Connection**
```bash
node scripts/test-production-oauth.js
```

**Expected Output:**
```
✅ NETSUITE_CONSUMER_KEY_PROD: 1179d7ac...[masked]
✅ NETSUITE_CONSUMER_SECRET_PROD: 9fed120c...[masked]
✅ NETSUITE_TOKEN_ID_PROD: dffaebd2...[masked]
✅ NETSUITE_TOKEN_SECRET_PROD: 902f88d8...[masked]
✅ NETSUITE_REALM_PROD: 11516011
✅ All environment variables are present!
```

### **Test 2: Vendor Extraction**
```bash
node scripts/extract-vendors-via-restlet-prod.js
```

**Expected Output:**
```
🔧 NetSuite Vendor RESTlet Extractor initialized for PRODUCTION account: 11516011
🌐 RESTlet URL: https://11516011.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1762&deploy=2
🚀 Starting NetSuite Production Vendor Extraction via RESTlet...
🧪 Testing RESTlet connection...
✅ RESTlet connection successful!
🔍 Starting vendor extraction from NetSuite PRODUCTION via RESTlet...
✅ Extracted 365 vendors (Total: 365)
🎉 Vendor extraction complete!
```

---

## 🔒 **Security Best Practices**

1. **Credential Management**
   - Never commit OAuth credentials to git
   - Use .env file (excluded from git)
   - Rotate credentials regularly (every 90 days)

2. **Role Permissions**
   - Grant minimum required permissions
   - Avoid "Full" access unless necessary
   - Review permissions quarterly

3. **Access Token**
   - Use role-specific tokens
   - Monitor token usage in NetSuite logs
   - Disable unused tokens immediately

4. **Deployment Audience**
   - Never use "All Internal Roles"
   - Never use "All Employees"
   - Whitelist specific roles and users only

5. **Monitoring**
   - Review NetSuite execution logs weekly
   - Monitor for failed authentication attempts
   - Alert on repeated 401/403 errors

---

## 📚 **Related Documentation**

- **Extraction Guide**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/NetSuite-Production-Vendor-Extraction-Guide.md`
- **General OPMS API Integration Role**: `DOCS/NetSuite-Integrations/Roles_and_Permissioins/OPMS API Integration Role — Deployment Guide.md`
- **NetSuite Integration Docs**: `DOCS/NetSuite-Integrations/`

---

**Last Updated**: October 15, 2025  
**Tested Configuration**: NetSuite Account 11516011, Script 1762, Deploy 2  
**Status**: ✅ Production-Verified  
**Successful Extraction**: 365 vendors

