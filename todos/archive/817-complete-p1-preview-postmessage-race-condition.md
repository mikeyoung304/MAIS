---
status: complete
priority: p1
issue_id: 817
tags: [code-review, build-mode, preview, postmessage, race-condition]
dependencies: []
---

# P0 Bug: Preview Connection Failed - PostMessage Race Condition

## Problem Statement

Users see "Preview Connection Failed" when the Build Mode preview iframe times out after 5 seconds. The sophisticated onboarding system IS working (agent stores facts, updates sections), but users can't see changes because the preview iframe can't establish communication with the parent.

**Why it matters:**

- Users complete onboarding but can't see their website preview
- Agent says "Take a look at your preview" but nothing visible happens
- Creates perception that the system is broken when backend is actually working

## Findings

**From architecture-strategist agent:**

### Root Cause: Three Interacting Race Conditions

**Race #1: Parent Listener Re-registration (Primary)**

The parent's useEffect has `draftConfig` as a dependency, causing the listener to be removed and re-added when config changes:

```typescript
// PreviewPanel.tsx Line 188
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    /* ... */
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [draftConfig]); // ⚠️ UNSTABLE DEPENDENCY
```

During the cleanup/re-registration gap (microseconds), `BUILD_MODE_READY` messages are lost.

**Race #2: React Strict Mode Double-Mounting (Development)**

React Strict Mode (enabled in `next.config.js`) intentionally mounts components twice, doubling the window where messages can be lost.

**Race #3: Instant Iframe Load (Cached)**

When iframe URL is cached, iframe sends `BUILD_MODE_READY` at T=20ms, before parent listener is ready at T=100ms.

### Handshake Timing

- Initial send: T=0
- Retry #1: T=1000ms
- Retry #2: T=2000ms
- Retry #3: T=3000ms
- Retry #4: T=4000ms
- **Timeout: T=5000ms** (last retry only had 1s to succeed)

**From performance-oracle agent:**

On slow networks (3G), legitimate load time is **5.3 seconds**, triggering false-positive timeout errors.

## Proposed Solutions

### Option A: Stabilize Parent Dependencies (Recommended)

**Pros:** Eliminates Race #1 completely, simple fix
**Cons:** Must use `useRef` for `draftConfig` to avoid stale closure
**Effort:** Small (30 minutes)
**Risk:** Low

Remove `draftConfig` from useEffect dependency array, access via ref.

```typescript
const draftConfigRef = useRef(draftConfig);
draftConfigRef.current = draftConfig;

useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // Access draftConfigRef.current instead of draftConfig
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []); // Empty dependencies - listener never re-registers
```

### Option B: Increase Timeout + Add Delay Before First Send

**Pros:** Minimal code change, handles slow networks
**Cons:** Band-aid, doesn't fix root cause
**Effort:** Small (15 minutes)
**Risk:** Low

```typescript
// useBuildModeSync.ts
const HANDSHAKE_TIMEOUT_MS = 10000; // Was 5000

// Add 100ms delay before first send
setTimeout(() => {
  sendReady();
}, 100);
```

### Option C: Bidirectional Handshake (Most Robust)

**Pros:** Eliminates all race conditions, parent drives handshake
**Cons:** Protocol change, both sides need updates
**Effort:** Large (4-6 hours)
**Risk:** Medium

Parent proactively sends `BUILD_MODE_INIT` periodically until iframe acknowledges.

## Recommended Action

**Implement Option A + Option B together:**

1. Stabilize parent dependencies (fixes 80% of timeouts)
2. Increase timeout to 10s (handles slow networks)
3. Add 100ms delay before first READY send (mitigates instant load race)

## Technical Details

**Affected files:**

- `apps/web/src/components/preview/PreviewPanel.tsx` (lines 188-243)
- `apps/web/src/hooks/useBuildModeSync.ts` (lines 105, 178-224)
- `apps/web/src/lib/build-mode/config.ts` (timing constants)

**Components:**

- PreviewPanel (parent) - message listener with unstable dependency
- useBuildModeSync (iframe) - handshake timeout and retry logic

## Acceptance Criteria

- [ ] Preview loads successfully on cold start (no cache)
- [ ] Preview loads successfully on warm start (cached)
- [ ] Preview loads on slow networks (simulate 3G)
- [ ] No "Preview Connection Failed" errors in production logs
- [ ] React Strict Mode double-mount doesn't cause failures

## Work Log

| Date       | Action                             | Learnings                                       |
| ---------- | ---------------------------------- | ----------------------------------------------- |
| 2026-02-04 | Multi-agent code review identified | Three race conditions interact to cause timeout |

## Resources

- Architecture-strategist analysis (sequence diagrams)
- Performance-oracle analysis (timing estimates)
- `apps/web/src/lib/build-mode/protocol.ts` - PostMessage protocol
