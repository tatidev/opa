# NetSuite Vendor Extraction - Fabric Supplier Filter Deployment

**Date**: October 15, 2025  
**Purpose**: Update RESTlet to filter vendors by "Fabric Supplier" category only

---

## 🎯 What Changed

The `VendorListRestlet.js` has been updated to:
1. **Filter vendors by category**: Only returns vendors with category = "Fabric Supplier"
2. **Include category data**: Returns `category` and `categoryId` for each vendor
3. **Updated logging**: All messages reflect the Fabric Supplier filter

---

## 📝 Changes Summary

### **Filters Added**
```javascript
filters: [
    ['isinactive', 'is', 'F'], // Only active vendors
    'AND',
    ['category.name', 'is', 'Fabric Supplier'] // Only Fabric Supplier category
]
```

### **New Fields Returned**
Each vendor object now includes:
- `category`: Text name of the category (e.g., "Fabric Supplier")
- `categoryId`: Internal ID of the category

---

## 🚀 Deployment Steps

### **Step 1: Upload Updated RESTlet to NetSuite**

1. **Navigate to NetSuite**:
   - Go to: `Customization > Scripting > Scripts > New`
   - Or edit existing: Search for "VendorListRestlet"

2. **Upload the script**:
   - File: `netsuite-scripts/VendorListRestlet.js`
   - Name: `VendorListRestlet` (or keep existing name)
   - Script Type: RESTlet
   - API Version: 2.1

3. **Script Properties**:
   - GET Function: `get`
   - POST Function: `post`

4. **Deploy the script**:
   - Create a new deployment or update existing
   - Status: **Released**
   - Log Level: **Debug** (for initial testing, then change to **Audit**)
   - Audience: **All Roles** (or specific role with proper permissions)

5. **Note the URLs**:
   - External URL (for OAuth)
   - Internal URL (for testing)

### **Step 2: Update Environment Variables (if needed)**

If the deployment ID changed, update `.env`:
```bash
NETSUITE_RESTLET_SCRIPT_ID=customscript_vendor_list_restlet
NETSUITE_RESTLET_DEPLOYMENT_ID=customdeploy_vendor_list_restlet
```

### **Step 3: Test the RESTlet**

Test using the Node.js script:
```bash
node scripts/test-netsuite-production-connection.js
```

Expected output should show:
- ✅ Only vendors with category = "Fabric Supplier"
- ✅ Each vendor includes `category` and `categoryId` fields
- ✅ Count should be lower than the previous extraction (only Fabric Suppliers)

---

## 🔍 What to Expect

### **Before (All Active Vendors)**
- Extracted: 365+ vendors
- Included: All vendor categories

### **After (Fabric Suppliers Only)**
- Expected: 150-250 vendors (estimate)
- Included: Only "Fabric Supplier" category

### **New Vendor Object Structure**
```json
{
  "id": "123",
  "entityid": "ABC Textiles",
  "companyname": "ABC Textiles Inc.",
  "displayName": "ABC Textiles Inc.",
  "isinactive": false,
  "subsidiary": "Parent Company",
  "subsidiaryId": "1",
  "category": "Fabric Supplier",
  "categoryId": "5"
}
```

---

## 🧪 Testing Checklist

After deployment, verify:

- [ ] RESTlet responds successfully
- [ ] Returns only Fabric Supplier vendors
- [ ] All vendors have `category: "Fabric Supplier"`
- [ ] `categoryId` field is populated
- [ ] Vendor count is reasonable (expect fewer than before)
- [ ] No errors in NetSuite execution logs

---

## 🔄 Re-Run Full Extraction

Once deployed and tested, re-run the full vendor extraction:

```bash
# 1. Extract fresh vendor list from NetSuite (Fabric Suppliers only)
node scripts/extract-vendors-via-restlet-prod.js

# 2. Populate reference table
node scripts/populate-netsuite-vendors-reference.js

# 3. Run diagnostics
node scripts/diagnose-vendor-mapping.js

# 4. Clean out old vendor matching results
rm -rf DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-matching-OLD

# 5. Backup old results
mv DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-matching \
   DOCS/NetSuite-Integrations/NetSuite-Vendor-Extraction/vendor-matching-OLD-all-vendors

# 6. Re-run Phase 3 smart matching with new filtered list
node scripts/smart-vendor-matching-phase3.js
```

---

## 📋 Verification Queries

### **Check NetSuite Category**
In NetSuite, run a saved search to verify the category name:
```
Record Type: Vendor
Criteria: Status is Active
Results: Internal ID, Name, Category
```

### **Verify in OPMS**
Check which OPMS vendors should match:
```sql
SELECT 
    v.id,
    v.name,
    COUNT(DISTINCT i.id) as item_count
FROM Z_VENDOR v
LEFT JOIN T_PRODUCT_VENDOR pv ON v.id = pv.vendor_id
LEFT JOIN T_PRODUCT p ON pv.product_id = p.id
LEFT JOIN T_ITEM i ON p.id = i.product_id
WHERE v.active = 'Y' AND v.archived = 'N'
GROUP BY v.id, v.name
HAVING item_count > 0
ORDER BY item_count DESC;
```

---

## ⚠️ Important Notes

### **Category Name Exact Match**
The filter uses: `['category.name', 'is', 'Fabric Supplier']`

**Critical**: The category name must be **exactly** "Fabric Supplier" in NetSuite.
- If it's "Fabric Suppliers" (plural), update the filter
- If it's a different name, update the filter
- Check NetSuite for the exact category name

### **Alternative: Use Category ID**
If the category name varies, you can filter by ID instead:
```javascript
['category', 'anyof', '5'] // Replace '5' with actual category ID
```

---

## 🐛 Troubleshooting

### **No Vendors Returned**
1. Check the category name in NetSuite (might be "Fabric Suppliers" plural)
2. Verify category exists and is assigned to vendors
3. Check NetSuite execution logs for errors

### **Wrong Vendors Returned**
1. Verify the filter syntax is correct
2. Check if vendors have multiple categories
3. Review NetSuite search results directly

### **Script Deployment Error**
1. Verify script syntax (no JavaScript errors)
2. Check role permissions for category field
3. Review NetSuite deployment status

---

## 📞 Support

If you encounter issues:
1. Check NetSuite execution logs: `Customization > Scripting > Script Execution Log`
2. Test with a simple NetSuite saved search first
3. Verify category field access permissions
4. Review this document for exact filter syntax

---

**File**: `netsuite-scripts/VendorListRestlet.js`  
**Status**: Ready for deployment  
**Next Step**: Upload to NetSuite and test

