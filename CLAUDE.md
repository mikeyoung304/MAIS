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

| Subsystem                      | Reference                                              |
| ------------------------------ | ------------------------------------------------------ |
| Layered architecture           | `server/src/di.ts`, `server/src/lib/ports.ts`          |
| Port interfaces                | `ITenantRepository`, `BookingRepository` in `ports.ts` |
| Type-safe API contracts        | `packages/contracts/`, ts-rest + Zod                   |
| AI Agents (Vertex AI + ADK)    | `server/src/agent-v2/`, 3-agent architecture           |
| Agent deployment               | `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`       |
| Build mode (storefront editor) | `docs/architecture/BUILD_MODE_VISION.md`               |
| Landing page config            | `apps/web/src/lib/tenant.ts`, `normalizeToPages()`     |
| Double-booking prevention      | ADR-013, advisory locks, `booking.service.ts`          |
| Webhook idempotency            | `webhookEvent` table, ADR-002                          |

### Storefront Storage (Phase 5)

**Current state:** Storefront content uses normalized `SectionContent` table instead of legacy JSON columns.

| Storage                           | Purpose            | Access                                  |
| --------------------------------- | ------------------ | --------------------------------------- |
| `SectionContent` (isDraft: true)  | Draft sections     | Agent tools via `SectionContentService` |
| `SectionContent` (isDraft: false) | Published sections | Public storefront via `/sections` API   |
| `landingPageConfig` (legacy)      | READ-ONLY fallback | Public routes during transition         |

- **AI agent edits** via `SectionContentService.updateSection()` → writes to `SectionContent` table
- **Publish** via `SectionContentService.publishAll()` → copies draft rows to published
- **Single source of truth**: `SectionContentService` in `server/src/services/section-content.service.ts`

### Agent Architecture (3 Agents on Cloud Run)

| Agent          | Cloud Run Service | Tools | Purpose                                                         |
| -------------- | ----------------- | ----- | --------------------------------------------------------------- |
| customer-agent | `customer-agent`  | 13    | Service discovery, booking, project hub (customer view)         |
| tenant-agent   | `tenant-agent`    | 34    | Storefront editing, marketing, project management (tenant view) |
| research-agent | `research-agent`  | —     | Web research (unchanged)                                        |

**Key Files:** Service registry at `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`

## Development Workflow

### Adding Multi-Tenant Features

1. All queries filter by `tenantId`
2. Verify tenant owns resource before mutations
3. Use `res.locals.tenantAuth.tenantId` from JWT middleware
4. Include `tenantId` in all cache keys

### Database Migrations

```bash
npx prisma migrate dev --name descriptive_name           # Standard
npx prisma migrate dev --create-only --name descriptive_name  # Custom SQL
```

### Bundle Size Thresholds

- **Small:** <10 KB gzipped — generally acceptable
- **Medium:** 10-50 KB gzipped — justify with UX benefit
- **Large:** >50 KB gzipped — requires approval + alternatives evaluation

See `docs/architecture/PHASE_4_5_BUNDLE_ANALYSIS.md` for detailed template.

## Domain Expertise (Auto-Load Skills)

| When Working On...        | Load Skill                                                      |
| ------------------------- | --------------------------------------------------------------- |
| UI/components/pages       | `frontend-design` + read `docs/design/VOICE_QUICK_REFERENCE.md` |
| AI/agent features         | `agent-native-architecture`                                     |
| Creating skills/workflows | `create-agent-skills`                                           |

## Key Documentation

- `DEVELOPING.md` - Full development workflow, all commands
- `ARCHITECTURE.md` - System design overview
- `DECISIONS.md` - Architectural Decision Records index
- `docs/design/VOICE_QUICK_REFERENCE.md` - Brand voice rules
- `docs/design/BRAND_VOICE_GUIDE.md` - Extended UI/UX standards
- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Prevention patterns cheat sheet

## Common Pitfalls (Top 15)

> **Full list:** All 95 pitfalls are in `docs/PITFALLS_INDEX.md`. Search with `grep -n "keyword" docs/PITFALLS_INDEX.md` or `grep -r "keyword" docs/solutions/`.

1. **Forgetting tenant scoping** - ALL database queries MUST filter by `tenantId`
2. **Cache key collisions** - ALL cache keys MUST include `tenantId`
3. **Skipping transaction locks** - Booking creation requires advisory locks to prevent double-booking
4. **ts-rest `{ req: any }`** - Don't remove the `any` in route handlers; it's a library limitation
5. **Type safety bypass** - Use type guards or `as unknown as Type`, never bare `as any`
6. **Console.log** - Use `logger` utility, never `console.log`
7. **UUID on CUID fields** - MAIS uses CUIDs; use `z.string().min(1)` not `z.string().uuid()`
8. **A2A camelCase required** - Use `appName`, `userId`, `sessionId` (NOT snake_case — ADK rejects silently)
9. **LLM example responses** - Never include `You: "On it!"` in prompts; LLMs copy verbatim. Use `→ Call tool_name()`
10. **FunctionTool API mismatch** - ADK: `parameters`/`execute`, not `inputSchema`/`func`; context is `ToolContext | undefined`
11. **Dual-context prompt-only security** - Use `requireContext()` guard as FIRST LINE of tool execute, not prompt instructions
12. **Type assertion without validation** - Agent tool `execute()` MUST call `schema.safeParse(params)` as first line
13. **Unbounded database queries** - ALL `findMany` MUST have `take` parameter; max 100
14. **Orphan imports after deletions** - Run `rm -rf server/dist packages/*/dist && npm run typecheck` before committing
15. **Root vs workspace typecheck** - Root passes but workspace fails; always run workspace-level: `npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`

## UI/UX Standards

**Before any UI work:** Load `frontend-design` skill + read `docs/design/VOICE_QUICK_REFERENCE.md`

Quick reference: Generous whitespace (`py-32`), 80% neutral / 20% sage accent, serif headlines, `rounded-3xl shadow-lg` cards, always include hover states.

**Voice rules:**

- Confirmations: `got it | done | on it | heard` (tenant) / `all set | confirmed | noted` (customer)
- Forbidden: `Great! | Absolutely! | Perfect! | I'd be happy to...`
- No hype words: revolutionary, game-changing, cutting-edge, leverage, synergy

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
├── agent-v2/        # AI agent system (3-agent architecture)
│   └── deploy/      # Cloud Run agents
└── di.ts            # Dependency injection
```

## Environment

Required: `JWT_SECRET`, `TENANT_SECRETS_ENCRYPTION_KEY`, `DATABASE_URL`

Optional: `POSTMARK_SERVER_TOKEN`, `STRIPE_SECRET_KEY`

For AI features: `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION` (uses `gcloud auth application-default login`)

Run `npm run doctor` to verify setup.
