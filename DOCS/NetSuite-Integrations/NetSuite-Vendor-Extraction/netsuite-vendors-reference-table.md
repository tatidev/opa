# NetSuite Vendors Reference Table

## Overview

The `netsuite_vendors_reference` table stores a complete snapshot of all vendor records extracted from NetSuite Production. This serves as a reference table for vendor lookups, mapping, and integration purposes.

## Purpose

- **Vendor Lookup**: Quick reference for NetSuite vendor information without API calls
- **Mapping Support**: Used in conjunction with `opms_netsuite_vendor_mapping` table
- **Data Validation**: Verify vendor IDs and names before NetSuite operations
- **Historical Reference**: Maintain snapshot of vendor data for audit purposes

## Table Structure

### Main Table: `netsuite_vendors_reference`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | NetSuite internal vendor ID |
| `entityid` | VARCHAR(255) | NetSuite entity ID (vendor code) |
| `companyname` | VARCHAR(255) | Legal company name |
| `displayname` | VARCHAR(255) | Display name for vendor |
| `isinactive` | BOOLEAN | Vendor active status (inverted: TRUE = inactive) |
| `subsidiary` | VARCHAR(255) | Associated subsidiary name |
| `subsidiary_id` | INT | Subsidiary internal ID |
| `extracted_at` | TIMESTAMP | When this data was extracted from NetSuite |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Record last update timestamp |

**Total Records**: ~365 active vendors from NetSuite Production

### Indexes

- `UNIQUE KEY unique_entityid (entityid)` - Prevent duplicate entity IDs
- `KEY idx_companyname (companyname)` - Fast company name lookups
- `KEY idx_displayname (displayname)` - Fast display name lookups
- `KEY idx_active (isinactive)` - Filter active/inactive vendors
- `KEY idx_subsidiary_id (subsidiary_id)` - Subsidiary filtering
- `KEY idx_subsidiary (subsidiary)` - Subsidiary name lookups

## Views

### 1. `v_netsuite_vendors_active`
Returns only active vendors with key fields.

```sql
SELECT 
    id,
    entityid,
    companyname,
    displayname,
    subsidiary,
    subsidiary_id,
    extracted_at,
    updated_at
FROM netsuite_vendors_reference
WHERE isinactive = FALSE
ORDER BY displayname ASC;
```

### 2. `v_netsuite_vendor_lookup`
Combines NetSuite vendor data with OPMS mapping information.

```sql
SELECT 
    nsv.id as netsuite_vendor_id,
    nsv.entityid as netsuite_entity_id,
    nsv.companyname as netsuite_company_name,
    nsv.displayname as netsuite_display_name,
    nsv.subsidiary as netsuite_subsidiary,
    nsv.subsidiary_id as netsuite_subsidiary_id,
    nsv.isinactive as netsuite_inactive,
    vm.opms_vendor_id,
    vm.opms_vendor_name,
    vm.opms_vendor_abrev,
    vm.mapping_confidence,
    vm.is_active as mapping_active
FROM netsuite_vendors_reference nsv
LEFT JOIN opms_netsuite_vendor_mapping vm 
    ON nsv.id = vm.netsuite_vendor_id AND vm.is_active = TRUE
WHERE nsv.isinactive = FALSE
ORDER BY nsv.displayname ASC;
```

## Setup Instructions

### Step 1: Run Migration

```bash
cd /path/to/opuzen-api
node src/db/migrate.js
```

This will create the table and views.

### Step 2: Populate Table

```bash
node scripts/populate-netsuite-vendors-reference.js
```

This will:
1. Read vendor data from `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-fullData-PROD-template.json`
2. Clear existing data in the table
3. Insert all 365 vendors in batches
4. Verify the insertion
5. Show sample records

**Expected Output:**
```
🚀 Starting NetSuite vendors reference table population...
📊 Found 365 vendors to import
📅 Extracted at: 2025-10-15T17:44:29.508Z
✅ Inserted 365/365 vendors...
═══════════════════════════════════════════════
✅ NetSuite Vendors Reference Table Populated!
═══════════════════════════════════════════════
📊 Total vendors in database: 365
📊 Active vendors: 365
📊 Inactive vendors: 0
```

## Usage Examples

### Find Vendor by Entity ID
```sql
SELECT * FROM netsuite_vendors_reference 
WHERE entityid = 'A. Resource';
```

### Get All Active Vendors
```sql
SELECT * FROM v_netsuite_vendors_active;
```

### Find Vendors with OPMS Mapping
```sql
SELECT * FROM v_netsuite_vendor_lookup 
WHERE opms_vendor_id IS NOT NULL;
```

### Find Unmapped Vendors
```sql
SELECT * FROM v_netsuite_vendor_lookup 
WHERE opms_vendor_id IS NULL;
```

### Search Vendors by Name
```sql
SELECT * FROM netsuite_vendors_reference 
WHERE displayname LIKE '%fabric%' 
AND isinactive = FALSE;
```

### Get Vendors by Subsidiary
```sql
SELECT * FROM netsuite_vendors_reference 
WHERE subsidiary_id = 2  -- Opuzen subsidiary
AND isinactive = FALSE
ORDER BY displayname;
```

## Data Updates

### Updating from NetSuite

To refresh the vendor data from NetSuite:

1. **Extract vendors** from NetSuite:
   ```bash
   node scripts/extract-vendors-via-restlet-prod.js
   ```

2. **Re-populate table**:
   ```bash
   node scripts/populate-netsuite-vendors-reference.js
   ```

This process should be run:
- When new vendors are added to NetSuite
- Quarterly for data accuracy
- Before major integration projects

## Integration with Other Tables

### Relationship with `opms_netsuite_vendor_mapping`

```sql
-- Find OPMS vendor for a NetSuite vendor
SELECT 
    nv.displayname as netsuite_vendor,
    vm.opms_vendor_name as opms_vendor,
    vm.mapping_confidence
FROM netsuite_vendors_reference nv
LEFT JOIN opms_netsuite_vendor_mapping vm ON nv.id = vm.netsuite_vendor_id
WHERE nv.entityid = 'Maharam';
```

### Relationship with `Z_VENDOR` (OPMS Legacy)

```sql
-- Compare OPMS vendors with NetSuite vendors
SELECT 
    zv.id as opms_id,
    zv.name as opms_name,
    nv.id as netsuite_id,
    nv.displayname as netsuite_name,
    vm.mapping_confidence
FROM Z_VENDOR zv
LEFT JOIN opms_netsuite_vendor_mapping vm ON zv.id = vm.opms_vendor_id
LEFT JOIN netsuite_vendors_reference nv ON vm.netsuite_vendor_id = nv.id
WHERE zv.active = 'Y' AND zv.archived = 'N';
```

## File References

### Migration File
`src/db/migrations/20251015_create_netsuite_vendors_reference.js`

### Population Script
`scripts/populate-netsuite-vendors-reference.js`

### Source Data
`DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-fullData-PROD-template.json`

### CSV Export
`DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-fullData-PROD-template.csv`

## Notes

- **Read-Only Table**: This table should be treated as reference data. Updates should come from NetSuite extractions, not direct modifications.
- **No Foreign Keys**: Intentionally no foreign key to NetSuite - this is a snapshot table
- **Extraction Timestamp**: The `extracted_at` field tracks when the data was pulled from NetSuite
- **Active Status**: `isinactive = FALSE` means the vendor is active in NetSuite

## Maintenance

### Check Table Status
```sql
SELECT 
    COUNT(*) as total_vendors,
    SUM(CASE WHEN isinactive = FALSE THEN 1 ELSE 0 END) as active_vendors,
    SUM(CASE WHEN isinactive = TRUE THEN 1 ELSE 0 END) as inactive_vendors,
    MAX(extracted_at) as last_extraction,
    MAX(updated_at) as last_update
FROM netsuite_vendors_reference;
```

### Verify Data Integrity
```sql
-- Check for duplicates
SELECT entityid, COUNT(*) 
FROM netsuite_vendors_reference 
GROUP BY entityid 
HAVING COUNT(*) > 1;

-- Check for missing data
SELECT COUNT(*) as missing_company_name 
FROM netsuite_vendors_reference 
WHERE companyname IS NULL OR companyname = '';
```

## Related Documentation

- [NetSuite Vendor Extraction Guide](../NetSuite-Integrations/NetSuite-Vendor-Extraction/README.md)
- [OPMS-NetSuite Vendor Mapping](../NetSuite-Integrations/NetSuite-Vendor-Extraction/VENDOR-EXTRACTION-UPDATE-v2.md)
- [Database Migration Guide](./database_migration_plan.md)
- [Complete API Database Setup](./complete-api-database-setup.md)

