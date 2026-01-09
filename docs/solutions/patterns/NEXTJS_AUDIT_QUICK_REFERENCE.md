---
title: Next.js Audit Prevention Quick Reference
category: patterns
type: quick-reference
tags: [next.js, migration, server-client-boundary, code-review, cheat-sheet]
date_created: 2026-01-08
print_friendly: true
---

# Next.js Audit Prevention Quick Reference

**Print & Pin** - 2 minute read

---

## Pattern 1: Server/Client Import Boundary Tainting

### The Problem

Files importing server-only modules (next/headers, server-only) "poison" entire component trees. **Client Components cannot import anything from them, even pure functions.**

### The Solution

**Separate server and client utilities into different files:**

```typescript
// ✅ Pure utilities (client-safe)
// apps/web/src/lib/auth.utils.ts
export function isAdmin(role?: string): boolean {
  return role === 'ADMIN';
}

// ✅ Server-only functions
// apps/web/src/lib/auth.server.ts
import 'server-only';
import { cookies } from 'next/headers';

export async function getBackendToken(): Promise<string | null> {
  // ...
}

// ✅ Client imports from .utils, not .server
// apps/web/src/components/AdminButton.tsx
('use client');
import { isAdmin } from '@/lib/auth.utils'; // ✓ Works
```

### File Naming Convention

- `.utils.ts` → Shareable pure utilities (no server imports)
- `.server.ts` → Server-only functions (with `server-only` marker)

### Prevention Checklist

- [ ] Audit all `lib/` files for server imports
- [ ] Extract pure functions to `.utils.ts`
- [ ] Mark `.server.ts` files with `server-only`
- [ ] ESLint rule: prevent server imports in client files
- [ ] `npm run build` passes with no errors

---

## Pattern 2: Multi-Reviewer Effectiveness

### The Problem

Single reviewers miss entire classes of errors. Next.js audit used 3 different reviewers:

| Reviewer     | Caught               | Missed By Single Reviewer? |
| ------------ | -------------------- | -------------------------- |
| TypeScript   | Build failures       | ✓                          |
| Architecture | Dual auth systems    | ✓                          |
| DRY          | Duplicated utilities | ✓                          |

### The Solution

**Always use parallel multi-reviewer code review for migrations:**

```bash
/workflows:review  # Runs 8 agents in parallel:
# ✓ Type Safety & Build
# ✓ Architecture & Patterns
# ✓ Code Quality & DRY
# ✓ Performance & Complexity
# ✓ Security & Isolation
# ✓ Testing & Coverage
# ✓ DevOps & Configuration
# ✓ Documentation & Clarity
```

### Required Reviewers by Change Type

| Change Type  | Required                | Optional |
| ------------ | ----------------------- | -------- |
| Migration    | Type + Architecture     | DRY      |
| Auth         | Security + Type         | DRY      |
| Data Access  | Security + Performance  | DRY      |
| UI Component | Type + Accessibility    | DRY      |
| Database     | Performance + Integrity | -        |

### Prevention Checklist

- [ ] Use `/workflows:review` for all migrations
- [ ] Wait for all agents to complete
- [ ] Review findings by priority (P1 → P2 → P3)
- [ ] Merge findings from all reviewers
- [ ] Create todos for each finding

---

## Pattern 3: Large Codebase Audit Methodology

### The Problem

Auditing 106 changed files takes hours with sequential review, minutes with parallel agents.

### The Solution

**Use parallel exploration agents with focused search patterns:**

```bash
# Instead of: sequential manual review (hours)
# Do this: parallel agent exploration (1-2 hours)

Agent 1: Security → Search for tenantId, auth, validation
Agent 2: Performance → Search for N+1 patterns, caching
Agent 3: Architecture → Search for DI, singletons, coupling
Agent 4: Code Quality → Search for duplication, dead code

# All run in parallel!
```

### Audit Checklist (8 Domains)

```
□ Security: Tenant isolation, tokens, input validation
□ Performance: N+1 queries, caching, duplication, bundle
□ Architecture: Dependencies, layering, DI patterns
□ Code Quality: Dead code, duplication, complexity
□ Build: Missing imports, type errors, contracts
□ Testing: Coverage gaps, integration vs unit
□ DevOps: Logging, monitoring, health checks
□ Documentation: ADRs, README, examples
```

### Findings Template

```markdown
**Severity:** P1 | P2 | P3
**Component:** {path}
**Problem:** {What breaks}

### Current State

{Code snippet}

### Solution

{How to fix}

### Validation

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

### Prevention Checklist

- [ ] Prepare 8 focus areas
- [ ] Launch parallel agents
- [ ] Use standard findings format
- [ ] Deduplicate overlapping issues
- [ ] Prioritize by P1/P2/P3
- [ ] Create todos with acceptance criteria

---

## Pre-Migration Checklist

```
□ Define file naming (.utils.ts / .server.ts)
□ Configure ESLint rules for imports
□ Schedule parallel code review
□ Prepare exploration agent focus areas
□ Create audit checklist (8 domains)
```

## During Migration

```
□ Commit frequently (every feature)
□ Run npm run build regularly
□ Separate server/client code early
□ Extract shared utilities immediately
□ No server imports in client files
```

## Post-Migration (Pre-Merge)

```
□ Run parallel exploration agents
□ Collect findings in standard format
□ Deduplicate across reviewers
□ Prioritize P1 → P2 → P3
□ Create todos with effort estimates
□ Multi-reviewer code review
□ Verify all fixes before merge
```

## Merge Gates

```
Before merging migration PR:
□ npm run build passes
□ No as never / as any on contracts
□ No server imports in client components
□ All .server.ts marked with server-only
□ No duplication across modules
□ No console.log (use logger)
□ Tokens not exposed to client
□ Tenant isolation enforced
□ ADR created for major decisions
```

---

## ESLint Rules to Add

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/headers",
            "message": "Use .server.ts file, marks component as Server"
          },
          {
            "name": "next/navigation",
            "importNames": ["redirect", "notFound"],
            "message": "Server-only. Move to .server.ts"
          }
        ]
      }
    ]
  }
}
```

---

## When to Use These Patterns

| Scenario               | Pattern 1 | Pattern 2 | Pattern 3 |
| ---------------------- | :-------: | :-------: | :-------: |
| Bug fix <50 lines      |     -     |     -     |     -     |
| Component refactor     |     ✓     |     -     |     -     |
| Framework migration    |     ✓     |     ✓     |     ✓     |
| New auth system        |     ✓     |     ✓     |     ✓     |
| Large feature >500 LOC |     ✓     |     -     |     ✓     |
| Security audit         |     ✓     |     ✓     |     ✓     |
| Pre-launch review      |     -     |     ✓     |     ✓     |

---

## Key Takeaways

1. **Separate .utils.ts from .server.ts to avoid import tainting**
2. **Always use parallel multi-reviewer approach for migrations**
3. **Use parallel agents to audit large codebases in hours, not days**
4. **Add ESLint rules to catch boundary violations early**
5. **Follow standard findings format for consistency**

---

See: **[NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md)** for detailed implementation guide
