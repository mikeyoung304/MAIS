# LLM Integration Tests for Agent Quality

## Problem Statement

The agent "doesn't feel right" and is forcing Stripe connection before allowing other actions. We need:

1. **Diagnostic tests** to identify what's wrong
2. **Integration tests** to verify response quality
3. **Fixes** for the Stripe forcing behavior

## Current State

- Agent Evaluation Framework: 275 tests (parity, safety, outcomes)
- These tests verify **infrastructure** but NOT **LLM behavior**
- No tests currently call the actual LLM or verify response quality

---

## Phase 1: Diagnose the Issues (30-60 min)

### Goal: Understand what "doesn't feel right" means

Before writing tests, we need to identify specific problems.

### Tasks

1. **Review conversation logs** — Find examples where the agent feels wrong
   - Check `server/logs/` or database for recent agent sessions
   - Identify patterns: too verbose? wrong tone? bad tool selection?

2. **Test the Stripe forcing issue manually**

   ```bash
   # Start the API and test the onboarding flow
   ADAPTERS_PRESET=mock npm run dev:api
   ```

   - Try to skip Stripe setup — does it block you?
   - Check where the forcing happens (prompt? tool? state machine?)

3. **Review the prompts**
   - `server/src/agent/prompts/onboarding-system-prompt.ts`
   - `server/src/agent/prompts/admin-system-prompt.ts`
   - Look for: overly rigid instructions, Stripe requirements, tone issues

### Deliverables

- [ ] List of 3-5 specific "feels wrong" issues with examples
- [ ] Root cause of Stripe forcing (file + line number)
- [ ] Hypothesis for each issue

---

## Phase 2: Fix the Stripe Forcing Bug (30-60 min)

### Goal: Allow users to proceed without Stripe connection

### Likely Locations

1. **Onboarding state machine** — `server/src/agent/onboarding/state-machine.ts`
   - Check if transitions require `stripeConnected: true`

2. **Onboarding prompt** — `server/src/agent/prompts/onboarding-system-prompt.ts`
   - Look for "must connect Stripe" or similar language

3. **Tool preconditions** — `server/src/agent/tools/onboarding-tools.ts`
   - Check if tools have Stripe validation

### Fix Pattern

```typescript
// BEFORE: Blocking
if (!tenant.stripeConnected) {
  return 'Please connect Stripe first';
}

// AFTER: Graceful degradation
if (!tenant.stripeConnected) {
  // Allow action but note limitation
  return {
    ...result,
    note: 'Connect Stripe later to accept payments',
  };
}
```

### Deliverables

- [ ] Identify root cause
- [ ] Apply fix
- [ ] Manual verification that users can proceed without Stripe

---

## Phase 3: Design LLM Integration Test Framework (60-90 min)

### Goal: Create a test structure for response quality

### Key Challenges

1. **Non-determinism** — LLM outputs vary, can't use exact string matching
2. **Cost** — Each test call costs money
3. **Speed** — LLM calls are slow (1-3 seconds each)
4. **Flakiness** — Tests may pass/fail randomly

### Proposed Approach: Evaluation-Based Testing

Instead of asserting exact outputs, we evaluate responses against criteria:

```typescript
// test/agent-eval/llm/response-quality.test.ts

describe('Onboarding Agent Response Quality', () => {
  it('should greet warmly without being overly verbose', async () => {
    const response = await sendAgentMessage({
      agentType: 'onboarding',
      message: 'Hi, I just signed up',
      tenantId: testTenant.id,
    });

    // Evaluation criteria (not exact match)
    expect(response.text.length).toBeLessThan(500); // Not too verbose
    expect(response.text).toMatch(/welcome|hello|hi/i); // Greeting present
    expect(response.text).not.toMatch(/stripe|payment/i); // No premature Stripe push
    expect(response.toolCalls).toHaveLength(0); // No tools on greeting
  });

  it('should NOT force Stripe before business setup', async () => {
    const response = await sendAgentMessage({
      agentType: 'onboarding',
      message: 'I want to set up my services',
      tenantId: testTenant.id,
    });

    // Should talk about services, not Stripe
    expect(response.text).toMatch(/service|package|offering/i);
    expect(response.text).not.toMatch(/must.*stripe|need.*connect.*stripe/i);
  });
});
```

### Test Categories

| Category           | What We Test                  | Example                                   |
| ------------------ | ----------------------------- | ----------------------------------------- |
| **Tone**           | Warm but professional         | "Not robotic, not overly casual"          |
| **Brevity**        | Concise responses             | "Under 300 chars for simple questions"    |
| **Tool Selection** | Correct tool for intent       | "Booking request → book_service tool"     |
| **No Forcing**     | Doesn't push unwanted actions | "No Stripe pressure"                      |
| **Error Handling** | Graceful failures             | "Unavailable date → suggest alternatives" |

### File Structure

```
test/agent-eval/llm/
├── helpers/
│   ├── test-agent-client.ts    # Send messages, get responses
│   ├── evaluators.ts           # Reusable assertion helpers
│   └── test-scenarios.ts       # Common test setups
├── onboarding/
│   ├── greeting.test.ts        # First message quality
│   ├── discovery.test.ts       # Business discovery flow
│   └── no-stripe-forcing.test.ts
├── customer/
│   ├── browsing.test.ts        # Service browsing quality
│   ├── booking-flow.test.ts    # End-to-end booking
│   └── error-handling.test.ts
└── admin/
    ├── dashboard.test.ts       # Dashboard queries
    └── booking-management.test.ts
```

### Deliverables

- [ ] `test-agent-client.ts` helper for calling agents in tests
- [ ] `evaluators.ts` with reusable matchers
- [ ] 3-5 initial test cases for onboarding agent

---

## Phase 4: Implement Core LLM Tests (90-120 min)

### Goal: Write the actual tests

### Priority Test Cases

1. **Onboarding: No Stripe Forcing**
   - User asks about services → agent discusses services (not Stripe)
   - User asks to skip setup → agent allows graceful skip

2. **Onboarding: Appropriate Verbosity**
   - Simple question → short answer
   - Complex question → detailed but structured answer

3. **Customer: Booking Flow**
   - "What services do you offer?" → calls `get_services`
   - "Is Saturday available?" → calls `check_availability`
   - "Book me in" → creates proposal (T3)

4. **Admin: Tool Selection**
   - "Show me today's bookings" → calls `get_bookings`
   - "Cancel booking #123" → calls `cancel_booking` (T3)

### Test Configuration

```typescript
// vitest.config.agent-llm.ts
export default defineConfig({
  test: {
    include: ['test/agent-eval/llm/**/*.test.ts'],
    testTimeout: 30000, // LLM calls are slow
    retry: 2, // Retry flaky tests
    maxConcurrency: 1, // Avoid rate limits
  },
});
```

### NPM Script

```json
{
  "scripts": {
    "test:agent-llm": "vitest run --config vitest.config.agent-llm.ts",
    "test:agent-llm:watch": "vitest --config vitest.config.agent-llm.ts"
  }
}
```

### Deliverables

- [ ] vitest config for LLM tests
- [ ] 5-10 core test cases
- [ ] All tests passing

---

## Phase 5: CI Integration (30 min)

### Goal: Run LLM tests in CI (sparingly)

LLM tests are expensive, so we run them:

- On `main` branch only (not every PR)
- On manual trigger
- Weekly scheduled run

```yaml
# .github/workflows/agent-llm.yml
name: Agent LLM Tests

on:
  push:
    branches: [main]
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * 1' # Weekly on Monday

jobs:
  llm-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:agent-llm
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Deliverables

- [ ] CI workflow file
- [ ] Secret configured in GitHub

---

## Execution Order

| Phase               | Time       | Dependency                   |
| ------------------- | ---------- | ---------------------------- |
| 1. Diagnose         | 30-60 min  | None                         |
| 2. Fix Stripe       | 30-60 min  | Phase 1 findings             |
| 3. Design Framework | 60-90 min  | None (can parallel with 1-2) |
| 4. Implement Tests  | 90-120 min | Phases 2-3                   |
| 5. CI Integration   | 30 min     | Phase 4                      |

**Total: 4-6 hours** for a solid foundation

---

## Success Criteria

- [ ] Stripe forcing bug is fixed
- [ ] Agent tone feels warmer/more natural
- [ ] 10+ LLM integration tests passing
- [ ] Tests run in CI on main branch
- [ ] Documentation for adding new test cases

---

## Quick Start for New Session

```bash
# 1. Start with diagnosis
cd /Users/mikeyoung/CODING/MAIS

# 2. Read the relevant prompts
cat server/src/agent/prompts/onboarding-system-prompt.ts

# 3. Search for Stripe forcing
grep -r "stripe" server/src/agent/ --include="*.ts"

# 4. Run the existing agent tests as baseline
npm run test:agent-eval

# 5. Start API in mock mode to test manually
ADAPTERS_PRESET=mock npm run dev:api
```

## Key Files to Examine

- `server/src/agent/prompts/onboarding-system-prompt.ts` — Main suspect for tone/forcing
- `server/src/agent/onboarding/state-machine.ts` — Phase transitions
- `server/src/agent/onboarding/orchestrator.ts` — Message handling
- `server/src/agent/tools/onboarding-tools.ts` — Tool implementations

## Notes for Claude

When starting this work:

1. **Start with Phase 1** — Don't write tests until you understand the specific problems
2. **Fix Stripe first** — It's a concrete bug with a clear solution
3. **Keep tests focused** — 10 good tests > 50 flaky tests
4. **Use evaluation, not exact match** — LLM outputs vary
