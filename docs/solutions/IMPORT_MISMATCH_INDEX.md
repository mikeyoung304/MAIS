---
module: MAIS
date: 2025-12-31
problem_type: prevention_index
severity: P2
---

# Import Mismatch Prevention Strategy Index

> Comprehensive prevention strategies for the import mismatch bug pattern: singular vs plural, async/sync confusion, and naming convention inconsistencies.

---

## What Is an Import Mismatch?

A developer writes an import statement that references an export that doesn't exist:

```typescript
// ❌ ERROR: Cannot find name 'getItem'
import { getItem } from './repository';

// But the actual export is:
export const getItems = () => Item[]; // Plural, not singular
```

Common patterns:

1. **Singular vs Plural**: `getItem` vs `getItems`
2. **Prefix/Name Variation**: `appendEvent` vs `appendOnboardingEvent`
3. **Async vs Sync Confusion**: `getConfig` vs `getConfigAsync`

---

## Documents in This Strategy

### 1. [IMPORT_MISMATCH_PREVENTION.md](IMPORT_MISMATCH_PREVENTION.md)

**Full comprehensive guide (8 parts)**

The main prevention strategy document covering:

- **Part 1**: Pre-commit checks & IDE settings
  - ESLint rule configuration
  - Pre-commit hooks with `validate-imports.js`
  - VSCode settings for strict import validation

- **Part 2**: Code review checklist items
  - Import review template
  - Code review comment templates
  - When to request changes on imports

- **Part 3**: Naming convention guidelines
  - Array/collection naming rules
  - Async function naming (two approaches)
  - Domain-prefixed exports
  - Event naming conventions
  - Repository/service naming patterns

- **Part 4**: Testing patterns that catch mismatches
  - Import resolution tests
  - Singular vs plural validation tests
  - Type checking tests
  - Export discovery tests

- **Part 5**: Quick reference checklist
  - Pre-development checklist
  - During development checklist
  - Before commit checklist
  - Code review checklist
  - Common mistakes checklist

- **Part 6**: Automation via TypeScript configuration
  - Strict mode settings
  - Compiler options that catch import errors

- **Part 7**: Editor extensions for validation
  - VSCode extensions recommended
  - Custom keyboard shortcuts
  - Editor integration tips

- **Part 8**: Continuous integration setup
  - GitHub Actions workflow
  - Import validation in CI/CD

**When to use**: Reading this first time, implementing infrastructure, or understanding all aspects of import validation.

**Length**: ~700 lines, comprehensive coverage

---

### 2. [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md)

**Quick reference for daily use**

Condensed checklist for busy developers:

- Development checklist (before writing imports)
- Code review checklist (when reviewing PRs)
- Pre-commit checklist (what to run before pushing)
- Common mistakes table (quick reference)
- 30-second decision tree (for when unsure)
- One-line prevention rules
- Files to check when adding imports
- ESLint commands
- TypeScript commands
- IDE quick actions
- Test it checklist
- When you're stuck (troubleshooting)

**When to use**: Daily development, before committing code, during code reviews.

**Length**: ~300 lines, scannable format

**Best for**: Print and pin on your desk, or bookmark in browser.

---

### 3. [patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md](patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md)

**Concrete naming patterns with code examples**

Real-world examples from MAIS codebase:

- **Pattern 1**: Repository/data access layer
  - Collection methods (getAll, findMany)
  - Single item methods (getById, getBySlug)
  - Action methods (create, update, delete)
  - Import usage examples
  - Anti-patterns to avoid

- **Pattern 2**: Service layer methods
  - Query services (read operations)
  - Lifecycle services (create/update/delete)
  - Import usage examples

- **Pattern 3**: Agent tools (critical for tool naming)
  - Read tools (singular/plural)
  - Write tools (domain-prefixed)
  - Onboarding tools (domain-specific exports)
  - Import usage examples

- **Pattern 4**: Event names (domain-prefixed)
  - Event enum pattern
  - Domain scoping
  - Usage examples

- **Pattern 5**: Async/sync functions
  - Consistent async pattern (no suffix)
  - Explicit async suffix pattern (alternative)
  - Anti-pattern: inconsistent naming

- **Pattern 6**: Import statement consistency
  - Correct pattern example
  - Pre-import verification checklist

- **Real world example**: Tool naming before/after
  - Common mistakes in tool exports
  - Correct domain-prefixed naming

- **Validation checklist**: By pattern type

- **Refactoring checklist**: How to fix mismatches

- **Summary table**: Quick reference by type

**When to use**: When writing new exports, during code review of new features, when refactoring.

**Length**: ~600 lines, pattern-focused

**Best for**: Reference when implementing new services, tools, or domain models.

---

## Quick Start: Implementing These Strategies

### Option 1: Just Get Checklist (5 minutes)

1. Read: [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md)
2. Bookmark it
3. Use before commits and code reviews

### Option 2: Full Implementation (1 hour)

1. Read: [IMPORT_MISMATCH_PREVENTION.md](IMPORT_MISMATCH_PREVENTION.md) Part 1 & 2
2. Implement ESLint rules (Part 1, 15 min)
3. Add pre-commit hooks (Part 1, 10 min)
4. Run initial validation (Part 6, 5 min)
5. Review with team (Part 2, code review comments)

### Option 3: Comprehensive Understanding (2 hours)

1. Read [IMPORT_MISMATCH_PREVENTION.md](IMPORT_MISMATCH_PREVENTION.md) (all parts)
2. Read [patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md](patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md)
3. Run all tests from Part 4
4. Set up CI/CD from Part 8
5. Configure IDE from Part 7

---

## Using These in Different Scenarios

### Scenario 1: I'm Writing Code Right Now

1. Open [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md) - "Development Checklist"
2. Follow the checklist
3. Use Ctrl+Space autocomplete to verify exports exist
4. Before commit, run: `npm run typecheck`

### Scenario 2: I'm Reviewing a PR

1. Open [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md) - "Code Review Checklist"
2. Use the checklist to validate imports
3. Copy/paste code review comment template if issues found
4. Reference [patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md](patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md) for naming guidance

### Scenario 3: Import Error at Build Time

1. Open [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md) - "30-Second Decision Tree"
2. Follow the tree to find the issue
3. Reference [patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md](patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md) - "Quick Fix Table"
4. If still stuck, see "When You're Stuck" section in Quick Checklist

### Scenario 4: Setting Up New Project/Team

1. Read [IMPORT_MISMATCH_PREVENTION.md](IMPORT_MISMATCH_PREVENTION.md) Part 1
2. Implement ESLint rules and pre-commit hooks
3. Enable TypeScript strict mode (Part 6)
4. Share [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md) with team
5. Reference [patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md](patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md) for code style guide

---

## Prevention Layers (Implement in Order)

### Layer 1: IDE Intelligence (Free, 0 minutes)

- Use autocomplete: `import { [Ctrl+Space]` to verify exports
- Use "Go to Definition": F12 to check what's exported
- **Coverage**: Catches typos in names immediately

### Layer 2: TypeScript Compiler (Free, already have it)

- Enable `strict: true` in `tsconfig.json`
- Enable `noImplicitAny: true`
- **Coverage**: Catches unresolved imports before build

### Layer 3: ESLint Rules (15 minutes to set up)

- Install `eslint-plugin-import`
- Add `import/named: error` rule
- **Coverage**: Automated name matching validation

### Layer 4: Pre-Commit Hooks (30 minutes to set up)

- Add `validate-imports.js` script
- Configure Husky to run on commit
- **Coverage**: Blocks bad imports before pushing

### Layer 5: Test Suite (1 hour to set up)

- Add import resolution tests (Part 4)
- Add naming convention tests
- **Coverage**: Catches regressions in test suite

### Layer 6: Code Review (Ongoing, human review)

- Use Code Review Checklist (Part 2)
- Reference naming conventions document (Pattern doc)
- **Coverage**: Human verification and knowledge sharing

### Layer 7: CI/CD Checks (30 minutes to set up)

- GitHub Actions workflow
- Run TypeScript check on PR
- Run import tests on PR
- **Coverage**: Final verification before merge

---

## Key Prevention Principles

### 1. Naming Must Match Function Signature

```typescript
// Rule: Function name must tell you what it returns
export const getItems = () => Item[];     // ✅ Returns array, name is plural
export const getItem = () => Item | null; // ✅ Returns single, name is singular
export const getItem = () => Item[];      // ❌ Wrong: name/return mismatch
```

### 2. Use IDE Autocomplete Every Time

```typescript
// Always do this:
import { [Ctrl+Space] // See available exports
//         ^
//         Use autocomplete, don't guess

// Never do this:
import { guessMyExportName } // Hoping it exists
```

### 3. Domain-Prefixed Names Prevent Collisions

```typescript
// ✅ CORRECT: Clear what domain
export const readTools = [...];      // Which tools? READ
export const writeTools = [...];     // Which tools? WRITE
export const onboardingTools = [...]; // Which tools? ONBOARDING

// ❌ WRONG: Too generic
export const tools = [...]; // Which tools? No idea. Collision risk.
```

### 4. Async/Sync Must Be Clear from Signature

```typescript
// ✅ CORRECT: Signature shows async/sync
export const getConfig = async () => Config; // `async` keyword present
export const getCached = () => Config | null; // No `async` keyword

// ❌ WRONG: Name doesn't match what you'd expect
export const getConfig = () => Promise<Config>; // Looks sync but isn't
export const getConfigAsync = () => Config; // Looks async but isn't
```

### 5. Run TypeScript Check Before Committing

```bash
npm run typecheck
# If error: Cannot find name 'X'
# → Export doesn't exist with that name
# → Fix the import name to match actual export
```

---

## Common Questions

### Q: Should I use plural or singular?

**A**: Check the return type. If returns array → plural. If returns single → singular. See [patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md](patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md) for detailed rules.

### Q: Should async functions have "Async" suffix?

**A**: No. TypeScript signature shows `async` keyword. Suffix is optional but must be consistent within module. See Part 3 and Pattern 5 of naming conventions doc.

### Q: Why domain-prefix tools?

**A**: Prevents collisions. Multiple modules export 'tools'. Domain-prefixed (`readTools`, `writeTools`) makes it clear which tools. See Pattern 3 of naming conventions doc.

### Q: How do I find what's actually exported?

**A**: Use IDE autocomplete (Ctrl+Space) or "Go to Definition" (F12). See Quick Checklist "When You're Stuck" section.

### Q: Can I skip TypeScript strict mode?

**A**: No. It catches import mismatches before they reach code review. See Part 6 of prevention doc.

### Q: What if my PR has import errors?

**A**: See "When You're Stuck" in [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md). Most likely: IDE autocomplete will show the right name.

---

## Implementation Checklist for Teams

- [ ] Share this index document with team
- [ ] Have team read [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md)
- [ ] Implement ESLint rules (Part 1 of prevention doc)
- [ ] Add pre-commit hooks (Part 1 of prevention doc)
- [ ] Enable TypeScript strict mode (Part 6 of prevention doc)
- [ ] Add import tests to test suite (Part 4 of prevention doc)
- [ ] Reference naming conventions in code review (use pattern doc)
- [ ] Add GitHub Actions workflow (Part 8 of prevention doc)
- [ ] Bookmark quick checklist in team wiki

---

## Related Documents

- [PREVENTION_QUICK_REFERENCE.md](PREVENTION-QUICK-REFERENCE.md) - General prevention patterns
- [PREVENTION-STRATEGIES-INDEX.md](PREVENTION-STRATEGIES-INDEX.md) - Index of all prevention docs
- [ts-rest-any-type-library-limitations-MAIS-20251204.md](best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md) - When `any` is acceptable
- [SCHEMA_DRIFT_PREVENTION.md](SCHEMA_DRIFT_PREVENTION.md) - Database schema prevention
- [circular-dependency-executor-registry-MAIS-20251229.md](patterns/circular-dependency-executor-registry-MAIS-20251229.md) - Module dependency patterns

---

## Document Change Log

| Date       | Change                            | Document                                       |
| ---------- | --------------------------------- | ---------------------------------------------- |
| 2025-12-31 | Created full prevention strategy  | IMPORT_MISMATCH_PREVENTION.md                  |
| 2025-12-31 | Created quick reference checklist | IMPORT_MISMATCH_QUICK_CHECKLIST.md             |
| 2025-12-31 | Created naming conventions guide  | patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md |
| 2025-12-31 | Created this index                | IMPORT_MISMATCH_INDEX.md                       |

---

## Questions or Issues?

If you encounter an import mismatch:

1. **Check the checklist**: [IMPORT_MISMATCH_QUICK_CHECKLIST.md](IMPORT_MISMATCH_QUICK_CHECKLIST.md)
2. **Look for patterns**: [patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md](patterns/IMPORT_MISMATCH_NAMING_CONVENTIONS.md)
3. **Read full guide**: [IMPORT_MISMATCH_PREVENTION.md](IMPORT_MISMATCH_PREVENTION.md)
4. **Still stuck?** Use IDE tools (F12 Go to Definition, Ctrl+Space autocomplete)

Remember: **The export name must match the import name exactly, character-for-character.**
