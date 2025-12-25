---
status: ready
priority: p2
issue_id: "369"
tags: [code-review, security, rate-limiting]
dependencies: []
---

# Revalidation Endpoint Missing Rate Limiting

## Problem Statement

The `/api/revalidate` endpoint accepts unlimited requests. An attacker with the secret could spam revalidations.

**Why it matters:** CPU exhaustion, ISR cache ineffective, potential DoS.

## Findings

**File:** `apps/web/src/app/api/revalidate/route.ts`

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = searchParams.get('secret');

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid' }, { status: 401 });
  }
  // No rate limiting - accepts unlimited requests
  revalidatePath(path);
}
```

**Attack Vector:**
```bash
# Attacker could spam revalidation
for i in {1..1000}; do
  curl -X POST "https://app.com/api/revalidate?path=/t/victim&secret=leaked"
done
```

**Impact:** P2 - Potential DoS, cache exhaustion

## Proposed Solutions

### Option 1: Add Rate Limiting Middleware
- **Description:** Limit to 10 requests per minute per secret
- **Pros:** Prevents abuse
- **Cons:** Need to track request counts
- **Effort:** Small (30 min)
- **Risk:** Low

### Option 2: Use Vercel Edge Config
- **Description:** Leverage Vercel's built-in rate limiting
- **Pros:** Managed solution
- **Cons:** Vercel-specific
- **Effort:** Small
- **Risk:** Low

## Recommended Action

**FIX NOW** - A leaked secret could cause cache stampedes and CPU exhaustion. Add simple rate limiting: 10 revalidations per minute. Takes 30 minutes and prevents operational disasters.

## Acceptance Criteria

- [ ] Rate limit of 10 requests/minute/path enforced
- [ ] Abuse attempts logged
- [ ] Legitimate revalidations still work

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | Security gap found |
