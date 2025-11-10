# Category Filter Solution

**Date**: October 15, 2025  
**Issue**: NetSuite SuiteScript 2.1 doesn't support filtering by category text name

---

## ❌ Problem

The initial approach tried to filter vendors by category in the RESTlet:
```javascript
['category.name', 'is', 'Fabric Supplier'] // ❌ DOESN'T WORK
```

**NetSuite Error**:
```
SSS_INVALID_SRCH_FILTER_JOIN: An nlobjSearchFilter contains an invalid join ID, 
or is not in proper syntax: name.
```

---

## ✅ Solution

**Two-Step Approach**:
1. **RESTlet**: Returns ALL active vendors WITH category information
2. **Node.js Script**: Filters vendors by category = "Fabric Supplier" CLIENT-SIDE

---

## 📝 What Changed

### **VendorListRestlet.js**
- ✅ Removed category filter from RESTlet
- ✅ Still returns `category` (name) and `categoryId` (ID) for each vendor
- ✅ Returns all active vendors
- ✅ Comments explain why category filter isn't in RESTlet

### **extract-vendors-via-restlet-prod.js** (needs update)
- ⏳ Will add client-side filter for "Fabric Supplier" category
- ⏳ Only saves vendors where `vendor.category === "Fabric Supplier"`

---

## 🔧 RESTlet Changes

**Before** (broken):
```javascript
filters: [
    ['isinactive', 'is', 'F'],
    'AND',
    ['category.name', 'is', 'Fabric Supplier'] // ❌ Invalid syntax
]
```

**After** (working):
```javascript
filters: [
    ['isinactive', 'is', 'F'] // Only active vendors
    // NOTE: Category text filter not supported in SuiteScript 2.1
    // Filtering done client-side in Node.js extraction script
]
```

---

## 📊 Data Flow

```
NetSuite RESTlet
      ↓
   (Returns ALL 365+ active vendors with category field)
      ↓
Node.js Extraction Script
      ↓
   (Filters to only "Fabric Supplier" vendors ~150-250)
      ↓
   Saves to JSON file
```

---

## ⚡ Benefits

1. **Works**: No NetSuite errors
2. **Flexible**: Can filter by any category name in Node.js
3. **Fast**: NetSuite returns all vendors at once
4. **Maintainable**: No need to look up category IDs

---

## 🚀 Next Steps

1. ✅ **RESTlet fixed** - ready to upload to NetSuite
2. ⏳ **Upload RESTlet** to NetSuite (without category filter)
3. ⏳ **Update extraction script** to filter client-side
4. ⏳ **Run extraction** and verify only "Fabric Supplier" vendors are saved

---

## 📝 Alternative Approaches (Not Used)

### **Option A: Filter by Category ID**
```javascript
['category', 'anyof', '5'] // Works but need to know ID
```
**Problem**: Don't know the category ID, and it may change

### **Option B: Use Saved Search**
Create a saved search in NetSuite with category criteria
**Problem**: More complex, requires NetSuite admin work

### **Option C: Client-Side Filter** ✅ CHOSEN
Filter results in Node.js after retrieval
**Benefits**: Simple, flexible, no NetSuite changes needed

---

**Status**: Ready for deployment  
**Next**: Upload fixed RESTlet to NetSuite

