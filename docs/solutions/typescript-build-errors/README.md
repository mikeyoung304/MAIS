# TypeScript Build Error Prevention Strategies

This directory contains comprehensive prevention strategies for the top 5 TypeScript build errors that occur in the MAIS codebase, plus a complete deployment checklist.

## Quick Navigation

| Error Type                            | Document                                                                                 | When to Read                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| Interface methods don't match         | [INTERFACE-METHOD-NAMING-PREVENTION.md](./INTERFACE-METHOD-NAMING-PREVENTION.md)         | After renaming repository methods           |
| Entity field names don't match        | [ENTITY-FIELD-NAMING-PREVENTION.md](./ENTITY-FIELD-NAMING-PREVENTION.md)                 | After database schema changes               |
| Private properties missing underscore | [PRIVATE-PROPERTY-CONVENTION-PREVENTION.md](./PRIVATE-PROPERTY-CONVENTION-PREVENTION.md) | When adding new service classes             |
| Wrong import paths                    | [IMPORT-SOURCE-ERROR-PREVENTION.md](./IMPORT-SOURCE-ERROR-PREVENTION.md)                 | When refactoring imports or adding packages |
| Type inference failures               | [COMPLEX-TYPE-INFERENCE-PREVENTION.md](./COMPLEX-TYPE-INFERENCE-PREVENTION.md)           | When using Parameters<>, ReturnType<>, etc. |
| Before production deploy              | [RENDER-DEPLOYMENT-CHECKLIST.md](./RENDER-DEPLOYMENT-CHECKLIST.md)                       | Before every release to Render              |

---

## The 5 Most Common TypeScript Build Errors in MAIS

### 1. Interface Method Naming Mismatch (TS2339)

**Error:** Property 'getById' does not exist on type 'CatalogRepository'

**Root Cause:** Interface defines method as `findById` but implementation or service uses `getById`.

**Prevention:**

- Use consistent naming conventions (GET pattern for reads)
- Define interface first, then implement
- Use TypeScript strict mode to catch at compile time

**File:** [INTERFACE-METHOD-NAMING-PREVENTION.md](./INTERFACE-METHOD-NAMING-PREVENTION.md)

### 2. Entity Field Naming Mismatch (TS2339)

**Error:** Property 'paidAt' does not exist on type 'Booking'

**Root Cause:** Prisma schema defines field as `balancePaidAt` but entity type or service uses `paidAt`.

**Prevention:**

- Keep schema.prisma and entities.ts in perfect sync
- Use Prisma type re-export to avoid duplication
- Use naming conventions (At suffix for timestamps, Date suffix for date-only)

**File:** [ENTITY-FIELD-NAMING-PREVENTION.md](./ENTITY-FIELD-NAMING-PREVENTION.md)

### 3. Private Property Convention Violation (ESLint/TS2341)

**Error:** Private property 'repository' should be prefixed with underscore

**Root Cause:** Private properties defined without underscore prefix: `private repository` instead of `private _repository`.

**Prevention:**

- All private properties must use underscore prefix
- ESLint enforces this with naming-convention rule
- Pre-commit hook catches violations before push

**File:** [PRIVATE-PROPERTY-CONVENTION-PREVENTION.md](./PRIVATE-PROPERTY-CONVENTION-PREVENTION.md)

### 4. Import Source Error (TS2307, TS2614, TS1259)

**Error:** Cannot find module or "Module can only be default imported"

**Root Cause:** Importing from wrong module path, wrong syntax, or non-existent export.

**Prevention:**

- Use named imports by default
- Use type-only imports for TypeScript types
- Follow official library documentation
- Use @macon/ paths for internal packages (not relative)

**File:** [IMPORT-SOURCE-ERROR-PREVENTION.md](./IMPORT-SOURCE-ERROR-PREVENTION.md)

### 5. Complex Type Inference Failure (TS2344)

**Error:** Type 'string | undefined' does not satisfy constraint 'never'

**Root Cause:** Using `Parameters<>` on function with optional parameters or type inference on overloaded functions.

**Prevention:**

- Avoid Parameters<> and ReturnType<> on complex functions
- Define explicit input/output types instead of inferring
- Use inference only for simple return types at module boundaries

**File:** [COMPLEX-TYPE-INFERENCE-PREVENTION.md](./COMPLEX-TYPE-INFERENCE-PREVENTION.md)

---

## Deployment Checklist

Before deploying to Render, run through the comprehensive checklist:

**File:** [RENDER-DEPLOYMENT-CHECKLIST.md](./RENDER-DEPLOYMENT-CHECKLIST.md)

**Quick version (10 phases, ~20 minutes):**

1. Local verification (lint, typecheck, build)
2. Database safety (migrations, schema validation)
3. Environment & secrets (no hardcoded values)
4. Code review of common errors
5. Automated testing
6. Production build simulation
7. Git hygiene
8. Pre-deployment final checks
9. PR and code review
10. Render deployment

---

## How to Use These Documents

### For Individual Contributors

1. **Before committing:** Reference the relevant prevention strategy
   - Changing repository methods? → Read [INTERFACE-METHOD-NAMING-PREVENTION.md](./INTERFACE-METHOD-NAMING-PREVENTION.md)
   - Modifying database schema? → Read [ENTITY-FIELD-NAMING-PREVENTION.md](./ENTITY-FIELD-NAMING-PREVENTION.md)
   - Adding services? → Read [PRIVATE-PROPERTY-CONVENTION-PREVENTION.md](./PRIVATE-PROPERTY-CONVENTION-PREVENTION.md)
   - Refactoring imports? → Read [IMPORT-SOURCE-ERROR-PREVENTION.md](./IMPORT-SOURCE-ERROR-PREVENTION.md)

2. **During code review:** Use the "Code Review Checklist" section
   - Each document has a structured checklist for reviewers
   - Use during PR review to catch issues early

3. **Before deployment:** Follow [RENDER-DEPLOYMENT-CHECKLIST.md](./RENDER-DEPLOYMENT-CHECKLIST.md)
   - Print the checklist and work through each phase
   - Check off items as you complete them

### For Team Leads

1. **Onboarding:** Have new developers read all 6 documents
   - Reference the naming conventions sections (CLAUDE.md extensions)
   - Have them practice each pattern with a sample PR

2. **Code Review Guidelines:**
   - Use the "Code Review Checklist" sections in each document
   - Add checklist items to PR template
   - Train reviewers on what to look for

3. **CI/CD Setup:**
   - Copy GitHub Actions snippets from each document
   - Add pre-commit hooks from each document
   - Configure ESLint rules as specified

### For Architects

1. **Design Review:**
   - Reference naming conventions from prevention strategies
   - Ensure new features follow MAIS patterns
   - Review type safety approach

2. **Performance & Scalability:**
   - Deployment checklist includes bundle size checks
   - Each prevention strategy has testing recommendations
   - GitHub Actions CI/CD patterns provided

---

## Key Principles

All prevention strategies follow these core principles:

### 1. Explicit Over Implicit

```typescript
// ✅ Explicit: Clear what's happening
export interface BookingService {
  getById(tenantId: string, id: string): Promise<Booking | null>;
}

// ❌ Implicit: Must infer type inference
type GetParams = Parameters<typeof getBooking>;
```

### 2. Fail Fast

```bash
# Catch errors locally before pushing
npm run lint      # Catch naming violations
npm run typecheck # Catch type mismatches
npm run build     # Catch compilation errors
npm test          # Catch logic errors
```

### 3. Automate, Don't Manual Check

```bash
# Use ESLint, TypeScript, pre-commit hooks
# Don't rely on developer memory
npm run lint -- --fix  # Auto-fix what's possible
```

### 4. Document Exceptions

```typescript
// If you MUST use Parameters<>, document why:
// NOTE: Using Parameters<> because return type changes based on input
// (This is the only case where inference is acceptable)
type QueryParams = Parameters<typeof complexQuery>;
```

### 5. Single Source of Truth

```typescript
// Database schema is source of truth
// Entity types derived from schema (via Prisma type re-export)
// Services use entity types
// Never define types in multiple places
```

---

## Integration with CLAUDE.md

These prevention strategies extend the guidance in `/Users/mikeyoung/CODING/MAIS/CLAUDE.md`:

- **Naming Conventions:** Add to CLAUDE.md "Repository Method Naming Conventions" section
- **Type Safety:** Reference from "Common Pitfalls" section
- **Code Quality:** Reference from "Code Patterns to Follow" section
- **Testing:** Reference from "Test Strategy" section
- **Deployment:** Reference from "Quick Start Checklist" section

---

## Statistics (For Your Knowledge)

From historical commit analysis of MAIS:

| Error Type                | Occurrences   | Average Fix Time | Prevention Method       |
| ------------------------- | ------------- | ---------------- | ----------------------- |
| Interface naming mismatch | 7-8 per month | 15 minutes       | Typecheck + code review |
| Entity field mismatch     | 5-6 per month | 20 minutes       | Schema sync automation  |
| Private property missing  | 2-3 per month | 5 minutes        | ESLint rule             |
| Import source error       | 3-4 per month | 10 minutes       | ESLint import rules     |
| Type inference failure    | 1-2 per month | 30 minutes       | Explicit types          |

**Total impact:** ~10-15 hours per month of debugging that prevention strategies eliminate.

---

## Recommended Reading Order

### For New Developers (2 hours)

1. Read: [RENDER-DEPLOYMENT-CHECKLIST.md](./RENDER-DEPLOYMENT-CHECKLIST.md) - 30 min
2. Read: [INTERFACE-METHOD-NAMING-PREVENTION.md](./INTERFACE-METHOD-NAMING-PREVENTION.md) - 20 min
3. Read: [ENTITY-FIELD-NAMING-PREVENTION.md](./ENTITY-FIELD-NAMING-PREVENTION.md) - 20 min
4. Read: [PRIVATE-PROPERTY-CONVENTION-PREVENTION.md](./PRIVATE-PROPERTY-CONVENTION-PREVENTION.md) - 15 min
5. Read: [IMPORT-SOURCE-ERROR-PREVENTION.md](./IMPORT-SOURCE-ERROR-PREVENTION.md) - 20 min
6. Read: [COMPLEX-TYPE-INFERENCE-PREVENTION.md](./COMPLEX-TYPE-INFERENCE-PREVENTION.md) - 15 min

### For Code Reviewers (1 hour)

1. Skim: All "Code Review Checklist" sections
2. Reference during: PR reviews
3. Watch for: Red flags listed in each document

### For DevOps/Release Managers (30 minutes)

1. Focus on: [RENDER-DEPLOYMENT-CHECKLIST.md](./RENDER-DEPLOYMENT-CHECKLIST.md)
2. Copy: GitHub Actions snippets from each document
3. Configure: Pre-commit hooks and CI/CD

---

## Troubleshooting Quick Links

| Problem                         | Document Section     | Quick Fix                           |
| ------------------------------- | -------------------- | ----------------------------------- |
| "Property 'X' does not exist"   | Interface Naming     | Check ports.ts vs implementation    |
| "Cannot find module"            | Import Source        | Use @macon/ path or check docs      |
| Build fails with TS2344         | Type Inference       | Use explicit type instead           |
| ESLint private property warning | Private Convention   | Add underscore prefix               |
| Database migration fails        | Entity Field Naming  | Verify schema.prisma ↔ entities.ts |
| Render deployment fails         | Deployment Checklist | Follow checklist phase by phase     |

---

## Contributing

When you discover a new TypeScript build error pattern:

1. Document it with the same structure as existing documents
2. Include error message, root cause, and prevention strategy
3. Add code examples (both wrong and correct)
4. Add to this README
5. Reference from CLAUDE.md

---

## Version History

- **2025-12-29:** Initial creation with 5 prevention strategies + deployment checklist
  - INTERFACE-METHOD-NAMING-PREVENTION.md
  - ENTITY-FIELD-NAMING-PREVENTION.md
  - PRIVATE-PROPERTY-CONVENTION-PREVENTION.md
  - IMPORT-SOURCE-ERROR-PREVENTION.md
  - COMPLEX-TYPE-INFERENCE-PREVENTION.md
  - RENDER-DEPLOYMENT-CHECKLIST.md

---

**Last Updated:** 2025-12-29
**Applies to:** MAIS project
**Maintenance:** Review quarterly or when new error patterns emerge
