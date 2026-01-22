# Preview Connection Failed - Root Cause Analysis

---

title: "Preview Connection Failed - PostMessage Handshake Timeout"
slug: preview-connection-failed-handshake-timeout
category: ui-bugs
severity: P2
component: apps/web/preview
symptoms:

- "Preview Connection Failed" message in iframe
- useDraftConfig fetch errors in console
- 5-second timeout before error appears
  root_cause: Auth error prevents draft config fetch, which blocks BUILD_MODE_INIT handshake, causing iframe timeout
  solution_verified: false
  created: 2026-01-21
  pitfall_id: null
  related_issues:
- IFRAME_PREVIEW_REFRESH_STALE_CONTENT.md
- IFRAME_REFRESH_PREVENTION_INDEX.md
  tags:
- preview
- iframe
- postMessage
- build-mode
- auth

---

## Problem Statement

When editing a storefront in Build Mode, the preview iframe displays "Preview Connection Failed" after a 5-second delay. Console shows:

```
[ERROR] [useDraftConfig] Failed to fetch draft {"error":{}}
[ERROR] F: Failed to fetch. Read more at https://errors.authjs.dev#autherror
```

## Architecture Context

The Build Mode preview system uses a PostMessage handshake protocol:

```
Parent (PreviewPanel.tsx)                    Iframe (BuildModeWrapper.tsx)
         │                                            │
         │                                            │ ← iframe loads
         │                                            │
         │ ←──── BUILD_MODE_READY ────────────────────│
         │                                            │
         │ ────── BUILD_MODE_INIT (config) ──────────→│
         │                                            │
         │ ←──── BUILD_MODE_ACK ──────────────────────│
         │                                            │
    [Connected]                                  [Connected]
```

**Key Files:**

- `apps/web/src/components/preview/PreviewPanel.tsx` - Parent side
- `apps/web/src/hooks/useBuildModeSync.ts` - Iframe handshake logic
- `apps/web/src/components/tenant/BuildModeWrapper.tsx` - Shows error on timeout

**Timeout:** 5000ms (`HANDSHAKE_TIMEOUT_MS` in useBuildModeSync.ts)

## Root Cause Analysis

The failure cascade:

1. **Auth Error** - Session token invalid or expired
2. **Draft Fetch Fails** - `useDraftConfig` cannot load configuration
3. **No Config Available** - Parent has no data to send in BUILD_MODE_INIT
4. **Handshake Stalls** - Iframe never receives initialization
5. **Timeout Triggers** - After 5 seconds, `hasTimedOut` becomes true
6. **Error Displayed** - BuildModeWrapper shows "Preview Connection Failed"

```typescript
// BuildModeWrapper.tsx - The error condition
if (hasTimedOut && isEditMode) {
  return <PreviewConnectionFailed />;
}
```

## Investigation Steps

### 1. Check Console for Auth Errors

```
[ERROR] F: Failed to fetch. Read more at https://errors.authjs.dev#autherror
```

This indicates the session has expired or the auth cookie is invalid.

### 2. Check Draft Config Errors

```
[ERROR] [useDraftConfig] Failed to fetch draft {"error":{}}
```

This confirms the draft endpoint is failing, not returning data.

### 3. Check Backend Logs

Look in Render logs for the draft endpoint:

- `GET /api/tenant/landing-page/draft`
- Should show 401/403 if auth issue
- Should show 500 if backend error

### 4. Verify PostMessage Flow

In browser console:

```javascript
// Listen for all postMessage events
window.addEventListener('message', (e) => console.log('PostMessage:', e.data));
```

Expected sequence: `BUILD_MODE_READY` → `BUILD_MODE_INIT` → `BUILD_MODE_ACK`

## Resolution Paths

### If Auth Error

1. Clear browser cookies for the domain
2. Sign out and sign back in
3. Check if session token is being refreshed properly

### If Backend Error

1. Check Render logs for error details
2. Verify database connectivity
3. Check if draft data exists for tenant

### If PostMessage Blocked

1. Check Content-Security-Policy headers
2. Verify iframe src matches expected origin
3. Check for browser extensions blocking messages

## Prevention Strategies

### 1. Better Error Messages

The current error message is generic. Could enhance to show:

- "Session expired - please sign in again"
- "Draft not found - creating new draft"
- "Server error - please try again"

### 2. Auth Token Refresh

Implement proactive token refresh before expiry to prevent mid-session failures.

### 3. Graceful Degradation

Instead of blank error, show last-known preview with "Reconnecting..." overlay.

## Related Documentation

- [IFRAME_PREVIEW_REFRESH_STALE_CONTENT.md](./IFRAME_PREVIEW_REFRESH_STALE_CONTENT.md) - Preview refresh mechanism
- [IFRAME_REFRESH_PREVENTION_INDEX.md](../patterns/IFRAME_REFRESH_PREVENTION_INDEX.md) - Prevention patterns

## Files Involved

- `apps/web/src/hooks/useDraftConfig.ts` - Draft fetching hook
- `apps/web/src/hooks/useBuildModeSync.ts` - PostMessage handshake
- `apps/web/src/components/tenant/BuildModeWrapper.tsx` - Error display
- `apps/web/src/components/preview/PreviewPanel.tsx` - Parent controller

## Keywords

Preview, iframe, postMessage, BUILD_MODE_INIT, handshake, timeout, auth, draft config, connection failed
