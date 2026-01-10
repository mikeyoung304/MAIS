---
status: resolved
priority: p2
issue_id: '696'
tags: [code-review, security, agent-orchestrator, quota]
dependencies: []
resolved_in: this-commit
---

# Verify AI Quota Enforcement on Onboarding Orchestrator

## Problem Statement

The `CustomerChatOrchestrator` has explicit AI quota checking in its `chat()` override, but `OnboardingOrchestrator` does not appear to have this check. Since onboarding has the most permissive limits (200K tokens, 50 turns, 1 hour), this could allow a malicious FREE tier tenant to exhaust significant API credits during onboarding.

**Why it matters:** Cost control and fair usage. FREE tier tenants have 50 AI messages/month - this should apply to onboarding conversations too.

## Findings

### Evidence

From `customer-chat-orchestrator.ts` lines 179-213:

```typescript
async chat(...): Promise<ChatResponse & { usage?: ... }> {
  // 2. Check quota BEFORE processing
  if (isOverQuota(tier, used)) {
    return { message: "You've used all X AI messages this month..." };
  }
  // 3. Process message via parent class
  const response = await super.chat(...);
  // 4. Increment counter AFTER success
  await this.prisma.tenant.update({ data: { aiMessagesUsed: { increment: 1 } } });
}
```

From `onboarding-orchestrator.ts`:

- No `chat()` override visible
- Uses inherited `BaseOrchestrator.chat()` which doesn't check quota

### Onboarding Limits (from Security Sentinel)

| Config           | Onboarding | Customer |
| ---------------- | ---------- | -------- |
| Token budget     | 200K       | 50K      |
| Turns/session    | 50         | 20       |
| Session duration | 1 hour     | 15 min   |
| T2 budget        | 5          | 2        |

## Proposed Solutions

### Option A: Add quota check to OnboardingOrchestrator (Recommended)

Override `chat()` in `OnboardingOrchestrator` similar to `CustomerChatOrchestrator`.

**Pros:** Consistent quota enforcement across all orchestrators
**Cons:** Additional code
**Effort:** Small
**Risk:** Low

### Option B: Add quota check to BaseOrchestrator

Move the quota check to the base class so all orchestrators inherit it.

**Pros:** DRY, applies to all orchestrators automatically
**Cons:** May not want quota on admin orchestrator
**Effort:** Medium
**Risk:** Low

### Option C: Verify quota is checked elsewhere

The quota might be checked at the API route level before orchestrator is called.

**Pros:** No code change needed
**Cons:** Need to verify
**Effort:** Small (verification only)
**Risk:** None

## Recommended Action

**Option C first** - Verify where quota checking happens. Then implement Option A or B if needed.

## Technical Details

**Files to check:**

- `server/src/routes/agent.routes.ts` - Does the route check quota before calling orchestrator?
- `server/src/agent/orchestrator/onboarding-orchestrator.ts` - Add chat() override if needed

## Acceptance Criteria

- [x] Verified whether quota is checked at route level
- [x] If not, quota check added to onboarding orchestrator
- [ ] Test: FREE tier tenant cannot exceed 50 messages in onboarding

## Solution Implemented

**Chosen approach:** Modified Option A - Added quota check to `AdminOrchestrator` instead of `OnboardingOrchestrator`.

**Rationale:** The `agent.routes.ts` route uses `AdminOrchestrator`, which handles BOTH regular admin mode AND onboarding mode (it switches tools based on `tenant.onboardingPhase`). Therefore, the quota check was added to `AdminOrchestrator.chat()` to ensure ALL admin/onboarding chat messages are quota-checked.

**Implementation details:**

- Added import for `TIER_LIMITS`, `isOverQuota`, `getRemainingMessages` from `../../config/tiers`
- Modified `chat()` method to:
  1. Fetch tenant with `tier`, `aiMessagesUsed`, and `onboardingPhase`
  2. Check quota BEFORE processing (fail fast with upgrade prompt)
  3. Process message via parent class in request-scoped context
  4. Increment `aiMessagesUsed` counter AFTER successful processing
  5. Return usage stats (`used`, `limit`, `remaining`) in response

**Files changed:**

- `server/src/agent/orchestrator/admin-orchestrator.ts`

## Work Log

| Date       | Action                                        | Result               |
| ---------- | --------------------------------------------- | -------------------- |
| 2026-01-09 | Security review identified potential gap      | Needs verification   |
| 2026-01-09 | Verified route level does NOT check quota     | Confirmed gap exists |
| 2026-01-09 | Added quota check to AdminOrchestrator.chat() | Typecheck passes     |
