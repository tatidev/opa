# 🧪 Testing Quick Start - Sales & Purchase Descriptions

## ⚠️ BEFORE YOU START

**SAVE THIS FILE:** `src/services/netsuiteRestletService.js`

The file has unsaved edits in your editor that add the description field mappings.

---

## 🚀 Quick Test Commands

### **1. Dry Run (Safe - No NetSuite Updates)**
```bash
node scripts/test-sales-purchase-descriptions.js 43992
```

**What it does:**
- ✅ Generates descriptions from OPMS
- ✅ Shows formatted output
- ✅ Validates composition
- ❌ Does NOT update NetSuite

**Use when:** You want to see what WOULD be generated without touching NetSuite

---

### **2. Live Sync (Updates NetSuite)**
```bash
node scripts/test-sales-purchase-descriptions.js 43992 --live
```

**What it does:**
- ✅ Generates descriptions
- ✅ Sends to NetSuite
- ✅ Updates item 23401
- ✅ Shows full debug output

**Use when:** You're ready to actually update NetSuite

---

## ✅ Success Indicators

### **In API Output:**
```
✅ Purchase Description Complete (147 chars, 6 lines)
✅ Sales Description Complete (148 chars, 6 lines)
📝 Added purchasedescription to payload { length: 147 }
📝 Added salesdescription to payload { length: 148 }
✅ NetSuite sync successful
```

### **In NetSuite Logs:**
```
📝 PURCHASE DESCRIPTION - Setting Field
Character Count: 147
✅ Purchase description set successfully

✅ PURCHASE DESCRIPTION READ-BACK SUCCESS
  Contains Pricing: YES ✓
```

### **In NetSuite UI:**
- Purchase Description field shows multi-line text with pricing
- Sales Description field shows multi-line text with item code
- Line breaks render correctly (not as `<br>`)

---

## ❌ Troubleshooting

### **Problem: "purchasedescription NOT in itemData"**
**Cause:** File not saved  
**Fix:** Save `src/services/netsuiteRestletService.js` and run again

### **Problem: Descriptions not in payload**
**Cause:** File not saved or Node.js cached old version  
**Fix:** Save file, then run: `node --no-cache scripts/test-sales-purchase-descriptions.js 43992`

### **Problem: "Purchase Description: Not set" in API output**
**Cause:** RESTlet didn't return the values (might be OK - check NetSuite directly)  
**Fix:** Check NetSuite execution logs and UI

---

## 📊 What Each Test Item Shows

### **Test Item: 43992 (opmsAPI01)**
- **Product:** opmsAPI-SYNC-TEST-PRODUCT
- **Color:** Snow
- **Has Pricing:** YES ($100.00 cut, $150.00 roll)
- **Has Origin:** NO (defaults to "Not Specified")
- **Has Content/Abrasion/Firecodes:** NO (will test simpler description)

**Good for testing:**
- ✅ Basic description generation
- ✅ Pricing display ($XX.XX/Y format)
- ✅ Missing data handling (origin, content)
- ✅ NULL data handling

---

## 🎯 Testing Checklist

Run through these in order:

- [ ] **Step 1:** Save `src/services/netsuiteRestletService.js`
- [ ] **Step 2:** Run dry run test
  ```bash
  node scripts/test-sales-purchase-descriptions.js 43992
  ```
- [ ] **Step 3:** Verify descriptions look correct in output
- [ ] **Step 4:** Run live sync
  ```bash
  node scripts/test-sales-purchase-descriptions.js 43992 --live
  ```
- [ ] **Step 5:** Check for "Added purchasedescription to payload" in output
- [ ] **Step 6:** Check NetSuite execution logs (see debug output)
- [ ] **Step 7:** Open NetSuite item 23401 and verify fields
- [ ] **Step 8:** Confirm `<br>` tags render as line breaks

---

## 📝 Expected Test Results

### **Purchase Description Should Show:**
```
Pattern: opmsAPI-SYNC-TEST-PRODUCT
Color: Snow
Width: 54.00''
Repeat: H: 0.00'' V: 0.00''
Cut Price: $100.00/Y
Roll Price: $150.00/Y
```

### **Sales Description Should Show:**
```
#opmsAPI01
Pattern: opmsAPI-SYNC-TEST-PRODUCT
Color: Snow
Width: 54.00''
Repeat: H: 0.00'' V: 0.00''
Country of Origin: Not Specified
```

---

## 🔍 Where to Find Things in NetSuite

### **Script Execution Log:**
1. Customization → Scripting → Script Execution Log
2. Filter: Script = "Upsert Inventory Item"
3. Filter: Date = Today
4. Filter: Type = Debug (to see all details)
5. Click the most recent execution

### **Item Record:**
1. Lists → Accounting → Items
2. Search for: "opmsAPI01"
3. Open the record
4. Look for "Purchase Description" and "Sales Description" fields
   - Usually on "Main" tab
   - Or "Classification" tab
   - Or search for "description" in the field search

---

## 💡 Pro Tips

### **Tip 1: Test with Different Items**
```bash
# Find other test items
node scripts/find-test-items.js

# Test with a different item
node scripts/test-sales-purchase-descriptions.js <itemId> --live
```

### **Tip 2: Watch for Warnings**
If you see "⚠️ purchasedescription NOT in itemData", the file wasn't saved properly.

### **Tip 3: Check Character Counts**
- API says 147 chars → NetSuite log should also say 147 chars
- If different, something modified the content

### **Tip 4: Compare Purchase vs Sales**
- Purchase has pricing, Sales doesn't
- Sales has "#" item code, Purchase doesn't
- Both should have same product/color/dimensions

---

## 🎯 Quick Start (Copy-Paste)

```bash
# 1. Save the file first (Cmd+S in editor)

# 2. Dry run test
node scripts/test-sales-purchase-descriptions.js 43992

# 3. If output looks good, run live sync
node scripts/test-sales-purchase-descriptions.js 43992 --live

# 4. Check NetSuite (see instructions above)
```

---

**Ready to test once you save the file!** 🚀

