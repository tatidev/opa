# NetSuite Pricing Cascade - Business Overview
## How Pricing Updates Flow Between NetSuite and OPMS

**Last Updated:** October 25, 2025  
**Status:** ✅ Active in Production  
**Audience:** Business Users, Management, Training

---

## 🎯 What This System Does

When you update pricing for any fabric item in NetSuite, the system **automatically updates all related color variations** (sibling items) with the same pricing.

**Example:** If you update the price for "ACDC - Teal", all other ACDC colors (Graphite, Natural, etc.) automatically receive the same price update.

---

## 📋 Which Pricing Fields Cascade

### ✅ **Fields That Update All Siblings**

**1. Base Price Line 1 (Cut Price)**
- Used for: Residential customers buying by the cut
- When updated: All sibling items get the same cut price
- Updates: Automatically within seconds

**2. Price Level 1, Line 5 (Roll Price)**  
- Used for: Hospital/commercial customers buying by the roll
- When updated: All sibling items get the same roll price
- Updates: Automatically within seconds

**3. Roll Price (Custom Field)**
- Used for: Special roll pricing calculations
- When updated: All sibling items get the same custom roll price
- Updates: Automatically within seconds

### ⚠️ **Field That Does NOT Cascade**

**Purchase Cost (Average Cost)**
- Used for: Internal cost tracking and margin calculations
- When updated: **Only that specific item's cost changes**
- Why: Each color may have different inventory receipt costs
- Updates: Flows to OPMS but does NOT cascade to siblings

---

## 🔄 Step-by-Step: What Happens When You Update Pricing

### **Scenario: Updating ACDC - Teal Pricing**

**Step 1: You Update Pricing in NetSuite**
- Open NetSuite item: 6148-4501 (ACDC - Teal)
- Change Base Price Line 1 from $69.00 to $75.00
- Click Save

**Step 2: System Detects the Change (Instant)**
- NetSuite automatically sends update notification
- OPMS receives the pricing change

**Step 3: OPMS Updates Product Pricing (1-2 seconds)**
- OPMS updates the ACDC product pricing record
- New price: $75.00 for Base Price Line 1

**Step 4: Cascade Triggers (2-3 seconds)**
- System identifies all ACDC sibling items:
  - 6148-4501 (Teal) - the one you updated
  - 6148-4506 (Graphite)
  - 6148-4511 (Natural)
  - ...and 6 more color variations

**Step 5: All Siblings Updated in NetSuite (5-10 seconds)**
- Each sibling item receives the $75.00 price
- Total time: About 10 seconds from your save

**Step 6: Complete - No Further Action Needed**
- All 9 ACDC items now show $75.00
- Pricing is consistent across all colors
- ✅ No duplicate updates or infinite loops

---

## 💰 Understanding Purchase Cost Behavior

### **Why Purchase Cost is Different**

**Each fabric color can have different costs because:**

**Example - ACDC Product Line:**

| Item | Color | Purchase Cost | Why Different? |
|---|---|---|---|
| 6148-4501 | Teal | $21.95 | Received 100 yards @ $21.95/yd |
| 6148-4506 | Graphite | $22.10 | Received 80 yards @ $22.10/yd |
| 6148-4511 | Natural | $21.80 | Received 120 yards @ $21.80/yd |

**Reason for Differences:**
- Different vendors may charge different prices per color
- Different order dates have different pricing
- Different order quantities affect unit cost
- Freight and surcharges vary by shipment

**NetSuite tracks each color's cost independently** based on actual receipts for that specific color.

### **How Purchase Cost is Updated**

**Purchase Cost changes when:**

1. **You receive inventory** via Purchase Order
   - Example: Receive 50 yards of Teal @ $24.00
   - NetSuite calculates new average: $22.50
   - Only Teal's cost changes, not Graphite or Natural

2. **You manually adjust cost** in NetSuite UI
   - Navigate to item → Purchasing/Inventory tab
   - Update Purchase Cost field
   - NetSuite may recalculate based on costing method

3. **Inventory adjustments** are processed
   - Write-offs, returns, or adjustments
   - NetSuite recalculates average cost

**Purchase Cost Does NOT Cascade** because each item has unique inventory history.

---

## 🎨 Real-World Examples

### **Example 1: New Season Pricing**

**Situation:** New season starts, need to increase all ACDC prices by $5

**Old Way (Manual):**
- Open each of 9 ACDC items individually
- Update Base Price Line 1 in each
- Update Roll Price in each  
- Time: 15-20 minutes

**New Way (Automated Cascade):**
- Open any one ACDC item (e.g., Teal)
- Update Base Price Line 1 (+$5)
- Update Roll Price (+$5)
- Save
- Time: 30 seconds (system updates other 8 items automatically)

**Result:** All 9 ACDC items have consistent pricing in 30 seconds vs 20 minutes.

### **Example 2: Vendor Price Increase**

**Situation:** Vendor raises Graphite color cost to $23.50 (other colors unchanged)

**What Happens:**
1. Create Purchase Order for Graphite @ $23.50
2. Receive inventory against PO
3. NetSuite updates Graphite cost to $23.50
4. OPMS receives the update
5. **Other colors keep their own costs** (Teal $21.95, Natural $21.80)

**Result:** Each color maintains its actual cost, margin calculations remain accurate.

### **Example 3: Promotional Pricing**

**Situation:** Run promotion - reduce roll pricing by 10% for all ACDC items

**Steps:**
1. Calculate new price: $63.00 → $56.70
2. Open any ACDC item in NetSuite
3. Update Price Level 1, Line 5 to $56.70
4. Save
5. **System automatically updates all 9 items**

**Verification:**
- Check any sibling item: Shows $56.70
- Check OPMS: Product pricing updated
- Promotion pricing consistent across all colors

---

## ⏱️ **Timing and Performance**

### **How Long Does Cascade Take?**

| Event | Time | What's Happening |
|---|---|---|
| You save in NetSuite | 0 seconds | Your update completes |
| Webhook sent | 1 second | NetSuite sends notification |
| OPMS product updated | 2-3 seconds | Database update |
| Sibling items queued | 3-4 seconds | System finds all siblings |
| First sibling updated | 5-7 seconds | NetSuite item 1 updated |
| All siblings updated | 8-15 seconds | Depends on number of siblings |

**Typical:** 10-15 seconds for complete cascade across all sibling items.

### **How Many Items Can It Handle?**

**Tested Scenarios:**
- ACDC (9 sibling items): ~12 seconds
- Products with 2-3 items: ~8 seconds
- Products with 15+ items: ~20 seconds

**System handles up to 50 sibling items** per product efficiently.

---

## 🎓 **What Are "Sibling Items"?**

**Sibling Items** = All fabric items that are color variations of the same base pattern/product.

**How to Identify Siblings:**
- Same pattern name (e.g., all "ACDC" items)
- Same OPMS Product ID (shown in item custom fields)
- Usually different colors or slight variations

**Example Sibling Groups:**

**ACDC Product (ID 2823):**
- 6148-4501 (Teal)
- 6148-4502 (Charcoal)
- 6148-4503 (Khaki)
- 6148-4504 (Persimmon)
- 6148-4505 (Peacock)
- 6148-4506 (Graphite)
- 6148-4507 (Slate)
- 6148-4508 (Linen)
- 6148-4511 (Natural)

**All 9 items share pricing except Purchase Cost (which varies by color's inventory receipts).**

---

## ✅ **What Users Should Know**

### **Do's**

✅ **Update pricing in any sibling item** - doesn't matter which one  
✅ **Expect all siblings to update automatically** - within 10-15 seconds  
✅ **Each color can have different Purchase Cost** - this is normal  
✅ **Check one sibling to verify cascade worked** - they should all match  

### **Don'ts**

❌ **Don't update all siblings manually** - system does this automatically  
❌ **Don't expect Purchase Cost to match across siblings** - each has independent cost  
❌ **Don't update pricing in OPMS database** - always use NetSuite UI  
❌ **Don't worry about infinite loops** - system prevents this automatically  

---

## 🔍 **How to Verify Cascade Worked**

**After updating pricing in NetSuite:**

**Quick Check:**
1. Wait 15 seconds
2. Open any sibling item
3. Check pricing matches what you set
4. If yes ✅ cascade worked!

**Detailed Check:**
1. Note which item you updated (e.g., 6148-4501)
2. Note the new price (e.g., $75.00)
3. Open 2-3 sibling items randomly
4. Verify they all show $75.00
5. Check OPMS if needed (optional)

**If Cascade Didn't Work:**
- Wait another 10 seconds (might still be processing)
- Check if webhook is configured correctly
- Contact technical support with item number and timestamp

---

## 📊 **Business Impact**

### **Consistency Benefits**

✅ **Eliminates pricing errors** - No manual entry mistakes  
✅ **Ensures price consistency** - All colors always match  
✅ **Faster price updates** - Respond quickly to market changes  
✅ **Audit trail** - System logs all updates automatically  

### **Data Integrity**

✅ **NetSuite is source of truth** - All pricing originates there  
✅ **OPMS stays synchronized** - Database always current  
✅ **No duplicate updates** - System prevents infinite loops  
✅ **Purchase cost accuracy** - Each item's true cost maintained  

---

## 📞 **Common Questions**

### **Q: Why all sibling items do not have the same Purchase Cost?**

**A:** Each fabric color has its own inventory receipt history. When we buy Teal fabric, only Teal's cost updates. When we buy Graphite, only Graphite's cost updates. This gives accurate cost and margin calculations per color.

### **Q: How long does the cascade take?**

**A:** Typically 10-15 seconds. You can open a sibling item to check if it's updated yet. If not, wait a few more seconds and refresh.

### **Q: What if I update multiple items at once?**

**A:** Update one item and let the cascade complete. The system will handle all siblings. Updating multiple items simultaneously may cause conflicting updates.

### **Q: Can I see which items will be updated?**

**A:** All items with the same pattern name will update. Check the "OPMS Product ID" custom field - matching IDs = siblings that will update.

### **Q: Does this work for all products?**

**A:** Yes! Works for any product with multiple color variations or sibling items in NetSuite.

### **Q: What if the cascade fails?**

**A:** Contact technical support with:
- Item number you updated
- Time you saved (e.g., "2:30 PM")
- Which pricing field you changed
- Which sibling items didn't update

---

## 🎯 **Best Practices**

### **When Updating Pricing**

1. **Choose any sibling item** to update (doesn't matter which)
2. **Update all pricing fields you need** in one save operation
3. **Wait 15 seconds** before checking siblings
4. **Verify on 1-2 siblings** to confirm cascade worked
5. **Done!** No need to touch other items

### **For New Products**

When adding new color variations:
- First item sets the pricing baseline
- New sibling items will cascade from existing pricing
- Or update any one item to set pricing for all

### **For Seasonal Price Changes**

**Most Efficient Approach:**
1. Make list of products to update
2. For each product, pick one sibling item
3. Update that one item with new pricing
4. Move to next product
5. System handles all the siblings automatically

**This turns hours of work into minutes!**

---

## 📝 **Summary**

### **What Cascades (Bidirectional)**
✅ Base Price Line 1 (Cut Price)  
✅ Price Level 1, Line 5 (Roll Price)  
✅ Roll Price Custom Field  

### **What Doesn't Cascade (One-Way)**  
→ Purchase Cost (NetSuite to OPMS only)  
   - Each item keeps its own average cost
   - Based on actual inventory receipts
   - Maintains accounting accuracy

### **Key Benefits**
- ⏱️ **Time Savings:** 90% faster pricing updates
- ✅ **Consistency:** All siblings always match
- 🛡️ **Reliability:** Automatic, no manual errors
- 📊 **Accuracy:** True costs maintained per item

---

## 🚀 **Getting Started**

**Ready to use the cascade system?**

1. **Update pricing as normal** in NetSuite
2. **Save the item** 
3. **Wait 15 seconds**
4. **Verify siblings updated** (optional)
5. **That's it!**

The system handles everything else automatically.

---

**Questions?** Contact your NetSuite administrator or technical support.

**Document Version:** 1.0  
**For:** Business Users  
**Technical Documentation:** See NetSuite-Cascading-Item-Price-Changes-Technical.md

