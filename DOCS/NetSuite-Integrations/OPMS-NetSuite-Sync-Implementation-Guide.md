# OPMS to NetSuite Item Sync Implementation Guide

## Overview

This implementation provides automatic synchronization of OPMS item/colorline data to NetSuite whenever items are created or updated in the legacy OPMS application.

## Architecture

### System Flow
```
Legacy OPMS App (PHP) → Node.js API → NetSuite RESTlet → NetSuite Database
```

**When an item is created/updated in OPMS:**
1. Legacy `Item_model::save_item()` saves to OPMS database
2. Calls `sync_item_to_netsuite()` helper function
3. Helper makes HTTP POST to Node.js API `/api/netsuite/sync-from-opms`
4. Node.js API fetches complete item data from OPMS database
5. Transforms data and calls NetSuite RESTlet service
6. NetSuite item is created/updated with full OPMS data
7. Sync result is logged in OPMS database

## Implementation Components

### 1. Node.js API Endpoint
**File:** `src/routes/netsuite.js`
**Endpoint:** `POST /api/netsuite/sync-from-opms`

- Receives sync requests from legacy OPMS app
- Fetches complete item data using `ItemModel.getItemForNetSuiteSync()`
- Includes mini-forms data from ProductModel
- Calls existing NetSuite RESTlet service

### 2. Legacy OPMS Integration Points

#### Item Model Hook
**File:** `legacy_app/application/models/Item_model.php`
**Function:** `save_item()`

- Modified to call `sync_item_to_netsuite()` after successful database operations
- Works for both item creation and updates
- Includes error handling to prevent sync failures from breaking item saves

#### Helper Functions
**File:** `legacy_app/application/helpers/netsuite_sync_helper.php`

- `sync_item_to_netsuite()` - Makes HTTP call to Node.js API
- `should_sync_to_netsuite()` - Business logic for sync eligibility
- `log_netsuite_sync_attempt()` - Logs sync attempts to database

#### Configuration
**File:** `legacy_app/application/config/netsuite_sync.php`

Environment-driven configuration for all sync settings.

### 3. Database Integration

#### Node.js ItemModel Method
**File:** `src/models/ItemModel.js`
**Method:** `getItemForNetSuiteSync()`

SQL query that fetches all required data for NetSuite sync:
- Item basic data (code, vendor info, colors)
- Product information (name, width)
- Vendor mapping to NetSuite vendor IDs
- Color names (comma-separated)

#### Legacy Sync Logging
**Table:** `netsuite_sync_log`

Automatically created table that logs all sync attempts:
- `item_id` - OPMS item ID
- `sync_status` - success/failed/skipped
- `response_message` - API response or error message
- `netsuite_item_id` - NetSuite item ID if successful
- `sync_date` - Timestamp

## Setup Instructions

### 1. Environment Configuration

Add to your environment variables:

```bash
# Enable/disable NetSuite sync
NETSUITE_SYNC_ENABLED=true

# Node.js API URL (adjust for your deployment)
NETSUITE_API_BASE_URL=http://localhost:3000/api

# Skip digital items (optional)
NETSUITE_SKIP_DIGITAL=true

# Timeout settings (optional)
NETSUITE_SYNC_TIMEOUT=30
NETSUITE_SYNC_CONNECT_TIMEOUT=10

# SSL verification (set to true in production)
NETSUITE_SYNC_SSL_VERIFY=false

# Logging level (optional)
NETSUITE_SYNC_LOG_LEVEL=all
```

### 2. Legacy App Configuration

Ensure the configuration file is loaded by adding to `application/config/autoload.php`:

```php
$autoload['config'] = array('netsuite_sync');
```

### 3. Database Schema

The `netsuite_sync_log` table will be created automatically on first sync attempt.

### 4. Testing the Integration

#### Test Item Creation
1. Create a new item in the legacy OPMS app
2. Check the `netsuite_sync_log` table for sync attempt
3. Verify item was created in NetSuite

#### Test Item Update
1. Update an existing item in the legacy OPMS app
2. Check sync log for update attempt
3. Verify item was updated in NetSuite

## Integration Points

### Legacy OPMS Hook Points
- **Item_model::save_item()** - Primary integration point for all item create/update operations
- Called from Item controller for both new items and updates
- Handles transaction rollback if needed

### Node.js API Endpoints
- **POST /api/netsuite/sync-from-opms** - Receives sync requests from legacy app
- **POST /api/netsuite/items** - Existing NetSuite item creation (unchanged)

### NetSuite Fields Populated
- Basic item data (itemId, displayName)
- Vendor information (vendor ID, vendor code, vendor color)
- Product dimensions (fabric width)
- Color data (comma-separated color names)
- Parent product name
- OPMS IDs for reference (custitem_opms_prod_id, custitem_opms_item_id)
- Mini-forms data (front content, back content, abrasion, fire codes)

## Error Handling

### Legacy App Error Handling
- Sync errors do NOT break the main item save operation
- All errors are logged to CodeIgniter logs and sync log table
- Graceful degradation - OPMS continues to work even if NetSuite is down

### Node.js API Error Handling
- Comprehensive error logging with context
- Validation of required fields
- Fallback for missing mini-forms data

### NetSuite RESTlet Error Handling
- Uses existing RESTlet error handling
- Field validation per NetSuite requirements
- Vendor mapping validation

## Monitoring and Logging

### Sync Monitoring
Query `netsuite_sync_log` table to monitor sync health:

```sql
-- Recent sync attempts
SELECT item_id, sync_status, response_message, sync_date 
FROM netsuite_sync_log 
ORDER BY sync_date DESC 
LIMIT 50;

-- Sync success rate
SELECT sync_status, COUNT(*) as count 
FROM netsuite_sync_log 
GROUP BY sync_status;

-- Failed syncs
SELECT item_id, response_message, sync_date 
FROM netsuite_sync_log 
WHERE sync_status = 'failed' 
ORDER BY sync_date DESC;
```

### Log Files
- **Legacy OPMS:** Check CodeIgniter logs for sync errors
- **Node.js API:** Check application logs for API errors
- **NetSuite:** Check NetSuite script logs for RESTlet issues

## Deployment Checklist

### Development Environment
- [ ] Node.js API running with NetSuite RESTlet configured
- [ ] Legacy OPMS app can reach Node.js API
- [ ] Environment variables configured
- [ ] Test item creation and update

### Production Environment
- [ ] Set `NETSUITE_SYNC_SSL_VERIFY=true`
- [ ] Update `NETSUITE_API_BASE_URL` to production URL
- [ ] Configure appropriate timeout values
- [ ] Set up monitoring for sync log table
- [ ] Test with production NetSuite environment

## Troubleshooting

### Common Issues

1. **Sync not happening**
   - Check `NETSUITE_SYNC_ENABLED` environment variable
   - Verify Node.js API is running and accessible
   - Check legacy OPMS logs for helper loading errors

2. **Sync failing**
   - Check `netsuite_sync_log` table for error messages
   - Verify NetSuite RESTlet is deployed and working
   - Check vendor mapping in `opms_netsuite_vendor_mapping` table

3. **Item not found in NetSuite**
   - Check if item meets sync criteria (has code, not Digital if skipped)
   - Verify vendor mapping exists for item's vendor
   - Check NetSuite RESTlet logs for creation errors

4. **Missing mini-forms data**
   - Verify product ID is being passed correctly
   - Check ProductModel.getMiniFormsData() method
   - Mini-forms data is optional - sync will continue without it

## Security Considerations

- API calls use HTTPS in production (SSL verify enabled)
- No sensitive NetSuite credentials in legacy OPMS code
- All NetSuite authentication handled by Node.js API layer
- Sync operations are logged for audit purposes

## Performance Considerations

- Sync calls are asynchronous and don't block item save operations
- Configurable timeouts prevent hanging operations  
- Sync failures don't impact OPMS performance
- Database logging is lightweight and indexed

## Future Enhancements

- Batch sync capabilities for historical data
- Retry mechanism for failed syncs
- Real-time sync status dashboard
- Webhook endpoints for NetSuite-to-OPMS sync
- Enhanced sync filtering and business rules
