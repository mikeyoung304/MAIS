---
title: PR #12 Prevention Strategies - Complete Index
category: prevention
tags: [index, pr-12, react-hooks, accessibility, quick-reference]
priority: P0
---

# PR #12 Prevention Strategies - Complete Index

Comprehensive documentation for preventing the 5 critical issues found in PR #12 review.

---

## Issues Summary

| #   | Issue                    | WCAG  | Severity | Detection    | Prevention                                |
| --- | ------------------------ | ----- | -------- | ------------ | ----------------------------------------- |
| 1   | Missing `useCallback`    | N/A   | High     | ESLint       | Wrap all callbacks in `useCallback`       |
| 2   | Missing `useEffect` deps | N/A   | High     | ESLint       | Add all functions to dependency array     |
| 3   | No focus indicators      | 2.4.7 | Critical | Keyboard Tab | Add `focus-visible:ring-*` classes        |
| 4   | No state indicators      | 1.3.1 | High     | Visual       | Add rotating icon to collapsibles         |
| 5   | Event propagation        | N/A   | High     | Functional   | Add `stopPropagation()` to nested buttons |

---

## Documentation Structure

### 1. **START HERE** - Quick Reference (5 minutes)

📄 **File:** [`PR-12-QUICK-REFERENCE.md`](./PR-12-QUICK-REFERENCE.md)

**Best for:** Everyone, every day

**Contents:**

- The 5 issues at a glance
- Quick pattern for each issue
- Copy-paste checklist
- Common mistakes
- Grep commands for self-review

**Read time:** 5 minutes

**When to use:** Before every commit, print and pin!

---

### 2. **Full Guide** - Complete Prevention Strategy (30 minutes)

📄 **File:** [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)

**Best for:** Engineers learning patterns, tech leads planning

**Contents:**

- Deep dive on each issue
- Pattern recognition
- Real examples from PR #12 fixes
- Detection rules
- Code review checklist
- Testing strategies
- Common mistakes explained
- WCAG standards details

**Read time:** 30 minutes

**When to use:** During onboarding, when implementing new patterns

**Sections:**

1. Missing `useCallback` for Memoized Components
2. Missing `useEffect` Dependencies
3. Missing Keyboard Focus Indicators (WCAG 2.4.7)
4. Missing Visual State Indicators (WCAG 1.3.1)
5. Event Propagation Issues in Nested Elements

---

### 3. **Code Review & Pre-commit Checklists** (Variable)

📄 **File:** [`PR-12-CHECKLISTS.md`](./PR-12-CHECKLISTS.md)

**Best for:** Developers before commits, reviewers reviewing code

**Contents:**

- Pre-commit checklist (copy-paste ready)
- Code review checklist (4 phases)
- Common review comments (copy-paste)
- ESLint configuration
- Review workflow options
- Approval criteria

**Read time:** 2-20 minutes (quick scan to full review)

**When to use:**

- Developers: Before every commit
- Reviewers: While reviewing PRs

**Sections:**

- Pre-commit Checklist (7 categories)
- Code Review Checklist (4 phases)
- Common Review Comments
- Review Workflow Paths

---

### 4. **ESLint Rules & Configuration** (15 minutes)

📄 **File:** [`PR-12-ESLINT-RULES.md`](./PR-12-ESLINT-RULES.md)

**Best for:** DevOps/tech leads setting up automation, engineers understanding rules

**Contents:**

- Rules that catch issues automatically
- Complete ESLint configuration
- Individual rule explanations
- Fixing common errors
- CI/CD integration
- Troubleshooting guide

**Read time:** 15 minutes (10 min to implement, 5 min to understand)

**When to use:**

- Setting up ESLint for first time
- Adding rules to existing project
- Understanding why ESLint is complaining

**Sections:**

- Quick Start (4 steps)
- Individual Rules (5 rules explained)
- Complete Configuration Files
- Fixing Common Errors
- CI/CD Integration

---

## Quick Navigation by Use Case

### "I'm starting a shift"

→ Read: [`PR-12-QUICK-REFERENCE.md`](./PR-12-QUICK-REFERENCE.md) (5 min)

---

### "I'm committing code"

→ Use: Pre-commit Checklist from [`PR-12-CHECKLISTS.md`](./PR-12-CHECKLISTS.md) (2 min)

---

### "I'm reviewing a PR"

→ Use: Code Review Checklist from [`PR-12-CHECKLISTS.md`](./PR-12-CHECKLISTS.md) (15 min)

---

### "I don't understand why ESLint is complaining"

→ Read: [`PR-12-ESLINT-RULES.md`](./PR-12-ESLINT-RULES.md) (10 min)

---

### "I'm onboarding to the team"

→ Read in order:

1. [`PR-12-QUICK-REFERENCE.md`](./PR-12-QUICK-REFERENCE.md) (5 min)
2. [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md) (30 min)
3. [`PR-12-ESLINT-RULES.md`](./PR-12-ESLINT-RULES.md) (15 min)

**Total:** 50 minutes

---

### "I'm setting up ESLint for the project"

→ Read: [`PR-12-ESLINT-RULES.md`](./PR-12-ESLINT-RULES.md) (10 min)
→ Follow: Quick Start section (5 min)

---

### "I'm implementing a new component"

→ Check: Patterns section in [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
→ Reference: Quick Reference for each pattern

---

### "I need to explain this to my team"

→ Use: This index + Quick Reference + Checklist

---

## The 5 Issues Explained

### Issue #1: Missing useCallback

**Pattern:**

```typescript
// WRONG - Callbacks unwrapped
const handleEdit = async (pkg) => { ... };
return <Child onEdit={handleEdit} />;  // New reference every render

// RIGHT - Wrapped in useCallback
const handleEdit = useCallback(async (pkg) => { ... }, [deps]);
return <Child onEdit={handleEdit} />;
```

**Detection:**

- ESLint: `react-hooks/exhaustive-deps`
- Manual: Look for callbacks passed to child components

**Prevention:**

- Wrap all callbacks in `useCallback` immediately
- Include all dependencies in array
- ESLint will help catch missing deps

**Documents:**

- Full explanation: [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md#1`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- Quick pattern: [`PR-12-QUICK-REFERENCE.md#1`](./PR-12-QUICK-REFERENCE.md)
- Checklist: [`PR-12-CHECKLISTS.md#Phase-2`](./PR-12-CHECKLISTS.md)

---

### Issue #2: Missing useEffect Dependencies

**Pattern:**

```typescript
// WRONG - Missing dependency
useEffect(() => {
  loadData(); // Used but not in array
}, []);

// RIGHT - All dependencies included
useEffect(() => {
  loadData();
}, [loadData]); // Include all functions used
```

**Detection:**

- ESLint: `react-hooks/exhaustive-deps`
- Manual: Review all `useEffect` calls

**Prevention:**

1. Wrap functions in `useCallback`
2. Add them to `useEffect` dependency array
3. Let ESLint guide you

**Documents:**

- Full explanation: [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md#2`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- Quick pattern: [`PR-12-QUICK-REFERENCE.md#2`](./PR-12-QUICK-REFERENCE.md)
- Checklist: [`PR-12-CHECKLISTS.md#Phase-2`](./PR-12-CHECKLISTS.md)

---

### Issue #3: No Keyboard Focus Indicators (WCAG 2.4.7)

**Pattern:**

```typescript
// WRONG - No focus ring
<summary className="hover:bg-gray-100">Section</summary>

// RIGHT - Focus ring visible when tabbing
<summary className="hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2">
  Section
</summary>
```

**Detection:**

- Keyboard test: Tab through component, nothing visible? → Issue!
- Manual: Search for interactive elements without `focus-visible:`
- ESLint: `jsx-a11y/interactive-supports-focus` (warns)

**Prevention:**

- Add `focus-visible:ring-*` to all interactive elements
- Test with Tab key
- Verify focus ring is visible in all browsers

**WCAG:** 2.4.7 (Focus Visible - Level AA)

**Documents:**

- Full explanation: [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md#3`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- Quick pattern: [`PR-12-QUICK-REFERENCE.md#3`](./PR-12-QUICK-REFERENCE.md)
- Checklist: [`PR-12-CHECKLISTS.md#Phase-3`](./PR-12-CHECKLISTS.md)

---

### Issue #4: No Visual State Indicators (WCAG 1.3.1)

**Pattern:**

```typescript
// WRONG - No way to tell if open/closed
<details>
  <summary>Segment Name</summary>
  <div>Content</div>
</details>

// RIGHT - Chevron shows state
<details className="group">
  <summary>
    <ChevronRight className="w-5 h-5 transition-transform duration-200 group-open:rotate-90" />
    Segment Name
  </summary>
  <div>Content</div>
</details>
```

**Detection:**

- Visual test: Open/close accordion, can you tell if it's open? → No icon = issue
- Manual: Look for `<details>` elements without icons
- ESLint: No automatic detection (manual review)

**Prevention:**

- Add rotating `ChevronRight` icon to accordion summaries
- Use `group-open:rotate-90` for rotation
- Add `transition-transform duration-200` for smooth animation

**WCAG:** 1.3.1 (Info and Relationships - Level A)

**Documents:**

- Full explanation: [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md#4`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- Quick pattern: [`PR-12-QUICK-REFERENCE.md#4`](./PR-12-QUICK-REFERENCE.md)
- Checklist: [`PR-12-CHECKLISTS.md#Phase-3`](./PR-12-CHECKLISTS.md)

---

### Issue #5: Event Propagation in Nested Elements

**Pattern:**

```typescript
// WRONG - Button click toggles accordion too!
<summary>
  <span>Section Title</span>
  <Button onClick={handleDelete}>Delete</Button>
</summary>

// RIGHT - stopPropagation prevents toggle
<summary>
  <span>Section Title</span>
  <div onClick={e => e.stopPropagation()}>
    <Button onClick={handleDelete}>Delete</Button>
  </div>
</summary>
```

**Detection:**

- Functional test: Click button inside accordion
  - Expected: Button action only
  - Bug: Accordion toggles + button action
- Manual: Search for buttons in `<summary>` elements
- ESLint: `jsx-a11y/no-interactive-element-to-static-element` (warns)

**Prevention:**

- Wrap button containers with `onClick={e => e.stopPropagation()}`
- Test: Button click doesn't toggle accordion
- Test: Accordion header text does toggle accordion

**Documents:**

- Full explanation: [`PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md#5`](./PR-12-REACT-HOOKS-ACCESSIBILITY-PREVENTION.md)
- Quick pattern: [`PR-12-QUICK-REFERENCE.md#5`](./PR-12-QUICK-REFERENCE.md)
- Checklist: [`PR-12-CHECKLISTS.md#Phase-2`](./PR-12-CHECKLISTS.md)

---

## Implementation Checklist

### Week 1: Setup

- [ ] Review this index
- [ ] Read Quick Reference
- [ ] Install ESLint plugins (if not already)
- [ ] Update ESLint config
- [ ] Fix existing violations

### Week 2: Process

- [ ] Add checklist to PR template
- [ ] Train team on checklists
- [ ] Review 3 PRs using new checklists

### Week 3+: Continuous

- [ ] Use checklist before every commit
- [ ] Use checklist when reviewing PRs
- [ ] Keep rules enforced in CI/CD

---

## Key Takeaways

### Most Important

1. **All callbacks to children → wrap in `useCallback`**
2. **All functions in `useEffect` → add to dependency array**
3. **All interactive elements → add `focus-visible:ring-*`**
4. **All collapsibles → add rotating state icon**
5. **All nested buttons → add `stopPropagation()`**

### Time Investment

- Using checklist: 2-5 minutes per PR
- Fixing issues: 5-30 minutes per issue (more if discovered late)

### Payoff

- Prevents accessibility violations
- Prevents performance bugs
- Prevents event handling bugs
- ESLint catches most automatically

---

## Tool Reference

### ESLint Rules

- `react-hooks/rules-of-hooks` - Catches hook order violations
- `react-hooks/exhaustive-deps` - Catches missing dependencies
- `jsx-a11y/interactive-supports-focus` - Catches missing focus support
- `jsx-a11y/click-events-have-key-events` - Catches keyboard accessibility
- `jsx-a11y/no-static-element-interactions` - Catches bad interactive elements

### Browser Tools

- **WCAG Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **WAVE Extension:** https://wave.webaim.org/extension/
- **DevTools (Chrome):** F12 → Elements → focus inspection
- **Screen Reader:** NVDA (free), JAWS, VoiceOver

---

## Common Questions

### Q: Do I need to wrap ALL functions in useCallback?

**A:** Only if:

- Function is passed to a child component as a prop
- Child component is memoized (React.memo, memo())
- Function would be called in useEffect

Otherwise, it's not necessary (but not harmful either).

---

### Q: What's the right dependency array?

**A:** Include every value that:

- Is used in the hook body
- Comes from outside the hook
- Is not a constant

Examples:

- Variables from props → include
- Variables from state → include
- Local constants → don't include
- Built-in functions (Math.max) → don't include

---

### Q: Why do I need focus indicators?

**A:** ~15-20% of users navigate with keyboard only:

- Power users who prefer keyboard
- Screen reader users
- Mobility-impaired users
- Touch-only users in some cases

Without focus indicators, they can't use your app.

---

### Q: Why do I need state indicators?

**A:** Users need to know the state of collapsibles:

- Is this section open or closed?
- Can I expand this section?
- What will happen if I click?

Without visual indicators, it's confusing.

---

### Q: What about suppressing ESLint rules?

**A:** Don't. If ESLint complains, there's usually a real issue.

If you must suppress (very rare):

```typescript
// eslint-disable-line react-hooks/exhaustive-deps  // Reason why
```

But fix the code instead.

---

## References

### React Documentation

- [useCallback](https://react.dev/reference/react/useCallback)
- [useEffect](https://react.dev/reference/react/useEffect)
- [Rules of Hooks](https://react.dev/warnings/invalid-hook-call-warning)

### WCAG Standards

- [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
- [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)

### ESLint Plugins

- [eslint-plugin-react-hooks](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)

### Tailwind CSS

- [Focus Styles](https://tailwindcss.com/docs/hover-focus-and-other-states#focus)
- [Group Modifier](https://tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-parent-state)

---

## Related Prevention Documents

- [Comprehensive Prevention Strategies](./COMPREHENSIVE-PREVENTION-STRATEGIES.md) - Broader prevention strategy
- [Prevention Quick Reference](./PREVENTION-QUICK-REFERENCE.md) - General quick ref
- [Component Duplication Prevention](./COMPONENT-DUPLICATION-PREVENTION.md) - Related UI patterns

---

## Document Status

| Document          | Status    | Last Updated | Maintainer       |
| ----------------- | --------- | ------------ | ---------------- |
| Index (this file) | ✅ Active | 2025-12-01   | Frontend Team    |
| Quick Reference   | ✅ Active | 2025-12-01   | Frontend Team    |
| Full Guide        | ✅ Active | 2025-12-01   | Frontend Team    |
| Checklists        | ✅ Active | 2025-12-01   | Code Review Team |
| ESLint Rules      | ✅ Active | 2025-12-01   | DevOps Team      |

**All documents derived from PR #12 issues and fixes.**

**Next review:** 2025-12-15

---

## How to Use These Docs

1. **Bookmark this page** - It's your navigation hub
2. **Print Quick Reference** - Pin to your desk
3. **Share Checklists** - Add to PR template
4. **Review Full Guide** - During onboarding
5. **Reference ESLint Rules** - When setting up linting

---

**Version:** 1.0

**Created:** 2025-12-01

**Based on:** PR #12 code review findings (commit c763cf0)

**Questions?** Check related documents or ask in #engineering
