# NetSuite Item Deletion - Usage Guide

## 🗑️ **Delete All NetSuite Items by Prefix Pattern**

### **Quick Usage:**

```javascript
const ns = require('./src/services/netsuiteRestletService');

// 1. DRY RUN: See what would be deleted (ALWAYS DO THIS FIRST)
const preview = await ns.bulkDeleteItems({ 
  dryRun: true, 
  itemPattern: 'opmsAPI', 
  maxItems: 50 
});
console.log(`Found ${preview.itemsFound.length} items to delete`);

// 2. ACTUAL DELETION: Delete all items with prefix
const result = await ns.bulkDeleteItems({ 
  dryRun: false, 
  itemPattern: 'opmsAPI', 
  maxItems: 50 
});
console.log(`Deleted ${result.itemsDeleted} items`);
```

### **Function Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dryRun` | boolean | `true` | If true, only shows what would be deleted |
| `itemPattern` | string | `"opmsAPI-"` | Prefix pattern to search for |
| `maxItems` | number | `50` | Maximum number of items to delete (safety limit) |

### **Common Usage Examples:**

```javascript
// Delete all test items starting with "opmsAPI"
await ns.bulkDeleteItems({ dryRun: false, itemPattern: 'opmsAPI' });

// Delete specific test pattern
await ns.bulkDeleteItems({ dryRun: false, itemPattern: 'opmsAPI-TEST' });

// Delete with higher limit for large cleanups
await ns.bulkDeleteItems({ dryRun: false, itemPattern: 'opmsAPI', maxItems: 100 });

// Preview what would be deleted (always safe)
await ns.bulkDeleteItems({ dryRun: true, itemPattern: 'opmsAPI' });
```

### **Safety Features:**

- ✅ **Dry Run Mode**: Always preview before deletion
- ✅ **Pattern Matching**: Only deletes items matching exact prefix
- ✅ **Max Items Limit**: Prevents accidental mass deletion
- ✅ **Smart Fallback**: Marks items inactive if deletion fails due to dependencies
- ✅ **Detailed Logging**: Full audit trail of all operations
- ✅ **Error Handling**: Continues processing even if individual items fail

### **Return Object:**

```javascript
{
  success: true,
  itemsProcessed: 5,
  itemsDeleted: 4,
  itemsFound: [/* array of found items */],
  errors: [/* any errors that occurred */],
  details: [/* detailed results for each item */],
  message: "Bulk delete completed: 4 deleted, 1 failed"
}
```

## 🎯 **Quick Commands for Common Tasks:**

### **Clean Up Today's Test Items:**
```bash
# From project root
node -e "
const ns = require('./src/services/netsuiteRestletService');
ns.bulkDeleteItems({ dryRun: false, itemPattern: 'opmsAPI-2', maxItems: 20 })
  .then(r => console.log('Cleaned up:', r.itemsDeleted, 'items'))
  .catch(e => console.log('Error:', e.message));
"
```

### **Clean Up ALL opmsAPI Items:**
```bash
node -e "
const ns = require('./src/services/netsuiteRestletService');
ns.bulkDeleteItems({ dryRun: false, itemPattern: 'opmsAPI', maxItems: 100 })
  .then(r => console.log('Total deleted:', r.itemsDeleted, 'items'))
  .catch(e => console.log('Error:', e.message));
"
```

### **Preview Before Deletion:**
```bash
node -e "
const ns = require('./src/services/netsuiteRestletService');
ns.bulkDeleteItems({ dryRun: true, itemPattern: 'opmsAPI' })
  .then(r => console.log('Would delete:', r.itemsFound.map(i => i.itemid)))
  .catch(e => console.log('Error:', e.message));
"
```

## 🛡️ **Safety Guidelines:**

1. **ALWAYS run dry run first** to see what will be deleted
2. **Use specific patterns** to avoid deleting wrong items
3. **Start with small maxItems** limits for testing
4. **Check the results** before running larger deletions
5. **Keep backups** of important NetSuite data

## 📍 **Code Location:**

- **File**: `src/services/netsuiteRestletService.js`
- **Function**: `bulkDeleteItems({ dryRun, itemPattern, maxItems })`
- **Dependencies**: Uses `netsuiteManageItemService.js` for search and deletion

**Ready to delete NetSuite items by any prefix pattern you want!** 🎯