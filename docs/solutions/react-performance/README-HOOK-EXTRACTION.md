# React Hook Extraction Prevention Strategies

## Quick Navigation

### For Different Roles

#### 👨‍💻 Frontend Developer - Extracting a Hook?

**Start Here:** [REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md](./REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md) (5-10 min)

1. Check 30-second decision tree
2. Choose your hook pattern
3. Copy code template
4. Write tests (80%+ coverage)
5. Submit PR

### 👀 Code Reviewer - Reviewing Hook Extraction?

**Start Here:** [HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md](./HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md)

Use the 11-point checklist:
1. Hook structure
2. State management
3. Effects & callbacks
4. Performance
5. Error handling
6. Testing
7. Component integration
8. Documentation
9. Security
10. Integration
11. Final approval

### 🏗️ Tech Lead - Setting Standards?

**Start Here:** [REACT-HOOK-EXTRACTION-PREVENTION.md](./REACT-HOOK-EXTRACTION-PREVENTION.md) (comprehensive)

Read all 8 parts:
1. Code review checklist (when to extract)
2. Warning signs for code reviews
3. Testing requirements
4. Hook implementation patterns
5. ESLint rules
6. Full code review checklist
7. Decision tree
8. Common mistakes

---

## Document Overview

| Document | Purpose | Length | Audience |
|----------|---------|--------|----------|
| [REACT-HOOK-EXTRACTION-PREVENTION.md](./REACT-HOOK-EXTRACTION-PREVENTION.md) | Comprehensive implementation guide | 1,357 lines | Engineers, Tech Leads |
| [REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md](./REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md) | Quick reference for daily dev | 425 lines | All engineers (print & pin!) |
| [HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md](./HOOK-EXTRACTION-CODE-REVIEW-CHECKLIST.md) | PR review guide with templates | 668 lines | Code reviewers |
| [HOOK-EXTRACTION-IMPLEMENTATION-SUMMARY.md](./HOOK-EXTRACTION-IMPLEMENTATION-SUMMARY.md) | Integration & rollout guide | 300 lines | Tech leads, Managers |

---

## What You'll Learn

### When to Extract Hooks

- ✅ 6+ useState calls → Manager hook
- ✅ 3+ useEffect calls → Consolidate to hook
- ✅ API calls mixed with UI → Data fetching hook
- ✅ 200+ line component → Extract business logic
- ✅ Reusable in 2+ components → Extract to hook
- ✅ Hard to test without rendering → Extract to hook

### Hook Patterns

1. **Manager Hook** - State + actions (useRemindersManager)
2. **Data Fetching Hook** - Load data with effects (useDashboardData)
3. **Form State Hook** - Complex form with validation (useCalendarConfigManager)
4. **Computed Value Hook** - Memoized calculations (useBookingTotal)

### Testing Requirements

- ✅ Test file co-located: `hooks/use{Feature}.test.ts`
- ✅ Coverage >= 80%
- ✅ Test categories: init, actions, errors, edge cases
- ✅ Proper async patterns: renderHook, waitFor, act

### Code Review Standards

11-point review system covering:
- Hook structure (files, types, documentation)
- State management (organization, semantics)
- Performance (memoization, optimization)
- Testing (coverage, quality, patterns)
- Component integration (simplification, clarity)

---

## Real Examples in MAIS

### useRemindersManager
Location: `client/src/features/tenant-admin/TenantDashboard/hooks/useRemindersManager.ts`
Pattern: Manager hook (state + actions)
Size: ~120 lines
Component: RemindersCard (~80 lines)

**What it does:**
```typescript
const manager = useRemindersManager();
// ← Manages: status, loading, error, processing
// ← Actions: fetchStatus(), handleProcessReminders()
```

### useCalendarConfigManager
Location: `client/src/features/tenant-admin/TenantDashboard/hooks/useCalendarConfigManager.ts`
Pattern: Complex form state hook
Size: ~300 lines
Component: CalendarConfigCard

**What it does:**
```typescript
const manager = useCalendarConfigManager();
// ← Manages: form state, dialogs, file uploads, validation
// ← Actions: handleFileUpload(), handleSaveConfig(), handleDeleteConfig()
```

### useDashboardData
Location: `client/src/features/tenant-admin/TenantDashboard/useDashboardData.ts`
Pattern: Data fetching hook with parallel loading
Size: ~150 lines
Component: TenantDashboard

**What it does:**
```typescript
const { packages, segments, grouped, isLoading } = useDashboardData(activeTab);
// ← Loads packages & segments in parallel
// ← Provides grouped view with useMemo
// ← Reusable across multiple components
```

---

## Quick Checklist

### Before Extracting

- [ ] Component has 6+ useState OR 3+ useEffect OR 200+ lines OR API calls
- [ ] Logic will be tested independently
- [ ] Hook will be 30+ lines (not over-extraction)
- [ ] Chosen pattern matches use case

### While Extracting

- [ ] Hook file: `hooks/use{Feature}{Manager|State}.ts`
- [ ] Return type: `Use{Feature}Result` interface
- [ ] All callbacks: wrapped in useCallback
- [ ] All dependencies: complete (ESLint passes)
- [ ] All state: grouped by concern
- [ ] All errors: handled with clear messages
- [ ] JSDoc: comment added

### After Extracting

- [ ] Tests: 80%+ coverage in .test.ts file
- [ ] Component: simplified 50%+ lines
- [ ] ESLint: passes (npm run lint)
- [ ] No: API calls, state management, or business logic in component
- [ ] Only: UI rendering in component

### Before PR

- [ ] Code review checklist: reviewed
- [ ] Tests: passing locally
- [ ] Coverage: 80%+ verified
- [ ] Component: readable in 30 seconds

---

## Common Mistakes to Avoid

### ❌ Over-Extraction
```typescript
// DON'T extract simple toggles
function useToggle() {
  const [value, setValue] = useState(false);
  return [value, () => setValue(!value)];
}
```

### ❌ Missing Dependencies
```typescript
// DON'T forget dependencies in useEffect
useEffect(() => {
  loadData();  // ← loadData not in deps
}, [activeTab]); // ❌ ESLint warning
```

### ❌ Not Memoizing Callbacks
```typescript
// DON'T recreate callbacks every render
const fetch = async () => { ... };  // ❌ New function every render
useEffect(() => { fetch(); }, [fetch]); // ❌ Infinite loop!
```

### ❌ Missing Tests
```typescript
// DON'T extract without testing
export function useHook() { ... }
// ❌ No test file!
```

---

## Next Steps

### 1. Read (5-10 min)
- Quick Reference: [REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md](./REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md)

### 2. Practice
- Identify component needing extraction
- Choose pattern from comprehensive guide
- Follow implementation pattern
- Write tests using template

### 3. Review
- Use Code Review Checklist for your own code
- Ask reviewer to use checklist too

### 4. Share
- Print quick reference
- Add code review checklist to PR template
- Enable ESLint rules

---

## Related Docs

- **Prevention Index:** Navigate to all prevention strategies
- **React Memoization:** useCallback, useMemo, React.memo patterns
- **Performance Review:** React hooks performance patterns
- **UI Patterns:** AlertDialog, audit logging, accessibility

---

## Questions?

### "Should I extract this component?"
→ Check 30-second decision tree in Quick Reference

### "How do I test this hook?"
→ See Testing Requirements section in Comprehensive Guide

### "What pattern should I use?"
→ See Hook Implementation Patterns (Part 4) in Comprehensive Guide

### "How do I review this PR?"
→ Use Code Review Checklist with templates

---

## Key Takeaway

**Extract hooks when:** Components have complex state (6+ useState), multiple effects (3+ useEffect), API calls, or exceed 200 lines.

**How to extract:** Choose a pattern (Manager/Fetch/Form/Computed), follow the template, write tests (80%+), simplify component.

**Always:** Test thoroughly, memoize callbacks, complete dependencies, document with JSDoc.

---

**Last Updated:** 2025-12-05
**Status:** Active
**Version:** 1.0

Print & keep nearby: [REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md](./REACT-HOOK-EXTRACTION-QUICK-REFERENCE.md)
