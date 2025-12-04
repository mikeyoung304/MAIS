# Package Manager References Audit - Complete Index

**Generated:** November 18, 2025
**Canonical Package Manager:** pnpm
**Audit Scope:** Very Thorough
**Status:** COMPLETE

---

## Report Files

### 1. PACKAGE_MANAGER_AUDIT_SUMMARY.md (START HERE)

**Location:** `/Users/mikeyoung/CODING/MAIS/nov18scan/PACKAGE_MANAGER_AUDIT_SUMMARY.md`
**Length:** ~80 lines
**Purpose:** Executive summary with quick action items

**Contains:**

- High-level findings
- 3-tier priority ranking
- Simple change patterns
- Implementation roadmap
- Estimated effort breakdown

**Best for:** Managers, quick overview, decision makers

---

### 2. package-manager-references.md (DETAILED REFERENCE)

**Location:** `/Users/mikeyoung/CODING/MAIS/nov18scan/package-manager-references.md`
**Length:** 314 lines
**Purpose:** Complete detailed audit with file-by-file breakdown

**Contains:**

- Executive summary with context
- Critical issues requiring immediate fixes
- Inconsistent command references with line numbers
- Files already using pnpm correctly
- Deployment files analysis
- Legacy/archive references
- Detailed file-by-file breakdown
- Verification checklist
- Context analysis notes

**Sections:**

1. Executive Summary
2. Critical Issues (README monorepo statement)
3. Inconsistent References (CONTRIBUTING.md, DEVELOPING.md, README.md tables)
4. Correct References (global pnpm installation)
5. Deployment Files (already correct)
6. Summary Table (175+ issues categorized)
7. Recommendations (4 priority levels)
8. Context Analysis
9. Verification Checklist

**Best for:** Developers, reviewers, implementers

---

## Quick Reference

### Files to Update (Tier 1 - CRITICAL)

| File            | npm Refs | Time   | Action                |
| --------------- | -------- | ------ | --------------------- |
| README.md       | 18       | 15 min | Replace npm with pnpm |
| CONTRIBUTING.md | 27+      | 20 min | Replace npm with pnpm |
| DEVELOPING.md   | 11       | 10 min | Replace npm with pnpm |

### Files to Update (Tier 2 - HIGH)

| File                      | npm Refs | Time   | Action                |
| ------------------------- | -------- | ------ | --------------------- |
| TESTING.md                | 50+      | 30 min | Replace npm with pnpm |
| CODE_HEALTH_ASSESSMENT.md | 10+      | 15 min | Replace npm with pnpm |
| LAUNCH_ACTION_PLAN.md     | 5+       | 10 min | Replace npm with pnpm |

### Files Already Correct (No Changes)

- docs/operations/DEPLOY_NOW.md
- docs/operations/PRODUCTION_DEPLOYMENT_GUIDE.md
- docs/setup/LOCAL_TESTING_GUIDE.md
- docs/multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md
- docs/roadmaps/EMBEDDABLE_MULTI_TENANT_IMPLEMENTATION_PLAN.md

---

## Key Findings Summary

**Total Issues Found:** 175+ references
**Pattern Breakdown:**

- npm install (commands): 31+ instances
- npm run (commands): 100+ instances
- npm exec: 7+ instances
- npm install <pkg>: 40+ instances
- npm workspaces references: 5 instances
- npm 8+ prerequisite (KEEP): 1 instance
- npm install -g pnpm (KEEP): 4 instances

**Files Needing Updates:** 20+
**Files Already Correct:** 5
**Total Time to Fix:** ~2.5 hours

---

## What Changes Are Needed

### Simple Pattern Replacements

**Pattern 1: Installation**

```
Find:    npm install
Replace: pnpm install
(Keep:   npm install -g pnpm unchanged)
```

**Pattern 2: Script Execution**

```
Find:    npm run
Replace: pnpm run
```

**Pattern 3: Package Execution**

```
Find:    npm exec
Replace: pnpm exec
```

**Pattern 4: Adding Packages**

```
Find:    npm install <package>
Replace: pnpm add <package>
```

---

## Implementation Steps

### Step 1: Review (15 min)

- Read PACKAGE_MANAGER_AUDIT_SUMMARY.md
- Understand the three tiers of priority
- Note which files need updates

### Step 2: Fix Tier 1 (45 min)

- README.md (15 min)
- CONTRIBUTING.md (20 min)
- DEVELOPING.md (10 min)

### Step 3: Fix Tier 2 (1.5 hours)

- TESTING.md (30 min)
- CODE_HEALTH_ASSESSMENT.md (15 min)
- LAUNCH_ACTION_PLAN.md (10 min)
- Archive files (15 min)

### Step 4: Test (30 min)

- Run `pnpm install` locally
- Test all documented commands
- Verify no npm references remain
- Create verification PR

---

## Context Notes

### About package.json

The root `package.json` uses npm workspaces syntax. This is intentional and should NOT be changed:

1. pnpm can execute npm workspace commands
2. The monorepo is configured for npm workspaces compatibility
3. Only user-facing documentation should use pnpm commands

### About Global Installation

The instruction `npm install -g pnpm` is correct and should be kept:

1. This shows how to install pnpm as a global tool
2. It uses npm because that's the globally available package manager
3. This is standard and expected documentation

### About Prerequisites

The "npm 8+" prerequisite is correct and should be kept:

1. npm is needed to install pnpm globally
2. pnpm itself is installed via npm
3. This accurately reflects the actual prerequisites

---

## Files in This Audit

```
/Users/mikeyoung/CODING/MAIS/nov18scan/
├── PKG_MGR_AUDIT_INDEX.md              (THIS FILE)
├── PACKAGE_MANAGER_AUDIT_SUMMARY.md    (Executive summary)
└── package-manager-references.md       (Detailed report)
```

---

## How to Use These Reports

### For Decision Makers

1. Read this index file (you're doing it now)
2. Read PACKAGE_MANAGER_AUDIT_SUMMARY.md
3. Allocate ~2.5 hours for implementation

### For Implementers

1. Start with PACKAGE_MANAGER_AUDIT_SUMMARY.md for priorities
2. Reference package-manager-references.md for specific line numbers
3. Use the pattern replacements section above
4. Follow the verification checklist from detailed report

### For Reviewers

1. Use package-manager-references.md detailed tables
2. Verify each file against the specific line numbers listed
3. Ensure all patterns are correctly replaced
4. Check that exceptions (npm install -g pnpm) are preserved

---

## Key Takeaways

1. **Scope is Clear:** 175+ references across 20+ files
2. **Effort is Manageable:** ~2.5 hours for complete update
3. **Pattern is Consistent:** Simple find-replace operations
4. **Exceptions are Few:** Only 5 items to keep unchanged
5. **Files are Identified:** Every file needing changes is listed with line numbers

---

## Questions?

Refer to the detailed report for:

- Specific line numbers and context
- File-by-file breakdowns
- Verification checklist
- Implementation notes

**Main Report:** `/Users/mikeyoung/CODING/MAIS/nov18scan/package-manager-references.md`
