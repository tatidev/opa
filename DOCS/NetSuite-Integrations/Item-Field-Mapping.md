### Item Field Mapping (OPMS ↔ NetSuite)

This document defines the field mapping between OPMS and NetSuite for inventory items (colorlines).

| Field Name | Direction | OPMS Field Type | NetSuite Field Type | Implementation Status | Notes |
|---|---|---|---|---|---|
| Item # | OPMS -> NS | Integer | Integer | ✅ **IMPLEMENTED** | OPMS T_ITEM.code; stored as NetSuite `itemId` |
| Product Name | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | Item name/display name; stored as `displayName` |
| Display Name | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | Product Name + ": " + Item Colors (formatted: 1 color=no delimiter, 2 colors="and", 3+ colors=comma separated) - **TESTED & VERIFIED** |
| Color | OPMS -> NS | Multi-Select | Comma-Separated List | ✅ **IMPLEMENTED** | P_COLOR.name (GROUP_CONCAT with separator conversion) → custitem_opms_item_colors |
| Width | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | Stored in `custitem1` |
| VR | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | Vertical repeat; `custitem_vertical_repeat` |
| HR | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | Horizontal repeat; `custitem_horizontal_repeat` |
| Vendor Business Name | OPMS -> NS | Text | Native Field + Sublist | ✅ **IMPLEMENTED** | Z_VENDOR.name → **vendor** (Native Preferred Vendor) + **itemvendor sublist** |
|| Vendor Product Name | OPMS -> NS | Text | Native Field | ✅ **IMPLEMENTED** | T_PRODUCT_VARIOUS.vendor_product_name → **vendorname** (Native Vendor Name) |
|| Vendor Item Color | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | T_ITEM.vendor_color → custitem_opms_vendor_color |
|| Vendor Item Code | OPMS -> NS | Text | Native Field + Sublist | ✅ **IMPLEMENTED** | T_ITEM.vendor_code → **vendorcode** (Native Vendor Code) + **itemvendor sublist** |
| Repeat | OPMS -> NS | Checkbox | Checkbox | ✅ **IMPLEMENTED** | "No Repeat" flag; stored in `custitem5` |
| Front Content | OPMS -> NS | Mini Form | ? | ✅ **IMPLEMENTED** | Pre-formatted HTML in `custitem_opms_front_content` (Rich Text) |
| Back Content | OPMS -> NS | Mini Form | ? | ✅ **IMPLEMENTED** | Pre-formatted HTML in `custitem_opms_back_content` (Rich Text) |
| Abrasion | OPMS -> NS | Mini Form | ? | ✅ **IMPLEMENTED** | Pre-formatted HTML with file links in `custitem_opms_abrasion` (Rich Text) |
| Firecodes | OPMS -> NS | Mini Form | ? | ✅ **IMPLEMENTED** | Pre-formatted HTML with file links in `custitem_opms_firecodes` (Rich Text) |
| Prop 65 Compliance | OPMS -> NS | Yes, No, Don't Know | Radio Button | ✅ **IMPLEMENTED** | `custitem_prop65_compliance` (Y/N/D → yes/no/don't know) |
| AB 2998 Compliance | OPMS -> NS | Yes, No, Don't Know | Radio Button | ✅ **IMPLEMENTED** | `custitem_ab2998_compliance` (Y/N/D → yes/no/don't know) |
| Finish | OPMS -> NS | Multi-Select | Free Text | ✅ **IMPLEMENTED** | P_FINISH.name (GROUP_CONCAT) → custitem_opms_finish |
|| Fabric Width | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | T_PRODUCT.width → custitem_opms_fabric_width |
| Cleaning | OPMS -> NS | Multi-Select Dropdown | Free Text | ✅ **IMPLEMENTED** | P_CLEANING.name (GROUP_CONCAT) → custitem_opms_fabric_cleaning |
| Origin | OPMS -> NS | Dropdown | Free Text | ✅ **IMPLEMENTED** | P_ORIGIN.name (GROUP_CONCAT) → custitem_opms_product_origin |
|| Parent Product Name | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | T_PRODUCT.name → custitem_opms_parent_product_name |
| Tariff / Harmonized Code | OPMS -> NS | Text | Text | ✅ **IMPLEMENTED** | `custitem_tariff_harmonized_code` |
| Item Application | NS -> OPMS | Multi-Select Dropdown | Multi-Select Dropdown | ❌ **NOT IMPLEMENTED** | One-way sync: NetSuite to OPMS |
| Cut Pricing | NS -> OPMS | Currency | Currency | ❌ **NOT IMPLEMENTED** | One-way sync: NetSuite to OPMS |
| Roll Pricing | NS -> OPMS | Currency | Currency | ❌ **NOT IMPLEMENTED** | One-way sync: NetSuite to OPMS |
| Cut Cost | NS -> OPMS | Currency | Currency | ❌ **NOT IMPLEMENTED** | One-way sync: NetSuite to OPMS |
| Roll Cost | NS -> OPMS | Currency | Currency | ❌ **NOT IMPLEMENTED** | One-way sync: NetSuite to OPMS |

### OPMS ↔ NetSuite Linkage (IDs)

- On NetSuite `inventoryitem` (colorline):
  - `custitem_opms_product_id` (Text)
  - `custitem_opms_item_id` (Text)
- For mini-forms (Front/Back Content, Abrasion, Firecodes):
  - Recommended: custom child records with `custrecord_opms_row_id` to support upserts and per-row edits.
  - MVP fallback: store arrays as Long Text (JSON) on the item; migrate to child records later for reporting/search.

### Implementation Summary

#### ✅ **Completed Fields (23/24):**
- Item # → `itemId` (from T_ITEM.code - **OPMS INTEGRATION FIXED**)
- Product Name → `displayName` 
- Display Name → `displayName` (formatted with Opuzen naming convention - **TESTED & VERIFIED**) 
- Width → `custitem1`
- VR (Vertical Repeat) → `custitem_vertical_repeat` (**TESTED & VERIFIED**)
- HR (Horizontal Repeat) → `custitem_horizontal_repeat` (**TESTED & VERIFIED**)
- Repeat → `custitem5`
- Front Content → `custitem_opms_front_content` (Rich Text HTML)
- Back Content → `custitem_opms_back_content` (Rich Text HTML)
- Abrasion → `custitem_opms_abrasion` (Rich Text HTML + file links)
- Firecodes → `custitem_opms_firecodes` (Rich Text HTML + file links)
- Prop 65 Compliance → `custitem_prop65_compliance` (Y/N/D mapping - **TESTED & VERIFIED**)
- AB 2998 Compliance → `custitem_ab2998_compliance` (Y/N/D mapping - **TESTED & VERIFIED**)
- Tariff/Harmonized Code → `custitem_tariff_harmonized_code` (**TESTED & VERIFIED**)
- Vendor Business Name → **`vendor`** (Native Preferred Vendor Field + **itemvendor sublist** - **FULLY INTEGRATED**)
- Vendor Product Name → **`vendorname`** (Native Vendor Name Field - **UPDATED TO NATIVE**)
- Vendor Item Color → `custitem_opms_vendor_color` (**TESTED & VERIFIED**)
- Vendor Item Code → **`vendorcode`** (Native Vendor Code Field + **itemvendor sublist** - **FULLY INTEGRATED**)
- Finish → `custitem_opms_finish` (P_FINISH.name GROUP_CONCAT - **TESTED & VERIFIED**)
- Fabric Width → `custitem_opms_fabric_width` (T_PRODUCT.width - **TESTED & VERIFIED**)
- Item Colors → `custitem_opms_item_colors` (P_COLOR.name with separator conversion - **TESTED & VERIFIED**)
- Cleaning → `custitem_opms_fabric_cleaning` (P_CLEANING.name GROUP_CONCAT - **TESTED & VERIFIED**)
- Origin → `custitem_opms_product_origin` (P_ORIGIN.name GROUP_CONCAT - **TESTED & VERIFIED**)
- Parent Product Name → `custitem_opms_parent_product_name` (T_PRODUCT.name - **TESTED & VERIFIED**)

#### ❌ **Missing Fields (1/24):**

**One-Way Sync (NS → OPMS):**
- Item Application (NS → OPMS)
- Cut Pricing (NS → OPMS)
- Roll Pricing (NS → OPMS)
- Cut Cost (NS → OPMS)
- Roll Cost (NS → OPMS)

### Next Implementation Phase

#### Phase 1: Basic Text Fields
1. **VR Field** - Add `custitem_vr` (Text)
2. **HR Field** - Add `custitem_hr` (Text)  
3. **Tariff Code Field** - Add `custitem_tariff_code` (Text)

#### Phase 2: Enhanced Multi-Select Fields
1. **Color Multi-Select** - Convert from description to proper multi-select
2. **Vendor Multi-Select** - Convert from memo to proper vendor multi-select

#### Phase 3: Compliance & Lists
1. **Prop 65 Compliance** - 3-option radio button
2. **AB 2998 Compliance** - 3-option radio button
3. **Origin Dropdown** - Single-select custom list
4. **Finish Multi-Select** - Multi-select custom list
5. **Cleaning Multi-Select** - Multi-select custom list

### ItemVendor Sublist Integration

The **itemvendor sublist** is NetSuite's native mechanism for associating multiple vendors with inventory items. This provides proper vendor integration beyond just storing vendor names as text.

#### Prerequisites
- **Multiple Vendors Feature**: Must be enabled in NetSuite (Setup → Company → Enable Features → Items & Inventory)
- **Vendor Mapping Database**: `opms_netsuite_vendor_mapping` table with OPMS ↔ NetSuite vendor ID mappings

#### Implementation
- **Primary Vendor**: OPMS vendor mapped to NetSuite vendor internal ID → `vendor` field + itemvendor sublist entry
- **Vendor Code**: OPMS vendor code → `vendorcode` field + itemvendor sublist `vendorcode`
- **Preferred Vendor**: Automatically set to `true` for OPMS-sourced vendors
- **Sublist Population**: RESTlet automatically creates itemvendor sublist entry when `vendor` field is provided

#### Vendor Data Flow
1. **OPMS Vendor Lookup**: `Z_VENDOR.name` from `T_PRODUCT_VENDOR` relationship
2. **NetSuite Mapping**: Query `opms_netsuite_vendor_mapping` for NetSuite vendor internal ID
3. **Payload Building**: Include `vendor` (NetSuite ID), `vendorname` (OPMS name), `vendorcode` (if available)
4. **RESTlet Processing**: Populates both native vendor field and itemvendor sublist entry

#### Validation & Testing
- **Valid Mappings**: Items with mapped vendors populate itemvendor sublist (tested with 5 different vendors)
- **Unmapped Vendors**: Items import successfully with empty vendor fields (graceful degradation)
- **Data Accuracy**: Vendor mapping validation ensures correct NetSuite vendor associations

For detailed implementation guide, see: [ItemVendor Sublist Integration](./ItemVendor-Sublist-Integration.md)

### Technical Notes

- **Mini-form fields** (Front/Back Content, Abrasion, Firecodes) are implemented as Rich Text fields with pre-formatted HTML tables generated by the API
- **File attachments** for Abrasion/Firecodes are handled as S3 download links embedded in the HTML
- **OPMS linkage** maintained via `custitem_opms_product_id` and `custitemopms_item_id` custom fields
- **Two-way sync** fields require additional API endpoints and scheduled sync processes
- **Vendor integration** uses NetSuite's native itemvendor sublist for proper multi-vendor support

