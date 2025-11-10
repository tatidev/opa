# OPMS Bulk Export → NetSuite Import - Implementation Plan

**Date:** January 18, 2025  
**Version:** 1.0.0  
**Status:** Ready for Development  
**Estimated Development Time:** 3-4 days  

## 📋 **PROJECT OVERVIEW**

### **Problem Statement**
Need to efficiently export up to 8,000 OPMS inventory items and import them into NetSuite with comprehensive failure tracking, retry logic, and operational visibility.

### **Solution Approach**
Two-phase sequential processing system with:
- **Phase 1**: Bulk CSV export from OPMS via file-based item code filtering
- **Phase 2**: NetSuite import with intelligent retry and detailed progress tracking

### **Key Benefits**
- ✅ **Data Integrity**: Complete audit trails and zero data loss
- ✅ **Operational Control**: Clear resume points and manual review capabilities  
- ✅ **System Reliability**: Automatic retry with exponential backoff
- ✅ **Performance**: Handles 8,000+ items efficiently with chunked processing

## 🎯 **IMPLEMENTATION PHASES**

### **Phase 1: Database Schema & Models** *(Day 1)*

#### **1.1 Database Migrations**
- **File**: `src/db/migrations/20250118_001_create_import_jobs.js`
- **Action**: Create `netsuite_import_jobs` table with job tracking
- **Testing**: Verify table creation and indices

#### **1.2 Database Schema**
- **File**: `src/db/migrations/20250118_002_create_import_items.js` 
- **Action**: Create `netsuite_import_items` table with detailed item tracking
- **Testing**: Verify foreign key constraints and performance indices

#### **1.3 Base Models**
- **File**: `src/models/ImportJobModel.js`
- **Action**: Job CRUD operations, status updates, counter management
- **File**: `src/models/ImportItemModel.js`
- **Action**: Item CRUD operations, retry logic, error classification
- **File**: `src/models/BulkExportModel.js`
- **Action**: Optimized OPMS queries for large datasets with chunking

### **Phase 2: File Upload & Bulk Export** *(Day 1-2)*

#### **2.1 File Upload Service**
- **File**: `src/services/FileUploadService.js`
- **Action**: Secure file handling with validation and size limits
- **Features**: Malware scanning, content validation, path traversal prevention

#### **2.2 Bulk Export Controller**
- **File**: `src/controllers/BulkExportController.js`
- **Action**: Handle bulk CSV export requests with file-based filtering
- **Endpoints**: `POST /api/export/csv/bulk`

#### **2.3 Bulk Processing Service**
- **File**: `src/services/BulkProcessingService.js`
- **Action**: Chunked processing for large datasets with progress tracking
- **Features**: Memory management, query optimization, progress callbacks

#### **2.4 Enhanced Export Routes**
- **File**: `src/routes/bulkExport.js`
- **Action**: Mount bulk export endpoints with proper middleware
- **Security**: File upload limits, authentication, rate limiting

### **Phase 3: NetSuite Import System** *(Day 2-3)*

#### **3.1 Import Job Controller**
- **File**: `src/controllers/NetSuiteImportController.js`
- **Action**: Import job management, status tracking, control operations
- **Endpoints**: Import initiation, status checks, retry controls

#### **3.2 NetSuite Import Service**
- **File**: `src/services/NetSuiteImportService.js`
- **Action**: Enhanced NetSuite integration with chunked processing
- **Features**: Batch management, API rate limiting, response handling

#### **3.3 Retry & Scheduling Service**
- **File**: `src/services/RetryService.js`
- **Action**: Exponential backoff, error classification, retry scheduling
- **Features**: Circuit breaker, jitter calculation, failure pattern detection

#### **3.4 Import Management Routes**
- **File**: `src/routes/netsuiteImport.js`
- **Action**: All import-related endpoints and job control
- **Security**: Job ownership validation, status filtering

### **Phase 4: Testing & Security** *(Day 3-4)*

#### **4.1 Unit Tests**
- **File**: `src/__tests__/bulkExport.test.js`
- **Coverage**: CSV generation, file parsing, chunked processing
- **File**: `src/__tests__/netsuiteImport.test.js`
- **Coverage**: Job management, status tracking, API integration
- **File**: `src/__tests__/retryLogic.test.js`
- **Coverage**: Error classification, backoff calculations, scheduling

#### **4.2 Security Tests**
- **File**: `src/__tests__/security.test.js`
- **Coverage**: File upload validation, SQL injection prevention, auth bypass
- **Tools**: Automated security scanning, malicious file testing

#### **4.3 Integration Tests**
- **File**: `src/__tests__/integration/bulk-system.test.js`
- **Coverage**: End-to-end export→import flow, failure recovery, performance

## 📊 **IMPLEMENTATION SCHEDULE**

### **Day 1: Foundation**
```
Morning (4h):
├── Database migrations and schema
├── Base models (ImportJob, ImportItem, BulkExport)
└── Model unit tests

Afternoon (4h):
├── FileUploadService with security validation
├── BulkExportController basic implementation  
└── File upload security tests
```

### **Day 2: Bulk Export**
```
Morning (4h):
├── Complete BulkExportController
├── BulkProcessingService with chunked queries
└── Bulk export routes and middleware

Afternoon (4h):
├── NetSuiteImportController foundation
├── Import job creation and CSV parsing
└── Basic import job tests
```

### **Day 3: Import System**
```
Morning (4h):
├── NetSuiteImportService with batch processing
├── RetryService with exponential backoff
└── Error classification and retry logic

Afternoon (4h):
├── Import status tracking and control endpoints
├── Circuit breaker and failure pattern detection
└── Retry logic and scheduling tests
```

### **Day 4: Testing & Polish**
```
Morning (4h):
├── Integration tests for full system
├── Performance testing with large datasets
└── Security validation and penetration testing

Afternoon (4h):
├── Documentation updates and API docs
├── Error handling improvements
└── Final testing and bug fixes
```

## 🛠️ **TECHNICAL IMPLEMENTATION DETAILS**

### **Database Configuration**
```javascript
// Add to existing dbConfig
const importJobsConfig = {
    // Connection pooling for bulk operations
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000
};
```

### **File Upload Configuration**
```javascript
// Multer configuration for secure uploads
const multerConfig = {
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB max
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Only allow plain text files
        if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv') {
            cb(null, true);
        } else {
            cb(new Error('Only text files allowed'));
        }
    }
};
```

### **Job Queue Configuration**
```javascript
// Bull queue for retry scheduling
const Queue = require('bull');
const retryQueue = new Queue('netsuite retry', process.env.REDIS_URL);

retryQueue.process('item-retry', async (job) => {
    const { itemId } = job.data;
    await processNetSuiteItem(itemId);
});
```

### **Performance Optimizations**
```javascript
// Chunked database queries for large datasets
const CHUNK_SIZE = 500;
const chunks = [];
for (let i = 0; i < itemCodes.length; i += CHUNK_SIZE) {
    chunks.push(itemCodes.slice(i, i + CHUNK_SIZE));
}

const results = [];
for (const chunk of chunks) {
    const chunkResult = await executeChunkedQuery(chunk);
    results.push(...chunkResult);
}
```

## 🔒 **SECURITY IMPLEMENTATION**

### **File Upload Security Checklist**
- ✅ **File size limits**: 2MB maximum to prevent DoS
- ✅ **Content type validation**: Only text/plain and text/csv
- ✅ **Content scanning**: Basic malware pattern detection
- ✅ **Filename sanitization**: Prevent path traversal attacks
- ✅ **Memory limits**: Stream processing to prevent memory exhaustion

### **SQL Injection Prevention**
```javascript
// Parameterized query example for bulk item codes
const query = `
    SELECT * FROM T_ITEM 
    WHERE code IN (${placeholders})
    AND archived = 'N'
`;
const params = sanitizedItemCodes;
const [rows] = await connection.execute(query, params);
```

### **Authentication & Authorization**
```javascript
// Middleware for bulk operations
const requireBulkPermissions = (req, res, next) => {
    if (!req.user || !req.user.permissions.includes('bulk_operations')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
};
```

## 🧪 **TESTING STRATEGY**

### **Unit Test Coverage Requirements**
- **Models**: 90%+ code coverage for all CRUD operations
- **Services**: 85%+ coverage including error paths and edge cases
- **Controllers**: 80%+ coverage for all endpoints and middleware

### **Integration Test Scenarios**
1. **End-to-end happy path**: 100 items export → import successfully
2. **Failure recovery**: Network timeouts, rate limits, validation errors
3. **Large dataset performance**: 1,000+ items with timing benchmarks
4. **Security validation**: Malicious uploads, injection attempts
5. **Resume functionality**: Job interruption and continuation

### **Load Testing Targets**
- **8,000 item export**: Complete within 60 seconds
- **8,000 item import**: Complete within 10 minutes (including retries)
- **Concurrent jobs**: Handle 3-5 simultaneous import jobs
- **Memory usage**: Stay under 1GB peak during large operations

## 📦 **DEPLOYMENT REQUIREMENTS**

### **Environment Variables**
```bash
# File upload settings
MAX_FILE_SIZE=2097152  # 2MB in bytes
MAX_ITEM_CODES=8000
UPLOAD_TEMP_DIR=/tmp/opms-uploads

# Job queue settings
REDIS_URL=redis://localhost:6379
JOB_QUEUE_CONCURRENCY=3
RETRY_MAX_ATTEMPTS=3

# NetSuite rate limiting
NETSUITE_MAX_CONCURRENT=2
NETSUITE_RATE_LIMIT=25  # requests per second
```

### **Infrastructure Requirements**
- **Redis**: Job queue for retry scheduling
- **Additional disk space**: ~500MB for temporary CSV files
- **Database connections**: Increase pool size for bulk operations
- **Memory**: 1-2GB additional for large dataset processing

## 🎯 **SUCCESS METRICS**

### **Development Milestones**
- ✅ **Day 1**: Database schema and models complete with tests
- ✅ **Day 2**: Bulk export system functional with security validation
- ✅ **Day 3**: Import system with retry logic operational
- ✅ **Day 4**: Full system tested and documented

### **Performance Benchmarks**
- **Export speed**: 8,000 items in <60 seconds
- **Import speed**: 8,000 items in <10 minutes with retries
- **Success rate**: >95% items imported successfully
- **Recovery rate**: >90% transient failures resolved automatically

### **Quality Gates**
- **Test coverage**: >85% across all new components
- **Security validation**: All OWASP top 10 threats addressed
- **Documentation**: Complete API docs and operational runbooks
- **Code review**: All code reviewed and approved before merge

## 🔄 **POST-IMPLEMENTATION**

### **Monitoring Setup**
- **Job completion rates**: Track success/failure ratios
- **Performance metrics**: Export/import timing and throughput
- **Error pattern analysis**: Identify common failure modes
- **Resource utilization**: Memory, CPU, and database load

### **Operational Procedures**
- **Failed job recovery**: Manual retry procedures for edge cases
- **Performance tuning**: Query optimization based on real-world usage
- **Error handling improvements**: Based on production error patterns
- **Capacity planning**: Scale database and infrastructure as needed

---

**Ready for Development**: This implementation plan provides a clear roadmap with specific deliverables, timelines, and quality gates. All components are designed to work together as a cohesive system following established patterns and security best practices.
