---
title: 'ESM/CJS Module Compatibility - Implementation Summary'
slug: esm-cjs-implementation-summary
category: prevention
tags: [modules, esm, cjs, summary, implementation-guide, architecture]
created: 2025-11-29
---

# ESM/CJS Module Compatibility - Implementation Summary

This document summarizes the complete ESM/CJS module compatibility prevention system created for MAIS.

---

## What Problem Does This Solve?

**Challenge:** MAIS runs on Node.js 25 with tsx in pure ESM mode (`"type": "module"`). When importing CommonJS (CJS) packages like `file-type` v16, errors like "Cannot find module" occur without special handling.

**Solution:** A comprehensive prevention system with checklists, best practices, testing strategies, and alternatives guide.

---

## Documents Created

### 1. ESM_CJS_COMPATIBILITY_INDEX.md

**Purpose:** Central index and navigation guide
**Audience:** Developers starting work on module imports
**Key Sections:**

- Quick prevention checklist
- Current module compatibility status table
- Key concepts explained
- Common issues and solutions
- Decision tree for pattern selection

**When to Use:**

- First time working with module imports
- Need overview of ESM/CJS in this project
- Looking for document you need

---

### 2. ESM_CJS_COMPATIBILITY_PREVENTION_CHECKLIST.md

**Purpose:** Step-by-step checklist for adding new npm packages
**Audience:** Developers adding new dependencies
**Key Sections:**

- Pre-installation investigation (5 minutes)
- Package metadata analysis
- Dual package hazard prevention
- Import pattern selection
- Risk assessment matrix
- Post-installation verification

**When to Use:**

- Before running `npm install`
- Evaluating whether to add a new package
- Troubleshooting module compatibility issues

**Real Example:** Shows how to evaluate `file-type` v16 vs v17+

---

### 3. ESM_CJS_CODE_REVIEW_CHECKLIST.md

**Purpose:** Code review items for verifying module compatibility
**Audience:** Code reviewers during PR reviews
**Key Sections:**

- Import pattern classification
- Package.json verification
- Type safety verification
- Comment documentation requirements
- Centralized import patterns
- Testing verification (unit, integration, E2E)
- Build verification
- Common issues to look for
- Review decision tree
- Example review comments

**When to Use:**

- Reviewing PR with new imports
- Checking if CJS import has proper comment
- Verifying tests cover module usage
- Catching module compatibility issues before merge

---

### 4. ESM_CJS_BEST_PRACTICES.md

**Purpose:** Implementation patterns for handling different module types
**Audience:** Developers implementing module imports
**Key Sections:**

- Pattern 1: Direct Imports (ESM-native)
- Pattern 2: createRequire (CJS-only)
- Pattern 3: Dynamic Import (Lazy loading)
- Pattern 4: Conditional Imports (Future-proofing)
- Pattern 5: Dependency Injection
- Migration patterns (CJS → ESM)
- Error handling patterns
- Performance considerations
- Testing patterns

**When to Use:**

- Actually writing import statements
- Designing module architecture
- Setting up dependency injection
- Planning for future upgrades

**Real Example:** Complete `file-type` implementation showing all patterns

---

### 5. ESM_CJS_TESTING_RECOMMENDATIONS.md

**Purpose:** Testing strategies for module compatibility
**Audience:** QA engineers and developers
**Key Sections:**

- Unit testing CJS imports
- Integration testing with CJS packages
- E2E testing with Playwright
- Build verification tests
- Module compatibility verification
- CI configuration
- Common test failures and solutions

**When to Use:**

- Writing tests for code using CJS packages
- Verifying new packages work correctly
- Setting up CI/CD pipeline
- Debugging test failures

**Real Examples:**

- Unit tests for file-type adapter
- Integration tests with database
- E2E tests for user file upload
- Build verification scripts

---

### 6. ESM_CJS_ALTERNATIVES_GUIDE.md

**Purpose:** Decision framework for dealing with CJS packages
**Audience:** Tech leads and architects
**Key Sections:**

- Option 1: Upgrade to ESM version
- Option 2: Find ESM alternative package
- Option 3: Use dynamic import
- Option 4: Vendor the package
- Migration decision tree
- Tracking migration opportunities
- Case study: Successful upgrade

**When to Use:**

- CJS package causing problems
- Evaluating long-term maintenance
- Planning package upgrades
- Architecture discussions

---

### 7. ESM_CJS_QUICK_REFERENCE.md

**Purpose:** One-page cheat sheet for quick decisions
**Audience:** All developers (print and pin to desk!)
**Key Sections:**

- Step-by-step: Adding new package
- Common patterns at a glance
- Dangerous mistakes (with fixes)
- Decision tree
- Before commit checklist
- Quick fixes for errors
- Package status table

**When to Use:**

- Quick decision needed right now
- Can't remember the pattern
- Debugging "Cannot find module" error
- Before committing code

---

## How to Use These Documents

### Scenario 1: Adding a New NPM Package

1. **Start:** ESM_CJS_COMPATIBILITY_INDEX.md (2 min overview)
2. **Evaluate:** ESM_CJS_COMPATIBILITY_PREVENTION_CHECKLIST.md (5 min investigation)
3. **Implement:** ESM_CJS_BEST_PRACTICES.md (reference patterns)
4. **Test:** ESM_CJS_TESTING_RECOMMENDATIONS.md (verify it works)
5. **Verify:** ESM_CJS_QUICK_REFERENCE.md (before commit checklist)

**Total Time:** ~30 minutes

---

### Scenario 2: Code Review with Module Imports

1. **Review:** ESM_CJS_CODE_REVIEW_CHECKLIST.md (use checklist)
2. **Verify:** Pattern matches ESM_CJS_BEST_PRACTICES.md
3. **Check:** Tests follow ESM_CJS_TESTING_RECOMMENDATIONS.md
4. **Comment:** Reference specific patterns if needed

**Total Time:** ~5-10 minutes per PR

---

### Scenario 3: Package Causing Problems

1. **Diagnose:** ESM_CJS_QUICK_REFERENCE.md (common errors section)
2. **Understand:** ESM_CJS_COMPATIBILITY_INDEX.md (concepts)
3. **Decide:** ESM_CJS_ALTERNATIVES_GUIDE.md (should we upgrade?)
4. **Implement:** ESM_CJS_BEST_PRACTICES.md (if keeping package)

**Total Time:** ~20 minutes

---

### Scenario 4: Planning Architecture

1. **Reference:** ESM_CJS_BEST_PRACTICES.md (Pattern 5: Dependency Injection)
2. **Consider:** ESM_CJS_ALTERNATIVES_GUIDE.md (long-term strategy)
3. **Test:** ESM_CJS_TESTING_RECOMMENDATIONS.md (testing strategy)

**Total Time:** ~1 hour planning discussion

---

## Integration with Existing Processes

### Before Code Review

```bash
npm run typecheck  # Catches module issues early
npm test          # Tests module integration
```

### During Code Review

Use ESM_CJS_CODE_REVIEW_CHECKLIST.md as standard checklist

### In CLAUDE.md

Add reference section:

```markdown
## Module Compatibility

- **Pure ESM environment:** Node.js 25 with `"type": "module"`
- **CJS handling:** Use `createRequire` for CJS-only packages
- **Prevention guides:** See `docs/solutions/ESM_CJS_*.md`
- **Quick reference:** `docs/solutions/ESM_CJS_QUICK_REFERENCE.md`
```

### In PR Template

Add section:

```markdown
## Module Compatibility

- [ ] No new npm packages added (or pre-approved)
- [ ] All imports follow ESM/CJS patterns
- [ ] TypeScript compilation passes
- [ ] All tests pass
```

---

## Key Principles Embedded in Documents

### 1. Prevention Over Cure

- Pre-installation checklist prevents wrong packages
- Code review catches issues before merge
- Testing verifies compatibility early

### 2. Documentation

- Every CJS import must have a comment
- Comments explain why pattern is needed
- Links to package repos for future reference

### 3. Automation

- `npm run typecheck` catches module errors
- Tests verify actual module behavior
- CI/CD verifies build succeeds

### 4. Centralization

- CJS imports wrapped in adapters
- Single place to maintain type assertions
- Easier future upgrades

### 5. Testing Strategy

- Unit tests verify adapter functions
- Integration tests verify with database
- E2E tests verify full workflows
- Build tests verify production code

---

## Success Metrics

After implementing these prevention strategies:

✅ **Zero "Cannot find module" errors in production**
✅ **Code reviews catch module issues before merge**
✅ **All imports have proper TypeScript types**
✅ **Tests pass consistently (unit, integration, E2E)**
✅ **New developers can add packages confidently**
✅ **Module upgrades planned and documented**
✅ **Build succeeds consistently**
✅ **No duplicate module instances**

---

## Real-World Example: file-type v16

The entire system was designed around the real challenge of using `file-type` v16 (CJS-only) in pure ESM environment.

### Implementation Across Documents

1. **Index:** Documents current file-type status (v16 CJS, v17+ ESM)
2. **Prevention Checklist:** Shows how to evaluate file-type v16 vs v17
3. **Best Practices:** Shows actual `createRequire` pattern used
4. **Code Review:** Verifies file-type imports have proper comments
5. **Testing:** Shows tests for file-type magic byte detection
6. **Alternatives:** Mentions v17 ESM upgrade path
7. **Quick Ref:** Includes file-type in package status table

### Current Implementation

```typescript
// server/src/services/upload.service.ts
import { createRequire } from 'module';

// file-type v16 is CommonJS-only
// See: https://github.com/sindresorhus/file-type
// v17+ is ESM - consider upgrading in future
const require = createRequire(import.meta.url);
const fileType = require('file-type') as {
  fromBuffer: (buffer: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
};

export class UploadService {
  private async validateFile(file: UploadedFile): Promise<void> {
    const detected = await fileType.fromBuffer(file.buffer);
    // ... validation logic
  }
}
```

This implementation:

- ✅ Works in pure ESM environment
- ✅ Has TypeScript support via type assertion
- ✅ Is documented with comment and GitHub link
- ✅ Has centralized import (only in one place)
- ✅ Has comprehensive tests
- ✅ Has upgrade path documented (v17+)

---

## Maintenance Schedule

### Monthly

- [ ] Check ESM_CJS_QUICK_REFERENCE for outdated patterns
- [ ] Review "Package Status" table for new versions

### Quarterly

- [ ] Check alternatives for CJS packages (any upgrades available?)
- [ ] Review GitHub issues for "ESM" tags
- [ ] Update migration opportunities

### Annually

- [ ] Review which CJS packages can be upgraded
- [ ] Consider deprecating very old patterns
- [ ] Update Node.js version if needed

---

## Future Enhancements

### Automated Checking

```javascript
// npm script to verify CJS imports are in adapters only
"check:cjs": "eslint --rule 'no-restricted-syntax: [error, ...]' src/**/*.ts"
```

### Husky Pre-commit Hook

```bash
#!/bin/sh
# .husky/pre-commit

npm run typecheck || exit 1
npm test -- --bail || exit 1
npm run check:cjs || exit 1
```

### GitHub Actions

```yaml
# .github/workflows/module-check.yml
- name: Check module compatibility
  run: npm run check:cjs
```

---

## File Locations

All prevention documents are in:

```
docs/solutions/
├── ESM_CJS_COMPATIBILITY_INDEX.md                    # Start here
├── ESM_CJS_COMPATIBILITY_PREVENTION_CHECKLIST.md     # Add packages
├── ESM_CJS_CODE_REVIEW_CHECKLIST.md                  # Review code
├── ESM_CJS_BEST_PRACTICES.md                         # Implement code
├── ESM_CJS_TESTING_RECOMMENDATIONS.md                # Test code
├── ESM_CJS_ALTERNATIVES_GUIDE.md                     # Choose packages
├── ESM_CJS_QUICK_REFERENCE.md                        # Print & pin!
└── ESM_CJS_IMPLEMENTATION_SUMMARY.md                 # This file
```

---

## Quick Decision Tree

```
Need to...
│
├─ Add a new package?
│  └─ Go to: COMPATIBILITY_PREVENTION_CHECKLIST.md
│
├─ Write import code?
│  └─ Go to: BEST_PRACTICES.md
│
├─ Review code with imports?
│  └─ Go to: CODE_REVIEW_CHECKLIST.md
│
├─ Test module code?
│  └─ Go to: TESTING_RECOMMENDATIONS.md
│
├─ Fix CJS module error?
│  └─ Go to: QUICK_REFERENCE.md
│
├─ Decide on package strategy?
│  └─ Go to: ALTERNATIVES_GUIDE.md
│
└─ Understand ESM/CJS basics?
   └─ Go to: COMPATIBILITY_INDEX.md
```

---

## Closing Notes

This prevention system was created from real experience with MAIS:

- **Node.js 25** has excellent ESM support
- **tsx** treats all `.ts` files as ESM
- **file-type v16** is CJS-only (but v17+ is ESM)
- **createRequire** works great as a bridge
- **Comprehensive testing** catches issues early
- **Good documentation** prevents future confusion

The system scales from individual developers to teams:

- **Solo dev:** Print QUICK_REFERENCE.md, bookmark INDEX.md
- **Small team:** Use CODE_REVIEW_CHECKLIST.md in PRs
- **Growing team:** Integrate into CLAUDE.md and lint rules
- **Large team:** Automate checks in CI/CD pipeline

---

## Resources Created

| Document                | Pages  | Audience                   | Purpose                 |
| ----------------------- | ------ | -------------------------- | ----------------------- |
| INDEX                   | 4      | Everyone                   | Navigation & overview   |
| PREVENTION_CHECKLIST    | 8      | Developers adding packages | Step-by-step evaluation |
| CODE_REVIEW_CHECKLIST   | 10     | Code reviewers             | Verification items      |
| BEST_PRACTICES          | 12     | Developers implementing    | Patterns & examples     |
| TESTING_RECOMMENDATIONS | 8      | QA & developers            | Testing strategies      |
| ALTERNATIVES_GUIDE      | 8      | Tech leads                 | Package selection       |
| QUICK_REFERENCE         | 6      | All developers             | Print & pin             |
| **Total**               | **56** | **All roles**              | **Complete system**     |

---

## Next Steps for Your Project

1. **Commit these documents** to your repository
2. **Reference in CLAUDE.md** with link to INDEX.md
3. **Pin QUICK_REFERENCE.md** in Slack/Teams
4. **Use CODE_REVIEW_CHECKLIST.md** in PR template
5. **Reference in onboarding** for new developers
6. **Update "Package Status" table** as packages upgrade
7. **Review monthly** for new ESM versions available

---

**Created:** 2025-11-29
**Status:** Ready for production use
**Maintenance:** Monthly review recommended
**Last Updated:** 2025-11-29
