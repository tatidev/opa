# Compliance Fields Setup for NetSuite

## 📋 Custom Fields Required

The following custom fields need to be created in NetSuite for compliance and regulatory functionality:

### 1. Prop 65 Compliance Field
- **Field Type:** List/Record (Radio Button)
- **Field Label:** Prop 65 Compliance
- **Field ID:** `custitem_prop65_compliance`
- **Applied To:** Inventory Item
- **Data Source:** `T_PRODUCT_VARIOUS.prop_65` (char 1)
- **Values:** 
  - `Y` = Yes
  - `N` = No
  - `D` = Don't Know (or similar)
- **Description:** California Proposition 65 compliance status

### 2. AB 2998 Compliance Field  
- **Field Type:** List/Record (Radio Button)
- **Field Label:** AB 2998 Compliance
- **Field ID:** `custitem_ab2998_compliance`
- **Applied To:** Inventory Item
- **Data Source:** `T_PRODUCT_VARIOUS.ab_2998_compliant` (char 1)
- **Values:** 
  - `Y` = Yes
  - `N` = No
  - `D` = Don't Know (or similar)
- **Description:** California AB 2998 compliance status

### 3. Tariff/Harmonized Code Field
- **Field Type:** Text
- **Field Label:** Tariff/Harmonized Code
- **Field ID:** `custitem_tariff_harmonized_code`
- **Applied To:** Inventory Item
- **Data Source:** `T_PRODUCT_VARIOUS.tariff_code` (varchar 50)
- **Description:** Import/export classification code

## 🔧 NetSuite Setup Instructions

### Create Radio Button Lists First

1. **Navigate to:** Customization > Lists, Records & Fields > Custom Lists > New
2. **Create Compliance Options List:**
   - Name: Compliance Options
   - ID: customlist_compliance_options
   - Values:
     - Yes (Y)
     - No (N)  
     - Don't Know (D)

### Create Custom Fields

1. **Navigate to:** Customization > Lists, Records & Fields > Item Fields > New

2. **Create Prop 65 Field:**
   - Type: List/Record
   - Label: Prop 65 Compliance
   - ID: custitem_prop65_compliance
   - List/Record: Compliance Options (created above)
   - Applies To: Inventory Item
   - Store Value: Yes
   - Show in List: Yes (optional)

3. **Create AB 2998 Field:**
   - Type: List/Record
   - Label: AB 2998 Compliance
   - ID: custitem_ab2998_compliance
   - List/Record: Compliance Options (created above)
   - Applies To: Inventory Item
   - Store Value: Yes
   - Show in List: Yes (optional)

4. **Create Tariff Code Field:**
   - Type: Text
   - Label: Tariff/Harmonized Code
   - ID: custitem_tariff_harmonized_code
   - Applies To: Inventory Item
   - Store Value: Yes
   - Show in List: Yes (optional)

## 📝 Implementation Status

- ✅ **OPMS Database:** Fields exist in `T_PRODUCT_VARIOUS` table
- ✅ **ItemModel:** Updated to include compliance fields in queries
- ✅ **NetSuite Service:** Updated to include compliance fields in payload
- ❌ **NetSuite Custom Fields:** Need to be created (see instructions above)
- ❌ **RESTlet:** Updated to handle new fields (ready for testing)

## 🔄 Next Steps

1. Create the custom list and fields in NetSuite using the instructions above
2. Note the actual field IDs assigned by NetSuite
3. Update the RESTlet script if field IDs differ from suggestions
4. Test with sample data from OPMS

## 📊 Field Mapping

| OPMS Field | NetSuite Field | Data Type | Values | Notes |
|---|---|---|---|---|
| `T_PRODUCT_VARIOUS.prop_65` | `custitem_prop65_compliance` | char(1) → Radio Button | Y/N/D → yes/no/don't know | California Prop 65 |
| `T_PRODUCT_VARIOUS.ab_2998_compliant` | `custitem_ab2998_compliance` | char(1) → Radio Button | Y/N/D → yes/no/don't know | California AB 2998 |
| `T_PRODUCT_VARIOUS.tariff_code` | `custitem_tariff_harmonized_code` | varchar(50) → Text | Free text | Import/export code |

## 🧪 Testing

Once the fields are created, you can test using:
```bash
node scripts/test-high-priority-fields.js
```

This will create test items with various compliance values to verify the implementation.