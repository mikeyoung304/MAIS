# Git History & Pattern Analysis: PR #67 — Tenant Agent Session Persistence

**Branch:** `feat/tenant-agent-persistence`
**Reviewed:** 2026-02-20
**Reviewer:** git-history-analyzer + pattern-recognition-specialist

---

## GIT HISTORY ANALYSIS

### Commit Structure

The PR has 4 commits:

```
0d596aa6  docs: add session persistence plan and brainstorm (all checkboxes done)
f5df5fa1  refactor(tenant-agent): delegate chat operations to TenantAgentService
38e596ee  feat(tenant-agent): add TenantAgentService with PostgreSQL persistence
0a92f668  refactor(adk): schema reconciliation + min-instances=1 for tenant-agent
```

**Assessment — GOOD:**

- Commits are atomic and well-scoped. Each commit has exactly one purpose.
- Commit `0a92f668` (prerequisite ADK schema move) correctly precedes `38e596ee` (service creation). This ordering allows `38e596ee` to import from `adk-client.ts` cleanly.
- Commit `f5df5fa1` (route refactor) correctly follows `38e596ee` (service creation).
- Commit `0d596aa6` (docs) is last and correctly marks all plan checkboxes as done.
- No accidental file deletions. `git diff main...feat/tenant-agent-persistence --name-only` shows exactly 7 files — all expected.
- The `git status` deleted todos (`todos/11056-*.md` etc.) are unstaged working-tree changes from before the branch was cut, NOT part of this PR.
- Reflog confirms a clean linear history with no force-pushes or rewrites: 4 sequential commits from a single branch creation point (`abfb11f0`).
- Commit message quality is high. `f5df5fa1` includes the meaningful metric "Route handler shrunk from 837 to 310 lines (-63%). API contract preserved exactly — zero frontend changes needed." — this is exactly what a reviewer needs.

---

## CRITICAL FINDINGS (P1)

### P1-01: `recoverSession()` Is Public — Should Be Private

**File:** `server/src/services/tenant-agent.service.ts`, line 501

```typescript
// CURRENT (wrong):
async recoverSession(
  tenantId: string,
  slug: string,
  dbSessionId: string,
  userMessage: string,
  currentVersion: number
): Promise<TenantChatResponse> {
```

**The problem:** `recoverSession` is a public method. Its equivalent in `CustomerAgentService` — `retryWithNewADKSession` — is `private` (line 464 of `customer-agent.service.ts`). The recovery path has a tight contract: it assumes `currentVersion` is the ALREADY-INCREMENTED version (post user-message persist). Callers that invoke it directly without first calling `chat()` will pass a stale version and trigger a `VERSION_MISMATCH` error on the assistant message persist, resulting in a silently swallowed failure (the catch at line 674 swallows all errors).

**Pattern diff:** `CustomerAgentService.retryWithNewADKSession` is `private`. `TenantAgentService.recoverSession` is `async` (implicitly public). This was copy-pasted from the route-level logic but the visibility was not adjusted.

**Fix:** Add `private` modifier:

```typescript
private async recoverSession(...): Promise<TenantChatResponse> {
```

---

### P1-02: Missing `local:` ADK Session ID Sanitization

**File:** `server/src/services/tenant-agent.service.ts`, lines 283-289

```typescript
const sessionRow = await this.prisma.agentSession.findUnique({
  where: { id: dbSessionId },
  select: { adkSessionId: true, version: true },
});
let adkSessionId = sessionRow?.adkSessionId ?? null;
const currentDbVersion = sessionRow?.version ?? 0;
```

**The problem:** `CustomerAgentService` has explicit sanitization for legacy `local:` ADK session IDs at lines 260-265:

```typescript
// From customer-agent.service.ts lines 260-265:
if (adkSessionId?.startsWith('local:')) {
  logger.warn(
    { adkSessionId },
    '[CustomerAgent] Found local: fallback in DB — treating as null for recovery'
  );
  adkSessionId = null;
}
```

`TenantAgentService` has no equivalent guard. If the tenant-agent ever stored a `local:` prefixed fallback (from earlier development) in production DB rows, those sessions will fail silently — `adkSessionId` will be sent to ADK, get a 404, trigger recovery, create a new ADK session, update the DB row, and the user will see the right answer — but the recovery path fires unnecessarily on every message for that session until the row is corrected.

**Fix:** Add the same guard after line 288 in `tenant-agent.service.ts`:

```typescript
if (adkSessionId?.startsWith('local:')) {
  logger.warn(
    { adkSessionId },
    '[TenantAgent] Found local: fallback in DB — treating as null for recovery'
  );
  adkSessionId = null;
}
```

---

### P1-03: No Test Coverage for `TenantAgentService`

**Files checked:**

- `server/test/services/` — no `tenant-agent.service.test.ts` exists
- `CustomerAgentService` has tests at `server/test/services/customer-agent.service.test.ts` and `server/src/routes/public-customer-chat.routes.test.ts`

The service contains complex stateful logic: cold start recovery, optimistic locking, context injection, graceful migration, bootstrap double-load paths. None of this is covered by tests. The recovery path in particular is difficult to reason about without a test harness, and the `recoverSession` visibility bug (P1-01) would be caught by a test.

**Fix:** Create `server/test/services/tenant-agent.service.test.ts` mirroring `customer-agent.service.test.ts` with at minimum: session creation, chat happy path, cold start recovery (404 → recover), and session-not-found migration path.

---

## IMPORTANT FINDINGS (P2)

### P2-01: `_version` Parameter Is Dead Code — API Contract Regression Risk

**File:** `server/src/services/tenant-agent.service.ts`, line 231

```typescript
async chat(
  tenantId: string,
  slug: string,
  userMessage: string,
  sessionId?: string,
  _version?: number        // ← never used
): Promise<TenantChatResponse> {
```

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`, line 142

```typescript
const { message, sessionId } = SendMessageSchema.parse(req.body);
// version is never extracted from req.body, never passed to tenantAgent.chat()
```

The `_version` parameter was presumably included for optimistic locking but the route schema `SendMessageSchema` (line 32-35) does not include a `version` field, so the parameter is always `undefined`. The service then correctly reads version from the DB (`currentDbVersion = sessionRow?.version ?? 0`), which is safer. But the dead parameter signature is confusing and suggests intent that was abandoned.

The `CustomerAgentService.chat()` signature has no version parameter at all — it always reads from DB. The tenant service should match this pattern.

**Fix:** Remove `_version?: number` from `chat()` signature. If version-passing from client is ever needed in future, add it to `SendMessageSchema` at that time.

---

### P2-02: `freshSession` Query in `chat()` — Dead Variable

**File:** `server/src/services/tenant-agent.service.ts`, lines 276-280

```typescript
// Re-fetch the newly created session
const freshSession = await this.sessionService.getSession(dbSessionId, tenantId);
if (!freshSession) {
  throw new Error('Failed to create session');
}
```

After a session is not found and a new one is created via `createSession()`, the code re-fetches the session into `freshSession` purely to verify existence, then discards the object. The session data is never used after this point — the code below (line 283) makes a separate `prisma.agentSession.findUnique()` call to get `adkSessionId` and `version`.

This is 2 extra DB round-trips (the `getSession` call inside `createSession`, then this `getSession` call) when 1 would suffice if `createSession` returned the version directly (which it does — `TenantSession.version`).

**Fix:** Replace with a simple existence check using the `TenantSession` returned by `createSession()`:

```typescript
const newSession = await this.createSession(tenantId, slug);
dbSessionId = newSession.sessionId;
isNewSession = true;
// No need to re-fetch — createSession confirms session exists and returns version
```

The subsequent `prisma.agentSession.findUnique` (line 284) can still fetch `adkSessionId` since `createSession` doesn't return it in `TenantSession`.

---

### P2-03: `recoverSession` Double-Loads Bootstrap (Extra DB Queries)

**File:** `server/src/services/tenant-agent.service.ts`, lines 512 and 517

```typescript
// Step 1: Build context summary from PostgreSQL + storefront state
const contextSummary = await this.buildContextSummary(tenantId, dbSessionId);
//                     ↑ internally calls getBootstrapData (line 703)

// Step 2: Load bootstrap for session state
let bootstrap: BootstrapData | null = null;
try {
  bootstrap = await this.contextBuilder.getBootstrapData(tenantId);  // ← second call
```

`buildContextSummary` (line 694) calls `getBootstrapData` internally (line 703). Then `recoverSession` calls `getBootstrapData` again at line 517. This is 2 DB queries for the same data with no caching between them. Similarly, the "no session provided" path in `chat()` calls `createSession` (which calls `getBootstrapData` at line 117) and then also calls `getBootstrapData` again at line 248.

The `ContextBuilderService` has no in-request caching (confirmed by reviewing `server/src/services/context-builder.service.ts` which has a module-scoped dedup cache at line 203 but it's for a lazy backfill, not bootstrap queries).

**Fix (short-term):** Refactor `buildContextSummary` to accept an optional pre-loaded `BootstrapData` parameter, or return it alongside the summary. This eliminates the second call in `recoverSession`.

**Fix (long-term):** Add a per-request TTL cache (e.g., `Map<tenantId, Promise<BootstrapData>>`) inside `ContextBuilderService.getBootstrapData` keyed by tenantId with a 5-second TTL.

---

### P2-04: `extractMessagesFromEvents` Loses Real Timestamps — ADK Fallback Path Only

**File:** `server/src/services/tenant-agent.service.ts`, line 955

```typescript
messages.push({ role, content, timestamp: new Date() });
// ↑ always "now" — actual event time is lost
```

The `AdkSessionDataSchema` (now in `adk-client.ts`) does not include per-event timestamps. When a legacy session is loaded from ADK (not from PostgreSQL), all message timestamps in the response will be the current time, not the actual times the messages were sent. This means sorting or displaying "X minutes ago" in the frontend will be wrong for legacy sessions.

This is lower priority since once a session is migrated to PostgreSQL (which happens on first chat after session creation), the real timestamps are preserved. The ADK path is only a transitional fallback.

**Note:** The `AdkSessionDataSchema` in `adk-client.ts` should be extended with per-event `timestamp` or `createTime` fields if the ADK API provides them. This is a follow-up, not a blocker.

---

### P2-05: Route Still Holds `contextBuilder` in Deps — Leaky Abstraction

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`, lines 45-49

```typescript
interface TenantAgentRoutesDeps {
  tenantAgent: TenantAgentService;
  contextBuilder: ContextBuilderService;  // ← still in deps
  tenantOnboarding?: ...
}
```

`contextBuilder` remains in the route deps because the `/onboarding-state` handler (line 183) calls `contextBuilder.getOnboardingState(tenantId)` directly. However, `TenantAgentService` already holds a `contextBuilder` reference internally. The pattern in `CustomerAgentService` avoids this by not exposing the contextBuilder to the route at all.

The question is: should `TenantAgentService` expose a `getOnboardingState(tenantId)` proxy method, delegating to `contextBuilder`? This would allow the route's deps interface to drop `contextBuilder` entirely, making the route layer a true thin adapter.

This is a design consistency issue, not a bug. The current state works but is inconsistent with the stated intent ("thin route handlers that delegate to TenantAgentService for all chat operations" — line 4 of the routes file comment) since one endpoint still calls through directly to `contextBuilder`.

---

## NICE-TO-HAVE FINDINGS (P3)

### P3-01: `buildContextPrefix` and `stripSessionContext` Are Exported — Potential Future Misuse

**File:** `server/src/services/tenant-agent.service.ts`, lines 863 and 877

```typescript
export function stripSessionContext(content: string): string { ... }
export function buildContextPrefix(bootstrap: BootstrapData): string | null { ... }
```

These are exported as named functions even though they are only used internally by `TenantAgentService` and `extractMessagesFromEvents`. The `CustomerAgentService` has no equivalent exports — all helpers are module-private.

Exporting them signals that external callers can and should use these functions, but doing so bypasses the service contract (e.g., stripping context from messages that were stored with context included). If future callers use `stripSessionContext` on raw DB content without understanding the `[SESSION CONTEXT]`...`[END CONTEXT]` format, they will strip content incorrectly.

**Fix (low priority):** Remove the `export` keywords if these are not consumed by tests or other modules. Confirmed they are not imported anywhere outside this file.

---

### P3-02: Inconsistent Error Message Tone — Voice Guide Violation

**File:** `server/src/services/tenant-agent.service.ts`, lines 375, 388, 436, 444, 451, 575, 621, 677

Several fallback error messages use slightly inconsistent tone:

```typescript
'Agent temporarily unavailable. Try again in a moment.'; // line 374 — OK
'Received an unexpected response. Try again?'; // line 389 — "Try again?" (question OK)
'The request timed out. Please try again.'; // line 436 — "Please" (forbidden filler)
'Connection issue. Try again in a moment.'; // line 451 — OK
'I had a brief interruption. Please try again.'; // line 576 — "Please" + first-person "I"
'I had a brief interruption. Please try sending ...'; // line 621 — same
'Connection issue during recovery. Try again in a moment.'; // line 677 — OK
```

Per `docs/design/VOICE_QUICK_REFERENCE.md`: No "Please" as filler. No "I" in confirmations. Consistent with the brand pattern: `got it | done | on it | heard`.

The VOICE_QUICK_REFERENCE applies to agent responses but the fallback messages are synthesized by the Express server when the ADK is unreachable — these are system error messages, not agent utterances. The strictness of the voice rule here is debatable.

**Fix:** Standardize:

- `'Please try again.'` → `'Try again in a moment.'`
- `'I had a brief interruption. Please try again.'` → `'Brief interruption. Try again?'`

---

### P3-03: `min-instances=1` Workflow Has Shell Quote Risk

**File:** `.github/workflows/deploy-agents.yml`, lines 251-258

```yaml
MIN_INSTANCES_FLAG=""
if [ "${{ matrix.agent }}" = "tenant" ]; then
MIN_INSTANCES_FLAG="--min-instances=1"
fi

gcloud run services update ${{ matrix.agent }}-agent \
...
$MIN_INSTANCES_FLAG \
```

`$MIN_INSTANCES_FLAG` is unquoted in the `gcloud run services update` call. If the flag is empty string (for customer/research agents), this works fine in bash. But the unquoted variable expansion is a shell portability concern and could cause unexpected behavior if the flag ever contains spaces.

**Fix:** Use `${MIN_INSTANCES_FLAG:+$MIN_INSTANCES_FLAG}` for safe empty-string expansion, or quote with `"$MIN_INSTANCES_FLAG"` (though `gcloud` handles empty quoted args gracefully in most shells).

---

### P3-04: `buildContextSummary` Truncates Messages to 80 chars — Silent Data Loss

**File:** `server/src/services/tenant-agent.service.ts`, lines 735-738

```typescript
// Take first 80 chars of each message as a topic hint
recentTopics.push(cleaned.slice(0, 80).trim());
```

And line 747:

```typescript
parts.push(`- Last message (${lastMsg.role}): ${cleaned.slice(0, 120).trim()}`);
```

The 80-char truncation for "recent topics" and 120-char for "last message" are hardcoded magic numbers with no constants or comments explaining why these values were chosen. If the context summary is too thin, the cold-start recovery will be poor quality (agent won't have enough context). If it's too verbose, it will hit ADK state size limits.

**Fix:** Extract these limits to named constants at the top of the function or class:

```typescript
const RECOVERY_TOPIC_PREVIEW_LENGTH = 80;
const RECOVERY_LAST_MESSAGE_LENGTH = 120;
```

---

## PATTERN COMPARISON SUMMARY: TenantAgentService vs CustomerAgentService

| Pattern                     | CustomerAgentService                     | TenantAgentService                            | Assessment                                             |
| --------------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| Session creation            | Returns `string` (sessionId only)        | Returns `TenantSession` (sessionId + version) | Tenant is BETTER — version is surfaced                 |
| Bootstrap context injection | None (no build mode)                     | Full — `BootstrapData` → ADK session state    | Justified difference                                   |
| Cold start recovery         | `retryWithNewADKSession` (private)       | `recoverSession` (public)                     | BUG: should be private (P1-01)                         |
| `local:` sanitization       | Present (lines 260-265)                  | MISSING                                       | BUG: P1-02                                             |
| Version tracking            | Reads from DB always                     | Reads from DB (ignores client `_version`)     | Consistent — safe                                      |
| DI pattern                  | Instantiated inside route factory        | Injected via `deps` from `index.ts`           | Tenant is BETTER                                       |
| AI quota enforcement        | Present (tier limits, counter increment) | ABSENT                                        | Justified — tenant owns the agent (not billed per msg) |
| `extractDashboardActions`   | Not used                                 | Used                                          | Justified — tenant agent only feature                  |
| Test coverage               | Yes — `customer-agent.service.test.ts`   | NO TESTS                                      | P1-03                                                  |
| Recovery context injection  | None (retry only)                        | Full context summary from PostgreSQL          | Tenant adds significant new value                      |

**Overall:** `TenantAgentService` correctly mirrors `CustomerAgentService`'s architecture and extends it meaningfully. The two deviations that matter (P1-01 visibility, P1-02 sanitization) are identifiable copy-omissions rather than conceptual design errors.

---

## ROUTE REFACTOR ASSESSMENT (837 → 310 lines, -63%)

The refactor is clean. A review of the deleted code confirms:

- **Session creation logic** (∼150 lines): fully moved to `TenantAgentService.createSession()`. Bootstrap loading, ADK session creation, PostgreSQL persistence — all present in the service.
- **Chat logic** (∼200 lines): fully moved to `TenantAgentService.chat()`. Context prefix injection, user message persist, ADK `/run` call, 404 recovery, response parsing — all accounted for.
- **`AdkSessionDataSchema`** (∼30 lines): moved to `adk-client.ts` in commit `0a92f668`. Not deleted — correctly centralized.
- **`AdkResponseSchema`** (∼25 lines): the route-local version was deleted. The shared `AdkRunResponseSchema` in `adk-client.ts` covers this.
- **The `extractDashboardActions` function**: moved to `adk-client.ts` in commit `0a92f668`. Not lost.
- **`getTenantAgentUrl()`**: duplicated in both route (deleted) and service (kept). Correct.

No logic was lost in the refactor. The API contract is preserved: same endpoints, same request shapes, same response shapes. Zero frontend changes required is correctly stated in the commit message.

---

_7 files changed. 4 commits. 0 force pushes. 0 accidental deletions._
_P1: 3 findings. P2: 5 findings. P3: 4 findings._
