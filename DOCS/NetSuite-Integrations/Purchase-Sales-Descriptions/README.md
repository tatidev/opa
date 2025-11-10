# Purchase and Sales Descriptions - Auto-Generation Feature

**Feature:** Automatic generation of formatted Sales Description and Purchase Description fields from OPMS to NetSuite

**Implementation Date:** October 25, 2025

**Status:** ✅ Code Complete - Ready for NetSuite Deployment

---

## 📋 Quick Start

### **1. Understand the Feature**
Read: [`SPECIFICATION.md`](./SPECIFICATION.md)

**What it does:**
- Automatically generates Purchase Description (internal, with pricing)
- Automatically generates Sales Description (customer-facing, no pricing)
- Syncs from OPMS → NetSuite only (one-way)
- Uses multi-line HTML format with `<br>` tags

---

### **2. Review Implementation**
Read: [`IMPLEMENTATION-SUMMARY.md`](./IMPLEMENTATION-SUMMARY.md)

**What was changed:**
- `OpmsDataTransformService.js` - 3 new methods
- `NetSuiteRestletService.js` - Field mapping
- `RESTletUpsertInventoryItem-PROD.js` - **MUST BE DEPLOYED**
- Test scripts and documentation

---

### **3. Verify Local Testing**
Read: [`LOCAL-TEST-RESULTS.md`](./LOCAL-TEST-RESULTS.md)

**Test Results:**
- ✅ ALL TESTS PASSED
- ✅ Descriptions generated correctly
- ✅ Formatting verified
- ✅ Debug output working perfectly

---

### **4. Deploy RESTlet to NetSuite**
Read: [`RESTLET-DEPLOYMENT-REQUIRED.md`](./RESTLET-DEPLOYMENT-REQUIRED.md)

**CRITICAL:** You MUST deploy the updated RESTlet for this feature to work!

**File to deploy:** `netsuite-scripts/RESTletUpsertInventoryItem-PROD.js`

---

### **5. Understand Debug Output**
Read: [`DEBUG-OUTPUT-EXAMPLE.md`](./DEBUG-OUTPUT-EXAMPLE.md) (API)  
Read: [`RESTLET-DEBUG-OUTPUT-GUIDE.md`](./RESTLET-DEBUG-OUTPUT-GUIDE.md) (NetSuite)

**What you'll see:**
- Detailed composition steps
- Field-by-field logging
- Success/error indicators
- Troubleshooting guidance

---

## 📁 Documentation Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **README.md** (this file) | Overview and navigation | Start here |
| **SPECIFICATION.md** | Complete feature specification | Understanding requirements |
| **IMPLEMENTATION-SUMMARY.md** | Implementation details | Code review |
| **LOCAL-TEST-RESULTS.md** | Test results and verification | After local testing |
| **RESTLET-DEPLOYMENT-REQUIRED.md** | RESTlet deployment guide | **BEFORE NetSuite deployment** |
| **DEBUG-OUTPUT-EXAMPLE.md** | API debug output reference | Troubleshooting API |
| **RESTLET-DEBUG-OUTPUT-GUIDE.md** | NetSuite log reference | Troubleshooting NetSuite |

---

## 🚀 Deployment Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. LOCAL TESTING                                        │
│    ✅ COMPLETE - All tests passed                       │
│    Run: node scripts/test-sales-purchase-descriptions.js│
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. DEPLOY RESTLET TO SANDBOX                            │
│    ⏳ YOUR ACTION REQUIRED                              │
│    File: netsuite-scripts/RESTletUpsertInventoryItem-   │
│          PROD.js                                         │
│    Guide: RESTLET-DEPLOYMENT-REQUIRED.md                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. TEST LIVE SYNC TO SANDBOX                            │
│    ⏳ PENDING                                           │
│    Run: NODE_ENV=sandbox node scripts/test-sales-       │
│         purchase-descriptions.js <itemId> --live        │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 4. VERIFY IN NETSUITE UI                                │
│    ⏳ PENDING                                           │
│    - Check descriptions populated                       │
│    - Verify <br> tags render as line breaks             │
│    - Verify pricing in purchase desc only               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 5. DEPLOY TO PRODUCTION                                 │
│    ⏳ PENDING                                           │
│    - After successful sandbox testing                   │
│    - After user acceptance                              │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Example Output

### Purchase Description (Internal)
```
Pattern: opmsAPI-SYNC-TEST-PRODUCT
Color: Snow
Width: 54.00''
Repeat: H: 0.00'' V: 0.00''
Cut Price: $100.00/Y
Roll Price: $150.00/Y
```

### Sales Description (Customer-Facing)
```
#opmsAPI01
Pattern: opmsAPI-SYNC-TEST-PRODUCT
Color: Snow
Width: 54.00''
Repeat: H: 0.00'' V: 0.00''
Country of Origin: Not Specified
```

---

## 🎯 Key Features

### Purchase Description
- ✅ Internal use only
- ✅ Includes pricing (Cut Price, Roll Price)
- ✅ Multi-line format
- ✅ Product specifications
- ✅ Test results (abrasion, fire codes)

### Sales Description
- ✅ Customer-facing
- ✅ Starts with item number (#)
- ✅ NO pricing information
- ✅ Includes Country of Origin
- ✅ Multi-line format
- ✅ Product specifications

---

## ⚠️ Important Notes

### One-Way Sync
- Descriptions sync OPMS → NetSuite ONLY
- Manual edits in NetSuite will be overwritten
- Does NOT sync back to OPMS

### Not Part of Pricing Cascade
- Descriptions update during product/item sync
- Do NOT update during pricing cascade events
- Pricing values snapshot from OPMS at sync time

### Character Limits
- NetSuite limit: 4000 characters
- Typical length: 150-300 characters
- No truncation needed for normal data

---

## 🔧 Files Modified

### Source Code
- `src/services/OpmsDataTransformService.js`
  - `extractOriginData()` - Extract country of origin
  - `composePurchaseDescription()` - Generate purchase desc
  - `composeSalesDescription()` - Generate sales desc
  
- `src/services/NetSuiteRestletService.js`
  - Field mapping for both descriptions

- `netsuite-scripts/RESTletUpsertInventoryItem-PROD.js`
  - Field setting with extensive debug output
  - Read-back verification
  - Error diagnostics

### Test Scripts
- `scripts/test-sales-purchase-descriptions.js`
- `scripts/find-test-items.js`

---

## 🧪 Testing

### Local Testing (Completed)
```bash
# Test with specific item
node scripts/test-sales-purchase-descriptions.js <opmsItemId>

# Find test items
node scripts/find-test-items.js
```

### NetSuite Testing (After RESTlet Deployment)
```bash
# Dry run (no NetSuite update)
node scripts/test-sales-purchase-descriptions.js <opmsItemId>

# Live sync to sandbox
NODE_ENV=sandbox node scripts/test-sales-purchase-descriptions.js <opmsItemId> --live

# Live sync to production
NODE_ENV=production node scripts/test-sales-purchase-descriptions.js <opmsItemId> --live
```

---

## 📊 Debug Output

### API Debug Output
See: [`DEBUG-OUTPUT-EXAMPLE.md`](./DEBUG-OUTPUT-EXAMPLE.md)

Shows step-by-step composition with ✓ checkmarks:
```
🛠️  Composing Purchase Description
  ✓ Added Pattern: opmsAPI-SYNC-TEST-PRODUCT
  ✓ Added Color: Snow
  ✓ Added Width: 54.00''
  ✓ Added Cut Price: $100.00/Y
  ✅ Complete (147 chars)
```

### NetSuite Debug Output
See: [`RESTLET-DEBUG-OUTPUT-GUIDE.md`](./RESTLET-DEBUG-OUTPUT-GUIDE.md)

Shows detailed field operations in NetSuite logs:
```
═════════════════════════════════════════════════════════
📝 PURCHASE DESCRIPTION - Setting Field
═════════════════════════════════════════════════════════
Field ID: purchasedescription
Value Type: string
Character Count: 147
Contains <br> tags: YES
✅ Purchase description set successfully
```

---

## 🐛 Troubleshooting

### Issue: Descriptions Not Appearing in NetSuite

**Check:**
1. RESTlet deployed? (See RESTLET-DEPLOYMENT-REQUIRED.md)
2. API sending descriptions? (Check API logs)
3. RESTlet receiving descriptions? (Check NetSuite execution logs)
4. Permissions correct? (Check role permissions)

### Issue: Line Breaks Not Rendering

**Check:**
1. `<br>` tags present in saved description? (Check NetSuite logs)
2. NetSuite field type is textarea? (Not rich text)
3. NetSuite rendering HTML? (Should render as line breaks)

### Issue: Wrong Content in Descriptions

**Check:**
1. Purchase desc has pricing? (Should have "Cut Price", "Roll Price")
2. Sales desc has NO pricing? (Should NOT have "Price")
3. Sales desc starts with #? (Should have item number)
4. Sales desc has origin? (Should have "Country of Origin")

---

## 📞 Support

### Getting Help

1. **Review debug output** - Both API and NetSuite logs
2. **Check documentation** - Each doc has troubleshooting section
3. **Review test results** - Compare with expected output
4. **Check NetSuite logs** - Execution log has detailed diagnostics

### Common Issues

See troubleshooting sections in:
- `RESTLET-DEBUG-OUTPUT-GUIDE.md` - NetSuite issues
- `DEBUG-OUTPUT-EXAMPLE.md` - API issues
- `IMPLEMENTATION-SUMMARY.md` - Code issues

---

## 📚 Related Documentation

### In This Directory
- All files listed above

### Elsewhere in Repo
- `DOCS/ai-specs/app-technical-specifications/sales-purchase-descriptions-sync-spec.md` (original spec)
- `DOCS/ai-specs/app-technical-specifications/IMPLEMENTATION-SUMMARY-sales-purchase-descriptions.md` (original summary)
- `DOCS/NetSuite-Integrations/Pricing-and-Cost/` (related pricing cascade feature)

---

## ✅ Checklist

Before deploying to production:

- [ ] Read all documentation
- [ ] Local testing complete
- [ ] RESTlet deployed to sandbox
- [ ] Live sync to sandbox successful
- [ ] Descriptions verified in NetSuite UI
- [ ] Line breaks render correctly
- [ ] Purchase description has pricing
- [ ] Sales description has NO pricing
- [ ] User acceptance testing complete
- [ ] RESTlet deployed to production
- [ ] Production testing successful

---

**Last Updated:** October 25, 2025

**Feature Status:** ✅ Code Complete - Ready for Deployment

**Next Action:** Deploy RESTlet to NetSuite Sandbox

