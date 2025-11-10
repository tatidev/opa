# OPMS Database Schema Analysis

## Overview
Analysis of the legacy OPMS database schema extracted from `opuzen_test_master_app.sql` for NetSuite integration compatibility.

**Source:** `dumps/opuzen_test_master_app.sql`  
**Extracted:** Schema-only files created in `DOCS/database/schema/`  
**Total T_* Tables:** 35 core OPMS tables  

## Core Tables for NetSuite Integration

### 1. T_PRODUCT - Product Master Data
```sql
CREATE TABLE `T_PRODUCT` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `type` char(1) NOT NULL DEFAULT 'R',
  `width` decimal(11,2) DEFAULT NULL,
  `vrepeat` decimal(5,2) DEFAULT NULL,
  `hrepeat` decimal(5,2) DEFAULT NULL,
  `lightfastness` varchar(128) DEFAULT NULL,
  `seam_slippage` varchar(128) NOT NULL,
  `outdoor` char(1) NOT NULL DEFAULT 'N',
  `dig_product_name` varchar(50) DEFAULT NULL,
  `dig_width` decimal(11,2) DEFAULT NULL,
  `date_add` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `date_modif` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE CURRENT_TIMESTAMP,
  `in_master` tinyint(1) NOT NULL DEFAULT '0',
  `archived` char(1) NOT NULL DEFAULT 'N',
  `log_vers_id` int NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `name` (`name`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=7593 DEFAULT CHARSET=latin1;
```

**NetSuite Mapping:**
- `id` → OPMS Product ID (custom field)
- `name` → Product Name
- `width` → Width (text field) 
- `vrepeat` → VR (text field)
- `hrepeat` → HR (text field)

### 2. T_ITEM - Product Item Variations
```sql
CREATE TABLE `T_ITEM` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `product_type` varchar(2) NOT NULL,
  `in_ringset` int NOT NULL DEFAULT '0' COMMENT '0 no / 1 yes',
  `code` varchar(9) DEFAULT NULL,
  `status_id` int NOT NULL DEFAULT '1',
  `stock_status_id` int NOT NULL DEFAULT '1',
  `vendor_color` varchar(50) DEFAULT NULL,
  `vendor_code` varchar(50) DEFAULT NULL,
  `roll_location_id` varchar(11) DEFAULT NULL,
  `roll_yardage` decimal(11,2) DEFAULT NULL,
  `bin_location_id` varchar(11) DEFAULT NULL,
  `bin_quantity` int DEFAULT NULL,
  `min_order_qty` varchar(20) DEFAULT NULL,
  `reselections_ids` varchar(1024) DEFAULT NULL,
  `date_add` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `date_modif` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE CURRENT_TIMESTAMP,
  `in_master` tinyint(1) NOT NULL DEFAULT '0',
  `archived` char(11) NOT NULL DEFAULT 'N',
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_product_id` (`product_id`),
  KEY `product_id` (`product_id`,`id`,`product_type`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=42966 DEFAULT CHARSET=latin1;
```

**NetSuite Mapping:**
- `id` → OPMS Item ID (custom field)
- `code` → Item # (Integer - **CONFIRMED** from field mapping)
- `product_id` → Links to T_PRODUCT.id
- Colors → Via T_ITEM_COLOR relationship

### 3. T_ITEM_COLOR - Item Color Relationships
```sql
CREATE TABLE `T_ITEM_COLOR` (
  `item_id` int NOT NULL,
  `color_id` int NOT NULL,
  `n_order` int NOT NULL,
  PRIMARY KEY (`item_id`,`color_id`) USING BTREE,
  KEY `item_id` (`item_id`) USING BTREE,
  KEY `color_id` (`color_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

**Purpose:** Many-to-many relationship between items and colors

## Mini-Form Related Tables

### T_PRODUCT_CONTENT_FRONT & T_PRODUCT_CONTENT_BACK
For Front Content and Back Content mini-forms

### T_PRODUCT_ABRASION & T_PRODUCT_ABRASION_FILES  
For Abrasion mini-forms with file attachments

### T_PRODUCT_FIRECODE & T_PRODUCT_FIRECODE_FILES
For Firecode mini-forms with file attachments

## Additional Product Attribute Tables

### T_PRODUCT_FINISH
For Finish multi-select dropdown

### T_PRODUCT_CLEANING
For Cleaning multi-select dropdown  

### T_PRODUCT_ORIGIN
For Origin dropdown

### T_PRODUCT_VENDOR
For Vendor multi-select dropdown

### T_PRODUCT_USE
For potential Item Application field

## Key Findings for NetSuite Integration

### ✅ Confirmed Field Mappings
1. **Item #**: `T_ITEM.code` (varchar(9)) → NetSuite Integer field
2. **Product Name**: `T_PRODUCT.name` (varchar(50)) → NetSuite Text field
3. **Width**: `T_PRODUCT.width` (decimal(11,2)) → NetSuite Text field
4. **VR**: `T_PRODUCT.vrepeat` (decimal(5,2)) → NetSuite Text field  
5. **HR**: `T_PRODUCT.hrepeat` (decimal(5,2)) → NetSuite Text field

### 5. T_PRODUCT_VARIOUS - Additional Product Attributes
```sql
CREATE TABLE `T_PRODUCT_VARIOUS` (
  `product_id` int NOT NULL,
  `vendor_product_name` varchar(50) NOT NULL,
  `yards_per_roll` varchar(50) NOT NULL,
  `lead_time` varchar(50) NOT NULL,
  `min_order_qty` varchar(50) NOT NULL,
  `tariff_code` varchar(50) NOT NULL,
  `tariff_surcharge` varchar(50) DEFAULT NULL,
  `duty_perc` varchar(50) DEFAULT NULL,
  `freight_surcharge` varchar(64) DEFAULT NULL,
  `vendor_notes` text,
  `railroaded` char(1) NOT NULL DEFAULT 'N',
  `prop_65` char(1) DEFAULT NULL,
  `ab_2998_compliant` char(1) DEFAULT NULL,
  `dyed_options` char(1) DEFAULT NULL,
  `weight_n` decimal(5,2) DEFAULT NULL,
  `weight_unit_id` int DEFAULT NULL,
  `date_add` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` int NOT NULL DEFAULT '0',
  UNIQUE KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
```

**NetSuite Mapping:**
- `prop_65` → Prop 65 Compliance (Y/N radio button)
- `ab_2998_compliant` → AB 2998 Compliance (Y/N radio button)  
- `tariff_code` → Tariff/Harmonized Code (text field)

### 6. T_PRODUCT_VENDOR & Z_VENDOR - Vendor Relationships
```sql
CREATE TABLE `T_PRODUCT_VENDOR` (
  `product_id` int NOT NULL,
  `vendor_id` int NOT NULL,
  `date_add` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`product_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE `Z_VENDOR` (
  `id` int NOT NULL AUTO_INCREMENT,
  `abrev` varchar(15) DEFAULT NULL,
  `name` varchar(40) DEFAULT NULL,
  `date_add` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `date_modif` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE CURRENT_TIMESTAMP,
  `user_id` int NOT NULL DEFAULT '1',
  `active` char(1) NOT NULL DEFAULT 'Y',
  `archived` varchar(1) NOT NULL DEFAULT 'N',
  PRIMARY KEY (`id`),
  KEY `Z_VENDOR_id_name_index` (`id`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=269 DEFAULT CHARSET=latin1;
```

**NetSuite Mapping:**
- `Z_VENDOR.name` → Vendor (multi-select dropdown)
- Links via T_PRODUCT_VENDOR.vendor_id → Z_VENDOR.id

### ✅ All Fields Located
1. **Prop 65 Compliance**: `T_PRODUCT_VARIOUS.prop_65` (char(1)) ✅
2. **AB 2998 Compliance**: `T_PRODUCT_VARIOUS.ab_2998_compliant` (char(1)) ✅
3. **Colors**: Via T_ITEM_COLOR → P_COLOR.name ✅
4. **Vendor**: Via T_PRODUCT_VENDOR → Z_VENDOR.name ✅
5. **Tariff/Harmonized Code**: `T_PRODUCT_VARIOUS.tariff_code` (varchar(50)) ✅

### 4. P_COLOR - Color Master Data
```sql
CREATE TABLE `P_COLOR` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `date_add` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `date_modif` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE CURRENT_TIMESTAMP,
  `user_id` int NOT NULL,
  `active` char(1) NOT NULL DEFAULT 'Y',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7585 DEFAULT CHARSET=latin1;
```

**NetSuite Mapping:**
- `name` → Color names for multi-select dropdown
- Links via T_ITEM_COLOR.color_id → P_COLOR.id

### 📋 Complete Data Query for NetSuite Integration
```sql
-- Complete item data with all NetSuite fields
SELECT 
    i.id as item_id,
    i.code as item_code,
    i.product_id,
    p.name as product_name,
    p.width,
    p.vrepeat,
    p.hrepeat,
    
    -- Colors (multi-select)
    GROUP_CONCAT(DISTINCT c.name ORDER BY ic.n_order SEPARATOR ', ') as colors,
    
    -- Compliance fields from T_PRODUCT_VARIOUS
    pv.prop_65,
    pv.ab_2998_compliant,
    pv.tariff_code,
    
    -- Vendor (multi-select) 
    GROUP_CONCAT(DISTINCT v.name SEPARATOR ', ') as vendors,
    
    -- Additional fields for mini-forms
    p.outdoor as repeat_field  -- Assuming this is the 'Repeat' checkbox
    
FROM T_ITEM i
JOIN T_PRODUCT p ON i.product_id = p.id
LEFT JOIN T_ITEM_COLOR ic ON i.id = ic.item_id
LEFT JOIN P_COLOR c ON ic.color_id = c.id AND c.active = 'Y'
LEFT JOIN T_PRODUCT_VARIOUS pv ON p.id = pv.product_id
LEFT JOIN T_PRODUCT_VENDOR pven ON p.id = pven.product_id
LEFT JOIN Z_VENDOR v ON pven.vendor_id = v.id AND v.active = 'Y' AND v.archived = 'N'
WHERE i.archived = 'N' AND p.archived = 'N'
GROUP BY i.id, p.id, pv.product_id;
```

## Database Compatibility Requirements

### ✅ Legacy Schema Compliance
- **Table Names**: Use original `T_PRODUCT`, `T_ITEM`, etc.
- **Field Names**: Preserve `product_id`, `color_id`, `vrepeat`, `hrepeat`
- **Data Types**: Handle `decimal(11,2)`, `varchar(50)`, `char(1)`, `tinyint(1)`
- **Relationships**: Respect existing foreign key patterns

### ✅ API Response Format
```javascript
{
  // Modern API format
  "id": 123,
  "itemCode": "ABC123",
  "productName": "Sample Product",
  "width": 54.00,
  "verticalRepeat": 12.5,
  "horizontalRepeat": 8.25,
  "colors": ["Red", "Blue"],
  
  // Legacy format preserved
  "legacy": {
    "id": 123,
    "code": "ABC123", 
    "product_id": 456,
    "width": 54.00,
    "vrepeat": 12.5,
    "hrepeat": 8.25
  }
}
```

## Next Steps

### 1. Model Updates Required
- **ProductModel.js**: Update to use `T_PRODUCT` table structure
- **ItemModel.js**: Update to use `T_ITEM` table structure  
- **ColorModel.js**: Create for `T_COLOR` table access

### 2. Field Mapping Validation
- Investigate `legacy_app` for Prop 65 & AB 2998 compliance sources
- Verify color name resolution via T_ITEM_COLOR → T_COLOR
- Confirm vendor data structure in T_PRODUCT_VENDOR

### 3. NetSuite Integration Updates
- Update field transformations to match exact OPMS field names
- Implement proper join queries for related data
- Add support for mini-form HTML generation from related tables

### 4. Testing Requirements
- Test against actual OPMS database connection
- Verify all field mappings with real data
- Validate NetSuite sync with legacy data structure

## Files Created
- `DOCS/database/schema/opms-tables-overview.sql` - Quick table overview
- `DOCS/database/schema/opms-full-schema.sql` - Complete schema
- `DOCS/database/schema/opms-t-tables.sql` - T_* tables only
- `DOCS/database/schema/opms-schema-analysis.md` - This analysis document

## Schema Validation Status
- ✅ **Core tables identified**: T_PRODUCT, T_ITEM, T_ITEM_COLOR
- ✅ **Field mappings confirmed**: Item #, Product Name, Width, VR, HR
- ⚠️ **Investigation needed**: Prop 65, AB 2998 compliance sources
- ✅ **Mini-form tables identified**: Content, Abrasion, Firecode with files
- ✅ **Relationship patterns understood**: Foreign keys and join requirements

**Ready for legacy_app investigation and model implementation updates.**