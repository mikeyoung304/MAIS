# Chatbot Onboarding Implementation Plan

> **Issue:** [#20 - Chatbot agent shows 'failed to initialize chat' on first sign-in](https://github.com/mikeyoung304/MAIS/issues/20)
> **Created:** 2025-12-27
> **Status:** Ready for Implementation

---

## Executive Summary

New users hitting the AI assistant see "failed to initialize chat" instead of a guided onboarding experience. This plan implements a HANDLED-voice, prompt-native onboarding flow that matches the brand's cheeky, self-aware personality.

---

## Problem Statement

### Current Behavior

1. User signs up → redirected to `/tenant/dashboard`
2. User clicks AI Assistant
3. Frontend calls `GET /v1/agent/session`
4. **Error**: "Failed to initialize chat session"

### Root Causes

1. Missing `ANTHROPIC_API_KEY` causes silent SDK init failure
2. No pre-flight health check before allowing chatbot access
3. `detectOnboardingPath()` only runs AFTER successful init
4. Generic greetings don't match HANDLED brand voice

---

## Solution Architecture

### Principle: Prompt-Native, Not Code-First

From compound engineering: "Features are prompts that define outcomes, not code that defines workflows."

Instead of building an onboarding wizard in React, we define onboarding behavior in the **system prompt** and add a **health check endpoint** for graceful degradation.

---

## Implementation Phases

### Phase 1: Pre-Flight Health Check

**Goal:** Know if chatbot is available BEFORE user hits it.

#### 1.1 Create Health Endpoint

**File:** `server/src/routes/agent.routes.ts`

```typescript
/**
 * GET /v1/agent/health
 * Pre-flight check for chatbot availability
 */
router.get('/health', async (req: Request, res: Response) => {
  const tenantId = getTenantId(res);

  // Check 1: API key configured
  const apiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;

  // Check 2: Can we build context for this tenant?
  let contextAvailable = false;
  let onboardingState: 'needs_stripe' | 'needs_packages' | 'needs_bookings' | 'ready' =
    'needs_stripe';

  if (tenantId) {
    try {
      const context = await buildSessionContext(prisma, tenantId, 'health-check');
      contextAvailable = true;
      onboardingState = detectOnboardingState(context);
    } catch {
      contextAvailable = false;
    }
  }

  res.json({
    available: apiKeyConfigured && contextAvailable,
    reason: !apiKeyConfigured
      ? 'missing_api_key'
      : !contextAvailable
        ? 'context_unavailable'
        : null,
    onboardingState,
    capabilities: ['chat', 'create_packages', 'manage_bookings', 'stripe_onboarding'],
  });
});
```

#### 1.2 Frontend Pre-Flight Check

**File:** `apps/web/src/components/agent/AgentChat.tsx`

```typescript
// Before session init, check health
useEffect(() => {
  const checkHealth = async () => {
    const response = await fetch(`${API_URL}/v1/agent/health`, {
      credentials: 'include',
    });
    const health = await response.json();

    if (!health.available) {
      setUnavailableReason(health.reason);
      return;
    }

    setOnboardingState(health.onboardingState);
    initSession();
  };

  checkHealth();
}, []);
```

---

### Phase 2: HANDLED-Voice Greetings

**Goal:** Greetings that match the brand's cheeky, identity-first personality.

#### 2.1 Update Greeting Logic

**File:** `server/src/agent/context/context-builder.ts`

```typescript
export function getHandledGreeting(context: AgentSessionContext): string {
  const { quickStats, businessName } = context;

  // Needs Stripe
  if (!quickStats.stripeConnected) {
    return `Your Stripe isn't connected yet. I can handle that — takes about 3 minutes, then you never touch it again. Want to knock it out?`;
  }

  // Has Stripe, no packages
  if (quickStats.packageCount === 0) {
    return `Stripe's connected. ✓ Now you need something to sell. What do you offer — sessions, packages, something else?`;
  }

  // Has packages, no bookings
  if (quickStats.totalBookings === 0) {
    return `You've got ${quickStats.packageCount} package${quickStats.packageCount > 1 ? 's' : ''} ready to go. Now let's get some clients booking. Want me to help you share your booking link?`;
  }

  // Returning user
  const upcoming = quickStats.upcomingBookings;
  if (upcoming > 0) {
    return `${upcoming} client${upcoming > 1 ? 's' : ''} coming up. What should we work on?`;
  }

  return `What should we knock out today?`;
}
```

#### 2.2 Error State Messages (HANDLED Voice)

```typescript
const errorMessages = {
  missing_api_key: `My brain isn't plugged in yet — the team's working on it. In the meantime, check your dashboard for manual setup options.`,

  context_unavailable: `Having trouble loading your business details. Try refreshing, or ping support if it keeps happening.`,

  rate_limited: `Whoa, slow down — I can only think so fast. Give me a sec and try again.`,

  generic: `Something went sideways. The humans have been notified.`,
};
```

---

### Phase 3: Prompt-Native Onboarding Behavior

**Goal:** Define onboarding in the system prompt, not in code.

#### 3.1 Update System Prompt

**File:** `server/src/agent/orchestrator/orchestrator.ts`

Add to `SYSTEM_PROMPT_TEMPLATE`:

```markdown
## Your Personality

You're the AI assistant for HANDLED — a membership platform for service professionals who'd rather focus on their craft than configure tech.

**Voice guidelines:**

- Be cheeky but professional. Self-aware about being AI without being obnoxious.
- Speak to competent pros, not beginners. They're photographers, coaches, therapists — excellent at their jobs.
- Anti-hype: No "revolutionary," "cutting-edge," "transform your business." Just be helpful.
- Focus on what you HANDLE for them, not features.
- When in doubt, be direct: "Want to knock this out?" not "Would you like me to assist you with this task?"

**Words to use:** handle, handled, clients, what's worth knowing, actually, no pitch
**Words to avoid:** revolutionary, game-changing, solutions, synergy, leverage, optimize, amazing

## Onboarding Behavior

Based on the user's state, guide them appropriately:

**No Stripe connected:**
Help them connect Stripe first. It's the foundation — they can't accept payments without it. Be direct: "Takes about 3 minutes, then you never touch it again."

**Stripe connected, no packages:**
Help them create their first package. Ask what they offer (sessions, packages, day rates). Don't overthink pricing — suggest they start simple and adjust.

**Packages exist, no bookings:**
Help them share their booking link. Suggest: "Drop it in your Instagram bio, email signature, or just text it to your next inquiry."

**Active business:**
They know what they're doing. Just be helpful. Don't over-explain.

## Capability Hints

When appropriate, mention what you can help with:

- "I can create packages, adjust pricing, check your calendar, or help with booking issues."
- "Need to reschedule someone? Just tell me who and when."
- "I can also help you draft responses to client inquiries if you paste them in."
```

---

### Phase 4: UI Components

**Goal:** Surface onboarding state before chatbot, with HANDLED styling.

#### 4.1 Chatbot Unavailable State

**File:** `apps/web/src/components/agent/ChatbotUnavailable.tsx`

```tsx
export function ChatbotUnavailable({ reason }: { reason: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-sage" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-text-primary mb-3">
        Brain not plugged in yet
      </h2>
      <p className="text-text-muted max-w-md leading-relaxed">
        {reason === 'missing_api_key'
          ? 'The AI assistant is being set up. In the meantime, you can manage everything from your dashboard.'
          : 'Something went sideways. Try refreshing, or the humans can help.'}
      </p>
      <Button asChild variant="outline" className="mt-6 rounded-full">
        <Link href="/tenant/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
```

#### 4.2 Onboarding Progress Indicator

**File:** `apps/web/src/components/agent/OnboardingProgress.tsx`

```tsx
const steps = [
  { key: 'stripe', label: 'Connect Stripe', icon: CreditCard },
  { key: 'packages', label: 'Create a package', icon: Package },
  { key: 'bookings', label: 'Get your first booking', icon: Calendar },
];

export function OnboardingProgress({ state }: { state: OnboardingState }) {
  // Minimal, non-intrusive indicator at top of chat
  // Shows what's done, what's next
}
```

---

## File Changes Summary

| File                                                   | Change                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `server/src/routes/agent.routes.ts`                    | Add `GET /health` endpoint                                    |
| `server/src/agent/context/context-builder.ts`          | Add `getHandledGreeting()`, update `detectOnboardingPath()`   |
| `server/src/agent/orchestrator/orchestrator.ts`        | Update system prompt with HANDLED voice + onboarding behavior |
| `apps/web/src/components/agent/AgentChat.tsx`          | Add pre-flight health check, handle unavailable state         |
| `apps/web/src/components/agent/ChatbotUnavailable.tsx` | New component for error state                                 |
| `apps/web/src/components/agent/OnboardingProgress.tsx` | New component (optional)                                      |

---

## Testing Checklist

- [ ] New user with no Stripe sees appropriate greeting
- [ ] New user with Stripe but no packages sees package creation guidance
- [ ] Missing API key shows "brain not plugged in" message (not generic error)
- [ ] Health endpoint returns correct `onboardingState`
- [ ] Greetings match HANDLED brand voice (no hype words)
- [ ] Error messages are self-aware without being cringe
- [ ] Existing users don't see onboarding prompts

---

## References

- **Brand Voice:** `docs/design/BRAND_VOICE_GUIDE.md`
- **Compound Engineering:** Prompt-native patterns from agent-native-architecture skill
- **Current Implementation:** `server/src/agent/context/context-builder.ts`
- **GitHub Issue:** https://github.com/mikeyoung304/MAIS/issues/20

---

## Success Criteria

1. **No more "failed to initialize"** — graceful degradation always
2. **Brand-consistent experience** — chatbot sounds like HANDLED, not generic SaaS
3. **Prompt-native** — onboarding behavior lives in system prompt, not React code
4. **Capability discovery** — users know what the AI can do before they ask

---

_Plan created: 2025-12-27_
_Ready for implementation_
