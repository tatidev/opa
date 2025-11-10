# Opuzen API Documentation Guide

This guide explains how to access and use the API documentation for the Opuzen API.

## Table of Contents

1. [Interactive Swagger Documentation](#interactive-swagger-documentation)
2. [Postman Collection](#postman-collection)
3. [API Endpoints Overview](#api-endpoints-overview)
4. [Authentication](#authentication)
5. [Error Handling](#error-handling)

## Interactive Swagger Documentation

The API includes interactive Swagger documentation that allows you to explore and test all available endpoints directly from your browser.

### Accessing the Documentation

1. Start the API server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/api-docs
   ```

3. You'll see the Swagger UI interface with all available endpoints organized by tags.

### Using the Documentation

The Swagger UI provides the following features:

- **Endpoint Exploration**: Browse all available endpoints organized by category (Products, Items, Colors, System)
- **Request Parameters**: See all required and optional parameters for each endpoint
- **Response Examples**: View example responses and schema definitions
- **Try It Out**: Test endpoints directly from the browser with your own parameters
- **Models**: View detailed data models for all API objects

To test an endpoint:

1. Click on the endpoint you want to test
2. Click the "Try it out" button
3. Fill in any required parameters
4. Click "Execute"
5. View the response below

## Postman Collection

For more advanced testing and integration, you can use the included Postman collection.

### Importing the Collection

1. Download [Postman](https://www.postman.com/downloads/)
2. In Postman, click "Import" and select the file:
   ```
   opuzen-api.postman_collection.json
   ```
3. The collection will be imported with all endpoints pre-configured

### Using the Collection

The collection includes:

- Environment variables for base URL
- All API endpoints organized by category
- Pre-configured request parameters
- Example request bodies for POST/PUT endpoints

To use the collection:

1. Set the `baseUrl` variable to your API server (default: `http://localhost:3000`)
2. Browse the folders to find the endpoint you want to test
3. Click "Send" to execute the request
4. View the response in the bottom panel

## API Endpoints Overview

The API is organized into the following categories:

### System Endpoints

- `GET /` - API root information
- `GET /health` - Health check and status
- `GET /api-docs` - API documentation

### Products Endpoints

- `GET /api/products` - List all products with filtering
- `POST /api/products/search` - Search products with advanced filtering and pagination
- `GET /api/products/:id` - Get product details
- `GET /api/products/:id/items/:type` - Get items for a product
- `GET /api/products/:id/info/:type` - Get product info for tag display
- `GET /api/products/:id/specsheet/:type` - Get product specification sheet
- `POST /api/products/cache/rebuild` - Rebuild the product cache table
- `POST /api/products/cache/refresh/:id/:type` - Refresh a specific product in the cache

### Items Endpoints

- `GET /api/items/:id` - Get item details
- `GET /api/items/:id/info/:type` - Get item info for tag display
- `GET /api/items/:id/colors` - Get colors for an item
- `POST /api/items/:id/colors` - Add a color to an item
- `DELETE /api/items/:id/colors/:colorId` - Remove a color from an item

### Colors Endpoints

- `GET /api/colors` - List all colors with filtering
- `GET /api/colors/:id` - Get color details
- `GET /api/colors/:id/items` - Get items that use a specific color

## Authentication

Currently, the API does not require authentication. Future versions will implement JWT-based authentication.

## Error Handling

The API uses standard HTTP status codes and a consistent error response format:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error information (development only)"
}
```

Common error codes:

- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `500` - Server Error (unexpected error)

In development mode, detailed error messages are included. In production, only the error title is returned for security reasons.

## Data Models

### Product

```json
{
  "id": 1,
  "name": "Product Name",
  "description": "Product description",
  "type": "R", // R=Regular, D=Digital
  "archived": "N" // Y=archived, N=active
}
```

### Item

```json
{
  "id": 1,
  "product_id": 1,
  "product_type": "R", // R=Regular, D=Digital
  "code": "ITEM-CODE",
  "archived": "N" // Y=archived, N=active
}
```

### Color

```json
{
  "id": 1,
  "name": "Color Name",
  "hex_code": "#FFFFFF",
  "active": "Y" // Y=active, N=inactive
}
```

## Product Search Endpoint

The product search endpoint (`POST /api/products/search`) provides powerful search capabilities that match the legacy PHP application's behavior.

### Request Format

```json
{
  "search": {
    "value": "search term"
  },
  "draw": 1,
  "start": 0,
  "length": 10,
  "order": [
    {
      "column": 0,
      "dir": "asc"
    }
  ]
}
```

### Response Format

```json
{
  "draw": 1,
  "recordsTotal": 12550,
  "recordsFiltered": 167,
  "tableData": [
    {
      "product_name": "Product Name",
      "vendors_name": "Vendor Name",
      "vendors_abrev": "VEND",
      // Additional product fields...
    }
  ],
  "arr": [
    // Same data as tableData (for legacy compatibility)
  ]
}
```

### Special Search Features

- **Vendor Abbreviation Search**: Special handling for search terms of 4 characters or less
- **Full Text Search**: Searches across product names, vendor names, colors, uses, firecodes, and content
- **Duplicate Elimination**: Results are de-duplicated based on product_id and product_type
- **Filtering**: Excludes archived products and includes only products where in_master != 'N'

## Additional Resources

- [API Development Progress Report](./API_Development_Progress_Report.md)
- [GitHub Repository](https://github.com/opuzen/opuzen-api)

---

For questions or support, please contact the API development team.

## Item Code Format Requirements *(NEW)*

### **CSV Import Validation**
Starting January 28, 2025, all CSV imports require the new item code format:

- **✅ REQUIRED FORMAT**: `####-####` (4 digits, dash, 4 digits)
- **✅ VALID EXAMPLES**: `1354-6543`, `2001-5678`, `0000-0001`
- **❌ REJECTED FORMATS**: `ABC123`, `PROD-01`, `FAB-001`

### **Legacy Data Protection**
- **PRESERVED**: Existing database items with legacy codes remain unchanged
- **FUNCTIONAL**: Legacy items continue to work in all API endpoints
- **NO MIGRATION**: Legacy codes are not automatically converted

### **Validation Error Example**
```json
{
  "error": "Invalid Item Code \"ABC123\" - FIX: Must use new format ####-#### (4 digits, dash, 4 digits). Examples: \"1354-6543\", \"2001-5678\", \"9999-0001\"",
  "field": "Item Id (Opuzen Code)",
  "fixSuggestion": "Convert ABC123 to format like 1000-0123"
}
```

### **Migration Resources**
- **Migration Guide**: `DOCS/ai-specs/Item-Code-Migration-Guide.md`
- **AI Specification**: `DOCS/ai-specs/spec-CSV-Item-Code-Format-Validation.md`
- **Implementation**: `src/services/csvImportService.js`

## Batch CSV Export System *(NEW)*

### **Large-Scale OPMS → NetSuite Exports**
The system now supports large-scale CSV exports through batch processing:

- **✅ ENDPOINT**: `POST /api/export/csv/batch`
- **✅ SCALE**: Up to 50,000 items per export
- **✅ AUTOMATION**: Automatic 1000-item batch iteration
- **✅ FILTERING**: Inherits `onlyValidCodes=true` validation

### **Usage Example**
```bash
POST /api/export/csv/batch
Content-Type: application/json

{
    "maxItems": 10000,
    "filters": {
        "onlyValidCodes": true,
        "itemIdStart": 1,
        "itemIdEnd": 100000
    }
}
```

### **Key Benefits**
- **Single CSV File**: All batches combined automatically
- **Valid Code Filtering**: Only exports standardized item codes
- **Progress Tracking**: Real-time batch progress monitoring
- **Error Resilience**: Continues processing if individual batches fail

### **Technical Resources**
- **AI Specification**: `DOCS/ai-specs/spec-Batch-CSV-Export-System.md`
- **Implementation**: `src/services/batchExportService.js`
- **Postman Setup**: `Postman-Batch-Export-Setup.md` 