# Wrapper Format Prevention - Complete Index

**Bug #697:** Missing `publishedAt` timestamp causes published landing page changes to be invisible to visitors.

**Root Cause:** Used `{ published: draftConfig }` instead of `createPublishedWrapper()` helper.

**Impact:** P1 - Data Loss (published changes not visible)

---

## Documentation Structure

```
docs/solutions/
├── WRAPPER_FORMAT_INDEX.md                    (You are here)
│
├── WRAPPER_FORMAT_PREVENTION.md               (Main guide - START HERE)
│   ├── 1. Code Review Checklist
│   ├── 2. ESLint Rule & TypeScript Patterns
│   ├── 3. Test Case Suggestions
│   ├── 4. Documentation Updates
│   ├── 5. Implementation Checklist
│   ├── 6. Related Patterns
│   └── 7. Quick Diagnosis
│
├── WRAPPER_FORMAT_PREVENTION_SUMMARY.md       (Implementation roadmap)
│   ├── Phase 1-5 breakdown
│   ├── Quick checklist
│   ├── Test coverage goals
│   ├── Metrics to track
│   └── Next steps
│
├── TEST_EXAMPLES_WRAPPER_FORMAT.md            (Copy-paste tests)
│   ├── Unit tests
│   ├── Integration tests
│   ├── Schema validation tests
│   └── Anti-pattern tests
│
├── ESLINT_RULE_SETUP.md                       (Linting setup)
│   ├── Rule registration
│   ├── Usage examples
│   ├── IDE integration
│   ├── CI/CD integration
│   └── Troubleshooting
│
└── patterns/
    └── WRAPPER_FORMAT_QUICK_REFERENCE.md      (1-page cheat sheet)
        ├── The problem
        ├── The solution
        ├── Code review checklist
        ├── Type safety pattern
        ├── Test pattern
        └── Emergency diagnosis
```

---

## Quick Start (5 minutes)

1. **Understand the bug:**
   - Read: `patterns/WRAPPER_FORMAT_QUICK_REFERENCE.md`
   - Time: 2 min

2. **Know what to check in reviews:**
   - Read: Code Review Checklist in `WRAPPER_FORMAT_PREVENTION.md`
   - Time: 2 min

3. **Bookmark for reference:**
   - Save this index file
   - Time: 1 min

---

## Implementation Paths

### For Code Reviewers

1. Read `patterns/WRAPPER_FORMAT_QUICK_REFERENCE.md` (2 min)
2. Use checklist from `WRAPPER_FORMAT_PREVENTION.md` Section 1 (1 min)
3. Bookmark for quick reference

### For New Developers

1. Read `WRAPPER_FORMAT_PREVENTION.md` completely (15 min)
2. Review test examples in `TEST_EXAMPLES_WRAPPER_FORMAT.md` (10 min)
3. Complete team training session

### For Implementation

1. Read `WRAPPER_FORMAT_PREVENTION_SUMMARY.md` for roadmap (5 min)
2. Follow Phase 1-5 implementation steps (4-6 hours)
3. Use `ESLINT_RULE_SETUP.md` for linting setup (30 min)
4. Use `TEST_EXAMPLES_WRAPPER_FORMAT.md` for test code (1-2 hours)

### For Setting Up Linting

1. Read `ESLINT_RULE_SETUP.md` (10 min)
2. Copy ESLint rule file
3. Register in `.eslintrc.json`
4. Run against codebase

---

## The Pattern (30 seconds)

**Wrong:**

```typescript
await tenantRepo.update(tenantId, {
  landingPageConfig: { published: draftConfig }, // ❌ Missing publishedAt!
  landingPageConfigDraft: null,
});
```

**Correct:**

```typescript
import { createPublishedWrapper } from '../lib/landing-page-utils';

await tenantRepo.update(tenantId, {
  landingPageConfig: createPublishedWrapper(draftConfig), // ✅ Includes timestamp
  landingPageConfigDraft: null,
});
```

**Why:** The wrapper helper ensures `publishedAt` timestamp is included, which is required for the public API to see published changes.

---

## File Locations

### Documentation Files (New)

```
/Users/mikeyoung/CODING/MAIS/docs/solutions/
├── WRAPPER_FORMAT_PREVENTION.md
├── WRAPPER_FORMAT_PREVENTION_SUMMARY.md
├── TEST_EXAMPLES_WRAPPER_FORMAT.md
├── ESLINT_RULE_SETUP.md
├── WRAPPER_FORMAT_INDEX.md (this file)
└── patterns/
    └── WRAPPER_FORMAT_QUICK_REFERENCE.md
```

### Code Files (New)

```
/Users/mikeyoung/CODING/MAIS/server/eslint-rules/
└── landing-page-config-wrapper.js
```

### Files to Update

```
/Users/mikeyoung/CODING/MAIS/
├── CLAUDE.md (add wrapper format section)
├── server/src/lib/landing-page-utils.ts (add branded type)
├── server/src/adapters/prisma/tenant.repository.ts (update types)
└── docs/solutions/PREVENTION-QUICK-REFERENCE.md (add entry)
```

---

## Key Concepts

### 1. The Wrapper Format

Landing page config uses a wrapper when published:

```typescript
{
  draft: null,                    // Draft changes (null after publish)
  draftUpdatedAt: null,          // When draft was last saved (null after publish)
  published: {...config...},     // The live config that visitors see
  publishedAt: "2026-01-20T15:30:45.123Z"  // When published (REQUIRED)
}
```

### 2. The Helper Function

`createPublishedWrapper()` in `landing-page-utils.ts` is the **only** correct way to create this format:

```typescript
export function createPublishedWrapper(draftConfig: unknown): PublishedWrapper {
  return {
    draft: null,
    draftUpdatedAt: null,
    published: draftConfig,
    publishedAt: new Date().toISOString(), // Always included!
  };
}
```

### 3. Branded Types

TypeScript branded type prevents bypass:

```typescript
export type ValidatedPublishedWrapper = PublishedWrapper & {
  readonly __brand: 'ValidatedPublishedWrapper';
};
```

Only `createPublishedWrapper()` returns this type - caller can't create manually.

### 4. ESLint Rule

Catches patterns like `{ published: config }` in development:

```bash
npx eslint --rule 'landing-page-config-wrapper: error'
```

---

## Testing Strategy

### Unit Tests

- Verify wrapper has all 4 fields
- Verify `publishedAt` is ISO string
- Verify timestamp is recent

### Integration Tests

- Verify endpoint creates wrapper correctly
- Verify `publishedAt` persists to database
- Verify public API can read it

### Schema Validation Tests

- Verify Zod schema accepts valid wrapper
- Verify schema rejects invalid formats
- Verify schema requires `publishedAt`

### Anti-Pattern Tests

- Document what NOT to do
- Show why bad patterns fail
- Provide correct alternatives

See: `TEST_EXAMPLES_WRAPPER_FORMAT.md` for copy-paste test code.

---

## Code Review Checklist (30 seconds)

When reviewing landing page code:

```
1. Search for: landingPageConfig
2. Check: Does it use createPublishedWrapper()?
3. If no: Ask reviewer to use the helper
4. If yes: Check timestamp format (ISO 8601)
5. Verify: Draft is cleared after publish
6. Run: npx eslint --rule 'landing-page-config-wrapper: error'
```

---

## Troubleshooting

### Q: Published changes aren't visible

**A:** Check if wrapper has `publishedAt` field:

```typescript
const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
console.log(tenant.landingPageConfig.publishedAt); // Should be ISO string
```

### Q: ESLint rule isn't working

**A:** Verify registration in `.eslintrc.json`:

```json
{
  "rules": {
    "landing-page-config-wrapper": "error"
  }
}
```

### Q: Tests are failing

**A:** See `TEST_EXAMPLES_WRAPPER_FORMAT.md` for debugging tips

### Q: What's the performance impact?

**A:** Negligible - just setting a timestamp field at publish time

---

## Related Issues

- **#697** - Dual draft system publish mismatch fix (original bug)
- **TODO-704** - Landing page service abstraction consolidation
- **TODO-725** - Prevent duplication between service and executors
- **ADR-013** - Double-booking prevention (similar atomic transaction pattern)

---

## Prevention Summary

| Layer             | Prevention                                        | File                              |
| ----------------- | ------------------------------------------------- | --------------------------------- |
| **Type Safety**   | Branded type makes invalid states unrepresentable | `landing-page-utils.ts`           |
| **Development**   | ESLint rule catches violations in IDE             | `landing-page-config-wrapper.js`  |
| **Review**        | Code review checklist (this document)             | Section 1 of Prevention guide     |
| **Testing**       | Comprehensive test suite (100% coverage)          | `TEST_EXAMPLES_WRAPPER_FORMAT.md` |
| **Documentation** | Clear patterns and examples                       | All documents in this folder      |

---

## Team Training

### For New Developers (30 min)

1. Introduction (5 min)
   - Why this bug matters (data loss)
   - What the pattern prevents

2. Understanding (10 min)
   - Read `WRAPPER_FORMAT_QUICK_REFERENCE.md`
   - Review code examples

3. Practice (10 min)
   - Review pull requests with wrapper pattern
   - Run ESLint check
   - Write a test case

4. Q&A (5 min)

### For Code Reviewers (15 min)

1. Pattern overview (5 min)
2. Review checklist (5 min)
3. Q&A (5 min)

### For DevOps/Release (15 min)

1. CI/CD integration (5 min)
   - Read `ESLINT_RULE_SETUP.md`
2. Monitoring (5 min)
   - What metrics to track
3. Rollback (5 min)
   - What to do if issues arise

---

## Success Criteria

After implementation:

- [ ] Zero ESLint violations for `landing-page-config-wrapper` rule
- [ ] 100% of publishes include `publishedAt` timestamp
- [ ] No data loss incidents related to missing timestamps
- [ ] Code review time decreases (automated checks)
- [ ] All new developers know the pattern
- [ ] Team training completed

---

## Next Steps

1. **Now:** Read `WRAPPER_FORMAT_QUICK_REFERENCE.md` (2 min)
2. **This week:** Review `WRAPPER_FORMAT_PREVENTION.md` (15 min)
3. **Before coding:** Use code review checklist (30 sec)
4. **Implementation:** Follow `WRAPPER_FORMAT_PREVENTION_SUMMARY.md` roadmap
5. **Testing:** Use patterns from `TEST_EXAMPLES_WRAPPER_FORMAT.md`
6. **Deployment:** Use `ESLINT_RULE_SETUP.md` for CI/CD

---

## Questions?

**Quick answer:** See `patterns/WRAPPER_FORMAT_QUICK_REFERENCE.md`

**Detailed answer:** See `WRAPPER_FORMAT_PREVENTION.md` (appropriate section)

**Implementation help:** See `WRAPPER_FORMAT_PREVENTION_SUMMARY.md`

**Test examples:** See `TEST_EXAMPLES_WRAPPER_FORMAT.md`

**ESLint setup:** See `ESLINT_RULE_SETUP.md`
