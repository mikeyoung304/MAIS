# P3: Add CAPTCHA for Production

## Priority: P3 Nice-to-have
## Status: ready
## Feature: DATE Booking Flow
## Category: Security

## Issue

No CAPTCHA protection to prevent automated booking attacks.

**File:** `packages/contracts/src/dto.ts`

## Recommendation

Add optional CAPTCHA token field:

```typescript
// In CreateDateBookingDtoSchema
captchaToken: z.string().min(1).optional(), // Required in production
```

Backend validation:

```typescript
// In route handler
if (process.env.NODE_ENV === 'production' && !input.captchaToken) {
  throw new ValidationError('CAPTCHA token required');
}

if (input.captchaToken) {
  const isValid = await verifyCaptcha(input.captchaToken);
  if (!isValid) {
    throw new ValidationError('Invalid CAPTCHA');
  }
}
```

## Options

1. **reCAPTCHA v3** - Invisible, score-based (recommended)
2. **hCaptcha** - Privacy-focused alternative
3. **Turnstile** - Cloudflare's privacy-preserving option



## Work Log

### 2025-12-21 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (bulk approval)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Review Reference
- Security Review Finding P3-002 (Add CAPTCHA)
