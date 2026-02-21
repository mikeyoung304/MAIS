# Background Build Pipeline Patterns

Research: async AI generation with status tracking. Express 4 + Prisma 7 + React Query.

## 1. Async Job Trigger (Fire-and-Forget)

- HTTP handler validates input, writes a `Build` row (status=QUEUED), returns `202 Accepted` with `buildId` immediately.
- Spawn background work with `setImmediate(() => runBuild(buildId))` -- no external queue needed at current scale.
- Never `await` the generation inside the request handler. The HTTP response must return in <500ms.

## 2. Database State Machine

```
QUEUED -> GENERATING -> COMPLETE | PARTIAL | FAILED
```

Single Prisma model with `status` enum, `sectionsCompleted` counter, per-section status JSON, `startedAt`/`completedAt` timestamps, and `error` text. Use `updatedAt` for staleness detection.

Transition rules: only forward transitions allowed. Use `where: { id, status: currentStatus }` on every update to prevent stale writes (optimistic locking).

## 3. Polling over SSE/WebSockets

**Use React Query polling at 2s intervals.** SSE and WebSockets add operational complexity (connection management, reconnection, load balancer config) for minimal UX gain when generation takes 30-90s total. Polling is simpler, stateless, and works through all proxies.

```typescript
useQuery({
  queryKey: ['build', buildId],
  queryFn: () => fetchBuildStatus(buildId),
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    return status === 'COMPLETE' || status === 'FAILED' || status === 'PARTIAL'
      ? false // stop polling
      : 2000; // poll every 2s
  },
  enabled: !!buildId,
});
```

## 4. Partial Completion

Track each section independently: `{ hero: 'COMPLETE', about: 'GENERATING', services: 'FAILED' }`. Store in a `sectionStatuses` JSON column. The build-level status is derived: all done = COMPLETE, any failed + rest done = PARTIAL, any generating = GENERATING.

Return completed sections in the status response so the UI can render them immediately.

## 5. Timeout Pattern (120s Total)

```typescript
const BUILD_TIMEOUT_MS = 120_000;
const SECTION_TIMEOUT_MS = 45_000;

// Per-section: AbortController with 45s timeout
// Build-level: setTimeout that flips status to PARTIAL/FAILED at 120s
// On timeout: save whatever sections completed, mark remainder as TIMED_OUT
```

Use `Promise.allSettled()` for parallel section generation -- never `Promise.all()` which fails fast. After allSettled, persist partial results and set final status.

## 6. Idempotency Keys

Client generates a UUID idempotency key per build request. Server stores it on the Build row with a unique constraint.

```typescript
// In the POST /builds handler:
const existing = await prisma.build.findUnique({ where: { idempotencyKey } });
if (existing) return res.status(200).json(existing); // return cached result
```

Key expires after 24h (cleanup via cron or TTL). This prevents double-submit from UI re-renders, network retries, or user double-clicks.

## 7. Retry Pattern

- Auto-retry: max 2 retries per section with exponential backoff (2s, 8s).
- Manual retry: expose `POST /builds/:id/retry` that re-queues only FAILED sections, keeping completed ones.
- Never retry the entire build -- only failed sections.

## 8. Error Classification

| Category  | Examples                                      | Retryable | Action                             |
| --------- | --------------------------------------------- | --------- | ---------------------------------- |
| Transient | LLM timeout, 429 rate limit, network error    | Yes       | Auto-retry with backoff            |
| Permanent | Invalid input, auth failure, schema violation | No        | Fail immediately, surface to user  |
| Partial   | Scrape failed but LLM available               | Yes       | Use fallback content, retry scrape |

Store `errorCode` (machine-readable) and `errorMessage` (human-readable) on each section.

## 9. Progressive Reveal UX

- Poll returns `{ status, sections: [{ type, status, content? }] }`.
- UI renders a skeleton for each section. As each section completes, crossfade from skeleton to content.
- Show a progress indicator: "2 of 3 sections ready" with section-level status chips.
- On PARTIAL: show completed sections + "retry" button for failed ones.

## 10. Race Condition Prevention

- **Build completion vs polling:** Status endpoint reads directly from DB. No stale cache. React Query's `staleTime: 0` ensures fresh reads.
- **Multiple rapid polls:** The status endpoint is idempotent (GET), safe for concurrent reads.
- **UI state after completion:** On terminal status, invalidate related queries (`queryClient.invalidateQueries(['storefront'])`) to sync downstream UI.

## 11. Website Scraping Timeout + Fallback

```
Attempt 1: Full page render (Puppeteer, 15s timeout)
Attempt 2: Lightweight fetch + Cheerio parse (5s timeout)
Attempt 3: Skip scrape, use user-provided form data only
```

Always set `page.setDefaultNavigationTimeout(15000)`. Wrap in try/catch. The AI generation should work with or without scraped data -- scrape enriches but is not required.

## 12. Build Concurrency Control

- **One active build per tenant:** `WHERE tenantId = ? AND status IN ('QUEUED', 'GENERATING')`. If found, return 409 Conflict or the existing build.
- **Stale build detection:** If a build has been GENERATING for >150s (beyond the 120s timeout), treat it as abandoned. Allow a new build and mark the stale one FAILED.
- **Advisory lock:** `SELECT pg_advisory_xact_lock(hashtext('build:' || tenantId))` inside a transaction to serialize build creation per tenant.

## Decision Summary

| Choice                        | Rationale                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Polling over SSE              | Simpler infra, works through all proxies, 2s latency acceptable for 30-90s builds |
| DB state machine over Redis   | Prisma already available, build state is durable, no new infra                    |
| `Promise.allSettled`          | Partial results over all-or-nothing                                               |
| Per-section retry             | Avoid re-generating successful sections                                           |
| Advisory lock for concurrency | Postgres-native, no external coordination                                         |
| Idempotency key on Build row  | Unique constraint = zero-config dedup                                             |
