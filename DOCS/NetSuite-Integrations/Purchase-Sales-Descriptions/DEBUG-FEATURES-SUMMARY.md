# 🔍 Debug Features Summary - Complete Visibility

## Overview

The Sales & Purchase Descriptions feature now includes **extensive debug output** at every level to give you complete visibility into what's happening.

---

## 📊 API Debug Output (Node.js)

### **OpmsDataTransformService.js**

#### **Origin Extraction**
```javascript
logger.info('🌍 Origin data extracted from OPMS', {
    itemId: 43992,
    productId: 7756,
    origin: 'India' // or null if not found
});
```

#### **Purchase Description Composition**
```javascript
logger.debug('🛠️  Composing Purchase Description', {
    itemId: 43992,
    itemCode: 'opmsAPI01',
    productName: 'opmsAPI-SYNC-TEST-PRODUCT',
    hasPricing: true
});

// Then for each field:
logger.debug('  ✓ Added Pattern:', 'opmsAPI-SYNC-TEST-PRODUCT');
logger.debug('  ✓ Added Color:', 'Snow');
logger.debug('  ✓ Added Width:', '54.00\'\'');
logger.debug('  ✓ Added Repeat:', 'H: 0.00\'\' V: 0.00\'\'');
logger.debug('  ✓ Added Cut Price:', '$100.00/Y', '(raw: 100.00)');
logger.debug('  ✓ Added Roll Price:', '$150.00/Y', '(raw: 150.00)');

// Final summary:
logger.info('✅ Purchase Description Complete', {
    lineCount: 6,
    totalLength: 147,
    preview: 'Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>Color: Snow...'
});
```

#### **Sales Description Composition**
```javascript
logger.debug('🛠️  Composing Sales Description', {
    itemId: 43992,
    itemCode: 'opmsAPI01',
    productName: 'opmsAPI-SYNC-TEST-PRODUCT',
    hasOrigin: false
});

// Then for each field:
logger.debug('  ✓ Added Item Number:', '#opmsAPI01');
logger.debug('  ✓ Added Pattern:', 'opmsAPI-SYNC-TEST-PRODUCT');
logger.debug('  ✓ Added Color:', 'Snow');
logger.debug('  ✓ Added Country of Origin:', 'Not Specified');

// Final summary:
logger.info('✅ Sales Description Complete', {
    lineCount: 6,
    totalLength: 148,
    preview: '#opmsAPI01<br>Pattern: opmsAPI-SYNC-TEST-PRODUCT...'
});
```

#### **Payload Summary**
```javascript
logger.info('📝 Descriptions composed', {
    itemId: 43992,
    purchaseDescLength: 147,
    salesDescLength: 148
});
```

---

## 🖥️ NetSuite RESTlet Debug Output

### **Setting Purchase Description**

```javascript
log.debug('═════════════════════════════════════════════════════════');
log.debug('📝 PURCHASE DESCRIPTION - Setting Field');
log.debug('═════════════════════════════════════════════════════════');
log.debug('Field ID: purchasedescription');
log.debug('Field Type (NetSuite): textarea');
log.debug('Value Type (JavaScript): string');
log.debug('Character Count: 147');
log.debug('Contains <br> tags: YES');
log.debug('Line Count (estimated): 6');
log.debug('Content Preview: Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>Color: Snow...');
log.debug('First 3 Lines:');
log.debug('  1. Pattern: opmsAPI-SYNC-TEST-PRODUCT');
log.debug('  2. Color: Snow');
log.debug('  3. Width: 54.00\'\'');
log.debug('⏳ Attempting to set field...');
log.debug('✅ Purchase description set successfully');
log.debug('═════════════════════════════════════════════════════════');
```

### **Setting Sales Description**

```javascript
log.debug('═════════════════════════════════════════════════════════');
log.debug('📝 SALES DESCRIPTION - Setting Field');
log.debug('═════════════════════════════════════════════════════════');
log.debug('Field ID: salesdescription');
log.debug('Field Type (NetSuite): textarea');
log.debug('Value Type (JavaScript): string');
log.debug('Character Count: 148');
log.debug('Contains <br> tags: YES');
log.debug('Line Count (estimated): 6');
log.debug('Content Preview: #opmsAPI01<br>Pattern: opmsAPI-SYNC-TEST-PRODUCT...');
log.debug('First 3 Lines:');
log.debug('  1. #opmsAPI01');
log.debug('  2. Pattern: opmsAPI-SYNC-TEST-PRODUCT');
log.debug('  3. Color: Snow');
log.debug('⏳ Attempting to set field...');
log.debug('✅ Sales description set successfully');
log.debug('═════════════════════════════════════════════════════════');
```

### **Read-Back Verification**

```javascript
log.debug('');
log.debug('🔍 VERIFYING DESCRIPTIONS WERE SAVED TO NETSUITE');
log.debug('═════════════════════════════════════════════════════════');

// Purchase Description
log.debug('✅ PURCHASE DESCRIPTION READ-BACK SUCCESS');
log.debug('  Character Count: 147');
log.debug('  Line Count: 6');
log.debug('  Contains <br> tags: YES');
log.debug('  Contains Pricing: YES ✓');
log.debug('  Preview: Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>Color: Snow...');
log.debug('  First Line: Pattern: opmsAPI-SYNC-TEST-PRODUCT');
log.debug('  Last Line: Roll Price: $150.00/Y');

log.debug('─────────────────────────────────────────────────────────');

// Sales Description
log.debug('✅ SALES DESCRIPTION READ-BACK SUCCESS');
log.debug('  Character Count: 148');
log.debug('  Line Count: 6');
log.debug('  Contains <br> tags: YES');
log.debug('  Starts with #: YES ✓');
log.debug('  Contains Pricing: NO ✓');
log.debug('  Contains Origin: YES ✓');
log.debug('  Preview: #opmsAPI01<br>Pattern: opmsAPI-SYNC-TEST-PRODUCT...');
log.debug('  First Line: #opmsAPI01');
log.debug('  Last Line: Country of Origin: Not Specified');

log.debug('═════════════════════════════════════════════════════════');
```

---

## 🎯 What Each Debug Level Shows

### **API Level (Node.js)**

**What you'll see:**
1. **Origin extraction** - What origin was found or defaulted
2. **Field-by-field composition** - Each line being added with ✓ checkmarks
3. **Raw values** - Shows both formatted ("$100.00/Y") and raw (100.00) pricing
4. **Warnings** - If required fields are missing
5. **Info messages** - If optional fields are missing (not errors)
6. **Final summaries** - Character counts, line counts, previews

**Purpose:** Verify the API is composing descriptions correctly before sending to NetSuite

---

### **RESTlet Level (NetSuite)**

**What you'll see:**
1. **Field metadata** - Type, ID, expected format
2. **Value analysis** - Type checking, length, content validation
3. **Content preview** - First 100 chars and first 3 lines
4. **Set operation** - Success or detailed error
5. **Read-back verification** - Confirms field was actually saved
6. **Content validation** - Checks for pricing, item number, origin in correct fields
7. **Detailed errors** - 5 possible causes listed for any failures

**Purpose:** Verify NetSuite is receiving and saving descriptions correctly

---

## 🔍 Debug Output Comparison

### **Before Enhancement (Old RESTlet)**

```
// Setting colors...
Set field purchasedescription = Colors: Snow (ID: 123)
```

**Issues:**
- ❌ No field type information
- ❌ No content validation
- ❌ No read-back verification
- ❌ Overwrites descriptions with color info
- ❌ No error diagnostics

---

### **After Enhancement (New RESTlet)**

```
═════════════════════════════════════════════════════════
📝 PURCHASE DESCRIPTION - Setting Field
═════════════════════════════════════════════════════════
Field ID: purchasedescription
Field Type (NetSuite): textarea
Value Type (JavaScript): string
Character Count: 147
Contains <br> tags: YES
Line Count (estimated): 6
Content Preview: Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>...
First 3 Lines:
  1. Pattern: opmsAPI-SYNC-TEST-PRODUCT
  2. Color: Snow
  3. Width: 54.00''
⏳ Attempting to set field...
✅ Purchase description set successfully
═════════════════════════════════════════════════════════

[... later ...]

🔍 VERIFYING DESCRIPTIONS WERE SAVED TO NETSUITE
═════════════════════════════════════════════════════════
✅ PURCHASE DESCRIPTION READ-BACK SUCCESS
  Character Count: 147
  Line Count: 6
  Contains <br> tags: YES
  Contains Pricing: YES ✓
  First Line: Pattern: opmsAPI-SYNC-TEST-PRODUCT
  Last Line: Roll Price: $150.00/Y
═════════════════════════════════════════════════════════
```

**Advantages:**
- ✅ Complete field metadata
- ✅ Content validation (pricing, line breaks, item number)
- ✅ Read-back verification
- ✅ Detailed error diagnostics with 5 possible causes
- ✅ Visual separators for easy reading
- ✅ Success indicators (✓, ✅)

---

## 🎨 Visual Debug Indicators

### **Symbols Used**

| Symbol | Meaning | Where Used |
|--------|---------|------------|
| ═ | Section separator (major) | Around section headers |
| ─ | Section separator (minor) | Between subsections |
| 📝 | Setting field | Field write operations |
| 🔍 | Verifying | Read-back operations |
| ✅ | Success | Operation completed |
| ❌ | Error | Operation failed |
| ⚠️ | Warning | Potential issue |
| ℹ️ | Info | Informational |
| ⏳ | Processing | Operation in progress |
| ✓ | Check passed | Validation success |
| ✗ | Check failed | Validation failure |

---

## 🧪 Testing the Debug Output

### **Test Command:**
```bash
node scripts/test-sales-purchase-descriptions.js 43992
```

### **What You'll See:**

1. **Test Header** - Suite name and mode
2. **Item Info** - What's being tested
3. **API Composition** - Step-by-step field additions
4. **Formatted Output** - Visual line-by-line display
5. **Raw HTML** - Actual payload
6. **Verification Checklist** - Automated checks
7. **Complete Payload** - Full data being sent

**Total Output:** ~100-150 lines of detailed information

---

## 📋 Troubleshooting With Debug Output

### **Scenario 1: Descriptions Not Generated**

**Look For:**
```
⚠️  Missing product_name
⚠️  Missing color_name
```

**Diagnosis:** Required OPMS data is missing

**Solution:** Check item data in OPMS database

---

### **Scenario 2: Pricing Missing from Purchase Description**

**Look For:**
```
⚠️  No pricing data available
```

**Diagnosis:** T_PRODUCT_PRICE has no data for this product

**Solution:** Check pricing data exists in OPMS

---

### **Scenario 3: NetSuite Field Not Set**

**Look For:**
```
❌ PURCHASE DESCRIPTION ERROR
Error Message: Invalid Field Value
POSSIBLE CAUSES:
  1. Field does not exist in NetSuite
```

**Diagnosis:** NetSuite field doesn't exist or has wrong type

**Solution:** Verify field exists in NetSuite, check permissions

---

### **Scenario 4: Read-Back Shows Empty**

**Look For:**
```
⚠️  PURCHASE DESCRIPTION IS EMPTY AFTER SAVE
  This might indicate:
    - Field was not set properly
```

**Diagnosis:** Field didn't save despite no error

**Solution:** Check NetSuite field permissions, verify field type

---

### **Scenario 5: Wrong Content in Description**

**Look For:**
```
Contains Pricing: NO ✗  (in purchase description read-back)
```

**Diagnosis:** Purchase description doesn't have pricing (it should!)

**Solution:** Check if descriptions got swapped, verify API composition

---

## 🎯 Success Pattern

When everything works correctly, you'll see this pattern:

### **API Side:**
```
✓ Added Pattern
✓ Added Color
✓ Added Width
✓ Added Repeat
✓ Added Cut Price: $100.00/Y (raw: 100.00)
✓ Added Roll Price: $150.00/Y (raw: 150.00)
✅ Purchase Description Complete (147 chars, 6 lines)
```

### **NetSuite Side:**
```
📝 PURCHASE DESCRIPTION - Setting Field
Character Count: 147
Contains <br> tags: YES
✅ Purchase description set successfully

🔍 VERIFYING DESCRIPTIONS WERE SAVED TO NETSUITE
✅ PURCHASE DESCRIPTION READ-BACK SUCCESS
  Contains Pricing: YES ✓
  First Line: Pattern: opmsAPI-SYNC-TEST-PRODUCT
  Last Line: Roll Price: $150.00/Y
```

**Result:** Lots of ✅ and ✓ symbols = Success!

---

## 📝 Debug Output Features

### **API Features:**

1. ✅ **Field-by-field logging** - See each line being added
2. ✅ **Raw vs formatted values** - See both `$100.00/Y` and `100.00`
3. ✅ **Missing data warnings** - Know when optional fields are missing
4. ✅ **Character counts** - Verify within limits
5. ✅ **Previews** - See first 100 chars
6. ✅ **Validation status** - Know if data is good or "src empty data"

### **RESTlet Features:**

1. ✅ **Field type validation** - Verify field type matches expectations
2. ✅ **Content analysis** - Count lines, check for `<br>` tags
3. ✅ **Preview display** - See first 100 chars and first 3 lines
4. ✅ **Set operation status** - Know if field was set successfully
5. ✅ **Read-back verification** - Confirm field was actually saved
6. ✅ **Content validation** - Verify pricing/origin in correct fields
7. ✅ **Detailed error diagnostics** - 5 possible causes listed for errors
8. ✅ **Visual separators** - Easy to scan logs

---

## 🔬 Diagnostic Capabilities

With this debug output, you can instantly diagnose:

| Issue | How to Detect | Where to Look |
|-------|---------------|---------------|
| Missing OPMS data | `⚠️  Missing product_name` | API logs |
| Empty fields | `ℹ️  No width data` | API logs |
| Pricing issues | `(raw: null)` or `⚠️  No pricing data` | API logs |
| Field type mismatch | `Value Type (JavaScript): object` (should be string) | NetSuite logs |
| Character limit | `Character Count: 5000` (exceeds 4000) | NetSuite logs |
| Missing `<br>` tags | `Contains <br> tags: NO` | NetSuite logs |
| Field not saved | `⚠️  PURCHASE DESCRIPTION IS EMPTY AFTER SAVE` | NetSuite logs |
| Permissions | `❌ PURCHASE DESCRIPTION ERROR` + `INSUFFICIENT_PERMISSION` | NetSuite logs |
| Wrong content | `Contains Pricing: NO ✗` (should be YES) | NetSuite logs |
| Swapped descriptions | `Starts with #: NO ✗` (in sales desc) | NetSuite logs |

---

## 💡 Pro Tips for Using Debug Output

### **Tip 1: Filter by Symbol**
Use grep to find specific types of messages:
```bash
# See only successes
node scripts/test-sales-purchase-descriptions.js 43992 2>&1 | grep "✅"

# See only errors/warnings
node scripts/test-sales-purchase-descriptions.js 43992 2>&1 | grep -E "(❌|⚠️)"

# See field additions
node scripts/test-sales-purchase-descriptions.js 43992 2>&1 | grep "✓ Added"
```

### **Tip 2: Watch for Checkmarks**
- Lots of ✓ symbols = Data being added successfully
- Lots of ✅ symbols = Operations completing successfully
- Any ❌ symbols = Need investigation

### **Tip 3: Compare Before and After**
- Character count when setting should match character count in read-back
- Line count should match between sections
- Content preview should be consistent

### **Tip 4: Check the Checklist**
The verification checklist at the end runs automated validation:
```
✅ Pricing in purchase desc
✅ No pricing in sales desc
✅ Item code in sales desc
✅ Origin in sales desc
```

### **Tip 5: Use NetSuite Log Filters**
In NetSuite Script Execution Log:
- Filter by "DEBUG" to see detailed steps
- Filter by "AUDIT" to see warnings
- Filter by "ERROR" to see failures only

---

## 🎯 Complete Debugging Flow

```
User runs test script
        ↓
API: Starting data transformation for item 43992
        ↓
API: 🌍 Origin data extracted (origin: India)
        ↓
API: 🛠️  Composing Purchase Description
        ↓
API:   ✓ Added Pattern: Product Name
API:   ✓ Added Color: Color Name
API:   ✓ Added Cut Price: $100.00/Y (raw: 100.00)
        ↓
API: ✅ Purchase Description Complete (147 chars, 6 lines)
        ↓
API: 🛠️  Composing Sales Description
        ↓
API:   ✓ Added Item Number: #12345-6789
API:   ✓ Added Country of Origin: India
        ↓
API: ✅ Sales Description Complete (148 chars, 6 lines)
        ↓
API: 📝 Descriptions composed
        ↓
API sends to NetSuite
        ↓
RESTlet: 📝 PURCHASE DESCRIPTION - Setting Field
RESTlet: Field ID: purchasedescription
RESTlet: Value Type: string
RESTlet: Character Count: 147
RESTlet: Contains <br> tags: YES
RESTlet: First 3 Lines: [shows lines]
RESTlet: ⏳ Attempting to set field...
        ↓
RESTlet: ✅ Purchase description set successfully
        ↓
RESTlet: 📝 SALES DESCRIPTION - Setting Field
RESTlet: [same detailed output]
        ↓
RESTlet: ✅ Sales description set successfully
        ↓
RESTlet saves record
        ↓
RESTlet: 🔍 VERIFYING DESCRIPTIONS WERE SAVED
        ↓
RESTlet: ✅ PURCHASE DESCRIPTION READ-BACK SUCCESS
RESTlet:   Contains Pricing: YES ✓
RESTlet:   First Line: Pattern: ...
RESTlet:   Last Line: Roll Price: $150.00/Y
        ↓
RESTlet: ✅ SALES DESCRIPTION READ-BACK SUCCESS
RESTlet:   Starts with #: YES ✓
RESTlet:   Contains Pricing: NO ✓
RESTlet:   Contains Origin: YES ✓
        ↓
SUCCESS!
```

---

## 📚 Related Documentation

- **README.md** - Start here
- **DEBUG-OUTPUT-EXAMPLE.md** - Full API output example
- **RESTLET-DEBUG-OUTPUT-GUIDE.md** - Full NetSuite output guide
- **SPECIFICATION.md** - Feature specification
- **IMPLEMENTATION-SUMMARY.md** - Code changes

---

**Summary:** You have complete visibility into every step of the process, from data extraction through NetSuite saving. Any issue can be quickly identified and diagnosed using the comprehensive debug output.

