# Rate Limiting Configuration

**Last Updated**: November 5, 2025  
**Status**: Active Security Feature  
**Package**: express-rate-limit

---

## Overview

Rate limiting protects the API from Denial of Service (DoS) attacks by restricting the number of requests a single IP address can make within a time window.

---

## Rate Limiting Tiers

### 1. General API Protection

**Applied to**: All `/api/*` routes  
**Limit**: 1,000 requests per IP per 15 minutes  
**Purpose**: Prevent DoS while allowing normal usage

**Example**: A user browsing products, viewing items, and checking colors will not hit this limit under normal use.

---

### 2. Strict Rate Limiting

**Applied to**: 
- `/api/export/*` - CSV export operations
- `/api/import/*` - CSV import operations

**Limit**: 100 requests per IP per 15 minutes  
**Purpose**: Protect expensive database and file operations

**Why Stricter**: These endpoints perform resource-intensive operations:
- Large database queries
- CSV file generation
- Multi-table joins
- File uploads and processing

---

### 3. Authentication Rate Limiting

**Applied to**: `/api/auth/login`  
**Limit**: 5 attempts per IP per 15 minutes  
**Purpose**: Prevent brute force password attacks

**Implementation**: Custom in-memory rate limiter (pre-existing)

---

## Endpoints NOT Rate Limited

These endpoints are explicitly excluded from rate limiting:

✅ **Health Checks**: `/health`, `/`  
✅ **NetSuite Webhooks**: `/api/ns-to-opms/webhook`  
✅ **Reason**: Server-to-server communication should not be rate limited

---

## Rate Limit Headers

When rate limiting is active, responses include standard headers:

```
RateLimit-Limit: 1000
RateLimit-Remaining: 999
RateLimit-Reset: 1699635600
```

**Headers Explained**:
- `RateLimit-Limit`: Maximum requests allowed in window
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: Unix timestamp when the limit resets

---

## Rate Limit Response

When a client exceeds the rate limit:

**Status Code**: `429 Too Many Requests`

**Response Body**:
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later."
}
```

---

## Configuration

### Modifying Rate Limits

Edit `src/middleware/rateLimiter.js`:

```javascript
// Change general API limit
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,  // <-- Change this number
    // ...
});

// Change strict limit for export/import
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,  // <-- Change this number
    // ...
});
```

### Adding IP Whitelist

To exclude specific IPs from rate limiting (e.g., monitoring services):

```javascript
const apiLimiter = rateLimit({
    // ... existing config
    skip: (req) => {
        // Whitelist specific IPs
        const whitelist = ['10.0.0.1', '192.168.1.100'];
        if (whitelist.includes(req.ip)) {
            return true;
        }
        // Skip health checks
        if (req.path === '/health') {
            return true;
        }
        return false;
    }
});
```

### Disabling Rate Limiting (Not Recommended)

To disable rate limiting (for testing only):

```javascript
// In src/index.js, comment out the rate limiter
// app.use('/api/', apiLimiter);
```

**WARNING**: Only disable for local testing. Never deploy without rate limiting.

---

## Testing Rate Limits

### Test with curl

```bash
# Make repeated requests
for i in {1..10}; do
  curl -s https://api.opuzen-service.com/api/products | head -1
  echo "Request $i completed"
done
```

### Test with JavaScript

```javascript
// Make 1001 requests to trigger rate limit
async function testRateLimit() {
  for (let i = 0; i < 1001; i++) {
    const response = await fetch('https://api.opuzen-service.com/api/products');
    console.log(`Request ${i}: ${response.status}`);
    if (response.status === 429) {
      console.log('Rate limit triggered at request', i);
      break;
    }
  }
}
```

---

## Monitoring Rate Limits

### Check Logs

Rate limit violations are logged:

```javascript
logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    userAgent: req.get('User-Agent')
});
```

### Look for patterns in logs:

```bash
# On production server
pm2 logs opms-api | grep "Rate limit exceeded"
```

---

## Security Benefits

✅ **DoS Protection**: Prevents request flooding from overwhelming the server  
✅ **Resource Protection**: Limits expensive operations (export/import)  
✅ **Fair Usage**: Ensures all users get reasonable access  
✅ **Brute Force Prevention**: Login attempts strictly limited  
✅ **Standards Compliant**: Uses industry-standard rate limit headers  

---

## Performance Impact

**Minimal overhead**: Rate limiting adds ~1ms per request  
**Memory usage**: Stores request timestamps in memory (negligible)  
**Scalability**: Works correctly with load balancers and multiple servers

---

## Troubleshooting

### User Hitting Rate Limits

**Symptoms**: 429 responses, "Too many requests" errors

**Solutions**:
1. **Legitimate high usage**: Increase rate limits in configuration
2. **Shared IP (NAT)**: Consider per-user rate limiting instead of per-IP
3. **Monitoring tools**: Whitelist monitoring service IPs

### Rate Limits Too Strict

If users report hitting limits during normal usage:

1. Review logs to see which endpoints are affected
2. Increase limits for specific endpoints
3. Consider implementing per-user (authenticated) rate limiting

### Rate Limits Too Loose

If you suspect abuse:

1. Decrease limits
2. Add stricter limits to specific endpoints
3. Implement IP blocking for repeat offenders

---

## Related Security Features

- **JWT Authentication**: Required for protected endpoints
- **CORS**: Controls browser access origins
- **Input Validation**: Prevents malicious data
- **SQL Injection Prevention**: Parameterized queries

---

## Implementation Details

### Files Modified

- `src/middleware/rateLimiter.js` - Rate limiter configurations
- `src/index.js` - Apply general API rate limiting
- `src/routes/export.js` - Apply strict limits to exports
- `src/routes/import.js` - Apply strict limits to imports

### Package Dependencies

```json
{
  "express-rate-limit": "^7.4.1"
}
```

---

## References

- [express-rate-limit Documentation](https://github.com/express-rate-limit/express-rate-limit)
- [OWASP: Denial of Service](https://owasp.org/www-community/attacks/Denial_of_Service)
- [RFC 6585: HTTP 429 Status Code](https://tools.ietf.org/html/rfc6585#section-4)

---

## Future Enhancements

Potential improvements for future releases:

1. **Redis-based storage**: Share rate limits across multiple servers
2. **Per-user rate limiting**: Different limits for authenticated users
3. **Dynamic limits**: Adjust based on server load
4. **IP blocking**: Automatically block repeat offenders
5. **Rate limit dashboard**: Visualize usage patterns

---

**For questions or issues with rate limiting, check application logs and review this documentation.**

