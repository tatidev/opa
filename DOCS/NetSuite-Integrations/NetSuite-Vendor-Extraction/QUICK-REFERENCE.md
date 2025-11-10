# Vendor Mapping Quick Reference

## 🚀 What We Accomplished

Starting from **0% pass rate** with broken mappings, we now have:

✅ **154 vendors mapped** (62.9% coverage)  
✅ **96.8% name check pass rate**  
✅ **Smart matching algorithm** implemented  
✅ **Conflict detection** working  

---

## 📋 What's In Each CSV Column

### **tier2-vendor-approvals.csv**

| Column | Description | Your Action |
|--------|-------------|-------------|
| `OPMS_ID` | Internal OPMS vendor ID | Read only |
| `OPMS_Vendor_Name` | Name in legacy OPMS system | Read only |
| `OPMS_Abbrev` | Abbreviation in OPMS | Read only |
| `Suggested_NS_ID` | Recommended NetSuite vendor ID | Can edit if needed |
| `Suggested_NS_Name` | Recommended NetSuite vendor name | Reference |
| `Suggested_NS_Entity_ID` | NetSuite entity ID | Reference |
| `Similarity` | Match confidence (75-89%) | Reference |
| `Alternative_1_Name` | Second-best match | Reference |
| `Alternative_1_ID` | Second-best match ID | Can use instead |
| `Alternative_1_Similarity` | Second-best confidence | Reference |
| `Alternative_2_Name` | Third-best match | Reference |
| `Alternative_2_ID` | Third-best match ID | Can use instead |
| `Alternative_2_Similarity` | Third-best confidence | Reference |
| `Conflict` | YES if NS vendor already mapped | Review carefully |
| `Conflict_With` | Which OPMS vendor has conflict | Review carefully |
| **`ACTION`** | **YOUR DECISION** | **Fill this in!** |

---

## ✏️ How to Fill In the ACTION Column

### **Option 1: Approve the suggestion**
```
approve
```

### **Option 2: Reject (skip for now)**
```
reject
```

### **Option 3: Use an alternative**
Edit the `Suggested_NS_ID` column to use `Alternative_1_ID` or `Alternative_2_ID`, then:
```
approve
```

### **Option 4: Manual selection**
Edit the `Suggested_NS_ID` to any NetSuite vendor ID you want, then:
```
approve
```

---

## ⚠️ Handling Conflicts

If `Conflict` = **YES**, this means the NetSuite vendor is already mapped to another OPMS vendor.

### **Common Reasons for Conflicts**
1. **Legacy duplicate vendors** in OPMS (same company, different names)
2. **Subsidiaries or divisions** of the same parent company
3. **Incorrect mapping** in the existing data

### **What to Do**
1. Check if the OPMS vendors are actually the same company
2. If YES: Both can map to the same NetSuite vendor
3. If NO: Find the correct NetSuite vendor for this OPMS vendor
4. Consider archiving duplicate OPMS vendors

---

## 🔍 Example Review Process

### **Row: Ambienta → Ambience Textiles (75.0%, Conflict with ID 142)**

1. **Check**: Is "Ambienta" the same as "Ambience Textiles"?
   - Looks like a typo/abbreviation: **YES**

2. **Check**: Who is OPMS ID 142?
   - Run: `SELECT * FROM Z_VENDOR WHERE id = 142`
   - Result: "Ambience Textiles"

3. **Decision**: These are the same vendor with different names in legacy OPMS
   - **Action**: `approve`
   - **Note**: Both OPMS vendors will map to same NetSuite vendor

---

### **Row: GTex → G-Tex (80.0%, No conflict)**

1. **Check**: Is "GTex" the same as "G-Tex"?
   - Just missing a hyphen: **YES**

2. **No conflicts**: Safe to approve
   - **Action**: `approve`

---

## 📊 Data Stored Per Mapping

When you approve a mapping, the system stores:

```sql
opms_vendor_id          -- OPMS internal ID
opms_vendor_name        -- Legacy OPMS name (e.g., "Ambienta")
opms_vendor_abrev       -- OPMS abbreviation (e.g., "AB")
netsuite_vendor_id      -- NetSuite internal ID
netsuite_vendor_name    -- NetSuite name (e.g., "Ambience Textiles")
netsuite_vendor_entity_id -- NetSuite entity ID
mapping_confidence      -- high/medium/low
mapping_method          -- auto/manual/imported
notes                   -- Similarity score, conflicts, etc.
created_at              -- Timestamp
updated_at              -- Timestamp
```

---

## 🎯 Quick Commands

### **Run Diagnostic**
```bash
node scripts/diagnose-vendor-mapping.js
```

### **View Current Status**
```bash
node scripts/diagnose-vendor-mapping.js 2>&1 | grep -A 30 "SUMMARY STATISTICS"
```

### **Re-run Phase 3** (if needed)
```bash
node scripts/smart-vendor-matching-phase3.js
```

### **Check a Specific OPMS Vendor**
```sql
SELECT * FROM Z_VENDOR WHERE name LIKE '%Ambienta%';
```

### **Check a Specific Mapping**
```sql
SELECT * FROM opms_netsuite_vendor_mapping WHERE opms_vendor_name LIKE '%Ambienta%';
```

### **Find All Conflicts**
```sql
SELECT netsuite_vendor_id, netsuite_vendor_name, COUNT(*) as map_count
FROM opms_netsuite_vendor_mapping
GROUP BY netsuite_vendor_id, netsuite_vendor_name
HAVING COUNT(*) > 1;
```

---

## 🚨 Important Notes

### **NetSuite is the Source of Truth**
- Always use the NetSuite vendor name as the canonical name
- OPMS names are legacy and may have typos/variations

### **Conflicts Are OK**
- Multiple OPMS vendors can map to the same NetSuite vendor
- This is common with legacy data migrations
- The system flags conflicts for your review, not as errors

### **You Can Always Update Later**
- Mappings can be edited in the `opms_netsuite_vendor_mapping` table
- Set `is_active = 0` to deactivate a mapping without deleting it
- All changes are timestamped and auditable

---

## 📁 File Locations

All files are in: `DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/`

- ✏️ **tier2-vendor-approvals.csv** - Edit this file
- 📊 **phase3-smart-matching-results.json** - Full results
- 📖 **PHASE-3-COMPLETE-SUMMARY.md** - Detailed summary
- 🚀 **QUICK-REFERENCE.md** - This file

---

## 🆘 Need Help?

### **Question: How do I know if two vendors are the same?**
1. Check the OPMS vendor details: `SELECT * FROM Z_VENDOR WHERE id = X`
2. Check existing orders/items using this vendor
3. Search online for the company name
4. When in doubt, leave it for manual review

### **Question: What if I make a mistake?**
No problem! You can:
1. Delete the incorrect mapping: `DELETE FROM opms_netsuite_vendor_mapping WHERE id = X`
2. Update the mapping: `UPDATE opms_netsuite_vendor_mapping SET netsuite_vendor_id = Y WHERE id = X`
3. Re-run diagnostics to verify

### **Question: What about Tier 3 and Tier 4 vendors?**
- **Tier 3** (60-74% similarity): Review manually when you have time
- **Tier 4** (<60% similarity): Likely don't exist in NetSuite yet

---

**Last Updated**: October 15, 2025  
**Status**: Ready for Tier 2 Approvals

