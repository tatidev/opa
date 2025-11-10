# Complete API Database Setup Guide

## 🎯 **Overview**

This guide provides complete instructions for setting up all Opuzen API database tables on a native OPMS MySQL database. The setup includes all tables, triggers, views, and procedures needed for the API to function properly.

## 📋 **What Gets Created**

### **Database Objects Summary**
- **20 Tables**: All API functionality tables
- **2 Views**: Monitoring and lookup views
- **2 Triggers**: Real-time change detection
- **1 Procedure**: Maintenance and cleanup
- **Default Data**: Users, roles, showrooms, vendors

### **Table Categories**

| Category | Tables | Purpose |
|----------|--------|---------|
| **User Management** | 5 tables | Authentication, roles, showroom assignments |
| **Vendor Management** | 5 tables | Complete vendor information system |
| **NetSuite Integration** | 3 tables | Vendor mapping and sync logging |
| **Import/Export** | 2 tables | Bulk import job tracking |
| **Sync System** | 3 tables | Real-time OPMS-to-NetSuite sync |
| **System Infrastructure** | 1 table | Migration tracking |

## 🗄️ **Complete Table List**

### **🔐 User Authentication & Authorization**
1. `api_users` - User accounts and authentication
2. `api_roles` - User roles (admin, manager, user, showroom, readonly)
3. `api_user_roles` - Junction table for user-role assignments
4. `api_showrooms` - Showroom locations and details
5. `api_user_showrooms` - Junction table for user-showroom assignments

### **🏢 Vendor Management System**
6. `api_vendors` - Vendor information and metadata
7. `api_vendor_contacts` - Vendor contact persons and details
8. `api_vendor_addresses` - Vendor addresses (main, billing, shipping, warehouse)
9. `api_vendor_files` - Vendor documents and files
10. `api_vendor_notes` - Vendor notes and comments

### **🔗 OPMS-NetSuite Integration**
11. `opms_netsuite_vendor_mapping` - Maps OPMS vendors to NetSuite vendors
12. `opms_netsuite_vendor_mapping_log` - Audit trail for vendor mappings
13. `netsuite_sync_log` - General NetSuite sync operation logging

### **📥 Import/Export System**
14. `netsuite_import_jobs` - Tracks bulk import jobs with status
15. `netsuite_import_items` - Individual items within import jobs

### **🔄 OPMS-to-NetSuite Sync System**
16. `opms_sync_queue` - Sync job queue management
17. `opms_change_log` - Change tracking for monitoring
18. `opms_item_sync_status` - Individual item sync status tracking

### **🔧 System Infrastructure**
19. `migrations` - Migration tracking table

### **📊 Views and Procedures**
20. `v_sync_queue_status` - Sync queue monitoring view
21. `v_vendor_mapping` - Vendor lookup view
22. `opms_item_sync_trigger` - T_ITEM change detection trigger
23. `opms_product_sync_trigger` - T_PRODUCT change detection trigger
24. `sp_cleanup_sync_data` - Cleanup procedure

## 🚀 **Installation Methods**

### **Method 1: Direct MySQL Command Line (Recommended)**

```bash
# Navigate to the API project directory
cd /path/to/opuzen-api

# Execute the setup script
mysql -u username -p opms_database < src/db/create-all-api-tables.sql
```

**Example with specific credentials:**
```bash
mysql -h your-aws-host.rds.amazonaws.com -u opms_user -p opms_dev < src/db/create-all-api-tables.sql
```

### **Method 2: MySQL Workbench**

1. **Open MySQL Workbench**
2. **Connect to your OPMS database**
3. **Open SQL Script**:
   - File → Open SQL Script
   - Navigate to `src/db/create-all-api-tables.sql`
4. **Execute Script**:
   - Click the lightning bolt icon
   - Review execution results

### **Method 3: phpMyAdmin**

1. **Login to phpMyAdmin**
2. **Select OPMS database**
3. **Go to Import tab**
4. **Choose file**: `src/db/create-all-api-tables.sql`
5. **Click Go**

### **Method 4: Command Line with Password File**

```bash
# Create password file (more secure)
echo "your_password" > ~/.mysql_password
chmod 600 ~/.mysql_password

# Execute script
mysql -u username -p$(cat ~/.mysql_password) opms_database < src/db/create-all-api-tables.sql

# Clean up password file
rm ~/.mysql_password
```

## 🛡️ **Safety Features**

### **✅ Non-Destructive Installation**
- **`CREATE TABLE IF NOT EXISTS`** - Won't overwrite existing tables
- **`INSERT IGNORE`** - Won't duplicate default data
- **`DROP TRIGGER IF EXISTS`** - Safely recreates triggers
- **No modifications** to existing OPMS tables
- **Foreign key references** to OPMS tables (read-only)

### **✅ Rollback Capability**
If you need to remove all API tables:

```sql
-- Complete rollback script (removes all API additions)
DROP VIEW IF EXISTS v_vendor_mapping;
DROP VIEW IF EXISTS v_sync_queue_status;
DROP PROCEDURE IF EXISTS sp_cleanup_sync_data;
DROP TRIGGER IF EXISTS opms_product_sync_trigger;
DROP TRIGGER IF EXISTS opms_item_sync_trigger;

-- Drop all API tables (in dependency order)
DROP TABLE IF EXISTS opms_item_sync_status;
DROP TABLE IF EXISTS opms_change_log;
DROP TABLE IF EXISTS opms_sync_queue;
DROP TABLE IF EXISTS netsuite_import_items;
DROP TABLE IF EXISTS netsuite_import_jobs;
DROP TABLE IF EXISTS netsuite_sync_log;
DROP TABLE IF EXISTS opms_netsuite_vendor_mapping_log;
DROP TABLE IF EXISTS opms_netsuite_vendor_mapping;
DROP TABLE IF EXISTS api_vendor_notes;
DROP TABLE IF EXISTS api_vendor_files;
DROP TABLE IF EXISTS api_vendor_addresses;
DROP TABLE IF EXISTS api_vendor_contacts;
DROP TABLE IF EXISTS api_vendors;
DROP TABLE IF EXISTS api_user_showrooms;
DROP TABLE IF EXISTS api_showrooms;
DROP TABLE IF EXISTS api_user_roles;
DROP TABLE IF EXISTS api_roles;
DROP TABLE IF EXISTS api_users;
DROP TABLE IF EXISTS migrations;
```

## 📋 **Default Data Created**

The script automatically creates essential default data:

### **👤 Default Admin User**
- **Username**: `admin`
- **Email**: `admin@opuzen.com`
- **Password**: `password` ⚠️ **CHANGE IMMEDIATELY AFTER SETUP!**
- **Role**: System Administrator
- **Status**: Active, Email Verified

### **🔐 Default Roles**
1. **admin** - System Administrator (Full access)
2. **manager** - Manager (User management + operations)
3. **user** - Regular User (Standard features)
4. **showroom** - Showroom User (Showroom-specific features)
5. **readonly** - Read Only (View access only)

### **🏢 Default Showrooms**
1. **Main Office** (MAIN) - New York, NY
2. **Atlanta Showroom** (ATL) - Atlanta, GA
3. **Chicago Showroom** (CHI) - Chicago, IL
4. **Dallas Showroom** (DAL) - Dallas, TX
5. **Los Angeles Showroom** (LA) - Los Angeles, CA

### **🏭 Default Vendors**
1. **Carrier** (CAR) - Premium fabric manufacturer
2. **Designtex** (DTX) - Commercial textile supplier
3. **Momentum** (MOM) - Healthcare and hospitality fabrics
4. **Anzea** (ANZ) - Durable fabric solutions
5. **Maharam** (MAH) - Design-focused textiles

## 🔍 **Verification Steps**

### **1. Check Table Creation**
```sql
-- Verify all API tables were created
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME,
    TABLE_COMMENT
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND (TABLE_NAME LIKE 'api_%' 
   OR TABLE_NAME LIKE 'opms_%'
   OR TABLE_NAME LIKE 'netsuite_%'
   OR TABLE_NAME = 'migrations')
ORDER BY TABLE_NAME;
```

### **2. Check Triggers**
```sql
-- Verify sync triggers were created
SELECT 
    TRIGGER_NAME,
    EVENT_MANIPULATION,
    EVENT_OBJECT_TABLE,
    CREATED
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = DATABASE() 
  AND TRIGGER_NAME LIKE '%sync%';
```

### **3. Check Views**
```sql
-- Verify views were created
SELECT 
    TABLE_NAME as VIEW_NAME,
    TABLE_TYPE
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_TYPE = 'VIEW'
  AND TABLE_NAME LIKE 'v_%';
```

### **4. Test Default Data**
```sql
-- Check default admin user
SELECT username, email, is_active, email_verified 
FROM api_users WHERE username = 'admin';

-- Check default roles
SELECT name, description FROM api_roles ORDER BY name;

-- Check default showrooms
SELECT name, abbreviation, city, state FROM api_showrooms ORDER BY name;
```

### **5. Test Sync System**
```sql
-- Check sync queue status
SELECT * FROM v_sync_queue_status;

-- Check if triggers are working (after making a test change to OPMS)
SELECT COUNT(*) as pending_jobs FROM opms_sync_queue WHERE status = 'PENDING';
```

## ⚠️ **Important Post-Installation Steps**

### **1. Change Default Admin Password**
```sql
-- Update admin password (use bcrypt hash)
UPDATE api_users 
SET password_hash = '$2b$10$your_new_bcrypt_hash_here'
WHERE username = 'admin';
```

### **2. Configure Environment Variables**
Update your `.env` file with database connection details:
```bash
DB_HOST=your-opms-host
DB_USER=your-opms-user
DB_PASSWORD=your-opms-password
DB_NAME=your-opms-database
DB_PORT=3306
```

### **3. Test API Connectivity**
```bash
# Test database connection
node -e "
const mysql = require('mysql2/promise');
async function test() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  console.log('✅ Database connection successful!');
  await connection.end();
}
test().catch(console.error);
"
```

### **4. Initialize Sync System**
```bash
# Initialize the OPMS-to-NetSuite sync system
node src/scripts/initialize-opms-sync.js --test-only
```

## 🔧 **Maintenance**

### **Regular Cleanup**
The script includes a cleanup procedure. Run monthly:
```sql
-- Clean up old sync data (keep 30 days)
CALL sp_cleanup_sync_data(30);
```

### **Backup Recommendations**
- **Before Installation**: Backup your OPMS database
- **After Installation**: Backup again to preserve the complete setup
- **Regular Backups**: Include all API tables in your backup routine

### **Monitoring**
- **Sync Queue**: Monitor `v_sync_queue_status` for processing health
- **Error Logs**: Check `opms_change_log` for detection issues
- **Import Jobs**: Monitor `netsuite_import_jobs` for bulk operations

## 📞 **Support**

### **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| **Permission Denied** | Insufficient MySQL privileges | Grant CREATE, ALTER, INSERT privileges |
| **Foreign Key Errors** | OPMS tables don't exist | Verify OPMS schema is complete |
| **Trigger Creation Fails** | MySQL version compatibility | Ensure MySQL 5.7+ |
| **Default Data Conflicts** | Tables already exist with data | Use `INSERT IGNORE` or clear existing data |

### **Verification Queries**
```sql
-- Count all API tables
SELECT COUNT(*) as api_table_count 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND (TABLE_NAME LIKE 'api_%' OR TABLE_NAME LIKE 'opms_%' OR TABLE_NAME LIKE 'netsuite_%');

-- Check trigger functionality
SELECT 
    TRIGGER_NAME,
    EVENT_OBJECT_TABLE,
    ACTION_TIMING,
    EVENT_MANIPULATION
FROM information_schema.TRIGGERS 
WHERE TRIGGER_SCHEMA = DATABASE();
```

## 🎯 **Next Steps**

After successful installation:

1. **✅ Change admin password**
2. **✅ Configure environment variables**
3. **✅ Test API endpoints**
4. **✅ Initialize sync system**
5. **✅ Set up monitoring**
6. **✅ Configure backup routine**

The Opuzen API database setup is now complete and ready for production use!

---

**Script Location**: `src/db/create-all-api-tables.sql`  
**Last Updated**: January 2025  
**Version**: 2.0
