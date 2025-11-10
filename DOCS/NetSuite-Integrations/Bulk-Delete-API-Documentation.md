# NetSuite Bulk Delete API Documentation

## Overview

The NetSuite Bulk Delete API provides a safe and intelligent way to clean up API-created items from NetSuite. It dynamically queries NetSuite, identifies items created by our API using pattern matching and custom field detection, and provides controlled deletion capabilities.

## Endpoint

```
POST /api/netsuite/items/bulk-delete
```

## Features

- ✅ **Dynamic Item Discovery**: Queries NetSuite in real-time (no hardcoded lists)
- ✅ **Intelligent Filtering**: Uses naming patterns and OPMS custom fields to identify API-created items
- ✅ **Safety Checks**: Only deletes items that match established API patterns
- ✅ **Dry Run Mode**: Preview what would be deleted before actual deletion
- ✅ **Pattern Filtering**: Target specific item types (e.g., "TEST-*")
- ✅ **Controlled Limits**: Limit number of items to delete for testing
- ✅ **Comprehensive Reporting**: Detailed results with success/failure tracking
- ✅ **Error Handling**: Gracefully handles already-deleted items and other errors

## Request Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dryRun` | boolean | `true` | If true, only shows what would be deleted without actually deleting |
| `pattern` | string | - | Only delete items matching this pattern (supports * wildcards, e.g., "TEST-*") |
| `limit` | integer | - | Maximum number of items to delete |
| `queryLimit` | integer | `300` | Maximum number of items to query from NetSuite |

## API Patterns

The system identifies API-created items using these patterns:

### Primary Pattern (Recommended)
- `opmsAPI-.*$` - **ALL new test items should use this prefix**

### Legacy Patterns (Deprecated)
- `OPMS-\d+-ULTIMATE-\d+$` - OPMS Ultimate test items
- `REAL-OPMS-\d+-\d+$` - Real OPMS integration items  
- `ACDC-.*$` - ACDC test items
- `TEST-.*$` - General test items
- `RESTLET-TEST-.*$` - RESTlet test items
- `BULK-TEST-.*$` - Bulk test items
- `FALLBACK-TEST-.*$` - Fallback test items
- `DELETE-TEST-.*$` - Delete test items
- `ALL-FIELDS-TEST-.*$` - All fields test items
- `COLORS-CLEAN-ORIGIN-TEST-.*$` - Colors/cleaning/origin test items
- `FINISH-WIDTH-TEST-.*$` - Finish/width test items
- `PARENT-PRODUCT-NAME-TEST-.*$` - Parent product name test items
- `VENDOR-FIELDS-TEST-.*$` - Vendor fields test items
- And various other legacy patterns

Additionally, items with OPMS custom fields (`custitem_opms_prod_id` or `custitemopms_item_id`) are identified as API-created.

## Usage Examples

### 1. Dry Run (Default) - See what would be deleted

```bash
curl -X POST http://localhost:3000/api/netsuite/items/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. Delete all opmsAPI-* items (Recommended)

```bash
curl -X POST http://localhost:3000/api/netsuite/items/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": false,
    "pattern": "opmsAPI-*"
  }'
```

### 3. Delete all TEST-* items (Legacy)

```bash
curl -X POST http://localhost:3000/api/netsuite/items/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": false,
    "pattern": "TEST-*"
  }'
```

### 4. Delete first 10 API-created items

```bash
curl -X POST http://localhost:3000/api/netsuite/items/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": false,
    "limit": 10
  }'
```

### 5. Dry run for ACDC items only

```bash
curl -X POST http://localhost:3000/api/netsuite/items/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true,
    "pattern": "ACDC-*"
  }'
```

## Response Format

### Dry Run Response

```json
{
  "success": true,
  "dryRun": true,
  "summary": {
    "totalItemsInNetSuite": 149,
    "apiCreatedItems": 14,
    "itemsToDelete": 5
  },
  "items": [
    {
      "id": "3359",
      "itemId": "TEST-EXAMPLE-001",
      "reason": "naming pattern"
    }
  ],
  "message": "Dry run completed. 5 items would be deleted. Set dryRun: false to perform actual deletion."
}
```

### Actual Deletion Response

```json
{
  "success": true,
  "dryRun": false,
  "summary": {
    "totalItemsInNetSuite": 149,
    "apiCreatedItems": 14,
    "itemsToDelete": 5
  },
  "results": {
    "successful": 5,
    "alreadyDeleted": 0,
    "failed": 0,
    "errors": []
  },
  "items": [
    {
      "id": "3359",
      "itemId": "TEST-EXAMPLE-001",
      "reason": "naming pattern"
    }
  ]
}
```

### Error Response

```json
{
  "success": false,
  "error": "Failed to query NetSuite items"
}
```

## Safety Mechanisms

### 1. Pattern-Based Safety
- Only items matching established API patterns are eligible for deletion
- Regular expressions ensure precise matching
- Production NetSuite items are automatically protected

### 2. Custom Field Detection
- Items with OPMS custom fields are identified as API-created
- Provides additional layer of identification beyond naming patterns

### 3. RESTlet Safety Checks
- The underlying RESTlet has additional safety checks
- Validates item existence before deletion
- Provides detailed error messages for troubleshooting

### 4. Dry Run Default
- All requests default to dry-run mode unless explicitly overridden
- Prevents accidental deletions
- Allows verification before actual deletion

## Performance Characteristics

### Query Performance
- Batched processing (5 items per batch) to avoid overwhelming NetSuite
- 1-second delays between batches
- Default query limit of 300 items (configurable)

### Deletion Performance  
- 500ms delay between each deletion to be respectful to NetSuite
- Graceful error handling for already-deleted items
- Comprehensive logging for audit trails

## Integration with Existing Tools

### CLI Script Compatibility
The API endpoint uses the same core logic as the standalone CLI script:
- `scripts/delete-api-netsuite-items-smart.js`

### Swagger Documentation
Full OpenAPI/Swagger documentation is available at:
- `http://localhost:3000/api-docs`
- Navigate to NetSuite > Bulk Delete section

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Failed to query NetSuite items` | API connectivity issue | Check NetSuite API credentials and network |
| `RCRD_DSNT_EXIST` | Item already deleted | Handled gracefully, counted as "alreadyDeleted" |
| `Safety check failed` | Item doesn't match API patterns | Verify item was created by API |
| `Local API error: 500` | Internal server error | Check server logs for detailed error |

### Logging
All operations are logged with appropriate levels:
- `INFO`: Request parameters and completion status  
- `DEBUG`: Detailed processing steps
- `ERROR`: Failures and exceptions

## Best Practices

### 1. Always Start with Dry Run
```bash
# First, see what would be deleted
curl -X POST .../bulk-delete -d '{"pattern": "TEST-*"}'

# Then perform actual deletion
curl -X POST .../bulk-delete -d '{"dryRun": false, "pattern": "TEST-*"}'
```

### 2. Use Pattern Filters for Targeted Cleanup
```bash
# Delete only abrasion test items
curl -X POST .../bulk-delete -d '{"dryRun": false, "pattern": "TEST-ABRASION-*"}'
```

### 3. Use Limits for Large Cleanup Operations
```bash
# Delete in batches of 20
curl -X POST .../bulk-delete -d '{"dryRun": false, "limit": 20}'
```

### 4. Monitor Results
- Check the `results` object for success/failure counts
- Review `errors` array for any issues
- Use logs for detailed audit trail

## Security Considerations

- The API only deletes items that match established patterns
- No ability to delete arbitrary NetSuite items
- All operations are logged for audit purposes
- Requires valid API authentication
- RESTlet-level safety checks provide additional protection

## Future Enhancements

Potential improvements for future versions:
- Scheduled cleanup jobs
- Email notifications for bulk operations
- Advanced filtering options (date ranges, custom fields)
- Backup/restore functionality
- Integration with CI/CD pipelines for automated cleanup