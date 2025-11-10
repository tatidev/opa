# User Management System - Quick Start Guide

## Overview

The User Management System has been successfully implemented and is ready for use. This guide will help you get started quickly.

## ✅ What's Completed

### 1. Database Schema
- ✅ `api_users` table with security features
- ✅ `api_roles` table with role management
- ✅ `api_showrooms` table for location management
- ✅ `api_user_roles` and `api_user_showrooms` junction tables
- ✅ All tables with proper indexes and foreign keys

### 2. Security Features
- ✅ Bcrypt password hashing (12 salt rounds)
- ✅ JWT token authentication (24h access + 7d refresh)
- ✅ Account locking (5 failed attempts = 15 min lockout)
- ✅ Email verification tokens
- ✅ Password reset tokens
- ✅ Rate limiting for auth endpoints

### 3. API Endpoints
- ✅ **Authentication**: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`
- ✅ **User Management**: Full CRUD operations at `/api/users`
- ✅ **Showroom Management**: Full CRUD operations at `/api/showrooms`
- ✅ **Role-based Authorization**: Admin, Manager, User, Showroom, ReadOnly roles

### 4. Documentation & Testing
- ✅ **Comprehensive Swagger Documentation**: Available at `/api-docs`
- ✅ **Full Test Suite**: Authentication and user management tests
- ✅ **Detailed Documentation**: See `userManagementSystem.md`

## 🚀 Getting Started

### Step 1: Run Database Migrations
```bash
# Ensure your database is running
npm run db:migrate

# Seed default roles
node scripts/seed-roles.js
```

### Step 2: Test the API
```bash
# Run tests
npm test

# Or run specific test suites
npm test -- --testNamePattern="Authentication"
npm test -- --testNamePattern="User Management"
```

### Step 3: Access Swagger Documentation
1. Start your server: `npm run dev`
2. Open browser: `http://localhost:3000/api-docs`
3. Test all endpoints directly in Swagger UI

## 🔐 Quick API Examples

### 1. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin",
    "password": "your_password"
  }'
```

### 2. Create User (Admin only)
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "securepass123",
    "first_name": "John",
    "last_name": "Doe",
    "roles": [2]
  }'
```

### 3. Get User Profile
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🔧 Configuration

### Environment Variables
Add these to your `.env` file:
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration (if not already set)
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=opuzen_api_master_app
```

## 👥 Default Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **admin** | System Administrator | Full access to all features |
| **manager** | Manager | User management, most operations |
| **user** | Regular User | Standard feature access |
| **showroom** | Showroom User | Showroom-specific features |
| **readonly** | Read Only | View access only |

## 🛡️ Security Features

### Password Security
- Minimum 8 characters
- Must contain letters and numbers
- Bcrypt hashing with 12 salt rounds

### Account Protection
- Account locking after 5 failed attempts
- 15-minute lockout period
- Email verification system
- Password reset tokens with 1-hour expiry

### Token Security
- JWT tokens with proper expiration
- Refresh token rotation
- IP-based rate limiting
- Secure token verification

## 📊 API Response Format

All APIs return consistent JSON responses:

```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Files
```bash
npm test src/__tests__/auth.test.js
npm test src/__tests__/users.test.js
```

### Test Coverage
```bash
npm run test:coverage
```

## 📚 Additional Resources

- **Full Documentation**: `DOCS/userAuth/userManagementSystem.md`
- **API Documentation**: `http://localhost:3000/api-docs` (when server is running)
- **Test Files**: `src/__tests__/auth.test.js`, `src/__tests__/users.test.js`

## 🚨 Important Notes

1. **Change JWT Secret**: Use a strong, unique JWT secret in production
2. **HTTPS Only**: Always use HTTPS in production
3. **Rate Limiting**: Configure appropriate rate limits for your use case
4. **Database Backup**: Regular backups of user data
5. **Security Updates**: Keep dependencies updated

## 🔧 Troubleshooting

### Common Issues

1. **Migration Errors**: Ensure database is running and accessible
2. **Token Errors**: Check JWT secret configuration
3. **Permission Errors**: Verify user roles are assigned correctly
4. **Login Issues**: Check account status and password

### Debug Commands
```bash
# Check database connection
npm run db:verify

# Check existing tables
node -e "require('./src/db').query('SHOW TABLES LIKE \"api_%\"').then(([rows]) => rows.forEach(r => console.log(Object.values(r)[0])))"

# Test JWT token generation
node -e "const jwt = require('./src/utils/jwt'); console.log(jwt.generateTokenPair({id: 1, username: 'test'}))"
```

## ✅ System Status

The User Management System is **PRODUCTION READY** with:
- ✅ Complete authentication flow
- ✅ Role-based authorization
- ✅ Security best practices
- ✅ Comprehensive testing
- ✅ Full documentation
- ✅ Swagger API docs

You can now integrate this system with your existing Opuzen API endpoints and start managing users securely! 