# NetSuite Custom Fields Reconciliation

**Generated**: September 10, 2025  

## Summary

Reconciliation of NetSuite custom fields for OPMS integration. All fields actively used by OPMS API are marked "KEEP". "NOT USED" fields are documented for reference but not part of current integration.

---

## Custom Fields by Category

### Core OPMS Data (18 fields)
| Field | Purpose | Status |
|-------|---------|--------|
| `custitem_opms_item_id` | OPMS Item ID linkage | **KEEP** |
| `custitem_opms_product_id` | OPMS Product ID linkage | **KEEP** |
| `custitem_opms_parent_product_name` | Parent product name | **KEEP** |
| `custitem_opms_fabric_width` | Fabric width measurement | **KEEP** |
| `custitem_is_repeat` | Repeat pattern indicator | **KEEP** |
| `custitem_opms_item_colors` | Item color names | **KEEP** |
| `custitem_opms_vendor_color` | Vendor's color code | **KEEP** |
| `custitem_opms_vendor_prod_name` | Vendor's product name | **KEEP** |
| `custitem_opms_finish` | Product finish information | **KEEP** |
| `custitem_opms_fabric_cleaning` | Cleaning instructions | **KEEP** |
| `custitem_opms_product_origin` | Country of origin | **KEEP** |
| `custitem_vertical_repeat` | Vertical repeat measurement | **KEEP** |
| `custitem_horizontal_repeat` | Horizontal repeat measurement | **KEEP** |
| `custitem_prop65_compliance` | Prop 65 compliance status | **KEEP** |
| `custitem_ab2998_compliance` | AB 2998 compliance status | **KEEP** |
| `custitem_tariff_harmonized_code` | Tariff/harmonized code | **KEEP** |
| `custitemf3_lisa_item` | Lisa Slayman item checkbox | **KEEP** |
| `custitem_item_application` | Item application/use cases | **KEEP** |
| `custitem_f3_rollprice` | FOLIO 3 roll price | **KEEP** |

### OPMS Mini-Forms Rich Text (4 fields)
| Field | Purpose | Status |
|-------|---------|--------|
| `custitem_opms_front_content` | Front content HTML | **KEEP** |
| `custitem_opms_back_content` | Back content HTML | **KEEP** |
| `custitem_opms_abrasion` | Abrasion test results HTML | **KEEP** |
| `custitem_opms_firecodes` | Fire code certifications HTML | **KEEP** |

### Additional FOLIO 3 Fields (Not Used)
| Field | Description | Status |
|-------|-------------|--------|
| `custitem_f3_width` | FOLIO 3 width field | **NOT USED** |
| `custitem_f3_item_application` | FOLIO 3 item application | **NOT USED** |
| `custitem_f3_repeat` | FOLIO 3 repeat field | **NOT USED** |
| `custitem_f3_item_number` | FOLIO 3 item number | **NOT USED** |
| `custitem_f3_content` | FOLIO 3 content field | **NOT USED** |
| `custitemf3_pattern_no` | FOLIO 3 pattern number | **NOT USED** |

### Additional ALN System Fields (Not Used)
| Field | Description | Status |
|-------|-------------|--------|
| `custitem_aln_1_auto_numbered` | ALN auto-numbering flag | **Folio 3** |
| `custitem_aln_2_number_format` | ALN number format | **Folio 3** |
| `custitem_aln_3_initial_sequence` | ALN initial sequence | **Folio 3** |

### Additional Other Fields (Not Used)
| Field | Description | Status |
|-------|-------------|--------|
| `custitem_alf_print_item_name` | ALF print item name | **NOT USED** |
| `custitem_atlas_item_image` | Atlas item image field | **NOT USED** |

---

## Notes

**KEEP Fields**: All 24 fields are production-ready with complete OPMS→NetSuite integration including field validation, HTML generation for mini-forms, and proper data mapping.

**NOT USED Fields**: 7 fields documented for reference but not implemented in current OPMS integration (5 FOLIO 3 + 3 ALN + 1 Other).
