# Content Security Policy (CSP) Configuration

**Last Updated**: November 5, 2025  
**Status**: Active Security Feature  
**Package**: helmet

---

## Overview

Content Security Policy (CSP) is a security header that helps prevent Cross-Site Scripting (XSS), clickjacking, and other code injection attacks by controlling what resources the browser can load.

---

## Current CSP Configuration

### Enabled Directives

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
```

---

## Directive Explanations

### `defaultSrc: ["'self'"]`
**Purpose**: Default policy for all resource types  
**Effect**: Only load resources from the same origin  
**Protects**: Against loading malicious external resources

### `scriptSrc: ["'self'", "'unsafe-inline'"]`
**Purpose**: Control where JavaScript can be loaded from  
**Effect**: 
- ✅ Allow scripts from same origin
- ✅ Allow inline `<script>` tags (required for dashboard)
- ❌ Block external scripts from other domains

**Why 'unsafe-inline'**: The sync dashboard (`sync-dashboard.html`) uses inline scripts for functionality. This is a controlled trade-off for dashboard usability.

### `styleSrc: ["'self'", "'unsafe-inline'"]`
**Purpose**: Control where CSS can be loaded from  
**Effect**:
- ✅ Allow CSS from same origin
- ✅ Allow inline `<style>` tags (required for dashboard)
- ❌ Block external stylesheets

### `imgSrc: ["'self'", 'data:', 'https:']`
**Purpose**: Control where images can be loaded from  
**Effect**:
- ✅ Same origin images
- ✅ Data URIs (base64 embedded images)
- ✅ HTTPS images from any domain

### `connectSrc: ["'self'"]`
**Purpose**: Control where AJAX/fetch requests can be made  
**Effect**: Only allow API calls to same origin  
**Protects**: Against data exfiltration to attacker servers

### `fontSrc: ["'self'", 'data:']`
**Purpose**: Control where fonts can be loaded from  
**Effect**: Same origin or embedded fonts only

### `objectSrc: ["'none'"]`
**Purpose**: Control `<object>`, `<embed>`, `<applet>` tags  
**Effect**: Completely block these elements  
**Protects**: Against plugin-based attacks

### `baseUri: ["'self'"]`
**Purpose**: Restrict `<base>` tag URLs  
**Effect**: Prevent attackers from changing base URL  
**Protects**: Against relative URL manipulation

### `formAction: ["'self'"]`
**Purpose**: Control where forms can submit to  
**Effect**: Forms can only submit to same origin  
**Protects**: Against phishing via form hijacking

### `frameAncestors: ["'none'"]`
**Purpose**: Control if page can be embedded in frames  
**Effect**: Prevent page from being in `<iframe>`, `<frame>`, etc.  
**Protects**: Against clickjacking attacks

---

## Security Benefits

✅ **XSS Mitigation**: Blocks external scripts, limits attack surface  
✅ **Clickjacking Prevention**: Cannot be embedded in malicious frames  
✅ **Data Exfiltration Prevention**: AJAX calls limited to same origin  
✅ **Form Hijacking Prevention**: Forms can only submit to API  
✅ **Plugin Attack Prevention**: Object/embed tags blocked  

---

## Limitations

⚠️ **'unsafe-inline' for Scripts**: Required for dashboard functionality

**Why this is acceptable**:
- Dashboard is trusted, server-side code
- Scripts are not user-generated
- Combined with other security measures (CORS, authentication, rate limiting)
- Alternative would require HTML refactoring

**Future Enhancement**: Migrate to nonce-based CSP for stronger protection.

---

## Testing CSP

### View CSP Headers

```bash
curl -I https://api.opuzen-service.com/api/products | grep -i "content-security-policy"
```

**Expected Output**:
```
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ...
```

### Browser Console

Open browser DevTools Console and check for CSP violations:

```
Content Security Policy: The page's settings blocked the loading of a resource...
```

If you see this, a resource is being blocked by CSP (this is good - it means CSP is working).

---

## Common CSP Violations & Fixes

### Violation: External Script Blocked

```
Refused to load script from 'https://external-site.com/script.js' because it violates CSP
```

**Fix**: Add the domain to scriptSrc:
```javascript
scriptSrc: ["'self'", "'unsafe-inline'", 'https://external-site.com']
```

### Violation: External Font Blocked

```
Refused to load font from 'https://fonts.googleapis.com' because it violates CSP
```

**Fix**: Add the font source:
```javascript
fontSrc: ["'self'", 'data:', 'https://fonts.googleapis.com']
```

### Violation: Image Blocked

```
Refused to load image from 'https://cdn.example.com' because it violates CSP
```

**Fix**: Already allowed - `imgSrc` allows all HTTPS images

---

## Upgrading to Nonce-based CSP (Future)

For stronger security, migrate to nonce-based CSP:

### Step 1: Generate Nonces

```javascript
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
```

### Step 2: Update CSP

```javascript
scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`]
```

### Step 3: Update HTML

```html
<script nonce="<%= nonce %>">
  // Dashboard code
</script>
```

This requires converting HTML to templates (EJS, Handlebars, etc.).

---

## Production Configuration

CSP is enabled in all environments:
- ✅ Production
- ✅ QA
- ✅ Development
- ✅ Test

No environment-specific configuration needed.

---

## Monitoring CSP Violations

### Report-Only Mode (Optional)

To test CSP without blocking, use report-only mode:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    reportOnly: true,  // Don't block, just report
    directives: { /* ... */ }
  }
}));
```

### CSP Violation Reporting (Future)

Configure violation reporting to track CSP issues:

```javascript
reportUri: ['/api/csp-violation-report']
```

Then create an endpoint to log violations.

---

## Security Headers Provided by Helmet

In addition to CSP, helmet also provides:

✅ **X-DNS-Prefetch-Control**: Controls DNS prefetching  
✅ **X-Frame-Options**: Clickjacking protection (redundant with frameAncestors)  
✅ **X-Content-Type-Options**: Prevent MIME sniffing  
✅ **X-Download-Options**: Prevent file download attacks  
✅ **X-Permitted-Cross-Domain-Policies**: Control cross-domain policy files  

---

## Related Security Features

- **CORS**: Controls which origins can access the API
- **Rate Limiting**: Prevents DoS attacks
- **JWT Authentication**: Secures API access
- **Input Validation**: Prevents injection attacks

---

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [OWASP: Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

---

## Support

For CSP-related issues:
1. Check browser console for CSP violation messages
2. Review this documentation for common fixes
3. Test in report-only mode before enforcing
4. Gradually tighten CSP directives over time

**Remember**: CSP is defense-in-depth. It works best in combination with other security measures.

