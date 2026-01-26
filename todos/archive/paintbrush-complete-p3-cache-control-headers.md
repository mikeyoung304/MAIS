---
status: complete
priority: p3
issue_id: paintbrush-cache-control
tags: [code-review, performance, caching, proxy]
dependencies: []
triage_notes: 'Quick win - ~10 lines of code. No dependencies. Ready for implementation.'
triaged_at: '2026-01-26'
completed_at: '2026-01-26'
completion_notes: 'Added Cache-Control: no-store, no-cache, must-revalidate to both tenant-admin and agent proxy routes.'
---

# P3 MEDIUM: Missing Cache-Control Headers on Proxy Responses

**Priority:** P3 - MEDIUM
**Status:** READY - Quick win, ready for implementation
**Source:** Performance Review (agent a6e02f2)
**Date:** 2026-01-11

## Problem

The proxy routes don't set explicit `Cache-Control` headers. While browsers typically don't cache POST responses, the GET `/api/tenant-admin/landing-page/draft` could be cached by:

- Browser's HTTP cache (aggressive caching)
- Service workers
- CDN edge caches (Vercel Edge, Cloudflare)

## Fix

Add explicit no-cache headers to proxy responses:

```diff
// apps/web/src/app/api/tenant-admin/[...path]/route.ts

return NextResponse.json(responseData, {
  status: response.status,
+ headers: {
+   'Cache-Control': 'no-store, no-cache, must-revalidate',
+ }
});
```

Also add to non-JSON responses:

```diff
return new NextResponse(responseText, {
  status: response.status,
  headers: {
    'Content-Type': response.headers.get('Content-Type') || 'text/plain',
+   'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
});
```

## Same for Agent Proxy

```diff
// apps/web/src/app/api/agent/[...path]/route.ts

return NextResponse.json(responseData, {
  status: response.status,
+ headers: {
+   'Cache-Control': 'no-store, no-cache, must-revalidate',
+ }
});
```

## Verification

1. Check response headers in browser dev tools
2. Headers should include `Cache-Control: no-store, no-cache, must-revalidate`
3. Repeated requests should always hit server (not cache)
