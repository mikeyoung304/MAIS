---
module: MAIS
date: 2025-12-25
problem_type: code_review_documentation
component: code_review_checklists
severity: P2
tags: [code-review, index, navigation, checklists]
---

# Code Review Checklists & Prevention Strategies

**Complete guide for preventing code review findings in the MAIS codebase.**

Based on analysis of **15 code review findings** from PR #18 (tenant multi-page sites feature).

---

## Quick Navigation

### For Code Reviewers
Start here if you're reviewing a PR right now:

1. **[CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md)** ← START HERE
   - 1-minute checklists (copy/paste ready)
   - Decision trees for common questions
   - Red flags during review
   - Templates for copy-paste fixes

2. **[MAIS-SPECIFIC-PATTERNS.md](./MAIS-SPECIFIC-PATTERNS.md)**
   - Real examples from the MAIS codebase
   - Before/after comparisons
   - Pattern summaries

### For Deep Learning
Study these to understand prevention strategies:

3. **[CODE-REVIEW-PREVENTION-STRATEGIES.md](./CODE-REVIEW-PREVENTION-STRATEGIES.md)**
   - Complete analysis of all 15 findings
   - Decision trees and flowcharts
   - Detailed code examples
   - When and why to apply each pattern

---

## The 15 Code Review Findings

Organized by category and severity:

### P1 - Security/Compliance (2 items)

1. **Duplicate id="main-content"** - WCAG violation
   - Only root layout should have `<main id="main-content">`
   - Child layouts should use `<div>`
   - Fix: Move skip link logic to root layout

2. **Nested `<main>` elements** - Invalid HTML
   - `<main>` cannot be nested inside `<main>`
   - Fix: Only root layout renders `<main>`, others use `<div>`

### P2 - Performance/UX (11 items)

3. **formatPrice() duplication** - Code appears in 2+ files
   - Extract to: `lib/format.ts`
   - Issue: Changes require updating multiple files

4. **Navigation configuration duplication** - NAV_ITEMS in TenantNav and TenantFooter
   - Extract to: `components/tenant/navigation.ts`
   - Issue: Inconsistency if one file updates

5. **TIER_ORDER duplication** - Tier ordering in multiple pages
   - Extract to: `lib/packages.ts`
   - Issue: Maintenance burden across codebase

6. **Missing React cache() wrapper** - getTenantByDomain called multiple times
   - Add: `export const getTenantByDomain = cache(async () => { ... })`
   - Issue: Duplicate API calls per request

7. **Missing aria-current on navigation** - No indication of active page
   - Add: `aria-current={isActiveLink(item.href) ? 'page' : undefined}`
   - Issue: Accessibility violation

8. **Low contrast error text** - red-500 doesn't meet WCAG AA
   - Change: `text-red-700` (4.5:1 ratio minimum)
   - Issue: Screen reader users can't read errors

9. **Broken navigation links** - basePath issues in domain routes
   - Fix: Ensure buildNavHref() handles domain params correctly
   - Issue: Users can't navigate between pages

10. **Missing error boundaries** - No error.tsx in _domain routes
    - Add: error.tsx to all dynamic route segments
    - Issue: Unhandled errors crash page

11. **Missing AbortController cleanup** - ContactForm cleanup on unmount
    - Add: useEffect cleanup that aborts in-flight requests
    - Issue: Memory leaks if user navigates away

12. **Missing domain validation** - Domain parameter never validated
    - Add: validateDomain() helper with regex and error handling
    - Issue: Malformed domains cause unclear errors

13. **Broken domain routes** - Query parameters lost in navigation
    - Fix: buildNavHref() must append domain param
    - Issue: Domain context lost when navigating

### P3 - Polish (4 items)

14. **Missing useMemo** - navItems array recreated on every render
    - Add: `const navItems = useMemo(() => [...], [basePath, domainParam])`
    - Issue: Unnecessary re-renders of child components

15. **Missing useCallback** - isActiveLink recreated on every render
    - Add: `const isActiveLink = useCallback((...) => { ... }, [deps])`
    - Issue: Component re-renders, should have JSDoc

---

## How to Use These Guides

### Scenario 1: You're reviewing a PR

**Time available: 5 minutes**
→ Use [CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md)
- Focus on P1 and P2 items
- Use red flags checklist
- Copy-paste examples from templates section

**Time available: 15 minutes**
→ Also read [MAIS-SPECIFIC-PATTERNS.md](./MAIS-SPECIFIC-PATTERNS.md)
- See real examples from MAIS codebase
- Understand why each pattern matters
- Recognize patterns in new code

**Time available: 1 hour**
→ Read all three documents
- [CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md) - Patterns
- [MAIS-SPECIFIC-PATTERNS.md](./MAIS-SPECIFIC-PATTERNS.md) - Real examples
- [CODE-REVIEW-PREVENTION-STRATEGIES.md](./CODE-REVIEW-PREVENTION-STRATEGIES.md) - Deep dive

### Scenario 2: You're writing a feature

**Before committing:**
1. Check [CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md) sections 1-5
2. Verify no red flags in your code
3. Add copy-paste templates where needed

**Before creating PR:**
1. Run the [CODE-REVIEW-PREVENTION-STRATEGIES.md](./CODE-REVIEW-PREVENTION-STRATEGIES.md) section 6 checklist
2. Check TypeScript/lint: `npm run typecheck && npm run lint`
3. Test accessibility: Install axe DevTools and scan

### Scenario 3: You want to understand a pattern

**Use [MAIS-SPECIFIC-PATTERNS.md](./MAIS-SPECIFIC-PATTERNS.md)**
- Sections 1-7 show real examples with explanations
- Each section has "Code Review Checklist" subtasks
- See before/after comparisons

---

## Document Structure

```
CODE-REVIEW-QUICK-REFERENCE.md
├── 1-Minute Checks (duplication, performance, accessibility, etc.)
├── Copy-Paste Templates (ready to use)
├── Decision Trees (30-second diagrams)
├── Red Flags (during review)
└── 5-Point Review Checklist

MAIS-SPECIFIC-PATTERNS.md
├── 1. Next.js Multi-Page Tenant Storefronts
├── 2. Tenant Data Fetching with Cache
├── 3. Error Boundaries for Dynamic Routes
├── 4. Form Submission with Cleanup
├── 5. Formatting Utilities
├── 6. Memoization for Navigation
├── 7. Domain Parameter Validation
└── Pattern Summary Table

CODE-REVIEW-PREVENTION-STRATEGIES.md
├── 1. Code Duplication Prevention (Decision trees)
├── 2. Performance Optimization (useMemo, useCallback, cache())
├── 3. Accessibility Checklist (WCAG AA compliance)
├── 4. Error Handling Checklist (error.tsx patterns)
├── 5. Validation Checklist (Input validation patterns)
├── 6. Code Review Checklist Template
└── 7. Prevention Pattern Library
```

---

## Key Files Referenced

### MAIS Codebase
- `apps/web/src/lib/format.ts` - formatPrice utility
- `apps/web/src/lib/tenant.ts` - Data fetching with cache()
- `apps/web/src/lib/packages.ts` - Tier ordering utility
- `apps/web/src/components/tenant/navigation.ts` - NAV_ITEMS config
- `apps/web/src/components/tenant/TenantNav.tsx` - Navigation component
- `apps/web/src/app/t/_domain/error.tsx` - Error boundary pattern
- `apps/web/src/app/t/[slug]/(site)/contact/ContactForm.tsx` - Form cleanup pattern

### Project Documentation
- `CLAUDE.md` - Project guidelines and patterns
- `apps/web/README.md` - Next.js architecture guide
- `docs/design/BRAND_VOICE_GUIDE.md` - UI/UX standards

---

## Frequently Asked Questions

### Q: Which document should I print?
**A:** Print [CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md) and post it at your desk.

### Q: How do I know if code is "ready for review"?
**A:** It passes all 5 checks in [CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md) section "5-Point Review Checklist"

### Q: I found a pattern not in these docs. What do I do?
**A:** Document it! Add to [MAIS-SPECIFIC-PATTERNS.md](./MAIS-SPECIFIC-PATTERNS.md) with:
1. Real example from codebase
2. Before/after comparison
3. Code review checklist
4. Commit message: `docs: add [pattern-name] code review pattern`

### Q: Which issues are most important to catch?
**A:** In order:
1. P1 (Security) - Duplicate IDs, nested main elements, validation
2. P2 (Performance/UX) - Code duplication, missing optimizations
3. P3 (Polish) - JSDoc comments, animations

### Q: How long should code review take?
**A:**
- 5 min: Quick check with CODE-REVIEW-QUICK-REFERENCE.md
- 15 min: Medium review with MAIS-SPECIFIC-PATTERNS.md
- 30+ min: Thorough review reading all details

### Q: What if the PR has code we already identified?
**A:** Reference the specific finding! Example:
> "This has the same code duplication as Finding #3 (formatPrice). Extract to `lib/format.ts` and import in both places."

---

## Integration with CI/CD

### Pre-commit (Local)
```bash
# Run checklist before pushing
npm run typecheck
npm run lint
npm run format:check

# Manual check:
# 1. Open CODE-REVIEW-QUICK-REFERENCE.md
# 2. Run through P1/P2 checklist
# 3. Verify no red flags
```

### PR Review (CI)
```bash
# Reviewer uses:
# 1. CODE-REVIEW-QUICK-REFERENCE.md (5 min scan)
# 2. MAIS-SPECIFIC-PATTERNS.md (detailed patterns)
# 3. CODE-REVIEW-PREVENTION-STRATEGIES.md (deep analysis)
```

### Post-merge (Documentation)
If new patterns found:
```bash
# Add to MAIS-SPECIFIC-PATTERNS.md
# Commit as: docs: add [pattern-type] to code review guide
# Create PR to update all three documents
```

---

## Metrics & Tracking

### Code Review Finding Categories
- **Code Duplication:** 3 findings (formatPrice, navigation, tier order)
- **Performance:** 4 findings (cache, useMemo, useCallback, AbortController)
- **Accessibility:** 4 findings (duplicate IDs, nested mains, aria-current, contrast)
- **Error Handling:** 1 finding (missing error.tsx)
- **Validation:** 2 findings (domain validation, parameter checking)
- **Other:** 1 finding (broken navigation links)

### Origin of Findings
**Source:** PR #18 (tenant multi-page sites)
**Commits:**
- b16379a - P1 accessibility fixes (2 items)
- 661d464 - P2/P3 fixes (15 items)

### Severity Breakdown
- **P1 (Critical):** 2 items
- **P2 (Important):** 11 items
- **P3 (Nice to have):** 2 items

---

## Version History

| Date | Version | Changes | Link |
|------|---------|---------|------|
| 2025-12-25 | 1.0 | Initial release | [Commit 661d464](https://github.com/...661d464) |

---

## How to Contribute

Found a pattern that should be documented?

1. Create issue: `Code review guide: add [pattern-type]`
2. Add to appropriate document:
   - Quick reference → CODE-REVIEW-QUICK-REFERENCE.md
   - Real example → MAIS-SPECIFIC-PATTERNS.md
   - Deep dive → CODE-REVIEW-PREVENTION-STRATEGIES.md
3. Commit message: `docs: add [pattern-type] to code review guides`

---

## Support & Questions

**Q: The checklist missed something in my PR**
→ Add it to [MAIS-SPECIFIC-PATTERNS.md](./MAIS-SPECIFIC-PATTERNS.md) and document why

**Q: I don't understand a pattern**
→ Read the corresponding section in [CODE-REVIEW-PREVENTION-STRATEGIES.md](./CODE-REVIEW-PREVENTION-STRATEGIES.md)

**Q: The template code doesn't work**
→ Compare with real implementation in [MAIS-SPECIFIC-PATTERNS.md](./MAIS-SPECIFIC-PATTERNS.md)

---

## Next Steps

1. **Today:** Print [CODE-REVIEW-QUICK-REFERENCE.md](./CODE-REVIEW-QUICK-REFERENCE.md) and post at desk
2. **This week:** Use in first PR review, note any issues
3. **This month:** Read all three documents in depth
4. **Ongoing:** Add new patterns as you discover them

---

**Created:** 2025-12-25
**Based on:** Commit 661d464 (PR #18: 15 code review findings)
**Status:** Active - Used in production code reviews
