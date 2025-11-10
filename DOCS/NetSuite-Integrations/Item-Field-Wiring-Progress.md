### NetSuite Inventory Item Field Wiring Progress (OPMS → NS via API)

| OPMS Field | NS Field | Direction | API Support (C/R/U/D) | Status | Tested (date) | Notes |
|---|---|---|---|---|---|---|
| Item # | itemId (itemid) | OPMS → NS | C | ✅ Done | 2025-08-09 | Create via RESTlet; exposes POST /api/netsuite/items |
| Product Name | displayName | OPMS → NS | C | ✅ Done | 2025-08-09 | Working in same POST payload |
| OPMS Product ID | custitem_opms_prod_id | OPMS → NS | C | ✅ Done | 2025-08-09 | Numeric field; API field: opmsProductId |
| OPMS Item ID | custitemopms_item_id | OPMS → NS | C | ✅ Done | 2025-08-09 | Numeric field; API field: opmsItemId |
| Width | custitem1 | OPMS → NS | C | ✅ Done | 2025-08-09 | Text field; API field: width; tested with "48 inches" |
| Repeat | custitem5 | OPMS → NS | C | ✅ Done | 2025-08-09 | Checkbox field; API field: repeat; stores T/F in NetSuite |
| Front Content | custitem_opms_front_content | OPMS → NS | C/R/U | ✅ Done | 2025-08-11 | **Rich Text field with pre-formatted HTML tables**; API field: frontContent; renders beautiful tables; **Auto-inherits from parent product** |
| Back Content | custitem_opms_back_content | OPMS → NS | C/R/U | ✅ Done | 2025-08-11 | **Rich Text field with pre-formatted HTML tables**; API field: backContent; renders beautiful tables; **Auto-inherits from parent product** |
| Abrasion | custitem_opms_abrasion | OPMS → NS | C/R/U | ✅ Done | 2025-08-11 | **Rich Text field with pre-formatted HTML table and real S3 file download links**; API field: abrasion; **Auto-inherits from parent product with real file URLs** |
| Firecodes | custitem_opms_firecodes | OPMS → NS | C/R/U | ✅ Done | 2025-08-11 | **Rich Text field with pre-formatted HTML table and real S3 file download links**; API field: firecodes; **Auto-inherits from parent product with real file URLs** |

### 🎯 **MAJOR BREAKTHROUGH: Complete Mini-Forms Integration (2025-08-11)**

**✅ Product CRUD with Mini-Forms:**
- `GET /api/products/:id/mini-forms/:type` - Get mini-forms data with real file URLs
- `GET /api/products/:id/with-miniforms` - Get product with all mini-forms included
- ProductModel methods: `getMiniFormsData()`, `getProductWithMiniforms()`

**✅ Auto-Inheritance from Parent Product:**
- NetSuite item creation automatically inherits mini-forms data from parent product
- When `opmsProductId` is provided, API fetches and includes all mini-forms data
- Real file URLs from OPMS database (`https://opms.opuzen-service.com/` + `url_dir`)
- Comprehensive logging of inheritance process

**✅ Real File Integration:**
- Fixed database schema queries (using correct column names: `AT.name`, `AL.name`, `FT.name`, `PC.name`, `A.n_rubs`)
- Real file URLs constructed from `T_PRODUCT_ABRASION_FILES.url_dir` and `T_PRODUCT_FIRECODE_FILES.url_dir`
- Clickable download links embedded in NetSuite Rich Text fields

Legend
- C/R/U/D: Create, Read, Update, Delete support in our API.
- Status values: Planned, In Progress, Done, Blocked.

Process
1) Implement field mapping in API (RESTlet-backed).
2) Test against NS sandbox (create or update).
3) Record in this table (status + date + notes).
4) Commit with concise message per field.

