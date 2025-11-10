# NetSuite to OPMS Sync Specification

**Date:** January 18, 2025  
**Version:** 1.0.0  
**Status:** Ready for Implementation  
**Purpose:** Technical specification for bidirectional sync between NetSuite and OPMS

## 🎯 **Overview**

This specification defines a **bidirectional sync system** that enables:
1. **Initial Bulk Sync**: One-time sync of all items from NetSuite to OPMS
2. **Real-Time Sync**: Individual item updates triggered by NetSuite changes
3. **Fallback Mechanisms**: Scheduled checks and manual triggers

## 🔄 **Sync Architecture**

### **Data Flow:**
```
NetSuite Item Changes → Webhook/API → Sync Service → OPMS Database
                    ↓
              Fallback Scheduled Checks
                    ↓
              Manual Trigger Options
```

### **Sync Types:**

| Type | Trigger | Frequency | Scope | Use Case |
|------|---------|-----------|-------|----------|
| **Initial** | Manual/API | Once | All Items | Setup/Reset |
| **Real-Time** | NetSuite Change | Immediate | Single Item | Live Updates |
| **Scheduled** | Cron Job | Every 15 min | Changed Items | Fallback |
| **Manual** | User Action | On-Demand | Custom | Troubleshooting |

## 📊 **Field Mapping**

### **NetSuite → OPMS Sync Fields:**

| Field Name | NetSuite Source | OPMS Target | Data Type | Sync Priority |
|------------|-----------------|-------------|-----------|---------------|
| **Base Price (Cut Price)** | `price_1_` | `p_res_cut` | Decimal | High |
| **Roll Price (Price Level)** | `price_1_` | `p_hosp_roll` | Decimal | High |
| **Purchase Price** | `cost` | `purchase_price` | Decimal | Medium |
| **Roll Price (Custom)** | `custitem_f3_rollprice` | `roll_price_custom` | Decimal | Medium |

## 🏗️ **Technical Components**

### **1. NetSuite Integration**
- **SuiteScript**: Webhook trigger on item save
- **API Client**: Fetch item data from NetSuite
- **Change Detection**: Monitor `lastmodifieddate` and price fields

### **2. Sync Service**
- **Initial Sync**: Bulk processing with progress tracking
- **Real-Time Sync**: Individual item processing
- **Error Handling**: Retry logic and failure logging
- **Rate Limiting**: Respect NetSuite API limits

### **3. OPMS Integration**
- **Database Updates**: Direct field updates
- **Validation**: Data type and range checking
- **Audit Trail**: Track all sync operations

### **4. Monitoring & Control**
- **Status Dashboard**: Real-time sync status
- **Logging**: Comprehensive operation logging
- **Alerts**: Email/Slack notifications for failures
- **Manual Controls**: Override and force sync options

## 🔧 **API Endpoints**

### **Sync Operations:**
```
POST /api/sync/netsuite-to-opms/initial          # Initial bulk sync
GET  /api/sync/netsuite-to-opms/initial/status   # Initial sync status
POST /api/sync/netsuite-to-opms/item/{itemId}    # Single item sync
GET  /api/sync/netsuite-to-opms/item/{itemId}/status  # Item sync status
POST /api/sync/netsuite-to-opms/manual           # Manual trigger
POST /api/sync/netsuite-to-opms/force-full       # Force full sync
```

### **Monitoring:**
```
GET  /api/sync/netsuite-to-opms/status           # Overall sync status
GET  /api/sync/netsuite-to-opms/logs             # Sync operation logs
GET  /api/sync/netsuite-to-opms/health           # System health check
```

## 📋 **Implementation Phases**

### **Phase 1: Core Sync Service**
- Basic sync service implementation
- Database schema for tracking
- Error handling and logging

### **Phase 2: NetSuite Integration**
- SuiteScript webhook implementation
- API client for NetSuite
- Change detection logic

### **Phase 3: Real-Time Sync**
- Webhook endpoint implementation
- Individual item processing
- Performance optimization

### **Phase 4: Monitoring & Control**
- Status dashboard
- Alerting system
- Manual control interfaces

## 🧪 **Testing Strategy**

### **Unit Tests:**
- Sync service logic
- Data transformation
- Error handling

### **Integration Tests:**
- NetSuite API integration
- OPMS database updates
- End-to-end sync workflows

### **Test Utilities:**
- Mock NetSuite responses
- Test data generators
- Sync simulation tools

## 📈 **Performance Requirements**

### **Sync Performance:**
- **Initial Sync**: Complete 8,000 items within 2 hours
- **Real-Time Sync**: Individual item within 30 seconds
- **Scheduled Sync**: Process changes within 15 minutes

### **API Limits:**
- **NetSuite**: 1 request per second
- **OPMS**: 10 requests per second
- **Rate Limiting**: Automatic throttling and retry

## 🔒 **Security & Compliance**

### **Authentication:**
- OAuth 1.0a for NetSuite
- API key authentication for webhooks
- Role-based access control

### **Data Protection:**
- Encrypted data transmission
- Audit logging for all operations
- Data validation and sanitization

## 📚 **Related Documents**

- [OPMS Import Guide](./OPMS-Import-Guide.md)
- [NetSuite Item Creation Spec](./ai-specs/spec-NetSuite-Item-Creation.md)
- [API Routes Discovery](./ai-specs/spec-API-Routes-Discovery.md)

---

**Next Steps:** Implement core sync service and testing framework
