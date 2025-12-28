# Chatbot Onboarding - Implementation Prompt

> Copy this prompt to start a new Claude Code session for implementing the chatbot onboarding feature.

---

## Prompt

```
Implement the chatbot onboarding feature for HANDLED.

## Context

Read these files first:
1. `docs/plans/CHATBOT_ONBOARDING_PLAN.md` - Full implementation plan with 4 phases
2. `docs/design/BRAND_VOICE_GUIDE.md` - HANDLED brand voice (cheeky, self-aware, anti-hype)
3. `server/src/agent/context/context-builder.ts` - Current greeting/onboarding logic
4. `server/src/agent/orchestrator/orchestrator.ts` - System prompt template
5. `apps/web/src/components/agent/AgentChat.tsx` - Frontend chat component

## Issue

GitHub Issue #20: New users see "failed to initialize chat" on first sign-in.

## Implementation Order

**Phase 1: Health Endpoint**
- Add `GET /v1/agent/health` to agent.routes.ts
- Returns: available, reason, onboardingState, capabilities

**Phase 2: HANDLED-Voice Greetings**
- Update `detectOnboardingPath()` → `getHandledGreeting()`
- Match brand voice: "Your Stripe isn't connected yet. I can handle that — takes about 3 minutes..."

**Phase 3: System Prompt Updates**
- Add HANDLED personality section to system prompt
- Add onboarding behavior guidance (prompt-native, not code)

**Phase 4: Frontend Updates**
- Pre-flight health check in AgentChat.tsx
- ChatbotUnavailable.tsx component for error states
- Handle graceful degradation

## Key Constraints

- **Brand Voice**: Cheeky, self-aware about AI, anti-hype, identity-first
- **No hype words**: revolutionary, game-changing, solutions, synergy
- **Prompt-native**: Define onboarding in system prompt, not React wizard
- **Multi-tenant**: All queries must filter by tenantId
- **TypeScript strict**: No `any` without justification

## Testing

After each phase, verify:
- New user flows work correctly
- Greetings match brand voice
- Error states are graceful
- Existing functionality not broken

Run tests: `npm test` in server directory

## When Done

1. Mark todos complete as you go
2. Run `/workflows:compound` to document the solution
3. Update issue #20 with implementation notes
```

---

## Quick Reference Links

- **Plan:** `docs/plans/CHATBOT_ONBOARDING_PLAN.md`
- **Brand Guide:** `docs/design/BRAND_VOICE_GUIDE.md`
- **Issue:** https://github.com/mikeyoung304/MAIS/issues/20
- **Key Files:**
  - `server/src/routes/agent.routes.ts`
  - `server/src/agent/context/context-builder.ts`
  - `server/src/agent/orchestrator/orchestrator.ts`
  - `apps/web/src/components/agent/AgentChat.tsx`

---

## Expected Outcome

After implementation:

1. No more "failed to initialize" errors
2. Health endpoint provides pre-flight checks
3. Greetings match HANDLED voice
4. System prompt guides onboarding behavior
5. Graceful degradation for all error states
