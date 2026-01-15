---
status: completed
priority: p2
issue_id: '529'
tags: [code-review, agent-ecosystem, security, rate-limiting]
dependencies: []
completed_date: 2026-01-01
resolved_by: [542, 543]
---

# No IP-Level Rate Limiting on Public Endpoints

## Problem Statement

Public chat endpoints (`/v1/public/chat/*`) lack IP-based rate limiting. Anonymous users could run up Claude API costs (denial of wallet attack).

## Resolution

**This TODO was resolved by the fixes for TODO 542 and 543.**

### Implementation Details

1. **Trust Proxy Configuration (TODO 542):** `app.set('trust proxy', 1)` was added to `server/src/app.ts` (line 39), enabling Express to correctly extract client IPs from the `X-Forwarded-For` header.

2. **IP-Based Rate Limiter (TODO 543 / This TODO):** A proper `express-rate-limit` middleware was added to `server/src/routes/public-customer-chat.routes.ts`:

```typescript
const publicChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window per IP
  message: { error: 'Too many requests. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

3. **Applied to All Routes:** The rate limiter is applied via `router.use(publicChatRateLimiter)` at line 57, protecting all public chat endpoints:
   - `GET /health`
   - `GET /greeting`
   - `POST /session`
   - `POST /message`
   - `POST /confirm/:proposalId`

### Security Properties

- **IP Extraction:** Uses `req.ip` which is correctly populated by trust proxy setting
- **Anti-Spoofing:** Takes rightmost IP minus trusted proxy count (prevents X-Forwarded-For spoofing)
- **Fallback:** Falls back to socket address if no proxy headers present

## Acceptance Criteria

- [x] IP-based rate limiting on public endpoints
- [x] Reasonable limits (50 per 15 min)
- [x] Clear error messages for rate-limited users
- [x] Tests pass

## Files Modified

- `/Users/mikeyoung/CODING/MAIS/server/src/app.ts` - Trust proxy configuration
- `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-customer-chat.routes.ts` - Rate limiter implementation
