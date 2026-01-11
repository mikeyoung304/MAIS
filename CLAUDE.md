# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HANDLED (gethandled.ai) is a membership platform for service professionals — photographers, coaches, therapists, wedding planners — combining done-for-you tech with done-with-you education. Built as a multi-tenant modular monolith with Express + React, featuring complete data isolation, config-driven architecture, and mock-first development.

**Tech Stack:** Express 4, TypeScript 5.9.3 (strict), Prisma 7, PostgreSQL | React 18, Next.js 14 App Router, TailwindCSS | ts-rest + Zod | Vitest, Playwright

**Status:** Production-ready on `main`. Next.js migration complete. Agent-powered onboarding complete.

## Quick Start

```bash
npm run dev:api          # API server (mock mode)
npm run dev:web          # Next.js (port 3000)
npm run dev:all          # API + Next.js + Stripe webhooks
npm test                 # All tests
npm run typecheck        # TypeScript check
npm run doctor           # Environment health check
```

**Full command reference:** See `DEVELOPING.md`

## Monorepo Structure

```
apps/web/           # Next.js 14 App Router (port 3000)
server/             # Express API (port 3001)
packages/
├── contracts/      # API contracts (Zod + ts-rest)
└── shared/         # Shared utilities
```

- **Import pattern:** `import { contract } from '@macon/contracts'`
- **Workspace commands:** `npm run --workspace=server test`

## Critical Security Rules (ALWAYS ENFORCED)

### Multi-Tenant Data Isolation

**CRITICAL:** ALL database queries MUST be scoped by `tenantId` to prevent data leakage.

```typescript
// CORRECT - Tenant-scoped
const packages = await prisma.package.findMany({
  where: { tenantId, active: true },
});

// WRONG - Security vulnerability
const packages = await prisma.package.findMany({
  where: { active: true },
});
```

### Other Security Rules

1. **Encrypt tenant secrets:** Use `TENANT_SECRETS_ENCRYPTION_KEY`
2. **Validate API keys:** Format `pk_live_{slug}_{random}` or `sk_live_{slug}_{random}`
3. **Cache keys include tenantId:** `const key = \`tenant:${tenantId}:resource:${id}\``
4. **Rate limit auth endpoints:** 5 attempts/15min/IP

## Architecture (On-Demand Reference)

For detailed architecture documentation, search or read these files when working on specific subsystems:

| Subsystem                      | Reference                                                 |
| ------------------------------ | --------------------------------------------------------- |
| Layered architecture           | `server/src/di.ts`, `server/src/lib/ports.ts`             |
| Type-safe API contracts        | `packages/contracts/`, ts-rest + Zod                      |
| Customer chatbot               | `server/src/agent/customer/`, T3 trust tier proposals     |
| Business advisor (onboarding)  | `server/src/agent/onboarding/`, XState v5, event sourcing |
| Build mode (storefront editor) | `docs/architecture/BUILD_MODE_VISION.md`                  |
| Agent evaluation               | `server/src/agent/evals/`                                 |
| Landing page config            | `apps/web/src/lib/tenant.ts`, `normalizeToPages()`        |
| Double-booking prevention      | ADR-013, advisory locks, `booking.service.ts`             |
| Webhook idempotency            | `webhookEvent` table, ADR-002                             |

**Use `repo-research-analyst` agent** for codebase exploration when context is unclear.

## Development Workflow

### Adding Multi-Tenant Features

1. All queries filter by `tenantId`
2. Verify tenant owns resource before mutations
3. Use `res.locals.tenantAuth.tenantId` from JWT middleware
4. Include `tenantId` in all cache keys

### Database Migrations

**Pattern A (Prisma):** Tables/columns → `prisma migrate dev --name name`
**Pattern B (Raw SQL):** Enums/indexes → Create `migrations/NN_name.sql`, run with `prisma db execute`

See `docs/solutions/SCHEMA_DRIFT_PREVENTION.md` for decision tree.

## Domain Expertise (Auto-Load Skills)

| When Working On...        | Load Skill                                                  |
| ------------------------- | ----------------------------------------------------------- |
| UI/components/pages       | `frontend-design` + read `docs/design/BRAND_VOICE_GUIDE.md` |
| AI/agent features         | `agent-native-architecture`                                 |
| Creating skills/workflows | `create-agent-skills`                                       |
| Fixed non-trivial bug     | Run `/workflows:compound`                                   |

### Compound Engineering Workflows

| Command               | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `/workflows:plan`     | Research and create implementation plans      |
| `/workflows:work`     | Execute plans systematically                  |
| `/workflows:review`   | Multi-agent code review (8 reviewers)         |
| `/workflows:compound` | Document solved problems to `docs/solutions/` |

## Key Documentation

- `DEVELOPING.md` - Full development workflow, all commands
- `ARCHITECTURE.md` - System design overview
- `DECISIONS.md` - Architectural Decision Records index
- `docs/design/BRAND_VOICE_GUIDE.md` - UI/UX, voice, Apple-quality standards
- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Prevention patterns cheat sheet
- `docs/architecture/BUILD_MODE_VISION.md` - Agent-first storefront editor

## Common Pitfalls

Numbered for searchability. When encountering issues, search `docs/solutions/` for detailed analysis.

1. Forgetting tenant scoping in queries
2. Cache key collisions (missing tenantId)
3. Skipping transaction locks for booking creation
4. Webhook replay attacks (check idempotency)
5. Removing ts-rest `{ req: any }` in route handlers (library limitation)
6. Type safety bypass with `as any` (use type guards or `as unknown as Type`)
7. Missing Next.js error boundaries (`error.tsx`)
8. Console.log instead of `logger` utility
9. Duplicate data fetching (wrap with React `cache()`)
10. Wrong underscore prefix for "unused" vars that ARE used
11. Circular dependencies in agent modules (check with `npx madge --circular`)
12. T2 proposal confirms but never executes (ensure executor registered)
13. Field name mismatches in DTOs (use canonical names from contracts)
14. Singleton caches preventing DI (export class + factory)
15. Missing cache invalidation after writes
16. Early return before hooks (violates Rules of Hooks)
17. Symlinks in TypeScript src directories (causes double compilation)
18. TOCTOU on JSON field validation (wrap in `$transaction` + advisory lock)
19. Duplicated tool logic (extract to `agent/utils/`)
20. Dual-mode orchestrator method inconsistency (if one checks mode, ALL must)
21. E2E rate limiter misses (ALL need `isTestEnvironment` check)
22. Form hydration race (add 500ms wait after `waitForSelector`)
23. Session leak in E2E (use `browser.newContext()`)
24. UUID validation on CUID fields (use `z.string()` not `z.string().uuid()`)
25. Multi-path data format mismatch (verify read/write paths agree)
26. AI tool responses missing state guidance (include `hasDraft` indicator)
27. Deleting `.client.ts` files as "duplicates" (they exist for server/client boundary)
28. Trust tier mismatch tool definition vs createProposal
29. TanStack Query staleTime blocking real-time (use `staleTime: 0`)
30. Race condition on cache invalidation (add 100ms delay)

## Prevention Strategies

Search `docs/solutions/` for specific issues. Key indexes:

- **[PREVENTION-QUICK-REFERENCE.md](docs/solutions/PREVENTION-QUICK-REFERENCE.md)** - Print and pin cheat sheet
- **[mais-critical-patterns.md](docs/solutions/patterns/mais-critical-patterns.md)** - 10 critical patterns
- **[AGENT_TOOLS_PREVENTION_INDEX.md](docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md)** - Agent tool patterns
- **[ESLINT_PREVENTION_INDEX.md](docs/solutions/patterns/ESLINT_PREVENTION_INDEX.md)** - Dead code prevention

When you hit an issue:

1. Search `grep -r "keyword" docs/solutions/`
2. If not found, fix it, then run `/workflows:compound` to document

## UI/UX Standards

**Before any UI work:** Load `frontend-design` skill + read `docs/design/BRAND_VOICE_GUIDE.md`

Quick reference: Generous whitespace (`py-32`), 80% neutral / 20% sage accent, serif headlines, `rounded-3xl shadow-lg` cards, always include hover states.

## Project Structure

```
apps/web/src/
├── app/                # Next.js App Router pages
│   ├── t/[slug]/      # Tenant storefronts
│   └── (protected)/   # Admin routes
├── components/        # React components
│   ├── ui/           # Shared UI
│   └── tenant/       # Tenant-specific
└── lib/              # Utilities (auth, tenant, api, logger)

server/src/
├── routes/           # HTTP handlers (ts-rest)
├── services/         # Business logic
├── adapters/         # External integrations
│   ├── prisma/      # Database
│   └── mock/        # In-memory for testing
├── agent/           # AI agent system
│   ├── customer/    # Customer chatbot
│   ├── onboarding/  # Business advisor
│   └── tools/       # Agent tools
└── di.ts            # Dependency injection
```

## Environment

Required: `JWT_SECRET`, `TENANT_SECRETS_ENCRYPTION_KEY`, `DATABASE_URL`

Optional: `POSTMARK_SERVER_TOKEN`, `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`

Run `npm run doctor` to verify setup.
