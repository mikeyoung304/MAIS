---
status: complete
priority: p1
issue_id: '543'
tags: [code-review, security, rate-limiting, ip-spoofing]
dependencies: ['542']
completed_date: '2026-01-01'
---

# Rate Limit Bypass via IP Spoofing

## Problem Statement

Rate limiter extracts the **leftmost** IP from `X-Forwarded-For` chain. Attackers can inject spoofed IPs by sending custom headers, bypassing rate limits entirely.

## Findings

**Security Sentinel:**

> "Attackers can inject spoofed IPs by sending custom headers. Rate limiter uses 1.2.3.4 (spoofed) instead of attacker's real IP."

**Attack Vector:**

```http
POST /v1/public/chat/message
X-Forwarded-For: 1.2.3.4, 5.6.7.8
X-Tenant-Key: pk_live_...

# If proxy appends real IP:
# Final header: X-Forwarded-For: 1.2.3.4, 5.6.7.8, <attacker-real-ip>
# Rate limiter uses 1.2.3.4 (spoofed)
```

**Impact:**

- Attacker can rotate spoofed IPs to bypass rate limit
- Distributed attack from single origin appears as multiple clients
- No defense against IP rotation abuse

## Proposed Solutions

### Option A: Use rightmost IP (Recommended)

Change keyGenerator to use rightmost IP (closest to our server, harder to spoof).

```typescript
keyGenerator: (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    return ips[ips.length - 1] || 'unknown'; // Rightmost = real IP
  }
  return req.ip || 'unknown';
};
```

**Pros:** More secure, harder to spoof
**Cons:** Requires trust proxy to be set first
**Effort:** Small (10 min)
**Risk:** Low

### Option B: Remove custom keyGenerator entirely

Let express-rate-limit use its built-in IP extraction with trust proxy.

```typescript
const publicChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  // No custom keyGenerator - uses req.ip with trust proxy
});
```

**Pros:** Simplest, uses battle-tested library code
**Cons:** Less control over edge cases
**Effort:** Small (5 min)
**Risk:** Low

## Recommended Action

Option B - Remove custom keyGenerator after adding trust proxy (#542)

## Technical Details

**Affected Files:**

- `server/src/routes/public-customer-chat.routes.ts:37-44` - keyGenerator function

**Dependency:** Must complete #542 (trust proxy) first

## Acceptance Criteria

- [x] Custom keyGenerator removed or uses rightmost IP
- [x] Verified IP spoofing attack blocked
- [x] Rate limiter logs show real client IPs

## Work Log

| Date       | Action                       | Learnings                                                         |
| ---------- | ---------------------------- | ----------------------------------------------------------------- |
| 2026-01-01 | Created from code review     | Leftmost IP in XFF is spoofable                                   |
| 2026-01-01 | Verified already implemented | Custom keyGenerator removed, uses default req.ip with trust proxy |

## Resources

- [OWASP X-Forwarded-For bypass](https://owasp.org/www-community/attacks/IP_Address_Spoofing)
