# NetSuite Native Vendor Fields Analysis

## 🔍 **Discovery: Native Fields Require Internal IDs**

### **Test Results:**
- ✅ **Native `vendor` field works** - but requires **numeric vendor internal IDs**, not vendor names
- ❌ **Text vendor names fail** - NetSuite error: "You entered 'Test Vendor' into a field where a numeric value was expected"
- ✅ **Numeric vendor ID (e.g., '1') works** - successfully creates items

### **Current Field Mappings Status:**

| OPMS Field | NetSuite Field | Data Type Required | Status |
|------------|----------------|-------------------|---------|
| Vendor Business Name | `vendor` | **Vendor Internal ID (numeric)** | ⚠️ **Needs ID Lookup** |
| Vendor Product Name | `vendorname` | **Text** | ✅ **Should Work** |
| Vendor Item Code | `vendorcode` | **Text** | ✅ **Should Work** |
| Vendor Item Color | `custitem_opms_vendor_color` | **Text** | ✅ **Works (Custom Field)** |

## 🔧 **Implementation Options:**

### **Option 1: Vendor ID Lookup (Recommended)**
- Create a vendor lookup service to map OPMS vendor names to NetSuite vendor internal IDs
- Maintain a mapping table: `Z_VENDOR.name` → NetSuite Vendor Internal ID
- Use native `vendor` field with proper IDs

### **Option 2: Revert to Custom Fields**
- Keep using `custitem_opms_vendor_name` for vendor business names
- Allows text values without ID lookup complexity
- Easier to implement but less integrated with NetSuite

### **Option 3: Hybrid Approach**
- Use native fields where possible (`vendorname`, `vendorcode`)
- Use custom field for vendor business name until ID lookup is implemented
- Gradual migration to full native field usage

## 📋 **Current RESTlet Implementation:**
```javascript
// ✅ Works with numeric vendor IDs
setFieldValue(inventoryItem, 'vendor', '1'); // Vendor ID 1

// ❌ Fails with text names  
setFieldValue(inventoryItem, 'vendor', 'Maharam'); // Error!

// ✅ Should work (text fields)
setFieldValue(inventoryItem, 'vendorname', 'Product Name');
setFieldValue(inventoryItem, 'vendorcode', 'PROD-001');
```

## 🚨 **Immediate Action Required:**
1. **Decide on approach** - ID lookup vs. custom fields vs. hybrid
2. **Update RESTlet** based on chosen approach
3. **Test all vendor fields** with correct data types
4. **Update documentation** with final implementation

## 💡 **Recommendation:**
Start with **Option 3 (Hybrid)** for immediate functionality:
- Revert `vendor` field to `custitem_opms_vendor_name` (custom field)
- Keep `vendorname` and `vendorcode` as native fields (they accept text)
- Plan vendor ID lookup system for future enhancement

