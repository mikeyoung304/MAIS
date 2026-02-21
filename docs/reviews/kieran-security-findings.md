# TypeScript + Security Review: PR #67

## feat: tenant agent session persistence & cold start recovery

**Reviewer:** kieran-typescript-reviewer + security-sentinel (combined)
**Date:** 2026-02-20
**Files reviewed:**

- `server/src/lib/adk-client.ts`
- `server/src/routes/tenant-admin-tenant-agent.routes.ts`
- `server/src/services/tenant-agent.service.ts`
- `server/src/routes/index.ts`
- `.github/workflows/deploy-agents.yml`

---

## CRITICAL (P1) — Must Fix Before Merge

### P1-1: `agentSession.update` bypasses tenant isolation in `chat()` and `recoverSession()`

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 200–204, 322–328, 556–559

The two `prisma.agentSession.update` calls in `createSession()` (line 200), `chat()` (line 324), and `recoverSession()` (line 556) filter only by `{ id: dbSessionId }` with no `tenantId` constraint:

```typescript
// Line 200-204 in createSession()
await this.prisma.agentSession.update({
  where: { id: dbSession.id }, // NO tenantId filter — VIOLATION
  data: { adkSessionId },
});

// Line 322-328 in chat()
await this.prisma.agentSession.update({
  where: { id: dbSessionId }, // NO tenantId filter — VIOLATION
  data: { adkSessionId },
});

// Line 556-559 in recoverSession()
await this.prisma.agentSession.update({
  where: { id: dbSessionId }, // NO tenantId filter — VIOLATION
  data: { adkSessionId: newAdkSessionId },
});
```

The `SessionRepository.getSession()` correctly scopes by `tenantId`, but after that check the raw `prisma.agentSession.update` calls have no tenant guard. A session ID from one tenant (obtained via any means — enumeration, leaked JWT, etc.) could be used to overwrite the `adkSessionId` field of another tenant's session. The `agentSession.update` uses Prisma's single-record update (which throws if not found) rather than `updateMany`, giving no natural tenant barrier.

**Fix:** Add `tenantId` to all `where` clauses in raw `prisma.agentSession.update` calls. Change to `updateMany` where a compound filter is needed, or use `{ where: { id: dbSessionId, tenantId } }`.

---

### P1-2: `agentSession.findUnique` in `chat()` has no tenant scoping

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 284–288

```typescript
const sessionRow = await this.prisma.agentSession.findUnique({
  where: { id: dbSessionId }, // NO tenantId — VIOLATION
  select: { adkSessionId: true, version: true },
});
```

`findUnique` cannot use compound `where` unless there is a unique index on `(id, tenantId)`. This call reads session data without verifying tenant ownership. An attacker who knows or guesses a valid CUID can read the `adkSessionId` and `version` of any tenant's session.

**Fix:** Switch to `findFirst` with `{ where: { id: dbSessionId, tenantId } }`. This is safe because `id` is a CUID primary key and `findFirst` is equivalent in practice when filtering by unique id + tenantId.

---

### P1-3: `reason` field in `/skip-onboarding` is an unvalidated raw `req.body` cast

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`
**Lines:** 231

```typescript
const { reason } = req.body as { reason?: string };
```

This bypasses Zod validation entirely. The `reason` string is accepted from any shape of `req.body` and then logged:

```typescript
logger.info(
  { tenantId, previousPhase: result.previousPhase, reason }, // Line 242
  '[TenantAgent] Onboarding skipped'
);
```

While `reason` is only used in a log statement in this PR, the bare `as` cast means TypeScript offers no protection if it is ever passed deeper. This is a Pitfall #5 violation (type assertion without validation). It should be validated via a Zod schema.

**Fix:** Define a `SkipOnboardingSchema = z.object({ reason: z.string().max(500).optional() })` and use `safeParse` on `req.body`.

---

## IMPORTANT (P2) — Should Fix Before Merge

### P2-1: `userId` in ADK URLs is constructed from tenant-controlled inputs without canonical validation

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 112, 233, 508

```typescript
const userId = `${tenantId}:${slug}`;
```

Both `tenantId` and `slug` come from `res.locals.tenantAuth` (set by `tenantAuthMiddleware`), which is trusted. However, both values are then URL-encoded via `encodeURIComponent(userId)` before inclusion in the ADK path:

```typescript
`${getTenantAgentUrl()}/apps/agent/users/${encodeURIComponent(userId)}/sessions`;
```

`encodeURIComponent` correctly encodes `:` as `%3A`, making the path safe. However, the code assumes `slug` values never contain characters that would produce a malformed `userId` that could confuse ADK's routing or collide with another tenant's namespace. There is no explicit length cap or character allowlist enforced on `slug` at this layer.

**Recommendation:** Document that slug validation is enforced upstream (tenant-auth middleware), or add an explicit assertion at the top of `createSession()` to enforce expected format.

---

### P2-2: Context prefix injected into the user message sent to ADK includes raw discovery facts without sanitization

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 877–930 (`buildContextPrefix`)

```typescript
.map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`);
```

`key` values come from `bootstrap.discoveryFacts` which are sourced from the database (tenant-supplied during onboarding). A tenant could store a discovery fact key such as `[END CONTEXT]` which would prematurely close the context block in the injected prefix, allowing arbitrary content injection into the `[SESSION CONTEXT]` block that the agent parses. This is a prompt injection concern — tenant-controlled data is placed into a structured format parsed by the LLM without the keys being escaped.

**Recommendation:** Sanitize or reject fact keys that contain the sentinel strings `[SESSION CONTEXT]` or `[END CONTEXT]`, or use a structured format (e.g., JSON) for the entire context block instead of a line-by-line format with sentinels.

---

### P2-3: Cold start recovery context summary leaks full conversation topics without PII controls

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 731–748 (`buildContextSummary`)

```typescript
recentTopics.push(cleaned.slice(0, 80).trim());
// ...
parts.push(`- Last message (${lastMsg.role}): ${cleaned.slice(0, 120).trim()}`);
```

The recovery context includes raw (decrypted) message content. Messages are encrypted at rest in PostgreSQL via AES-256-GCM, which is good — but during recovery these messages are decrypted and inserted into the ADK session state object, which is sent over the wire to Cloud Run:

```typescript
body: JSON.stringify({ state: sessionState }),
```

where `sessionState.recoveryContext` is a plain-text summary. If the ADK/Cloud Run service logs request bodies (which many GCP log configurations do by default), message content would appear in logs unencrypted. This is a data residency concern for a service handling PII.

**Recommendation:** Verify Cloud Run + ADK request logging configuration does not capture request bodies. Consider limiting recovery context to structural metadata (onboarding phase, section completion) rather than actual message content.

---

### P2-4: `DELETE /session/:id` handler does not actually delete the session

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`
**Lines:** 117–134

The `DELETE /session/:id` route validates auth, logs the request, and returns `{ success: true }` — but never calls any service method to delete or close the session:

```typescript
router.delete('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
  // ...auth check...
  const { tenantId } = tenantAuth;
  logger.info({ tenantId, sessionId }, '[TenantAgent] Session close requested');
  res.json({ success: true, message: 'Session closed' }); // Nothing was actually closed
});
```

This is both a functional bug and a security concern: clients believe they have terminated a session, but it remains active in both PostgreSQL and ADK. If a user logs out expecting the session to be invalidated, the session persists indefinitely until the cleanup scheduler runs.

**Fix:** Call `tenantAgent.closeSession(tenantId, sessionId)` (or equivalent) before returning success. If close is intentionally deferred, the response should not claim `success: true`.

---

### P2-5: `currentVersion` non-null assertion on `appendMessage` result

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 318

```typescript
const currentVersion = userMsgResult.newVersion!;
```

The non-null assertion `!` is used here. `newVersion` is `number | undefined` per the return type of `appendMessage`. The check on line 315–317 only verifies `userMsgResult.success` and throws if false, but does not guarantee `newVersion` is defined. If `appendMessage` returns `{ success: true }` without a `newVersion` (which the type allows), this becomes `undefined` cast to `number`, leading to silent arithmetic errors (`undefined + 1 = NaN`). This is a strict-mode TypeScript violation.

**Fix:** Replace `!` with an explicit check:

```typescript
if (userMsgResult.newVersion === undefined) {
  throw new Error('appendMessage returned success without newVersion');
}
const currentVersion = userMsgResult.newVersion;
```

---

### P2-6: `.env` file created in CI contains `INTERNAL_API_SECRET` as plaintext in workflow step output

**File:** `.github/workflows/deploy-agents.yml`
**Lines:** 200–204

```yaml
cat > .env << EOF
INTERNAL_API_SECRET=${{ secrets.INTERNAL_API_SECRET }}
MAIS_API_URL=https://mais-5bwx.onrender.com
RESEARCH_AGENT_URL=${RESEARCH_URL}
EOF
```

GitHub Actions secrets are masked in logs (`***`) when referenced via `${{ secrets.X }}`, so this is not a direct secret leak in CI logs. However:

1. The `.env` file is written to disk on the runner. If the runner is shared or an artifact upload step is added later, this file could be exposed.
2. The `MAIS_API_URL` is hardcoded as a plain string (`https://mais-5bwx.onrender.com`) rather than coming from a secret or env variable. Hardcoded service URLs in public workflow files reduce operational flexibility and could expose internal topology.

**Recommendation:** Add a `rm -f .env` step immediately after the deploy step completes (in a `finally`-equivalent pattern using `if: always()`). Move `MAIS_API_URL` to a GitHub environment variable rather than a hardcoded string in the workflow file.

---

### P2-7: `extractMessagesFromEvents` uses non-null assertion on `p.text` inside `map()`

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 946–948

```typescript
let content = event.content.parts
  .filter((p) => p.text)
  .map((p) => p.text) // p.text is string | undefined here; no assertion
  .join('');
```

This is actually the correct pattern (no `!` used), but the type of `p.text` after `.filter((p) => p.text)` is still `string | undefined` in TypeScript's type system because the filter predicate isn't a type guard. The `.join('')` on an array of `(string | undefined)` will coerce `undefined` to the string `"undefined"` in the output. This is a subtle type-safety gap that the `extractAgentResponse` function in `adk-client.ts` correctly avoids (line 175: `.map((p) => p.text!)`).

**Fix:** Change the filter to a type guard: `.filter((p): p is { text: string } => Boolean(p.text))`.

---

## NICE-TO-HAVE (P3) — Improvements

### P3-1: `DashboardAction` type uses `unknown` payload without runtime validation

**File:** `server/src/lib/adk-client.ts`
**Line:** 130

```typescript
export type DashboardAction = { type: string; payload: unknown };
```

`DashboardAction` flows from ADK responses through to the API response JSON sent to the frontend (`res.json({ dashboardActions: result.dashboardActions })`). The `payload` is `unknown` and never validated against a schema before being serialized. If ADK returns unexpected dashboard action shapes, the frontend receives unvalidated data. A Zod schema for `DashboardAction` would provide defense-in-depth here.

---

### P3-2: Tool call ID generation uses `Date.now()` which is not collision-safe under concurrent requests

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 404–409, 646–651

```typescript
id: `tc_${Date.now()}_${idx}`,
```

`Date.now()` has millisecond resolution. Two concurrent requests completing at the same millisecond with `idx=0` would generate identical IDs. These IDs are stored in `toolCalls` (a JSON column), not as primary keys, so there is no DB constraint violation — but if IDs are ever used for deduplication or lookup, collisions would be silent. Use `crypto.randomUUID()` or a CUID generator instead.

---

### P3-3: `getSessionHistoryFromAdk()` throws on error but callers don't clearly distinguish error types

**File:** `server/src/services/tenant-agent.service.ts`
**Lines:** 845–851

The ADK fallback method rethrows errors, but the calling route handler only catches `error.message === 'Session not found'` (line 105 in routes file). Any other ADK error (network timeout, malformed response) will propagate to the Express `next(error)` handler and return a 500, with no session-not-found distinction. This is acceptable but worth documenting.

---

### P3-4: `interface` preferred over `type` for object shapes per project convention

**File:** `server/src/lib/adk-client.ts`
**Line:** 130

```typescript
export type AdkToolCall = { name: string; args: Record<string, unknown>; result?: unknown };
export type DashboardAction = { type: string; payload: unknown };
```

These are object shapes that would conventionally be `interface` declarations. The project uses `interface` for service contracts and `type` for unions/aliases. Minor style finding.

---

### P3-5: `slug` property on `TenantAgentRoutesDeps` dependency uses dynamic import for type

**File:** `server/src/routes/tenant-admin-tenant-agent.routes.ts`
**Line:** 48

```typescript
tenantOnboarding?: import('../services/tenant-onboarding.service').TenantOnboardingService;
```

The inline dynamic `import()` type works but is non-idiomatic. It should be a top-level `import type` declaration at the file header for consistency with the rest of the codebase. This is a minor style issue with no functional impact.

---

## Summary

| Severity        | Count | Key Themes                                                                                                    |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| P1 Critical     | 3     | Tenant isolation bypass in raw Prisma updates; unvalidated body cast                                          |
| P2 Important    | 7     | Non-null assertion; no-op DELETE handler; plaintext env in CI; prompt injection risk; PII in recovery context |
| P3 Nice-to-have | 5     | Type widening; ID collision; style                                                                            |

**The P1 issues must be resolved before merge.** The `agentSession.update` calls without `tenantId` (P1-1) and the `findUnique` without tenant scoping (P1-2) are the highest-risk findings — they represent actual multi-tenant data isolation violations on a system where cross-tenant session corruption could expose one tenant's AI conversation context to another tenant's agent.
