# Vendor Mapping Analysis - Created Tools Summary

## 📦 What Was Created

### 1. Diagnostic Script
**File**: `scripts/diagnose-vendor-mapping.js`

A comprehensive analysis tool that:
- ✅ Loads OPMS vendors from `Z_VENDOR` table
- ✅ Loads NetSuite vendors from production JSON file (source of truth)
- ✅ Analyzes the `opms_netsuite_vendor_mapping` table
- ✅ Identifies perfect matches, mismatches, and unmapped vendors
- ✅ Calculates similarity scores for suggested matches
- ✅ Generates actionable recommendations
- ✅ Outputs console report and JSON file

**Key Features:**
- No data modifications (read-only analysis)
- Uses fuzzy matching to suggest vendor pairings
- Identifies the "Strict Name Check Pass Rate" that affects exports
- Provides prioritized action items

### 2. Documentation

**Quick Start Guide**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/QUICK-START-DIAGNOSTIC.md`
- Simple 3-step process to run diagnostic
- Visual examples of output
- Common scenarios and solutions
- Quick fixes for typical issues

**Detailed README**: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/DIAGNOSTIC-REPORT-README.md`
- In-depth explanation of all report sections
- Interpretation guide for metrics
- Troubleshooting guide
- Next steps planning

## 🎯 What You Need to Know

### The Core Problem

Your export queries use this pattern:
```sql
JOIN opms_netsuite_vendor_mapping m ON v.id = m.opms_vendor_id
WHERE m.opms_vendor_name = m.netsuite_vendor_name  -- ⚠️ This fails if names differ
```

This means:
- If **OPMS** has "Dekortex Inc." and **NetSuite** has "Dekortex", the vendor is **excluded from exports**
- Only vendors with **exactly matching names** are included
- Even minor differences (spacing, capitalization) cause failures

### What the Diagnostic Will Show You

1. **How many mappings are broken** (Name Mismatches count)
2. **What percentage of exports will fail** (Strict Name Check Pass Rate)
3. **Which specific vendors have issues** (Detailed mismatch list)
4. **Suggested fixes** (Matched vendors with similarity scores)

## 🚀 What to Do Next

### Step 1: Run the Diagnostic

```bash
cd /path/to/opuzen-api

# Ensure NetSuite data is current
node scripts/extract-vendors-via-restlet-prod.js

# Run the diagnostic
node scripts/diagnose-vendor-mapping.js
```

**Expected Duration**: ~10 seconds

### Step 2: Review the Output

Look at the console output for:
```
Strict Name Check Pass Rate:  XX.X% 🎯
```

**Interpretation:**
- **100%**: ✅ Perfect! All mappings work
- **75-99%**: 🟡 Mostly good, few fixes needed
- **50-74%**: 🔴 Many issues, urgent fixes required
- **< 50%**: 🚨 Critical state, majority of exports failing

### Step 3: Examine the JSON Report

Open this file for complete details:
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-mapping-diagnostic-report.json
```

This contains:
- All perfect matches (vendors working correctly)
- All name mismatches (vendors failing exports)
- All unmapped vendors (missing mappings)
- Suggestions with similarity scores

### Step 4: Decide on Approach

Based on diagnostic results, you have 3 options:

#### Option A: Update Vendor Names (Recommended)
**Best for**: < 30 mismatches, names are clearly wrong

**Pros:**
- Clean, consistent data
- Permanent fix
- Maintains data quality

**Cons:**
- Modifies legacy OPMS `Z_VENDOR` table
- Requires careful testing

**Next Script**: `sync-vendor-names.js` (to be created with your approval)

#### Option B: Fix Mapping Table Only
**Best for**: Names in both systems are correct, just mapping is wrong

**Pros:**
- No changes to source data
- Quick fix

**Cons:**
- Doesn't solve underlying name differences

**Action**: Manual SQL updates to mapping table

#### Option C: Remove Strict Name Check
**Best for**: Many mismatches, names intentionally different

**Pros:**
- No data changes needed
- Allows flexibility

**Cons:**
- Less data validation
- Relies solely on ID mapping

**Action**: Modify export queries to remove `WHERE m.opms_vendor_name = m.netsuite_vendor_name`

## 📊 Expected Scenarios

### Scenario 1: Good State
```
Perfect Matches:              95 ✅
Name Mismatches:              5
Strict Name Check Pass Rate:  95% 🎯
```

**Action**: Fix the 5 mismatches manually, you're almost perfect!

### Scenario 2: Moderate Issues
```
Perfect Matches:              60 ✅
Name Mismatches:              40
Strict Name Check Pass Rate:  60% 🎯
```

**Action**: Run automated sync script to fix bulk issues (Option A)

### Scenario 3: Critical State
```
Perfect Matches:              20 ✅
Name Mismatches:              80
Strict Name Check Pass Rate:  20% 🎯
```

**Action**: Comprehensive review needed, consider Option C while fixing data

## 🔧 What Needs Your Approval

Before I create fix scripts, I need your decision on:

### Question 1: Can I modify `Z_VENDOR.name`?
This is the 20+ year old OPMS vendor table.

- ✅ **Yes** → I'll create a script to sync Z_VENDOR.name with NetSuite names
- ❌ **No** → I'll create scripts that only update the mapping table

### Question 2: What's your risk tolerance?
- 🟢 **Conservative** → Manual review of each change before applying
- 🟡 **Moderate** → Automated sync with backup/rollback capability
- 🔴 **Aggressive** → Trust fuzzy matching above threshold (0.8+)

### Question 3: Do you want query changes?
Remove the strict name check from export queries?

- ✅ **Yes** → Rely on ID mappings only
- ❌ **No** → Keep strict validation, fix all data

## 📁 Files Created

```
scripts/
  └── diagnose-vendor-mapping.js         # Main diagnostic script

DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/
  ├── QUICK-START-DIAGNOSTIC.md          # Quick start guide
  ├── DIAGNOSTIC-REPORT-README.md        # Detailed documentation
  ├── VENDOR-MAPPING-ANALYSIS-SUMMARY.md # This file
  └── vendor-mapping-diagnostic-report.json  # Generated by script
```

## 🎯 Success Metrics

After running fixes, re-run diagnostic and look for:

```
✅ Strict Name Check Pass Rate:  100%
✅ Perfect Matches:               All active mappings
✅ Name Mismatches:               0
✅ OPMS Mapping Coverage:         95%+ (or as desired)
```

## 🔍 Data Source Priority

The diagnostic uses this hierarchy:

1. **NetSuite Production JSON** (Source of Truth)
   - `netsuite-vendors-fullData-PROD-template.json`
   - 365 active vendors
   - Extracted: October 15, 2025

2. **Z_VENDOR Table** (OPMS Vendors)
   - Legacy 20+ year old data
   - May have variations/outdated names

3. **opms_netsuite_vendor_mapping** (Current Mappings)
   - May be stale or incorrect
   - Needs validation against sources 1 & 2

## 📞 Next Steps

1. **Run the diagnostic** to see current state
2. **Review this summary** and the output
3. **Answer the approval questions** above
4. **I'll create fix scripts** based on your decisions

## 🚨 Important Notes

- ⚠️ The diagnostic is **read-only** - it makes no changes
- ✅ Safe to run multiple times
- 📊 JSON report is timestamped for comparison
- 🔄 Re-run after any fixes to verify
- 💾 Always backup database before applying fixes

---

**Created**: October 15, 2025  
**Purpose**: Identify and fix OPMS-NetSuite vendor name inconsistencies  
**Impact**: Ensures vendor-related items can be exported to NetSuite  
**Risk Level**: Diagnostic = None, Fixes = To be determined with your approval

