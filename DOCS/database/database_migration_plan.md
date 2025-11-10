# Database Migration Plan - OPMS API Integration

**Date:** January 19, 2025  
**Version:** 1.0.0  
**Status:** Ready for Approval  
**Purpose:** Safe migration plan to add API tables to legacy OPMS database

## 🛡️ **SAFETY PRINCIPLES**

This migration plan follows strict safety protocols to protect the legacy OPMS database:

- **✅ ZERO ALTERATIONS** to existing OPMS tables
- **✅ ADDITIVE ONLY** - Only create new tables
- **✅ REVERSIBLE** - All migrations can be rolled back
- **✅ TRANSACTION SAFE** - Each migration runs in transaction
- **✅ BACKUP FRIENDLY** - Safe to run with database backups
- **✅ NON-DESTRUCTIVE** - No data deletion or modification
- **✅ PRODUCTION SAFE** - No downtime required

## 📋 **REQUIRED NEW TABLES**

### **Category 1: Vendor Mapping (Critical for CSV Export)**

#### **1. `opms_netsuite_vendor_mapping`** - **CRITICAL**
```sql
CREATE TABLE opms_netsuite_vendor_mapping (
    id INT PRIMARY KEY AUTO_INCREMENT,
    opms_vendor_id INT NOT NULL,
    opms_vendor_name VARCHAR(40) NOT NULL,
    opms_vendor_abrev VARCHAR(15),
    netsuite_vendor_id INT NOT NULL,
    netsuite_vendor_name VARCHAR(255),
    netsuite_vendor_entity_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    mapping_confidence ENUM('high', 'medium', 'low') DEFAULT 'medium',
    mapping_method ENUM('manual', 'automatic', 'import') DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    
    -- Indexes for performance
    UNIQUE KEY unique_opms_vendor (opms_vendor_id),
    UNIQUE KEY unique_netsuite_vendor (netsuite_vendor_id),
    KEY idx_opms_name (opms_vendor_name),
    KEY idx_netsuite_name (netsuite_vendor_name),
    KEY idx_active (is_active),
    KEY idx_confidence (mapping_confidence),
    KEY idx_method (mapping_method),
    
    -- Data integrity constraints
    CHECK (opms_vendor_id > 0),
    CHECK (netsuite_vendor_id > 0)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Mapping table between OPMS vendors and NetSuite vendors';
```

**Purpose**: Maps OPMS Z_VENDOR records to NetSuite vendor IDs  
**Critical For**: CSV export vendor data population  
**Size Estimate**: ~10-50 vendor mappings  

#### **2. `opms_netsuite_vendor_mapping_log`** - **AUDIT**
```sql
CREATE TABLE opms_netsuite_vendor_mapping_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mapping_id INT NOT NULL,
    action ENUM('create', 'update', 'delete', 'verify') NOT NULL,
    old_values JSON,
    new_values JSON,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    KEY idx_mapping_id (mapping_id),
    KEY idx_action (action),
    KEY idx_created_at (created_at),
    
    FOREIGN KEY (mapping_id) REFERENCES opms_netsuite_vendor_mapping(id) ON DELETE CASCADE
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit log for vendor mapping changes';
```

**Purpose**: Audit trail for vendor mapping changes  
**Critical For**: Compliance and debugging  
**Size Estimate**: Minimal (change log only)  

#### **3. `v_vendor_mapping`** - **VIEW**
```sql
CREATE VIEW v_vendor_mapping AS
SELECT 
    vm.id,
    vm.opms_vendor_id,
    vm.opms_vendor_name,
    vm.opms_vendor_abrev,
    vm.netsuite_vendor_id,
    vm.netsuite_vendor_name,
    vm.is_active,
    vm.mapping_confidence,
    vm.mapping_method,
    vm.created_at,
    vm.updated_at,
    -- OPMS vendor details (if accessible)
    zv.active as opms_vendor_active,
    zv.archived as opms_vendor_archived
FROM opms_netsuite_vendor_mapping vm
LEFT JOIN Z_VENDOR zv ON vm.opms_vendor_id = zv.id
WHERE vm.is_active = TRUE;
```

**Purpose**: Easy vendor lookup with OPMS data joined  
**Critical For**: Simplified vendor validation queries  

### **Category 2: Import Job Tracking**

#### **4. `netsuite_import_jobs`** - **TRACKING**
```sql
CREATE TABLE netsuite_import_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_uuid VARCHAR(36) UNIQUE NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    total_items INT NOT NULL,
    status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_by_user_id INT NULL,
    
    -- Summary counters (updated as job progresses)
    items_processed INT DEFAULT 0,
    items_succeeded INT DEFAULT 0,
    items_failed_permanent INT DEFAULT 0,
    items_failed_retryable INT DEFAULT 0,
    
    -- Indices for performance
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_created_by_user_id (created_by_user_id)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks bulk import jobs with status and progress counters';
```

**Purpose**: Track bulk import job status and progress  
**Critical For**: Bulk import monitoring and resume capability  
**Size Estimate**: Small (~1 row per import job)  

#### **5. `netsuite_import_items`** - **DETAILS**
```sql
CREATE TABLE netsuite_import_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    
    -- OPMS item identity
    opms_item_id INT NOT NULL,
    opms_item_code VARCHAR(50) NOT NULL,
    
    -- NetSuite results (filled on success)
    netsuite_item_id INT NULL,
    netsuite_internal_id VARCHAR(50) NULL,
    
    -- Status and retry tracking
    status ENUM('pending', 'processing', 'success', 'failed_retryable', 'failed_permanent') DEFAULT 'pending',
    attempt_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    -- Error information
    last_error_type VARCHAR(100) NULL,
    last_error_message TEXT NULL,
    last_netsuite_response TEXT NULL,
    
    -- Timestamps
    first_attempted_at TIMESTAMP NULL,
    last_attempted_at TIMESTAMP NULL,
    succeeded_at TIMESTAMP NULL,
    
    -- Resume capability
    csv_row_number INT NOT NULL,
    
    -- Foreign key and indices
    FOREIGN KEY (job_id) REFERENCES netsuite_import_jobs(id) ON DELETE CASCADE,
    INDEX idx_job_status (job_id, status),
    INDEX idx_opms_item_code (opms_item_code),
    INDEX idx_attempt_count (attempt_count),
    INDEX idx_csv_row_number (csv_row_number)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks individual items within import jobs with detailed failure tracking';
```

**Purpose**: Track individual item import status with retry logic  
**Critical For**: Detailed import progress and error recovery  
**Size Estimate**: Medium (~1 row per imported item)  

### **Category 3: General Logging**

#### **6. `netsuite_sync_log`** - **LOGGING**
```sql
CREATE TABLE netsuite_sync_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL COMMENT 'Type of sync (inventory_items, assembly_items, etc.)',
    items_count INT NOT NULL DEFAULT 0 COMMENT 'Number of items processed',
    sync_date DATETIME NOT NULL COMMENT 'Date and time of synchronization',
    status VARCHAR(20) NOT NULL COMMENT 'Status of sync (success, error)',
    details TEXT COMMENT 'Additional details or error information',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='General NetSuite sync operation logging';
```

**Purpose**: General NetSuite sync operation logging  
**Critical For**: System monitoring and troubleshooting  
**Size Estimate**: Small (log entries only)  

#### **7. `migrations`** - **SYSTEM**
```sql
CREATE TABLE IF NOT EXISTS migrations (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Purpose**: Track which migrations have been executed  
**Critical For**: Migration system functionality  
**Size Estimate**: Minimal (~1 row per migration)  

## 🔍 **ORIGINAL OPMS TABLES (UNCHANGED)**

The following **existing OPMS tables** are required but will **NOT be modified**:

### **Core OPMS Tables Used by API:**
- **`T_ITEM`** - Core item data (code, vendor_code, vendor_color)
- **`T_PRODUCT`** - Product details (name, width)
- **`T_PRODUCT_VENDOR`** - Product-vendor relationships
- **`Z_VENDOR`** - Vendor information
- **`T_PRODUCT_VARIOUS`** - Extended product data (vendor_product_name)
- **`T_ITEM_COLOR`** + **`P_COLOR`** - Color associations

### **Mini-Forms Tables Used by API:**
- **`T_PRODUCT_FRONTCONTENT`** - Front content mini-forms
- **`T_PRODUCT_BACKCONTENT`** - Back content mini-forms
- **`T_PRODUCT_ABRASION`** - Abrasion test data
- **`T_PRODUCT_FIRECODES`** - Fire code certifications

**⚠️ IMPORTANT**: These tables will be **READ-ONLY** from the API perspective. No modifications will be made to existing OPMS data.

## 🚀 **EXECUTION PLAN**

### **Pre-Migration Checklist**
- [ ] **Database Backup**: Create full backup of legacy database
- [ ] **Test Environment**: Verify migrations work in test environment first
- [ ] **User Approval**: Get explicit approval for migration execution
- [ ] **Downtime Window**: Schedule during low-usage period (optional)
- [ ] **Rollback Plan**: Confirm rollback procedure is ready

### **Migration Execution Steps**

#### **Step 1: Verify Environment**
```bash
# Ensure we're in the correct directory
cd /Users/paulleasure/Documents/True_North_Dev_LLC/____PROJECTS/____Opuzen/__code/github/opuzen-api

# Verify database connection
npm run db:verify
```

#### **Step 2: Run Migrations** (Requires Approval)
```bash
# Execute all pending migrations
node src/db/migrate.js
```

#### **Step 3: Verify Success**
```bash
# Verify new tables were created
npm run db:verify

# Check migration status
node -e "
const db = require('./src/config/database');
db.query('SELECT name, executed_at FROM migrations ORDER BY executed_at')
  .then(([rows]) => {
    console.log('Executed migrations:');
    rows.forEach(row => console.log(\`- \${row.name} (\${row.executed_at})\`));
    process.exit(0);
  })
  .catch(console.error);
"
```

### **Post-Migration Validation**

#### **Verify New Tables Exist:**
```sql
-- Should show 6-7 new tables
SHOW TABLES LIKE '%netsuite%';
SHOW TABLES LIKE '%mapping%';
SHOW TABLES LIKE 'migrations';
```

#### **Verify Original Tables Untouched:**
```sql
-- These should all return 0 (no modifications)
SELECT COUNT(*) FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('T_ITEM', 'T_PRODUCT', 'Z_VENDOR', 'T_PRODUCT_VARIOUS')
AND COLUMN_COMMENT LIKE '%API%';
```

#### **Test Basic Functionality:**
```bash
# Test CSV export (should work with new vendor mapping table)
curl "http://localhost:3000/api/export/csv?limit=5"

# Test vendor mapping
curl "http://localhost:3000/api/vendors"
```

## 🔄 **ROLLBACK PROCEDURE**

If any issues arise, the migration can be safely rolled back:

### **Emergency Rollback**
```bash
# Rollback all migrations (removes only NEW tables)
node src/db/migrate.js rollback

# Verify rollback success
npm run db:verify
```

### **Manual Rollback** (if needed)
```sql
-- Drop new tables in reverse dependency order
DROP VIEW IF EXISTS v_vendor_mapping;
DROP TABLE IF EXISTS opms_netsuite_vendor_mapping_log;
DROP TABLE IF EXISTS netsuite_import_items;
DROP TABLE IF EXISTS netsuite_import_jobs;
DROP TABLE IF EXISTS netsuite_sync_log;
DROP TABLE IF EXISTS opms_netsuite_vendor_mapping;
DROP TABLE IF EXISTS migrations;
```

## 📊 **IMPACT ANALYSIS**

### **Storage Impact**
- **New Tables**: ~7 tables
- **Estimated Size**: <10MB for typical usage
- **Growth Rate**: Minimal (mostly reference/log data)

### **Performance Impact**
- **Read Operations**: No impact on existing OPMS queries
- **Write Operations**: Only affects new API tables
- **Indexing**: New indexes only on new tables
- **Joins**: Optional LEFT JOINs to new tables only

### **Functional Impact**
- **OPMS Application**: No changes, continues working normally
- **API Functionality**: Enables full CSV export and import tracking
- **Data Integrity**: Enhanced with vendor mapping validation

## 🎯 **WHAT THIS ENABLES**

### **Immediate Functionality**
- ✅ **CSV Export**: Full OPMS to NetSuite CSV generation
- ✅ **Vendor Mapping**: Accurate OPMS-NetSuite vendor relationships
- ✅ **Import Tracking**: Bulk import job monitoring
- ✅ **Error Logging**: Comprehensive sync operation logging

### **Future Capabilities**
- ✅ **Bulk Import**: Large-scale NetSuite import operations
- ✅ **Retry Logic**: Intelligent retry for failed imports
- ✅ **Audit Trail**: Complete history of all sync operations
- ✅ **Performance Monitoring**: Detailed sync performance metrics

## 🔒 **SECURITY CONSIDERATIONS**

### **Access Control**
- **API Tables**: Only accessible by API application user
- **OPMS Tables**: Existing permissions unchanged
- **Vendor Mapping**: Controlled access for data integrity

### **Data Protection**
- **No Sensitive Data**: New tables contain only mapping/status data
- **Audit Trail**: All changes logged for compliance
- **Backup Compatible**: Safe to include in existing backup procedures

## 📅 **RECOMMENDED EXECUTION TIMELINE**

### **Phase 1: Preparation** (Day 1)
- [ ] Create database backup
- [ ] Test migrations in development environment
- [ ] Review and approve migration plan

### **Phase 2: Execution** (Day 1-2)
- [ ] Execute migrations on legacy database
- [ ] Verify new tables created successfully
- [ ] Test basic API functionality

### **Phase 3: Validation** (Day 2-3)
- [ ] Run comprehensive CSV export tests
- [ ] Validate vendor mapping functionality
- [ ] Confirm OPMS application unaffected

### **Phase 4: Documentation** (Day 3)
- [ ] Document migration completion
- [ ] Update API documentation
- [ ] Train users on new functionality

## 🛠️ **MIGRATION COMMANDS**

### **Development/Test Environment**
```bash
# Test the migration first
NODE_ENV=development node src/db/migrate.js

# Verify results
NODE_ENV=development npm run db:verify
```

### **Production Environment** (Requires Approval)
```bash
# Production migration (REQUIRES EXPLICIT APPROVAL)
NODE_ENV=production node src/db/migrate.js

# Verify production results
NODE_ENV=production npm run db:verify
```

## 📞 **SUPPORT & TROUBLESHOOTING**

### **Common Issues**

#### **Issue 1: Permission Denied**
**Symptoms**: Migration fails with permission errors  
**Solution**: Ensure API database user has CREATE TABLE privileges  

#### **Issue 2: Table Already Exists**
**Symptoms**: Migration reports table already exists  
**Solution**: Normal behavior - migrations use IF NOT EXISTS  

#### **Issue 3: Foreign Key Constraints**
**Symptoms**: Migration fails on foreign key creation  
**Solution**: Check that referenced tables exist and have proper indexes  

### **Verification Queries**

#### **Check Migration Status**
```sql
SELECT name, executed_at FROM migrations ORDER BY executed_at;
```

#### **Verify Table Creation**
```sql
SELECT TABLE_NAME, TABLE_COMMENT 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME LIKE '%netsuite%';
```

#### **Check Table Sizes**
```sql
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    table_rows
FROM information_schema.tables 
WHERE table_schema = DATABASE()
AND table_name LIKE '%netsuite%'
ORDER BY (data_length + index_length) DESC;
```

## 📋 **APPROVAL CHECKLIST**

### **Before Execution** (Requires User Approval)
- [ ] **Database backup completed**
- [ ] **Migration plan reviewed and approved**
- [ ] **Test environment validation successful**
- [ ] **Rollback procedure confirmed**
- [ ] **Execution timing approved**

### **During Execution**
- [ ] **Monitor migration progress**
- [ ] **Verify each table creation**
- [ ] **Check for any error messages**
- [ ] **Confirm transaction completion**

### **After Execution**
- [ ] **Verify all new tables exist**
- [ ] **Test API functionality**
- [ ] **Confirm OPMS application unaffected**
- [ ] **Document completion status**

## 🎯 **SUCCESS CRITERIA**

### **Technical Success**
- ✅ All 6-7 new tables created successfully
- ✅ All indexes and foreign keys in place
- ✅ Migration tracking table populated
- ✅ No errors in migration log

### **Functional Success**
- ✅ CSV export endpoints working
- ✅ Vendor mapping functionality operational
- ✅ Import job tracking ready
- ✅ Original OPMS functionality unchanged

### **Operational Success**
- ✅ API tests passing
- ✅ No performance degradation
- ✅ Backup and rollback procedures verified
- ✅ Documentation updated

---

## 📝 **CHANGE LOG**

### **v1.0.0 - Initial Migration Plan**
- **Date**: January 19, 2025
- **Status**: Ready for Approval
- **Coverage**: Complete migration plan for legacy database integration
- **Safety**: Zero-risk additive-only approach
- **Scope**: 6-7 new tables, no modifications to existing tables

---

**Document Status**: ✅ **READY FOR APPROVAL**  
**Requires Approval From**: Database Administrator / Project Owner  
**Next Step**: Execute migration plan with explicit approval  
**Maintained By**: API Development Team
