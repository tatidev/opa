# Restock Service Requirements

## Executive Summary

The Restock Service is a critical component of the Opuzen API that manages sample inventory requests and shipments to different destinations (showrooms, sales offices, etc.). This document outlines the requirements for modernizing the legacy PHP restock system into a robust Node.js/Express API service.

## Table of Contents

1. [Legacy System Analysis](#legacy-system-analysis)
2. [Business Requirements](#business-requirements)
3. [System Dependencies](#system-dependencies)
4. [API Design](#api-design)
5. [Data Models](#data-models)
6. [Database Structure](#database-structure)
7. [Business Logic](#business-logic)
8. [Implementation Plan](#implementation-plan)
9. [Security Considerations](#security-considerations)
10. [Testing Strategy](#testing-strategy)

---

## Legacy System Analysis

### Current Implementation (PHP/CodeIgniter)

The legacy restock system consists of:

**Controllers:**
- `Restock.php` (375 lines) - Main restock controller
- Handles order creation, processing, and completion

**Models:**
- `Restock_model.php` (192 lines) - Data access layer
- Manages database operations across multiple tables

**Key Features:**
- Duplicate order detection and merging
- Multi-quantity tracking (total, priority, ringsets)
- Automatic order completion logic
- Email notifications for backorders
- Audit trail with user tracking
- Historical order archiving

### Status Management

The system uses specific status IDs:
- **Backorder**: `[7]` - Items needing purchase/order
- **Completed**: `[5]` - Fulfilled orders
- **Cancelled**: `[6]` - Cancelled orders

### Database Tables (Legacy)

- `t_restock_order` - Active restock orders
- `t_restock_order_completed` - Completed/cancelled orders
- `t_restock_ship` - Shipment records for active orders
- `t_restock_ship_completed` - Shipment records for completed orders

---

## Business Requirements

### Functional Requirements

1. **Order Management**
   - Create new restock orders for multiple items
   - Detect and handle duplicate orders
   - Update order status throughout lifecycle
   - Cancel orders when necessary

2. **Quantity Tracking**
   - Track three quantity types:
     - Total samples needed
     - Priority samples (rush orders)
     - Sample ringsets
   - Monitor shipped quantities vs. requested

3. **Shipment Management**
   - Record shipments against orders
   - Support partial shipments
   - Track shipment history

4. **Automatic Completion**
   - Auto-complete orders when quantities are fulfilled
   - Move completed orders to historical storage
   - Clean up active order tables

5. **Notification System**
   - Send email alerts for backorder items
   - Notify relevant users based on environment
   - Include detailed order information

6. **Filtering and Reporting**
   - Filter by destination, status, date ranges
   - Generate analytics and reports
   - Export order history

### Non-Functional Requirements

1. **Performance**
   - Handle batch operations efficiently
   - Support concurrent order processing
   - Maintain response times under 2 seconds

2. **Scalability**
   - Support growing number of orders
   - Handle multiple simultaneous users
   - Efficient database queries with proper indexing

3. **Reliability**
   - Ensure data consistency across transactions
   - Handle system failures gracefully
   - Maintain audit trail for all operations

4. **Security**
   - Role-based access control
   - Secure API endpoints
   - Data validation and sanitization

---

## System Dependencies

### 1. User Management System

**Requirements:**
- User authentication and authorization
- Role-based permissions (view, create, edit, complete)
- User tracking for audit trail
- JWT-based authentication

**API Endpoints Needed:**
```
POST /api/auth/login
POST /api/auth/logout
GET /api/users
POST /api/users
GET /api/users/:id
PUT /api/users/:id
DELETE /api/users/:id
```

**User Model:**
```javascript
{
  id: number,
  username: string,
  email: string,
  first_name: string,
  last_name: string,
  role: string,
  active: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

### 2. Showroom/Destination Management

**Requirements:**
- Manage showroom/destination master data
- Track destination-specific information
- Support destination-based filtering
- User-destination permissions

**API Endpoints Needed:**
```
GET /api/showrooms
POST /api/showrooms
GET /api/showrooms/:id
PUT /api/showrooms/:id
DELETE /api/showrooms/:id
```

**Showroom Model:**
```javascript
{
  id: number,
  name: string,
  abbreviation: string,
  address: string,
  city: string,
  state: string,
  zip: string,
  contact_person: string,
  phone: string,
  email: string,
  active: boolean,
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## API Design

### Core Endpoints

#### Restock Orders Management
```
GET    /api/restocks              - List all active restock orders
POST   /api/restocks              - Create new restock order(s)
GET    /api/restocks/:id          - Get specific restock order details
PUT    /api/restocks/:id          - Update restock order status
DELETE /api/restocks/:id          - Cancel restock order
```

#### Historical Orders
```
GET    /api/restocks/history      - List completed/cancelled orders
```

#### Shipment Management
```
GET    /api/restocks/:id/shipments         - Get shipments for an order
POST   /api/restocks/:id/shipments         - Record new shipment
PUT    /api/restocks/:id/shipments/:shipId - Update shipment
```

#### Reference Data
```
GET    /api/restocks/destinations - Get available destinations
GET    /api/restocks/statuses     - Get available statuses
```

#### Analytics & Reporting
```
GET    /api/restocks/analytics/summary        - Dashboard metrics
GET    /api/restocks/analytics/by-destination - Destination analytics
GET    /api/restocks/analytics/by-item        - Item analytics
```

### Request/Response Examples

#### Create Restock Order
```json
POST /api/restocks
{
  "destination_id": 5,
  "items": [
    {
      "item_id": 123,
      "size": "12x18",
      "quantities": {
        "total": 10,
        "priority": 2,
        "ringsets": 1
      }
    }
  ],
  "notes": "Urgent request for showroom display",
  "check_duplicates": true
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": 456,
    "destination_id": 5,
    "status": "pending",
    "items": [...],
    "requested_by": 1,
    "date_requested": "2024-01-15T10:30:00Z"
  },
  "message": "Restock order created successfully"
}
```

---

## Data Models

### RestockOrder Model
```javascript
{
  id: number,
  item_id: number,
  destination_id: number,
  size: string,
  quantities: {
    total: number,
    priority: number,
    ringsets: number
  },
  quantities_shipped: {
    total: number,
    priority: number,
    ringsets: number
  },
  status: 'pending' | 'backorder' | 'completed' | 'cancelled',
  notes: string,
  date_requested: timestamp,
  date_completed: timestamp,
  requested_by: number,
  completed_by: number,
  created_at: timestamp,
  updated_at: timestamp,
  
  // Related data (populated via joins)
  item: {
    id: number,
    code: string,
    product_name: string,
    color: string,
    vendor_name: string
  },
  destination: {
    id: number,
    name: string,
    abbreviation: string
  },
  user: {
    id: number,
    username: string,
    name: string
  }
}
```

### RestockShipment Model
```javascript
{
  id: number,
  restock_order_id: number,
  quantities: {
    samples: number,
    ringsets: number
  },
  date_shipped: timestamp,
  shipped_by: number,
  notes: string,
  created_at: timestamp,
  updated_at: timestamp,
  
  // Related data
  user: {
    id: number,
    username: string,
    name: string
  }
}
```

---

## Database Structure

### Tables

#### restock_orders (Active Orders)
```sql
CREATE TABLE restock_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  destination_id INT NOT NULL,
  size VARCHAR(50),
  quantity_total INT DEFAULT 0,
  quantity_priority INT DEFAULT 0,
  quantity_ringsets INT DEFAULT 0,
  quantity_shipped INT DEFAULT 0,
  quantity_ringsets_shipped INT DEFAULT 0,
  status_id INT NOT NULL,
  notes TEXT,
  date_requested TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  requested_by INT NOT NULL,
  date_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  modified_by INT,
  
  FOREIGN KEY (item_id) REFERENCES T_ITEM(id),
  FOREIGN KEY (destination_id) REFERENCES showrooms(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (modified_by) REFERENCES users(id),
  FOREIGN KEY (status_id) REFERENCES restock_statuses(id),
  
  INDEX idx_status (status_id),
  INDEX idx_destination (destination_id),
  INDEX idx_item (item_id),
  INDEX idx_requested_by (requested_by),
  INDEX idx_date_requested (date_requested)
);
```

#### restock_orders_history (Completed Orders)
```sql
CREATE TABLE restock_orders_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  original_order_id INT NOT NULL,
  item_id INT NOT NULL,
  destination_id INT NOT NULL,
  size VARCHAR(50),
  quantity_total INT DEFAULT 0,
  quantity_priority INT DEFAULT 0,
  quantity_ringsets INT DEFAULT 0,
  quantity_shipped INT DEFAULT 0,
  quantity_ringsets_shipped INT DEFAULT 0,
  status_id INT NOT NULL,
  notes TEXT,
  date_requested TIMESTAMP,
  requested_by INT NOT NULL,
  date_completed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_by INT NOT NULL,
  
  FOREIGN KEY (item_id) REFERENCES T_ITEM(id),
  FOREIGN KEY (destination_id) REFERENCES showrooms(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (completed_by) REFERENCES users(id),
  FOREIGN KEY (status_id) REFERENCES restock_statuses(id),
  
  INDEX idx_original_order (original_order_id),
  INDEX idx_status (status_id),
  INDEX idx_destination (destination_id),
  INDEX idx_date_completed (date_completed)
);
```

#### restock_shipments
```sql
CREATE TABLE restock_shipments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  restock_order_id INT NOT NULL,
  quantity_samples INT DEFAULT 0,
  quantity_ringsets INT DEFAULT 0,
  date_shipped TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipped_by INT NOT NULL,
  notes TEXT,
  
  FOREIGN KEY (restock_order_id) REFERENCES restock_orders(id),
  FOREIGN KEY (shipped_by) REFERENCES users(id),
  
  INDEX idx_order (restock_order_id),
  INDEX idx_shipped_by (shipped_by),
  INDEX idx_date_shipped (date_shipped)
);
```

#### restock_statuses (Reference Data)
```sql
CREATE TABLE restock_statuses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

INSERT INTO restock_statuses (id, name, description) VALUES
(1, 'Pending', 'Order created and awaiting processing'),
(2, 'In Progress', 'Order being processed'),
(3, 'Partially Shipped', 'Some items have been shipped'),
(4, 'Shipped', 'All items have been shipped'),
(5, 'Completed', 'Order fulfilled and closed'),
(6, 'Cancelled', 'Order cancelled'),
(7, 'Backorder', 'Items need to be purchased/ordered');
```

---

## Business Logic

### Order Creation Logic

1. **Duplicate Detection**
   ```javascript
   // Check for existing orders with same item, destination, and size
   const existingOrders = await findDuplicateOrders(itemId, destinationId, size);
   
   if (existingOrders.length > 0 && !force) {
     return {
       success: false,
       status: 'duplicates_found',
       data: existingOrders
     };
   }
   ```

2. **Quantity Merging**
   ```javascript
   // If user confirms duplicate handling, merge quantities
   if (mergeDuplicates) {
     await updateOrderQuantities(existingOrderId, {
       total: existingQuantity.total + newQuantity.total,
       priority: existingQuantity.priority + newQuantity.priority,
       ringsets: existingQuantity.ringsets + newQuantity.ringsets
     });
   }
   ```

### Shipment Processing Logic

1. **Record Shipment**
   ```javascript
   await createShipment({
     restock_order_id: orderId,
     quantities: { samples: 10, ringsets: 2 },
     shipped_by: userId
   });
   ```

2. **Update Order Quantities**
   ```javascript
   await updateOrderShippedQuantities(orderId, {
     total: currentShipped.total + newShipment.samples,
     ringsets: currentShipped.ringsets + newShipment.ringsets
   });
   ```

3. **Check for Completion**
   ```javascript
   const isComplete = (
     order.quantity_total === order.quantity_shipped &&
     order.quantity_ringsets === order.quantity_ringsets_shipped
   );
   
   if (isComplete) {
     await completeOrder(orderId, userId);
   }
   ```

### Auto-Completion Logic

1. **Move to History**
   ```javascript
   async function completeOrder(orderId, completedBy) {
     await db.transaction(async (trx) => {
       // Copy order to history
       await trx('restock_orders_history').insert({
         original_order_id: orderId,
         ...orderData,
         completed_by: completedBy,
         date_completed: new Date()
       });
       
       // Copy shipments to history
       await trx('restock_shipments_history').insert(shipmentData);
       
       // Remove from active tables
       await trx('restock_orders').where('id', orderId).del();
       await trx('restock_shipments').where('restock_order_id', orderId).del();
     });
   }
   ```

### Email Notification Logic

1. **Backorder Notifications**
   ```javascript
   async function sendBackorderNotification(orderIds) {
     const orders = await getOrdersWithDetails(orderIds);
     const emailContent = generateBackorderEmailHTML(orders);
     
     const recipients = process.env.NODE_ENV === 'production' 
       ? ['development@opuzen.com', 'matt@opuzen.com']
       : ['development@opuzen.com'];
     
     await sendEmail({
       to: recipients,
       subject: 'Sampling Restock Alert: New items are on backorder',
       html: emailContent
     });
   }
   ```

---

## Implementation Plan

### Phase 1: Foundation (Dependencies)
1. **User Management System**
   - User authentication (JWT)
   - User CRUD operations
   - Role-based permissions
   - Authentication middleware

2. **Showroom Management**
   - Showroom CRUD operations
   - Destination reference data
   - User-destination permissions

### Phase 2: Core Restock API
1. **Database Schema**
   - Create restock tables
   - Set up foreign key relationships
   - Create indexes for performance

2. **Basic CRUD Operations**
   - Create orders
   - Read orders with filtering
   - Update order status
   - Delete/cancel orders

### Phase 3: Advanced Features
1. **Duplicate Detection**
   - Implement duplicate checking logic
   - Add user confirmation flow
   - Quantity merging functionality

2. **Shipment Management**
   - Record shipments
   - Update shipped quantities
   - Auto-completion logic

### Phase 4: Notifications & Analytics
1. **Email Notifications**
   - Backorder alerts
   - Status change notifications
   - Configurable recipients

2. **Analytics & Reporting**
   - Dashboard metrics
   - Export capabilities
   - Performance reports

---

## Security Considerations

### Authentication & Authorization
- JWT-based authentication for all endpoints
- Role-based access control (RBAC)
- Destination-specific permissions
- API rate limiting

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Secure password hashing

### Audit Trail
- Track all CRUD operations
- Log user actions with timestamps
- Maintain data integrity
- Change history tracking

---

## Testing Strategy

### Unit Tests
- Model methods testing
- Business logic validation
- Error handling verification
- Database transaction testing

### Integration Tests
- API endpoint testing
- Database integration
- Email notification testing
- Authentication flow testing

### End-to-End Tests
- Complete order lifecycle
- Duplicate detection flow
- Auto-completion scenarios
- Multi-user concurrent operations

### Performance Tests
- Load testing for high volume
- Concurrent user handling
- Database query optimization
- Response time benchmarks

---

## Monitoring & Maintenance

### Logging
- Structured logging with Winston
- Request/response logging
- Error tracking and alerting
- Performance monitoring

### Metrics
- Order processing times
- Shipment accuracy rates
- User activity metrics
- System health indicators

### Maintenance
- Regular database cleanup
- Cache management
- Security updates
- Performance optimization

---

## Conclusion

The Restock Service is a critical business component that requires careful design and implementation. This document provides a comprehensive roadmap for modernizing the legacy system while maintaining all existing functionality and adding improvements for scalability, security, and maintainability.

The key success factors are:
1. Proper foundation with user and showroom management
2. Robust duplicate detection and quantity management
3. Reliable auto-completion and notification systems
4. Comprehensive testing and monitoring
5. Scalable architecture for future growth

This implementation will provide a solid foundation for the Opuzen API's sample management capabilities. 