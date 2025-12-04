# Type Safety Prevention Strategy: Complete Guide

## Overview

This directory contains comprehensive prevention strategies for the ts-rest `any` type issue discovered in Commit 417b8c0.

**The Problem:** Code quality TODO #035 attempted to "fix" type safety by removing `any` types from ts-rest route handlers. This caused TS2345 build errors because ts-rest v3 has known type compatibility issues with Express 4.x/5.x.

**The Solution:** Instead of trying to fix the code, we've documented the limitation and created multiple layers of prevention to ensure this doesn't happen again.

---

## Quick Navigation

### For Different Roles

#### I'm a Developer

Start here: **[PREVENTION-ANY-TYPES-QUICK-REF.md](PREVENTION-ANY-TYPES-QUICK-REF.md)**

- 30-second decision tree
- Checklist of what to remove and what to keep
- Copy-paste quick answers

Then read: **[PREVENTION-TS-REST-ANY-TYPE.md](PREVENTION-TS-REST-ANY-TYPE.md)**

- Why ts-rest needs `any` types
- How to properly document limitations
- Pattern recognition tips

#### I'm Reviewing Code

Use: **[CODE-REVIEW-ANY-TYPE-CHECKLIST.md](CODE-REVIEW-ANY-TYPE-CHECKLIST.md)**

- Step-by-step review process
- Decision matrix
- Copy-paste review comments
- Red flags and green lights

#### I'm a Team Lead

Read: **[INCIDENT-REPORT-TODO-035.md](INCIDENT-REPORT-TODO-035.md)**

- What happened and why
- Timeline of events
- Prevention strategies implemented
- Recommendations for the team

---

## File Guide

### Core Prevention Documents

| File                                                                       | Size | Purpose                                                                                 | Read Time |
| -------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------- | --------- |
| **[PREVENTION-TS-REST-ANY-TYPE.md](PREVENTION-TS-REST-ANY-TYPE.md)**       | 12KB | Comprehensive guide to ts-rest limitation, when `any` is acceptable, patterns to follow | 15 min    |
| **[PREVENTION-ANY-TYPES-QUICK-REF.md](PREVENTION-ANY-TYPES-QUICK-REF.md)** | 4KB  | Quick decision tree, checklist, and rules                                               | 3 min     |
| **[CODE-REVIEW-ANY-TYPE-CHECKLIST.md](CODE-REVIEW-ANY-TYPE-CHECKLIST.md)** | 9KB  | Step-by-step code review process with examples                                          | 8 min     |
| **[INCIDENT-REPORT-TODO-035.md](INCIDENT-REPORT-TODO-035.md)**             | 8KB  | What happened, why, and what we learned                                                 | 10 min    |

### Supporting Materials

| File                             | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| `scripts/pre-push-type-check.sh` | Automated prevention - runs before git push        |
| `CLAUDE.md` (updated)            | Team guidelines updated with prevention strategies |

---

## The 60-Second Summary

**The Problem:**

- ts-rest v3 has type compatibility issues with Express 4.x/5.x
- Route handlers require `{ req: any }` due to middleware signature mismatch
- Code quality tools flag this as a "type safety issue"
- Attempting to replace `any` with `Request` causes TS2345 build errors

**The Solution:**

- Keep the `any` - it's required, not a bug
- Document why it exists (library limitation)
- Add type assertions after extraction for safety
- Create prevention strategies to stop future attempts

**What This Prevents:**

1. Build failures from removing required `any` types
2. Wasted time investigating "phantom type bugs"
3. Repeated attempts to "fix" the same issue
4. Loss of institutional knowledge about library limitations

---

## Three Layers of Prevention

### Layer 1: Inline Documentation

**Location:** `server/src/routes/index.ts`

```typescript
// ts-rest v3 has type compatibility issues with Express 4.x/5.x
// The `any` type for req is required - ts-rest internally handles request typing
// DO NOT attempt to replace with `Request` - will cause TS2345 build errors
// See: https://github.com/ts-rest/ts-rest/issues/...
createExpressEndpoints(Contracts, s.router(Contracts, {
  getPackages: async ({ req }: { req: any }) => {
```

**Purpose:** Explains limitation directly in the code where it exists

### Layer 2: Code Review Checklist

**Location:** `docs/solutions/CODE-REVIEW-ANY-TYPE-CHECKLIST.md`

When reviewing type changes:

1. Check if it's in ts-rest handlers
2. Verify library types exist before removal
3. Ensure validation follows `any` type
4. Confirm TODO is tracked if gradual migration

**Purpose:** Empowers reviewers to catch issues during review

### Layer 3: Automated Pre-Push Check

**Location:** `scripts/pre-push-type-check.sh`

Runs automatically before `git push`:

1. Detects ts-rest `req: any` removals
2. Warns about unsafe assertions
3. Runs TypeScript build check
4. Prevents problematic pushes

**Purpose:** Stops bad changes before they reach main branch

---

## How to Use These Documents

### When Adding a New `any` Type

1. Is it truly necessary? Check: [PREVENTION-ANY-TYPES-QUICK-REF.md](PREVENTION-ANY-TYPES-QUICK-REF.md)
2. Understand the context: [PREVENTION-TS-REST-ANY-TYPE.md](PREVENTION-TS-REST-ANY-TYPE.md)
3. Document it properly: Use the inline documentation pattern
4. Add to code review: Reference PREVENTION-ANY-TYPES-QUICK-REF.md

### When Removing an `any` Type

Use the decision tree from [PREVENTION-ANY-TYPES-QUICK-REF.md](PREVENTION-ANY-TYPES-QUICK-REF.md):

1. Is it in ts-rest? → Don't remove
2. Is it validated by schema? → Safe to remove
3. Can TS infer it? → Safe to remove
4. Is it blocking something? → Keep with TODO

### When Reviewing a PR with Type Changes

1. Open [CODE-REVIEW-ANY-TYPE-CHECKLIST.md](CODE-REVIEW-ANY-TYPE-CHECKLIST.md)
2. Go through Steps 1-6 in order
3. Use the decision matrix for your verdict
4. Copy-paste appropriate review comment

### When Onboarding New Developers

1. Point to [PREVENTION-ANY-TYPES-QUICK-REF.md](PREVENTION-ANY-TYPES-QUICK-REF.md) - quick overview
2. Have them read [PREVENTION-TS-REST-ANY-TYPE.md](PREVENTION-TS-REST-ANY-TYPE.md) - full understanding
3. Share [CODE-REVIEW-ANY-TYPE-CHECKLIST.md](CODE-REVIEW-ANY-TYPE-CHECKLIST.md) - for their first review
4. Reference [INCIDENT-REPORT-TODO-035.md](INCIDENT-REPORT-TODO-035.md) - understand what happened

---

## Key Principles

### 1. Not All `any` Types Are Bad

```typescript
// BAD: Unnecessarily loose type
const result: any = someFunction(); // Can be properly typed

// REQUIRED: Library limitation
const { req }: { req: any } = handler; // ts-rest needs this
```

### 2. Library Limitations Are Constraints

```
Code Quality Issue                Library Limitation
✅ Can be fixed in code          ❌ Cannot be fixed without library change
✅ Should be fixed                ❌ Should be documented & accepted
✅ Fixing improves system         ❌ Fixing breaks the system
```

### 3. Prevention Beats Reaction

```
Without Prevention                With Prevention
1. Issue discovered             1. Issue prevented
2. Investigate root cause      2. Team knows immediately
3. Revert change               3. Change never created
4. Document (maybe)            4. Already documented
5. Hope it doesn't happen again 5. Multiple layers stop recurrence
```

---

## Common Questions

### Q: Why not just upgrade ts-rest?

**A:** ts-rest v3 is the latest, and this is a known limitation with Express middleware typing. Upgrading to v4 would require testing entire API suite.

### Q: Can't we just type-ignore it?

**A:** We already handle it properly with type assertions after extraction. Documentation is better than ignoring.

### Q: What if TypeScript changes?

**A:** The approach (document + prevent attempts) works regardless. If TS changes and the `any` becomes removable, we'll know because the pre-push script will report success.

### Q: Should we open a GitHub issue with ts-rest?

**A:** One likely exists already. Check [ts-rest/ts-rest issues](https://github.com/ts-rest/ts-rest/issues) for "Express type" or similar.

---

## Maintenance & Updates

### When to Review These Documents

- After TypeScript updates
- When ts-rest releases new version
- When new `any` types are proposed
- During architecture review

### How to Update

1. Update the specific prevention document
2. Update inline code comments if relevant
3. Update CLAUDE.md if guidance changes
4. Update this README with link if creating new doc

### Deprecation

If ts-rest fixes the issue:

1. Test removing `any` types
2. Document the change
3. Update PREVENTION-TS-REST-ANY-TYPE.md to reflect history
4. Archive old issue

---

## References

### External

- **ts-rest GitHub:** [https://github.com/ts-rest/ts-rest](https://github.com/ts-rest/ts-rest)
- **Express Types:** [@types/express](https://npmjs.com/package/@types/express)

### Internal (MAIS)

- **CLAUDE.md:** Team guidelines with links to prevention strategies
- **server/src/routes/index.ts:** Route handlers with documented `any` types
- **scripts/pre-push-type-check.sh:** Automated prevention script

---

## Summary

This is comprehensive documentation for a single, clear principle:

**Some `any` types are library limitations, not code quality issues. Removing them breaks the build. Instead, document why they exist and prevent future attempts to remove them.**

Use these documents to:

1. Understand why `any` exists in ts-rest handlers
2. Prevent accidental removal of required `any` types
3. Distinguish real type safety issues from library constraints
4. Maintain consistent team practices around type safety

---

**Created:** 2025-12-02
**Based on:** Commit 417b8c0 - Fix for type safety regression
**Status:** Approved for team use
**Maintenance:** See CLAUDE.md for team guidelines
