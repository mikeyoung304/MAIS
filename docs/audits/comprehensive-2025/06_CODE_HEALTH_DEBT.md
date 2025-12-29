# MAIS Code Health & Technical Debt Assessment

**Date:** 2025-12-28
**Codebase:** 864 TypeScript files, 237 test files

---

## 1. Overall Health Score: 80/100 (B)

| Metric            | Score  | Status                            |
| ----------------- | ------ | --------------------------------- |
| Architecture      | 85/100 | Well-structured, clear separation |
| Type Safety       | 75/100 | Some ESLint warnings relaxed      |
| Test Coverage     | 80/100 | 237 test files, some gaps         |
| Code Organization | 75/100 | Large files need splitting        |
| Documentation     | 85/100 | Comprehensive, some drift         |
| Dependencies      | 95/100 | Zero vulnerabilities              |

---

## 2. Large File Analysis

### Backend Modules > 500 Lines

| File                                 | Lines | Issue                     | Recommendation                                 |
| ------------------------------------ | ----- | ------------------------- | ---------------------------------------------- |
| `tenant-admin.routes.ts`             | 1895  | All admin ops in one file | Split by domain (packages, bookings, settings) |
| `write-tools.ts`                     | 1728  | 18 agent tools            | Split by domain or extract to files            |
| `read-tools.ts`                      | 1387  | 16 agent tools            | Split by domain or extract to files            |
| `booking.repository.ts`              | 1225  | Complex transactions      | Extract transaction helpers                    |
| `scheduling-availability.service.ts` | 645   | Multiple concerns         | Extract TimezoneService, SlotGenerationService |
| `catalog.service.ts`                 | 568   | Catalog + segments        | Extract SegmentFilterService                   |
| `booking.service.ts`                 | 466   | Facade pattern            | Acceptable - delegates to focused services     |
| `idempotency.service.ts`             | 437   | Cleanup + generation      | Acceptable - cohesive                          |

### Frontend Modules > 500 Lines

| File                 | Lines | Issue                     | Recommendation                             |
| -------------------- | ----- | ------------------------- | ------------------------------------------ |
| `tenant.ts`          | 614   | Fetch + cache + transform | Split into TenantFetcher, TenantNormalizer |
| `AgentChat.tsx`      | 609   | Complex state             | Extract useAgentChat hook                  |
| `PanelAgentChat.tsx` | 521   | Duplicates AgentChat      | Extract shared hook                        |

---

## 3. Code Duplication

### High-Impact Duplication

| Pattern             | Files                                 | Duplicated Lines | Fix                               |
| ------------------- | ------------------------------------- | ---------------- | --------------------------------- |
| Agent chat logic    | `AgentChat.tsx`, `PanelAgentChat.tsx` | ~520 lines       | Extract `useAgentChat` hook       |
| URL validation      | Multiple landing page components      | ~55 lines        | Create `validateImageUrl` utility |
| TenantId extraction | `tenant-admin.routes.ts` (10+ places) | ~50 lines        | TODO-194: Create helper           |
| Error handling      | Multiple routes                       | ~40 lines        | TODO-196: Standardize pattern     |
| DTO mapping         | Multiple endpoints                    | ~30 lines        | TODO-195: Create mapper           |

### Estimated Deduplication Effort

```
Agent chat refactor:  4 hours → Save 520 lines
URL validation:       1 hour  → Save 55 lines
TenantId helper:      1 hour  → Save 50 lines
Error standardization: 2 hours → Save 40 lines
DTO mapper:           1 hour  → Save 30 lines
                      ─────────────────────────
Total:                9 hours → Save ~700 lines
```

---

## 4. Technical Debt Inventory

### TODO Files (448 Total)

```
Distribution by Status:
├── Completed:  350+ files (cleanup needed)
├── Deferred:   85+ files
└── Pending:    13 files (active work)

Recommendation: Quarterly TODO audit to close stale items
```

### Critical TODOs in Source Code

| TODO ID  | File                            | Description                    | Priority |
| -------- | ------------------------------- | ------------------------------ | -------- |
| TODO-273 | `app.ts`                        | Rate limit before body parsing | P1       |
| TODO-065 | `upload.service.ts`             | Singleton breaks DI            | P2       |
| TODO-329 | `public-date-booking.routes.ts` | X-Idempotency-Key header       | P1       |
| TODO-330 | `public-date-booking.routes.ts` | Honeypot bot protection        | P2       |
| TODO-057 | `rateLimiter.ts`                | Rate limit public scheduling   | P1       |
| TODO-154 | Reminder system                 | Recalculate on reschedule      | P2       |
| TODO-278 | Multiple                        | Async webhook delivery         | P2       |
| TODO-194 | `tenant-admin.routes.ts`        | TenantId extraction helper     | P2       |
| TODO-195 | `tenant-admin.routes.ts`        | DTO mapper function            | P2       |
| TODO-196 | Multiple                        | Standardize NotFoundError      | P2       |

---

## 5. ESLint Health

### Current Configuration

```json
{
  "@typescript-eslint/no-explicit-any": "warn", // Relaxed from "error"
  "no-console": "error",
  "consistent-type-imports": "error"
}
```

### Warning Count

```
@typescript-eslint/no-explicit-any: ~400+ warnings
Reason: ts-rest library limitations (documented in prevention strategies)
Status: Intentionally relaxed, needs incremental fixes
```

### Recommendation

1. Create `@typescript-eslint/no-explicit-any` exemption list
2. Track count in CI metrics
3. Target 50% reduction over 6 months

---

## 6. Dead Code Analysis

### Identified Dead Code

| Item                 | File                  | Type              | Status                  |
| -------------------- | --------------------- | ----------------- | ----------------------- |
| `uploadLimiter`      | `rateLimiter.ts`      | Deprecated export | @deprecated annotation  |
| Old error classes    | `lib/errors/base.ts`  | Deprecated        | Still referenced        |
| `manageBlackoutTool` | `write-tools.ts:1713` | Removed function  | Comment only            |
| `getBlackoutsTool`   | `read-tools.ts:1378`  | Duplicate         | Comment only            |
| Cache middleware     | Removed               | Security fix      | Documented in CLAUDE.md |

### Backup Files

```
.env.backup       → Remove or encrypt
vercel.json.bak   → Remove
*.pack.old (Next) → Auto-generated, ignore
```

---

## 7. Test Coverage Status

### Test File Distribution

```
Total: 237 test files
├── Unit tests:        ~150 files
├── Integration tests: ~50 files
├── E2E tests:         ~87 files
└── Templates:         5 files
```

### Coverage Gaps

| Area                   | Gap           | Files                   |
| ---------------------- | ------------- | ----------------------- |
| Webhook HTTP tests     | 12 tests TODO | `webhooks.http.spec.ts` |
| Idempotency edge cases | 2 tests TODO  | Various                 |
| Rate limiting          | 4 tests TODO  | Various                 |
| Flaky E2E tests        | 30+ skipped   | Sprint 6 regressions    |

### Recommendation

1. Implement 12 webhook HTTP tests
2. Fix and un-skip 30 E2E tests
3. Target 70% unit test coverage

---

## 8. Dependency Health

### npm Audit Status

```
Vulnerabilities: 0 (Critical: 0, High: 0, Moderate: 0, Low: 0)
Last updated: 2025-12-28
```

### Key Dependencies

| Package    | Version | Status  |
| ---------- | ------- | ------- |
| express    | 4.x     | Current |
| prisma     | 6.x     | Current |
| stripe     | 17.x    | Current |
| next       | 14.x    | Current |
| typescript | 5.9.3   | Current |
| zod        | 3.24.x  | Current |
| helmet     | 8.1.x   | Current |

### Recommendations

1. Enable Dependabot for automated updates
2. Monthly `npm audit` in CI
3. Quarterly major version review

---

## 9. Documentation Drift

### Documentation Status

| Area                  | Status          | Notes                          |
| --------------------- | --------------- | ------------------------------ |
| CLAUDE.md             | Current         | Updated with agent patterns    |
| Prevention strategies | Over-documented | 40+ files, needs consolidation |
| ADRs                  | Current         | 14 decisions documented        |
| API contracts         | Current         | Some routes need updates       |
| TODO files            | Stale           | 448 files, many resolved       |
| Archive               | Inconsistent    | Naming conventions vary        |

### Recommendations

1. Consolidate prevention strategies (40 → 10 files)
2. Audit TODO files (close resolved, archive old)
3. Standardize archive naming: `YYYY-MM-DD_filename.md`

---

## 10. Architectural Debt

### Current Issues

| Issue                      | Impact          | Effort  | Priority |
| -------------------------- | --------------- | ------- | -------- |
| Large route files          | Maintainability | 4 hours | P2       |
| Agent tool organization    | Maintainability | 4 hours | P2       |
| Service extraction         | Testability     | 8 hours | P2       |
| Chat component duplication | Maintainability | 4 hours | P2       |

### Technical Debt Burn-Down Plan

```
Week 1-2:
├── Rate limiting fixes (TODO-273, TODO-057)
├── Idempotency header (TODO-329)
└── Bot protection (TODO-330)

Week 3-4:
├── Extract useAgentChat hook
├── Create tenantId helper (TODO-194)
└── DTO mapper (TODO-195)

Month 2:
├── Split tenant-admin.routes.ts
├── Refactor scheduling-availability.service.ts
└── Consolidate prevention strategies

Month 3:
├── Split agent tools by domain
├── Implement 12 webhook tests
└── Fix 30 E2E tests
```

---

## 11. Code Quality Metrics

### Complexity Indicators

| Metric                | Current      | Target      |
| --------------------- | ------------ | ----------- |
| Max file size         | 1895 lines   | < 500 lines |
| Max function length   | ~150 lines   | < 50 lines  |
| Cyclomatic complexity | Not measured | < 10        |
| Duplication ratio     | ~5%          | < 3%        |

### Positive Indicators

- ✅ Clear module boundaries (routes → services → adapters)
- ✅ Dependency injection throughout
- ✅ Type-safe API contracts
- ✅ Consistent error handling patterns
- ✅ Repository pattern for data access
- ✅ Mock-first development support

---

## 12. Recommendations Summary

### Immediate (This Sprint)

1. **Fix critical TODOs:** TODO-273, TODO-329, TODO-330
2. **Remove backup files:** `.env.backup`, `vercel.json.bak`

### Short-term (Month 1)

3. **Extract chat hook:** Eliminate 520 lines duplication
4. **Create helper functions:** TODO-194, TODO-195, TODO-196
5. **Audit TODO files:** Close 350+ completed items

### Medium-term (Quarter 1)

6. **Split large files:** tenant-admin.routes.ts, agent tools
7. **Refactor services:** scheduling-availability → 3 services
8. **Consolidate docs:** 40 prevention files → 10

### Long-term (Quarter 2)

9. **ESLint cleanup:** Reduce any warnings by 50%
10. **Test coverage:** Achieve 70% unit test coverage
11. **Documentation refresh:** Update all ADRs and guides

---

## 13. Technical Debt Register

| ID     | Description                   | Owner    | Sprint  | Status   |
| ------ | ----------------------------- | -------- | ------- | -------- |
| TD-001 | Large route files             | Backend  | Q1      | Open     |
| TD-002 | Agent tool organization       | Backend  | Q1      | Open     |
| TD-003 | Chat component duplication    | Frontend | Q1      | Open     |
| TD-004 | 400+ ESLint any warnings      | All      | Ongoing | Tracking |
| TD-005 | TODO file cleanup             | PM       | Q1      | Open     |
| TD-006 | Prevention docs consolidation | Docs     | Q1      | Open     |
| TD-007 | Service extraction            | Backend  | Q2      | Open     |
| TD-008 | Test coverage gaps            | QA       | Q1      | Open     |

---

_Code health assessment maintained by engineering team. Review monthly._
