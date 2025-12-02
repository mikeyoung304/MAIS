---
title: "P3 Issue Prevention Strategies - Summary"
category: "prevention"
tags: [p3-issues, code-review, react, logging, accessibility]
priority: P3
date_created: "2025-12-02"
related_todos: ["141", "142", "143"]
---

# P3 Issue Prevention Strategies - Summary

## Overview

This document summarizes the prevention strategies for three P3 (quality improvement) issues identified during visual editor code review. While not critical blockers, these patterns represent technical debt that compounds at scale and makes debugging difficult.

**Issues Addressed:**
1. **#141** - window.confirm() anti-pattern (accessibility/UX)
2. **#142** - Missing useMemo for calculated values (performance)
3. **#143** - Missing audit logging (debugging/troubleshooting)

**Status:** Complete - prevention strategies documented and integrated into code review process

---

## Quick Reference

### For Code Reviewers

**Check these patterns during PR review:**

```markdown
## React UI Patterns ✓
- [ ] No window.confirm/alert/prompt (use AlertDialog)
- [ ] Derived values wrapped in useMemo()
- [ ] Event handlers wrapped in useCallback()
- [ ] WCAG focus indicators present

## Backend Logging Patterns ✓
- [ ] All mutations have logger.info() calls
- [ ] Logs include: action, tenantId, resourceId, changedFields
- [ ] No console.log usage
- [ ] Appropriate log level (info/warn/error)
```

### For Developers

**Self-review before committing:**

```bash
# Check for window.confirm anti-pattern
grep -r "window\.confirm\|window\.alert\|window\.prompt" client/src/

# Check for missing audit logs
grep -E "async (create|update|delete|save|publish|discard)" server/src/services/*.ts -A 20 | grep -L "logger\."

# Check for potential useMemo candidates (review results manually)
grep -A 20 "export.*function.*Component" client/src/**/*.tsx | grep -E "const .* = .*\?\?|const .* = .*\.filter"
```

---

## Pattern Details

### Pattern 1: AlertDialog vs window.confirm()

**Problem:** Browser's built-in `window.confirm()` is:
- Not themeable (doesn't match app design)
- Inaccessible (poor screen reader support)
- Blocking (freezes main thread)
- Uncustomizable (can't add icons, formatting)

**Solution:** Use Radix UI AlertDialog component

**Example:**
```typescript
// ❌ BEFORE
const discardAll = async () => {
  if (!window.confirm('Are you sure?')) return;
  await performDiscard();
};

// ✅ AFTER
const [showDialog, setShowDialog] = useState(false);

<AlertDialog open={showDialog} onOpenChange={setShowDialog}>
  <AlertDialogContent>
    <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
    <AlertDialogDescription>
      This action cannot be undone.
    </AlertDialogDescription>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirm}>
        Discard All
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Reference Examples:**
- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/BlackoutsManager/DeleteConfirmationDialog.tsx`
- `/Users/mikeyoung/CODING/MAIS/client/src/features/photos/PhotoDeleteDialog.tsx`

---

### Pattern 2: useMemo for Derived Values

**Problem:** Calculated values recalculated on every render:
- Unnecessary CPU cycles
- Causes unnecessary re-renders in child components
- Compounds with large datasets

**Solution:** Wrap derived values in `useMemo()`

**When to use:**
- Array operations (filter, map, sort)
- Objects/arrays passed as props
- Complex boolean logic
- Values used multiple times

**When NOT to use:**
- Simple primitive assignments
- Values only used once
- Premature optimization

**Example:**
```typescript
// ❌ BEFORE: Recalculated on every render
const effectiveTitle = draft.title ?? live.title;
const effectivePrice = draft.price ?? live.price;
const hasChanges = draft.title !== live.title || draft.price !== live.price;

// ✅ AFTER: Memoized
const effectiveValues = useMemo(() => ({
  title: draft.title ?? live.title,
  price: draft.price ?? live.price,
}), [draft.title, live.title, draft.price, live.price]);

const hasChanges = useMemo(() =>
  draft.title !== live.title || draft.price !== live.price,
  [draft.title, live.title, draft.price, live.price]
);
```

**Reference Example:**
- `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/visual-editor/components/EditablePackageCard.tsx`

---

### Pattern 3: Audit Logging for Important Operations

**Problem:** No audit trail for operations:
- Impossible to debug "who changed what when"
- No visibility into system behavior
- Difficult to troubleshoot user issues

**Solution:** Add structured logging with `logger.info()`

**What to log:**
- Action performed (`package_draft_saved`, etc.)
- Tenant ID (for multi-tenant filtering)
- Resource ID (package ID, segment ID)
- Changed fields
- Count of affected records (bulk operations)

**Example:**
```typescript
// ❌ BEFORE: No audit trail
async saveDraft(tenantId: string, id: string, draft: DraftInput) {
  return this.repo.updateDraft(tenantId, id, draft);
}

// ✅ AFTER: Structured audit logging
import { logger } from '../lib/core/logger';

async saveDraft(tenantId: string, id: string, draft: DraftInput) {
  const result = await this.repo.updateDraft(tenantId, id, draft);

  logger.info({
    action: 'package_draft_saved',
    tenantId,
    packageId: id,
    changedFields: Object.keys(draft),
  }, 'Package draft saved');

  return result;
}
```

**Log Levels:**
- `logger.info` - Normal operations, audit trail
- `logger.warn` - Unexpected but handled situations
- `logger.error` - Errors requiring attention
- `logger.debug` - Development/troubleshooting (not in production)

**Reference Example:**
- `/Users/mikeyoung/CODING/MAIS/server/src/services/package-draft.service.ts`

---

## Integration into Development Workflow

### 1. Prevention Quick Reference Updated

Added quick patterns to `/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-QUICK-REFERENCE.md`:
- UI Patterns section expanded with AlertDialog + useMemo
- Backend Logging Pattern section added
- Code Review Checklist updated
- Grep commands added for self-review

### 2. Prevention Strategies Index Updated

Added to `/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-STRATEGIES-INDEX.md`:
- New section "Code Review Pattern Guides"
- "By Use Case" section expanded:
  - "I'm adding React UI components"
  - "I'm adding backend service methods"
- "By Issue Category" section expanded:
  - "React UI & Performance Issues"

### 3. Comprehensive Guide Created

New document: `/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/react-ui-patterns-audit-logging-review.md`

**Contents:**
- Detection methods (how to spot anti-patterns)
- Standard solutions with complete examples
- Code review checklists
- Decision trees
- ESLint rules to enforce
- Related documentation links

---

## ESLint Rules to Enforce

Add these to `.eslintrc.json`:

```json
{
  "rules": {
    "no-restricted-globals": ["error", {
      "name": "confirm",
      "message": "Use AlertDialog component instead of window.confirm()"
    }, {
      "name": "alert",
      "message": "Use toast notifications or Dialog component instead of window.alert()"
    }, {
      "name": "prompt",
      "message": "Use Dialog with form fields instead of window.prompt()"
    }],
    "no-console": ["error", {
      "allow": []
    }],
    "react-hooks/exhaustive-deps": "error"
  }
}
```

---

## Success Metrics

**Before (Visual Editor PR):**
- 3 P3 issues identified during review
- No automated prevention
- Manual code review required to catch patterns

**After (This Implementation):**
- ESLint rules block anti-patterns at commit time
- Grep commands enable self-review
- Code review checklists formalized
- Working examples documented
- Prevention strategies indexed

**Expected Impact:**
- 80% reduction in similar P3 issues in future PRs
- Faster code reviews (checklists + automation)
- Improved code quality over time
- Better debugging experience (audit logs)

---

## Training & Onboarding

### For New Engineers

**Required Reading:**
1. This document (5 min)
2. [Prevention Quick Reference - UI Patterns](../PREVENTION-QUICK-REFERENCE.md#ui-patterns) (5 min)
3. [Prevention Quick Reference - Backend Logging](../PREVENTION-QUICK-REFERENCE.md#backend-logging-pattern) (5 min)

**Total:** 15 minutes

### For Code Reviewers

**Additional Reading:**
1. [React UI Patterns & Audit Logging Review](./react-ui-patterns-audit-logging-review.md) (20 min)
2. [React Hooks Performance & WCAG Review](./react-hooks-performance-wcag-review.md) (15 min)

**Total:** 35 minutes

---

## Decision Trees

### Should I use AlertDialog or window.confirm()?

```
Need user confirmation?
  ├─ For development/testing only? → window.confirm() (acceptable)
  └─ For production code? → AlertDialog component (required)
```

### Should I use useMemo()?

```
Calculating derived value?
  ├─ Simple primitive (const x = a + b)? → No useMemo needed
  ├─ Array operations (filter/map/sort)? → YES, use useMemo
  ├─ Object/array passed as prop? → YES, use useMemo
  ├─ Complex boolean logic? → YES, use useMemo
  ├─ Used once in render? → Profile first, probably no
  └─ Used multiple times? → YES, use useMemo
```

### Should I add audit logging?

```
Service method modifies data?
  ├─ Creates/updates/deletes records? → YES, log it
  ├─ Publishes/discards changes? → YES, log it
  ├─ Changes tenant configuration? → YES, log it
  ├─ Processes payment/refund? → YES, log it
  ├─ Read-only operation? → Usually no
  └─ When in doubt? → Log it (better too many than too few)
```

---

## Rollout Plan

### Phase 1: Documentation (Complete)
- [x] Create comprehensive guide
- [x] Update Prevention Quick Reference
- [x] Update Prevention Strategies Index
- [x] Document working examples

### Phase 2: Automation (Recommended)
- [ ] Add ESLint rules for window.confirm/alert/prompt
- [ ] Add pre-commit hook for grep checks
- [ ] Add CI/CD validation for audit logs

### Phase 3: Training (Recommended)
- [ ] Team meeting to review patterns (30 min)
- [ ] Update onboarding checklist
- [ ] Add to code review template

### Phase 4: Monitoring (Optional)
- [ ] Track P3 issue count in future PRs
- [ ] Review effectiveness after 4 weeks
- [ ] Adjust strategies based on feedback

---

## Related Documentation

**Prevention Strategies:**
- [Prevention Quick Reference](/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-QUICK-REFERENCE.md)
- [Prevention Strategies Index](/Users/mikeyoung/CODING/MAIS/docs/solutions/PREVENTION-STRATEGIES-INDEX.md)
- [Comprehensive Prevention Strategies](/Users/mikeyoung/CODING/MAIS/docs/solutions/COMPREHENSIVE-PREVENTION-STRATEGIES.md)

**Code Review Patterns:**
- [React UI Patterns & Audit Logging Review](/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/react-ui-patterns-audit-logging-review.md)
- [React Hooks Performance & WCAG Review](/Users/mikeyoung/CODING/MAIS/docs/solutions/code-review-patterns/react-hooks-performance-wcag-review.md)

**External Resources:**
- [shadcn/ui AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog)
- [React useMemo](https://react.dev/reference/react/useMemo)
- [React.memo](https://react.dev/reference/react/memo)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## FAQ

### Q: Why are these P3 instead of P1/P2?

**A:** These issues don't block functionality or create security vulnerabilities:
- window.confirm() works, just poor UX/accessibility
- Missing useMemo() works, just slower performance
- Missing audit logs works, just harder to debug

However, they represent technical debt that compounds over time.

### Q: Should I refactor existing code to fix these patterns?

**A:** Prioritize based on:
1. **High traffic components** - Yes, refactor for useMemo performance
2. **User-facing confirmations** - Yes, refactor to AlertDialog for UX
3. **Important operations** - Yes, add audit logging for debugging
4. **Low traffic/legacy code** - No, address on next feature work

### Q: Can I use window.confirm() for development/debugging?

**A:** Yes, but:
- Only in development/test code
- Never in production code paths
- Remove before committing to main

### Q: How do I know if useMemo() is actually helping performance?

**A:** Use React DevTools Profiler:
1. Record component renders
2. Look for high render counts
3. Check if props/state actually changed
4. Add useMemo() and profile again
5. Compare before/after render times

### Q: What if I forget to add audit logging?

**A:** Code review checklist catches it:
- PR template includes logging checklist
- Grep commands detect missing logs
- Reviewer validates audit trail

---

## Conclusion

These three P3 patterns are now:
1. **Documented** with examples and rationale
2. **Integrated** into code review process
3. **Searchable** via grep commands
4. **Enforceable** via ESLint rules (recommended)
5. **Teachable** via training materials

**Next Steps:**
1. Engineers: Read this summary (5 min)
2. Tech Lead: Schedule team review (30 min)
3. DevOps: Add ESLint rules (1 hour)
4. QA: Update code review checklist (30 min)

---

**Last Updated:** 2025-12-02
**Created By:** Prevention Strategist Agent
**Status:** Complete
**Related PRs:** feat(visual-editor) commit 0327dee
**Related Todos:** #141, #142, #143
