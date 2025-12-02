---
status: complete
priority: p2
issue_id: "133"
tags: [code-review, visual-editor, security, rate-limiting]
dependencies: []
---

# Missing Rate Limiting on Draft Endpoints

## Problem Statement

The visual editor draft management endpoints (GET/PATCH /drafts, POST/DELETE /publish) lack rate limiting. The autosave feature sends requests on every edit (debounced to 1s on client), but there's no server-side protection against abuse.

**Why it matters**: An attacker could spam draft autosave requests causing database load, or a malfunctioning client could overwhelm the server. The 1s client-side debounce is insufficient protection.

## Findings

### Discovery Source
Security Review Agent - Code Review

### Evidence
Location: `server/src/routes/tenant-admin.routes.ts` lines 650, 698, 770, 814

```typescript
// Line 650: No rate limiter
router.get('/packages/drafts', async (req: Request, res: Response, next: NextFunction) => {

// Line 698: No rate limiter
router.patch('/packages/:id/draft', async (req: Request, res: Response, next: NextFunction) => {

// Line 770: No rate limiter
router.post('/packages/publish', async (req: Request, res: Response, next: NextFunction) => {

// Line 814: No rate limiter
router.delete('/packages/drafts', async (req: Request, res: Response, next: NextFunction) => {
```

Compare with photo upload endpoints (lines 472-476) which DO have rate limiting:
```typescript
router.post(
  '/packages/:id/photos',
  uploadLimiterIP,        // <- Rate limiter present
  uploadLimiterTenant,    // <- Rate limiter present
```

## Proposed Solutions

### Option 1: Reuse Existing Rate Limiters (Recommended)
Apply the same rate limiters used for photo uploads.

```typescript
router.patch('/packages/:id/draft', uploadLimiterIP, uploadLimiterTenant, async (req, res) => { ... });
router.post('/packages/publish', uploadLimiterIP, uploadLimiterTenant, async (req, res) => { ... });
router.delete('/packages/drafts', uploadLimiterIP, uploadLimiterTenant, async (req, res) => { ... });
```

**Pros**: Consistent with existing patterns, minimal code changes
**Cons**: Same limits may not be ideal for autosave vs uploads
**Effort**: Small
**Risk**: Low

### Option 2: Create Dedicated Autosave Rate Limiter
Create a specific rate limiter optimized for autosave patterns.

```typescript
const autosaveLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 saves per minute (1 per second)
  message: 'Too many save requests, please slow down'
});
```

**Pros**: Tailored to autosave behavior
**Cons**: More configuration to maintain
**Effort**: Small
**Risk**: Low

### Option 3: Server-Side Debouncing
Implement server-side request deduplication.

```typescript
// Cache recent saves by tenantId + packageId
const recentSaves = new Map<string, number>();

// Reject if saved within last 500ms
const key = `${tenantId}:${packageId}`;
if (Date.now() - (recentSaves.get(key) || 0) < 500) {
  return res.status(429).json({ error: 'Please wait before saving again' });
}
```

**Pros**: Prevents rapid-fire saves even from legitimate clients
**Cons**: More complex implementation
**Effort**: Medium
**Risk**: Low

## Recommended Action
<!-- Filled during triage -->

## Technical Details

### Affected Files
- `server/src/routes/tenant-admin.routes.ts`

### Affected Components
- Draft GET/PATCH/POST/DELETE endpoints

### Database Changes Required
None

## Acceptance Criteria
- [ ] All draft endpoints have rate limiting applied
- [ ] Rate limits are appropriate for autosave pattern (at least 1 save/second allowed)
- [ ] Clear error messages returned when rate limit exceeded
- [ ] Existing photo upload rate limiting still works
- [ ] Tests verify rate limiting behavior

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-01 | Created | Identified during visual editor code review |

## Resources
- PR: feat(visual-editor) commit 0327dee
- Existing rate limiting: `server/src/middleware/rate-limit.ts`
