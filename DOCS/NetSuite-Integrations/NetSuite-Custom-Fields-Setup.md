# NetSuite Custom Fields Setup for OPMS Integration

## Overview
This guide walks through creating the required custom fields in NetSuite to support OPMS (T_PRODUCT and T_ITEM) integration.

## Required Custom Fields

### 1. OPMS Product ID Field
- **Field Name:** `custitem_opms_prod_id`
- **Field Label:** OPMS Product ID
- **Type:** Text
- **Description:** Stores the OPMS product ID from T_PRODUCT table

### 2. OPMS Item ID Field  
- **Field Name:** `custitem_opms_item_id`
- **Field Label:** OPMS Item ID
- **Type:** Text
- **Description:** Stores the OPMS item ID from T_ITEM table (colorlines)

## Step-by-Step Setup

### 1. Navigate to Custom Fields
1. Log into NetSuite
2. Go to **Setup** → **Customization** → **Lists, Records & Fields** → **Entity Fields**
3. Click **New**

### 2. Create OPMS Product ID Field
1. **Label:** `OPMS Product ID`
2. **ID:** `custitem_opms_prod_id` *(NetSuite will auto-generate, verify it matches)*
3. **Type:** `Free-Form Text`
4. **Length:** `20` *(should be sufficient for OPMS product IDs)*
5. **Description:** `OPMS Product ID from T_PRODUCT table`
6. **Applies To:** Check `Item` 
7. **Subtabs:** 
   - **Store** tab: Optional
   - **Classification** tab: Recommended
8. **Access:** 
   - **Role Access:** Ensure your API role has **Edit** permission
   - **Field Access:** Set to **Edit** for relevant roles
9. Click **Save**

### 3. Create OPMS Item ID Field
1. **Label:** `OPMS Item ID`
2. **ID:** `custitem_opms_item_id` *(NetSuite will auto-generate, verify it matches)*
3. **Type:** `Free-Form Text`
4. **Length:** `20` *(should be sufficient for OPMS item IDs)*
5. **Description:** `OPMS Item ID from T_ITEM table (colorlines)`
6. **Applies To:** Check `Item`
7. **Subtabs:** 
   - **Store** tab: Optional  
   - **Classification** tab: Recommended
8. **Access:**
   - **Role Access:** Ensure your API role has **Edit** permission
   - **Field Access:** Set to **Edit** for relevant roles
9. Click **Save**

## Verification Steps

### 1. Check Field Creation
1. Go to **Setup** → **Customization** → **Lists, Records & Fields** → **Entity Fields**
2. Search for "OPMS" to find your newly created fields
3. Verify the **ID** matches exactly:
   - `custitem_opms_prod_id`
   - `custitem_opms_item_id`

### 2. Test Field Access
1. Create or edit any inventory item
2. Look for the new fields in the **Classification** tab (or wherever you placed them)
3. Verify you can enter and save values

### 3. Verify API Role Permissions
1. Go to **Setup** → **Users/Roles** → **Manage Roles**
2. Find your API integration role
3. Go to **Permissions** → **Lists** → **Custom Fields**
4. Ensure **Edit** permission is granted

## Testing the Integration

Once the fields are created, run the test script:

```bash
cd /path/to/opuzen-api
node scripts/test-netsuite-custom-fields.js
```

## Expected Test Results

### ✅ Success Scenario
```
🧪 Parent Product Test
✅ SUCCESS:
   - NetSuite ID: 12345
   - Item ID: TEST-PARENT-1234567890
   - Message: Inventory item created successfully

🧪 Child Colorline Test  
✅ SUCCESS:
   - NetSuite ID: 12346
   - Item ID: TEST-CHILD-1234567891
   - Message: Inventory item created successfully
```

### ❌ Common Errors

#### Error: Field Not Found
```
❌ FAILURE:
   - Error: Failed to set field custitem_opms_prod_id: Field not found
```
**Solution:** Verify the custom field was created with the exact ID name.

#### Error: Permission Denied
```
❌ FAILURE:
   - Error: You do not have permissions to set field custitem_opms_prod_id
```
**Solution:** Grant **Edit** permission to your API role for custom fields.

#### Error: Invalid Field Type
```
❌ FAILURE:
   - Error: Invalid value for field custitem_opms_prod_id
```
**Solution:** Ensure field type is **Free-Form Text** and value is a string.

## Field Usage in Code

### Updated Restlet Payload
```javascript
{
  "itemId": "TEST-001",
  "displayName": "Widget Pro Series - Red",
  "upcCode": "TEST-UPC-001",
  "taxScheduleId": "1",
  "description": "Test item with OPMS integration",
  "opmsProductId": "1234",  // Maps to custitem_opms_prod_id
  "opmsItemId": "5678"      // Maps to custitem_opms_item_id
}
```

### Querying Items by OPMS ID
```javascript
// Find all items for an OPMS product
const productItems = await netsuiteSearch({
  type: 'inventoryitem',
  filters: [
    ['custitem_opms_prod_id', 'is', '1234']
  ]
});

// Find specific colorline
const colorlineItem = await netsuiteSearch({
  type: 'inventoryitem', 
  filters: [
    ['custitem_opms_item_id', 'is', '5678']
  ]
});
```

## Troubleshooting

### Issue: Fields Don't Appear in Item Record
**Cause:** Fields not assigned to correct subtabs
**Solution:** Edit field → **Display** → Select appropriate subtabs

### Issue: API Can't Access Fields  
**Cause:** API role lacks permissions
**Solution:** **Setup** → **Users/Roles** → **Manage Roles** → Your API Role → **Permissions** → **Lists** → **Custom Fields** → Set to **Edit**

### Issue: Field ID Mismatch
**Cause:** NetSuite auto-generated different ID
**Solution:** Check actual field ID in NetSuite and update code accordingly

## Next Steps

After successful testing:
1. ✅ Deploy updated Restlet to NetSuite
2. ✅ Update OPMS integration service to include custom fields
3. ✅ Test full OPMS → NetSuite sync workflow
4. ✅ Implement bidirectional sync (NetSuite → OPMS)

## Support

If you encounter issues:
1. Check NetSuite script logs for detailed error messages
2. Verify field IDs match exactly (case-sensitive)
3. Ensure API role has all required permissions
4. Test field creation manually in NetSuite UI first 