# Database Documentation

This directory contains all database-related documentation and scripts for the Opuzen API.

## 📁 **Files in this Directory**

### **📋 Setup & Installation**
- **`complete-api-database-setup.md`** - Complete guide for setting up all API tables
- **`create-all-api-tables.sql`** - SQL script to create all 20 API tables + triggers + views
- **`database_migration_plan.md`** - Migration planning and strategy
- **`environment-aware-migration-setup.md`** - Environment-specific migration setup

### **📊 Schema Documentation**
- **`schema/opms-schema-analysis.md`** - Analysis of existing OPMS database schema

## 🚀 **Quick Start**

### **New Installation**
If you're setting up the API database for the first time:

1. **Read the setup guide**: `complete-api-database-setup.md`
2. **Run the SQL script**: `create-all-api-tables.sql`
3. **Verify installation** using the verification steps in the guide

### **Existing Installation**
If you already have some API tables:

1. **Check current state** using the verification queries
2. **Run migrations** as needed for missing tables
3. **Update to latest schema** using the complete script (safe to re-run)

## 📋 **Database Overview**

### **API Tables Created (20 total)**

| Category | Count | Tables |
|----------|-------|--------|
| **User Management** | 5 | `api_users`, `api_roles`, `api_user_roles`, `api_showrooms`, `api_user_showrooms` |
| **Vendor Management** | 5 | `api_vendors`, `api_vendor_contacts`, `api_vendor_addresses`, `api_vendor_files`, `api_vendor_notes` |
| **NetSuite Integration** | 3 | `opms_netsuite_vendor_mapping`, `opms_netsuite_vendor_mapping_log`, `netsuite_sync_log` |
| **Import/Export** | 2 | `netsuite_import_jobs`, `netsuite_import_items` |
| **Sync System** | 3 | `opms_sync_queue`, `opms_change_log`, `opms_item_sync_status` |
| **Infrastructure** | 1 | `migrations` |
| **Views** | 2 | `v_sync_queue_status`, `v_vendor_mapping` |
| **Triggers** | 2 | `opms_item_sync_trigger`, `opms_product_sync_trigger` |

### **Key Features**
- ✅ **Non-intrusive**: No modifications to existing OPMS tables
- ✅ **Safe installation**: Uses `IF NOT EXISTS` and `INSERT IGNORE`
- ✅ **Complete rollback**: Can remove all API additions cleanly
- ✅ **Real-time sync**: Database triggers for change detection
- ✅ **Audit trails**: Comprehensive logging and tracking
- ✅ **Default data**: Ready-to-use users, roles, and showrooms

## 🛠️ **Installation Commands**

### **MySQL Command Line**
```bash
mysql -u username -p database_name < DOCS/database/create-all-api-tables.sql
```

### **With Specific Host**
```bash
mysql -h your-host -u username -p database_name < DOCS/database/create-all-api-tables.sql
```

### **Verification**
```sql
-- Check table count
SELECT COUNT(*) as api_tables 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND (TABLE_NAME LIKE 'api_%' OR TABLE_NAME LIKE 'opms_%' OR TABLE_NAME LIKE 'netsuite_%');
```

## ⚠️ **Important Notes**

### **Before Installation**
- **Backup your database** before running any scripts
- **Verify OPMS schema** exists and is accessible
- **Check MySQL version** (requires 5.7+ for JSON support)
- **Ensure sufficient privileges** (CREATE, ALTER, INSERT, TRIGGER)

### **After Installation**
- **Change default admin password** immediately
- **Configure environment variables** for database connection
- **Test API connectivity** before going live
- **Set up regular backups** including new API tables

### **Security**
- Default admin password is `password` - **CHANGE IMMEDIATELY**
- All tables use `utf8mb4` charset for full Unicode support
- Foreign key constraints maintain data integrity
- Audit trails track all changes for security compliance

## 📞 **Support**

### **Common Issues**
- **Permission errors**: Ensure user has CREATE and TRIGGER privileges
- **Foreign key errors**: Verify OPMS tables exist (T_ITEM, T_PRODUCT, Z_VENDOR)
- **Charset issues**: Ensure MySQL supports utf8mb4
- **Trigger errors**: Check MySQL version compatibility

### **Getting Help**
1. Check the detailed setup guide: `complete-api-database-setup.md`
2. Review verification queries in the documentation
3. Check MySQL error logs for specific issues
4. Verify environment configuration

## 🔄 **Updates**

This documentation is maintained alongside the API codebase. When database schema changes:

1. **Update SQL script**: `create-all-api-tables.sql`
2. **Update documentation**: `complete-api-database-setup.md`
3. **Test installation**: Verify on clean database
4. **Update version numbers**: In both script and docs

---

**Last Updated**: January 2025  
**API Version**: 2.0  
**MySQL Compatibility**: 5.7+
