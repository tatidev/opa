# NetSuite Production Vendor Data Extraction Guide

## 🎯 **Overview**

This guide provides step-by-step instructions for extracting ALL vendor data from the NetSuite Production account (Account ID: 11516011) and storing it as a JSON array for analysis and integration purposes.

## 🚨 **Current Status**

**✅ DEPLOYED AND WORKING**: VendorListRestlet is deployed to production (Script ID: 1762, Deploy ID: 2) and successfully extracting vendor data.

**✅ Last Successful Extraction**: 
- Date: October 15, 2025
- Vendors Extracted: 365 active vendors
- Output File: `DOCS/ai-specs/netsuite-vendors-PROD-2025-10-15.json`

## 📋 **Prerequisites**

### **1. NetSuite Production Access**
- ✅ OAuth credentials configured in `.env`
- ✅ Production account ID: `11516011`
- ✅ **DEPLOYED**: VendorListRestlet (Script ID: 1762, Deploy ID: 2)

### **2. Required Files**
- ✅ `netsuite-scripts/VendorListRestlet.js` - RESTlet script for vendor extraction
- ✅ `scripts/extract-vendors-via-restlet-prod.js` - Extraction script
- ✅ `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-PROD-template.json` - Template file

### **3. Environment Variables Required**
```bash
NETSUITE_CONSUMER_KEY_PROD=<your_consumer_key>
NETSUITE_CONSUMER_SECRET_PROD=<your_consumer_secret>
NETSUITE_TOKEN_ID_PROD=<your_token_id>
NETSUITE_TOKEN_SECRET_PROD=<your_token_secret>
NETSUITE_ACCOUNT_ID_PROD=11516011
NETSUITE_REALM_PROD=11516011
```

**⚠️ CRITICAL**: The `NETSUITE_REALM_PROD` variable is required for proper OAuth authentication.

## 🚀 **Quick Start (Existing Deployment)**

If the RESTlet is already deployed (which it is), simply run:

```bash
node scripts/extract-vendors-via-restlet-prod.js
```

**Expected Output:**
```
🔧 NetSuite Vendor RESTlet Extractor initialized for PRODUCTION account: 11516011
🌐 RESTlet URL: https://11516011.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1762&deploy=2
🚀 Starting NetSuite Production Vendor Extraction via RESTlet...
============================================================
🧪 Testing RESTlet connection...
✅ RESTlet connection successful!
🔍 Starting vendor extraction from NetSuite PRODUCTION via RESTlet...
📄 Extracting vendors 1 to 1000...
✅ Extracted 365 vendors (Total: 365)
🎉 Vendor extraction complete! Total vendors extracted: 365
💾 Vendor data saved to: DOCS/ai-specs/netsuite-vendors-PROD-2025-10-15.json
📊 Summary: 365 total vendors (365 active, 0 inactive)
```

## 🔧 **Initial Deployment (One-Time Setup)**

If you need to deploy the RESTlet to a new NetSuite account or redeploy:

### **Step 1: Deploy VendorListRestlet to Production**

1. **Access NetSuite Production Account**
   - Log into NetSuite production account (11516011)
   - Navigate to: `Customization > Scripting > Scripts > New`

2. **Create New Script**
   - Script Type: `RESTlet`
   - Name: `Opuzen Vendor List RESTlet`
   - ID: `customscript_opuzen_vendor_list` (or auto-generated)
   - **⚠️ CRITICAL**: Upload `netsuite-scripts/VendorListRestlet.js` (NOT the old version with emojis)

3. **Script File Upload Warning**
   - ⚠️ **DO NOT use emoji characters** in SuiteScript files
   - Emoji characters cause "Unsupported file extension" errors
   - The current `VendorListRestlet.js` is clean (ASCII-only)
   - Backup with emojis: `VendorListRestlet-old-with-emojis.js`

4. **Deploy the Script**
   - Save the script
   - Click **Deploy Script**
   - **Title**: `Opuzen Vendor List RESTlet 2`
   - **ID**: `customdeploy_opuzen_vendor_list_restlet`
   - **Status**: Released
   - **Log Level**: Debug (for troubleshooting)
   
5. **Configure Deployment Audience** (CRITICAL)
   - **Audience Tab > Internal roles**: Add `OPMS API Integration Role`
   - **Audience Tab > Employees**: Add `Folio3 Opuzen3` (or your API user)
   - **Audience Tab > Subsidiaries**: Add `Patra Group : Opuzen`

6. **Note Script and Deploy IDs**
   - After saving, note the Script ID (e.g., 1762)
   - Note the Deploy ID (e.g., 2)
   - Update extraction script if different from 1762/2

### **Step 2: Configure OAuth Credentials**

1. **Create/Verify Integration Record**
   - Navigate to: `Setup > Integrations > Manage Integrations > New`
   - **Name**: `OPMS-API`
   - **State**: Enabled
   - **Token-Based Authentication**: Checked ✅
   - Save and record Consumer Key/Secret

2. **Create Access Token**
   - Navigate to: `Setup > Users/Roles > Access Tokens > New`
   - **Application Name**: `OPMS-API` (must match integration)
   - **User**: `Folio3 Opuzen3` (or your API user)
   - **Role**: `OPMS API Integration Role` ⚠️ **MUST match RESTlet audience**
   - Save and record Token ID/Secret

3. **Update .env File**
   ```bash
   NETSUITE_CONSUMER_KEY_PROD=<consumer_key_from_integration>
   NETSUITE_CONSUMER_SECRET_PROD=<consumer_secret_from_integration>
   NETSUITE_TOKEN_ID_PROD=<token_id_from_access_token>
   NETSUITE_TOKEN_SECRET_PROD=<token_secret_from_access_token>
   NETSUITE_ACCOUNT_ID_PROD=11516011
   NETSUITE_REALM_PROD=11516011
   ```

4. **Verify Role Permissions**
   - See: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/VendorListRestlet-Role-Permissions-Guide.md`
   - Minimum required: `Vendors: View`, `SuiteScript: View or Full`

### **Step 3: Update Extraction Script (If Needed)**

If your Script ID or Deploy ID differs from 1762/2:

```javascript
// In scripts/extract-vendors-via-restlet-prod.js, line 74
this.restletUrl = `https://${accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script={YOUR_SCRIPT_ID}&deploy={YOUR_DEPLOY_ID}`;
```

### **Step 4: Run Extraction**

```bash
node scripts/extract-vendors-via-restlet-prod.js
```

### **Step 5: Verify Results**

1. **Check Output File**
   ```bash
   ls -la DOCS/ai-specs/netsuite-vendors-PROD-*.json
   ```

2. **Validate JSON Structure**
   ```bash
   cat DOCS/ai-specs/netsuite-vendors-PROD-*.json | jq '.metadata'
   ```

3. **Review Vendor Count**
   ```bash
   cat DOCS/ai-specs/netsuite-vendors-PROD-*.json | jq '.summary'
   ```

## 📊 **Actual Output Structure**

The extraction creates a JSON file with the following structure (based on actual extraction):

```json
{
  "metadata": {
    "extractedAt": "2025-10-15T00:42:53.414Z",
    "source": "NetSuite Production Account",
    "accountId": "11516011",
    "totalVendors": 365,
    "extractionMethod": "RESTlet (VendorListRestlet)",
    "version": "1.0.0",
    "restletUrl": "https://11516011.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1762&deploy=2"
  },
  "summary": {
    "totalVendors": 365,
    "activeVendors": 365,
    "inactiveVendors": 0,
    "vendorsWithCompanyName": 350,
    "vendorsWithEntityId": 365
  },
  "vendors": [
    {
      "id": "326",
      "entityid": "Dekortex",
      "companyname": "Dekortex",
      "displayName": "Dekortex",
      "isinactive": false,
      "subsidiary": "Patra Group : Opuzen",
      "subsidiaryId": "2"
    }
  ]
}
```

**Fields Extracted:**
- `id`: NetSuite internal ID
- `entityid`: Entity ID (vendor code)
- `companyname`: Company name
- `displayName`: Display name (computed)
- `isinactive`: Active/inactive status (boolean)
- `subsidiary`: Subsidiary name (e.g., "Patra Group : Opuzen")
- `subsidiaryId`: Subsidiary internal ID

## 🚨 **Troubleshooting**

### **Common Issues and Solutions**

| Issue | Cause | Solution |
|-------|-------|----------|
| **401 Unauthorized** | OAuth token not created with correct role | Regenerate Access Token with "OPMS API Integration Role" |
| **401 Unauthorized** | Missing `realm` parameter in OAuth | Verify `NETSUITE_REALM_PROD=11516011` in .env |
| **403 Forbidden** | Role lacks Vendors permission | Add "Vendors: View" to OPMS API Integration Role |
| **403 Forbidden** | RESTlet audience doesn't include role | Add role to RESTlet deployment Audience tab |
| **404 Not Found** | Wrong Script/Deploy ID | Verify script=1762&deploy=2 or update script |
| **500 Unsupported file extension** | Emoji characters in script file | Use `VendorListRestlet.js` (clean version) |
| **500 Unexpected Error** | Script file not uploaded correctly | Re-upload script file to NetSuite |

### **Debug Steps**

1. **Test OAuth Connection**
   ```bash
   node scripts/test-production-oauth.js
   ```

2. **Verify Environment Variables**
   ```bash
   grep "NETSUITE_.*_PROD" .env
   ```

3. **Check RESTlet Deployment**
   - Navigate to: `Customization > Scripting > Script Deployments`
   - Find deployment ID 2 for script 1762
   - Verify Status = Released, Deployed = Checked

4. **Verify Role Assignment**
   - Navigate to: `Lists > Employees > [API User]`
   - Access tab should show "OPMS API Integration Role"

5. **Check Integration Record**
   - Navigate to: `Setup > Integrations > Manage Integrations`
   - Find "OPMS-API" integration
   - Verify State = Enabled

6. **Verify Access Token**
   - Navigate to: `Setup > Users/Roles > Access Tokens`
   - Find your token (matches TOKEN_ID_PROD)
   - Verify Status = Active, Role = OPMS API Integration Role

## 📁 **File Locations**

- **Template**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-PROD-template.json`
- **RESTlet Script**: `netsuite-scripts/VendorListRestlet.js`
- **Extraction Script**: `scripts/extract-vendors-via-restlet-prod.js`
- **Output**: `DOCS/ai-specs/netsuite-vendors-PROD-YYYY-MM-DD.json` (extracted data remains in ai-specs)
- **Role Guide**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/VendorListRestlet-Role-Permissions-Guide.md`

## ✅ **Success Criteria**

- ✅ VendorListRestlet deployed to production (Script ID: 1762, Deploy ID: 2)
- ✅ OAuth credentials working for production
- ✅ NETSUITE_REALM_PROD configured in .env
- ✅ Extraction script runs without errors
- ✅ JSON file created with vendor data
- ✅ Vendor count matches expected range (365 vendors as of Oct 2025)
- ✅ All vendor fields populated correctly
- ✅ Subsidiary information included

## 🔄 **Next Steps After Extraction**

1. **Validate Data Quality**
   - Check for missing company names (15 vendors without company names)
   - Verify entity IDs are unique (all 365 have entity IDs)
   - Confirm active/inactive status accuracy (all 365 are active)
   - Review subsidiary assignments

2. **Update Vendor Mappings**
   - Map OPMS vendors to NetSuite vendors
   - Update `opms_netsuite_vendor_mapping` table
   - Verify high-priority vendor mappings (Dekortex, Regal, Morgan/MJD, etc.)

3. **Integration Testing**
   - Test vendor lookup in item creation
   - Verify vendor sublist population
   - Test vendor field mapping

## 🔐 **Security Notes**

- Never commit OAuth credentials to git
- Use environment variables for all sensitive data
- Rotate Access Tokens periodically
- Monitor RESTlet execution logs for unauthorized access
- Keep Consumer Key/Secret secure

## 📞 **Support & Documentation**

- **Role Setup Guide**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/VendorListRestlet-Role-Permissions-Guide.md`
- **General NetSuite Integration**: `DOCS/NetSuite-Integrations/`
- **OPMS API Integration Role**: `DOCS/NetSuite-Integrations/Roles_and_Permissioins/OPMS API Integration Role — Deployment Guide.md`

---

**Last Updated**: October 15, 2025  
**Status**: ✅ Production-Ready  
**Tested with**: NetSuite Account 11516011, 365 active vendors
