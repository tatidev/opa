# How to Import CSV Data Into OPMS - Step-by-Step Guide

**Purpose:** Clear instructions for importing product data from CSV files into the OPMS database.

---

## 🎯 **OVERVIEW**

This guide shows you how to import new product data into OPMS using CSV files. The data goes **INTO OPMS first**, and can later be exported to NetSuite if needed.

### **What This Does**
- ✅ Imports product data **INTO OPMS database**
- ✅ Creates new products and items in OPMS
- ✅ Validates data format and prevents errors
- ✅ Provides detailed progress tracking

### **What This Doesn't Do**
- ❌ Does NOT directly create NetSuite items
- ❌ Does NOT export FROM OPMS (that's a separate process)

---

## 📋 **STEP-BY-STEP INSTRUCTIONS**

### **Step 1: Prepare Your CSV File**

1. **Download the template**:
   ```bash
   GET http://localhost:3000/api/import/csv/template
   ```
   Or use the business template: `DOCS/sample-business-template.csv`

2. **Fill in your data** following these rules:
   - ✅ **Item Code**: Must be `####-####<alpha>` format (e.g., `1354-6543`, `7654-8989K`)
   - ✅ **Product Name**: Required (e.g., `Tranquil`)
   - ✅ **Color**: Required (e.g., `Ash` or `Ash, Blue`)
   - ✅ **Other fields**: Optional but recommended

3. **Save as CSV** from Excel or Google Sheets

### **Step 2: Upload Your CSV File**

**API Endpoint:**
```bash
POST http://localhost:3000/api/import/csv
Content-Type: multipart/form-data
Authorization: Bearer YOUR_TOKEN

# Upload file
curl -X POST "http://localhost:3000/api/import/csv" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@your-products.csv"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "CSV import job created successfully",
  "job": {
    "id": 123,
    "uuid": "job_1234567890_abc123",
    "status": "pending",
    "totalItems": 100,
    "validItems": 95,
    "failedItems": 5
  },
  "validation": {
    "totalRows": 100,
    "validRows": 95,
    "invalidRows": 5,
    "warnings": ["Row 3: Missing color information"]
  }
}
```

### **Step 3: Monitor Import Progress**

**Check Job Status:**
```bash
GET http://localhost:3000/api/import/jobs/{jobId}

# Example
curl -X GET "http://localhost:3000/api/import/jobs/123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": 123,
    "status": "processing",
    "total_items": 100,
    "items_processed": 45,
    "items_succeeded": 40,
    "items_failed_permanent": 3,
    "items_failed_retryable": 2
  },
  "status": {
    "total": 100,
    "pending": 55,
    "processing": 0,
    "success": 40,
    "failed_retryable": 2,
    "failed_permanent": 3
  }
}
```

### **Step 4: Review Import Results**

**Get Detailed Results:**
```bash
GET http://localhost:3000/api/import/jobs/{jobId}/details

# Example
curl -X GET "http://localhost:3000/api/import/jobs/123/details" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": 123,
    "status": "completed",
    "original_filename": "my-products.csv"
  },
  "items": [
    {
      "id": 1,
      "opms_item_code": "1354-6543",
      "status": "success",
      "csv_row_number": 1
    },
    {
      "id": 2,
      "opms_item_code": "2001-5678",
      "status": "failed_permanent",
      "last_error_message": "Duplicate item code",
      "csv_row_number": 2
    }
  ]
}
```

---

## 🔍 **CHECKING YOUR IMPORTED DATA**

### **Verify Items Were Created**

After successful import, your items will be in the OPMS database:

**Check Specific Item:**
```bash
# Search for your imported item
GET http://localhost:3000/api/products?search=Tranquil
```

**Check All Recent Imports:**
```bash
# List recent import jobs
GET http://localhost:3000/api/import/jobs?limit=10
```

---

## ⚠️ **COMMON ISSUES & SOLUTIONS**

### **Issue 1: Authentication Required**
**Error:** `401 - Authentication required`
**Solution:** Get an auth token first:
```bash
POST http://localhost:3000/api/auth/login
{
  "username": "your_username",
  "password": "your_password"
}
```

### **Issue 2: Invalid Item Code Format**
**Error:** `Invalid Item Code "ABC123" - FIX: Must use format ####-####<alpha>`
**Solution:** Convert to new format:
- `ABC123` → `1354-6543`
- `PROD-01K` → `2001-5678K`
- `FAB001A` → `3001-0001A`

### **Issue 3: Missing Required Fields**
**Error:** `Missing required field: Product Name`
**Solution:** Ensure every row has:
- Item Code (####-####<alpha> format)
- Product Name
- Color

### **Issue 4: File Too Large**
**Error:** File upload fails
**Solution:** 
- Keep files under 50MB
- Split large imports into smaller batches

---

## 🎯 **QUICK REFERENCE**

### **Required Authentication**
All endpoints require Bearer token in header:
```
Authorization: Bearer YOUR_TOKEN
```

### **Key Endpoints**
- **Upload CSV**: `POST /api/import/csv`
- **Get Template**: `GET /api/import/csv/template`
- **Check Status**: `GET /api/import/jobs/{jobId}`
- **Get Details**: `GET /api/import/jobs/{jobId}/details`
- **List Jobs**: `GET /api/import/jobs`

### **Item Code Format**
- ✅ **CORRECT**: `1354-6543`, `7654-8989K`, `2001-5678A`, `0000-0001B`
- ❌ **WRONG**: `ABC123`, `PROD-01`, `FAB-001`, `1234-567AB` (multiple letters)

---

## 🎉 **SUCCESS!**

Once your CSV is imported:
1. ✅ **Products created** in OPMS database
2. ✅ **Items linked** to products with colors
3. ✅ **Data searchable** via OPMS API
4. ✅ **Ready for NetSuite export** (if needed later)

Your product data is now in OPMS and ready to use! 🚀
