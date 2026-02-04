# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HANDLED (gethandled.ai) is a membership platform for service professionals — photographers, coaches, therapists, wedding planners — combining done-for-you tech with done-with-you education. Built as a multi-tenant modular monolith with Express + React, featuring complete data isolation, config-driven architecture, and mock-first development.

**Tech Stack:** Express 4, TypeScript 5.9.3 (strict), Prisma 7, PostgreSQL | React 18, Next.js 14 App Router, TailwindCSS | ts-rest + Zod | Vitest, Playwright

**Status:** Production-ready on `main`. Next.js migration complete. Agent-powered onboarding complete. Recent: Type safety improvements (2026-01-26).

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
| Agent architecture (Phase 4)   | customer-agent, tenant-agent, research-agent           |
| Agent context (Agent-First)    | `server/src/services/context-builder.service.ts`       |
| Build mode (storefront editor) | `docs/architecture/BUILD_MODE_VISION.md`               |
| Landing page config            | `apps/web/src/lib/tenant.ts`, `normalizeToPages()`     |
| Double-booking prevention      | ADR-013, advisory locks, `booking.service.ts`          |
| Webhook idempotency            | `webhookEvent` table, ADR-002                          |

### Storefront Storage (Phase 5 - February 2026)

**Current state (2026-02-02):** Storefront content uses normalized `SectionContent` table instead of legacy JSON columns.

| Storage                           | Purpose            | Access                                  |
| --------------------------------- | ------------------ | --------------------------------------- |
| `SectionContent` (isDraft: true)  | Draft sections     | Agent tools via `SectionContentService` |
| `SectionContent` (isDraft: false) | Published sections | Public storefront via `/sections` API   |
| `landingPageConfig` (legacy)      | READ-ONLY fallback | Public routes during transition         |

**Key behaviors:**

- **AI agent edits** via `SectionContentService.updateSection()` → writes to `SectionContent` table
- **Publish** via `SectionContentService.publishAll()` → copies draft rows to published
- **Section-level operations** → CRUD individual sections without touching entire config
- **Single source of truth**: `SectionContentService` in `server/src/services/section-content.service.ts`

**Deleted (2026-02-02):** `LandingPageService`, `landing-page-utils.ts`, tenant-admin-landing-page routes, and legacy repository methods. See `docs/plans/2026-02-02-refactor-section-content-migration-plan.md`.

**Use `repo-research-analyst` agent** for codebase exploration when context is unclear.

### Agent Architecture (Phase 4 - January 2026)

MAIS uses 3 consolidated AI agents deployed to Cloud Run:

| Agent          | Cloud Run Service | Tools | Purpose                                                         |
| -------------- | ----------------- | ----- | --------------------------------------------------------------- |
| customer-agent | `customer-agent`  | 13    | Service discovery, booking, project hub (customer view)         |
| tenant-agent   | `tenant-agent`    | 24    | Storefront editing, marketing, project management (tenant view) |
| research-agent | `research-agent`  | —     | Web research (unchanged)                                        |

**Environment Variables:**

- `CUSTOMER_AGENT_URL` - Unified customer-facing agent (booking + project-hub customer)
- `TENANT_AGENT_URL` - Unified tenant-facing agent (storefront + marketing + project-hub tenant)
- `RESEARCH_AGENT_URL` - Web research agent

**Archived Agents** (5 total, in `server/src/agent-v2/archive/`):

- `booking-agent` → migrated to customer-agent
- `project-hub-agent` → split between customer-agent and tenant-agent
- `storefront-agent` → migrated to tenant-agent
- `marketing-agent` → migrated to tenant-agent
- `concierge-agent` → migrated to tenant-agent

**Key Files:**

- Service registry: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`
- Customer agent: `server/src/agent-v2/deploy/customer/`
- Tenant agent: `server/src/agent-v2/deploy/tenant/`
- Migration plan: `docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md`

## Development Workflow

### Adding Multi-Tenant Features

1. All queries filter by `tenantId`
2. Verify tenant owns resource before mutations
3. Use `res.locals.tenantAuth.tenantId` from JWT middleware
4. Include `tenantId` in all cache keys

### Database Migrations

All migrations use Prisma:

```bash
# Standard migration
npx prisma migrate dev --name descriptive_name

# Custom SQL (enums, RLS, indexes)
npx prisma migrate dev --create-only --name descriptive_name
# Edit the migration.sql, then:
npx prisma migrate dev
```

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

| When Working On...        | Load Skill                                                      |
| ------------------------- | --------------------------------------------------------------- |
| UI/components/pages       | `frontend-design` + read `docs/design/VOICE_QUICK_REFERENCE.md` |
| AI/agent features         | `agent-native-architecture`                                     |
| Creating skills/workflows | `create-agent-skills`                                           |
| Fixed non-trivial bug     | Run `/workflows:compound`                                       |

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
- `docs/design/VOICE_QUICK_REFERENCE.md` - Brand voice rules (print and pin!)
- `docs/design/BRAND_VOICE_GUIDE.md` - Extended UI/UX, Apple-quality standards
- `docs/solutions/PREVENTION-QUICK-REFERENCE.md` - Prevention patterns cheat sheet
- `docs/architecture/BUILD_MODE_VISION.md` - Agent-first storefront editor
- `server/src/agent-v2/shared/voice.ts` - Shared voice module for all agents

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
12. _Retired: Legacy orchestrator pitfall removed in migration_
13. Field name mismatches in DTOs (use canonical names from contracts)
14. Singleton caches preventing DI (export class + factory)
15. Missing cache invalidation after writes
16. Early return before hooks (violates Rules of Hooks)
17. Symlinks in TypeScript src directories (causes double compilation)
18. TOCTOU on JSON field validation (wrap in `$transaction` + advisory lock)
19. Duplicated tool logic (extract to shared utilities in `agent-v2/deploy/*/src/tools/`)
20. _Retired: Legacy orchestrator pitfall removed in migration_
21. E2E rate limiter misses (ALL need `isTestEnvironment` check)
22. Form hydration race (add 500ms wait after `waitForSelector`)
23. Session leak in E2E (use `browser.newContext()`)
24. UUID validation on CUID fields (use `z.string()` not `z.string().uuid()`)
25. _Retired: Multi-path data format mismatch (obsolete after Phase 5 Section Content Migration)_
26. _Retired: AI tool responses missing state guidance (obsolete - SectionContentService now canonical)_
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
48. Dead security functions - Writing security functions but never calling them; verify security code is actually wired up in the code path
49. T3 without confirmation param - Trust tier enforcement must be programmatic (`confirmationReceived: z.boolean()`), not prompt-only
50. Module-level cache unbounded - `new Map()` at module level grows forever; add TTL (30 min) and max size (1000)
51. FunctionTool API mismatch - ADK uses `parameters`/`execute` not `inputSchema`/`func`; LlmAgent uses `generateContentConfig` not `config`; execute context is `ToolContext | undefined` not `ToolContext`
52. Tool confirmation-only response - Tools that modify state must return updated state, not just `{success: true}`; agent loses context and asks redundant questions
53. Discovery facts dual-source - `/store-discovery-fact` stores directly in `tenant.branding.discoveryFacts` JSON, bypassing OnboardingEvent table (intentional tech debt for shipping speed); bootstrap merges both sources with branding taking precedence over event-sourced facts

### Deployment Architecture Pitfalls (54-55)

54. Dual deployment architecture - Backend (Render) and Frontend (Vercel) auto-deploy on push to `main`, but Agents (Cloud Run) deploy via separate GitHub Actions workflow; if workflow fails silently, agent features appear broken in production despite code being merged
55. Agent deployment verification - After merging agent changes, verify deployment succeeded in GitHub Actions → "Deploy AI Agents to Cloud Run"; manual deploy: `cd server/src/agent-v2/deploy/[agent] && npm run deploy`

### Data Format Pitfalls (56-57) - RETIRED

56. _Retired: Incomplete landingPageConfig wrapper (obsolete - SectionContent table replaces JSON columns)_
57. _Retired: Wrapper format not extracted on READ (obsolete after Phase 5 Section Content Migration)_

### CI/CD Pitfalls (58-59)

58. Silent CI failures via continue-on-error - Never use `continue-on-error: true` on test steps; code merges but doesn't deploy because tests "pass" while actually failing; use only for informational steps (coverage upload, notifications). See `docs/solutions/ci-cd/SILENT_CI_FAILURES_PREVENTION.md`
59. Migration rollback file anti-pattern - Never create paired rollback files (`16_feature.sql` + `16_feature_rollback.sql`); rollback runs AFTER original alphabetically, undoing changes and causing schema drift between environments; use forward-only migrations with unique numbers. See `docs/solutions/database-issues/MIGRATION_ROLLBACK_ANTIPATTERN.md`

### Dual-Context Agent Pitfalls (60-61)

60. Dual-context prompt-only security - Never rely on system prompt for tool access control in agents serving multiple user types; use `requireContext()` guard as FIRST LINE of every tool execute function; prompt injection can bypass prompt-based security. See `docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md`
61. Context from user input - Always use session state for `contextType`, never parse from user message; session is set by backend and trusted, user input is not; a customer saying "I am a tenant" must not grant tenant privileges

### Type Safety Pitfalls (62-64)

62. Type assertion without validation - Never use `params as { foo: string }` on runtime data (API requests, tool params, JSON fields); use Zod `safeParse()` as FIRST LINE of tool execute functions. See `docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md`
63. Using `.parse()` without error handling - Always use `safeParse()` which returns a result object; `.parse()` throws exceptions that crash the agent
64. UUID validation on CUID fields - MAIS uses CUIDs not UUIDs; use `z.string().min(1)` instead of `z.string().uuid()` for ID fields

### Security & Performance Pitfalls (65-70)

65. Email-based auth on sensitive routes - Never use email lookup alone for password reset, account changes, or billing; use signed tokens with expiration and timing-safe comparison. See `docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md`
66. Missing rate limiting on authenticated routes - ALL routes need rate limiting; authenticated routes use tenant-scoped limits (`keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId`); see rateLimiter.ts for patterns
67. Unbounded database queries - ALL `findMany` calls MUST have `take` parameter with enforced maximum; return `hasMore` indicator; never allow client-requested limit > MAX_PAGE_SIZE (100)
68. Sequential queries that could be parallel - Use `Promise.all()` for independent queries; prefer Prisma `include` for related data; sequential-only when result of query A needed for query B
69. Hardcoded optimistic lock versions - NEVER use `expectedVersion: 1`; always pass version from client state; API responses must include `version` field; mutations increment with `version: { increment: 1 }`
70. Missing Zod safeParse in agent tools - Agent tool `execute()` MUST call `schema.safeParse(params)` as FIRST LINE; return `{ success: false, error }` on parse failure; never use `params as Type`

### Over-Engineering Pitfalls (71-75)

71. Over-engineering "enterprise" features - Check if npm package exists before custom implementation, verify feature is actually required (link to issue), prefer simple Map before LRU before Redis, use single safety mechanism per concern (not Serializable + advisory lock + optimistic versioning). See `docs/solutions/OVER_ENGINEERING_DETECTION_QUICK_REFERENCE.md`
72. Custom LRU cache when lru-cache installed - Check `npm ls lru-cache` before writing cache code; existing package is battle-tested, custom 248-line implementation is not
73. Dead audit/metrics modules - Modules with <20% export usage are YAGNI violations; use direct logger calls instead of 196-line wrapper modules
74. Serializable + advisory locks - Pick ONE concurrency mechanism; Serializable isolation is expensive and redundant when advisory locks already serialize access
75. Array.shift() in metrics/rolling windows - O(n) operation on every call; use ring buffer for O(1) latency recording
76. Static config for tenant-specific URLs - Never use `config.SUCCESS_URL` or `process.env.CALLBACK_URL` for URLs that route customers back to tenant storefronts; build URLs dynamically with `${baseUrl}/t/${tenant.slug}/...` at request time and include `tenantSlug` in external service metadata for webhook routing. See `docs/solutions/patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md`
77. Environment variable URL missing protocol - `CORS_ORIGIN=www.example.com` creates malformed URLs when concatenated; must include protocol: `CORS_ORIGIN=https://www.example.com`; verify in logs after deployment
78. Invalid API keys causing mysterious 404s - Stripe/external API 401 errors can manifest as 404 NOT_FOUND in client; validate API keys on server startup with connectivity test; check server logs for real error chain. See `docs/solutions/integration-issues/booking-flow-404-invalid-stripe-key-stale-cache.md`
79. Stale Next.js build cache after env changes - `.next/` directory serves cached JavaScript even after environment variable changes; always `rm -rf apps/web/.next` when debugging mysterious runtime behavior; consider auto-clearing cache when .env changes

### Port Interface & Testing Pitfalls (80-82)

80. Repository without port interface - Concrete repository classes (e.g., `PrismaTenantRepository`) should implement a port interface (e.g., `ITenantRepository`) for testability; without it, unit tests require full database setup or complex mocking
81. Duplicate queries across service chain - When method A fetches data then calls method B which fetches the same data, pass pre-fetched data as optional parameter: `methodB(input, prefetchedData?)`. Example: `createCheckout(input, prefetchedPackage?)` avoids re-fetching package. See `wedding-booking.orchestrator.ts`
82. Missing payment service tests - Payment-related services (RefundProcessingService, WeddingDepositService, CheckoutSessionFactory, AppointmentBookingService) handle real money; require comprehensive test coverage including error paths, idempotency, and multi-tenant isolation

### Token-Based Auth Pitfalls (83)

83. Token generation/validation identifier mismatch - When generating JWT tokens, ensure the SAME field is used for both generation AND validation; `project.customerId` (email) vs `project.booking.customer?.id` (CUID) caused 403 errors; document field types in comments (email vs CUID vs UUID). See `docs/solutions/authentication-issues/project-hub-token-validation-customerid-mismatch.md`

### Service Wiring Pitfalls (84-85)

84. Orphan service pattern - Creating a service class but never importing/calling it in routes; verify with `grep -rn "import.*ServiceName" server/src/`; ESLint doesn't catch unused exports across files; detect via log prefix mismatch (old `"error"` vs new `'[Service] error'`). See `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`
85. Fake session ID pattern - Generating local IDs like `project-${id}-${Date.now()}` instead of calling ADK `createSession()`; E2E test must send 2+ messages to catch this; fake sessions fail on second message with "Session not found"; use `LOCAL:` prefix if fallback is intentional. See `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`

### React Query Pitfalls (86)

86. Module-level QueryClient singleton - Using `let queryClientRef: QueryClient | null = null` set via useEffect, then calling from external code; fails because: (1) React effects run in unpredictable order, (2) HMR resets module state but not the ref, (3) SSR hydration mismatches. Use `useQueryClient()` hook or create QueryClient at module scope in `lib/query-client.ts` and import that instance. See `docs/solutions/react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md`

### Build & Refactoring Pitfalls (87)

87. Orphan imports after large deletions - Deleted file/function but forgot to update importers; incremental TypeScript build passes locally (unchanged files skipped), clean CI build fails with "cannot find module"; ALWAYS run `rm -rf server/dist packages/*/dist && npm run typecheck` before committing deletions. Archive branches provide rollback but NOT prevention. See `docs/solutions/build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md`

### Agent Onboarding Pitfalls (88)

88. Fact-to-Storefront bridge missing - Agent stores discovery facts via `store_discovery_fact` but fails to apply them via `delegate_to_storefront`; user says "my about section should mention X" and agent stores the fact but never updates the storefront; Cloud Run logs show `storefront-agent` at 0 req/sec confirming no delegation; when user provides SECTION + CONTENT, agent MUST call BOTH `store_discovery_fact` AND `delegate_to_storefront` in the same turn. See `docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md`

### CI/CD Agent Deployment Pitfalls (89)

89. ADK deployment without .env in CI - ADK `deploy cloud_run` reads `.env` file to know what runtime env vars to set on Cloud Run; in CI environments where `.env` is gitignored, ADK logs "injecting env (0)" and deployment silently fails with "Missing required environment variable" but reports SUCCESS because error isn't propagated; ALWAYS create `.env` from GitHub Secrets before ADK deploy AND use `set -e` to fail-fast. See `docs/solutions/agent-issues/AGENT_FAILURES.md` (Root Cause section).

### Agent-Frontend Integration Pitfalls (90)

90. dashboardAction not extracted from tool results - Agent tools return `dashboardAction` objects in their results (e.g., `{type: 'NAVIGATE', section: 'website'}`), but frontend only checked tool NAMES for heuristics; must extract `call.result?.dashboardAction` and process action types (NAVIGATE, SCROLL_TO_SECTION, SHOW_PREVIEW, REFRESH); symptom: agent says "Take a look" but nothing happens in UI. See `apps/web/src/components/agent/AgentPanel.tsx` `handleConciergeToolComplete` for correct pattern.
91. Agent asking known questions (P0) - Agent repeatedly asks "What do you do?" when it already knows; root cause: context not injected at session creation, only `tenantId` passed to ADK; fix: use `ContextBuilder.getBootstrapData()` and pass `forbiddenSlots[]` at session start; use **slot-policy** (key-based) not phrase-matching; agent checks slot keys not question phrases. See `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`

### Code Path Drift Pitfalls (92) - RETIRED

92. _Retired: Code path drift in duplicate implementations (obsolete - unified through SectionContentService in Phase 5)_

### Workspace Build Pitfalls (93-94)

93. Root-level typecheck passes but workspace fails - Root `npm run typecheck` may pass while `npm run --workspace=server typecheck` fails; CI must run WORKSPACE-LEVEL checks: `npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`; root-level only validates project references exist, not workspace internals; caused by symlinks, missing exports, or Prisma path issues that incremental compilation masks. **ALWAYS verify locally**: `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
94. Comment-code mismatch in DI wiring - Comment says "use X service instead" but actual code line was never added; services object in `app.ts` must explicitly include EVERY service that routes depend on; TypeScript won't catch this because the Services interface has optional fields (`?`); symptom: 503 "Service not configured" in routes that check `if (!service)`; always verify DI wiring by searching for both the comment AND the actual assignment. See commit `4cd02a55`.

### Agent Onboarding Workflow Pitfalls (95)

95. Agent onboarding says "first draft" but shows placeholders - Agent system prompt says "build in background" but doesn't specify HOW; the only described workflow requires user approval before `update_section`; agent stores facts but never autonomously updates content; symptom: agent says "Take a look - I put together a first draft" but preview shows placeholder content; fix: add explicit "First Draft Workflow (Autonomous)" section to system prompt that triggers after 2-3 facts and calls `update_section` WITHOUT waiting for approval. See `docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md`

### Zustand State Management Pitfalls (96)

96. Zustand selector returning new object causes re-renders - Selectors that return `{ computed: value }` create a new object on every call; Zustand's shallow comparison sees `{} !== {}` and triggers re-render even when values unchanged; symptom: component re-renders on ANY store update, not just relevant fields; fix: use `useShallow` from `zustand/shallow` OR split into primitive selectors OR use `createSelector` from reselect. See `docs/solutions/react-performance/ZUSTAND_SELECTOR_NEW_OBJECT_PREVENTION.md`

## Prevention Strategies

Search `docs/solutions/` for specific issues. Key indexes:

- **[PREVENTION-QUICK-REFERENCE.md](docs/solutions/PREVENTION-QUICK-REFERENCE.md)** - Print and pin cheat sheet
- **[OVER_ENGINEERING_DETECTION_QUICK_REFERENCE.md](docs/solutions/OVER_ENGINEERING_DETECTION_QUICK_REFERENCE.md)** - Detection heuristics and decision trees
- **[MULTI_AGENT_CODE_REVIEW_PATTERNS.md](docs/solutions/code-review-patterns/MULTI_AGENT_CODE_REVIEW_PATTERNS.md)** - 6-agent parallel review process
- **[P1-SECURITY-PREVENTION-STRATEGIES.md](docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md)** - 6 P1 security issues (auth, rate limiting, pagination, parallelization, validation, locking)
- **[mais-critical-patterns.md](docs/solutions/patterns/mais-critical-patterns.md)** - 11 critical patterns
- **[AGENT_TOOLS_PREVENTION_INDEX.md](docs/solutions/patterns/AGENT_TOOLS_PREVENTION_INDEX.md)** - Agent tool patterns
- **[ZOD_PARAMETER_VALIDATION_PREVENTION.md](docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md)** - Zod validation patterns
- **[AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md](docs/solutions/patterns/AGENT_TOOL_ACTIVE_MEMORY_PREVENTION.md)** - Tool state return patterns
- **[AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md](docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md)** - First draft workflow without approval
- **[SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md](docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md)** - P0 fix: forbiddenSlots at session start
- **[ADK_A2A_PREVENTION_INDEX.md](docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md)** - ADK/A2A integration patterns
- **[A2A_SESSION_STATE_PREVENTION.md](docs/solutions/patterns/A2A_SESSION_STATE_PREVENTION.md)** - Session isolation & state handling
- **[DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md](docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md)** - Dual-context tool gating
- **[ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md](docs/solutions/patterns/ADK_AGENT_DEVELOPMENT_QUICK_REFERENCE.md)** - Agent dev checklist
- **[ESLINT_PREVENTION_INDEX.md](docs/solutions/patterns/ESLINT_PREVENTION_INDEX.md)** - Dead code prevention
- **[SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md](docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md)** - Orphan service + fake session patterns
- **[STATIC_CONFIG_MULTI_TENANT_PREVENTION.md](docs/solutions/patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md)** - Static config anti-pattern for multi-tenant URLs
- **[booking-flow-404-invalid-stripe-key-stale-cache.md](docs/solutions/integration-issues/booking-flow-404-invalid-stripe-key-stale-cache.md)** - API key validation and build cache debugging
- **[PAYMENT_SERVICE_TESTING_QUICK_REFERENCE.md](docs/solutions/testing-patterns/PAYMENT_SERVICE_TESTING_QUICK_REFERENCE.md)** - Payment service test patterns (85 tests)
- **[VERTEX-AI-PLAN-RETROSPECTIVE.md](docs/solutions/VERTEX-AI-PLAN-RETROSPECTIVE.md)** - Lessons learned from Phases 1-4
- **[MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md](docs/solutions/react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md)** - React Query singleton anti-pattern
- **[ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md](docs/solutions/build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md)** - Clean build before committing deletions

When you hit an issue:

1. Search `grep -r "keyword" docs/solutions/`
2. If not found, fix it, then run `/workflows:compound` to document

## UI/UX Standards

**Before any UI work:** Load `frontend-design` skill + read `docs/design/VOICE_QUICK_REFERENCE.md`

Quick reference: Generous whitespace (`py-32`), 80% neutral / 20% sage accent, serif headlines, `rounded-3xl shadow-lg` cards, always include hover states.

**Voice rules (print and pin):**

- Confirmations: `got it | done | on it | heard` (tenant) / `all set | confirmed | noted` (customer)
- Forbidden: `Great! | Absolutely! | Perfect! | I'd be happy to...`
- No hype words: revolutionary, game-changing, cutting-edge, leverage, synergy
- No punching down: overwhelmed, struggling, stressed, drowning

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
