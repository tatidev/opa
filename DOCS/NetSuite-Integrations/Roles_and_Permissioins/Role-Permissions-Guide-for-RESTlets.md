# Complete Role & Permissions Guide for NetSuite RESTlets

## 🎯 **Overview**

This comprehensive guide explains the authentication and authorization architecture required for ANY NetSuite RESTlet to successfully execute. Whether you're building a data extraction RESTlet, a record management API, or any other custom endpoint, this guide provides the complete security model you need to understand and implement.

**Applies to**: All NetSuite RESTlets using Token-Based Authentication (TBA) with OAuth 1.0a

**Official Documentation**: [NetSuite Help Center - Token-Based Authentication](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4247337262.html)

## 🏗️ **Five-Layer Authentication Architecture**

NetSuite RESTlets use a sophisticated five-layer security model. Each layer must be correctly configured for authentication to succeed.

```
Layer 1: Integration Record (Application Identity)
           ↓
Layer 2: Access Token (User + Role Binding)
           ↓
Layer 3: User/Employee (Execution Context)
           ↓
Layer 4: Role Permissions (Operation Authorization)
           ↓
Layer 5: RESTlet Deployment Audience (Access Control List)
```

**Key Principle**: All five layers must align perfectly. A failure in any single layer results in authentication or authorization errors.

**Common Misconception**: Having valid OAuth credentials is not enough. The role assigned to the token must:
1. Have the correct permissions for the operations your RESTlet performs
2. Be explicitly listed in the RESTlet's deployment audience

---

## 📋 **Layer 1: Integration Record**

### **Purpose**
Establishes your application's identity in NetSuite. Provides the Consumer Key and Consumer Secret used for OAuth 1.0a signing.

### **NetSuite Location**
`Setup > Integrations > Manage Integrations`

### **Step-by-Step Configuration**

1. **Navigate to**: `Setup > Integrations > Manage Integrations > New`

2. **Fill Required Fields**:
   - **Name**: Your application name (e.g., "My API Integration")
   - **Description**: Brief purpose description
   - **State**: **Enabled** ✅ (CRITICAL)

3. **Token-Based Authentication Section**:
   - **Token-Based Authentication**: **Checked** ✅ (REQUIRED)
   - **TBA: Authorization Flow**: **Checked** ✅ (if available)
   - **OAuth 2.0**: Leave unchecked (RESTlets use OAuth 1.0a)

4. **Optional Settings**:
   - **Callback URL**: Not required for RESTlets (only for OAuth flow with redirects)
   - **Consent Screen Customization**: Not applicable to RESTlets

5. **Save and Record Credentials**:
   - **Consumer Key**: Copy and store securely (typically 64 hex characters)
   - **Consumer Secret**: Copy and store securely (typically 64 hex characters)
   - ⚠️ **You cannot retrieve the secret later** - store it immediately

### **Environment Variable Pattern**
```bash
# Recommended naming convention
NETSUITE_CONSUMER_KEY=<your_consumer_key_here>
NETSUITE_CONSUMER_SECRET=<your_consumer_secret_here>

# For multiple environments
NETSUITE_CONSUMER_KEY_SANDBOX=<sandbox_key>
NETSUITE_CONSUMER_KEY_PROD=<production_key>
```

### **Verification**
- Integration appears in the list with "Enabled" state
- Consumer Key/Secret are stored in your application's secure configuration
- Token-Based Authentication checkbox is checked

### **Common Issues**

| Issue | Symptom | Solution |
|-------|---------|----------|
| Integration disabled | 401 Unauthorized | Enable the integration record |
| TBA not checked | 401 Unauthorized | Check "Token-Based Authentication" box |
| Wrong Consumer Key | 401 Unauthorized | Verify key matches what you're using |
| Consumer Secret lost | Cannot authenticate | Create new integration (secrets can't be retrieved) |

---

## 📋 **Layer 2: Access Token**

### **Purpose**
Links your Integration (application) to a specific User + Role combination. This token represents the identity and permissions of the API calls.

### **NetSuite Location**
`Setup > Users/Roles > Access Tokens`

### **Step-by-Step Configuration**

1. **Navigate to**: `Setup > Users/Roles > Access Tokens > New`

2. **Fill Required Fields**:
   - **Token Name**: Descriptive name (e.g., "My API - User Name, Role Name")
   - **Application Name**: Select your Integration from Layer 1
   - **User**: Select the employee who will "execute" the RESTlet
   - **Role**: Select the role that has required permissions ⚠️ **CRITICAL**

3. **Save and Record Credentials**:
   - **Token ID**: Copy and store securely
   - **Token Secret**: Copy and store securely
   - ⚠️ **You cannot retrieve these later** - store them immediately

### **Environment Variable Pattern**
```bash
# Recommended naming convention
NETSUITE_TOKEN_ID=<your_token_id_here>
NETSUITE_TOKEN_SECRET=<your_token_secret_here>

# For multiple environments
NETSUITE_TOKEN_ID_SANDBOX=<sandbox_token_id>
NETSUITE_TOKEN_ID_PROD=<production_token_id>
```

### **⚠️ CRITICAL REQUIREMENTS**

1. **Role-Audience Alignment**: The role you select here MUST be included in your RESTlet's deployment audience (Layer 5). This is the most common cause of 401/403 errors.

2. **Token Lifecycle**: Tokens don't expire automatically, but:
   - Can be manually revoked in NetSuite
   - Become inactive if the user or role is deactivated
   - Should be rotated regularly (recommended: every 90 days)

3. **User-Role Assignment**: The selected user must have the selected role assigned in their employee record (Layer 3).

### **Common Issues**

| Issue | Symptom | Solution |
|-------|---------|----------|
| Role not in audience | 401 Unauthorized or 403 Forbidden | Add role to RESTlet deployment audience |
| Token revoked/inactive | 401 Unauthorized | Check token status, regenerate if needed |
| User doesn't have role | 401 Unauthorized | Assign role to user in employee record |
| Application mismatch | 401 Unauthorized | Verify application name matches your integration |
| Credentials lost | Cannot authenticate | Generate new token (old credentials can't be retrieved) |

---

## 📋 **Layer 3: User/Employee**

### **Purpose**
Defines the execution context for your RESTlet. The user's subsidiary access, data visibility, and any user-specific permissions apply to RESTlet operations.

### **How the User Connects Everything**

The User (Employee) is the **central identity** that ties all authentication layers together:

```
Integration (Application) ──┐
                            ├──> Access Token ──> Binds: User + Role + Application
User (Employee) ────────────┘                           │
                                                         │
User's Employee Record:                                  │
├─ Must have Role assigned ◄─────────────────────────────┘
├─ Must be Active
├─ Defines subsidiary access
├─ Defines data visibility
└─ RESTlet executes in THIS user's security context

RESTlet Deployment Audience:
├─ Must include User (directly), OR
└─ Must include Role (that user has)
```

**Critical Relationships:**

1. **Access Token Creates the Binding**: When you create an Access Token, you explicitly bind three things together:
   - **Integration** (which application is calling) → Layer 1
   - **User** (whose identity is used) → Layer 3  
   - **Role** (what permissions apply) → Layer 4
   
   This binding is permanent for that token. You cannot change it - you must create a new token to change any of these.

2. **User Must Have the Role**: The user selected in the Access Token MUST have that exact role assigned in their employee record. NetSuite validates this relationship every time the token is used.

3. **RESTlet Runs AS the User**: When your RESTlet executes, every operation happens in this user's security context:
   - User's subsidiary access limits what data is visible
   - User's role permissions limit what operations are allowed
   - Audit logs attribute all actions to this user
   - Record locks are held by this user
   - Custom scripts and workflows evaluate in this user's context

4. **Audience Controls Access**: The RESTlet deployment's Audience tab must include EITHER:
   - The specific User (restrictive - only that user can call it)
   - The Role (flexible - any user with that role can call it - recommended)

**Real-World Example:**

```
You create an Access Token for your inventory API:

Access Token "Inventory API":
├─ Integration: "My Inventory Integration"  
├─ User: "API Service Account"
└─ Role: "Inventory API Role"

What NetSuite validates when this token is used:
┌────────────────────────────────────────────────────────────┐
│ 1. Integration "My Inventory Integration" exists? ✅       │
│ 2. Integration is Enabled? ✅                              │
│ 3. Token "Inventory API" is Active? ✅                     │
│ 4. User "API Service Account" exists? ✅                   │
│ 5. User "API Service Account" is Active? ✅                │
│ 6. User has Role "Inventory API Role" assigned? ✅         │
│ 7. Role or User in RESTlet audience? ✅                    │
│ 8. OAuth signature valid? ✅                               │
└────────────────────────────────────────────────────────────┘

RESTlet executes:
├─ Security Context: "API Service Account" user
├─ Permissions: "Inventory API Role" permissions only
├─ Subsidiaries: User's subsidiary access only
├─ Audit Trail: Shows "API Service Account" performed actions
└─ Record Access: Limited to user's record visibility
```

**Why the User Matters:**

| Aspect | Impact |
|--------|--------|
| **Subsidiary Access** | User can only see/modify records in subsidiaries they have access to |
| **Record Visibility** | User's record restrictions (dept, location, class) apply to all operations |
| **Audit Trail** | All RESTlet actions logged under this user's name in NetSuite logs |
| **Concurrency** | User's concurrent request limits apply |
| **Record Locking** | Records locked by this user during transactions |
| **Custom Logic** | User scripts, workflows, and validations evaluate in this user's context |

**Common Mistakes:**

❌ **Mistake 1**: "I'll use my personal admin account for the API"
- Problem: API actions appear as your personal actions in audit logs
- Problem: If you leave the company, API breaks  
- Problem: Audit trail is confusing (personal vs API actions mixed)

✅ **Better**: Create dedicated "API - [Integration Name]" employee accounts for each integration

❌ **Mistake 2**: "The Integration has permissions"
- Wrong thinking: Integration only authenticates, it has no permissions itself
- Reality: User's role has the permissions, Integration just proves identity

✅ **Correct Understanding**: "The Integration authenticates the application, the User provides the identity, the Role provides the permissions"

❌ **Mistake 3**: "I added the role to the audience, so any token with that role works"
- Wrong: User must ALSO have that role assigned in their employee record
- Reality: Both conditions must be true: (User has Role) AND (Role in Audience)

✅ **Correct Process**: 
1. Assign role to user's employee record
2. Create Access Token selecting that User + Role
3. Add role to RESTlet audience
4. All three must align

**The Complete Authentication Flow:**

```
1. Your application makes RESTlet call
   └─ Includes OAuth headers with Consumer Key + Token ID

2. NetSuite receives request
   └─ Extracts Token ID from OAuth Authorization header

3. NetSuite looks up Access Token record
   └─ Finds binding: Integration X + User Y + Role Z

4. NetSuite validates Integration (Layer 1)
   └─ Does integration exist? Is it enabled? Is Consumer Key correct?

5. NetSuite validates User (Layer 3)  
   └─ Does user exist? Is user active? Is user unlocked?

6. NetSuite validates User-Role binding
   └─ Does User Y have Role Z assigned in their employee record?

7. NetSuite validates OAuth signature
   └─ Is signature valid using Consumer Secret + Token Secret?

8. NetSuite checks RESTlet audience (Layer 5)
   └─ Is User Y in employee list OR Role Z in role list?

9. NetSuite loads User's security context
   └─ Loads subsidiary access, permissions from role, data restrictions

10. RESTlet executes
    └─ AS User Y, WITH Role Z's permissions, IN User's subsidiaries
```

**Debugging User-Related Issues:**

```
Error 401 - Check these User aspects:
├─ User exists and is active
├─ User has role assigned in employee record
├─ Access Token specifies correct User + Role combination
└─ Access Token is Active status

Error 403 - Check these User aspects:
├─ User has role assigned
├─ Role has required permissions
├─ User OR Role is in RESTlet audience
└─ User has subsidiary access for the data being accessed

In NetSuite UI:
1. Check user has role assigned:
   Lists > Employees > [User] > Access Tab > Roles

2. Check user is active:
   Lists > Employees > [User] > Classification Tab > Is Inactive

3. Check user in audience (if using user-based):
   Customization > Scripting > Scripts > [Script] > Deployments > [Deploy]
   └─ Audience Tab > Employees

4. Check role in audience (if using role-based - recommended):
   Customization > Scripting > Scripts > [Script] > Deployments > [Deploy]
   └─ Audience Tab > Internal roles
```

### **NetSuite Location**
`Lists > Employees > [Employee Name]`

### **Step-by-Step Configuration**

1. **Navigate to**: `Lists > Employees > [Your API User]`

2. **Access Tab Requirements**:
   - **Roles**: Must include the role used in your Access Token (Layer 2)
   - **Give Access**: Must be checked
   - **Permissions**: Inherited from assigned roles

3. **Subsidiary Access** (NetSuite OneWorld only):
   - **Primary Subsidiary**: Set to relevant subsidiary
   - **Restrict to Subsidiaries**: Configure based on data access needs
   - RESTlet operations are restricted to user's subsidiary access

4. **Classification Tab**:
   - **Employee Status**: **Active** ✅
   - **Email**: Valid email (required for some NetSuite operations)

### **Best Practices**

1. **Dedicated API Users**: Create separate employee records for API integrations
   - Naming convention: "API - [Integration Name]"
   - Don't use personal employee accounts
   - Makes auditing and access management easier

2. **Minimum Subsidiary Access**: Only grant access to subsidiaries the API needs

3. **Service Account Pattern**: Set as non-login employee (System > Users & Roles > Users: Leave login unchecked)

### **Verification Checklist**
- [ ] Employee record exists and is active
- [ ] Employee has API role in Access tab
- [ ] Employee has access to required subsidiaries (OneWorld)
- [ ] Email address is valid

### **Common Issues**

| Issue | Symptom | Solution |
|-------|---------|----------|
| Role not assigned | 403 Forbidden | Add API role to employee's Access tab |
| Employee inactive | 401 Unauthorized | Activate employee record |
| Wrong subsidiary access | Empty results or 403 | Update subsidiary restrictions |
| No email address | Some operations fail | Add valid email to employee record |

---

## 📋 **Layer 4: Role Permissions**

### **Purpose**
Defines what operations your RESTlet can perform. This is where you grant specific permissions for reading, writing, or deleting NetSuite records.

### **NetSuite Location**
`Setup > Users/Roles > Manage Roles`

### **Understanding Permission Types**

| Permission Level | Meaning | Typical Use |
|-----------------|---------|-------------|
| **None** | No access | Default for all permissions |
| **View** | Read-only access | Data extraction, searches |
| **Create** | Can create new records | POST endpoints, new record creation |
| **Edit** | Can modify existing records | PUT/PATCH endpoints, updates |
| **Full** | Create, Edit, Delete, View | Complete CRUD operations |

### **Permission Categories**

#### **LISTS Permissions**
Controls access to record types (Customers, Vendors, Items, etc.)

**Example Permissions Needed:**
```
If your RESTlet searches/reads Vendors:
  ├─ Vendors: View (minimum)

If your RESTlet creates/updates Items:
  ├─ Items: Full (or Create + Edit)

If your RESTlet only reads Customer data:
  ├─ Customers: View
```

#### **SETUP Permissions**
Controls access to setup-related features

**Critical Permission:**
- **SuiteScript**: View or Full ✅ **REQUIRED for all RESTlets**

**Other Common Permissions:**
- **Access Token Management**: View (if RESTlet validates tokens)
- **Set Up Taxes**: View (if RESTlet sets tax schedules)
- **Accounting Lists**: View (if RESTlet accesses accounts)

#### **CUSTOMIZATION Permissions**
Controls access to customization features

**Critical Permission:**
- **Web Services**: Full ✅ **REQUIRED for all RESTlets**

**Other Permissions:**
- **Custom Records**: Full (if RESTlet works with custom record types)
- **Custom Fields**: Full (if RESTlet sets custom field values)

#### **TRANSACTIONS Permissions**
Controls access to transaction types (Sales Orders, Invoices, etc.)

**Example Permissions:**
```
If your RESTlet creates Sales Orders:
  ├─ Sales Order: Create (or Full)

If your RESTlet reads Purchase Orders:
  ├─ Purchase Order: View
```

#### **REPORTS Permissions**
Usually not required for RESTlets unless you're generating reports

#### **SUBSIDIARY RESTRICTIONS** (OneWorld only)
Controls which subsidiaries the role can access

**Critical Setting:**
- Add all subsidiaries your RESTlet needs to access
- Set appropriate level (View, Edit, or Full)

### **Creating an API Role - Step by Step**

1. **Navigate to**: `Setup > Users/Roles > Manage Roles > New`

2. **Basic Information**:
   - **Name**: Descriptive name (e.g., "API Integration - [Purpose]")
   - **Center Type**: Classic Center (doesn't affect RESTlets)
   - **Web Services Only**: Optional (checking this restricts role to API use only)
   - **Two-Factor Required**: Recommended: **No** (for service accounts)

3. **Permissions Tab - Required Minimums**:
   
   **Setup:**
   - SuiteScript: **View** or **Full** ✅
   
   **Customization:**
   - Web Services: **Full** ✅

4. **Permissions Tab - Record-Specific**:
   
   Add permissions based on what your RESTlet does:
   
   ```
   Examples:
   
   RESTlet that reads vendors and items:
     ├─ Lists > Vendors: View
     ├─ Lists > Items: View
   
   RESTlet that creates customers:
     ├─ Lists > Customers: Create (or Full)
   
   RESTlet that updates sales orders:
     ├─ Transactions > Sales Order: Edit (or Full)
   
   RESTlet that works with custom records:
     ├─ Customization > Custom Records: Full
     └─ Lists > Custom Record Type: View/Edit/Full
   ```

5. **Subsidiaries Tab** (OneWorld):
   - Add each subsidiary your RESTlet needs
   - Set appropriate permission level

6. **Save Role**

### **Permission Analysis Template**

Use this template to document required permissions for your RESTlet:

```markdown
## RESTlet: [Name]
**Purpose**: [What it does]

### Operations Performed:
1. [Operation 1] - e.g., Search vendors
2. [Operation 2] - e.g., Create inventory items
3. [Operation 3] - e.g., Update customer records

### Required Permissions:

#### LISTS
- Vendors: View (for search operations)
- Items: Full (for create/update operations)

#### SETUP
- SuiteScript: View (required for all RESTlets)

#### CUSTOMIZATION
- Web Services: Full (required for all RESTlets)

#### SUBSIDIARIES (OneWorld)
- Subsidiary A: Full
- Subsidiary B: View
```

### **Common Issues**

| Issue | Symptom | Solution |
|-------|---------|----------|
| Missing SuiteScript permission | 403 Forbidden | Add SuiteScript: View to role |
| Missing Web Services permission | RESTlet won't execute | Add Web Services: Full to role |
| Missing record permission | 403 on specific operation | Add permission for that record type |
| Wrong permission level | Can view but not edit | Change permission from View to Edit/Full |
| Missing subsidiary access | Can't see records | Add subsidiary to role's Subsidiaries tab |
| Custom field restrictions | Can't set custom field | Check field-level permissions |

---

## 📋 **Layer 5: RESTlet Deployment Audience**

### **Purpose**
Acts as an access control list (ACL) for your RESTlet. Even with valid OAuth credentials and permissions, calls are rejected if the role/user isn't in the audience.

### **NetSuite Location**
`Customization > Scripting > Scripts > [Your Script] > Deployments > [Deployment]`

### **Step-by-Step Configuration**

1. **Navigate to Script Deployment**:
   - `Customization > Scripting > Scripts`
   - Find your RESTlet script
   - Click **Deployments** subtab
   - Open the deployment you're using

2. **Audience Tab Configuration**:

   **Internal roles:**
   - ✅ Check your API integration role
   - □ Leave "All Internal Roles" unchecked (security best practice)

   **Employees:**
   - ✅ Check your API user employee
   - □ Leave "All Employees" unchecked (security best practice)
   - *Or* leave empty if relying on role-based access

   **Departments:**
   - Usually left empty for API integrations
   - Use only if you need department-level restrictions

   **Subsidiaries:**
   - ✅ Check subsidiaries the API should access
   - □ "All Subsidiaries" for cross-subsidiary operations
   - ✅ Specific subsidiaries for restricted access

   **Classes:**
   - Usually left empty
   - Use if your organization uses class-based restrictions

   **Locations:**
   - Usually left empty
   - Use if your organization uses location-based restrictions

   **Groups:**
   - Usually left empty
   - Use if you've organized employees into groups

   **Partners:**
   - Usually left empty (API integrations typically use employees)

3. **Other Critical Deployment Settings**:
   
   **Status:**
   - **Released** ✅ (REQUIRED - Testing status won't work for external calls)
   
   **Deployed:**
   - **Checked** ✅ (REQUIRED)
   
   **Log Level:**
   - **Debug** (recommended during development)
   - **Audit** or **Error** (for production)
   
   **Available Without Login:**
   - **Unchecked** (OAuth-based RESTlets should not check this)

4. **Save Deployment**

### **Audience Best Practices**

1. **Principle of Least Privilege**:
   ```
   ❌ DON'T: Check "All Internal Roles" and "All Employees"
   ✅ DO: Explicitly list only the roles/users that need access
   ```

2. **Role-Based vs User-Based Access**:
   ```
   Recommended: Use role-based access
     - More maintainable (add users to role, don't update deployment)
     - Better for multiple API users
   
   Alternative: Use user-based access
     - More restrictive (single user only)
     - Better for highly sensitive operations
   ```

3. **Subsidiary Restrictions**:
   ```
   OneWorld: Be explicit about subsidiary access
     - Matches your role's subsidiary permissions
     - Prevents cross-subsidiary data leakage
   ```

### **Verification**

Check deployment shows:
```
Audience:
  Internal roles: [Your API Role]
  Employees: [Your API User] (optional if using role-based)
  Subsidiaries: [Required Subsidiaries]

Status: Released
Deployed: ✓
Available Without Login: (unchecked)
```

### **Common Issues**

| Issue | Symptom | Solution |
|-------|---------|----------|
| Role not in audience | 403 Forbidden | Add role to Internal roles section |
| User not in audience (when required) | 403 Forbidden | Add user to Employees section |
| Status not "Released" | RESTlet not accessible | Change Status to Released |
| "Deployed" not checked | RESTlet not accessible | Check the Deployed checkbox |
| Wrong subsidiary in audience | Can't access data | Add correct subsidiaries |
| "Available Without Login" checked | OAuth fails | Uncheck this box |

---

## 🔐 **OAuth 1.0a Authentication Flow**

### **Complete Implementation**

```javascript
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');

// 1. Configure OAuth with Integration credentials (Layer 1)
const oauth = OAuth({
    consumer: {
        key: process.env.NETSUITE_CONSUMER_KEY,    // From Integration Record
        secret: process.env.NETSUITE_CONSUMER_SECRET
    },
    signature_method: 'HMAC-SHA256',
    hash_function(base_string, key) {
        return crypto
            .createHmac('sha256', key)
            .update(base_string)
            .digest('base64');
    },
    realm: process.env.NETSUITE_REALM,              // NetSuite Account ID
    parameter_separator: ',',
    encode_rfc3986: function(str) {
        return encodeURIComponent(str)
            .replace(/!/g, '%21')
            .replace(/\*/g, '%2A')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/'/g, '%27');
    }
});

// 2. Configure Access Token (Layer 2 - links to User + Role)
const token = {
    key: process.env.NETSUITE_TOKEN_ID,             // From Access Token
    secret: process.env.NETSUITE_TOKEN_SECRET
};

// 3. Build request (your RESTlet URL and method)
const restletUrl = `https://${accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${scriptId}&deploy=${deployId}`;
const requestData = {
    url: restletUrl,
    method: 'POST'  // Or GET, PUT, DELETE
};

// 4. Generate OAuth signature
const authData = oauth.authorize(requestData, token);

// 5. Construct Authorization header manually (REQUIRED format)
let authHeader = `OAuth realm="${process.env.NETSUITE_REALM}",`;
authHeader += `oauth_consumer_key="${process.env.NETSUITE_CONSUMER_KEY}",`;
authHeader += `oauth_token="${process.env.NETSUITE_TOKEN_ID}",`;
authHeader += `oauth_signature_method="${authData.oauth_signature_method}",`;
authHeader += `oauth_timestamp="${authData.oauth_timestamp}",`;
authHeader += `oauth_nonce="${authData.oauth_nonce}",`;
authHeader += `oauth_version="${authData.oauth_version}",`;
authHeader += `oauth_signature="${encodeURIComponent(authData.oauth_signature)}"`;

// 6. Make request
const response = await axios.post(restletUrl, requestBody, {
    headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});
```

### **Critical OAuth Requirements**

1. **Realm Parameter**: Must be included in OAuth config and header
   ```bash
   NETSUITE_REALM=<account_id>  # e.g., "11516011" or "11516011_SB1"
   ```

2. **Manual Header Construction**: Using `oauth.toHeader()` often fails. Construct manually as shown above.

3. **Signature Method**: Must be `HMAC-SHA256` (NetSuite requirement)

4. **RFC 3986 Encoding**: The custom encoding function handles special characters correctly

### **Environment Variables Required**

```bash
# Integration Record (Layer 1)
NETSUITE_CONSUMER_KEY=<64_character_hex_string>
NETSUITE_CONSUMER_SECRET=<64_character_hex_string>

# Access Token (Layer 2)
NETSUITE_TOKEN_ID=<64_character_hex_string>
NETSUITE_TOKEN_SECRET=<64_character_hex_string>

# Account Configuration
NETSUITE_ACCOUNT_ID=<account_number>
NETSUITE_REALM=<account_number_or_realm>

# Optional: Multiple environments
NETSUITE_CONSUMER_KEY_SANDBOX=<sandbox_key>
NETSUITE_CONSUMER_KEY_PROD=<production_key>
# ... repeat for all credentials
```

### **Authentication Validation Chain**

When a request arrives at your RESTlet, NetSuite validates:

```
1. OAuth Signature ✅
   └─ Uses Consumer Secret + Token Secret
   └─ Verifies request hasn't been tampered with

2. Consumer Key ✅
   └─ Matches active Integration Record (Layer 1)

3. Token ID ✅
   └─ Matches active Access Token (Layer 2)
   └─ Links to specific User + Role

4. User Status ✅
   └─ Employee is active (Layer 3)
   └─ User has Role assigned

5. Role Permissions ✅
   └─ Role has required permissions (Layer 4)
   └─ For the operations RESTlet will perform

6. Deployment Audience ✅
   └─ Role and/or User in audience (Layer 5)
   └─ Subsidiary matches (if restricted)

7. Execute RESTlet ✅
   └─ With User's security context
   └─ Subject to Role's permissions
```

**If any step fails**: Request rejected with 401 (authentication) or 403 (authorization) error

---

## 🚨 **Complete Troubleshooting Guide**

### **401 Unauthorized Errors**

**Meaning**: Authentication failed - NetSuite couldn't verify your identity

| Specific Cause | How to Diagnose | Solution |
|---------------|-----------------|----------|
| Wrong Consumer Key | Check Integration Record | Copy correct Consumer Key |
| Wrong Consumer Secret | OAuth signature mismatch | Copy correct Consumer Secret (or create new integration) |
| Wrong Token ID | Check Access Token | Copy correct Token ID |
| Wrong Token Secret | OAuth signature mismatch | Copy correct Token Secret (or create new token) |
| Token expired/revoked | Check token status in NetSuite | Create new Access Token |
| Integration disabled | Check integration state | Enable Integration Record |
| Missing realm parameter | OAuth header incomplete | Add NETSUITE_REALM to environment |
| Timestamp out of sync | Server time difference > 5 min | Sync system clock with NTP |

**Debug Steps:**
```bash
# 1. Verify all environment variables exist
printenv | grep NETSUITE

# 2. Check credential format (should be 64 hex chars)
echo $NETSUITE_CONSUMER_KEY | wc -c  # Should output 65 (64 + newline)

# 3. Verify Integration in NetSuite
# Navigate to: Setup > Integrations > Manage Integrations
# Confirm: State = Enabled, TBA = Checked

# 4. Verify Access Token in NetSuite
# Navigate to: Setup > Users/Roles > Access Tokens
# Confirm: Status = Active
```

### **403 Forbidden Errors**

**Meaning**: You're authenticated, but not authorized for this operation

| Specific Cause | How to Diagnose | Solution |
|---------------|-----------------|----------|
| Missing record permission | Check role permissions | Add required permission to role |
| Missing SuiteScript permission | Check Setup permissions | Add SuiteScript: View to role |
| Missing Web Services permission | Check Customization permissions | Add Web Services: Full to role |
| Role not in audience | Check deployment audience | Add role to deployment's Internal roles |
| User not in audience | Check deployment audience | Add user to deployment's Employees |
| User doesn't have role | Check employee access | Assign role to user's Access tab |
| Wrong subsidiary | Check subsidiary access | Update role's subsidiary permissions |
| Custom field restriction | Check field permissions | Enable field for role |
| Workflow/approval required | Check record restrictions | Handle workflow in code or disable |

**Debug Steps:**
```
# 1. Check role has SuiteScript permission
Setup > Users/Roles > Manage Roles > [Your Role]
└─ Permissions > Setup > SuiteScript: View or Full?

# 2. Check role has Web Services permission
Setup > Users/Roles > Manage Roles > [Your Role]
└─ Permissions > Customization > Web Services: Full?

# 3. Check role is in audience
Customization > Scripting > Scripts > [Your Script]
└─ Deployments > [Deployment] > Audience
└─ Internal roles: Is your role checked?

# 4. Check user has role
Lists > Employees > [Your User]
└─ Access > Roles: Is your role listed?

# 5. Check specific permission for failing operation
Setup > Users/Roles > Manage Roles > [Your Role]
└─ Permissions > [Category] > [Record Type]: Correct level?
```

### **500 Internal Server Errors**

**Meaning**: RESTlet script error or NetSuite system error

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Unsupported file extension: " | Special characters in script | Use ASCII-only, no emojis |
| "Cannot read property of undefined" | Script logic error | Check NetSuite execution logs |
| "Module not found" | Missing require statement | Add required module to define() |
| "Permission Violation" | Script trying unauthorized operation | Add permission to role |
| "Field not found" | Invalid field ID | Verify field scriptid |
| "Invalid reference" | Invalid internal ID | Verify record exists |
| "Concurrent submit" | Record lock conflict | Implement retry logic |
| Generic "Unexpected error" | Various causes | Check NetSuite execution logs for details |

**Debug Steps:**
```
# 1. Check NetSuite Execution Logs
Customization > Scripting > Script Execution Log
└─ Filter by: Your Script
└─ Look for ERROR and EMERGENCY level logs

# 2. Review script file
# Verify:
- No emoji or special Unicode characters
- All required modules in define() statement
- Field IDs match NetSuite scriptids
- Error handling for all operations

# 3. Test with simplified request
# Remove complex data, test basic operation
# Gradually add complexity to isolate issue
```

### **Other Common Issues**

| Issue | Symptom | Diagnosis | Solution |
|-------|---------|-----------|----------|
| Deployment not released | Can't call RESTlet | Check deployment status | Set Status to "Released" |
| Deployment not deployed | Can't call RESTlet | Check deployed checkbox | Check "Deployed" box |
| Wrong Script/Deploy ID | 404 Not Found | Check URL parameters | Verify script and deploy IDs |
| Request body too large | 413 Payload Too Large | Check request size | Split into smaller requests |
| Timeout | No response | Check RESTlet complexity | Optimize or increase timeout |
| Rate limiting | Intermittent failures | Check API usage | Implement backoff/retry |

---

## ✅ **Universal Verification Checklist**

Use this checklist for ANY RESTlet setup:

### **Layer 1: Integration Record**
- [ ] Integration record exists
- [ ] Name is descriptive
- [ ] State = Enabled
- [ ] Token-Based Authentication is Checked
- [ ] Consumer Key recorded securely
- [ ] Consumer Secret recorded securely
- [ ] Credentials stored in environment variables (never in code)

### **Layer 2: Access Token**
- [ ] Access Token exists
- [ ] Application Name matches Integration name
- [ ] User is specified (API user/employee)
- [ ] Role is specified and has required permissions
- [ ] Status = Active
- [ ] Token ID recorded securely
- [ ] Token Secret recorded securely
- [ ] Credentials stored in environment variables

### **Layer 3: User/Employee**
- [ ] Employee record exists
- [ ] Employee Status = Active
- [ ] Email address is valid
- [ ] Access tab includes the API role
- [ ] Subsidiary access configured (OneWorld)
- [ ] User is not locked out

### **Layer 4: Role Permissions**
- [ ] Role exists
- [ ] Setup > SuiteScript: View or Full ✅
- [ ] Customization > Web Services: Full ✅
- [ ] Lists permissions: Set for records RESTlet accesses
- [ ] Transaction permissions: Set for transactions RESTlet handles
- [ ] Subsidiary restrictions: Configured correctly (OneWorld)
- [ ] Custom field access: Enabled for required fields

### **Layer 5: RESTlet Deployment**
- [ ] Script uploaded to NetSuite
- [ ] Script file is ASCII-only (no emojis/special chars)
- [ ] Script has GET/POST/PUT/DELETE functions as needed
- [ ] Deployment exists
- [ ] Status = Released
- [ ] Deployed checkbox is checked
- [ ] Audience > Internal roles: Includes API role
- [ ] Audience > Employees: Includes API user (if using user-based)
- [ ] Audience > Subsidiaries: Configured correctly
- [ ] Log Level set appropriately (Debug for dev, Audit for prod)

### **Environment Variables**
- [ ] NETSUITE_CONSUMER_KEY set
- [ ] NETSUITE_CONSUMER_SECRET set
- [ ] NETSUITE_TOKEN_ID set
- [ ] NETSUITE_TOKEN_SECRET set
- [ ] NETSUITE_ACCOUNT_ID set
- [ ] NETSUITE_REALM set
- [ ] All credentials are correct (64 hex characters)
- [ ] No credentials committed to version control

### **Code Implementation**
- [ ] OAuth library configured correctly
- [ ] Realm parameter included in OAuth config
- [ ] Authorization header constructed manually
- [ ] HMAC-SHA256 signature method used
- [ ] RFC 3986 encoding implemented
- [ ] Error handling implemented
- [ ] Timeout configured appropriately
- [ ] Retry logic implemented for transient failures

---

## 📊 **Testing Your Setup**

### **Test 1: Environment Variables**

```bash
#!/bin/bash
# test-netsuite-env.sh

echo "Checking NetSuite Environment Variables..."
echo ""

# Check each variable exists
for var in NETSUITE_CONSUMER_KEY NETSUITE_CONSUMER_SECRET NETSUITE_TOKEN_ID NETSUITE_TOKEN_SECRET NETSUITE_ACCOUNT_ID NETSUITE_REALM; do
    if [ -z "${!var}" ]; then
        echo "❌ $var is not set"
    else
        # Show first 8 and last 4 characters
        value="${!var}"
        masked="${value:0:8}...${value: -4}"
        echo "✅ $var: $masked"
    fi
done
```

### **Test 2: OAuth Connection**

```javascript
// test-oauth-connection.js
const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
require('dotenv').config();

async function testConnection() {
    // Build OAuth
    const oauth = OAuth({
        consumer: {
            key: process.env.NETSUITE_CONSUMER_KEY,
            secret: process.env.NETSUITE_CONSUMER_SECRET
        },
        signature_method: 'HMAC-SHA256',
        hash_function(base_string, key) {
            return crypto.createHmac('sha256', key)
                .update(base_string).digest('base64');
        },
        realm: process.env.NETSUITE_REALM
    });

    const token = {
        key: process.env.NETSUITE_TOKEN_ID,
        secret: process.env.NETSUITE_TOKEN_SECRET
    };

    // Your RESTlet URL
    const url = `https://${process.env.NETSUITE_ACCOUNT_ID}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${scriptId}&deploy=${deployId}`;

    const requestData = { url, method: 'GET' };
    const authData = oauth.authorize(requestData, token);

    // Build header
    let authHeader = `OAuth realm="${process.env.NETSUITE_REALM}",`;
    authHeader += `oauth_consumer_key="${process.env.NETSUITE_CONSUMER_KEY}",`;
    authHeader += `oauth_token="${process.env.NETSUITE_TOKEN_ID}",`;
    authHeader += `oauth_signature_method="${authData.oauth_signature_method}",`;
    authHeader += `oauth_timestamp="${authData.oauth_timestamp}",`;
    authHeader += `oauth_nonce="${authData.oauth_nonce}",`;
    authHeader += `oauth_version="${authData.oauth_version}",`;
    authHeader += `oauth_signature="${encodeURIComponent(authData.oauth_signature)}"`;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': authHeader }
        });
        console.log('✅ Connection successful!');
        console.log('Response:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Connection failed!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data);
        return false;
    }
}

testConnection();
```

### **Test 3: NetSuite Configuration Verification**

Manual checks in NetSuite UI:

```
Checklist:
1. Setup > Integrations > Manage Integrations
   └─ Find your integration
   └─ Confirm: Enabled = Yes, TBA = Checked

2. Setup > Users/Roles > Access Tokens
   └─ Find your token
   └─ Confirm: Status = Active
   └─ Confirm: Role and User are correct

3. Lists > Employees > [Your User]
   └─ Classification: Confirm Active
   └─ Access: Confirm role is assigned

4. Setup > Users/Roles > Manage Roles > [Your Role]
   └─ Permissions > Setup > SuiteScript: View or Full?
   └─ Permissions > Customization > Web Services: Full?
   └─ Permissions > [Category]: Check specific permissions

5. Customization > Scripting > Scripts > [Your Script]
   └─ Deployments > [Deployment]
   └─ Confirm: Status = Released, Deployed = Checked
   └─ Audience: Confirm role/user included
```

---

## 🔒 **Security Best Practices**

### **1. Credential Management**

```bash
# ✅ DO: Use environment variables
export NETSUITE_CONSUMER_KEY="abc123..."

# ✅ DO: Use .env file (add to .gitignore)
echo "NETSUITE_CONSUMER_KEY=abc123..." >> .env
echo ".env" >> .gitignore

# ❌ DON'T: Hardcode in source
const consumerKey = "abc123...";  // NEVER DO THIS

# ❌ DON'T: Commit to git
git add .env  // NEVER DO THIS
```

### **2. Role Permissions**

```
Principle of Least Privilege:
┌─────────────────────────────────────────┐
│ Only grant permissions RESTlet needs   │
│ - Start with minimum (View only)       │
│ - Add permissions as needed            │
│ - Document why each permission needed  │
│ - Review permissions quarterly         │
└─────────────────────────────────────────┘
```

### **3. Access Token Lifecycle**

```
Token Management:
├─ Create token for specific purpose
├─ Document token purpose and permissions
├─ Rotate tokens every 90 days
├─ Revoke unused tokens immediately
├─ Monitor token usage in NetSuite logs
└─ Never share tokens between integrations
```

### **4. Deployment Audience**

```
Access Control:
├─ ❌ NEVER use "All Internal Roles"
├─ ❌ NEVER use "All Employees"
├─ ✅ Explicitly whitelist roles/users
├─ ✅ Use role-based access when possible
└─ ✅ Review audience list quarterly
```

### **5. Monitoring and Auditing**

```
Regular Reviews:
├─ Weekly: Check NetSuite execution logs
├─ Weekly: Monitor for authentication failures
├─ Monthly: Review active tokens
├─ Quarterly: Audit role permissions
└─ Annually: Complete security review
```

### **6. Development vs Production**

```
Environment Separation:
├─ Sandbox: Development and testing
│   └─ Use separate tokens
│   └─ Use separate roles
│   └─ Log at Debug level
│
└─ Production: Live operations only
    └─ Use production-specific tokens
    └─ Use production-specific roles
    └─ Log at Audit/Error level
    └─ Never test in production
```

---

## 📚 **Additional Resources**

### **Official NetSuite Documentation**
- [Token-Based Authentication](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4247337262.html)
- [RESTlet Script Type](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4618524052.html)
- [OAuth 1.0](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_161861656961.html)
- [SuiteScript 2.1 API](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/set_1502135122.html)

### **Community Resources**
- [NetSuite Professionals Group](https://community.oracle.com/netsuite)
- [Stack Overflow - NetSuite Tag](https://stackoverflow.com/questions/tagged/netsuite)

### **Related Documentation in This Project**
- **General OPMS API Integration Role**: `DOCS/NetSuite-Integrations/Roles_and_Permissioins/OPMS API Integration Role — Deployment Guide.md`
- **Vendor Extraction Example**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/VendorListRestlet-Role-Permissions-Guide.md`
- **NetSuite Integration Docs**: `DOCS/NetSuite-Integrations/`

---

## 📋 **Quick Reference Card**

```
╔═══════════════════════════════════════════════════════════════════╗
║             NetSuite RESTlet Authentication Layers                ║
╠═══════════════════════════════════════════════════════════════════╣
║ Layer 1: Integration Record                                       ║
║   Setup > Integrations > Manage Integrations                      ║
║   Provides: Consumer Key + Consumer Secret                        ║
║                                                                    ║
║ Layer 2: Access Token                                             ║
║   Setup > Users/Roles > Access Tokens                             ║
║   Provides: Token ID + Token Secret                               ║
║   Links: Application + User + Role                                ║
║                                                                    ║
║ Layer 3: User/Employee                                            ║
║   Lists > Employees                                                ║
║   Defines: Execution context + Subsidiary access                  ║
║                                                                    ║
║ Layer 4: Role Permissions                                         ║
║   Setup > Users/Roles > Manage Roles                              ║
║   Required: SuiteScript: View, Web Services: Full                 ║
║   Plus: Permissions for operations RESTlet performs               ║
║                                                                    ║
║ Layer 5: Deployment Audience                                      ║
║   Customization > Scripting > Scripts > [Script] > Deployments    ║
║   Whitelist: Roles and/or Users who can call RESTlet              ║
║                                                                    ║
║ All 5 layers must align perfectly for authentication to work!     ║
╚═══════════════════════════════════════════════════════════════════╝

Common Errors:
• 401 Unauthorized → Layers 1-3 (credentials, token, user)
• 403 Forbidden    → Layers 4-5 (permissions, audience)
• 500 Server Error → RESTlet script logic

Environment Variables Required:
• NETSUITE_CONSUMER_KEY
• NETSUITE_CONSUMER_SECRET
• NETSUITE_TOKEN_ID
• NETSUITE_TOKEN_SECRET
• NETSUITE_ACCOUNT_ID
• NETSUITE_REALM
```

---

**Last Updated**: October 15, 2025  
**Applies To**: All NetSuite RESTlets using OAuth 1.0a TBA  
**Status**: ✅ Production-Tested Architecture

