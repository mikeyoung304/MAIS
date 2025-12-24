---
title: 'Prevention Checklist: Email Features & External Service Integration'
description: 'Quick checklist to prevent early-access-style production issues'
severity: p1
related_incident: 'INCIDENT-2025-12-06-early-access-production-blocking'
date_created: 2025-12-06
---

# Prevention Checklist: Email Features & External Service Integration

**Use this checklist before deploying any feature that:**

- Sends emails
- Accepts user input that goes into HTML/email templates
- Uses external services (Postmark, Stripe, Google Calendar, etc.)
- Creates database records from user input

---

## Phase 1: Design & Planning

### Security Review

- [ ] **Input Sanitization:** Document all user inputs that touch email/HTML templates
  - Where will they be sanitized? (route, service, adapter?)
  - Using what library? (DOMPurify, sanitize-html, custom?)
  - Test with attack vectors: `<script>`, `\r\n`, SQL injection attempts

- [ ] **Email Header Injection:** Are we accepting any email fields from users?
  - Check for `\r\n` (CRLF) in validation
  - Use Zod `.email()` or equivalent strict validation
  - Add explicit `.refine()` check for line breaks

- [ ] **Cross-Service Data Flow:** How does user input flow to external services?
  - Postmark email content?
  - Stripe metadata?
  - Google Calendar events?
  - Document transformation at each step

### API Contract Review

- [ ] **ts-rest contract defined first** (before implementation)
- [ ] **Zod validation schema** includes:
  - Type checks (email, URL, etc.)
  - Length bounds
  - Regex patterns (no special characters if needed)
  - Custom refinements for security (.refine() calls)
- [ ] **Error responses defined** for validation failures
- [ ] **Rate limiting specified** in contract documentation

### Database Design

- [ ] **Model created** for data persistence (don't skip "nice to have" logging)
- [ ] **Indexes** on query columns (status, date, email, tenant)
- [ ] **Unique constraints** where appropriate (prevent duplicates)
- [ ] **Soft deletes** if future deletion needed
- [ ] **Migration tested** locally: `npm exec prisma migrate dev`

### Error Handling & UX

- [ ] **Client-side error display** with accessibility (`role="alert"`)
- [ ] **User-friendly error messages** (not technical details)
- [ ] **Duplicate handling** strategy documented (reject? upsert? warn?)
- [ ] **Fallback UI** if external service unavailable

---

## Phase 2: Implementation

### Security Implementation

- [ ] **Sanitization applied** to all HTML/email template injections

  ```typescript
  import { sanitizePlainText } from '../lib/security';
  const safe = sanitizePlainText(userInput);
  ```

- [ ] **Zod validation** in ts-rest contract (not just in route handler)

  ```typescript
  export const joinEarlyAccess = {
    body: z.object({
      email: z
        .string()
        .email()
        .refine((e) => !e.match(/[\r\n]/), 'No line breaks'),
    }),
  };
  ```

- [ ] **Database queries scoped** by tenant (multi-tenant isolation)

  ```typescript
  where: { tenantId, email: normalizedEmail }
  ```

- [ ] **Logs sanitized** (no raw user input)
  ```typescript
  logger.info(`Submission: ${sanitizePlainText(email)}`);
  ```

### Type Safety

- [ ] **TypeScript strict mode** all checks passing
- [ ] **No `any` types** (except library limitations documented in PREVENTS.md)
- [ ] **All async functions** awaited (check for `Promise` type in variable)
- [ ] **Type unions complete** (e.g., upload bucket types include all values)

### Testing Strategy

- [ ] **Unit tests:** Service logic with mock repositories
- [ ] **Integration tests:** Database-backed, full flow
  ```typescript
  test('should sanitize XSS in email', async () => {
    const result = await earlyAccessService.submit({
      email: 'test+<script>alert("xss")</script>@example.com',
    });
    // Should reject or sanitize
  });
  ```
- [ ] **Edge cases tested:**
  - Duplicate submissions
  - Invalid email formats
  - CRLF injection attempts
  - Rate limit boundary conditions
- [ ] **Coverage target:** 70% minimum (email features should be 80%+)

---

## Phase 3: Deployment Preparation

### Environment Configuration

- [ ] **All external service tokens** documented and set
  - [ ] POSTMARK_SERVER_TOKEN (email)
  - [ ] STRIPE_SECRET_KEY (payments)
  - [ ] GOOGLE_CALENDAR_ID (calendar)
  - [ ] Any custom service tokens

- [ ] **Sender domain verified** in external service
  - For Postmark: Verify `noreply@maconheadshots.com` domain in account
  - For Stripe: Verify webhook secret generated
  - For Google Calendar: OAuth token refreshed

- [ ] **Fallback modes tested**
  - Mock mode: Works without external services
  - Real mode: All credentials valid

### Code Review Checklist (for reviewers)

- [ ] **Security questions:**
  - Is all user input sanitized before HTML/email?
  - Are email headers protected against CRLF injection?
  - Are database queries tenant-scoped?
  - Are logs sanitized?

- [ ] **Type safety:**
  - Does TypeScript build pass without errors?
  - Are all async functions awaited?
  - Are type unions complete?

- [ ] **Testing:**
  - Do integration tests cover happy path + error cases?
  - Are edge cases (duplicates, invalid input) tested?
  - Does coverage meet 70% threshold?

- [ ] **Configuration:**
  - Are environment variables documented?
  - Does deployment guide exist?
  - Are fallback modes clear?

### Pre-Deployment Verification

Run this checklist **before** pushing to production:

```bash
# 1. TypeScript compilation
npm run typecheck  # No errors

# 2. Run all tests
npm test           # All passing
npm run test:e2e   # E2E passing

# 3. Verify environment
export POSTMARK_SERVER_TOKEN="actual-token"
export POSTMARK_FROM_EMAIL="noreply@maconheadshots.com"

# 4. Test email delivery (local)
npm run dev:api
# Try submitting early access form at http://localhost:5173

# 5. Database migration
cd server
npm exec prisma migrate deploy  # No errors

# 6. Check logs
tail -100 logs/app.log  # No injection attempts visible
```

---

## Phase 4: Production Monitoring

### Post-Deployment Checks (First 24 Hours)

- [ ] **Email delivery working**
  - Check Postmark dashboard: "Bounces" = 0
  - Check admin inbox: Early access notifications arriving
  - Check logs: No Postmark API errors

- [ ] **Database records created**

  ```bash
  npm exec prisma studio
  # Navigate to EarlyAccessRequest table
  # Verify submissions visible
  ```

- [ ] **Error handling working**
  - Submit duplicate email: Should see user-friendly error
  - Submit invalid email: Should see validation error
  - Check error logs: No raw exceptions leaking to client

- [ ] **Security holding**
  - Submit XSS attempt: Should be sanitized or rejected
  - Submit CRLF injection: Should be rejected
  - Check logs: No injection patterns visible

### Ongoing Monitoring

- [ ] **Weekly:** Review early access submissions
  - Anomalies in email patterns?
  - Injection attempts visible in logs?
  - Conversion rate healthy?

- [ ] **Monthly:** Audit email logs
  - Any bounces? (Update allowlist if needed)
  - Any failed deliveries?
  - Postmark API usage within limits?

- [ ] **Per-deployment:** Update CHANGELOG with feature status

---

## Quick Reference: Common Pitfalls

| Pitfall                         | Prevention                   | Check                                   |
| ------------------------------- | ---------------------------- | --------------------------------------- |
| XSS in email                    | Use `sanitizePlainText()`    | Search codebase for `html: \`...\${}`   |
| CRLF injection                  | Add `.refine()` check in Zod | Look for email validation in contracts  |
| Missing type                    | Use strict TypeScript        | Run `npm run typecheck`                 |
| Async function not awaited      | Use `await` keyword          | Search for `Promise<` in variable types |
| No database record              | Add Prisma model + migration | Check schema.prisma + test coverage     |
| No error UI                     | Add `role="alert"` div       | Check client components for error state |
| Env vars not set                | Document required vars       | Create .env.example with all secrets    |
| External service fails silently | Add integration tests        | Mock + real mode both tested            |

---

## When This Checklist Applies

✅ **Use this checklist if:**

- Feature sends emails (Postmark, SendGrid, etc.)
- Feature accepts user input that goes into templates
- Feature uses external APIs (Stripe, Google, etc.)
- Feature creates database records from user input
- Feature has multi-tenant data isolation concerns

❌ **Don't need this if:**

- Feature is pure read-only UI
- Feature only reads from database
- Feature has no external service calls
- Feature has no user input

---

## Summary

The early-access incident revealed that **email and external service integration features need more rigor than internal features.** This checklist ensures:

1. **Security:** All inputs sanitized, injection vectors blocked
2. **Type Safety:** TypeScript catches configuration errors before deployment
3. **Resilience:** Fallback modes for unavailable services
4. **Observability:** Logs, tests, and monitoring catch production issues
5. **Operations:** Environment configuration documented and verified

**Use this checklist for all future email, API, and external service features.**

---

## Related Documentation

- [INCIDENT-2025-12-06-early-access-production-blocking.md](./INCIDENT-2025-12-06-early-access-production-blocking.md) - Full incident analysis
- [OWASP Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
- [MAIS Testing Documentation](../../reference/TESTING.md)
- [MAIS Security Guide](../../security/SECURITY_GUIDE.md)
