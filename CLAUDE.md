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

### Bundle Size Guidelines

**Before adding new dependencies:**

1. **Check npm package size:** `npm view <package> dist.unpackedSize`
2. **Verify tree-shaking:** Use named imports (`import { Component }`) not namespace imports (`import * as Lib`)
3. **Check for duplicates:** Run `npm ls <package> --all` to ensure no duplicate installations
4. **ESM format preferred:** Modern packages should provide `.mjs` files for optimal tree-shaking
5. **Acceptable thresholds:**
   - **Small:** <10 KB gzipped (✅ Generally acceptable)
   - **Medium:** 10-50 KB gzipped (⚠️ Justify with UX benefit)
   - **Large:** >50 KB gzipped (❌ Requires approval + alternatives evaluation)

**Example: Vaul integration (Phase 4)**

```bash
# Check package size
$ npm view vaul@1.1.2 dist.unpackedSize
184301  # ~184 KB unpacked, ~6.3 KB gzipped

# Check dependencies
$ npm view vaul@1.1.2 dependencies
{ '@radix-ui/react-dialog': '^1.1.1' }  # Already installed!

# Verify deduplication
$ npm ls @radix-ui/react-dialog
└── @radix-ui/react-dialog@1.1.15 deduped  # ✅ No duplicate

# Result: 6.3 KB net impact (acceptable for UX improvement)
```

**Documentation:** See `docs/architecture/PHASE_4_5_BUNDLE_ANALYSIS.md` for detailed analysis template.

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
31. Sage background with white text (fails WCAG AA - use teal/navy for backgrounds, sage for text only)

### ADK/A2A Pitfalls (32-44)

32. A2A camelCase required - Use `appName`, `userId`, `sessionId`, `newMessage` for A2A protocol (NOT snake_case - ADK rejects it silently)
33. App name mismatch - ADK uses DIRECTORY name for routing, NOT agent's `name` property; verify with `/list-apps` after deploy
34. Unsupported Zod types - ADK doesn't support `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()`; use `z.any()` with `.describe()`
35. A2A response format - Handle both `messages[]` and `content.parts[]` formats; fallback to JSON.stringify
36. Identity token auth - Agent-to-Agent uses metadata service; Backend-to-Agent uses GoogleAuth; both need graceful local dev fallback
37. LLM pattern-matching prompts - Never include example responses like `You: "On it!"` - LLMs copy them verbatim instead of calling tools; use action arrows like `→ Call tool_name()` instead
38. Hardcoded Cloud Run URLs - Always use environment variables; URLs contain project numbers that change
39. ADK response array format - ADK returns `[{ content: { role, parts }}]` array, not `{ messages: [...] }` object; iterate from end to find model response
40. Session ID reuse across agents - Each specialist agent needs its OWN session; orchestrator session cannot be passed to specialists
41. State Map-like API - Use `context.state?.get<T>('key')` not `context.state.key`; direct property access returns undefined
42. Missing state defaults - Always provide defaults for optional state values: `state.get('tier') ?? 'free'`
43. Zod enum vs string mismatch - Use `z.enum()` for constrained choices, `z.string()` for free-form; wrong type causes validation failures
44. Missing Cloud Run env vars - Validate required env vars at startup; use `process.env.AGENT_URL || fallback` pattern

### Agent-v2 Code Quality Pitfalls (45-51)

45. Empty secret fallback - `INTERNAL_API_SECRET || ''` masks misconfiguration; use `requireEnv()` to fail-fast at startup
46. No fetch timeouts - All `fetch()` calls need `AbortController` timeouts; 15s backend, 30s agents, 90s scraping
47. Tools return instructions - FunctionTool.execute must return results, not `{instruction: "Generate..."}` for LLM
48. Dead security functions - Writing `sanitizeScrapedContent()` but never calling it; verify security code is wired up
49. T3 without confirmation param - Trust tier enforcement must be programmatic (`confirmationReceived: z.boolean()`), not prompt-only
50. Module-level cache unbounded - `new Map()` at module level grows forever; add TTL (30 min) and max size (1000)
51. FunctionTool API mismatch - ADK uses `parameters`/`execute` not `inputSchema`/`func`; LlmAgent uses `generateContentConfig` not `config`; execute context is `ToolContext | undefined` not `ToolContext`
52. Tool confirmation-only response - Tools that modify state must return updated state, not just `{success: true}`; agent loses context and asks redundant questions
53. Discovery facts dual-source - `/store-discovery-fact` stores directly in `tenant.branding.discoveryFacts` JSON, bypassing OnboardingEvent table (intentional tech debt for shipping speed); bootstrap merges both sources with branding taking precedence over event-sourced facts

## Prevention Strategies

Search `docs/solutions/` for specific issues. Key indexes:

- **[PREVENTION-QUICK-REFERENCE.md](docs/solutions/PREVENTION-QUICK-REFERENCE.md)** - Print and pin cheat sheet
- **[mais-critical-patterns.md](docs/solutions/patterns/mais-critical-patterns.md)** - 10 critical patterns
- **[AGENT_TOOLS_PREVENTION_INDEX.md](docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md)** - Agent tool patterns
- **[AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md](docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md)** - Tool state return patterns
- **[ADK_A2A_PREVENTION_INDEX.md](docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md)** - ADK/A2A integration patterns
- **[A2A_SESSION_STATE_PREVENTION.md](docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md)** - Session isolation & state handling
- **[ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md)** - Agent dev checklist
- **[ESLINT_PREVENTION_INDEX.md](docs/solutions/patterns/ESLINT_PREVENTION_INDEX.md)** - Dead code prevention
- **[VERTEX-AI-PLAN-RETROSPECTIVE.md](docs/solutions/VERTEX-AI-PLAN-RETROSPECTIVE.md)** - Lessons learned from Phases 1-4

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

Optional: `POSTMARK_SERVER_TOKEN`, `STRIPE_SECRET_KEY`

For AI features (agent chat, onboarding): `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION` (uses Application Default Credentials via `gcloud auth application-default login`)

Run `npm run doctor` to verify setup.
