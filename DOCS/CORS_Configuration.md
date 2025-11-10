# CORS Configuration Guide

**Last Updated**: November 5, 2025  
**Status**: Required Security Configuration

---

## Overview

Cross-Origin Resource Sharing (CORS) controls which domains can access the API from web browsers. This is a critical security feature that prevents unauthorized websites from making requests to your API.

---

## Required Environment Variable

### `CORS_ORIGIN`

**Required**: YES  
**Type**: String (URL)  
**Purpose**: Specifies the allowed origin for browser-based API requests

**Format**: Full URL including protocol (http/https)

---

## Configuration by Environment

### Production
```bash
CORS_ORIGIN=https://api.opuzen-service.com
```

### QA
```bash
CORS_ORIGIN=https://api-qa.opuzen-service.com
```

### Development
```bash
CORS_ORIGIN=https://api-dev.opuzen-service.com
```

### Local Development
```bash
CORS_ORIGIN=http://localhost:3000
```

---

## Security Behavior

### ✅ What Happens When CORS_ORIGIN is Set

- Application starts normally
- Only the specified origin can access the API from browsers
- Web dashboards and frontend apps work correctly
- Unauthorized domains are blocked

### ❌ What Happens When CORS_ORIGIN is Missing

**The application will NOT start.**

You'll see this error:
```
CRITICAL SECURITY ERROR: CORS_ORIGIN environment variable is not set. 
Application cannot start without explicit CORS configuration.
```

**This is intentional** - it prevents the application from running with insecure default settings.

---

## What CORS Does NOT Affect

CORS only applies to **browser-based requests**. The following are NOT affected:

✅ **Server-to-Server Communication**
- NetSuite webhooks to this API
- This API calling NetSuite RESTlets
- Database connections
- Internal service communication

✅ **Direct API Calls**
- Postman requests
- curl commands
- Server-side scripts
- Automated processes

✅ **Backend Integrations**
- Sync services
- Scheduled jobs
- Background workers

---

## Common Use Cases

### 1. Web Dashboard Access

**Scenario**: Users access the sync dashboard at `https://api.opuzen-service.com/api/sync-dashboard/`

**Configuration**:
```bash
CORS_ORIGIN=https://api.opuzen-service.com
```

**Result**: The dashboard can make API calls to load data and display statistics.

---

### 2. Frontend Application

**Scenario**: A separate frontend app needs to call this API

**Configuration**: Set CORS_ORIGIN to the frontend's domain
```bash
CORS_ORIGIN=https://app.opuzen.com
```

**Result**: The frontend can make authenticated API requests.

---

### 3. Multiple Origins (Advanced)

If you need to allow multiple origins, you can use a comma-separated list or modify the CORS configuration in `src/index.js`.

**Current Implementation** (single origin):
```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

**For Multiple Origins** (requires code change):
```javascript
const allowedOrigins = process.env.CORS_ORIGIN.split(',');

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

Then set:
```bash
CORS_ORIGIN=https://app1.opuzen.com,https://app2.opuzen.com
```

---

## Troubleshooting

### Error: "Application cannot start without explicit CORS configuration"

**Cause**: `CORS_ORIGIN` environment variable is not set

**Solution**:
1. Check your `.env` file
2. Add `CORS_ORIGIN=https://your-domain.com`
3. Restart the application

---

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause**: Browser is trying to access the API from a different origin than configured

**Solution**:
1. Check browser console for the actual origin making the request
2. Update `CORS_ORIGIN` to match that origin
3. Example: If request is from `https://example.com`, set:
   ```bash
   CORS_ORIGIN=https://example.com
   ```

---

### NetSuite Webhooks Not Working

**This is NOT a CORS issue.**

NetSuite webhooks are server-to-server and not affected by CORS. Check:
- Webhook authentication
- Network connectivity
- Firewall rules
- Application logs

---

## Testing CORS Configuration

### Test from Browser Console

```javascript
// Open browser console at your CORS_ORIGIN domain
fetch('https://api.opuzen-service.com/health')
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('CORS Error:', error));
```

**Expected Result**: Should succeed when run from the configured CORS_ORIGIN

---

### Test from Different Domain

```javascript
// Open browser console at a DIFFERENT domain
fetch('https://api.opuzen-service.com/health')
  .then(response => response.json())
  .then(data => console.log('Should not reach here'))
  .catch(error => console.error('Blocked by CORS (expected):', error));
```

**Expected Result**: Should fail with CORS error

---

## Security Benefits

✅ **Prevents Cross-Site Request Forgery (CSRF)**: Unauthorized sites cannot make API requests  
✅ **Protects User Data**: Only trusted domains can access the API  
✅ **Fail-Secure Design**: Application won't start with missing configuration  
✅ **Explicit Configuration**: No default fallback values that could be insecure  

---

## Related Security Settings

### JWT Authentication
- See `src/utils/jwt.js` for JWT configuration
- `JWT_SECRET` must also be configured

### Helmet Security Headers
- See `src/index.js` for Content Security Policy settings
- CSP is currently disabled for dashboard inline scripts

### Rate Limiting
- Authentication endpoints have rate limiting
- Global rate limiting may be added in future updates

---

## Deployment Checklist

Before deploying to any environment:

- [ ] `CORS_ORIGIN` is set in environment variables
- [ ] CORS_ORIGIN matches the actual domain users will access
- [ ] Test web dashboard access after deployment
- [ ] Verify NetSuite webhooks still work (they should - not affected by CORS)
- [ ] Check application logs for CORS errors

---

## References

- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
- OPMS API Security Audit: `DOCS/ai-specs/security/SECURITY-FIX-LOG.md`

---

## Support

If you encounter CORS-related issues:

1. Check application logs for CORS errors
2. Verify `CORS_ORIGIN` environment variable is set correctly
3. Test from browser console to isolate the issue
4. Review this documentation for common solutions

**Remember**: CORS only affects browser requests. Server-to-server communication (like NetSuite integrations) is never blocked by CORS.

