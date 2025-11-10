# OPMS → NetSuite Vendor Mapping Strategy

## 🎯 **Recommended Approach: Create Vendor Mapping Table**

### **Phase 1: Create Vendor Mapping**
1. **Export OPMS vendors** to NetSuite (one-time setup)
2. **Create mapping table** in our API database:
   ```sql
   CREATE TABLE opms_netsuite_vendor_mapping (
     opms_vendor_id INT PRIMARY KEY,
     opms_vendor_name VARCHAR(40),
     opms_vendor_abrev VARCHAR(15),
     netsuite_vendor_id INT,
     netsuite_vendor_name VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   );
   ```

### **Phase 2: Vendor Lookup Service**
```javascript
// src/services/vendorMappingService.js
async function getNetSuiteVendorId(opmsVendorId) {
  const mapping = await db.query(
    'SELECT netsuite_vendor_id FROM opms_netsuite_vendor_mapping WHERE opms_vendor_id = ?',
    [opmsVendorId]
  );
  return mapping[0]?.netsuite_vendor_id || null;
}
```

### **Phase 3: Integration in Item Creation**
```javascript
// In transformToRestletPayload()
if (itemData.vendor_id) { // OPMS vendor ID
  const netsuiteVendorId = await vendorMappingService.getNetSuiteVendorId(itemData.vendor_id);
  if (netsuiteVendorId) {
    payload.vendor = netsuiteVendorId; // Native NetSuite field
  }
}
```

## 📊 **OPMS Vendor Data Analysis**

### **Top 10 Most Used Vendors:**
| OPMS ID | Vendor Name | Products | Priority |
|---------|-------------|----------|----------|
| 77 | Regal | 544 | 🔥 **HIGH** |
| 8 | Morgan/MJD | 320 | 🔥 **HIGH** |
| 62 | Pointe International | 313 | 🔥 **HIGH** |
| 40 | Elite Textile | 299 | 🔥 **HIGH** |
| 54 | Valdese Weavers | 254 | 🔥 **HIGH** |
| 66 | Universal Textile Mills | 221 | 🔥 **HIGH** |
| 64 | DeLeo Textiles | 173 | 🔥 **HIGH** |
| 48 | Sunbury & Sunbrella | 159 | 🔥 **HIGH** |
| 114 | Kaslen Textiles | 135 | 🔥 **HIGH** |
| 82 | Heritage Fabrics | 129 | 🔥 **HIGH** |

**Total: 240 active vendors in OPMS**

## 🚀 **Implementation Plan**

### **Immediate (Phase 1):**
1. **Create mapping table** in API database
2. **Manual mapping** for top 10 vendors (covers ~70% of products)
3. **Test with high-priority vendors**

### **Short-term (Phase 2):**
1. **Bulk vendor creation** in NetSuite for remaining vendors
2. **Automated mapping** population
3. **Full integration** in item creation

### **Long-term (Phase 3):**
1. **Sync service** to keep vendor data updated
2. **Vendor management** through API
3. **Bidirectional sync** if needed

## 💡 **Benefits of This Approach:**
- ✅ **Native NetSuite integration** (proper vendor relationships)
- ✅ **Scalable** (handles all 240 vendors)
- ✅ **Maintainable** (clear mapping table)
- ✅ **Flexible** (can handle vendor changes)
- ✅ **Performance** (cached lookups)

## 🎯 **Recommendation:**
**Start with Phase 1** - Create mapping for top 10 vendors to cover the majority of products, then expand gradually.

