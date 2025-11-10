# Vendor Mapping Diagnostic Report

## Overview

The vendor mapping diagnostic script analyzes the current state of OPMS-NetSuite vendor mappings and identifies data quality issues that could affect export operations.

## Purpose

This diagnostic helps you understand:
- ✅ How many vendors are properly mapped
- ⚠️ Which mappings have name inconsistencies
- 📝 Which vendors are unmapped on either side
- 💡 What actions need to be taken to fix issues

## Running the Diagnostic

### Prerequisites
1. Database connection configured in `.env`
2. NetSuite production data file exists at:
   ```
   DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-fullData-PROD-template.json
   ```

### Execute the Script

```bash
cd /path/to/opuzen-api
node scripts/diagnose-vendor-mapping.js
```

### Output

The script generates:
1. **Console Report**: Detailed analysis printed to terminal
2. **JSON Report**: Complete data saved to:
   ```
   DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-mapping-diagnostic-report.json
   ```

## Understanding the Report

### Summary Statistics

```
OPMS Vendors (Z_VENDOR):              120
NetSuite Vendors (Production):        365
Total Mappings:                        85
  ├─ Active:                           80
  └─ Inactive:                         5
Perfect Matches (all names align):    45 ✅
Name Mismatches:                       35 ⚠️
Unmapped OPMS Vendors:                 35
Unmapped NetSuite Vendors:             280
OPMS Mapping Coverage:                 70.8%
NetSuite Mapping Coverage:             23.3%
Strict Name Check Pass Rate:           56.3% 🎯
```

**Key Metrics Explained:**

- **Perfect Matches**: Mappings where all name fields are identical across systems
- **Name Mismatches**: Mappings with inconsistent names (these FAIL export query checks)
- **Unmapped Vendors**: Vendors existing in one system but not mapped to the other
- **Strict Name Check Pass Rate**: Percentage passing `WHERE opms_vendor_name = netsuite_vendor_name`

### Critical Section: Name Mismatches

This section shows mappings that **FAIL** the export query validation:

```sql
WHERE m.opms_vendor_name = m.netsuite_vendor_name  -- This check fails
```

Example mismatch:
```
1. Mapping ID: 42
   OPMS (actual):         "Dekortex Inc."
   OPMS (in mapping):     "Dekortex"
   NetSuite (actual):     "Dekortex"
   NetSuite (in mapping): "Dekortex"
   Similarity Score:      0.85 (0-1)
   Strict Check Passes:   ❌ NO
```

**Impact**: Items from this vendor will be **excluded from exports** until names match.

### Actionable Recommendations

The report provides prioritized suggestions:

#### 🔴 HIGH PRIORITY
- **UPDATE_MAPPING_NAMES**: Fix the mapping table to reflect actual vendor names
- **UPDATE_OPMS_NAMES**: Align Z_VENDOR.name with NetSuite vendor names

#### 🟡 MEDIUM PRIORITY
- **CREATE_MAPPINGS_OPMS**: Map unmapped OPMS vendors
- **MODIFY_QUERY_LOGIC**: Remove strict name check from queries (alternative approach)

#### 🟢 LOW PRIORITY
- **POPULATE_REFERENCE_TABLE**: Populate netsuite_vendors_reference table

## What the Report Tells You

### Scenario 1: High Mismatch Count
```
Name Mismatches: 35 ⚠️
Strict Name Check Pass Rate: 56.3%
```

**Problem**: 44% of your mapped vendors are being excluded from exports due to name inconsistencies.

**Solution**: Run vendor name sync scripts to align names.

### Scenario 2: Low Mapping Coverage
```
OPMS Mapping Coverage: 40%
Unmapped OPMS Vendors: 72
```

**Problem**: 60% of your OPMS vendors cannot be exported to NetSuite.

**Solution**: Review unmapped vendors section and create missing mappings.

### Scenario 3: Perfect State
```
Perfect Matches: 120 ✅
Name Mismatches: 0
Unmapped OPMS Vendors: 0
Strict Name Check Pass Rate: 100% 🎯
```

**Result**: All vendors are properly mapped and exports will work correctly.

## Data Sources

### Source of Truth: NetSuite Production JSON

The diagnostic uses this file as the authoritative source for NetSuite vendor names:
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-fullData-PROD-template.json
```

**Why this is important:**
- This file contains the actual vendor names from NetSuite Production
- Mapping table may have outdated or incorrect names
- Z_VENDOR table may have variations that don't match NetSuite

### Database Tables Analyzed

1. **Z_VENDOR**: OPMS legacy vendor table
2. **opms_netsuite_vendor_mapping**: Mapping table (may be out of date)
3. **netsuite_vendors_reference**: Reference table (optional, may be empty)

## Common Issues Found

### Issue 1: Stale Mapping Table
```
OPMS (in mapping):     "Old Company Name Inc."
NetSuite (actual):     "New Company Name"
```

**Cause**: Mapping table not updated when vendor renamed in NetSuite.

**Fix**: Update mapping table with current names.

### Issue 2: OPMS Name Variations
```
OPMS (actual):         "Maharam Fabric Corporation"
NetSuite (actual):     "Maharam"
```

**Cause**: OPMS uses longer/formal name, NetSuite uses short name.

**Fix**: Either update Z_VENDOR.name or remove strict name check.

### Issue 3: Capitalization/Spacing Differences
```
OPMS (actual):         "A.Resource"
NetSuite (actual):     "A. Resource"
```

**Cause**: Minor formatting differences.

**Fix**: Standardize names or use case-insensitive matching.

## Next Steps After Running Diagnostic

### Step 1: Review the Report
- Read through console output
- Examine JSON report for details
- Identify highest priority issues

### Step 2: Decide on Approach

**Option A: Fix the Names**
- Update Z_VENDOR.name to match NetSuite
- Update mapping table
- Pros: Clean, consistent data
- Cons: Modifies legacy OPMS table

**Option B: Fix the Query**
- Remove strict name check from export queries
- Rely on ID mappings only
- Pros: No legacy data changes
- Cons: Allows potential inconsistencies

**Option C: Hybrid**
- Fix obvious mismatches
- Use flexible matching for edge cases

### Step 3: Use Follow-up Scripts

Based on diagnostic results, run appropriate fix scripts:

```bash
# If you choose Option A
node scripts/sync-vendor-names.js

# If you need to create mappings
node scripts/create-vendor-mappings.js

# Verify after fixes
node scripts/diagnose-vendor-mapping.js
```

## Troubleshooting

### Error: Cannot find NetSuite JSON file

**Solution**: Run vendor extraction first:
```bash
node scripts/extract-vendors-via-restlet-prod.js
```

### Error: Cannot connect to database

**Solution**: Check `.env` file for correct database credentials.

### Error: Table 'opms_netsuite_vendor_mapping' doesn't exist

**Solution**: Run migrations:
```bash
node src/db/migrate.js
```

## Interpreting Similarity Scores

The diagnostic uses Levenshtein distance to suggest matches:

- **1.00**: Perfect match
- **0.90-0.99**: Very close (typo, spacing)
- **0.70-0.89**: Similar (abbreviation, variation)
- **0.60-0.69**: Possibly related
- **< 0.60**: Not shown (too dissimilar)

## Report Files

### Console Output
- Real-time analysis results
- Easy to read summary
- Quick overview of issues

### JSON Report (`vendor-mapping-diagnostic-report.json`)
- Complete detailed data
- Machine-readable format
- Includes all vendor details
- Use for programmatic processing

**JSON Structure:**
```json
{
  "generated_at": "2025-10-15T...",
  "summary": { ... },
  "perfect_matches": [ ... ],
  "name_mismatches": [ ... ],
  "unmapped_opms": [ ... ],
  "unmapped_netsuite": [ ... ],
  "suggestions": [ ... ]
}
```

## Frequency

**Recommended Schedule:**

- **Before major exports**: Always run diagnostic
- **After NetSuite changes**: When vendors added/renamed
- **Monthly**: Regular health check
- **After mapping changes**: Verify updates worked

## Related Documentation

- [Vendor Extraction Guide](./README.md)
- [Vendor Name Sync Script](../../scripts/sync-vendor-names.js) (to be created)
- [Database Schema](../../DOCS/ai-specs/app-technical-specifications/opms-database-spec.md)

## Support

For questions or issues with the diagnostic:
1. Check this README
2. Review the JSON report for details
3. Examine database tables directly
4. Contact development team

---

**Last Updated**: October 15, 2025  
**Script Location**: `scripts/diagnose-vendor-mapping.js`  
**Output Location**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-mapping-diagnostic-report.json`

