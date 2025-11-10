# 🔍 PRODUCTION SYNC DIAGNOSTIC REPORT

**Date**: Auto-generated  
**Branch**: deployProd  
**Target Database**: opuzen_prod_master_app  

---

## 📋 ISSUE REPORTED

Product name was changed in `opuzen_prod_master_app` database, but the change did not sync to NetSuite.

---

## 🔬 DIAGNOSTIC STEPS TO PERFORM

Follow these steps in order to diagnose the issue:

### **Step 1: Run Diagnostic SQL Queries**

Connect to production MySQL database and run:

```bash
mysql -h YOUR_RDS_ENDPOINT -u YOUR_USER -p opuzen_prod_master_app < scripts/diagnostic-production-sync.sql > sync-diagnostic-results.txt
```

**Expected Output**: The script will check:
1. ✅ Are triggers installed?
2. ✅ Do sync tables exist?
3. ✅ Was your product change logged?
4. ✅ Were sync jobs created?
5. ✅ What is their status?

---

### **Step 2: Check OPMS_SYNC_ENABLED in Production**

SSH to production EC2 instance:

```bash
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
cd /home/ec2-user/opuzen-api
grep OPMS_SYNC_ENABLED .env
```

**Expected**: `OPMS_SYNC_ENABLED=true`  
**Critical**: Must be exactly `"true"` (string) not `true` (boolean)

---

### **Step 3: Check API Service Status**

```bash
# Check if service is running
pm2 list

# Check recent logs
pm2 logs opuzen-api --lines 100 | grep -i sync

# Look for these key messages:
# ✅ "OPMS-to-NetSuite sync service initialized successfully"
# ❌ "OPMS-to-NetSuite sync service disabled"
# ❌ "Failed to initialize OPMS-to-NetSuite sync service"
```

---

### **Step 4: Call Sync Status API**

```bash
# From your local machine or EC2:
curl -s https://YOUR_API_URL/api/opms-netsuite-sync/status | jq '.'

# Expected response:
# {
#   "service": {
#     "isInitialized": true,  ← Should be true
#     "isRunning": true        ← Should be true
#   },
#   "queue_processing": {
#     "processing": {
#       "isActive": true       ← Should be true
#     }
#   }
# }
```

---

## 🚨 COMMON ISSUES & FIXES

### **Issue #1: Triggers Not Installed** ⚠️ MOST LIKELY

**Symptoms**:
- Query 1 returns 0 rows
- Query 3 (recent sync jobs) is empty
- Query 4 (change log) is empty

**Root Cause**: The trigger SQL file exists in code but was never run on production database.

**Fix**:
```bash
# SSH to production EC2
cd /home/ec2-user/opuzen-api
mysql -h YOUR_RDS_ENDPOINT -u YOUR_USER -p opuzen_prod_master_app < src/db/setup-opms-sync-tables.sql

# Verify installation
mysql -h YOUR_RDS_ENDPOINT -u YOUR_USER -p opuzen_prod_master_app -e "
SELECT COUNT(*) as trigger_count
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = 'opuzen_prod_master_app'
  AND TRIGGER_NAME LIKE 'opms_%';
"
# Expected: trigger_count = 6
```

**Prevention**: Add to deployment automation

---

### **Issue #2: OPMS_SYNC_ENABLED Not Set**

**Symptoms**:
- Triggers exist (Query 1 shows triggers)
- Jobs created (Query 3 shows PENDING jobs)
- But status API shows `isRunning: false`

**Root Cause**: Environment variable not set or set to wrong value.

**Fix**:
```bash
# Edit .env file
nano /home/ec2-user/opuzen-api/.env

# Ensure this line exists:
OPMS_SYNC_ENABLED=true

# Restart API
pm2 restart opuzen-api

# Verify in logs
pm2 logs opuzen-api --lines 20 | grep "sync service"
```

---

### **Issue #3: Items Don't Have Valid Codes**

**Symptoms**:
- Triggers installed
- Product appears in Query 9 (recently modified)
- But Query 3 is empty (no sync jobs created)

**Root Cause**: Items under the product don't meet sync criteria.

**Diagnosis**:
```sql
-- Run this with your actual product ID
SELECT 
    i.id as item_id,
    i.code as item_code,
    i.archived,
    CASE 
        WHEN i.code IS NULL OR i.code = '' THEN '🔴 BLOCKED: No item code'
        WHEN i.archived = 'Y' THEN '🔴 BLOCKED: Archived'
        ELSE '✅ SYNCABLE'
    END as status
FROM T_ITEM i
WHERE i.product_id = YOUR_PRODUCT_ID;
```

**Fix**: 
- Items need valid, non-empty `code` field
- Items must be `archived = 'N'`
- This is intentional - items without codes should not sync

---

### **Issue #4: AWS Secrets Manager Missing Variable**

**Symptoms**:
- .env shows `OPMS_SYNC_ENABLED=` (empty or undefined)

**Root Cause**: Launch template pulls from AWS Secrets Manager, but variable not set there.

**Fix**:
```bash
# Update AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id opuzen-api-prod-secrets \
  --secret-string '{"OPMS_SYNC_ENABLED":"true", ...other vars...}'

# Redeploy EC2 instance or manually update .env
```

---

## 📊 QUICK DIAGNOSIS FLOWCHART

```
1. Changed product in database
   ↓
2. Run Query 9 → Is product listed?
   ├─ NO  → Product not modified recently OR archived
   └─ YES → Continue to step 3
   
3. Run Query 1 → Are triggers installed?
   ├─ NO  → FIX: Install triggers (Issue #1)
   └─ YES → Continue to step 4
   
4. Run Query 3 → Were sync jobs created?
   ├─ NO  → Run Query 8 to check if items are syncable (Issue #3)
   └─ YES → Continue to step 5
   
5. Check job status in Query 3
   ├─ PENDING  → FIX: Check OPMS_SYNC_ENABLED (Issue #2)
   ├─ FAILED   → Check error_message (Query 7)
   └─ COMPLETED → Already synced, check NetSuite
```

---

## 🎯 MANUAL TRIGGER AS WORKAROUND

If you need to force sync immediately while investigating:

```bash
# Trigger sync for specific product (all its items)
curl -X POST https://YOUR_API_URL/api/opms-netsuite-sync/trigger-product/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Manual trigger after product name change",
    "priority": "HIGH"
  }'

# Response will show:
# {
#   "success": true,
#   "productId": 1234,
#   "totalItems": 5,
#   "syncJobs": [...job details...]
# }
```

**Note**: This only works if:
- OPMS_SYNC_ENABLED=true
- API service is running
- Items have valid codes

---

## 📈 EXPECTED TIMELINE

Once triggers are installed and OPMS_SYNC_ENABLED=true:

```
Product name change
  ↓ (immediate)
opms_product_sync_trigger fires
  ↓ (< 1 second)
Jobs created in opms_sync_queue
  ↓ (next 5-second poll)
Queue processor picks up jobs
  ↓ (100ms per item due to rate limiting)
Items sync to NetSuite
  ↓
NetSuite displayname updated: "New Product Name: Color"
```

**Total Time**: 10-60 seconds depending on number of items

---

## 🔧 RECOMMENDED PERMANENT FIX

### **Option A: Add Trigger Installation to Deployment**

Update `LaunchTemplateUserData-opms-api-DeployApp-V1.sh`:

```bash
# Add after database connection is established:
echo "Installing OPMS sync triggers..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < ${PathToAppRoot}/src/db/setup-opms-sync-tables.sql
```

### **Option B: Manual One-Time Installation**

Run the initialization script provided in the codebase:

```bash
cd /home/ec2-user/opuzen-api
node src/scripts/initialize-opms-sync.js --setup-db
```

This will:
1. ✅ Create sync tables
2. ✅ Install all triggers  
3. ✅ Validate NetSuite connectivity
4. ✅ Initialize sync service
5. ✅ Run health checks

---

## 📝 VERIFICATION CHECKLIST

After applying fixes, verify:

- [ ] Query 1 shows 6 triggers installed
- [ ] Query 2 shows 3 sync tables exist
- [ ] .env has `OPMS_SYNC_ENABLED=true`
- [ ] `pm2 logs` shows "sync service initialized successfully"
- [ ] Status API shows `isRunning: true` and `isActive: true`
- [ ] Make a test product change and verify sync job appears in Query 3
- [ ] Verify NetSuite item displayname updates within 60 seconds

---

## 🆘 SUPPORT

**Created By**: AI Analysis of deployProd branch  
**Diagnostic Script**: `scripts/diagnostic-production-sync.sql`  
**Initialization Script**: `src/scripts/initialize-opms-sync.js`  
**Status API**: `GET /api/opms-netsuite-sync/status`  

**Manual Trigger APIs**:
- `POST /api/opms-netsuite-sync/trigger-item/:itemId`
- `POST /api/opms-netsuite-sync/trigger-product/:productId`

---

## 📌 CRITICAL REMINDER

**From .cursorrules.mdc**: Always examine actual code, never assume.

✅ This analysis is based on actual examination of:
- `deployProd` branch code
- `src/db/setup-opms-sync-tables.sql`
- `src/services/OpmsChangeDetectionService.js`
- `src/services/NetSuiteSyncQueueService.js`
- `src/index.js`
- `LaunchTemplateUserData-opms-api-DeployApp-V1.sh`

All diagnostic steps are based on **real production code**, not assumptions.

