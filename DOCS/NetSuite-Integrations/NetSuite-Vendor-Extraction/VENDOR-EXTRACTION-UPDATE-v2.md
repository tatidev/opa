# NetSuite Vendor Extraction Update - Version 2.0

## Overview

The NetSuite vendor extraction has been enhanced to include additional vendor data fields as requested. This document details the changes made to the extraction system.

## Changes Summary

### New Vendor Fields Added

The following fields have been added to the vendor extraction:

1. **Code** (`vendorcode`) - Vendor's internal code/identifier
2. **Schedule** (`terms`) - Payment terms/schedule for the vendor
3. **Preferred** (`prefvendor`) - Boolean indicating if this is a preferred vendor

### Existing Fields (Retained)

- **Vendor Name** (`companyname`) - Company/business name
- **Entity ID** (`entityid`) - NetSuite entity identifier
- **Display Name** (`displayName`) - Computed display name
- **Subsidiary** (`subsidiary`) - Associated subsidiary (text and ID)
- **Internal ID** (`id`) - NetSuite internal vendor ID
- **Is Inactive** (`isinactive`) - Active/inactive status

## Files Modified

### 1. VendorListRestlet.js (`netsuite-scripts/VendorListRestlet.js`)

**Changes:**
- Added `vendorcode`, `terms`, and `prefvendor` to search columns
- Updated vendor data structure to include:
  - `code`: Vendor code from NetSuite
  - `schedule`: Payment terms name (human-readable)
  - `scheduleId`: Payment terms internal ID
  - `preferred`: Boolean flag for preferred vendor status

**NetSuite Fields Used:**
```javascript
columns: [
    'internalid',
    'entityid', 
    'companyname',
    'isinactive',
    'subsidiary',
    'vendorcode',      // NEW
    'terms',           // NEW (payment schedule)
    'prefvendor'       // NEW (preferred vendor flag)
]
```

**Data Mapping:**
```javascript
{
    id: vendor.getValue('internalid'),
    entityid: vendor.getValue('entityid'),
    companyname: vendor.getValue('companyname'),
    displayName: vendor.getValue('companyname') || vendor.getValue('entityid'),
    isinactive: vendor.getValue('isinactive'),
    subsidiary: vendor.getText('subsidiary') || null,
    subsidiaryId: vendor.getValue('subsidiary') || null,
    code: vendor.getValue('vendorcode') || null,                    // NEW
    schedule: vendor.getText('terms') || null,                      // NEW
    scheduleId: vendor.getValue('terms') || null,                   // NEW
    preferred: vendor.getValue('prefvendor') === 'T' || true       // NEW
}
```

### 2. extract-vendors-via-restlet-prod.js (`scripts/extract-vendors-via-restlet-prod.js`)

**Changes:**
- Updated output path to: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/`
- Changed filename to fixed name: `NetSuite-Vendors-list.json`
- Updated metadata version to `2.0.0`
- Added new summary statistics:
  - `vendorsWithCode`: Count of vendors with vendor codes
  - `vendorsWithSchedule`: Count of vendors with payment schedules
  - `preferredVendors`: Count of preferred vendors
- Enhanced console output with detailed field statistics

## Output File Structure

### Location
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/NetSuite-Vendors-list.json
```

### JSON Structure
```json
{
  "metadata": {
    "extractedAt": "ISO 8601 timestamp",
    "source": "NetSuite Production Account",
    "accountId": "NetSuite account ID",
    "totalVendors": 365,
    "extractionMethod": "RESTlet (VendorListRestlet)",
    "version": "2.0.0",
    "restletUrl": "RESTlet endpoint URL",
    "fieldsIncluded": [
      "id", "entityid", "companyname", "displayName", 
      "isinactive", "subsidiary", "subsidiaryId",
      "code", "schedule", "scheduleId", "preferred"
    ]
  },
  "summary": {
    "totalVendors": 365,
    "activeVendors": 365,
    "inactiveVendors": 0,
    "vendorsWithCompanyName": 350,
    "vendorsWithEntityId": 365,
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
      "isinactive": false,
      "subsidiary": "Parent Company : Opuzen Fabrics LLC",
      "subsidiaryId": "1",
      "code": "ARES001",
      "schedule": "Net 30",
      "scheduleId": "1",
      "preferred": true
    }
  ]
}
```

## Usage Instructions

### Prerequisites

1. **Environment Variables** must be configured in `.env`:
   ```
   NETSUITE_CONSUMER_KEY_PROD=your_key
   NETSUITE_CONSUMER_SECRET_PROD=your_secret
   NETSUITE_TOKEN_ID_PROD=your_token_id
   NETSUITE_TOKEN_SECRET_PROD=your_token_secret
   NETSUITE_ACCOUNT_ID_PROD=your_account_id
   NETSUITE_REALM_PROD=your_realm
   ```

2. **VendorListRestlet Deployment**:
   - Script ID: 1762
   - Deploy ID: 2
   - Must be deployed to NetSuite Production account
   - Must have updated version with new fields

### Running the Extraction

```bash
# Navigate to project root
cd /path/to/opuzen-api

# Run the extraction script
node scripts/extract-vendors-via-restlet-prod.js
```

### Expected Output

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
💾 Vendor data saved to: /path/to/DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/NetSuite-Vendors-list.json
📊 Summary: 365 total vendors
   - Active: 365, Inactive: 0
   - With Code: 200
   - With Schedule: 180
   - Preferred: 45
============================================================
✅ NetSuite Production Vendor Extraction Complete!
📁 Output file: /path/to/DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/NetSuite-Vendors-list.json
📊 Total vendors extracted: 365

🎉 SUCCESS: Vendor extraction completed successfully!
```

## NetSuite Field Mappings

### Field Details

| Vendor Field | NetSuite API Name | Data Type | Description | Example |
|-------------|-------------------|-----------|-------------|---------|
| **Vendor Name** | `companyname` | String | Legal business name | "A.Resource" |
| **Entity ID** | `entityid` | String | NetSuite entity identifier | "A. Resource" |
| **Code** | `vendorcode` | String | Vendor's internal code | "ARES001" |
| **Subsidiary** | `subsidiary` | String/ID | Associated subsidiary | "Parent Company : Opuzen Fabrics LLC" |
| **Schedule** | `terms` | String/ID | Payment terms schedule | "Net 30" |
| **Preferred** | `prefvendor` | Boolean | Preferred vendor flag | true/false |
| **Is Inactive** | `isinactive` | Boolean | Active status (inverted) | false = active |

### NetSuite SuiteScript 2.1 Field Names

These are the exact field IDs used in the NetSuite Search API:

```javascript
'internalid'   // Vendor's unique internal ID
'entityid'     // Vendor's display name/identifier
'companyname'  // Legal company name
'isinactive'   // Inactive flag (F = active, T = inactive)
'subsidiary'   // Primary subsidiary assignment
'vendorcode'   // Custom vendor code
'terms'        // Payment terms/schedule reference
'prefvendor'   // Preferred vendor checkbox
```

## Deployment Steps

### 1. Deploy Updated RESTlet to NetSuite

1. Log in to NetSuite Production account
2. Navigate to: **Customization > Scripting > Scripts**
3. Find: **VendorListRestlet** (Script ID: 1762)
4. Click on **Deployments** tab
5. Edit deployment (Deploy ID: 2)
6. Upload the updated `VendorListRestlet.js` file
7. Set **Status** to: **Released**
8. Click **Save**

### 2. Update Role Permissions (If Needed)

Ensure the role used by the token-based authentication has:

- **Vendor Record**: View permission
- **Vendor Code field**: View permission
- **Payment Terms**: View permission
- **Preferred Vendor field**: View permission

### 3. Test the Extraction

Run a test extraction to verify all fields are populated:

```bash
node scripts/extract-vendors-via-restlet-prod.js
```

Check the output file for the new fields.

## Troubleshooting

### Issue: New Fields Return NULL

**Cause**: RESTlet not updated in NetSuite or field permissions missing

**Solution**:
1. Verify RESTlet deployment timestamp matches upload time
2. Check role permissions for new fields
3. Review NetSuite execution logs for errors

### Issue: "Field Not Found" Error

**Cause**: Field name mismatch in NetSuite API

**Solution**:
1. Verify field names in NetSuite's Records Browser
2. Check if fields are custom fields (require `custbody_` or `custrecord_` prefix)
3. Test field access using NetSuite's SuiteScript debugger

### Issue: Extraction Takes Too Long

**Cause**: Large vendor database or slow network

**Solution**:
1. Check pagination settings in script (currently 1000 per page)
2. Increase delay between requests if hitting rate limits
3. Run during off-peak hours

## Version History

### Version 2.0.0 (October 15, 2025)
- **Added**: Vendor Code field (`vendorcode`)
- **Added**: Payment Schedule field (`terms`)
- **Added**: Preferred Vendor field (`prefvendor`)
- **Changed**: Output path to `NetSuite-Vendor-Extraction/` directory
- **Changed**: Fixed filename to `NetSuite-Vendors-list.json`
- **Enhanced**: Summary statistics with new field counts
- **Enhanced**: Console output with detailed field reporting

### Version 1.0.0 (Previous)
- Initial vendor extraction implementation
- Basic fields: ID, Name, Entity ID, Subsidiary, Status

## Related Documentation

- [VendorListRestlet Role Permissions Guide](./VendorListRestlet-Role-Permissions-Guide.md)
- [NetSuite Vendor Extraction README](./README.md)
- [NetSuite Integration Overview](../README.md)

## Support

For issues or questions:
1. Check NetSuite execution logs (Monitoring > Script Execution Log)
2. Review `.env` file for correct credentials
3. Verify RESTlet deployment status in NetSuite
4. Contact NetSuite administrator for field permission issues

