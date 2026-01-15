---
problem_type: best-practices
component: express, rate-limiting, code-review
severity: P1
tags: [trust-proxy, ip-spoofing, triage, code-review, vercel, cloudflare, x-forwarded-for]
root_cause: Express trust proxy not configured; custom IP extraction used spoofable leftmost header
solution: Add trust proxy setting; delete custom keyGenerator; use library defaults
created: 2026-01-01
project: MAIS
related_issues: ['#542', '#543', '#546']
---

# Express Trust Proxy and Rate Limiting Behind Reverse Proxies

## Problem Statement

Rate limiting was completely ineffective in production because:

1. Express `trust proxy` was not configured
2. Custom IP extraction used **leftmost** IP from `X-Forwarded-For` (spoofable)

Behind Vercel/Cloudflare, all requests appeared to come from the proxy IP, making per-client rate limiting useless.

## Root Cause Analysis

### Issue 1: Missing Trust Proxy

Express doesn't parse `X-Forwarded-For` headers by default. Without `trust proxy`, `req.ip` returns the proxy's IP, not the client's.

```typescript
// WITHOUT trust proxy:
req.ip; // → "10.0.0.1" (Vercel's internal IP)
req.headers['x-forwarded-for']; // → "203.0.113.50, 10.0.0.1"

// WITH trust proxy:
req.ip; // → "203.0.113.50" (actual client IP)
```

### Issue 2: Leftmost IP is Spoofable

The custom keyGenerator used the **leftmost** IP from the header chain:

```typescript
// VULNERABLE CODE:
keyGenerator: (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim(); // ← LEFTMOST = spoofable!
  }
  return req.ip || 'unknown';
};
```

**Attack vector:**

```http
POST /v1/public/chat/message
X-Forwarded-For: 1.2.3.4, 5.6.7.8
# Proxy appends real IP: X-Forwarded-For: 1.2.3.4, 5.6.7.8, <attacker-real-ip>
# Rate limiter uses 1.2.3.4 (fake) instead of attacker's real IP
```

## Working Solution

### Fix 1: Add Trust Proxy (1 line)

```typescript
// server/src/app.ts - BEFORE middleware registration
const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel, Cloudflare, AWS ALB)
```

### Fix 2: Delete Custom IP Extraction

```typescript
// server/src/routes/public-customer-chat.routes.ts
// DELETE the entire keyGenerator - let express-rate-limit use req.ip
const publicChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  // NO keyGenerator - library handles it correctly with trust proxy
});
```

**Result:** -8 lines of vulnerable code, +1 line of correct configuration.

## Three-Reviewer Triage Pattern

This session used three specialized reviewers in parallel to triage 9 findings:

| Reviewer       | Focus                      | Criteria                                              |
| -------------- | -------------------------- | ----------------------------------------------------- |
| **DHH**        | Simplicity, shipping       | "Is this solving a real problem or an imaginary one?" |
| **Kieran**     | TypeScript, best practices | "Is this type-safe and idiomatic?"                    |
| **Simplicity** | YAGNI, deletion            | "Can we delete code instead of adding it?"            |

### Consensus Decision Matrix

| Consensus        | Action                       |
| ---------------- | ---------------------------- |
| All 3 say "FIX"  | ✅ Do immediately            |
| All 3 say "SKIP" | ❌ Don't do it               |
| Mixed opinions   | ⏸️ Defer for production data |

### Triage Results

| Finding                  | DHH    | Kieran   | Simplicity | Decision       |
| ------------------------ | ------ | -------- | ---------- | -------------- |
| Trust proxy missing      | FIX    | FIX (P0) | FIX        | ✅ **DO NOW**  |
| IP spoofing bypass       | DELETE | FIX      | DELETE     | ✅ **DO NOW**  |
| DRY violation (patterns) | FIX    | FIX      | FIX        | ✅ **DO SOON** |
| Circuit breaker cleanup  | SKIP   | Document | SKIP       | ❌ DEFER       |
| T2 rejection patterns    | SKIP   | Cautious | Measure    | ⏸️ DEFER       |
| Error message constants  | SKIP   | P3       | SKIP       | ❌ SKIP        |
| Type cast ceremony       | SKIP   | Guard    | SKIP       | ❌ SKIP        |

### Key Quotes

> **DHH:** "The current leftmost IP logic is literally backwards - attackers can trivially spoof it."

> **Kieran:** "#542 should be P0. This is production Vercel deployment. Rate limiting is completely ineffective right now."

> **Simplicity:** "Net result: -16 lines of code, +5 comments, 0 new features. That's ruthless simplification."

## Prevention Checklists

### Express Deployment Checklist

- [ ] `app.set('trust proxy', 1)` configured for production
- [ ] Rate limiting uses `req.ip` (not custom header parsing)
- [ ] No custom `keyGenerator` unless absolutely necessary
- [ ] Verified rate limits work behind CDN/reverse proxy
- [ ] Test with spoofed X-Forwarded-For headers

### Code Review Triage Checklist

- [ ] Is this a **real production problem**? (or theoretical)
- [ ] Does the fix **DELETE code**? (prefer deletion over addition)
- [ ] Do **3 reviewers agree**? (consensus = action)
- [ ] Is there **production data** supporting the need?
- [ ] Is this **YAGNI**? (You Ain't Gonna Need It)

### Security Pattern Checklist

- [ ] Single source of truth for security patterns (no duplication)
- [ ] Public-facing endpoints have **strongest** protection
- [ ] No custom IP/header extraction logic (use library defaults)
- [ ] Security fixes reviewed by multiple perspectives

## Red Flags in Code Review

```typescript
// RED FLAG: Custom IP extraction
req.headers['x-forwarded-for'].split(',')[0]; // Leftmost = spoofable!

// RED FLAG: Missing trust proxy
const app = express(); // No trust proxy = broken behind CDN

// RED FLAG: Duplicated security patterns
// File A: 21 patterns
// File B: 8 patterns (subset) ← Weaker protection!

// RED FLAG: Over-engineering without data
if (turnCount === 0) {
  cleanup();
} // Does this ever happen?
```

## File References

- `server/src/app.ts` - Add trust proxy setting
- `server/src/routes/public-customer-chat.routes.ts:31-44` - Delete keyGenerator
- `server/src/agent/orchestrator/customer-chat-orchestrator.ts:63-74` - Import patterns

## Cross-References

- [Express trust proxy docs](https://expressjs.com/en/guide/behind-proxies.html)
- [OWASP IP Spoofing](https://owasp.org/www-community/attacks/IP_Address_Spoofing)
- [Per-Session State Isolation](/docs/solutions/patterns/per-session-state-isolation-agent-guardrails-MAIS-20260101.md)
- [Required Security Fields](/docs/solutions/security-issues/required-security-fields-agent-tools-MAIS-20260101.md)
