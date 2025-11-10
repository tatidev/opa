# 🔍 Debug Output Reference - Sales/Purchase Descriptions

## What You'll See When Testing

This document shows exactly what debug output to expect when running the test script.

---

## 📊 Example Test Run Output

### Command:
```bash
node scripts/test-sales-purchase-descriptions.js 11610
```

### Expected Output:

```
🧪 Sales and Purchase Descriptions Test Suite
════════════════════════════════════════════════════════════════════════════════
Mode: DRY RUN (no actual NetSuite updates)
Use --live flag to perform actual sync
════════════════════════════════════════════════════════════════════════════════

🎯 Testing specific OPMS item ID: 11610

========================================
Testing Item: AAA TEST PKL02 - Unknown
OPMS Item ID: 11610
NetSuite Item ID: 11610
========================================

📊 Step 1: Transforming OPMS item data...

[DEBUG] Starting data transformation for item: 11610

[DEBUG] 🌍 Origin data extracted from OPMS
{
  itemId: 11610,
  productId: 7799,
  origin: 'India'
}

[DEBUG] 🛠️  Composing Purchase Description
{
  itemId: 11610,
  itemCode: '3940-1765',
  productName: 'AAA TEST PKL02',
  hasPricing: true
}

[DEBUG]   ✓ Added Pattern: AAA TEST PKL02
[DEBUG]   ✓ Added Color: Battered Blue
[DEBUG]   ✓ Added Width: 50''
[DEBUG]   ✓ Added Repeat: H: 25'' V: 25''
[DEBUG]   ✓ Added Content: 55% Cotton, 45% Polyester
[DEBUG]   ✓ Added Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)
[DEBUG]   ✓ Added Fire Rating: CAL TB 117-2013, NFPA 260
[DEBUG]   ✓ Added Cut Price: $104.44/Y (raw: 104.44)
[DEBUG]   ✓ Added Roll Price: $94.44/Y (raw: 94.44)

[INFO] ✅ Purchase Description Complete
{
  lineCount: 9,
  totalLength: 245,
  preview: 'Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br>Content: 55% ...'
}

[DEBUG] 🛠️  Composing Sales Description
{
  itemId: 11610,
  itemCode: '3940-1765',
  productName: 'AAA TEST PKL02',
  hasOrigin: true
}

[DEBUG]   ✓ Added Item Number: #3940-1765
[DEBUG]   ✓ Added Pattern: AAA TEST PKL02
[DEBUG]   ✓ Added Color: Battered Blue
[DEBUG]   ✓ Added Width: 50''
[DEBUG]   ✓ Added Repeat: H: 25'' V: 25''
[DEBUG]   ✓ Added Content: 55% Cotton, 45% Polyester
[DEBUG]   ✓ Added Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)
[DEBUG]   ✓ Added Fire Rating: CAL TB 117-2013, NFPA 260
[DEBUG]   ✓ Added Country of Origin: India

[INFO] ✅ Sales Description Complete
{
  lineCount: 9,
  totalLength: 268,
  preview: '#3940-1765<br>Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br...'
}

[INFO] 📝 Descriptions composed
{
  itemId: 11610,
  purchaseDescLength: 245,
  salesDescLength: 268
}

════════════════════════════════════════════════════════════════════════════════
📝 PURCHASE DESCRIPTION (Internal - With Pricing)
════════════════════════════════════════════════════════════════════════════════
 1. Pattern: AAA TEST PKL02
 2. Color: Battered Blue
 3. Width: 50''
 4. Repeat: H: 25'' V: 25''
 5. Content: 55% Cotton, 45% Polyester
 6. Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)
 7. Fire Rating: CAL TB 117-2013, NFPA 260
 8. Cut Price: $104.44/Y
 9. Roll Price: $94.44/Y
────────────────────────────────────────────────────────────────────────────────
✅ Generated successfully (245 chars, 9 lines)

🔍 RAW HTML (what NetSuite receives):
Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br>Content: 55% Cotton, 45% Polyester<br>Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)<br>Fire Rating: CAL TB 117-2013, NFPA 260<br>Cut Price: $104.44/Y<br>Roll Price: $94.44/Y

════════════════════════════════════════════════════════════════════════════════
📝 SALES DESCRIPTION (Customer-Facing - No Pricing)
════════════════════════════════════════════════════════════════════════════════
 1. #3940-1765
 2. Pattern: AAA TEST PKL02
 3. Color: Battered Blue
 4. Width: 50''
 5. Repeat: H: 25'' V: 25''
 6. Content: 55% Cotton, 45% Polyester
 7. Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)
 8. Fire Rating: CAL TB 117-2013, NFPA 260
 9. Country of Origin: India
────────────────────────────────────────────────────────────────────────────────
✅ Generated successfully (268 chars, 9 lines)

🔍 RAW HTML (what NetSuite receives):
#3940-1765<br>Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br>Content: 55% Cotton, 45% Polyester<br>Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)<br>Fire Rating: CAL TB 117-2013, NFPA 260<br>Country of Origin: India

🔍 Verification Checklist:
✅ Product name in descriptions
✅ Color in descriptions
✅ Pricing in purchase desc
✅ No pricing in sales desc
✅ Item code in sales desc
✅ Origin in sales desc
✅ Line breaks present

📦 Complete Payload:
{
  "itemId": "3940-1765",
  "displayname": "AAA TEST PKL02: Battered Blue",
  "purchasedescription": "Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br>Content: 55% Cotton, 45% Polyester<br>Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)<br>Fire Rating: CAL TB 117-2013, NFPA 260<br>Cut Price: $104.44/Y<br>Roll Price: $94.44/Y",
  "salesdescription": "#3940-1765<br>Pattern: AAA TEST PKL02<br>Color: Battered Blue<br>Width: 50''<br>Repeat: H: 25'' V: 25''<br>Content: 55% Cotton, 45% Polyester<br>Abrasion: Wyzenbeek: 50000 rubs (Heavy Duty)<br>Fire Rating: CAL TB 117-2013, NFPA 260<br>Country of Origin: India",
  "price_1_": 104.44,
  "price_1_5": 94.44
}

🚀 Testing NetSuite Sync...
✅ Dry run successful - payload would be sent to NetSuite

════════════════════════════════════════════════════════════════════════════════
✅ Test suite completed
════════════════════════════════════════════════════════════════════════════════
```

---

## 🎨 Visual Breakdown of Debug Symbols

### Status Indicators:
- ✅ **Success** - Operation completed successfully
- ✓ **Added** - Field added to description
- ⚠️ **Warning** - Missing optional data
- ❌ **Error** - Critical failure
- ℹ️ **Info** - Informational message (not a problem)

### Section Headers:
- 🧪 **Test Suite** - Overall test run
- 📊 **Step** - Test step number
- 🛠️ **Composing** - Building description
- 📝 **Description Output** - Final formatted result
- 🔍 **Verification** - Validation checks
- 🚀 **Sync** - NetSuite communication

### Debug Levels:
- `[INFO]` - Important status messages
- `[DEBUG]` - Detailed debugging information
- `[WARN]` - Non-critical warnings
- `[ERROR]` - Critical errors

---

## 📋 What to Look For

### ✅ Good Signs:
1. All "Added" lines show ✓ checkmarks
2. Purchase description includes "Cut Price" and "Roll Price"
3. Sales description includes "#" item number
4. Both descriptions show expected product and color
5. Character counts seem reasonable (200-300 chars)
6. Raw HTML shows `<br>` tags between lines
7. All verification checks show ✅

### ⚠️ Warning Signs (May Be OK):
1. "ℹ️ No width data" - Some products don't have dimensions
2. "ℹ️ No repeat data" - Non-repeating fabrics
3. "ℹ️ No front content data" - Missing fabric composition
4. "ℹ️ No abrasion data" - No test results on file
5. "ℹ️ No firecode data" - No certifications on file

### ❌ Error Signs (Need Investigation):
1. "❌ Purchase description is empty or null"
2. "❌ Sales description is empty or null"
3. "⚠️ Missing product_name" - Required field!
4. "⚠️ Missing color_name" - Required field!
5. "⚠️ Missing item_code" - Required field!
6. Verification checks showing ❌
7. "query_failed" in validation status

---

## 🔬 Deep Debugging

To see even MORE detail, set the log level to DEBUG:

```bash
LOG_LEVEL=debug node scripts/test-sales-purchase-descriptions.js <itemId>
```

This will show:
- Every database query
- Every field value being processed
- Every decision point in the code
- Raw database results
- Payload transformation steps

---

## 📊 Comparison: With vs Without Data

### Item WITH Complete Data:
```
[DEBUG]   ✓ Added Pattern: AAA TEST PKL02
[DEBUG]   ✓ Added Color: Battered Blue
[DEBUG]   ✓ Added Width: 50''
[DEBUG]   ✓ Added Repeat: H: 25'' V: 25''
[DEBUG]   ✓ Added Content: 55% Cotton, 45% Polyester
[DEBUG]   ✓ Added Abrasion: Wyzenbeek: 50000 rubs
[DEBUG]   ✓ Added Fire Rating: CAL TB 117-2013
[DEBUG]   ✓ Added Cut Price: $104.44/Y
[DEBUG]   ✓ Added Roll Price: $94.44/Y
```

### Item WITH Sparse Data:
```
[DEBUG]   ✓ Added Pattern: Simple Fabric
[DEBUG]   ✓ Added Color: White
[DEBUG]   ℹ️  No width data
[DEBUG]   ℹ️  No repeat data
[DEBUG]   ℹ️  No front content data
[DEBUG]   ℹ️  No abrasion data
[DEBUG]   ℹ️  No firecode data
[DEBUG]   ✓ Added Cut Price: NULL/Y
[DEBUG]   ✓ Added Roll Price: $25.00/Y
```

**Result:** Still generates a valid description, just shorter!

---

## 🚨 Common Issues and Solutions

### Issue: "Missing product_name"
**Cause:** Database query didn't return product name
**Fix:** Check T_PRODUCT table has valid data for this item

### Issue: Descriptions are empty
**Cause:** Item might be archived or invalid
**Fix:** Check item status in OPMS database

### Issue: Pricing shows "NULL/Y"
**Cause:** No pricing data in T_PRODUCT_PRICE
**Fix:** This is OK - it means no price is set yet

### Issue: Origin shows "Not Specified"
**Cause:** No data in T_PRODUCT_ORIGIN
**Fix:** This is OK - will just show generic message

---

## 💡 Next Steps After Seeing Good Output

1. ✅ If output looks good → Deploy RESTlet to NetSuite
2. ✅ Then run with `--live` flag to actually sync
3. ✅ Check NetSuite item to verify fields are populated
4. ✅ Verify `<br>` tags render as line breaks in NetSuite UI

---

**Quick Reference:** Good debug output should show lots of ✓ checkmarks and green ✅ symbols. Any ❌ symbols need investigation!

