# Vendor Extraction Enhancement - Quick Reference

## ✅ Changes Completed

### Files Modified

1. **`netsuite-scripts/VendorListRestlet.js`**
   - ✅ Added `vendorcode` field extraction
   - ✅ Added `terms` (payment schedule) field extraction
   - ✅ Added `prefvendor` (preferred vendor) field extraction
   - ✅ Updated both GET and POST handlers

2. **`scripts/extract-vendors-via-restlet-prod.js`**
   - ✅ Changed output directory to: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/`
   - ✅ Changed output filename to: `NetSuite-Vendors-list.json`
   - ✅ Added summary statistics for new fields
   - ✅ Enhanced console output with field counts

3. **Documentation Created**
   - ✅ `VENDOR-EXTRACTION-UPDATE-v2.md` - Complete technical documentation
   - ✅ `CHANGES-SUMMARY.md` - This quick reference guide

## 📋 New Vendor Fields

| Field Name | NetSuite API | Description | Data Type |
|-----------|--------------|-------------|-----------|
| **code** | `vendorcode` | Vendor's internal code | String |
| **schedule** | `terms` (text) | Payment schedule name | String |
| **scheduleId** | `terms` (value) | Payment schedule ID | String |
| **preferred** | `prefvendor` | Preferred vendor flag | Boolean |

## 🚀 Next Steps - REQUIRED

### Step 1: Deploy Updated RESTlet to NetSuite ⚠️ CRITICAL

The updated `VendorListRestlet.js` file **MUST be deployed** to NetSuite Production before running the extraction script.

**Deployment Instructions:**

1. Log in to **NetSuite Production** account
2. Navigate to: **Customization > Scripting > Scripts**
3. Find script: **VendorListRestlet** (Script ID: `1762`)
4. Click **Edit** on deployment (Deploy ID: `2`)
5. Under **Script File**, click **Remove** then **Add File**
6. Upload the updated file: `netsuite-scripts/VendorListRestlet.js`
7. Set **Status**: **Released**
8. Click **Save**

### Step 2: Verify Role Permissions

Ensure the OAuth role has these permissions:

- ✅ **Vendor Record** - View access
- ✅ **Vendor Code field** - View access  
- ✅ **Terms field** - View access
- ✅ **Preferred Vendor field** - View access

### Step 3: Run Extraction Script

```bash
cd /path/to/opuzen-api
node scripts/extract-vendors-via-restlet-prod.js
```

### Step 4: Verify Output

Check the generated file at:
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/NetSuite-Vendors-list.json
```

Verify it contains the new fields:
- `code`
- `schedule` / `scheduleId`
- `preferred`

## 📊 Expected Output Structure

```json
{
  "metadata": {
    "extractedAt": "2025-10-15T...",
    "version": "2.0.0",
    "totalVendors": 365,
    "fieldsIncluded": [
      "id", "entityid", "companyname", "displayName",
      "isinactive", "subsidiary", "subsidiaryId",
      "code", "schedule", "scheduleId", "preferred"
    ]
  },
  "summary": {
    "totalVendors": 365,
    "vendorsWithCode": 200,
    "vendorsWithSchedule": 180,
    "preferredVendors": 45
  },
  "vendors": [
    {
      "id": "317",
      "entityid": "A. Resource",
      "companyname": "A.Resource",
      "displayName": "A.Resource",
      "code": "ARES001",
      "schedule": "Net 30",
      "scheduleId": "1",
      "preferred": true,
      "subsidiary": "Parent Company : Opuzen Fabrics LLC",
      "subsidiaryId": "1",
      "isinactive": false
    }
  ]
}
```

## 🔍 Testing Checklist

- [ ] RESTlet deployed to NetSuite Production
- [ ] RESTlet deployment status is "Released"
- [ ] Role permissions verified
- [ ] Environment variables in `.env` are correct
- [ ] Extraction script runs without errors
- [ ] Output file created at correct location
- [ ] Output file contains new fields
- [ ] Sample vendor records show populated new fields
- [ ] Summary statistics show correct counts

## 🛠️ Troubleshooting

### New fields return `null` for all vendors

**Cause**: RESTlet not deployed or permissions missing

**Fix**: 
1. Re-deploy RESTlet to NetSuite
2. Check NetSuite Script Execution Logs
3. Verify field permissions in role setup

### "Field not found" error

**Cause**: Field name incorrect for your NetSuite instance

**Fix**:
1. Check NetSuite Records Browser for correct field names
2. Verify if fields are custom (need `custrecord_` prefix)
3. Update field names in RESTlet script

### Script execution times out

**Cause**: Large vendor database

**Fix**:
1. Reduce page size in script (from 1000 to 500)
2. Add longer delays between requests
3. Run during off-peak hours

## 📚 Documentation

- **Full Technical Guide**: [VENDOR-EXTRACTION-UPDATE-v2.md](./VENDOR-EXTRACTION-UPDATE-v2.md)
- **Role Permissions**: [VendorListRestlet-Role-Permissions-Guide.md](./VendorListRestlet-Role-Permissions-Guide.md)
- **Main README**: [README.md](./README.md)

## 🎯 Summary

**What Changed:**
- Added 3 new vendor fields: Code, Schedule, Preferred
- Changed output location and filename
- Enhanced reporting and statistics

**What You Need to Do:**
1. Deploy updated RESTlet to NetSuite Production
2. Run extraction script
3. Verify output file contains new fields

**Output Location:**
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/NetSuite-Vendors-list.json
```

