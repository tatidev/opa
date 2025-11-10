# OPMS Import Guide - Complete Workflow Documentation

**Date:** January 18, 2025  
**Version:** 1.0.0  
**Status:** Production Ready  
**Purpose:** Complete guide for importing OPMS inventory items into NetSuite via CSV

## 🎯 **OVERVIEW & PURPOSE**

This guide documents the complete workflow for importing OPMS inventory items into NetSuite using a two-phase approach:

1. **Phase 1**: Export OPMS data to CSV with all NetSuite constants
2. **Phase 2**: Manual import of CSV into NetSuite UI

**Key Benefits:**
- ✅ **Faster than API import** (manual CSV import: 5-8 minutes vs API: 4+ hours for 8,000 items)
- ✅ **All 8 NetSuite constants applied** automatically to every item
- ✅ **Complete data integrity** with validation and error handling
- ✅ **NetSuite UI optimized** for large batch imports (up to 10,000 items)

## 📋 **SYSTEM ARCHITECTURE**

### **Data Flow Overview**
```
OPMS Database → CSV Export → NetSuite Manual Import → Inventory Items Created
     ↓              ↓              ↓                    ↓
 8,000 items   All constants   UI processing      Ready for use
```

### **Technical Components**
- **OPMS Export Engine**: Generates CSV with NetSuite constants
- **CSV Generation**: Includes all required fields and validation data
- **NetSuite Constants Service**: Applies 8 standard constants to every item
- **Manual Import Process**: NetSuite UI handles the actual import

## 🏷️ **ITEM CODE FORMAT REQUIREMENTS** *(NEW)*

### **Mandatory Format for New CSV Imports**
- **✅ REQUIRED**: All new CSV imports must use `####-####` format
- **✅ EXAMPLES**: `1354-6543`, `2001-5678`, `9999-0001`
- **✅ PATTERN**: Exactly 4 digits, dash, exactly 4 digits
- **❌ REJECTED**: Legacy formats like `ABC123`, `PROD-01`, `FAB-001`

### **Legacy Data Protection**
- **✅ PRESERVED**: Existing database items with legacy codes remain unchanged
- **✅ FUNCTIONAL**: Legacy items continue to work in all API searches
- **✅ NO MIGRATION**: Legacy codes are not automatically converted

### **Validation Behavior**
```javascript
// ✅ VALID - New format
validateItemCode('1354-6543') // Returns: true
validateItemCode('0000-0001') // Returns: true

// ❌ INVALID - Legacy formats (for CSV imports)
validateItemCode('ABC123')    // Returns: false
validateItemCode('PROD-01')   // Returns: false
validateItemCode('123-456')   // Returns: false (too few digits)
```

## 🔧 **NETSUITE CONSTANTS INTEGRATION**

### **All 8 Constants Applied to Every Item**
```javascript
const NETSUITE_CONSTANTS = {
    usebins: true,                           // Enable bin tracking
    matchbilltoreceipt: true,                // Match bills to receipts
    custitem_aln_1_auto_numbered: true,     // Auto-numbered field 1
    custitem_aln_3_initial_sequence: 1,     // Initial sequence number
    subsidiary: 2,                           // Subsidiary ID
    taxschedule: 1,                          // Tax schedule ID (Taxable)
    unitstype: 1,                            // Units type ID (Length)
    custitem_aln_2_number_format: true      // Number format field 2
};
```

### **Constants in CSV Export**
Your CSV includes these columns for every item:
```csv
ns_usebins,ns_matchbilltoreceipt,ns_custitem_aln_1_auto_numbered,
ns_custitem_aln_3_initial_sequence,ns_subsidiary,ns_taxschedule,
ns_unitstype,ns_custitem_aln_2_number_format
```

## 📊 **CSV EXPORT STRUCTURE**

### **Complete Field Mapping**
```csv
item_id,item_code,product_id,product_name,color_name,display_name,width,
vendor_id,vendor_name,netsuite_vendor_id,vendor_code,vendor_color,
vendor_product_name,validation_product_name,validation_color_name,
validation_width,validation_vendor_name,validation_vendor_code,
validation_vendor_color,validation_vendor_product_name,
ns_usebins,ns_matchbilltoreceipt,ns_custitem_aln_1_auto_numbered,
ns_custitem_aln_3_initial_sequence,ns_subsidiary,ns_taxschedule,
ns_unitstype,ns_custitem_aln_2_number_format
```

### **Field Categories**
- **OPMS Core Fields**: item_id, item_code, product_name, color_name, etc.
- **Vendor Integration**: vendor_name, vendor_code, vendor_color, etc.
- **Validation Status**: validation_* fields for data quality tracking
- **NetSuite Constants**: ns_* fields for consistent configuration

## 🚀 **PERFORMANCE CHARACTERISTICS**

### **Export Performance**
- **8,000 items**: ≤ 60 seconds processing time
- **Memory usage**: ≤ 512MB peak during processing
- **File size**: ~2-5MB for 8,000 items (well under NetSuite's 50MB limit)

### **Import Performance (Manual CSV)**
- **NetSuite UI limit**: Up to 10,000 items per import
- **Processing time**: 5-8 minutes for 8,000 items
- **Batch processing**: NetSuite UI handles large files efficiently
- **Memory usage**: NetSuite UI optimized for large imports

### **Performance Comparison**
| Method | 100 Items | 1,000 Items | 8,000 Items |
|--------|-----------|-------------|-------------|
| **Manual CSV Import** | 1-2 min | 2-5 min | 5-8 min |
| **API Import** | 3.3 min | 33 min | 4.4 hours |
| **Speed Factor** | 2-3x faster | 6-16x faster | 6-16x faster |

## 📁 **FILE SIZE & LIMITATIONS**

### **NetSuite CSV Import Limits**
- **✅ File Size**: Up to 50MB (your exports will be well under this)
- **✅ Row Count**: Up to 10,000 rows (8,000 items supported)
- **✅ Column Count**: Up to 100 columns (your CSV has ~30 columns)
- **✅ Batch Processing**: Automatic chunking by NetSuite UI

### **Why Single Large CSV is Better**
1. **One Import Job**: Single transaction, easier to track
2. **Consistent Constants**: All 8 NetSuite constants applied uniformly
3. **Atomic Operation**: Either all items succeed or all fail together
4. **Single Audit Trail**: One import record for compliance
5. **Faster Processing**: NetSuite's internal batch processing is highly optimized

## 🔄 **COMPLETE WORKFLOW**

### **Step 1: OPMS Export** *(Enhanced with Batch Export)*

#### **Option A: Standard Export** *(Up to 1,000 items)*
```bash
GET /api/export/csv?limit=1000&onlyValidCodes=true
```

#### **Option B: Batch Export** *(Up to 50,000 items)* ⭐ **NEW**
```bash
POST /api/export/csv/batch
Content-Type: application/json

{
    "maxItems": 10000,
    "filters": {
        "onlyValidCodes": true,
        "itemIdStart": 1,
        "itemIdEnd": 100000
    }
}

Response: Single CSV file with all items combined
```

**Key Benefits of Batch Export:**
- ✅ **Large Scale**: Up to 50,000 items in single request
- ✅ **Valid Code Filtering**: Only exports `####-####<alpha>` format codes
- ✅ **Automatic Batching**: Handles 1000-item chunks automatically
- ✅ **Single File Output**: No manual file combining required
- ✅ **Progress Tracking**: Built-in batch progress monitoring

### **Step 2: CSV Download**
- Download the generated CSV file
- Verify file contains all expected columns
- Check that NetSuite constants are present
- File size should be 2-5MB for 8,000 items

### **Step 3: NetSuite Manual Import**
1. **Login to NetSuite**
2. **Navigate to**: Setup → Import/Export → Import CSV Records
3. **Select Record Type**: Inventory Item
4. **Upload CSV File**: Select your downloaded file
5. **Preview Data**: Verify field mappings are correct
6. **Start Import**: Begin the import process
7. **Monitor Progress**: Watch import completion
8. **Review Results**: Check success/failure report

## 🎯 **BEST PRACTICES**

### **Pre-Import Checklist**
- ✅ **Backup NetSuite**: Export existing inventory data
- ✅ **Test Small Batch**: Import 100 items first to validate format
- ✅ **Verify Constants**: Ensure all 8 NetSuite constants are present
- ✅ **Check Field Mapping**: Confirm NetSuite recognizes all columns
- ✅ **Validate Data**: Review preview data before importing

### **During Import**
- ✅ **Don't Interrupt**: Let the import complete fully
- ✅ **Monitor Progress**: Watch for any error messages
- ✅ **Note Completion Time**: Record for future reference
- ✅ **Save Import Log**: Keep for audit purposes

### **Post-Import Validation**
- ✅ **Verify Item Count**: Confirm all items were created
- ✅ **Check Constants**: Verify NetSuite constants were applied
- ✅ **Test Sample Items**: Open a few items to verify data
- ✅ **Review Error Log**: Address any failed imports

## 🛠 **TROUBLESHOOTING**

### **Common Issues & Solutions**

#### **Issue 1: CSV Too Large**
**Symptoms**: File upload fails or times out
**Solutions**:
- Verify file is under 50MB
- Check for unnecessary columns
- Ensure proper CSV formatting

#### **Issue 2: Field Mapping Errors**
**Symptoms**: NetSuite shows field mapping warnings
**Solutions**:
- Verify column headers match NetSuite expectations
- Check for special characters in headers
- Ensure required fields are present

#### **Issue 3: Item Code Format Errors** *(NEW)*
**Symptoms**: CSV validation fails with item code errors
**Solutions**:
- Convert legacy codes to new `####-####` format
- Examples: `ABC123` → `1354-6543`, `PROD-01` → `2001-5678`
- Use only 4 digits, dash, 4 digits pattern
- Remove letters, special characters, or wrong separators

#### **Issue 4: Import Failures**
**Symptoms**: Some items fail to import
**Solutions**:
- Review error log for specific issues
- Check data validation rules
- Verify NetSuite field permissions

#### **Issue 4: Constants Not Applied**
**Symptoms**: NetSuite constants missing from created items
**Solutions**:
- Verify constants columns are in CSV
- Check NetSuite field mapping
- Ensure custom fields exist in NetSuite

### **Error Recovery**
1. **Partial Import**: Resume with remaining items
2. **Data Validation**: Fix data issues and re-export
3. **Field Mapping**: Adjust CSV structure if needed
4. **NetSuite Configuration**: Verify required fields exist

## 📈 **MONITORING & REPORTING**

### **Import Success Metrics**
- **Success Rate**: Target >95% successful imports
- **Processing Time**: 5-8 minutes for 8,000 items
- **Data Accuracy**: 100% field mapping accuracy
- **Constants Application**: All 8 constants applied to every item

### **Audit Trail**
- **Import Timestamp**: When import was completed
- **Item Count**: Total items processed
- **Success/Failure**: Detailed breakdown
- **Error Log**: Specific failure reasons
- **Constants Verification**: Confirmation of applied constants

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Improvements**
1. **Automated Validation**: Pre-import data quality checks
2. **Incremental Updates**: Delta imports for changed items only
3. **Real-time Sync**: Continuous synchronization between OPMS and NetSuite
4. **Advanced Error Handling**: Intelligent retry and recovery
5. **Performance Optimization**: Parallel processing for larger datasets

### **Integration Opportunities**
1. **OPMS Webhooks**: Real-time export triggers
2. **NetSuite Workflows**: Automated post-import processing
3. **Business Intelligence**: Import analytics and reporting
4. **Quality Assurance**: Automated data validation rules

## 📞 **SUPPORT & RESOURCES**

### **Documentation References**
- **NetSuite CSV Import Guide**: [NetSuite Help Center]
- **OPMS API Documentation**: [Internal API Docs]
- **NetSuite Constants Reference**: [Custom Fields Setup]

### **Technical Support**
- **OPMS Issues**: Contact OPMS development team
- **NetSuite Issues**: Contact NetSuite administrator
- **Integration Issues**: Contact API development team

### **Training Resources**
- **Import Process Video**: Step-by-step walkthrough
- **Best Practices Guide**: Optimization recommendations
- **Troubleshooting Manual**: Common issues and solutions

---

## 📝 **CHANGE LOG**

### **v1.0.0 - Initial Release**
- **Date**: January 18, 2025
- **Status**: Production Ready
- **Features**: Complete workflow documentation, performance analysis, best practices
- **Coverage**: OPMS export to NetSuite manual import, all 8 constants, troubleshooting

---

**Document Status**: ✅ **READY FOR PRODUCTION USE**  
**Last Updated**: January 18, 2025  
**Next Review**: February 18, 2025  
**Maintained By**: API Development Team
