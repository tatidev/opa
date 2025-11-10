# Vendor Matching Restart Process - Fabric Suppliers Only

**Date**: October 15, 2025  
**Reason**: NetSuite vendor list updated by admin  
**Change**: Filter to only "Fabric Supplier" category vendors

---

## 🎯 What Changed

The vendor matching process is being restarted because:
1. **NetSuite vendor list was updated** by an administrator
2. **New requirement**: Only include vendors with category = **"Fabric Supplier"**
3. **Previous results**: Included all 365+ active vendors (all categories)

---

## 📋 Quick Start

### **Step 1: Deploy Updated RESTlet to NetSuite**

1. **File**: `netsuite-scripts/VendorListRestlet.js`
2. **Upload to NetSuite**: 
   - Go to: `Customization > Scripting > Scripts`
   - Update existing "VendorListRestlet" script
   - Status: **Released**
3. **Verify deployment**: RESTlet should now filter by "Fabric Supplier" category

📖 **Full deployment guide**: [`FABRIC-SUPPLIER-FILTER-DEPLOYMENT.md`](FABRIC-SUPPLIER-FILTER-DEPLOYMENT.md)

### **Step 2: Run Automated Restart Script**

Once the RESTlet is deployed, run the automated script:

```bash
./scripts/restart-vendor-matching-fabric-suppliers.sh
```

This script will automatically:
1. ✅ Backup old vendor matching results
2. ✅ Extract fresh vendor list from NetSuite (Fabric Suppliers only)
3. ✅ Populate `netsuite_vendors_reference` table
4. ✅ Run diagnostic analysis
5. ✅ Run smart matching algorithm (Phases 1-3)
6. ✅ Display summary statistics

**Time**: ~2-5 minutes depending on vendor count

---

## 🔧 Manual Process (Alternative)

If you prefer to run steps manually:

```bash
# 1. Test NetSuite connection
node scripts/test-netsuite-production-connection.js

# 2. Extract fresh vendor list (Fabric Suppliers only)
node scripts/extract-vendors-via-restlet-prod.js

# 3. Populate reference table
node scripts/populate-netsuite-vendors-reference.js

# 4. Run diagnostics
node scripts/diagnose-vendor-mapping.js

# 5. Run smart matching
node scripts/smart-vendor-matching-phase3.js

# 6. View summary
node scripts/diagnose-vendor-mapping.js | grep -A 30 "SUMMARY STATISTICS"
```

---

## 📊 Expected Changes

### **Before (All Vendors)**
- Total NetSuite vendors: 365+
- All categories included
- OPMS coverage: 62.9% (154 mapped)

### **After (Fabric Suppliers Only)**
- Total NetSuite vendors: ~150-250 (estimate)
- Only "Fabric Supplier" category
- OPMS coverage: TBD (likely higher %)
- More relevant matches expected

---

## ⚠️ Important: Verify Category Name

The RESTlet filter uses **exact match**: `"Fabric Supplier"`

**Before running the restart**, verify the exact category name in NetSuite:

1. Open any fabric vendor in NetSuite
2. Check the **Category** field
3. Note the **exact text** (case-sensitive)

If NetSuite uses a different name (e.g., "Fabric Suppliers" plural), update the filter:

**File**: `netsuite-scripts/VendorListRestlet.js`  
**Line 60**: `['category.name', 'is', 'YOUR_EXACT_CATEGORY_NAME']`

Then re-upload the RESTlet to NetSuite.

---

## 📁 What Gets Backed Up

The restart script automatically backs up:
- `vendor-matching/` → `vendor-matching-BACKUP-all-vendors-TIMESTAMP/`

This includes:
- All CSV files (tier1, tier2, tier3, tier4)
- All reports (JSON and Markdown)
- All summaries and documentation

**You can safely restore from backup if needed.**

---

## 🔍 Verification Steps

After running the restart process, verify:

### **1. Check Vendor Count**
```bash
# Should be fewer vendors than before (only Fabric Suppliers)
cat DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-fullData-PROD-template.json | grep '"id"' | wc -l
```

### **2. Verify Category Field**
```bash
# All vendors should have category = "Fabric Supplier"
cat DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/netsuite-vendors-fullData-PROD-template.json | grep '"category"'
```

### **3. Check Mapping Results**
```bash
node scripts/diagnose-vendor-mapping.js 2>&1 | grep -A 30 "SUMMARY STATISTICS"
```

### **4. Review Tier 2 Approvals**
```bash
cat vendor-matching/csv/tier2-vendor-approvals.csv
```

---

## 📊 Results Location

All new results will be in:
```
DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-matching/
├── README.md
├── reports/
│   ├── phase3-smart-matching-results.json
│   ├── vendor-mapping-diagnostic-report.json
│   └── tier4-no-match-vendors.md
├── csv/
│   ├── tier1-auto-mapped.csv
│   ├── tier2-vendor-approvals.csv
│   ├── tier3-manual-review.csv
│   └── tier4-no-match-vendors.csv
└── summaries/
    ├── PHASE-3-COMPLETE-SUMMARY.md
    └── QUICK-REFERENCE.md
```

---

## 🐛 Troubleshooting

### **No vendors returned**
- Check category name is **exactly** "Fabric Supplier" in NetSuite
- Verify RESTlet deployed successfully
- Check NetSuite execution logs

### **Wrong vendors returned**
- Verify the filter in VendorListRestlet.js line 60
- Check if vendors have multiple categories
- Review NetSuite saved search results

### **Script fails at extraction**
- Verify OAuth credentials are valid
- Check RESTlet deployment status
- Test connection: `node scripts/test-netsuite-production-connection.js`

### **Database errors**
- Check database connection
- Verify `netsuite_vendors_reference` table exists
- Check `opms_netsuite_vendor_mapping` table permissions

---

## 📞 Support

For issues:
1. Check NetSuite execution logs: `Customization > Scripting > Script Execution Log`
2. Review deployment guide: `FABRIC-SUPPLIER-FILTER-DEPLOYMENT.md`
3. Test RESTlet manually using Postman or curl
4. Check `.env` file for correct OAuth credentials

---

## 🎯 Success Criteria

After restart, you should see:
- ✅ Fewer vendors than before (only Fabric Suppliers)
- ✅ All vendors have `category: "Fabric Supplier"`
- ✅ Mapping pass rate ≥ 90%
- ✅ Tier 2 vendors ready for approval
- ✅ Tier 4 list showing unmapped vendors

---

## 📚 Related Documentation

- [`FABRIC-SUPPLIER-FILTER-DEPLOYMENT.md`](FABRIC-SUPPLIER-FILTER-DEPLOYMENT.md) - RESTlet deployment guide
- [`VENDOR-MATCHING-INDEX.md`](VENDOR-MATCHING-INDEX.md) - Results overview (after restart)
- [`vendor-matching/README.md`](vendor-matching/README.md) - Complete results guide (after restart)

---

**Script**: `scripts/restart-vendor-matching-fabric-suppliers.sh`  
**Status**: Ready to run (after RESTlet deployment)  
**Next Step**: Deploy updated RESTlet to NetSuite

