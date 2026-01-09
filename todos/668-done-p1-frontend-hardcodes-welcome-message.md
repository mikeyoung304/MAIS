---
status: done
priority: p1
issue_id: '668'
tags:
  - code-review
  - onboarding
  - frontend
  - ux
dependencies: []
---

# Frontend Hardcodes Welcome Message Instead of Using API Response

## Problem Statement

`PanelAgentChat.tsx` hardcodes a default welcome message as a prop instead of using the `data.greeting` returned by the session initialization API. This means users always see the same generic greeting regardless of their onboarding phase or business context.

**Why it matters:** The greeting should be phase-aware (e.g., "Tell me about your business" for discovery phase) but instead shows "Salutations. Are you ready to get handled? Tell me a little about yourself." which doesn't match the expected onboarding experience.

## Findings

**Location:** `apps/web/src/components/agent/PanelAgentChat.tsx`

**Line 74 - Hardcoded default:**

```typescript
welcomeMessage = 'Salutations. Are you ready to get handled? Tell me a little about yourself.',
```

**Lines 134-139 - Uses prop instead of API response:**

```typescript
// Add welcome message
setMessages([
  {
    role: 'assistant',
    content: welcomeMessage, // ❌ Uses hardcoded prop
    timestamp: new Date(),
  },
]);
```

**The session API returns a greeting but it's ignored:**

```typescript
const data = await sessionResponse.json();
setSessionId(data.sessionId);
// data.greeting exists but is never used!
```

## Proposed Solutions

### Option A: Use API Greeting with Fallback (Recommended)

**Pros:** Uses dynamic greeting, maintains backward compatibility
**Cons:** None
**Effort:** Small (15 min)
**Risk:** Low

```typescript
// After session response
const data = await sessionResponse.json();
setSessionId(data.sessionId);

// Use greeting from API, fallback to prop
const greeting = data.greeting || welcomeMessage;
setMessages([
  {
    role: 'assistant',
    content: greeting, // ✅ Dynamic, phase-aware
    timestamp: new Date(),
  },
]);
```

### Option B: Remove welcomeMessage Prop Entirely

**Pros:** Cleaner API, forces API to provide greeting
**Cons:** Breaking change for any callers
**Effort:** Small (20 min)
**Risk:** Medium (need to update callers)

## Recommended Action

**Option A** - Use API greeting with fallback. This is a minimal change that maintains backward compatibility while enabling dynamic greetings.

## Technical Details

**Affected Files:**

- `apps/web/src/components/agent/PanelAgentChat.tsx` - Use data.greeting
- Backend `getGreeting()` also needs fixing (see #667) - currently uses wrong greeting function

**Session API Response:**
The `/api/agent/session` route calls `orchestrator.getGreeting()` and includes it in response.

## Acceptance Criteria

- [ ] Chat displays greeting from API response when available
- [ ] Falls back to prop value if API greeting is undefined
- [ ] Greeting is phase-aware when combined with backend fix (#667)
- [ ] AgentChat.tsx should also be checked for same issue

## Work Log

| Date       | Action                   | Learnings                                          |
| ---------- | ------------------------ | -------------------------------------------------- |
| 2026-01-08 | Created from code review | Identified by architecture-strategist as P1 UX bug |

## Resources

- Related: #667 (backend getGreeting uses wrong function)
- Session API: `apps/web/src/app/api/agent/session/route.ts`
