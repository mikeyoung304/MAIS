# MAIS Pitfalls Index

> **Usage:** The top 15 pitfalls are in CLAUDE.md. Search this file when working on specific subsystems.
> **Search:** `grep -n "keyword" docs/PITFALLS_INDEX.md`

## Core Pitfalls (1-15) — also in CLAUDE.md

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
12. Field name mismatches in DTOs (use canonical names from contracts)
13. Singleton caches preventing DI (export class + factory)
14. Missing cache invalidation after writes
15. Early return before hooks (violates Rules of Hooks)

## Build & Import Pitfalls (16-17)

16. Symlinks in TypeScript src directories (causes double compilation)
17. TOCTOU on JSON field validation (wrap in `$transaction` + advisory lock)

## Agent Tool Pitfalls (18-19)

18. Duplicated tool logic (extract to shared utilities in `agent-v2/deploy/*/src/tools/`)
19. E2E rate limiter misses (ALL need `isTestEnvironment` check)

## React/Frontend Pitfalls (20-23)

20. Form hydration race (add 500ms wait after `waitForSelector`)
21. Session leak in E2E (use `browser.newContext()`)
22. UUID validation on CUID fields - MAIS uses CUIDs not UUIDs; use `z.string().min(1)` not `z.string().uuid()` for ID fields
23. Deleting `.client.ts` files as "duplicates" (they exist for server/client boundary)

## Trust & Real-Time Pitfalls (24-27)

24. Trust tier mismatch tool definition vs createProposal
25. TanStack Query staleTime blocking real-time (use `staleTime: 0`)
26. Race condition on cache invalidation (add 100ms delay)
27. Sage background with white text (fails WCAG AA - use teal/navy for backgrounds, sage for text only)

## ADK/A2A Pitfalls (28-40)

28. A2A camelCase required - Use `appName`, `userId`, `sessionId`, `newMessage` for A2A protocol (NOT snake_case - ADK rejects it silently)
29. App name mismatch - ADK uses DIRECTORY name for routing, NOT agent's `name` property; verify with `/list-apps` after deploy
30. Unsupported Zod types - ADK doesn't support `z.record()`, `z.tuple()`, `z.intersection()`, `z.lazy()`; use `z.any()` with `.describe()`
31. A2A response format - Handle both `messages[]` and `content.parts[]` formats; fallback to JSON.stringify
32. Identity token auth - Agent-to-Agent uses metadata service; Backend-to-Agent uses GoogleAuth; both need graceful local dev fallback
33. LLM pattern-matching prompts - Never include example responses like `You: "On it!"` - LLMs copy them verbatim instead of calling tools; use action arrows like `→ Call tool_name()` instead
34. Hardcoded Cloud Run URLs - Always use environment variables; URLs contain project numbers that change
35. ADK response array format - ADK returns `[{ content: { role, parts }}]` array, not `{ messages: [...] }` object; iterate from end to find model response
36. Session ID reuse across agents - Each specialist agent needs its OWN session; orchestrator session cannot be passed to specialists
37. State Map-like API - Use `context.state?.get<T>('key')` not `context.state.key`; direct property access returns undefined
38. Missing state defaults - Always provide defaults for optional state values: `state.get('tier') ?? 'free'`
39. Zod enum vs string mismatch - Use `z.enum()` for constrained choices, `z.string()` for free-form; wrong type causes validation failures
40. Missing Cloud Run env vars - Validate required env vars at startup; use `process.env.AGENT_URL || fallback` pattern

## Agent-v2 Code Quality Pitfalls (41-49)

41. Empty secret fallback - `INTERNAL_API_SECRET || ''` masks misconfiguration; use `requireEnv()` to fail-fast at startup
42. No fetch timeouts - All `fetch()` calls need `AbortController` timeouts; 15s backend, 30s agents, 90s scraping
43. Tools return instructions - FunctionTool.execute must return results, not `{instruction: "Generate..."}` for LLM
44. Dead security functions - Writing security functions but never calling them; verify security code is actually wired up in the code path
45. T3 without confirmation param - Trust tier enforcement must be programmatic (`confirmationReceived: z.boolean()`), not prompt-only
46. Module-level cache unbounded - `new Map()` at module level grows forever; add TTL (30 min) and max size (1000)
47. FunctionTool API mismatch - ADK uses `parameters`/`execute` not `inputSchema`/`func`; LlmAgent uses `generateContentConfig` not `config`; execute context is `ToolContext | undefined` not `ToolContext`
48. Tool confirmation-only response - Tools that modify state must return updated state, not just `{success: true}`; agent loses context and asks redundant questions
49. Discovery facts dual-source - `/store-discovery-fact` stores directly in `tenant.branding.discoveryFacts` JSON, bypassing OnboardingEvent table (intentional tech debt for shipping speed); bootstrap merges both sources with branding taking precedence over event-sourced facts

## Deployment Architecture Pitfalls (50-51)

50. Dual deployment architecture - Backend (Render) and Frontend (Vercel) auto-deploy on push to `main`, but Agents (Cloud Run) deploy via separate GitHub Actions workflow; if workflow fails silently, agent features appear broken in production despite code being merged
51. Agent deployment verification - After merging agent changes, verify deployment succeeded in GitHub Actions → "Deploy AI Agents to Cloud Run"; manual deploy: `cd server/src/agent-v2/deploy/[agent] && npm run deploy`

## CI/CD Pitfalls (52-53)

52. Silent CI failures via continue-on-error - Never use `continue-on-error: true` on test steps; code merges but doesn't deploy because tests "pass" while actually failing; use only for informational steps (coverage upload, notifications). See `docs/solutions/ci-cd/SILENT_CI_FAILURES_PREVENTION.md`
53. Migration rollback file anti-pattern - Never create paired rollback files (`16_feature.sql` + `16_feature_rollback.sql`); rollback runs AFTER original alphabetically, undoing changes and causing schema drift between environments; use forward-only migrations with unique numbers. See `docs/solutions/database-issues/MIGRATION_ROLLBACK_ANTIPATTERN.md`

## Dual-Context Agent Pitfalls (54-55)

54. Dual-context prompt-only security - Never rely on system prompt for tool access control in agents serving multiple user types; use `requireContext()` guard as FIRST LINE of every tool execute function; prompt injection can bypass prompt-based security. See `docs/solutions/patterns/DUAL_CONTEXT_AGENT_TOOL_ISOLATION_PREVENTION.md`
55. Context from user input - Always use session state for `contextType`, never parse from user message; session is set by backend and trusted, user input is not; a customer saying "I am a tenant" must not grant tenant privileges

## Type Safety Pitfalls (56-57)

56. Type assertion without validation / missing Zod safeParse - Never use `params as { foo: string }` on runtime data (API requests, tool params, JSON fields); agent tool `execute()` MUST call `schema.safeParse(params)` as FIRST LINE; return `{ success: false, error }` on parse failure; never use `params as Type`. See `docs/solutions/patterns/ZOD_PARAMETER_VALIDATION_PREVENTION.md`
57. Using `.parse()` without error handling - Always use `safeParse()` which returns a result object; `.parse()` throws exceptions that crash the agent

## Security & Performance Pitfalls (58-62)

58. Email-based auth on sensitive routes - Never use email lookup alone for password reset, account changes, or billing; use signed tokens with expiration and timing-safe comparison. See `docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md`
59. Missing rate limiting on authenticated routes - ALL routes need rate limiting; authenticated routes use tenant-scoped limits (`keyGenerator: (req, res) => res.locals.tenantAuth?.tenantId`); see rateLimiter.ts for patterns
60. Unbounded database queries - ALL `findMany` calls MUST have `take` parameter with enforced maximum; return `hasMore` indicator; never allow client-requested limit > MAX_PAGE_SIZE (100)
61. Sequential queries that could be parallel - Use `Promise.all()` for independent queries; prefer Prisma `include` for related data; sequential-only when result of query A needed for query B
62. Hardcoded optimistic lock versions - NEVER use `expectedVersion: 1`; always pass version from client state; API responses must include `version` field; mutations increment with `version: { increment: 1 }`

## Over-Engineering Pitfalls (63-71)

63. Over-engineering "enterprise" features - Check if npm package exists before custom implementation, verify feature is actually required (link to issue), prefer simple Map before LRU before Redis, use single safety mechanism per concern (not Serializable + advisory lock + optimistic versioning). See `docs/solutions/OVER_ENGINEERING_DETECTION_QUICK_REFERENCE.md`
64. Custom LRU cache when lru-cache installed - Check `npm ls lru-cache` before writing cache code; existing package is battle-tested, custom 248-line implementation is not
65. Dead audit/metrics modules - Modules with <20% export usage are YAGNI violations; use direct logger calls instead of 196-line wrapper modules
66. Serializable + advisory locks - Pick ONE concurrency mechanism; Serializable isolation is expensive and redundant when advisory locks already serialize access
67. Array.shift() in metrics/rolling windows - O(n) operation on every call; use ring buffer for O(1) latency recording
68. Static config for tenant-specific URLs - Never use `config.SUCCESS_URL` or `process.env.CALLBACK_URL` for URLs that route customers back to tenant storefronts; build URLs dynamically with `${baseUrl}/t/${tenant.slug}/...` at request time and include `tenantSlug` in external service metadata for webhook routing. See `docs/solutions/patterns/STATIC_CONFIG_MULTI_TENANT_PREVENTION.md`
69. Environment variable URL missing protocol - `CORS_ORIGIN=www.example.com` creates malformed URLs when concatenated; must include protocol: `CORS_ORIGIN=https://www.example.com`; verify in logs after deployment
70. Invalid API keys causing mysterious 404s - Stripe/external API 401 errors can manifest as 404 NOT_FOUND in client; validate API keys on server startup with connectivity test; check server logs for real error chain. See `docs/solutions/integration-issues/booking-flow-404-invalid-stripe-key-stale-cache.md`
71. Stale Next.js build cache after env changes - `.next/` directory serves cached JavaScript even after environment variable changes; always `rm -rf apps/web/.next` when debugging mysterious runtime behavior; consider auto-clearing cache when .env changes

## Port Interface & Testing Pitfalls (72-74)

72. Repository without port interface - Concrete repository classes (e.g., `PrismaTenantRepository`) should implement a port interface (e.g., `ITenantRepository`) for testability; without it, unit tests require full database setup or complex mocking
73. Duplicate queries across service chain - When method A fetches data then calls method B which fetches the same data, pass pre-fetched data as optional parameter: `methodB(input, prefetchedData?)`. Example: `createCheckout(input, prefetchedPackage?)` avoids re-fetching package. See `wedding-booking.orchestrator.ts`
74. Missing payment service tests - Payment-related services (RefundProcessingService, WeddingDepositService, CheckoutSessionFactory, AppointmentBookingService) handle real money; require comprehensive test coverage including error paths, idempotency, and multi-tenant isolation

## Token-Based Auth Pitfalls (75)

75. Token generation/validation identifier mismatch - When generating JWT tokens, ensure the SAME field is used for both generation AND validation; `project.customerId` (email) vs `project.booking.customer?.id` (CUID) caused 403 errors; document field types in comments (email vs CUID vs UUID). See `docs/solutions/authentication-issues/project-hub-token-validation-customerid-mismatch.md`

## Service Wiring Pitfalls (76-77)

76. Orphan service pattern - Creating a service class but never importing/calling it in routes; verify with `grep -rn "import.*ServiceName" server/src/`; ESLint doesn't catch unused exports across files; detect via log prefix mismatch (old `"error"` vs new `'[Service] error'`). See `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`
77. Fake session ID pattern - Generating local IDs like `project-${id}-${Date.now()}` instead of calling ADK `createSession()`; E2E test must send 2+ messages to catch this; fake sessions fail on second message with "Session not found"; use `LOCAL:` prefix if fallback is intentional. See `docs/solutions/patterns/SERVICE_WIRING_AND_FAKE_SESSION_PREVENTION.md`

## React Query Pitfalls (78)

78. Module-level QueryClient singleton - Using `let queryClientRef: QueryClient | null = null` set via useEffect, then calling from external code; fails because: (1) React effects run in unpredictable order, (2) HMR resets module state but not the ref, (3) SSR hydration mismatches. Use `useQueryClient()` hook or create QueryClient at module scope in `lib/query-client.ts` and import that instance. See `docs/solutions/react-performance/MODULE_LEVEL_QUERY_CLIENT_SINGLETON_PREVENTION.md`

## Build & Refactoring Pitfalls (79)

79. Orphan imports after large deletions - Deleted file/function but forgot to update importers; incremental TypeScript build passes locally (unchanged files skipped), clean CI build fails with "cannot find module"; ALWAYS run `rm -rf server/dist packages/*/dist && npm run typecheck` before committing deletions. Archive branches provide rollback but NOT prevention. See `docs/solutions/build-errors/ORPHAN_IMPORTS_LARGE_DELETION_PREVENTION.md`

## Agent Onboarding Pitfalls (80)

80. Fact-to-Storefront bridge missing - Agent stores discovery facts via `store_discovery_fact` but fails to apply them via `delegate_to_storefront`; user says "my about section should mention X" and agent stores the fact but never updates the storefront; Cloud Run logs show `storefront-agent` at 0 req/sec confirming no delegation; when user provides SECTION + CONTENT, agent MUST call BOTH `store_discovery_fact` AND `delegate_to_storefront` in the same turn. See `docs/solutions/agent-issues/FACT_TO_STOREFRONT_BRIDGE_PREVENTION.md`

## CI/CD Agent Deployment Pitfalls (81)

81. ADK deployment without .env in CI - ADK `deploy cloud_run` reads `.env` file to know what runtime env vars to set on Cloud Run; in CI environments where `.env` is gitignored, ADK logs "injecting env (0)" and deployment silently fails with "Missing required environment variable" but reports SUCCESS because error isn't propagated; ALWAYS create `.env` from GitHub Secrets before ADK deploy AND use `set -e` to fail-fast. See `docs/solutions/agent-issues/AGENT_FAILURES.md` (Root Cause section).

## Agent-Frontend Integration Pitfalls (82-83)

82. dashboardAction not extracted from tool results - Agent tools return `dashboardAction` objects in their results (e.g., `{type: 'NAVIGATE', section: 'website'}`), but frontend only checked tool NAMES for heuristics; must extract `call.result?.dashboardAction` and process action types (NAVIGATE, SCROLL_TO_SECTION, SHOW_PREVIEW, REFRESH); symptom: agent says "Take a look" but nothing happens in UI. See `apps/web/src/components/agent/AgentPanel.tsx` `handleConciergeToolComplete` for correct pattern.
83. Agent asking known questions (P0) - Agent repeatedly asks "What do you do?" when it already knows; root cause: context not injected at session creation, only `tenantId` passed to ADK; fix: use `ContextBuilder.getBootstrapData()` and pass `forbiddenSlots[]` at session start; use **slot-policy** (key-based) not phrase-matching; agent checks slot keys not question phrases. See `docs/solutions/patterns/SLOT_POLICY_CONTEXT_INJECTION_PATTERN.md`

## Workspace Build Pitfalls (84-85)

84. Root-level typecheck passes but workspace fails - Root `npm run typecheck` may pass while `npm run --workspace=server typecheck` fails; CI must run WORKSPACE-LEVEL checks: `npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`; root-level only validates project references exist, not workspace internals; caused by symlinks, missing exports, or Prisma path issues that incremental compilation masks. **ALWAYS verify locally**: `rm -rf server/dist packages/*/dist && npm run --workspace=server typecheck && npm run --workspace=apps/web typecheck`
85. Comment-code mismatch in DI wiring - Comment says "use X service instead" but actual code line was never added; services object in `app.ts` must explicitly include EVERY service that routes depend on; TypeScript won't catch this because the Services interface has optional fields (`?`); symptom: 503 "Service not configured" in routes that check `if (!service)`; always verify DI wiring by searching for both the comment AND the actual assignment. See commit `4cd02a55`.

## Agent Onboarding Workflow Pitfalls (86)

86. Agent onboarding says "first draft" but shows placeholders - Agent system prompt says "build in background" but doesn't specify HOW; the only described workflow requires user approval before `update_section`; agent stores facts but never autonomously updates content; symptom: agent says "Take a look - I put together a first draft" but preview shows placeholder content; fix: add explicit "First Draft Workflow (Autonomous)" section to system prompt that triggers after 2-3 facts and calls `update_section` WITHOUT waiting for approval. See `docs/solutions/agent-issues/AUTONOMOUS_FIRST_DRAFT_WORKFLOW.md`

## Zustand State Management Pitfalls (87)

87. Zustand selector returning new object causes re-renders - Selectors that return `{ computed: value }` create a new object on every call; Zustand's shallow comparison sees `{} !== {}` and triggers re-render even when values unchanged; symptom: component re-renders on ANY store update, not just relevant fields; fix: use `useShallow` from `zustand/shallow` OR split into primitive selectors OR use `createSelector` from reselect. See `docs/solutions/react-performance/ZUSTAND_SELECTOR_NEW_OBJECT_PREVENTION.md`

## PostMessage Protocol Pitfalls (88)

88. Dead PostMessage handlers (zombie code) - Handler case statements exist but nothing sends the message type; handlers LOOK used but never execute; symptom: debugging shows unreachable code paths; detection: run `grep` for both sender (`postMessage.*TYPE`) AND handler (`case.*TYPE`) - if handler exists but no sender, it's dead; ~40% of MAIS Build Mode handlers were dead (5 types removed in #821); verify BOTH directions before code review approval. See `docs/solutions/patterns/POSTMESSAGE_QUICK_REFERENCE.md`

## React Hooks Time-Dependent Pitfalls (89)

89. useMemo stale timer pattern - Using `useMemo` to calculate elapsed time with `Date.now()` but only static dependencies like `[order.created_at]`; timer shows correct initial value then freezes forever because dependency never changes; symptom: "Timer stuck at 0m", "Works after page refresh"; fix: use `useState` + `useEffect` with `setInterval` to create a `now` dependency that updates periodically; ESLint won't catch this (Date.now() inside useMemo is syntactically valid). See `docs/solutions/react-performance/USEMEMO_STALE_TIMER_PREVENTION.md`

## Migration Drift Pitfalls (90)

90. Dual-system migration drift (P0 risk) - "During migration" technical debt where NEW system has features but OLD system is still used; symptom: Agent asks "What do you do?" when it already knows (context injection exists in backend but frontend uses fake session IDs); detection: `grep "during migration"` comments older than 30 days, OLD system at 100% traffic; fix: max 30-day migration timeline, comment format `// MIGRATION[name]: expires YYYY-MM-DD: reason`, E2E tests must send 2+ messages to catch fake sessions; fake sessions pass single-message tests but fail on second with "session not found". See `docs/solutions/patterns/DUAL_SYSTEM_MIGRATION_DRIFT_PREVENTION.md`

## CI Test Discovery & Onboarding UX Pitfalls (91-92)

91. CI test:unit only scans test/ directory - Root `package.json` `test:unit` passes `test/` as vitest path argument; tests placed in `server/src/` are invisible to CI even though local `npm run test:coverage` finds them; symptom: coverage unchanged after adding tests, local shows improvement but CI doesn't; fix: place all test files in `server/test/`, mirror source path (`src/lib/foo.ts` → `test/lib/foo.test.ts`); verify with `npm run test:unit 2>&1 | grep "your-test"`. See `docs/solutions/ci-cd/CI_TEST_DISCOVERY_PER_DIRECTORY_COVERAGE_THRESHOLDS.md`
92. Zustand actions bypassing coming_soon state - `showPreview()`, `showDashboard()`, `highlightSection()` can override `coming_soon` view state during onboarding; symptom: "Coming Soon" display switches to placeholder website before first draft is ready; fix: add `if (state.view.status === 'coming_soon') return;` guard to ALL actions that change `view.status`; only `revealSite()` should transition from `coming_soon`; also: always `await queryClient.invalidateQueries()` before calling `agentUIActions.refreshPreview()` — fire-and-forget invalidation sends stale data to iframe. See `docs/solutions/ui-bugs/ONBOARDING_PREVIEW_STATE_GUARDS_AND_STALE_IFRAME_FIX.md`

## Staged Reveal & LLM Mutation Pitfalls (93-95)

93. Missing reveal scope for staged-reveal UI - Any UI that shows content progressively (onboarding reveal, wizard steps, beta rollout) needs an explicit scope definition: which items are visible at each stage; without it, default `visible: true` flags leak placeholder content into the reveal; fix: add a stage flag (`isRevealMVP`) to the canonical item list and derive visibility/thresholds from it; ONE definer, N consumers. See `docs/solutions/ui-bugs/ONBOARDING_REVEAL_SCOPE_PREVENTION.md`
94. Prompt-only enforcement for LLM mutations affecting money/trust - Relying solely on system prompt to tell the LLM "delete default packages before creating new ones"; LLM skips the step silently, users see 6 packages (3 real + 3 $0 defaults); fix: belt-and-suspenders — keep the prompt instruction AND add programmatic cleanup in tool `execute()` as non-fatal fallback; applies to any mutation affecting financial data, visible storefront content, or booking flows. See `docs/solutions/ui-bugs/ONBOARDING_REVEAL_SCOPE_PREVENTION.md`
95. Auto-reveal trigger on first write instead of completion count - Triggering a staged reveal after the FIRST content write instead of after ALL required items are written; user sees partial content flash; fix: use a cumulative counter (module-scoped `let` for single-consumer state) that triggers only when `count >= DERIVED_THRESHOLD`; threshold must be derived from the canonical scope definition, not hardcoded. See `docs/solutions/ui-bugs/ONBOARDING_REVEAL_SCOPE_PREVENTION.md`

---

_Extracted from CLAUDE.md during tooling audit (2026-02-11). Search `docs/solutions/` for detailed fix documentation._
