# Sales and Purchase Descriptions Auto-Generation - AI Model Specification

## 🎯 **OVERVIEW & PURPOSE**

This specification defines the **automatic generation and synchronization** of formatted Sales Description and Purchase Description fields from OPMS to NetSuite lot-numbered inventory items. These descriptions provide comprehensive product information in a standardized, readable format for sales and purchasing workflows.

**🔒 CRITICAL CONTEXT**: This is a **one-way synchronization** (OPMS → NetSuite only). These fields do NOT sync back from NetSuite to OPMS and do NOT participate in the pricing cascade system.

---

## 📋 **FIELD SPECIFICATIONS**

### **Purchase Description Field**

**NetSuite Field:** `purchasedescription` (native textarea field)

**Purpose:** Internal purchasing reference with complete product specifications including pricing

**Format:**
```
Pattern: {PRODUCT_NAME}
Color: {COLOR_NAMES}
Width: {WIDTH}''
Repeat: H: {H_REPEAT}'' V: {V_REPEAT}''
Content: {CONTENT_PERCENTAGES}
Abrasion: {ABRASION_TEST_RESULTS}
Fire Rating: {FIRE_CODE_CERTIFICATIONS}
Cut Price: {CUT_PRICE}/Y
Roll Price: {ROLL_PRICE}/Y
```

**Example Output:**
```
Pattern: ACDC
Color: Teal
Width: 54''
Repeat: H: 27.5'' V: 26''
Content: Viscose: 57.00%, Polyester: 35.00%, Cotton: 8.00%
Abrasion: Double Rubs (Wyzenbeek): 50000 rubs (Unknown)
Fire Rating: CAL TB 117-2013, NFPA 260, UFAC Class I
Cut Price: NULL/Y
Roll Price: $21.95/Y
```

---

### **Sales Description Field**

**NetSuite Field:** `salesdescription` (native textarea field)

**Purpose:** Customer-facing product information without internal pricing details

**Format:**
```
#{ITEM_CODE}
Pattern: {PRODUCT_NAME}
Color: {COLOR_NAMES}
Width: {WIDTH}''
Repeat: H: {H_REPEAT}'' V: {V_REPEAT}''
Content: {CONTENT_PERCENTAGES}
Abrasion: {ABRASION_TEST_RESULTS}
Fire Rating: {FIRE_CODE_CERTIFICATIONS}
Country of Origin: {ORIGIN}
```

**Example Output:**
```
#6148-4501
Pattern: ACDC
Color: Teal
Width: 54''
Repeat: H: 27.5'' V: 26''
Content: Viscose: 57.00%, Polyester: 35.00%, Cotton: 8.00%
Abrasion: Double Rubs (Wyzenbeek): 50000 rubs (Unknown)
Fire Rating: CAL TB 117-2013, NFPA 260, UFAC Class I
Country of Origin: India
```

---

## 🗄️ **DATA SOURCE MAPPING**

### **OPMS Database Tables and Fields**

| Description Line | OPMS Source | Table | Field | Notes |
|---|---|---|---|---|
| **Pattern:** | Product Name | T_PRODUCT | name | Required |
| **Color:** | Color Names | P_COLOR | name | Via T_ITEM_COLOR join, comma-separated |
| **Width:** | Fabric Width | T_PRODUCT | width | In inches, format as "54''" |
| **Repeat:** | H & V Repeat | T_PRODUCT | hrepeat, vrepeat | Format as "H: 27.5'' V: 26''" |
| **Content:** | Front Content | T_PRODUCT_FRONTCONTENT | See mini-forms | Percentages with material names |
| **Abrasion:** | Abrasion Tests | T_PRODUCT_ABRASION | See mini-forms | Test type, rubs, limit |
| **Fire Rating:** | Fire Codes | T_PRODUCT_FIRECODES | See mini-forms | Certification names |
| **Cut Price:** | Customer Cut | T_PRODUCT_PRICE | p_res_cut | Purchase desc only |
| **Roll Price:** | Customer Roll | T_PRODUCT_PRICE | p_hosp_roll | Purchase desc only |
| **Country of Origin:** | Product Origin | T_PRODUCT_ORIGIN | See relationships | Sales desc only |
| **Item Number:** | Item Code | T_ITEM | code | Sales desc only, prefixed with # |

---

## 🔧 **MINI-FORMS DATA PROCESSING**

### **Content (Front)**

**Source:** T_PRODUCT_CONTENT_FRONT + P_CONTENT

**Query Pattern:**
```sql
SELECT 
    pcf.perc,
    pc.name as content_name
FROM T_PRODUCT_CONTENT_FRONT pcf
JOIN P_CONTENT pc ON pcf.content_id = pc.id
WHERE pcf.product_id = ?
ORDER BY pcf.perc DESC;
```

**Format:** "Viscose: 57.00%, Polyester: 35.00%, Cotton: 8.00%"

**Rules:**
- Sort by percentage descending
- Include all content materials
- Format: "{Material}: {Percentage}%" separated by ", "

---

### **Abrasion**

**Source:** T_PRODUCT_ABRASION + P_ABRASION_TEST + P_ABRASION_LIMIT

**Query Pattern:**
```sql
SELECT 
    pa.n_rubs,
    pat.name as test_name,
    pal.name as limit_name
FROM T_PRODUCT_ABRASION pa
JOIN P_ABRASION_TEST pat ON pa.abrasion_test_id = pat.id
JOIN P_ABRASION_LIMIT pal ON pa.abrasion_limit_id = pal.id
WHERE pa.product_id = ? AND pa.visible = 'Y';
```

**Format:** "Double Rubs (Wyzenbeek): 50000 rubs (Unknown)"

**Rules:**
- Use visible tests only (visible = 'Y')
- Format: "{Test Type}: {Number} rubs ({Limit})"
- Multiple tests: Join with ", "

---

### **Fire Rating**

**Source:** T_PRODUCT_FIRECODE + P_FIRECODE_TEST

**Query Pattern:**
```sql
SELECT 
    pft.name as test_name
FROM T_PRODUCT_FIRECODE pf
JOIN P_FIRECODE_TEST pft ON pf.firecode_test_id = pft.id
WHERE pf.product_id = ? AND pf.visible = 'Y';
```

**Format:** "CAL TB 117-2013, NFPA 260, UFAC Class I"

**Rules:**
- Use visible fire codes only (visible = 'Y')
- List all certifications
- Separate with ", "

---

## 💰 **PRICING DATA INTEGRATION**

**Purchase Description Only** - Sales Description excludes pricing

**Source:** T_PRODUCT_PRICE (already extracted for pricing cascade)

**Format Rules:**
- **Cut Price:** 
  - If p_res_cut is null or 0: "NULL/Y"
  - If p_res_cut has value: "$69.01/Y"
  
- **Roll Price:**
  - If p_hosp_roll is null or 0: "NULL/Y"
  - If p_hosp_roll has value: "$63.01/Y"

**Access:** Use existing `pricing` data from extractPricingData() method

---

## 🌍 **COUNTRY OF ORIGIN**

**Sales Description Only** - Purchase Description excludes origin

**Source:** T_PRODUCT_ORIGIN + P_ORIGIN

**Query Pattern:**
```sql
SELECT 
    po.name as origin_name
FROM T_PRODUCT_ORIGIN tpo
JOIN P_ORIGIN po ON tpo.origin_id = po.id
WHERE tpo.product_id = ?;
```

**Format:** "Country of Origin: India"

**Rules:**
- Multiple origins: Use primary or first one
- If no origin data: "Country of Origin: Not Specified"

---

## 📝 **COMPOSITION FUNCTIONS**

### **Function: composePurchaseDescription(itemData, pricingData)**

**Input:**
- itemData: Complete OPMS item data from extractOpmsItemData()
- pricingData: Pricing data from extractPricingData()

**Output:** Multi-line string with `<br>` tags

**Pseudocode:**
```javascript
function composePurchaseDescription(itemData, pricingData) {
  const lines = [];
  
  lines.push(`Pattern: ${itemData.product_name}`);
  lines.push(`Color: ${itemData.color_names}`);
  
  if (itemData.width) {
    lines.push(`Width: ${itemData.width}''`);
  }
  
  if (itemData.hrepeat || itemData.vrepeat) {
    lines.push(`Repeat: H: ${itemData.hrepeat || '0'}'' V: ${itemData.vrepeat || '0'}''`);
  }
  
  if (itemData.front_content_text) {
    lines.push(`Content: ${itemData.front_content_text}`);
  }
  
  if (itemData.abrasion_text) {
    lines.push(`Abrasion: ${itemData.abrasion_text}`);
  }
  
  if (itemData.firecodes_text) {
    lines.push(`Fire Rating: ${itemData.firecodes_text}`);
  }
  
  // Add pricing from pricingData
  const cutPrice = pricingData.p_res_cut ? `$${pricingData.p_res_cut}/Y` : 'NULL/Y';
  lines.push(`Cut Price: ${cutPrice}`);
  
  const rollPrice = pricingData.p_hosp_roll ? `$${pricingData.p_hosp_roll}/Y` : 'NULL/Y';
  lines.push(`Roll Price: ${rollPrice}`);
  
  return lines.join('<br>');
}
```

---

### **Function: composeSalesDescription(itemData, originData)**

**Input:**
- itemData: Complete OPMS item data
- originData: Product origin information

**Output:** Multi-line string with `<br>` tags

**Pseudocode:**
```javascript
function composeSalesDescription(itemData, originData) {
  const lines = [];
  
  // Start with item number
  lines.push(`#${itemData.item_code}`);
  
  lines.push(`Pattern: ${itemData.product_name}`);
  lines.push(`Color: ${itemData.color_names}`);
  
  if (itemData.width) {
    lines.push(`Width: ${itemData.width}''`);
  }
  
  if (itemData.hrepeat || itemData.vrepeat) {
    lines.push(`Repeat: H: ${itemData.hrepeat || '0'}'' V: ${itemData.vrepeat || '0'}''`);
  }
  
  if (itemData.front_content_text) {
    lines.push(`Content: ${itemData.front_content_text}`);
  }
  
  if (itemData.abrasion_text) {
    lines.push(`Abrasion: ${itemData.abrasion_text}`);
  }
  
  if (itemData.firecodes_text) {
    lines.push(`Fire Rating: ${itemData.firecodes_text}`);
  }
  
  // Add country of origin
  const origin = originData || 'Not Specified';
  lines.push(`Country of Origin: ${origin}`);
  
  return lines.join('<br>');
}
```

---

## 🔄 **INTEGRATION POINTS**

### **OpmsDataTransformService.js**

**Location to Add:** After pricing data extraction (line ~35)

```javascript
// Step 1b: Extract pricing data from OPMS (for NetSuite cascade sync)
const pricingData = await this.extractPricingData(opmsData.product_id, opmsData.product_type || 'R');
opmsData.pricing = pricingData;

// Step 1c: Extract origin data for sales description
const originData = await this.extractOriginData(opmsData.product_id);
opmsData.origin = originData;

// Step 1d: Compose purchase and sales descriptions
opmsData.purchaseDescription = this.composePurchaseDescription(opmsData, pricingData);
opmsData.salesDescription = this.composeSalesDescription(opmsData, originData);
```

**Methods to Add:**
1. `extractOriginData(productId)` - Query T_PRODUCT_ORIGIN
2. `composePurchaseDescription(itemData, pricingData)` - Format purchase desc
3. `composeSalesDescription(itemData, originData)` - Format sales desc

---

### **buildNetSuitePayload() Addition**

**Location:** After pricing fields (line ~487)

```javascript
// ============================================================================
// SALES AND PURCHASE DESCRIPTIONS (from OPMS product data)
// One-way sync: OPMS → NetSuite (does not cascade from pricing updates)
// ============================================================================
purchasedescription: validatedData.purchaseDescription || null,
salesdescription: validatedData.salesDescription || null,
```

---

### **netsuiteRestletService.js - transformToRestletPayload()**

**Location:** After existing description fields

```javascript
if (itemData.purchasedescription) {
  payload.purchasedescription = itemData.purchasedescription;
}

if (itemData.salesdescription) {
  payload.salesdescription = itemData.salesdescription;
}
```

---

### **RESTletUpsertInventoryItem-PROD.js**

**Location:** After other field processing

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

---

## 🧪 **TESTING SPECIFICATION**

### **Test Product**

**Product:** AAA TEST PKL02 (OPMS Product ID: 7799)

**Test Items:**
- 3940-1765 (Battered Blue)
- 4281-4920 (Maple Syrup)

**Expected Results:**

**Purchase Description for 3940-1765:**
```
Pattern: AAA TEST PKL02
Color: Battered Blue
Width: 50''
Repeat: H: 25'' V: 25''
Content: {from T_PRODUCT_FRONTCONTENT}
Abrasion: {from T_PRODUCT_ABRASION}
Fire Rating: {from T_PRODUCT_FIRECODES}
Cut Price: $104.44/Y
Roll Price: $94.44/Y
```

**Sales Description for 3940-1765:**
```
#3940-1765
Pattern: AAA TEST PKL02
Color: Battered Blue
Width: 50''
Repeat: H: 25'' V: 25''
Content: {from T_PRODUCT_FRONTCONTENT}
Abrasion: {from T_PRODUCT_ABRASION}
Fire Rating: {from T_PRODUCT_FIRECODES}
Country of Origin: {from T_PRODUCT_ORIGIN}
```

### **Validation Checklist**

- [ ] Purchase description populated in NetSuite
- [ ] Sales description populated in NetSuite
- [ ] Multi-line format renders correctly (each line on own line)
- [ ] Pricing included in purchase desc, excluded from sales desc
- [ ] Item number prefixed with # in sales desc
- [ ] Country of origin in sales desc only
- [ ] HTML `<br>` tags render as line breaks in NetSuite UI
- [ ] Fields update on subsequent syncs
- [ ] No bidirectional sync (NetSuite changes don't sync back)

---

## ⚠️ **CRITICAL REQUIREMENTS**

### **Data Handling Rules**

1. **Missing Data Handling:**
   - If content is empty: Show "Content: Not Specified"
   - If abrasion is empty: Show "Abrasion: Not Tested"
   - If fire codes empty: Show "Fire Rating: Not Certified"
   - If origin is empty: Show "Country of Origin: Not Specified"

2. **Pricing Display:**
   - NULL prices display as "NULL/Y" not "$0.00/Y"
   - Non-null prices format as "$XX.XX/Y"
   - Always show "/Y" suffix (per yard pricing)

3. **Line Break Format:**
   - Use `<br>` HTML tags for NetSuite compatibility
   - Do NOT use `\n` or `\r\n` (won't render in NetSuite)
   - Each data point on its own line

4. **Character Limits:**
   - NetSuite textarea fields support 4000 characters
   - Typical description: 300-500 characters
   - No truncation needed for normal data

---

## 🚫 **WHAT NOT TO DO**

### **Do NOT Sync Descriptions Back from NetSuite**

**Why:** These are **derived fields** - they should always reflect current OPMS data, not be edited in NetSuite.

**If user manually edits in NetSuite:** Next OPMS sync will overwrite with OPMS-generated content.

### **Do NOT Include in Pricing Cascade**

**Why:** Purchase/Sales descriptions are **product-level information**, not pricing-level.

**Correct Behavior:**
- ✅ Descriptions update on product/item sync
- ❌ Descriptions do NOT update on pricing cascade
- Pricing cascade only updates: price_1_, price_1_5, custitem_f3_rollprice

### **Do NOT Mix Purchase and Sales Content**

**Purchase Description:**
- ✅ Includes: Cut Price, Roll Price
- ❌ Excludes: Item Number, Country of Origin

**Sales Description:**
- ✅ Includes: Item Number (#), Country of Origin
- ❌ Excludes: Cut Price, Roll Price

---

## 📊 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Data Extraction (OpmsDataTransformService.js)**

- [ ] Add `extractOriginData(productId)` method
- [ ] Query T_PRODUCT_ORIGIN + P_ORIGIN
- [ ] Return origin name or null
- [ ] Call during transformItemForNetSuite()

### **Phase 2: Composition (OpmsDataTransformService.js)**

- [ ] Add `composePurchaseDescription(itemData, pricingData)` method
- [ ] Add `composeSalesDescription(itemData, originData)` method
- [ ] Use existing mini-forms data (front_content_text, abrasion_text, firecodes_text)
- [ ] Format with `<br>` tags
- [ ] Handle missing data gracefully

### **Phase 3: Payload Integration**

- [ ] Add purchasedescription to buildNetSuitePayload()
- [ ] Add salesdescription to buildNetSuitePayload()
- [ ] Add to transformToRestletPayload() field mapping
- [ ] Verify fields survive cleanPayload()

### **Phase 4: RESTlet Updates**

- [ ] Add purchasedescription field handling in RESTlet
- [ ] Add salesdescription field handling in RESTlet
- [ ] Add to field read-back section
- [ ] Test field updates successfully

### **Phase 5: Testing**

- [ ] Test with Product 7799 (AAA TEST PKL02)
- [ ] Verify Item 3940-1765 descriptions
- [ ] Verify Item 4281-4920 descriptions
- [ ] Check line breaks render correctly
- [ ] Confirm pricing in purchase desc only
- [ ] Confirm origin in sales desc only

---

## 🔍 **VERIFICATION QUERIES**

### **Check OPMS Data Availability**

```sql
-- Verify Product 7799 has all required data
SELECT 
  p.id,
  p.name,
  p.width,
  p.hrepeat,
  p.vrepeat,
  (SELECT COUNT(*) FROM T_PRODUCT_CONTENT_FRONT WHERE product_id = p.id) as content_count,
  (SELECT COUNT(*) FROM T_PRODUCT_ABRASION WHERE product_id = p.id AND visible = 'Y') as abrasion_count,
  (SELECT COUNT(*) FROM T_PRODUCT_FIRECODE WHERE product_id = p.id AND visible = 'Y') as firecode_count,
  (SELECT COUNT(*) FROM T_PRODUCT_ORIGIN WHERE product_id = p.id) as origin_count
FROM T_PRODUCT p
WHERE p.id = 7799;
```

### **Check NetSuite After Sync**

```javascript
// In NetSuite, verify fields are populated
const item = record.load({ type: 'lotnumberedinventoryitem', id: 11610 });
const purchaseDesc = item.getValue('purchasedescription');
const salesDesc = item.getValue('salesdescription');

console.log('Purchase Description:', purchaseDesc);
console.log('Sales Description:', salesDesc);
```

---

## 📚 **EXAMPLE OUTPUTS**

### **Product: ACDC (ID 2823) - Item 6148-4501**

**Purchase Description:**
```html
Pattern: ACDC<br>Color: Teal<br>Width: 54''<br>Repeat: H: 27.5'' V: 26''<br>Content: Viscose: 57.00%, Polyester: 35.00%, Cotton: 8.00%<br>Abrasion: Double Rubs (Wyzenbeek): 50000 rubs (Unknown)<br>Fire Rating: CAL TB 117-2013, NFPA 260, UFAC Class I<br>Cut Price: NULL/Y<br>Roll Price: $21.95/Y
```

**Sales Description:**
```html
#6148-4501<br>Pattern: ACDC<br>Color: Teal<br>Width: 54''<br>Repeat: H: 27.5'' V: 26''<br>Content: Viscose: 57.00%, Polyester: 35.00%, Cotton: 8.00%<br>Abrasion: Double Rubs (Wyzenbeek): 50000 rubs (Unknown)<br>Fire Rating: CAL TB 117-2013, NFPA 260, UFAC Class I<br>Country of Origin: India
```

---

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements**

✅ Purchase description auto-generates from OPMS data  
✅ Sales description auto-generates from OPMS data  
✅ Both descriptions update on every OPMS→NetSuite sync  
✅ Pricing included in purchase desc only  
✅ Item number and origin in sales desc only  
✅ Line breaks render correctly in NetSuite UI  
✅ Missing data handled gracefully with defaults  

### **Technical Requirements**

✅ No new database queries beyond origin extraction  
✅ Reuse existing mini-forms data  
✅ Reuse existing pricing data  
✅ No performance impact (single origin query added)  
✅ One-way sync only (no bidirectional)  
✅ Does not participate in pricing cascade  

### **Business Requirements**

✅ Consistent formatting across all items  
✅ Complete product information available  
✅ Sales team has customer-facing description  
✅ Purchasing team has pricing information  
✅ Automatic updates eliminate manual entry  

---

## 📌 **VERSION HISTORY**

### **v1.0 - Initial Specification**
- **Date:** October 25, 2025
- **Status:** ✅ Implemented
- **Feature Branch:** feature/sales-purchase-descriptions
- **Target Release:** v1.8.0
- **Implementation Date:** October 25, 2025

### **Implementation Summary**
- **OpmsDataTransformService.js:** Added extractOriginData(), composePurchaseDescription(), and composeSalesDescription() methods
- **NetSuiteRestletService.js:** Added purchasedescription and salesdescription field mapping in transformToRestletPayload()
- **RESTletUpsertInventoryItem-PROD.js:** Added field handling for both description fields with proper logging
- **Test Script:** Created test-sales-purchase-descriptions.js for validation
- **Status:** Ready for testing with Product 7799 items

---

## 🔗 **RELATED SPECIFICATIONS**

- OPMS Database Schema: `opms-database-spec.md`
- OPMS→NetSuite Sync: `opms-to-netsuite-synchronization-spec.md`
- Pricing Cascade: `NetSuite-Cascading-Item-Price-Changes-Technical.md`

---

**Document Status:** ✅ Ready for Implementation  
**AI Model Instructions:** Follow this specification exactly - compositions must match format examples

