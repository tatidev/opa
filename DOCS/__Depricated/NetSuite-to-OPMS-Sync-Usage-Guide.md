# NetSuite to OPMS Sync - Simple Usage Guide

**Date:** January 18, 2025  
**Version:** 1.0.0  
**Status:** Ready for Use  
**Purpose:** Simple guide for using the NetSuite to OPMS sync system

## 🚀 **Quick Start**

### **1. Start Initial Sync (One-Time Setup)**
```bash
# Start initial bulk sync of all NetSuite items
curl -X POST http://localhost:3000/api/sync/netsuite-to-opms/initial \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Initial sync started successfully",
  "data": {
    "jobId": 123,
    "status": "started"
  }
}
```

### **2. Check Sync Status**
```bash
# Check initial sync progress
curl http://localhost:3000/api/sync/netsuite-to-opms/initial/status \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": 123,
    "status": "running",
    "progress": 45,
    "totalItems": 8000,
    "processedItems": 3600
  }
}
```

### **3. Sync Individual Item (Real-Time)**
```bash
# Sync a single item when it changes in NetSuite
curl -X POST http://localhost:3000/api/sync/netsuite-to-opms/item/ITEM_12345 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

## 📋 **Common Use Cases**

### **Use Case 1: Initial Setup**
**When:** First time setting up the sync system
**What:** Sync all 8,000+ NetSuite items to OPMS
**How:**
1. Start initial sync
2. Monitor progress
3. Wait for completion

```bash
# Start initial sync
POST /api/sync/netsuite-to-opms/initial

# Monitor progress (check every 5 minutes)
GET /api/sync/netsuite-to-opms/initial/status

# Check overall system status
GET /api/sync/netsuite-to-opms/status
```

### **Use Case 2: Real-Time Updates**
**When:** Individual items change in NetSuite
**What:** Sync only the changed item immediately
**How:**
1. NetSuite triggers webhook (automatic)
2. System syncs single item
3. OPMS updated within 30 seconds

```bash
# Manual single item sync (if needed)
POST /api/sync/netsuite-to-opms/item/{itemId}

# Check item sync history
GET /api/sync/netsuite-to-opms/item/{itemId}/status
```

### **Use Case 3: Manual Sync**
**When:** Need to sync specific items or troubleshoot
**What:** Manual control over sync operations
**How:**
1. Choose sync type
2. Specify items or criteria
3. Monitor results

```bash
# Sync specific items
POST /api/sync/netsuite-to-opms/manual
{
  "syncType": "specific_items",
  "itemIds": ["ITEM_12345", "ITEM_67890"]
}

# Force full sync (overrides running jobs)
POST /api/sync/netsuite-to-opms/force-full
```

## 🔧 **API Endpoints Reference**

### **Sync Operations**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/initial` | POST | Start initial bulk sync |
| `/initial/status` | GET | Check initial sync status |
| `/item/{itemId}` | POST | Sync single item |
| `/item/{itemId}/status` | GET | Check item sync history |
| `/manual` | POST | Manual sync trigger |
| `/force-full` | POST | Force full sync |

### **Monitoring & Control**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/status` | GET | Overall sync status |
| `/logs` | GET | Sync operation logs |
| `/health` | GET | System health check |

## 📊 **Understanding Sync Status**

### **Job Status Values**
- **`pending`**: Job created, waiting to start
- **`running`**: Job currently processing
- **`completed`**: Job finished successfully
- **`failed`**: Job encountered errors
- **`cancelled`**: Job was cancelled

### **Progress Indicators**
- **Progress**: Percentage complete (0-100%)
- **Processed Items**: Number of items processed so far
- **Successful Items**: Number of items synced successfully
- **Failed Items**: Number of items that failed to sync

### **Example Status Response**
```json
{
  "success": true,
  "data": {
    "jobId": 123,
    "jobType": "initial",
    "status": "running",
    "progress": 67,
    "successRate": 98,
    "failureRate": 2,
    "totalItems": 8000,
    "processedItems": 5360,
    "successfulItems": 5253,
    "failedItems": 107,
    "startedAt": "2025-01-18T10:00:00Z",
    "duration": 3600
  }
}
```

## 🚨 **Troubleshooting**

### **Common Issues & Solutions**

#### **Issue: "Initial sync already in progress"**
**Cause:** Another sync job is already running
**Solution:** Wait for current job to complete, or use force-full sync

```bash
# Check current status
GET /api/sync/netsuite-to-opms/status

# Force new sync (cancels running jobs)
POST /api/sync/netsuite-to-opms/force-full
```

#### **Issue: Sync job stuck in "running" status**
**Cause:** Job may have crashed or been interrupted
**Solution:** Check logs and restart if needed

```bash
# Check job logs
GET /api/sync/netsuite-to-opms/logs?jobId=123

# Force restart
POST /api/sync/netsuite-to-opms/force-full
```

#### **Issue: High failure rate**
**Cause:** NetSuite API issues or OPMS database problems
**Solution:** Check system health and logs

```bash
# Check system health
GET /api/sync/netsuite-to-opms/health

# Check error logs
GET /api/sync/netsuite-to-opms/logs?level=error
```

### **Health Check Response**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-18T10:30:00Z",
    "database": "connected",
    "netsuite": "connected"
  }
}
```

## 📈 **Performance Expectations**

### **Sync Times**
- **Initial Sync**: 2-4 hours for 8,000 items
- **Single Item**: 30 seconds or less
- **Batch Processing**: 100 items per minute

### **Rate Limits**
- **NetSuite API**: 1 request per second
- **OPMS Database**: 10 requests per second
- **Automatic Throttling**: Built-in to prevent overloading

## 🔒 **Security & Authentication**

### **Required Headers**
```bash
Authorization: Bearer YOUR_AUTH_TOKEN
Content-Type: application/json
```

### **Permissions Required**
- **Read Access**: NetSuite items and pricing
- **Write Access**: OPMS database updates
- **API Access**: Sync system endpoints

## 📝 **Best Practices**

### **1. Monitor Progress**
- Check status every 5-10 minutes during initial sync
- Use logs to troubleshoot issues
- Monitor overall system health

### **2. Handle Failures Gracefully**
- Failed items are automatically retried
- Check error logs for patterns
- Use manual sync for specific failed items

### **3. Plan Sync Windows**
- Initial sync: Run during off-hours
- Real-time sync: Runs automatically
- Manual sync: Use during maintenance windows

### **4. Backup Before Major Operations**
- Backup OPMS database before initial sync
- Test with small batches first
- Have rollback plan ready

## 🆘 **Getting Help**

### **Check These First**
1. **System Health**: `/api/sync/netsuite-to-opms/health`
2. **Recent Logs**: `/api/sync/netsuite-to-opms/logs`
3. **Job Status**: `/api/sync/netsuite-to-opms/status`

### **Common Error Messages**
- **"NetSuite API unavailable"**: Check NetSuite connectivity
- **"Database connection failed"**: Check database status
- **"Item not found"**: Verify NetSuite item ID exists

### **Support Information**
- **Logs**: Check application logs for detailed errors
- **Database**: Verify sync tables are created
- **NetSuite**: Confirm API credentials and permissions

---

**Need More Help?** Check the technical specification document for detailed implementation details.
