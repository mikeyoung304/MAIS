# MAIS Risk Register

**Generated:** 2025-12-28
**Total Findings:** 52
**Distribution:** P0: 5 | P1: 15 | P2: 20 | P3: 12

---

## P0 - Critical (Must Fix Before Launch)

| ID    | Finding                              | Category       | File:Line                  | Impact                                     | Likelihood | Fix                                         |
| ----- | ------------------------------------ | -------------- | -------------------------- | ------------------------------------------ | ---------- | ------------------------------------------- |
| R-001 | API keys logged in plaintext         | Secrets        | `tenant.ts:85,112`         | Credential exposure via log aggregation    | HIGH       | Redact to first 8 + last 4 chars            |
| R-002 | WebhookDelivery table no cleanup     | Data Growth    | Schema + missing service   | Database disk exhaustion in 6-12 months    | MEDIUM     | Add 30-day cleanup scheduler                |
| R-003 | AgentSession unbounded messages      | Data Growth    | Schema:813                 | JSON array grows without limit per session | MEDIUM     | Add 90-day cleanup + message pruning        |
| R-004 | Hardcoded credentials in .env        | Secrets        | `.env` (multiple lines)    | Full system compromise if repo leaked      | HIGH       | Rotate all credentials, use secrets manager |
| R-005 | Global webhook idempotency namespace | Data Integrity | `webhooks.routes.ts:67-76` | Cross-tenant webhook collision possible    | LOW        | Require tenantId for all payment webhooks   |

---

## P1 - High (Fix Within Week 1)

| ID    | Finding                               | Category       | File:Line                                           | Impact                                           | Likelihood | Fix                                        |
| ----- | ------------------------------------- | -------------- | --------------------------------------------------- | ------------------------------------------------ | ---------- | ------------------------------------------ |
| R-006 | CORS allows all HTTPS origins         | Security       | `app.ts:132-134`                                    | CSRF attacks on admin routes                     | MEDIUM     | Restrict to explicit admin domains         |
| R-007 | Missing error.tsx in booking routes   | Reliability    | `apps/web/.../book/[packageSlug]/`                  | Customer-facing crash without recovery UI        | MEDIUM     | Add error boundary component               |
| R-008 | No timeout on Next.js API calls       | Reliability    | `api.ts:90-95,121-129`                              | Request hangs indefinitely                       | MEDIUM     | Add AbortSignal.timeout(10000)             |
| R-009 | 7-day impersonation token expiry      | Auth           | `identity.service.ts:66`                            | Extended privilege window for compromised tokens | LOW        | Reduce to 4 hours                          |
| R-010 | Advisory lock timeout not enforced    | Payments       | `booking.repository.ts:181-186`                     | Transactions hang indefinitely under contention  | MEDIUM     | Pass timeout to $transaction()             |
| R-011 | No Google Calendar timeout            | Reliability    | `gcal.adapter.ts:156-167`                           | Request hangs if GCal API slow                   | MEDIUM     | Add AbortSignal.timeout(5000)              |
| R-012 | Webhook delivery no retry             | Reliability    | `webhook-delivery.service.ts:161`                   | Lost events on transient failures                | MEDIUM     | Add BullMQ retry queue                     |
| R-013 | No distributed tracing                | Observability  | N/A                                                 | Cannot trace requests across boundaries          | LOW        | Implement OpenTelemetry                    |
| R-014 | AgentProposal no cleanup              | Data Growth    | Schema:736                                          | Expired proposals accumulate                     | MEDIUM     | Add hourly cleanup for expired             |
| R-015 | AgentAuditLog cleanup not scheduled   | Data Growth    | `audit.service.ts:221-240`                          | Method exists but never called                   | MEDIUM     | Schedule in cron                           |
| R-016 | Metadata tenantId not cross-validated | Data Integrity | `webhook-processor.ts:217-233`                      | Booking under wrong tenant possible              | LOW        | Assert metadata matches effective tenantId |
| R-017 | Refund processing not idempotent      | Payments       | `refund-processing.service.ts:91-92`                | Retry fails instead of returning existing        | LOW        | Return existing state on duplicate         |
| R-018 | Missing error.tsx in \_domain booking | Reliability    | `apps/web/.../t/_domain/book/[packageSlug]/`        | Custom domain crash without recovery             | MEDIUM     | Add error boundary                         |
| R-019 | Missing error.tsx in pages editor     | Reliability    | `apps/web/.../(protected)/tenant/pages/[pageType]/` | Admin editor crash                               | MEDIUM     | Add error boundary                         |
| R-020 | CSP unsafe-inline for scripts         | Security       | `app.ts:61-67`                                      | XSS risk if trusted source compromised           | LOW        | Implement nonce-based CSP (Phase 3 TODO)   |

---

## P2 - Medium (Fix Within Month 1)

| ID    | Finding                                      | Category        | File:Line                                  | Impact                                  | Likelihood | Fix                                 |
| ----- | -------------------------------------------- | --------------- | ------------------------------------------ | --------------------------------------- | ---------- | ----------------------------------- |
| R-021 | No circuit breaker pattern                   | Reliability     | Multiple adapters                          | Cascading failures to external services | LOW        | Add circuit breaker for Stripe/GCal |
| R-022 | 400+ ESLint any type warnings                | Code Quality    | `.eslintrc.json`                           | Type safety regression                  | LOW        | Incremental fixes with tracking     |
| R-023 | scheduling-availability.service.ts 645 lines | Maintainability | Service file                               | God object, hard to test                | LOW        | Extract to 3 focused services       |
| R-024 | tenant-admin.routes.ts 1895 lines            | Maintainability | Route file                                 | All admin ops in one file               | LOW        | Split by feature domain             |
| R-025 | AgentChat duplication 520 lines              | Maintainability | AgentChat.tsx + PanelAgentChat.tsx         | Same logic duplicated                   | LOW        | Extract shared hook                 |
| R-026 | write-tools.ts 1728 lines                    | Maintainability | Agent tools                                | 18 tools in one file                    | LOW        | Split by domain                     |
| R-027 | read-tools.ts 1387 lines                     | Maintainability | Agent tools                                | 16 tools in one file                    | LOW        | Split by domain                     |
| R-028 | No file storage quota                        | Resource Limits | `upload.adapter.ts`                        | Tenant could exhaust storage            | LOW        | Add per-tenant quota tracking       |
| R-029 | Rate limiting after body parsing             | Security        | `app.ts` (TODO-273)                        | Large JSON DoS before limit             | LOW        | Apply rate limit before parsing     |
| R-030 | Mock admin password visible                  | Secrets         | `mock/index.ts:134`                        | Visible in codebase (mock only)         | LOW        | Use env variable                    |
| R-031 | Password validation weak                     | Auth            | `auth.routes.ts:390`                       | 8 char minimum, no complexity           | LOW        | Add complexity requirements         |
| R-032 | Email in login failure logs                  | Privacy         | `auth.routes.ts:102`                       | Email enumeration possible              | LOW        | Remove from debug logs              |
| R-033 | Missing request-level idempotency            | Data Integrity  | `public-date-booking.routes.ts` (TODO-329) | Duplicate submissions possible          | MEDIUM     | Add X-Idempotency-Key header        |
| R-034 | Honeypot bot protection missing              | Security        | `public-date-booking.routes.ts` (TODO-330) | Bot spam possible                       | LOW        | Add honeypot field                  |
| R-035 | WebhookEvent no cleanup                      | Data Growth     | Schema:580                                 | Raw payloads accumulate                 | LOW        | Add 90-day cleanup                  |
| R-036 | ConfigChangeLog no cleanup                   | Data Growth     | Schema:630                                 | Snapshots grow indefinitely             | LOW        | Consider archival (compliance)      |
| R-037 | SVG XSS validation basic                     | Security        | `upload.adapter.ts:110-124`                | SVG attribute XSS possible              | LOW        | Use dedicated SVG parser            |
| R-038 | JSON.parse without try-catch                 | Reliability     | `catalog.repository.ts:676`                | Crash on malformed JSON                 | LOW        | Add try-catch wrapper               |
| R-039 | UploadService singleton pattern              | Code Quality    | `upload.service.ts` (TODO-065)             | DI not fully applied                    | LOW        | Convert to DI pattern               |
| R-040 | 448 TODO files need grooming                 | Maintainability | `todos/` directory                         | Stale tracking items                    | LOW        | Audit and close resolved            |

---

## P3 - Low (Fix When Convenient)

| ID    | Finding                               | Category        | File:Line                        | Impact                               | Likelihood | Fix                          |
| ----- | ------------------------------------- | --------------- | -------------------------------- | ------------------------------------ | ---------- | ---------------------------- |
| R-041 | User-agent logged                     | Privacy         | `request-logger.ts:25`           | Fingerprinting possible              | LOW        | Consider removing in prod    |
| R-042 | Duplicate event attempts not tracked  | Observability   | `webhook.repository.ts:44-62`    | Already-DUPLICATE not incremented    | LOW        | Increment attempts           |
| R-043 | Stripe API version future-dated       | Maintainability | `stripe.adapter.ts:23`           | 2025-10-29.clover may cause issues   | LOW        | Pin to stable version        |
| R-044 | Redis event listeners no cleanup      | Reliability     | `cache.adapter.ts`               | Minor - covered by shutdown          | LOW        | Add explicit removeListener  |
| R-045 | Frontend logger console-only          | Observability   | `apps/web/src/lib/logger.ts`     | No structured frontend logging       | LOW        | Add Sentry for frontend      |
| R-046 | Agent tool metrics missing            | Observability   | `agent/` directory               | No execution timing/token tracking   | LOW        | Add tool execution metrics   |
| R-047 | Backup files present                  | Hygiene         | `.env.backup`, `vercel.json.bak` | Clutter                              | LOW        | Remove unused files          |
| R-048 | Prevention strategies over-documented | Maintainability | `docs/solutions/`                | 40+ files, hard to navigate          | LOW        | Consolidate into fewer files |
| R-049 | Archive naming inconsistent           | Maintainability | `docs/archive/`                  | Some follow YYYY-MM-DD, others don't | LOW        | Standardize naming           |
| R-050 | 30+ skipped E2E tests                 | Test Coverage   | E2E test files                   | Flaky tests from Sprint 6            | LOW        | Fix and un-skip              |
| R-051 | 12 webhook tests TODO                 | Test Coverage   | `webhooks.http.spec.ts`          | Missing implementation               | LOW        | Implement tests              |
| R-052 | Health check codes not standardized   | Observability   | `health.routes.ts`               | String status vs numeric             | LOW        | Add standard codes           |

---

## Risk Distribution Summary

```
P0 (Critical):  ████████████████████ 5 (10%)
P1 (High):      ██████████████████████████████████████████████████ 15 (29%)
P2 (Medium):    ████████████████████████████████████████████████████████████████████████████████ 20 (38%)
P3 (Low):       ████████████████████████████████████████████████ 12 (23%)
                ────────────────────────────────────────────────────────────────────────────────
Total:          52 findings
```

---

## Category Distribution

| Category        | Count | P0  | P1  | P2  | P3  |
| --------------- | ----- | --- | --- | --- | --- |
| Data Growth     | 8     | 2   | 3   | 2   | 1   |
| Security        | 6     | 1   | 1   | 3   | 1   |
| Reliability     | 9     | 0   | 5   | 2   | 2   |
| Secrets         | 3     | 2   | 0   | 1   | 0   |
| Observability   | 5     | 0   | 1   | 0   | 4   |
| Maintainability | 10    | 0   | 0   | 6   | 4   |
| Auth            | 3     | 0   | 1   | 2   | 0   |
| Payments        | 3     | 1   | 2   | 0   | 0   |
| Data Integrity  | 3     | 1   | 2   | 0   | 0   |
| Code Quality    | 2     | 0   | 0   | 2   | 0   |

---

## Remediation Effort Estimate

| Priority  | Findings | Est. Hours       | Recommended Timeline |
| --------- | -------- | ---------------- | -------------------- |
| P0        | 5        | 8-12 hours       | Week 1, Days 1-3     |
| P1        | 15       | 24-40 hours      | Week 1-2             |
| P2        | 20       | 40-60 hours      | Month 1              |
| P3        | 12       | 16-24 hours      | As convenient        |
| **Total** | **52**   | **88-136 hours** | **4-6 weeks**        |

---

## Risk Acceptance Log

_Document any risks intentionally accepted:_

| Risk ID | Accepted By | Date | Reason                                    | Review Date |
| ------- | ----------- | ---- | ----------------------------------------- | ----------- |
| R-020   | -           | -    | CSP unsafe-inline required for Stripe.js  | -           |
| R-036   | -           | -    | ConfigChangeLog is compliance requirement | -           |

---

_Risk Register maintained by security team. Review monthly or after significant changes._
