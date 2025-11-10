# 🔍 RESTlet Debug Output Guide - Sales & Purchase Descriptions

## What You'll See in NetSuite Execution Logs

When the updated RESTlet processes an item with descriptions, you'll see extensive debug output in NetSuite's Script Execution Log.

---

## 📝 Expected Debug Output

### **When Setting Purchase Description**

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
Content Preview: Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>Color: Snow<br>Width: 54.00''<br>Repeat: H: 0.00'' V: 0.00''...
First 3 Lines:
  1. Pattern: opmsAPI-SYNC-TEST-PRODUCT
  2. Color: Snow
  3. Width: 54.00''
⏳ Attempting to set field...
✅ Purchase description set successfully
═════════════════════════════════════════════════════════
```

### **When Setting Sales Description**

```
═════════════════════════════════════════════════════════
📝 SALES DESCRIPTION - Setting Field
═════════════════════════════════════════════════════════
Field ID: salesdescription
Field Type (NetSuite): textarea
Value Type (JavaScript): string
Character Count: 148
Contains <br> tags: YES
Line Count (estimated): 6
Content Preview: #opmsAPI01<br>Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>Color: Snow<br>Width: 54.00''<br>Repeat: ...
First 3 Lines:
  1. #opmsAPI01
  2. Pattern: opmsAPI-SYNC-TEST-PRODUCT
  3. Color: Snow
⏳ Attempting to set field...
✅ Sales description set successfully
═════════════════════════════════════════════════════════
```

### **Read-Back Verification (After Save)**

```

🔍 VERIFYING DESCRIPTIONS WERE SAVED TO NETSUITE
═════════════════════════════════════════════════════════
✅ PURCHASE DESCRIPTION READ-BACK SUCCESS
  Character Count: 147
  Line Count: 6
  Contains <br> tags: YES
  Contains Pricing: YES ✓
  Preview: Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>Color: Snow<br>Width: 54.00''<br>Repeat...
  First Line: Pattern: opmsAPI-SYNC-TEST-PRODUCT
  Last Line: Roll Price: $150.00/Y
─────────────────────────────────────────────────────────
✅ SALES DESCRIPTION READ-BACK SUCCESS
  Character Count: 148
  Line Count: 6
  Contains <br> tags: YES
  Starts with #: YES ✓
  Contains Pricing: NO ✓
  Contains Origin: YES ✓
  Preview: #opmsAPI01<br>Pattern: opmsAPI-SYNC-TEST-PRODUCT<br>Color: Snow<br>Width: 5...
  First Line: #opmsAPI01
  Last Line: Country of Origin: Not Specified
═════════════════════════════════════════════════════════

```

---

## ❌ Error Debug Output (If Something Goes Wrong)

### **If Field Doesn't Exist**

```
═════════════════════════════════════════════════════════
❌ PURCHASE DESCRIPTION ERROR
═════════════════════════════════════════════════════════
Error Type: INVALID_FLD_VALUE
Error Message: You have entered an Invalid Field Value for the following field: purchasedescription
Error Details: INVALID_FLD_VALUE: You have entered an Invalid Field Value for the following field: purchasedescription
Field ID Attempted: purchasedescription
Value Type: string
Value Length: 147
═════════════════════════════════════════════════════════
POSSIBLE CAUSES:
  1. Field does not exist in NetSuite (check field setup)
  2. Field type mismatch (expected: textarea)
  3. Permissions issue (check role permissions)
  4. Character limit exceeded (NetSuite limit: 4000 chars)
  5. Invalid characters in content
═════════════════════════════════════════════════════════
```

### **If Field Can't Be Read Back**

```
❌ COULD NOT READ PURCHASE DESCRIPTION
  Error: Error: You have entered an invalid field name purchasedescription
  Field ID: purchasedescription
  Possible causes:
    - Field does not exist on this record type
    - Permission issue
```

### **If Field is Empty After Save**

```
⚠️  PURCHASE DESCRIPTION IS EMPTY AFTER SAVE
  This might indicate:
    - Field was not set properly
    - Field permissions prevent read-back
    - Value was not provided in request
```

---

## 🎯 What Each Debug Section Tells You

### **Setting Field Section**

| Debug Line | What It Tells You | What to Check |
|------------|-------------------|---------------|
| `Field ID: purchasedescription` | Internal NetSuite field identifier | Field exists in NetSuite |
| `Field Type (NetSuite): textarea` | Expected NetSuite field type | Field type matches |
| `Value Type (JavaScript): string` | Data type being sent | Should be "string" |
| `Character Count: 147` | Total characters in description | Under 4000 char limit |
| `Contains <br> tags: YES` | HTML line breaks present | Format is correct |
| `Line Count (estimated): 6` | Number of lines (split by `<br>`) | Matches expected lines |
| `Content Preview` | First 100 chars of content | Content looks correct |
| `First 3 Lines` | Line-by-line breakdown | Data is formatted properly |

### **Read-Back Section**

| Debug Line | What It Tells You | What to Check |
|------------|-------------------|---------------|
| `✅ PURCHASE DESCRIPTION READ-BACK SUCCESS` | Field was saved successfully | ✓ Success |
| `Character Count: 147` | Saved length matches sent length | No truncation |
| `Contains Pricing: YES ✓` | Purchase desc has pricing | ✓ Correct |
| `Contains Pricing: NO ✓` (sales) | Sales desc has NO pricing | ✓ Correct |
| `Starts with #: YES ✓` (sales) | Sales desc has item number | ✓ Correct |
| `Contains Origin: YES ✓` (sales) | Sales desc has origin | ✓ Correct |
| `First Line` / `Last Line` | Content verification | Matches expected |

---

## 🔍 How to Access NetSuite Execution Logs

### **Method 1: System Notes**
1. Go to the inventory item record in NetSuite
2. Click **System Information** subtab
3. Look for **System Notes** related to the script execution

### **Method 2: Script Execution Log**
1. In NetSuite, go to **Customization > Scripting > Script Execution Log**
2. Filter by:
   - **Script**: "Upsert Inventory Item RESTlet" (or your script name)
   - **Date**: Today
   - **Type**: Debug, Audit, Error
3. Click **Refresh**
4. View the detailed logs

### **Method 3: SuiteScript Debugger**
1. If you have debugger access
2. Set breakpoints in the RESTlet
3. Step through execution
4. View live variable values

---

## 🐛 Troubleshooting Guide

### **Problem: No Debug Output Appears**

**Possible Causes:**
1. Script log level set too high (only showing errors)
2. RESTlet didn't execute (check deployment)
3. Wrong script in the log filter

**Solution:**
- Set NetSuite logging level to "DEBUG"
- Verify RESTlet deployment is active
- Check script execution log filters

---

### **Problem: "Field does not exist" Error**

**Debug Output:**
```
Error Message: You have entered an Invalid Field Value for the following field: purchasedescription
POSSIBLE CAUSES:
  1. Field does not exist in NetSuite (check field setup)
```

**What It Means:**
The field `purchasedescription` or `salesdescription` doesn't exist on the lot-numbered inventory item record type in your NetSuite instance.

**Solution:**
These are **native NetSuite fields** that should exist by default. However:
1. Verify the field exists: Customization > Lists, Records, & Fields > Item Fields
2. Check it's available on "Lot Numbered Inventory Item" record type
3. Verify your role has permission to view/edit the field

**Note:** Unlike custom fields (custitem_*), `purchasedescription` and `salesdescription` are standard NetSuite fields and don't need to be created.

---

### **Problem: "Permission issue" Error**

**Debug Output:**
```
Error Type: INSUFFICIENT_PERMISSION
Possible causes:
  - Permissions issue (check role permissions)
```

**Solution:**
1. Check the role running the RESTlet has "Full" permission on:
   - Lot Numbered Inventory Items
   - The specific fields purchasedescription and salesdescription
2. Verify the RESTlet deployment role permissions

---

### **Problem: Field is Empty After Save**

**Debug Output:**
```
⚠️  PURCHASE DESCRIPTION IS EMPTY AFTER SAVE
  This might indicate:
    - Field was not set properly
```

**Possible Causes:**
1. Field was not in the request body (check API payload)
2. Value was null or empty string
3. Field set operation failed silently
4. NetSuite workflow cleared the field

**Solution:**
1. Check the API logs to verify descriptions were sent
2. Check the "First 3 Lines" output to see if data was received
3. Look for any errors between "Attempting to set field" and "set successfully"

---

### **Problem: Wrong Content in Description**

**Debug Output:**
```
✅ PURCHASE DESCRIPTION READ-BACK SUCCESS
  Contains Pricing: NO ✗
```

**What It Means:**
Purchase description was saved but doesn't contain pricing information (it should!)

**Solution:**
1. Check the "First 3 Lines" output to see what was actually sent
2. Verify the API is composing descriptions correctly
3. Check if purchase and sales descriptions got swapped

---

## 📊 Success Indicators

When everything works correctly, you should see:

### **Purchase Description:**
- ✅ `Character Count: 100-300` (typical range)
- ✅ `Contains <br> tags: YES`
- ✅ `Line Count: 6-9` (depends on data)
- ✅ `Contains Pricing: YES ✓` (in read-back)
- ✅ `✅ Purchase description set successfully`
- ✅ `✅ PURCHASE DESCRIPTION READ-BACK SUCCESS`

### **Sales Description:**
- ✅ `Character Count: 100-300` (typical range)
- ✅ `Contains <br> tags: YES`
- ✅ `Line Count: 6-9` (depends on data)
- ✅ `Starts with #: YES ✓` (in read-back)
- ✅ `Contains Pricing: NO ✓` (in read-back)
- ✅ `Contains Origin: YES ✓` (in read-back)
- ✅ `✅ Sales description set successfully`
- ✅ `✅ SALES DESCRIPTION READ-BACK SUCCESS`

---

## 🎯 Quick Diagnostic Checklist

When reviewing logs, check these in order:

1. **[ ]** Do you see "📝 PURCHASE DESCRIPTION - Setting Field"?
   - ❌ No → Field not in request body (check API)
   - ✅ Yes → Continue

2. **[ ]** Does "Value Type (JavaScript)" show "string"?
   - ❌ No → Data type issue (check API payload)
   - ✅ Yes → Continue

3. **[ ]** Does "Character Count" show reasonable number (< 4000)?
   - ❌ No → Truncation may occur
   - ✅ Yes → Continue

4. **[ ]** Does "Contains <br> tags" show "YES"?
   - ❌ No → Formatting issue (check API composition)
   - ✅ Yes → Continue

5. **[ ]** Do you see "✅ Purchase description set successfully"?
   - ❌ No → Check error messages above
   - ✅ Yes → Continue

6. **[ ]** Do you see "✅ PURCHASE DESCRIPTION READ-BACK SUCCESS"?
   - ❌ No → Field didn't save (check permissions)
   - ✅ Yes → Success!

7. **[ ]** Does read-back "Contains Pricing" show "YES ✓"?
   - ❌ No → Wrong description sent (API issue)
   - ✅ Yes → Complete success!

Repeat for Sales Description.

---

## 💡 Pro Tips

### **Tip 1: Compare Character Counts**
The character count when setting should match the character count when reading back. If different, something modified the content.

### **Tip 2: Check Line Counts**
Purchase and Sales descriptions should have similar line counts (typically 6-9 lines depending on available data).

### **Tip 3: Verify Content**
Look at the "First 3 Lines" in the setting section and compare to "First Line / Last Line" in read-back to ensure content matches.

### **Tip 4: Watch for Pricing**
- Purchase description MUST contain "Price" (Cut Price and Roll Price)
- Sales description MUST NOT contain "Price"

### **Tip 5: Watch for Item Number**
Sales description MUST start with "#" followed by the item code

---

## 📝 Log Output Reference

### **Log Levels Used:**

| Level | When Used | What It Means |
|-------|-----------|---------------|
| `DEBUG` | Normal operation | Information for troubleshooting |
| `AUDIT` | Warnings | Non-critical issues (empty fields) |
| `ERROR` | Failures | Critical problems that need fixing |

### **Visual Indicators:**

| Symbol | Meaning |
|--------|---------|
| ✅ | Success - operation completed |
| ❌ | Error - operation failed |
| ⚠️  | Warning - potential issue |
| ℹ️  | Info - informational message |
| ⏳ | Processing - operation in progress |
| 📝 | Setting - setting a field value |
| 🔍 | Verifying - reading back data |
| ✓ | Check passed |
| ✗ | Check failed |

---

**Summary:** The enhanced RESTlet provides comprehensive debug output that will tell you exactly what's happening at every step, including field types, character counts, content previews, and detailed error diagnostics. You'll be able to quickly identify and fix any issues that arise.

