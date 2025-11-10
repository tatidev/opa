# OPMS API Integration Role — Deployment Guide (No CSV Myths)

## Why there is no CSV import for roles
NetSuite’s CSV Import Assistant cannot create or modify **roles** or **role permissions**.  
To “import” a role in an automated, auditable way, use **SuiteCloud Development Framework (SDF)** and deploy the role as a customization object. Otherwise, use the **UI** to configure it.

---

## Option A — Fastest: Configure via UI (2–3 minutes)

1. Go to **Setup → Users/Roles → Manage Roles → New**  
   - **Name:** OPMS API Integration Role  
   - **Center Type:** Standard/Classic (any is fine; RESTlets don’t care)  
   - **Web Services Only:** Unchecked  
   - **Two-Factor Required:** Optional  
   - **Subsidiary Restrictions (OneWorld):** Opuzen (ID: 2) — **Full** (or as needed)
   - Save once to unlock sub-tabs.

2. **Permissions → Lists**
   - Items — **Full**  
   - Vendors — **View**  
   - Accounts — **View**  
   - (Optional) Units of Measure — **View**

3. **Permissions → Setup**
   - Set Up Taxes — **View**  *(or)* Accounting Lists — **View**  
   - (Optional) Access Token Management — **Full**  *(only for admins minting tokens)*

4. **Permissions → Transactions**
   - *(none needed for your current RESTlet)*

5. **Subsidiaries (OneWorld)**
   - Ensure **Opuzen (ID: 2)** is allowed (Full).

6. **Custom Fields (visibility)**
   - For each `custitem_opms_*` field your RESTlet sets (≈30), open the field:  
     **Customization → Lists, Records, & Fields → Item Fields → [field] → Access**  
     - Make sure the field is **Available to All Roles** *or* explicitly include **OPMS API Integration Role**.

7. **Assign to API User**
   - **Lists → Employees → [Integration Employee] → Access**: add **OPMS API Integration Role**.

8. **Set up Integration + Token**
   - **Setup → Integrations → Manage Integrations → New** → name it **OPMS API**, **Enabled** → record **Consumer Key/Secret**.
   - **Setup → Users/Roles → Access Tokens → New** → choose **OPMS API Integration**, **API Employee**, **OPMS API Integration Role** → record **Token ID/Secret**.

9. **Script Deployment Audience**
   - **Customization → Scripting → Script Deployments → [Your RESTlet] → Audience**: add **OPMS API Integration Role** (or the Employee).

**Smoke-test cues**
- 403 on save → add **Items — Full** (or remove blocking workflows/client scripts via an “API Item Form”).  
- Error setting `taxschedule` → add **Set Up Taxes — View** (or **Accounting Lists — View**).  
- Error on `itemvendor` commit → add **Vendors — View**.  
- Error setting `incomeaccount`/`cogsaccount` → add **Accounts — View**.  
- Subsidiary complaints → confirm **Opuzen (ID: 2)** access.

---

## Option B — Automated & Repeatable: Deploy via SuiteCloud SDF

> Use SDF to version-control and deploy the role as a customization object. This is the real “import.”

### Prereqs
- SuiteCloud CLI installed on your machine.
- Role-enabled account (Administrator or a developer role with SDF permissions).
- A SuiteCloud project linked to the target account.

### Workflow

1. **Create / open** a SuiteCloud project (local folder).

2. **Fetch** existing objects (optional, helpful if you want to start from a similar role):

    suitecloud object:import --type ROLE --all

3. **Add / edit** the role object in the project (file lives under something like:
   `~/src/objects/role/OPMS_API_Integration_Role.xml`).  
   Define:
   - Name, Center type, Subsidiary restrictions (Opuzen ID:2)  
   - Permissions Lists: Items=Full, Vendors=View, Accounts=View, (UoM=View)  
   - Permissions Setup: Set Up Taxes=View (or Accounting Lists=View), (Access Token Mgmt=Full optional)

   *Note:* The exact XML schema varies by SDF version. Use **object:import** on a role you build once in UI, then use that XML as your template to keep the tags/names 100% accurate for your account.

4. **Deploy** the project (role included):

    suitecloud project:deploy --accountspecificvalues WARNING

5. **Verify** in NetSuite:
   - **Manage Roles** shows **OPMS API Integration Role** with the specified permissions.
   - Add the role to your **API Employee** and create the TBA token as usual.

**Why SDF over CSV:** Roles/permissions are customization objects, not CSV-importable records. SDF is the supported, audited path, and it keeps your permissions under source control.

---

## Permission Grid (for documentation / review)

Use this CSV in your docs (not importable) to track exactly what the role must have. It mirrors your RESTlet behavior (create/update Lot Numbered Inventory Items, vendor sublist upserts, 30+ custom fields).

    Section,Permission,Level,Reason
    Lists,Items,Full,Create/Edit/Load/Save Lot Numbered Inventory Items and custom fields
    Lists,Vendors,View,Allow selecting/reading vendor on itemvendor sublist
    Lists,Accounts,View,Allow setting incomeaccount/cogsaccount by internal ID
    Lists,Units of Measure,View,Optional if form references UoM
    Setup,Set Up Taxes,View,Permit setting taxschedule (alt: Accounting Lists=View)
    Setup,Accounting Lists,View,Alternate to Set Up Taxes visibility
    Setup,Access Token Management,Full,Optional (only for token administration)
    Transactions,Find Transaction,View,Optional for future queries
    OneWorld,Subsidiaries (Opuzen ID:2),Full,Constrain the role to subsidiary 2

---

## Field-level visibility (critical for custom fields)

Your RESTlet writes ≈30 `custitem_*` fields, including:
- Required: `custitem_opms_prod_id`, `custitem_opms_item_id`
- Large JSON text: `custitem_opms_front_content`, `custitem_opms_back_content`, `custitem_opms_abrasion`, `custitem_opms_firecodes`
- Vendor meta: `custitem_opms_vendor_color`, `custitem_opms_vendor_prod_name`, `custitem_opms_vendor_name`
- Product meta: `custitem_opms_fabric_width`, `custitem_opms_item_colors`, `custitem_opms_finish`, etc.

**Action:** For each field → **Access** tab → ensure **Available to All Roles** or explicitly include **OPMS API Integration Role**.  
Record-level permission (Items — Full) is necessary but **not sufficient** if the field’s Access tab blocks the role.

---

## RESTlet coverage checklist (your code paths)
- ✅ `record.create({ type: LOT_NUMBERED_INVENTORY_ITEM })`
- ✅ `setValue()` on ~30 custom fields and native fields (including `taxschedule`, `incomeaccount`, `cogsaccount`)
- ✅ Sublist: `itemvendor` (new line, set `vendor`, `vendorcode`, `preferredvendor`, commit)
- ✅ `record.save()`
- ✅ `record.load()` (post-save verification)
- ⏳ Optional future: `search.create()` (if you add find-by-itemid; ensure Items=View at minimum)

---

## Sanity Smoke Test (TBA)

    curl -X POST "https://<ACCOUNT>.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=<id>&deploy=1" \
      -H 'Authorization: OAuth ...' \
      -H 'Content-Type: application/json' \
      -d '{"itemId":"EX-123","upcCode":"123456789012","taxScheduleId":<internalId>,"custitem_opms_product_id":101,"custitem_opms_item_id":202,"vendor":<internalId>}'

**Interpreting errors quickly**
- 403 on save → add **Items — Full** (or remove blocking workflow / use an API-friendly item form)  
- Can’t set `taxschedule` → add **Set Up Taxes — View** (or **Accounting Lists — View**)  
- Can’t set `incomeaccount`/`cogsaccount` → add **Accounts — View**  
- Sublist commit fails → add **Vendors — View**  
- Subsidiary error → confirm **Opuzen (ID: 2)** access

---

## Bottom line
- **CSV import for roles doesn’t exist.**  
- Use **UI** for speed, or **SDF** for real “import” + version control.  
- With the grid above, your RESTlet has every permission it needs — no more, no less.
