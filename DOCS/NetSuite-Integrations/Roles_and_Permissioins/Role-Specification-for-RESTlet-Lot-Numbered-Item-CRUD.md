# OPMS API Integration Role (Final Spec)

**Purpose:**  
Secure, least-privilege role for Token-Based Authentication (TBA) to run RESTlets performing
Lot Numbered Inventory Item creation, updates, and vendor sublist operations — including
all ~30 `custitem_*` custom fields and restricted to Opuzen subsidiary (ID: 2).

---

## 1️⃣ Enable Account Features (one-time)
**Path:** Setup → Company → Enable Features

### Items & Inventory
- ✅ Inventory  
- ✅ Lot Tracking (Track Lot Numbers)

### SuiteCloud
- ✅ SuiteScript  
- ✅ Token-Based Authentication  
- ✅ REST Web Services  

---

## 2️⃣ Create Role
**Path:** Setup → Users/Roles → Manage Roles → New

| Setting | Value |
|----------|--------|
| **Name** | `OPMS API Integration Role` |
| **Center Type** | Standard Center |
| **Web Services Only** | ❌ Unchecked |
| **Two-Factor Required** | ❌ Optional |
| **Subsidiary Restrictions** | ✅ Opuzen (ID: 2) — Full Access |
| **Description** | Used by OPMS Integration REST API for item and vendor operations. |

---

## 3️⃣ Setup Permissions
| Permission | Level | Reason |
|-------------|--------|--------|
| **Log in using Access Tokens** | Full | Required for TBA authentication |
| **SuiteScript** | Full | Allows RESTlet execution via `record` and `search` APIs |
| **REST Web Services** | Full | Ensures RESTlet + external API compatibility |

---

## 4️⃣ Lists Permissions
| Permission | Level | Reason |
|-------------|--------|--------|
| **Items** | Full | Required for all CRUD operations and sublist writes |
| **Vendors** | View | Needed to associate and list vendors via `itemvendor` sublist |
| **Accounts** | View | Allows setting `incomeaccount` and `cogsaccount` |
| **Units of Measure** | View | Needed if item form references UoM |
| **Custom Record Access** | Full | Only if your RESTlet touches any `customrecord_*` tables |

---

## 5️⃣ Transactions Permissions
| Permission | Level | Reason |
|-------------|--------|--------|
| **Find Transaction** | View | Enables searching related transactions if later extended |

---

## 6️⃣ Subsidiary Access
| Subsidiary | Level | Reason |
|-------------|--------|--------|
| **Opuzen (ID: 2)** | Full | Required, hardcoded in RESTlet; all items created under subsidiary 2 |

---

## 7️⃣ Custom Field Visibility
**Critical Custom Fields**
| Field ID | Required | Role Access |
|-----------|-----------|--------------|
| `custitem_opms_prod_id` | ✅ Required | Ensure “Available to all roles” or add role manually |
| `custitem_opms_item_id` | ✅ Required | Same as above |
| `custitem_opms_front_content` | Optional | Same as above |
| `custitem_opms_back_content` | Optional | Same as above |
| `custitem_opms_abrasion` | Optional | Same as above |
| `custitem_opms_firecodes` | Optional | Same as above |
| `custitem_opms_vendor_color` | Optional | Same as above |
| `custitem_opms_vendor_prod_name` | Optional | Same as above |
| `custitem_opms_vendor_name` | Optional | Same as above |
| `custitem_opms_fabric_width` | Optional | Same as above |
| `custitem_opms_item_colors` | Optional | Same as above |
| `custitem_opms_finish` | Optional | Same as above |
| *(and all other `custitem_opms_*`)* | | Must allow role access |

> **Note:** Go to each custom field → Access tab → verify “Roles” includes `OPMS API Integration Role` or “Available to All Roles”.

---

## 8️⃣ Specific Record Operations Supported

✅ `record.create()` — Create new `LOT_NUMBERED_INVENTORY_ITEM`  
✅ `record.load()` — Load existing inventory item  
✅ `record.save()` — Save changes  
✅ `search.create()` — Lookup items by `itemid` (add **Lists > Items: View** if you only read)  
✅ Sublist manipulation (`selectNewLine`, `setCurrentSublistValue`, `commitLine`) — for `itemvendor` lines  

---

## 9️⃣ Integration + Token Configuration
**Path:** Setup → Integrations → Manage Integrations → New
- Name: `OPMS API Integration`
- State: Enabled  
- Note **Consumer Key / Consumer Secret**

Then create Token:
- Setup → Users/Roles → Access Tokens → New  
  - Application: OPMS API Integration  
  - User: Integration Employee  
  - Role: OPMS API Integration Role  
  - Save → Note **Token ID / Token Secret**

---

## 🔒 Common Permission Issues
| Error | Likely Fix |
|-------|-------------|
| “Insufficient permissions” (general) | Ensure **Items — Full** |
| “Vendor not found” | Add **Vendors — View** |
| “You do not have permissions to set this value (taxschedule)” | Add **Set Up Taxes — View** |
| “You do not have permissions to set this value (income/cogs)” | Add **Accounts — View** |
| “Subsidiary invalid” | Grant **Opuzen (ID: 2)** Full Access |
| “Custom field missing” | Add role to each custom field Access tab |

---

## 🧠 Final Checklist
- [x] Items — Full  
- [x] Vendors — View  
- [x] Accounts — View  
- [x] SuiteScript — Full  
- [x] REST Web Services — Full  
- [x] Log in using Access Tokens — Full  
- [x] Custom fields visible to role  
- [x] Opuzen subsidiary access  
- [x] TBA Integration + Token created  
- [x] Role added to RESTlet Deployment audience  

✅ **Result:**  
The `OPMS API Integration Role` fully supports item CRUD, vendor sublist upserts, and all `custitem_*` fields, scoped securely to subsidiary Opuzen (ID: 2), and is compliant for RESTlet + TBA execution.