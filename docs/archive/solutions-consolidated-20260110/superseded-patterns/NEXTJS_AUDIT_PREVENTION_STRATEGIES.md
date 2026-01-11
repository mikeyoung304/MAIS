---
title: Next.js Migration Audit Prevention Strategies
category: patterns
tags:
  [
    next.js,
    migration,
    multi-tenant,
    server-client-boundary,
    code-review,
    prevention,
    architecture,
    import-tainting,
  ]
severity: high
date_created: 2026-01-08
related_commits:
  - c9e07cce
  - a948e3fd
source: Migration audit findings + multi-reviewer analysis
---

# Next.js Migration Audit Prevention Strategies

**Status:** Active Prevention Guide
**Last Updated:** 2026-01-08
**Scope:** Next.js App Router migrations, multi-tenant SSR patterns

---

## Executive Summary

The Next.js migration audit revealed three critical patterns that drove quality and security issues:

1. **Server/Client Import Boundary Tainting** - Files importing server-only modules "poison" entire component trees, preventing client imports
2. **Multi-Reviewer Pattern Effectiveness** - Parallel reviewers with different specializations catch different classes of errors
3. **Audit Methodology** - Parallel exploration with focused agents is superior to sequential review for large codebases

This document provides prevention strategies for all three patterns.

---

## Pattern 1: Server/Client Import Boundary Tainting

### Problem

When a file imports server-only modules (e.g., `next/headers`, `server-only`), it becomes "tainted" as a Server Component. **Client Components cannot import anything from tainted files, even pure utility functions that don't use the server imports.**

This creates a hidden dependency graph that isn't obvious from the code structure.

### What Happens

```typescript
// ❌ TAINTED FILE - Imports server-only module
// apps/web/src/lib/auth.ts
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

export async function getBackendToken(): Promise<string | null> {
  // Uses server-only API
  const token = await getToken({ cookies: await cookies() });
  return token?.backendToken || null;
}

export function isAdmin(role?: string): boolean {
  // Pure function, but STILL can't be imported by Client Components!
  return role === 'ADMIN';
}

// ❌ BREAKS IN CLIENT COMPONENT
// apps/web/src/components/AdminButton.tsx
('use client');
import { isAdmin } from '@/lib/auth'; // ERROR: Client can't import from tainted file
```

### Why This Matters

1. **Silent Build Failures** - Error only occurs at build time in CI, not locally
2. **Code Duplication** - Developers duplicate "pure" utilities to avoid tainted imports
3. **Maintenance Burden** - Pure functions scattered across multiple files
4. **Refactoring Risk** - Moving a utility to a "tainted" file breaks all client imports

### Prevention Strategies

#### Strategy 1: Separate Server and Client Utilities (RECOMMENDED)

Create distinct files for server-only vs. shareable code:

```typescript
// ✅ GOOD: Pure utilities that clients can use
// apps/web/src/lib/auth.utils.ts (no server imports)
export function isAdmin(role?: string): boolean {
  return role === 'ADMIN';
}

export function isTenantOwner(userRole?: string, tenantId?: string): boolean {
  return userRole === 'OWNER' && !!tenantId;
}

// ✅ GOOD: Server-only functions in separate file
// apps/web/src/lib/auth.server.ts (server-only marker)
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import 'server-only'; // Explicit marker for tools

export async function getBackendToken(): Promise<string | null> {
  const token = await getToken({ cookies: await cookies() });
  return token?.backendToken || null;
}

// ✅ GOOD: Client can import from utilities
// apps/web/src/components/AdminButton.tsx
'use client';
import { isAdmin } from '@/lib/auth.utils'; // ✓ Works
import Button from '@/components/ui/Button';

export function AdminButton() {
  return <Button disabled={!isAdmin(role)}>Admin Panel</Button>;
}

// ✅ GOOD: Server Component can import from both
// apps/web/src/app/(protected)/admin/page.tsx
import { getBackendToken } from '@/lib/auth.server';
import { isAdmin } from '@/lib/auth.utils';

export default async function AdminPage() {
  const token = await getBackendToken();
  if (!isAdmin(userRole)) return null;
  // ...
}
```

**File Naming Convention:**

- `.utils.ts` - Shareable pure utilities (no server imports)
- `.server.ts` - Server-only functions (with `server-only` marker)
- `.ts` - Ambiguous (avoid)

#### Strategy 2: Use `server-only` Package Explicitly

For files with server imports, mark them explicitly:

```typescript
// apps/web/src/lib/tenant.server.ts
import 'server-only'; // Prevents accidental client imports at build time
import { headers } from 'next/headers';
import type { Tenant } from '@macon/contracts';

export async function getTenantByDomain(domain: string): Promise<Tenant | null> {
  // Server-only code
  const headerList = await headers();
  // ...
}
```

**Benefit:** Build-time error if client tries to import, rather than silent failure.

#### Strategy 3: Extract Pure Logic to Shared Packages

For frequently-used utilities, move to `@macon/shared`:

```typescript
// packages/shared/src/roles.ts (no server imports)
export function isAdmin(role?: string): boolean {
  return role === 'ADMIN';
}

// apps/web/src/lib/auth.server.ts (server-only)
import 'server-only';
import { isAdmin } from '@macon/shared'; // ✓ Safe, no server-only imports

export async function validateAdminToken(token: string): Promise<boolean> {
  const user = await decodeToken(token);
  return isAdmin(user.role);
}
```

### Implementation Checklist

- [ ] Audit all `apps/web/src/lib/**/*.ts` files for server imports
- [ ] Identify pure functions in server-only files
- [ ] Create `.utils.ts` files with extracted utilities
- [ ] Add `server-only` marker to all `.server.ts` files
- [ ] Update all client imports to reference `.utils` files
- [ ] Run `npm run build` to verify no import errors
- [ ] Add ESLint rule to catch violations

### ESLint Rule Prevention

Add to `.eslintrc.json`:

```json
{
  "rules": {
    "@next/next/no-sync-scripts": "error",
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/headers",
            "importNames": ["cookies", "headers", "draftMode"],
            "message": "Server-only imports in this file will taint it. Move to .server.ts"
          },
          {
            "name": "next/navigation",
            "importNames": ["redirect", "notFound"],
            "message": "These are server-only. Move to .server.ts"
          }
        ]
      }
    ]
  }
}
```

---

## Pattern 2: Multi-Reviewer Effectiveness

### Problem

A single reviewer (human or AI) misses classes of errors they're not trained to see. The Next.js audit used three distinct reviewers with different specializations:

1. **DHH/Simplicity Reviewer** - Saw bloat, configuration complexity, unnecessary abstractions
2. **TypeScript/Patterns Reviewer** - Caught type safety violations, missing error boundaries
3. **Code Quality/DRY Reviewer** - Identified duplication, dead imports, unused components

Each found different issues. A single reviewer would have missed 2/3 of them.

### What Happened

**Issue: Badge component imported but never created**

- **Single reviewer:** "Looks fine, imports exist"
- **TypeScript reviewer:** "Build fails - Badge component doesn't exist!"
- **Result:** P1 blocker caught only by type checker

**Issue: Multiple utilities duplicated across files**

- **Single reviewer:** "Code works as-is"
- **DRY reviewer:** "isAdmin() defined in 3 different places - extract to shared"
- **Result:** Technical debt identified, prevented future maintenance burden

**Issue: Legacy AuthContext alongside NextAuth**

- **Single reviewer:** "Both work, leave as-is"
- **Simplicity reviewer:** "Dual auth systems are complexity debt. Pick one."
- **Result:** Architecture simplified, token sync bugs prevented

### Prevention Strategies

#### Strategy 1: Parallel Review Process (RECOMMENDED)

Always use multi-reviewer approach for migrations:

```bash
# Trigger specialized reviewers in parallel
/workflows:review  # Automatically runs 8 agents:
# 1. Type Safety & Build
# 2. Architecture & Patterns
# 3. Code Quality & DRY
# 4. Performance & Complexity
# 5. Security & Isolation
# 6. Testing & Coverage
# 7. DevOps & Configuration
# 8. Documentation & Clarity
```

Each agent produces a separate report. Merge findings and prioritize:

| Priority | Example Finding              | Who Caught It       |
| -------- | ---------------------------- | ------------------- |
| P1       | Build fails (missing Badge)  | TypeScript reviewer |
| P2       | Dual auth systems complexity | Simplicity reviewer |
| P3       | isAdmin() duplication        | DRY reviewer        |

#### Strategy 2: Mandatory Reviewer Specializations

Define required reviewers based on change type:

| Change Type         | Required Reviewers                 |
| ------------------- | ---------------------------------- |
| Migration           | Type Safety + Architecture + DRY   |
| Auth System         | Security + Type Safety             |
| Data Access Layer   | Security + Performance + DRY       |
| UI Components       | Type Safety + Accessibility + DRY  |
| Database Schema     | Performance + Data Integrity       |
| Public API Endpoint | Security + Testing + Documentation |

#### Strategy 3: Structured Review Questions

Each reviewer answers specific questions:

**Type Safety Reviewer:**

- Does code compile without `as any` or `as never`?
- Are all imports resolvable?
- Do all function signatures match call sites?

**Architecture Reviewer:**

- Does code violate layered architecture principles?
- Are dependencies properly injected?
- Is there unnecessary coupling?

**DRY Reviewer:**

- Is logic duplicated across files?
- Are utility functions extracted to shared packages?
- Can dependencies be deduplicated?

**Security Reviewer:**

- Is tenant isolation enforced in all queries?
- Are secrets properly handled?
- Is input validation applied consistently?

### Implementation Checklist

- [ ] Enable `/workflows:review` before code review
- [ ] Wait for all 8 agents to complete analysis
- [ ] Review findings by priority (P1 → P2 → P3)
- [ ] Verify no conflicts between reviewer recommendations
- [ ] Create todos for each finding
- [ ] Re-run review after major refactoring

### When to Skip Full Review

Only skip parallel review for:

- Small, isolated bug fixes (<50 lines)
- Documentation-only changes
- Configuration updates with no logic changes

---

## Pattern 3: Large Codebase Audit Methodology

### Problem

Auditing a large monorepo (106 files changed, 16k lines in Next.js migration) requires a systematic approach. Approaches compared:

1. **Sequential Manual Review** - 1 person, weeks, slow
2. **Pair Programming** - 2 people, days, high quality but expensive
3. **Parallel Agent Exploration** - N agents, hours, identifies broad patterns quickly

The audit used **Parallel Agent Exploration** and completed in 1-2 hours.

### What Works

**Agent 1 (Security):** Search for `tenantId`, review queries → finds isolation gaps
**Agent 2 (Performance):** Search for database calls → identifies N+1 patterns
**Agent 3 (Architecture):** Search for DI, singletons → finds coupling issues
**Agent 4 (Code Quality):** Search for duplication, dead code → finds bloat

**In parallel** (not sequentially):

- Each agent completes in ~30 min
- Total time: ~1 hour
- Total coverage: 4 different perspectives simultaneously

**Sequential would take:**

- Reviewer 1: 1 hour → Security findings
- Reviewer 2: 1 hour → Performance findings
- Reviewer 3: 1 hour → Architecture findings
- Reviewer 4: 1 hour → Code quality findings
- **Total: 4 hours minimum**

### Prevention Strategies

#### Strategy 1: Exploration Agent Pattern

For any large codebase audit, use parallel exploration:

```typescript
// Example: Audit Next.js migration
const explorations = [
  {
    focus: 'Server/Client Boundary Violations',
    searches: [
      'files importing next/headers',
      'files with server-only imports used by clients',
      'tainted imports causing cascading errors',
    ],
  },
  {
    focus: 'Build Failures',
    searches: [
      'missing component imports',
      'unresolved type references',
      'broken ts-rest contracts',
    ],
  },
  {
    focus: 'Security Issues',
    searches: [
      'exposed tokens in session callbacks',
      'missing tenant scoping',
      'rate limiting gaps',
    ],
  },
  {
    focus: 'Performance Issues',
    searches: ['duplicate data fetches', 'N+1 query patterns', 'missing React cache() usage'],
  },
];

// Launch all in parallel
explorations.map((e) => launchExplorationAgent(e));
```

#### Strategy 2: Audit Checklist Template

When starting any large codebase audit:

```markdown
## Codebase Audit Checklist

### Phase 1: Parallel Exploration (1-2 hours)

- [ ] Security: Tenant isolation, auth tokens, input validation
- [ ] Performance: N+1 queries, caching, duplication, bundle size
- [ ] Architecture: Dependencies, layering violations, DI patterns
- [ ] Code Quality: Dead code, duplication, complexity metrics
- [ ] Build: Missing imports, type errors, contract violations
- [ ] Testing: Coverage gaps, integration vs unit ratio
- [ ] DevOps: Logging, monitoring, health checks, secrets
- [ ] Documentation: ADRs, README accuracy, examples

### Phase 2: Findings Synthesis (1 hour)

- [ ] Deduplicate overlapping findings
- [ ] Prioritize by P1/P2/P3
- [ ] Categorize by component/module
- [ ] Create todos with acceptance criteria
- [ ] Identify dependencies between fixes

### Phase 3: Validation (30 min)

- [ ] Verify no quick-wins were missed
- [ ] Check for blockers in todos
- [ ] Estimate effort for P1s
- [ ] Schedule review sessions
```

#### Strategy 3: Findings Template

Standardize how agents report findings:

```markdown
## Finding: {Issue}

**Severity:** P1 | P2 | P3
**Component:** {Module path}
**Symptoms:** {What breaks or is missing}

### Current State

{Code snippet showing problem}

### Issues

- Issue 1: {Specific problem}
- Issue 2: {Consequence}

### Solution

{How to fix}

### Validation

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2

### Related Findings

{Links to similar issues}
```

### Implementation Checklist

- [ ] Create parallel exploration agents for each domain
- [ ] Set time limit per agent (30 min max)
- [ ] Collect all findings in standard format
- [ ] Deduplicate related findings
- [ ] Prioritize using P1/P2/P3 framework
- [ ] Create todos for findings
- [ ] Schedule fixes by priority

---

## Integrated Prevention System

### Combining All Three Patterns

For maximum effectiveness, use all three patterns together:

```
┌─────────────────────────────────────────────────────────────┐
│ Before Large Migration/Refactoring                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Establish Server/Client Boundary Guidelines              │
│    - Use .utils.ts / .server.ts naming                       │
│    - Add server-only markers                                 │
│    - Configure ESLint rules                                  │
├─────────────────────────────────────────────────────────────┤
│ 2. Plan Multi-Reviewer Audit                                │
│    - Define required specializations                         │
│    - Prepare review questions for each                       │
│    - Schedule parallel review time                           │
├─────────────────────────────────────────────────────────────┤
│ 3. Design Codebase Audit                                    │
│    - Create exploration focus areas                          │
│    - Prepare grep/glob search patterns                       │
│    - Allocate 1-2 hours for parallel agents                  │
├─────────────────────────────────────────────────────────────┤
│ After Migration/Refactoring                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Run Parallel Exploration Agents                           │
│    - Launch all agents simultaneously                        │
│    - Collect findings in standard format                     │
│    - Deduplicate and prioritize                              │
├─────────────────────────────────────────────────────────────┤
│ 2. Multi-Reviewer Code Review                               │
│    - Type Safety reviewer checks build                       │
│    - Architecture reviewer checks patterns                   │
│    - DRY reviewer checks duplication                         │
│    - Security reviewer checks isolation                      │
├─────────────────────────────────────────────────────────────┤
│ 3. Fix by Priority                                           │
│    - P1: Critical path blockers (24 hours)                   │
│    - P2: Important improvements (1 week)                     │
│    - P3: Nice-to-haves (backlog)                             │
├─────────────────────────────────────────────────────────────┤
│ 4. Validate and Document                                    │
│    - Run full test suite                                     │
│    - Verify no regressions                                   │
│    - Update ADRs and documentation                           │
│    - Capture lessons in prevention strategies                │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Checklist

### Before Migration

- [ ] Define server-only utilities file structure (.utils.ts / .server.ts)
- [ ] Configure ESLint rules for import violations
- [ ] Schedule parallel code review with multiple specialists
- [ ] Prepare exploration agent focus areas
- [ ] Create audit checklist with all 8 review domains

### During Migration

- [ ] Commit frequently (every feature/component)
- [ ] Run `npm run build` regularly
- [ ] Avoid creating "tainted" files by separating server/client code early
- [ ] Keep server-only logic in dedicated modules
- [ ] Extract shared utilities to .utils.ts immediately

### After Migration (Pre-Merge)

- [ ] Run parallel exploration agents (1-2 hours)
- [ ] Collect all findings in standard format
- [ ] Deduplicate findings across reviewers
- [ ] Prioritize using P1/P2/P3 framework
- [ ] Assign reviewers to each finding category
- [ ] Create todos with acceptance criteria
- [ ] Estimate effort and schedule fixes

### Code Review Gates

Before merging migration PR:

```markdown
## Migration Pre-Merge Checklist

### Build & Type Safety

- [ ] npm run build passes
- [ ] No `as never` or `as any` on contracts
- [ ] All imports resolve
- [ ] TypeScript strict mode compliant

### Server/Client Boundary

- [ ] No server imports in client components
- [ ] All .server.ts files marked with server-only
- [ ] No tainted imports reaching clients
- [ ] File structure follows .utils.ts / .server.ts pattern

### Code Quality

- [ ] No duplication across modules
- [ ] Pure utilities extracted to .utils.ts
- [ ] Dead imports removed
- [ ] No console.log (use logger)

### Security

- [ ] Tokens not exposed to client
- [ ] Tenant isolation enforced
- [ ] Input validation applied
- [ ] Rate limiting on expensive endpoints

### Documentation

- [ ] ADR created for major decisions
- [ ] README updated with new patterns
- [ ] Examples show best practices
- [ ] Breaking changes documented
```

---

## When to Apply These Patterns

| Scenario                        | Pattern 1 | Pattern 2 | Pattern 3 |
| ------------------------------- | --------- | --------- | --------- |
| Small bug fix (<50 lines)       | -         | -         | -         |
| Component refactoring           | ✓         | -         | -         |
| Next.js/Remix migration         | ✓         | ✓         | ✓         |
| New auth system implementation  | ✓         | ✓         | ✓         |
| Large feature spanning multiple |           |           |           |
| modules (>500 lines)            | ✓         | -         | ✓         |
| Security audit                  | ✓         | ✓         | ✓         |
| Pre-production before launch    | -         | ✓         | ✓         |
| Post-incident code review       | ✓         | ✓         | ✓         |

---

## Related Documentation

- **[Next.js Migration Lessons Learned](nextjs-migration-lessons-learned-MAIS-20251225.md)** - 10 key lessons from the audit
- **[ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)** - Architecture decisions
- **[Multi-Agent Code Review Process](../methodology/multi-agent-code-review-process.md)** - Comprehensive review methodology
- **[REACT_HOOKS_EARLY_RETURN_PREVENTION](REACT_HOOKS_EARLY_RETURN_PREVENTION.md)** - Specific Next.js hook rules
- **[TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION](TYPESCRIPT_SYMLINK_RESOLUTION_PREVENTION.md)** - Import resolution patterns

---

## Tags

`next.js` `migration` `architecture` `code-review` `server-client-boundary` `import-tainting` `multi-reviewer` `parallel-agents` `codebase-audit` `prevention` `best-practices`

---

## Attribution

**Created:** 2026-01-08
**Based on:** Next.js migration audit (commit c9e07cce)
**Reviewers:** Type Safety, Architecture, Code Quality agents
**Status:** Active Prevention Guide
