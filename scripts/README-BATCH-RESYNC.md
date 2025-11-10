# OPMS to NetSuite Batch Re-Sync Guide

## Overview

This script allows you to re-sync all OPMS items with valid "nnnn-nnnn" code format to NetSuite. It only includes items that have:
- ✅ Valid code format (nnnn-nnnn)
- ✅ Complete vendor data
- ✅ Valid NetSuite vendor mapping
- ✅ Active status
- ✅ Color data

## Usage

### Basic Usage

```bash
# 1. Test with dry run (see what would be synced)
node scripts/resync-all-valid-code-items.js --dry-run

# 2. Sync a small batch first to test
node scripts/resync-all-valid-code-items.js --limit 10

# 3. Sync all items with default settings
node scripts/resync-all-valid-code-items.js
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `--limit N` | Limit number of items to sync | All items |
| `--dry-run` | Show what would be synced without queueing | false |
| `--priority LEVEL` | Priority: HIGH, NORMAL, LOW | NORMAL |
| `--batch-size N` | Process in batches of N items | 50 |
| `--delay MS` | Delay between batches (ms) | 1000 |

### Examples

```bash
# Dry run to preview items
node scripts/resync-all-valid-code-items.js --dry-run

# Sync first 100 items
node scripts/resync-all-valid-code-items.js --limit 100

# High priority with smaller batches
node scripts/resync-all-valid-code-items.js --priority HIGH --batch-size 25

# Custom batch size and delay
node scripts/resync-all-valid-code-items.js --batch-size 100 --delay 2000
```

## How It Works

1. **Query OPMS Database**: Finds all items matching:
   - Code format: `nnnn-nnnn` (e.g., "3600-0002")
   - Has vendor data
   - Has NetSuite vendor mapping
   - Active and not archived
   - Has color data

2. **Queue for Sync**: Adds items to the OPMS-to-NetSuite sync queue via the `OpmsChangeDetectionService`

3. **Process in Batches**: Processes items in configurable batches with delays between batches

4. **Report Results**: Shows summary of queued, skipped, and failed items

## Monitoring

After queuing items for sync, monitor the progress:

```bash
# Check queue status via API
curl http://localhost:3000/api/opms-sync/queue

# Or use the sync dashboard
open http://localhost:3000/dashboard
```

## Stopping the Script

The script can be safely interrupted at any time:

- **Press Ctrl+C** to stop gracefully
- The script will finish processing the current batch
- Show a summary of items already queued
- Exit cleanly without corrupting data

Items that were already queued will continue to sync in the background. Monitor progress at `/api/opms-sync/queue`.

⚠️ **Note**: Pressing Ctrl+C once initiates graceful shutdown. Pressing it again forces immediate exit.

## Important Notes

- **Vendor Data Required**: Items without complete vendor data and NetSuite mapping are excluded
- **Digital Items Excluded**: Items with code format other than nnnn-nnnn are automatically skipped
- **Batch Processing**: Large batches are processed in smaller groups with delays to avoid overwhelming NetSuite
- **Dry Run First**: Always test with `--dry-run` before syncing large batches
- **Interrupt Safe**: Can be stopped at any time with Ctrl+C

## Error Handling

The script will:
- Skip digital/invalid items automatically
- Log failures but continue processing
- Report all errors in the summary
- Exit with code 0 on success, 1 on failure

## Production Usage

For production deployment:

```bash
# On production server at /opuzen-efs/prod/opms-api/
cd /opuzen-efs/prod/opms-api

# Always test first with dry run
NODE_ENV=production node scripts/resync-all-valid-code-items.js --dry-run --limit 10

# If dry run looks good, run with small batch first
NODE_ENV=production node scripts/resync-all-valid-code-items.js --limit 100

# Then run full sync
NODE_ENV=production node scripts/resync-all-valid-code-items.js --priority NORMAL --batch-size 50
```

## See Also

- [NetSuite Sync Architecture](../DOCS/NetSuite-Integrations/OPMS-NetSuite-Sync-Implementation-Guide.md)
- [OPMS Database Specification](../DOCS/ai-specs/app-technical-specifications/opms-database-spec.md)

