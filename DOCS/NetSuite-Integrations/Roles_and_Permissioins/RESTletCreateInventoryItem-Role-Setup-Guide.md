# NetSuite Role Setup Guide for RESTletCreateInventoryItem20250814-a.js

**Purpose:** Step-by-step instructions with REAL NetSuite forms and fields to create the exact role needed for the RESTlet `netsuite-scripts/RESTletCreateInventoryItem20250814-a.js`.

---

## 📋 Prerequisites

Before you begin, ensure these features are enabled in your NetSuite account:

### Enable Required Features
**Navigation:** Setup → Company → Enable Features

#### Tab: Items & Inventory
- ☑️ **Inventory** (under Features subtab)
- ☑️ **Lot Numbered Inventory Items** (under Items/Transactions subtab)

#### Tab: SuiteCloud
- ☑️ **SuiteScript** (under SuiteScript subtab)
- ☑️ **Server SuiteScript** (under SuiteScript subtab)
- ☑️ **Client SuiteScript** (under SuiteScript subtab - if needed)
- ☑️ **Token-Based Authentication** (under Manage Authentication subtab)
- ☑️ **REST Web Services** (under SuiteTalk (Web Services) subtab)
- ☑️ **SOAP Web Services** (under SuiteTalk (Web Services) subtab)

#### Tab: Company (if OneWorld)
- ☑️ **Multiple Vendors** (under General subtab)
  - **CRITICAL:** This must be enabled for the `itemvendor` sublist to work

Click **Save** after enabling all features.

---

## 🛠️ Step 1: Create the Role

### 1.1 Navigate to Role Creation
**Navigation:** Setup → Users/Roles → Manage Roles → New

### 1.2 Fill Basic Information Tab

| Field Name | Value | Notes |
|------------|-------|-------|
| **Name** | `OPMS API Integration Role` | Exact name for easy identification |
| **ID** | *(auto-generated)* | NetSuite will generate this |
| **Center Type** | `Standard Role` | From dropdown - RESTlets work with any center type |
| **Web Services Only Role** | ☐ Unchecked | Must be unchecked for RESTlet access |
| **Restrict Time and Expenses** | ☐ Unchecked | Not needed |
| **Restrict Employee Fields** | ☐ Unchecked | Not needed |
| **Two-Factor Authentication Required** | ☐ Unchecked | Optional - your security policy |
| **Description** | `Role for OPMS API Integration RESTlet. Grants permissions to create/update Lot Numbered Inventory Items with vendor sublist and all custom OPMS fields. Restricted to Opuzen subsidiary (ID: 2).` | Clear documentation |

**Click Save** - This unlocks the other tabs.

---

## 🔐 Step 2: Configure Permissions

After saving, you'll see multiple tabs. Configure each as follows:

### 2.1 Permissions → Setup Tab

**Navigation:** (After creating role) → Setup subtab

| Permission Name | Level | Location in Dropdown | Why Needed |
|----------------|-------|---------------------|------------|
| **SuiteScript** | `Full` | Under "SuiteCloud" section | Required to execute RESTlet code |
| **REST Web Services** | `Full` | Under "SuiteCloud" section | Required for RESTlet HTTP access |
| **SOAP Web Services** | `Full` | Under "SuiteCloud" section | Good practice for API roles |
| **Log in using Access Tokens** | `Full` | Under "Login" section | **CRITICAL** for Token-Based Authentication |
| **Access Token Management** | `View` | Under "Login" section | Optional - only if this user needs to see tokens |
| **Set Up Taxes** | `View` | Under "Setup" section | Allows setting `taxschedule` field |
| **Accounting Lists** | `View` | Under "Lists" section | Alternative to Set Up Taxes |

**How to add each permission:**
1. Click **Add** button in the Permissions → Setup section
2. Find the permission in the dropdown (they're alphabetically sorted)
3. Select the permission
4. Set the Level dropdown to the value specified above
5. Click **Add** button
6. Repeat for all permissions

### 2.2 Permissions → Lists Tab

**Navigation:** (After creating role) → Lists subtab

| Permission Name | Level | Location in Dropdown | Why Needed |
|----------------|-------|---------------------|------------|
| **Items** | `Full` | Under "Lists" section | **CRITICAL** - Allows create/edit/delete inventory items |
| **Vendors** | `View` | Under "Lists" section | **CRITICAL** - Required to read vendor records for `itemvendor` sublist |
| **Accounts** | `View` | Under "Lists" section | Allows setting `incomeaccount` and `cogsaccount` fields |
| **Units of Measure** | `View` | Under "Lists" section | Optional - needed if item form references UoM |
| **Subsidiaries** | `View` | Under "Lists" section | Needed to validate subsidiary field |

**How to add each permission:**
1. Click **Add** button in the Permissions → Lists section
2. Find the permission in the dropdown
3. Select the permission
4. Set the Level dropdown to the value specified above
5. Click **Add** button
6. Repeat for all permissions

### 2.3 Permissions → Transactions Tab

**Navigation:** (After creating role) → Transactions subtab

| Permission Name | Level | Location in Dropdown | Why Needed |
|----------------|-------|---------------------|------------|
| **Find Transaction** | `View` | Under "Reports" section | Optional - for future extensibility |

**Note:** The current RESTlet doesn't use transactions, but this is good for future-proofing.

### 2.4 Permissions → Reports Tab

**Navigation:** (After creating role) → Reports subtab

**No permissions required for this RESTlet** - Leave empty for now.

### 2.5 Permissions → Custom Records Tab

**Navigation:** (After creating role) → Custom Records subtab

**Action:** If your NetSuite account has custom records that the RESTlet needs to access:
- Add each custom record type
- Set level to `View` or `Full` as needed

**For current RESTlet:** No custom record permissions required.

---

## 🌍 Step 3: Configure Subsidiary Restrictions (OneWorld Only)

**Skip this section if you're not using OneWorld (multi-subsidiary feature).**

### 3.1 Navigate to Subsidiaries Tab
**Navigation:** (After creating role) → Subsidiaries subtab

### 3.2 Add Opuzen Subsidiary

| Setting | Value | Why |
|---------|-------|-----|
| **Subsidiary** | `Opuzen` | This is hardcoded in the RESTlet (ID: 2) |
| **Level** | `Full` | Allows all operations on items in this subsidiary |
| **Restrict to Subsidiary** | ☑️ Checked | **CRITICAL** - Restricts role to ONLY Opuzen subsidiary |

**How to add:**
1. In the Subsidiaries subtab, click **Add**
2. Select **Opuzen** from the subsidiary dropdown
3. Check **Restrict to Subsidiary**
4. Set permission level to **Full**
5. Click **Add**

**IMPORTANT:** The RESTlet hardcodes `subsidiary: 2` on line 91. If "Opuzen" is not ID 2 in your account:
- Run this search to find your subsidiary ID: Lists → Subsidiaries → find Opuzen → check Internal ID
- Update the RESTlet or the role configuration accordingly

---

## 🎨 Step 4: Configure Custom Field Access

**This is CRITICAL and often overlooked!**

The RESTlet uses approximately 30 custom fields. Each field must grant access to this role.

### 4.1 Navigate to Each Custom Field

**Navigation:** Customization → Lists, Records, & Fields → Item Fields → Custom Item Fields

### 4.2 Critical Fields to Check

Find and edit EACH of these custom fields:

#### Required Fields (RESTlet will fail without these)
- `custitem_opms_prod_id` - OPMS Product ID
- `custitem_opms_item_id` - OPMS Item ID

#### Optional Fields (RESTlet sets if provided)
- `custitem_opms_front_content` - Front Content (Rich Text, large)
- `custitem_opms_back_content` - Back Content (Rich Text, large)
- `custitem_opms_abrasion` - Abrasion Test Results (Rich Text)
- `custitem_opms_firecodes` - Fire Code Certifications (Rich Text)
- `custitem_opms_vendor_color` - Vendor Color Code
- `custitem_opms_vendor_prod_name` - Vendor Product Name
- `custitem_opms_vendor_name` - Vendor Business Name
- `custitem_opms_fabric_width` - Fabric Width
- `custitem_opms_item_colors` - Item Colors (comma-separated)
- `custitem_opms_finish` - Finish
- `custitem_opms_fabric_cleaning` - Cleaning Instructions
- `custitem_opms_product_origin` - Product Origin
- `custitem_opms_parent_product_name` - Parent Product Name
- `custitem_item_application` - Item Application
- `custitem_is_repeat` - Is Repeat
- `custitemf3_lisa_item` - Lisa Slayman Item (checkbox)
- `custitem_f3_rollprice` - F3 Roll Price
- `custitem_vertical_repeat` - Vertical Repeat (VR)
- `custitem_horizontal_repeat` - Horizontal Repeat (HR)
- `custitem_prop65_compliance` - Prop 65 Compliance
- `custitem_ab2998_compliance` - AB 2998 Compliance
- `custitem_tariff_harmonized_code` - Tariff/Harmonized Code
- `custitem1` - Width (legacy field)
- `custitem5` - Repeat (legacy checkbox)

### 4.3 For Each Field, Check Access

1. Click on the field name to edit it
2. Navigate to the **Access** tab
3. Look at the **Roles** section

**Option A - Simplest (Recommended):**
- Check **Available to All Roles**
- Click **Save**

**Option B - More Restrictive:**
- Uncheck **Available to All Roles**
- Click **Add** in the Roles section
- Select `OPMS API Integration Role`
- Click **Add**
- Click **Save**

### 4.4 Verification Script

To find all custom fields your RESTlet uses, search the RESTlet file for `custitem`:

```bash
grep -o "custitem[a-zA-Z0-9_]*" netsuite-scripts/RESTletCreateInventoryItem20250814-a.js | sort -u
```

**Expected output:** All field IDs listed in section 4.2 above.

---

## 👤 Step 5: Create or Configure the API User

### 5.1 Create Employee Record (if not exists)

**Navigation:** Lists → Employees → New

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `OPMS Integration` | First name: OPMS, Last name: Integration |
| **Email** | `opms-api@opuzen.com` | Or your integration email |
| **Give Access** | ☑️ Checked | **CRITICAL** - This enables login |
| **Access Role** | `OPMS API Integration Role` | Select the role we just created |
| **Email Preference** | `No Email` | Recommended for API users |

Click **Save**.

### 5.2 Add Role to Existing Employee

**Navigation:** Lists → Employees → find your API user → Edit

1. Go to **Access** subtab
2. Click **Edit** next to "Select Roles"
3. Check ☑️ `OPMS API Integration Role`
4. Click **Done**
5. Click **Save**

---

## 🔑 Step 6: Create Integration Record

**Navigation:** Setup → Integrations → Manage Integrations → New

| Field | Value | Notes |
|-------|-------|-------|
| **Name** | `OPMS API Integration` | Clear, descriptive name |
| **State** | `Enabled` | Must be enabled |
| **Concurrency Limit** | *(leave default)* | Usually 1 for single-threaded APIs |
| **Token-Based Authentication** | ☑️ Checked | **CRITICAL** for OAuth 1.0 |
| **TBA: Authorization Flow** | `Authorization Code Grant` | Standard for RESTlets |
| **Callback URL** | *(leave empty for RESTlets)* | Not needed for server-to-server |

**Click Save**.

**IMPORTANT:** After saving, note down:
- **Consumer Key** (like a client ID)
- **Consumer Secret** (like a client secret)

**These are shown ONLY ONCE**. Store them securely in your `.env` file.

---

## 🎫 Step 7: Create Access Token

**Navigation:** Setup → Users/Roles → Access Tokens → New

| Field | Value | Notes |
|-------|-------|-------|
| **Application Name** | `OPMS API Integration` | Select the integration from Step 6 |
| **User** | `OPMS Integration` | The employee from Step 5 |
| **Role** | `OPMS API Integration Role` | The role we created |
| **Token Name** | `OPMS API Production Token` | Descriptive name |

**Click Save**.

**IMPORTANT:** After saving, note down:
- **Token ID** (like a username)
- **Token Secret** (like a password)

**These are shown ONLY ONCE**. Store them securely in your `.env` file.

---

## 📜 Step 8: Deploy RESTlet with Role Audience

### 8.1 Navigate to Script Deployment

**Navigation:** Customization → Scripting → Scripts → find your RESTlet → Deployments tab → find deployment → Edit

### 8.2 Configure Audience Tab

1. Scroll to **Audience** subtab
2. Look for **Roles** section

**Option A - Specific Role (Recommended):**
- Click **Add** next to Roles
- Select `OPMS API Integration Role`
- Click **Add**

**Option B - All Employees:**
- Check **All Employees**
- *(Less secure - not recommended)*

### 8.3 Verify Deployment Settings

| Field | Value | Notes |
|-------|-------|-------|
| **Status** | `Released` | Must be Released, not Testing |
| **Log Level** | `Debug` | Recommended for troubleshooting |
| **Execute as Role** | `OPMS API Integration Role` | **CRITICAL** for permission enforcement |

**Click Save**.

---

## ✅ Step 9: Testing & Verification

### 9.1 Test RESTlet Connectivity (GET)

```bash
curl -X GET "https://<ACCOUNT_ID>.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=<SCRIPT_ID>&deploy=<DEPLOYMENT_ID>" \
  -H "Authorization: OAuth realm=\"<ACCOUNT_ID>\", \
    oauth_consumer_key=\"<CONSUMER_KEY>\", \
    oauth_token=\"<TOKEN_ID>\", \
    oauth_signature_method=\"HMAC-SHA256\", \
    oauth_timestamp=\"<TIMESTAMP>\", \
    oauth_nonce=\"<NONCE>\", \
    oauth_version=\"1.0\", \
    oauth_signature=\"<SIGNATURE>\""
```

**Expected Response:**
```json
{
  "success": true,
  "message": "CreateInventoryItemRestlet is active and ready (CREATION ONLY)",
  "timestamp": "2025-01-15T...",
  "version": "3.1.0"
}
```

### 9.2 Test Item Creation (POST)

```bash
curl -X POST "https://<ACCOUNT_ID>.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=<SCRIPT_ID>&deploy=<DEPLOYMENT_ID>" \
  -H "Authorization: OAuth ..." \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "opmsAPI-TEST-ROLE-001",
    "displayName": "Test Role Setup Item",
    "upcCode": "000000000001",
    "taxScheduleId": <YOUR_TAX_SCHEDULE_ID>,
    "custitem_opms_prod_id": 999,
    "custitem_opms_item_id": 888,
    "vendor": <YOUR_VENDOR_ID>
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "id": <NETSUITE_INTERNAL_ID>,
  "itemId": "opmsAPI-TEST-ROLE-001",
  "message": "Inventory item created successfully",
  "operation": "CREATE"
}
```

### 9.3 Common Errors and Fixes

| Error Message | Cause | Fix |
|--------------|-------|-----|
| `USER_ERROR: Insufficient permissions` | Items permission too low | Change Items permission to **Full** |
| `INVALID_LOGIN_ATTEMPT` | Token-Based Auth not enabled | Enable "Log in using Access Tokens" permission |
| `SSS_INVALID_SUBSIDIARY` | Subsidiary not in role | Add Opuzen (ID: 2) to role's Subsidiaries tab |
| `You do not have permissions to set this value (taxschedule)` | Tax setup permission missing | Add "Set Up Taxes" → View permission |
| `You do not have permissions to set this value (vendor)` | Vendor permission missing | Add "Vendors" → View permission |
| `You do not have permissions to set this value (incomeaccount)` | Account permission missing | Add "Accounts" → View permission |
| `Custom field not found: custitem_opms_prod_id` | Field access not granted | Add role to field's Access tab |
| `Error processing vendor sublist` | Multiple Vendors feature disabled | Enable "Multiple Vendors" in Features |

---

## 📊 Complete Permission Summary

### Quick Reference Table

| Category | Permission | Level | Critical? |
|----------|-----------|-------|-----------|
| **Setup** | SuiteScript | Full | ✅ |
| **Setup** | REST Web Services | Full | ✅ |
| **Setup** | Log in using Access Tokens | Full | ✅ |
| **Setup** | Set Up Taxes | View | ✅ |
| **Lists** | Items | Full | ✅ |
| **Lists** | Vendors | View | ✅ |
| **Lists** | Accounts | View | ✅ |
| **Lists** | Subsidiaries | View | ✅ |
| **Lists** | Units of Measure | View | ⚠️ Optional |
| **Transactions** | Find Transaction | View | ⚠️ Optional |

---

## 🎯 RESTlet-Specific Requirements Checklist

Based on `RESTletCreateInventoryItem20250814-a.js` analysis:

- [ ] **Record Operations**
  - [ ] `record.create()` - LOT_NUMBERED_INVENTORY_ITEM
  - [ ] `record.load()` - Load existing items
  - [ ] `record.save()` - Save changes
  - [ ] `search.create()` - Find items by itemId

- [ ] **Field Operations**
  - [ ] Native fields: `itemid`, `displayname`, `upccode`, `taxschedule`, `subsidiary`, `vendor`, `vendorname`, `vendorcode`, `incomeaccount`, `cogsaccount`, `description`
  - [ ] 30+ custom fields: All `custitem_opms_*` fields
  - [ ] Lot numbering: `islotitem`, `lotnumberformat`, `startsequencenumber`

- [ ] **Sublist Operations**
  - [ ] `itemvendor` sublist manipulation
  - [ ] `selectNewLine()`, `setCurrentSublistValue()`, `commitLine()`
  - [ ] Fields: `vendor`, `vendorcode`, `preferredvendor`

- [ ] **Subsidiary Constraints**
  - [ ] Hardcoded to subsidiary 2 (Opuzen)
  - [ ] Role must have Full access to Opuzen subsidiary

---

## 🔒 Security Best Practices

1. **Least Privilege:** This role grants ONLY the permissions needed for the RESTlet
2. **Subsidiary Restriction:** Role is locked to Opuzen subsidiary only
3. **No UI Access:** Role is designed for API access only
4. **Token Rotation:** Rotate access tokens every 90 days
5. **Audit Logging:** Monitor RESTlet execution logs regularly
6. **Custom Field Access:** Only grants access to OPMS-specific fields

---

## 📝 Maintenance Notes

### When to Update This Role

- **New Custom Fields:** If RESTlet adds new `custitem_*` fields, update field access
- **New Record Types:** If RESTlet starts using new record types, add permissions
- **Subsidiary Changes:** If Opuzen subsidiary ID changes, update role configuration
- **Security Audit:** Review permissions quarterly

### How to Clone This Role

If you need to create a similar role for another integration:

1. Navigate to Setup → Users/Roles → Manage Roles
2. Find `OPMS API Integration Role`
3. Click **Copy**
4. Rename and modify as needed

---

## 🆘 Troubleshooting Resources

### NetSuite Documentation
- [Token-Based Authentication Guide](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4247337262.html)
- [SuiteScript 2.1 Record API](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_4267255811.html)
- [Role Permissions Reference](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N296185.html)

### Logs to Check
- **Execution Logs:** Customization → Scripting → Script Execution Log
- **System Notes:** Records → System Notes (filter by record type: Item)
- **Login Audit Trail:** Setup → Users/Roles → Login Audit Trail

---

## ✅ Final Validation Checklist

Before considering the role setup complete:

- [ ] Role created with name "OPMS API Integration Role"
- [ ] All Setup permissions added (SuiteScript, REST Web Services, Log in using Access Tokens, Set Up Taxes)
- [ ] All Lists permissions added (Items=Full, Vendors=View, Accounts=View)
- [ ] Subsidiary restriction set to Opuzen (ID: 2) with Full access
- [ ] All 30+ custom fields have role access granted
- [ ] Employee/User has role assigned
- [ ] Integration record created with TBA enabled
- [ ] Access token created for user + role
- [ ] Consumer Key and Consumer Secret saved securely
- [ ] Token ID and Token Secret saved securely
- [ ] RESTlet deployment audience includes this role
- [ ] RESTlet deployment is Released (not Testing)
- [ ] GET test returns success response
- [ ] POST test creates item successfully
- [ ] Test item visible in NetSuite UI under Opuzen subsidiary

---

**Last Updated:** January 2025  
**RESTlet Version:** 4.0 (Upsert with Vendor Sublist Support)  
**Tested On:** NetSuite 2024.2  
**Author:** OPMS Integration Team

