# NetSuite Vendor Extraction Documentation

This directory contains all documentation and specifications related to extracting vendor data from NetSuite Production.

## 📚 **Documentation Files**

### **Primary Guides**

1. **[NetSuite-Production-Vendor-Extraction-Guide.md](./NetSuite-Production-Vendor-Extraction-Guide.md)**
   - Complete step-by-step extraction guide
   - Environment setup instructions
   - Troubleshooting procedures
   - Quick start for existing deployments
   - **Status**: ✅ Production-Verified (Oct 15, 2025)

2. **[VendorListRestlet-Role-Permissions-Guide.md](./VendorListRestlet-Role-Permissions-Guide.md)**
   - Comprehensive authentication and authorization setup
   - Four-layer architecture explanation
   - Role and permission requirements
   - OAuth configuration details
   - Complete troubleshooting guide
   - **Status**: ✅ Production-Verified (Oct 15, 2025)

### **Template Files**

3. **[netsuite-vendors-PROD-template.json](./netsuite-vendors-PROD-template.json)**
   - JSON template for vendor data structure
   - Includes extraction instructions
   - Documents known vendor mappings
   - Top OPMS vendors reference

## 🔗 **Related Files**

### **Scripts**
- **RESTlet**: `netsuite-scripts/VendorListRestlet.js`
- **Extraction Script**: `scripts/extract-vendors-via-restlet-prod.js`
- **OAuth Test**: `scripts/test-production-oauth.js`

### **Output Data**
- **Extracted Data**: `DOCS/ai-specs/netsuite-vendors-PROD-YYYY-MM-DD.json`
- Latest extraction: `DOCS/ai-specs/netsuite-vendors-PROD-2025-10-15.json` (365 vendors)

### **Related Documentation**
- **General OPMS API Integration Role**: `DOCS/NetSuite-Integrations/Roles_and_Permissioins/OPMS API Integration Role — Deployment Guide.md`

## 🚀 **Quick Start**

```bash
# 1. Verify environment variables
grep "NETSUITE_.*_PROD" .env

# 2. Test OAuth connection
node scripts/test-production-oauth.js

# 3. Run extraction
node scripts/extract-vendors-via-restlet-prod.js

# 4. Check output
ls -la DOCS/ai-specs/netsuite-vendors-PROD-*.json
```

## 📊 **Current Status**

- **RESTlet Deployed**: ✅ Script ID: 1762, Deploy ID: 2
- **Last Successful Extraction**: October 15, 2025
- **Vendors Extracted**: 365 active vendors
- **Account**: NetSuite Production (11516011)
- **Subsidiary**: Patra Group : Opuzen

## 🔐 **Authentication Components**

The vendor extraction uses a five-layer authentication system:

1. **Integration Record** → Consumer Key/Secret
2. **Access Token** → Token ID/Secret + Role link
3. **User/Employee** → Execution identity
4. **Role Permissions** → What can be done
5. **RESTlet Audience** → Who can call it

See `VendorListRestlet-Role-Permissions-Guide.md` for complete details.

## 🚨 **Common Issues**

| Issue | Quick Fix |
|-------|-----------|
| 401 Unauthorized | Regenerate Access Token with correct role |
| 403 Forbidden | Add "Vendors: View" to role permissions |
| 500 Server Error | Check for emoji characters in script file |

See individual guides for detailed troubleshooting.

## 📋 **Requirements**

### **Environment Variables**
```bash
NETSUITE_CONSUMER_KEY_PROD
NETSUITE_CONSUMER_SECRET_PROD
NETSUITE_TOKEN_ID_PROD
NETSUITE_TOKEN_SECRET_PROD
NETSUITE_ACCOUNT_ID_PROD=11516011
NETSUITE_REALM_PROD=11516011
```

### **NetSuite Permissions**
- **Role**: OPMS API Integration Role
- **Vendors**: View
- **SuiteScript**: View or Full
- **Web Services**: Full

## 📞 **Support**

For issues or questions:
1. Check the troubleshooting section in the extraction guide
2. Review the role permissions guide
3. Verify all environment variables are set correctly
4. Check NetSuite execution logs for detailed errors

---

**Last Updated**: October 15, 2025  
**Maintained by**: OPMS API Development Team

