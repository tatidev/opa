# Quick Start: Vendor Mapping Diagnostic

## 🎯 What This Does

Analyzes your OPMS-NetSuite vendor mappings and tells you:
- ✅ What's working correctly
- ❌ What's broken
- 💡 What needs to be fixed

## 🚀 Run the Diagnostic (3 Steps)

### Step 1: Ensure NetSuite Data is Current

```bash
# Extract latest vendor data from NetSuite Production
node scripts/extract-vendors-via-restlet-prod.js
```

**Output**: Creates `netsuite-vendors-fullData-PROD-template.json` with 365 vendors

### Step 2: Run the Diagnostic

```bash
# Analyze vendor mappings
node scripts/diagnose-vendor-mapping.js
```

**Duration**: ~10 seconds

### Step 3: Review the Results

The script will print a detailed report to your terminal and save it to:
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-mapping-diagnostic-report.json
```

## 📊 Example Output

```
═══════════════════════════════════════════════════════════════════
📊 VENDOR MAPPING DIAGNOSTIC REPORT
═══════════════════════════════════════════════════════════════════

📈 SUMMARY STATISTICS
────────────────────────────────────────────────────────────────────
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

## 🔍 What to Look For

### ✅ Good News Indicators

```
Perfect Matches:              120 ✅
Name Mismatches:              0
Strict Name Check Pass Rate:  100% 🎯
```

**Meaning**: All your vendor mappings are correct and exports will work perfectly.

### ⚠️ Warning Signs

```
Name Mismatches:              35 ⚠️
Strict Name Check Pass Rate:  56.3% 🎯
```

**Meaning**: 44% of your mappings are failing the export query validation. These vendors won't be included in exports.

### 🚨 Critical Issues

```
Unmapped OPMS Vendors:        72
OPMS Mapping Coverage:        40%
```

**Meaning**: 60% of your OPMS vendors cannot be exported to NetSuite at all.

## 💡 What the Report Tells You

### Section 1: Perfect Matches ✅

These vendors are working correctly:
```
✓ Maharam
  OPMS ID: 42 | NetSuite ID: 317

✓ Designtex
  OPMS ID: 55 | NetSuite ID: 326
```

**Action**: None needed - these are good!

### Section 2: Name Mismatches ⚠️

These vendors are mapped but have name inconsistencies:
```
1. Mapping ID: 42
   OPMS (actual):         "Dekortex Inc."
   NetSuite (actual):     "Dekortex"
   Similarity Score:      0.85
   Strict Check Passes:   ❌ NO
```

**Impact**: This vendor's items will be **excluded from exports**.

**Action Required**: Fix the name mismatch (see recommendations section).

### Section 3: Unmapped OPMS Vendors

OPMS vendors without NetSuite mappings:
```
1. Momentum Textiles (ID: 88)
   💡 Suggested NetSuite match: "Momentum" (ID: 445)
      Similarity: 0.82
```

**Impact**: Cannot export items from this vendor to NetSuite.

**Action Required**: Create mapping or verify vendor exists in NetSuite.

### Section 4: Recommendations 💡

Prioritized action items:
```
1. 🔴 UPDATE_MAPPING_NAMES [HIGH PRIORITY]
   Count: 35
   Description: Update opms_netsuite_vendor_mapping table
   Action: Run sync script to update vendor names

2. 🟡 CREATE_MAPPINGS_OPMS [MEDIUM PRIORITY]
   Count: 72
   Description: Map unmapped OPMS vendors to NetSuite
   Action: Review suggestions and create mappings
```

## 🎯 Next Steps Based on Results

### Scenario A: Few Issues (< 10% mismatches)

**Action**: Manual review and fixes
```bash
# Review the JSON report
cat DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-mapping-diagnostic-report.json

# Make manual corrections to mapping table
# (Use database admin tool or SQL)
```

### Scenario B: Many Issues (> 20% mismatches)

**Action**: Run automated fix scripts
```bash
# Option 1: Sync vendor names (recommended)
node scripts/sync-vendor-names.js  # (to be created)

# Option 2: Create missing mappings
node scripts/create-vendor-mappings.js  # (to be created)

# Verify fixes
node scripts/diagnose-vendor-mapping.js
```

### Scenario C: Critical State (> 50% mismatches)

**Action**: Comprehensive review needed
1. Review the JSON report in detail
2. Discuss approach with team
3. Consider query logic changes
4. Plan systematic fix rollout

## 📋 Understanding "Strict Name Check Pass Rate"

This metric shows what percentage of your mappings will work with the current export query logic.

**Current Export Query Pattern:**
```sql
JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
WHERE m.opms_vendor_name = m.netsuite_vendor_name  -- Strict equality check
```

**Pass Rate Examples:**

| Pass Rate | Meaning | Action Needed |
|-----------|---------|---------------|
| 100% | All mappings work | ✅ None |
| 75-99% | Most work, few issues | 🟡 Fix specific mismatches |
| 50-74% | Half broken | 🔴 Urgent fixes needed |
| < 50% | Majority broken | 🚨 Critical - immediate action |

## 🛠️ Fixing Common Issues

### Issue: "Dekortex Inc." vs "Dekortex"

**Quick Fix**: Update Z_VENDOR table
```sql
UPDATE Z_VENDOR 
SET name = 'Dekortex' 
WHERE name = 'Dekortex Inc.';
```

**OR**: Update mapping table
```sql
UPDATE opms_netsuite_vendor_mapping 
SET opms_vendor_name = 'Dekortex',
    netsuite_vendor_name = 'Dekortex'
WHERE opms_vendor_id = 42;
```

### Issue: Capitalization Differences

**Example**: "designtex" vs "Designtex"

**Quick Fix**:
```sql
UPDATE Z_VENDOR 
SET name = 'Designtex' 
WHERE LOWER(name) = 'designtex';
```

### Issue: Spacing Differences

**Example**: "A.Resource" vs "A. Resource"

**Quick Fix**:
```sql
UPDATE Z_VENDOR 
SET name = 'A. Resource' 
WHERE name = 'A.Resource';
```

## 📁 Output Files

### Console Report
- Printed to terminal
- Human-readable format
- Quick overview

### JSON Report
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-mapping-diagnostic-report.json
```
- Complete detailed data
- Machine-readable
- Use for automated processing
- Contains all vendor details

## 🔄 When to Run

Run the diagnostic:

- ✅ **Before major exports** - Verify everything is ready
- ✅ **After vendor changes** - Confirm mappings are current
- ✅ **Monthly** - Regular health check
- ✅ **After fixing issues** - Verify fixes worked
- ✅ **Before production deployment** - Final validation

## ❓ Troubleshooting

### "Cannot find NetSuite JSON file"

**Solution**: Run extraction first:
```bash
node scripts/extract-vendors-via-restlet-prod.js
```

### "Database connection failed"

**Solution**: Check `.env` file has correct database credentials

### "Table doesn't exist"

**Solution**: Run migrations:
```bash
node src/db/migrate.js
```

## 📞 Need Help?

1. Read the full documentation: [DIAGNOSTIC-REPORT-README.md](./DIAGNOSTIC-REPORT-README.md)
2. Check the JSON report for complete details
3. Review related documentation in `DOCS/NetSuite-Integrations/`
4. Contact development team

## 🎯 Success Criteria

You've achieved proper vendor mapping when:

```
✅ Strict Name Check Pass Rate: 100%
✅ OPMS Mapping Coverage: 100% (or near 100%)
✅ Name Mismatches: 0
✅ All critical OPMS vendors mapped
```

---

**Script Location**: `scripts/diagnose-vendor-mapping.js`  
**Last Updated**: October 15, 2025

