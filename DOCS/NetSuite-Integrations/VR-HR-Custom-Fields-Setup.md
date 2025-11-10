# VR/HR Custom Fields Setup for NetSuite

## 📋 Custom Fields Required

The following custom fields need to be created in NetSuite for VR (Vertical Repeat) and HR (Horizontal Repeat) functionality:

### 1. VR (Vertical Repeat) Field
- **Field Type:** Text
- **Field Label:** VR (Vertical Repeat)
- **Field ID:** `custitem_vertical_repeat`
- **Applied To:** Inventory Item
- **Data Source:** `T_PRODUCT.vrepeat` (decimal 5,2)
- **Description:** Vertical pattern repeat measurement in inches

### 2. HR (Horizontal Repeat) Field  
- **Field Type:** Text
- **Field Label:** HR (Horizontal Repeat)
- **Field ID:** `custitem_horizontal_repeat`
- **Applied To:** Inventory Item
- **Data Source:** `T_PRODUCT.hrepeat` (decimal 5,2)
- **Description:** Horizontal pattern repeat measurement in inches

## 🔧 NetSuite Setup Instructions

1. **Navigate to:** Customization > Lists, Records & Fields > Item Fields > New
2. **Create VR Field:**
   - Type: Text
   - Label: VR (Vertical Repeat)
   - ID: custitem_vertical_repeat
   - Applies To: Inventory Item
   - Store Value: Yes
   - Show in List: Yes (optional)

3. **Create HR Field:**
   - Type: Text  
   - Label: HR (Horizontal Repeat)
   - ID: custitem_horizontal_repeat
   - Applies To: Inventory Item
   - Store Value: Yes
   - Show in List: Yes (optional)

## 📝 Implementation Status

- ✅ **OPMS Database:** Fields exist in `T_PRODUCT.vrepeat` and `T_PRODUCT.hrepeat`
- ✅ **ItemModel:** Updated to include vrepeat/hrepeat in queries
- ✅ **NetSuite Service:** Updated to include vrepeat/hrepeat in payload
- ❌ **NetSuite Custom Fields:** Need to be created (see instructions above)
- ❌ **RESTlet:** Need to be updated to handle new fields

## 🔄 Next Steps

1. Create the custom fields in NetSuite using the instructions above
2. Note the actual field IDs assigned by NetSuite
3. Update the RESTlet script to handle these fields
4. Test with sample data

## 📊 Field Mapping

| OPMS Field | NetSuite Field | Data Type | Notes |
|---|---|---|---|
| `T_PRODUCT.vrepeat` | `custitem_vertical_repeat` | decimal(5,2) → Text | Vertical pattern repeat |
| `T_PRODUCT.hrepeat` | `custitem_horizontal_repeat` | decimal(5,2) → Text | Horizontal pattern repeat |