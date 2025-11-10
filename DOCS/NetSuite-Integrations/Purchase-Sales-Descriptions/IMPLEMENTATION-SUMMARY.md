# Sales and Purchase Descriptions - Implementation Summary

**Feature:** Auto-generation of Sales Description and Purchase Description fields from OPMS to NetSuite

**Implementation Date:** October 25, 2025

**Specification:** `sales-purchase-descriptions-sync-spec.md`

**Status:** ✅ Code Complete - Ready for Testing

---

## 📋 **OVERVIEW**

This feature automatically generates formatted `purchasedescription` and `salesdescription` fields for NetSuite lot-numbered inventory items from OPMS product data. These descriptions provide comprehensive product information in a standardized, readable format.

### **Key Characteristics**
- **One-way sync:** OPMS → NetSuite only (does NOT sync back)
- **No pricing cascade participation:** These fields update only during product/item sync, NOT during pricing updates
- **Multi-line format:** Uses `<br>` HTML tags for line breaks in NetSuite
- **Separate content:** Purchase descriptions include pricing; sales descriptions include item code and origin

---

## 🔧 **IMPLEMENTATION DETAILS**

### **1. OpmsDataTransformService.js**

**Location:** `src/services/OpmsDataTransformService.js`

**New Methods:**

#### `extractOriginData(productId)`
- **Purpose:** Extract country of origin from OPMS
- **Source:** T_PRODUCT_ORIGIN + P_ORIGIN tables
- **Returns:** Origin name string or null
- **Error Handling:** Returns null on error, doesn't fail entire sync

```javascript
const originQuery = `
    SELECT po.name as origin_name
    FROM T_PRODUCT_ORIGIN tpo
    JOIN P_ORIGIN po ON tpo.origin_id = po.id
    WHERE tpo.product_id = ?
    LIMIT 1
`;
```

#### `composePurchaseDescription(itemData, pricingData)`
- **Purpose:** Generate purchase description with internal pricing
- **Includes:** Pattern, Color, Width, Repeat, Content, Abrasion, Fire Rating, Cut Price, Roll Price
- **Format:** Multi-line with `<br>` tags
- **Pricing:** Shows "$XX.XX/Y" for non-zero prices, "NULL/Y" for zero/null prices

```javascript
// Example output:
// Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br>Content: 55% Cotton, 45% Polyester<br>Abrasion: Wyzenbeek: 50000 rubs<br>Fire Rating: CAL TB 117-2013<br>Cut Price: $104.44/Y<br>Roll Price: $94.44/Y
```

#### `composeSalesDescription(itemData, originData)`
- **Purpose:** Generate customer-facing sales description without pricing
- **Includes:** Item Number (#), Pattern, Color, Width, Repeat, Content, Abrasion, Fire Rating, Country of Origin
- **Format:** Multi-line with `<br>` tags
- **No Pricing:** Pricing information excluded for customer view

```javascript
// Example output:
// #3940-1765<br>Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br>Content: 55% Cotton, 45% Polyester<br>Abrasion: Wyzenbeek: 50000 rubs<br>Fire Rating: CAL TB 117-2013<br>Country of Origin: India
```

**Integration in `transformItemForNetSuite()`:**

```javascript
// Step 1c: Extract origin data for sales description
const originData = await this.extractOriginData(opmsData.product_id);
opmsData.origin = originData;

// Step 1d: Compose purchase and sales descriptions
opmsData.purchaseDescription = this.composePurchaseDescription(opmsData, pricingData);
opmsData.salesDescription = this.composeSalesDescription(opmsData, originData);
```

**Payload Addition in `buildNetSuitePayload()`:**

```javascript
// ============================================================================
// SALES AND PURCHASE DESCRIPTIONS (from OPMS product data)
// One-way sync: OPMS → NetSuite (does not cascade from pricing updates)
// ============================================================================
purchasedescription: validatedData.purchaseDescription || null,
salesdescription: validatedData.salesDescription || null,
```

---

### **2. NetSuiteRestletService.js**

**Location:** `src/services/NetSuiteRestletService.js`

**Field Mapping in `transformToRestletPayload()`:**

```javascript
// Add Purchase Description field (purchasedescription) - native NetSuite field
if (itemData.purchasedescription) {
  payload.purchasedescription = itemData.purchasedescription;
}

// Add Sales Description field (salesdescription) - native NetSuite field
if (itemData.salesdescription) {
  payload.salesdescription = itemData.salesdescription;
}
```

**Position:** Added after firecodes field handling (line ~700)

---

### **3. RESTletUpsertInventoryItem-PROD.js**

**Location:** `netsuite-scripts/RESTletUpsertInventoryItem-PROD.js`

**Field Setting (lines 567-587):**

```javascript
// Set Purchase Description field if provided
if (requestBody.purchasedescription) {
    try {
        log.debug('CreateInventoryItemRestlet', '📝 Setting purchase description (' + requestBody.purchasedescription.length + ' chars)');
        setFieldValue(inventoryItem, 'purchasedescription', requestBody.purchasedescription);
        log.debug('CreateInventoryItemRestlet', '✅ Purchase description set successfully');
    } catch (error) {
        log.error('CreateInventoryItemRestlet', '❌ Error setting purchase description: ' + error.toString());
    }
}

// Set Sales Description field if provided  
if (requestBody.salesdescription) {
    try {
        log.debug('CreateInventoryItemRestlet', '📝 Setting sales description (' + requestBody.salesdescription.length + ' chars)');
        setFieldValue(inventoryItem, 'salesdescription', requestBody.salesdescription);
        log.debug('CreateInventoryItemRestlet', '✅ Sales description set successfully');
    } catch (error) {
        log.error('CreateInventoryItemRestlet', '❌ Error setting sales description: ' + error.toString());
    }
}
```

**Read-back Verification (lines 985-1001):**

```javascript
// Read back purchase and sales descriptions
var purchaseDescription = null;
var salesDescription = null;

try {
    purchaseDescription = savedRecord.getValue({ fieldId: 'purchasedescription' });
    log.debug('CreateInventoryItemRestlet', 'Read back purchase description: ' + (purchaseDescription ? purchaseDescription.length + ' chars' : 'empty'));
} catch (error) {
    log.error('CreateInventoryItemRestlet', 'Could not read purchase description: ' + error.toString());
}

try {
    salesDescription = savedRecord.getValue({ fieldId: 'salesdescription' });
    log.debug('CreateInventoryItemRestlet', 'Read back sales description: ' + (salesDescription ? salesDescription.length + ' chars' : 'empty'));
} catch (error) {
    log.error('CreateInventoryItemRestlet', 'Could not read sales description: ' + error.toString());
}
```

**Response Enhancement (lines 1022-1023):**

```javascript
purchaseDescription: purchaseDescription,
salesDescription: salesDescription,
```

---

### **4. Test Script**

**Location:** `scripts/test-sales-purchase-descriptions.js`

**Purpose:** Validate description generation and NetSuite sync

**Test Items:**
- Product 7799 (AAA TEST PKL02)
- Item 3940-1765 (Battered Blue) - NetSuite ID: 11610
- Item 4281-4920 (Maple Syrup) - NetSuite ID: 11609

**Usage:**

```bash
# Test specific OPMS item (dry run)
node scripts/test-sales-purchase-descriptions.js <opmsItemId>

# Test all configured items (dry run)
node scripts/test-sales-purchase-descriptions.js

# Perform actual NetSuite sync (LIVE)
node scripts/test-sales-purchase-descriptions.js <opmsItemId> --live
```

**Test Validations:**
- ✅ Product name appears in both descriptions
- ✅ Color appears in both descriptions
- ✅ Pricing appears in purchase description only
- ✅ Item code (#) appears in sales description only
- ✅ Country of Origin appears in sales description only
- ✅ Line breaks (`<br>`) present in both descriptions
- ✅ No pricing information in sales description

---

## 📊 **DATA FLOW**

```
OPMS Database
    ↓
1. extractOpmsItemData() - Get product/item data
    ↓
2. extractPricingData() - Get pricing (p_res_cut, p_hosp_roll)
    ↓
3. extractOriginData() - Get country of origin
    ↓
4. composePurchaseDescription() - Format with pricing
    ↓
5. composeSalesDescription() - Format with item code & origin
    ↓
6. buildNetSuitePayload() - Add to payload
    ↓
7. transformToRestletPayload() - Map fields
    ↓
8. RESTlet - Set fields in NetSuite
    ↓
NetSuite Item Record
```

---

## 🧪 **TESTING CHECKLIST**

### **Phase 1: Code Validation** ✅
- [x] No linting errors in OpmsDataTransformService.js
- [x] No linting errors in NetSuiteRestletService.js
- [x] No linting errors in test script
- [x] All methods properly documented

### **Phase 2: Local Testing** (PENDING)
- [ ] Run test script with Product 7799 items
- [ ] Verify purchase description format
- [ ] Verify sales description format
- [ ] Confirm pricing in purchase desc only
- [ ] Confirm item code and origin in sales desc only
- [ ] Check line break formatting

### **Phase 3: NetSuite Integration Testing** (PENDING)
- [ ] Dry run sync successful
- [ ] Live sync to NetSuite sandbox
- [ ] Verify fields populated in NetSuite UI
- [ ] Confirm `<br>` tags render as line breaks
- [ ] Check character limits (4000 chars max)
- [ ] Test with items having no origin data
- [ ] Test with items having no pricing data

### **Phase 4: Production Validation** (PENDING)
- [ ] Deploy to production environment
- [ ] Sync test items to production NetSuite
- [ ] User acceptance testing
- [ ] Verify no bidirectional sync occurs
- [ ] Confirm descriptions don't update during pricing cascade

---

## 🚀 **DEPLOYMENT INSTRUCTIONS**

### **Prerequisites**
1. NetSuite RESTlet `RESTletUpsertInventoryItem-PROD.js` must be deployed
2. NetSuite fields `purchasedescription` and `salesdescription` must exist (native fields)
3. T_PRODUCT_ORIGIN and P_ORIGIN tables must exist in OPMS database

### **Deployment Steps**

1. **Commit code changes:**
```bash
git add src/services/OpmsDataTransformService.js
git add src/services/NetSuiteRestletService.js
git add netsuite-scripts/RESTletUpsertInventoryItem-PROD.js
git add scripts/test-sales-purchase-descriptions.js
git add DOCS/ai-specs/app-technical-specifications/
git commit -m "feat: Add auto-generation of sales and purchase descriptions

- Add extractOriginData() to fetch country of origin
- Add composePurchaseDescription() with pricing info
- Add composeSalesDescription() with item code and origin
- Update RESTlet to handle new description fields
- Add test script for validation

Closes #[issue-number]"
```

2. **Run tests:**
```bash
# Test with specific item
node scripts/test-sales-purchase-descriptions.js <opmsItemId>

# Run dry run first
node scripts/test-sales-purchase-descriptions.js

# Run live sync when validated
node scripts/test-sales-purchase-descriptions.js <opmsItemId> --live
```

3. **Deploy RESTlet to NetSuite:**
   - Upload updated `RESTletUpsertInventoryItem-PROD.js` to NetSuite
   - No new custom fields required (using native fields)

4. **Deploy API code:**
   - Deploy to EFS: `/opuzen-efs/prod/opms-api/`
   - Restart API service

---

## ⚠️ **IMPORTANT NOTES**

### **One-Way Sync Only**
- These fields sync OPMS → NetSuite
- Manual edits in NetSuite will be overwritten on next sync
- Fields do NOT sync back to OPMS

### **Not Part of Pricing Cascade**
- Descriptions update during product/item sync
- Descriptions do NOT update during pricing cascade events
- Pricing values in purchase description come from OPMS snapshot at sync time

### **Character Limits**
- NetSuite textarea fields: 4000 character limit
- Typical descriptions: 300-500 characters
- No truncation logic needed for normal data

### **Error Handling**
- Missing origin data: Shows "Country of Origin: Not Specified"
- Missing content/abrasion/firecodes: Line omitted from description
- Null pricing: Shows "NULL/Y" instead of "$0.00/Y"
- Origin query failure: Uses "Not Specified" without failing sync

---

## 📝 **EXAMPLE OUTPUT**

### **Purchase Description (Product 7799, Item 3940-1765)**
```
Pattern: AAA TEST PKL02
Color: Battered Blue
Width: 50''
Repeat: H: 25'' V: 25''
Content: 55% Cotton, 45% Polyester
Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)
Fire Rating: CAL TB 117-2013, NFPA 260
Cut Price: $104.44/Y
Roll Price: $94.44/Y
```

### **Sales Description (Product 7799, Item 3940-1765)**
```
#3940-1765
Pattern: AAA TEST PKL02
Color: Battered Blue
Width: 50''
Repeat: H: 25'' V: 25''
Content: 55% Cotton, 45% Polyester
Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)
Fire Rating: CAL TB 117-2013, NFPA 260
Country of Origin: India
```

---

## 🔗 **RELATED FILES**

### **Source Code**
- `src/services/OpmsDataTransformService.js` (lines 32-60, 741-896)
- `src/services/NetSuiteRestletService.js` (lines 702-710)
- `netsuite-scripts/RESTletUpsertInventoryItem-PROD.js` (lines 567-587, 985-1023)

### **Tests**
- `scripts/test-sales-purchase-descriptions.js`

### **Documentation**
- `DOCS/ai-specs/app-technical-specifications/sales-purchase-descriptions-sync-spec.md`

### **Database Tables**
- `T_PRODUCT` - Product name, dimensions, repeats
- `T_PRODUCT_PRICE` - Customer pricing (p_res_cut, p_hosp_roll)
- `T_PRODUCT_ORIGIN` + `P_ORIGIN` - Country of origin
- `T_PRODUCT_CONTENT_FRONT` + `P_CONTENT` - Fabric content
- `T_PRODUCT_ABRASION` + `P_ABRASION_TEST` - Abrasion tests
- `T_PRODUCT_FIRECODE` + `P_FIRECODE_TEST` - Fire certifications
- `T_ITEM` - Item code
- `T_ITEM_COLOR` + `P_COLOR` - Color information

---

## 🎯 **NEXT STEPS**

1. ✅ **Code Complete** - All implementation done
2. ⏳ **Run test script** - Validate with Product 7799 items
3. ⏳ **NetSuite testing** - Verify fields in sandbox
4. ⏳ **User acceptance** - Sales/purchasing team review
5. ⏳ **Production deployment** - Deploy when validated

---

**Implementation Status:** ✅ Code Complete - Ready for Testing

**Last Updated:** October 25, 2025

