# Two-Phase Init Anti-Pattern: Session State ≠ LLM Context

**Date:** 2026-02-13
**Severity:** P1 — brain dump context never reached the AI agent
**Pattern:** Two-phase initialization → context lost between phases

## Problem

The onboarding flow had a two-phase initialization:

1. **Phase 1:** Frontend calls `POST /session` → backend loads bootstrap data (brain dump, city, state, discovery facts) into ADK session state
2. **Phase 2:** Frontend calls `POST /chat` with sessionId + `"hello"` → backend checks `if (!providedSessionId && bootstrap)` to inject context

Since Phase 2 always had a sessionId (from Phase 1), the context injection path was never triggered. The agent received bare `"hello"` with zero context.

**Compounding bug:** Even if Phase 2 had been triggered, `buildContextPrefix()` early-returned `null` for new users because it only checked `discoveryFacts` (empty for new users) and `forbiddenSlots` (empty), exiting before reaching `brainDump`, `city`, `state` fields.

## Key Insight: Session State ≠ LLM Context

ADK session state is backend metadata. The LLM only sees what's in message `parts[].text`. Storing context in session state does NOT make the LLM aware of it. Context must be injected into the message text itself.

## Fix

Collapsed the two phases into one:

1. Frontend skips `POST /session` for new sessions
2. Frontend sends `POST /chat` without sessionId → triggers inline session creation
3. Backend creates ADK session + loads bootstrap + injects `[SESSION CONTEXT]` prefix into the first message — all in one request
4. SessionId returned in response, stored in localStorage for subsequent messages

Also fixed `buildContextPrefix` guard to check `brainDump`, `city`, `state` in addition to `discoveryFacts` and `forbiddenSlots`.

## Files Changed

- `apps/web/src/hooks/useTenantAgentChat.ts` — Skip POST /session for new sessions
- `server/src/routes/tenant-admin-tenant-agent.routes.ts` — Fix early-return guard
- `server/src/agent-v2/deploy/tenant/src/prompts/system.ts` — Forbid mentioning brain dump

## Prevention Pattern

1. **One-call initialization** — Prefer single API calls that do setup + first action atomically. Two-phase init creates windows where state is lost.
2. **LLM context is message content** — Never assume the LLM can "see" session metadata, tool configurations, or backend state. If the LLM needs it, put it in the message.
3. **Test the full flow** — Unit testing each phase independently would not have caught this. The bug only appears when Phase 1 → Phase 2 runs in sequence.

## Related

- Section types drift (same session — `docs/solutions/patterns/CONSTANTS_DUPLICATION_TRAP_SECTION_TYPES.md`)
- Pitfall #83: Agent asking known questions (the original context injection work this bug was in)
