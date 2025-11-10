# Development Testing Configuration
## NetSuite ItemId Prefix Management

**Date:** January 18, 2025  
**Purpose:** Control NetSuite itemId prefixing for safe development testing

## 🎯 **Overview**

The export system automatically adds a `opmsAPI-` prefix to NetSuite itemIds during development to prevent conflicts with production data and make test items easily identifiable.

## ⚙️ **Environment Configuration**

### **Environment Variables**

```bash
# Development mode detection
NODE_ENV=development        # Automatically enables opmsAPI prefix

# Manual prefix control (overrides NODE_ENV)  
NETSUITE_TEST_PREFIX=true   # Forces opmsAPI prefix even in production
NETSUITE_TEST_PREFIX=false  # Disables prefix even in development
```

### **Prefix Behavior**

| Environment | NODE_ENV | NETSUITE_TEST_PREFIX | ItemId Result | Use Case |
|-------------|----------|---------------------|---------------|----------|
| Development | `development` | (any) | `opmsAPI-6800-8012` | Local development |
| Development | `development` | `false` | `6800-8012` | Production testing |
| Production | `production` | (unset) | `6800-8012` | Live production |
| Production | `production` | `true` | `opmsAPI-6800-8012` | Production testing |

## 🔧 **Implementation Details**

### **Code Logic**
```javascript
generateNetSuiteItemId(opmsItemCode) {
    // Check environment conditions
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isTestPrefix = process.env.NETSUITE_TEST_PREFIX === 'true';
    
    // Apply prefix when testing or in development
    if (isDevelopment || isTestPrefix) {
        return `opmsAPI-${opmsItemCode}`;    // "opmsAPI-6800-8012"
    }
    
    // Production: use OPMS code directly
    return opmsItemCode;                     // "6800-8012"
}
```

### **Applied In**
- ✅ **Bulk Export Controller** (`BulkExportController.js`)
- ✅ **Standard Export Route** (`export.js`)
- ✅ **Future Import Controllers** (when implemented)

## 🧪 **Testing Scenarios**

### **Local Development Testing**
```bash
# Set up local environment
NODE_ENV=development
NETSUITE_TEST_PREFIX=true  # Optional - already enabled by NODE_ENV

# Results in itemIds like:
# opmsAPI-6800-8012
# opmsAPI-SB-130
# opmsAPI-4400-1131
```

### **Production Environment Testing**  
```bash
# Production server with test prefix
NODE_ENV=production
NETSUITE_TEST_PREFIX=true  # Force test prefix in production

# Results in itemIds like:
# opmsAPI-6800-8012
# opmsAPI-SB-130
```

### **Live Production (No Prefix)**
```bash
# Production server - live data
NODE_ENV=production
# NETSUITE_TEST_PREFIX unset or false

# Results in itemIds like:
# 6800-8012
# SB-130
# 4400-1131
```

## 🛡️ **Safety Benefits**

### **Development Protection**
- **Prevents accidental production data pollution**
- **Clear identification** of test vs production items
- **Easy cleanup** using NetSuite bulk delete with `opmsAPI-*` filter

### **Production Testing Safety**
- **Safe testing** in production NetSuite without affecting live items  
- **Controlled prefix** enablement for staging/testing phases
- **Quick identification** of test items for cleanup

## 🔄 **Migration Strategy**

### **Development → Production**
1. **Test with prefix** in development (`opmsAPI-` items)
2. **Validate functionality** with test items
3. **Clean up test items** using bulk delete
4. **Deploy to production** with `NETSUITE_TEST_PREFIX=false`
5. **Live import** creates production items without prefix

### **Example Migration**
```bash
# Phase 1: Development Testing
curl /api/export/csv/bulk -F "itemCodesFile=@codes.txt"
# Creates: opmsAPI-6800-8012, opmsAPI-SB-130

# Phase 2: Production Deployment  
NODE_ENV=production NETSUITE_TEST_PREFIX=false
curl /api/export/csv/bulk -F "itemCodesFile=@codes.txt" 
# Creates: 6800-8012, SB-130
```

## 📋 **Custom Field Labels (Verified)**

The NetSuite custom field labels are correctly configured:

- **`custitem_opms_prod_id`** → **"OPMS Product ID"** (stores T_PRODUCT.id)
- **`custitem_opms_item_id`** → **"OPMS Item ID"** (stores T_ITEM.id)
- **NetSuite `itemid` field** → **"Item Name/Number"** (stores T_ITEM.code with optional prefix)

## 🎯 **Recommended Usage**

### **For Developers**
```bash
# Always use prefixes during development
NODE_ENV=development
# No need to set NETSUITE_TEST_PREFIX - automatically enabled
```

### **For Production Deployment**
```bash
# Live production - no prefixes
NODE_ENV=production  
# NETSUITE_TEST_PREFIX should be unset or false
```

### **For Production Testing**
```bash
# Test in production NetSuite safely
NODE_ENV=production
NETSUITE_TEST_PREFIX=true  # Temporary for testing
```

This configuration ensures safe development practices while maintaining flexibility for production testing scenarios.
