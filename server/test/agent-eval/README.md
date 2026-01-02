# Agent Evaluation Framework

A comprehensive test suite for validating agent behavior without requiring LLM calls.

## Overview

The Agent Evaluation Framework ensures:

1. **Parity**: Every agent capability maps to a real tool, and every tool has a capability
2. **Safety**: Injection detection, rate limiting, circuit breakers, and tier budgets work correctly
3. **Outcomes**: Critical user paths are complete and trust tiers are properly enforced

## Quick Start

```bash
# Run all agent evaluation tests (~500ms)
npm run test:agent-eval

# Run specific categories
npm run test:agent-eval:parity     # Tool and prompt parity
npm run test:agent-eval:safety     # Safety mechanisms
npm run test:agent-eval:outcomes   # Critical paths and tiers
```

## Directory Structure

```
test/agent-eval/
├── capabilities/          # Agent capability maps (source of truth)
│   ├── capability-map.ts      # Shared types
│   ├── customer-agent.cap.ts  # Customer agent capabilities
│   ├── onboarding-agent.cap.ts# Onboarding agent capabilities
│   └── admin-agent.cap.ts     # Admin agent capabilities
│
├── parity/               # Parity tests (capability ↔ tool)
│   ├── tool-parity.test.ts    # Every capability has a tool
│   └── prompt-parity.test.ts  # Capabilities match prompt documentation
│
├── safety/               # Safety mechanism tests
│   ├── injection-detection.test.ts  # Prompt injection patterns
│   ├── rate-limiter.test.ts         # Per-tool rate limits
│   ├── circuit-breaker.test.ts      # Session-level limits
│   └── tier-budgets.test.ts         # Per-tier recursion budgets
│
└── outcomes/             # Outcome-based tests
    ├── trust-tier-enforcement.test.ts  # T1/T2/T3 distribution
    └── critical-paths.test.ts          # Critical user journeys
```

## Capability Maps

Capability maps define what each agent can do. They serve as:

- **Documentation**: Human-readable capabilities with descriptions
- **Test fixtures**: Provide expected values for parity tests
- **Contracts**: Define the interface between prompts and tools

### AgentCapability Structure

```typescript
interface AgentCapability {
  id: string; // Unique capability identifier (e.g., 'book-service')
  description: string; // Human-readable description
  requiredTool: string; // Tool name that implements this capability
  trustTier: 'T1' | 'T2' | 'T3'; // Trust tier
  promptKeywords: string[]; // Keywords that appear in system prompt
  category: string; // Grouping (read, catalog, booking, etc.)
}
```

### Trust Tiers

| Tier | Behavior                                           | Examples                           |
| ---- | -------------------------------------------------- | ---------------------------------- |
| T1   | Auto-confirm                                       | get_services, check_availability   |
| T2   | Soft-confirm (10-min window)                       | upsert_services, update_storefront |
| T3   | Hard-confirm (requires explicit user confirmation) | book_service, process_refund       |

## Test Categories

### 1. Parity Tests (84 tests)

Verify that the capability maps match the actual implementation:

- **Tool Parity**: Every capability's `requiredTool` exists in the agent's toolset
- **Prompt Parity**: Every capability's `promptKeywords` appear in the system prompt

```bash
npm run test:agent-eval:parity
```

### 2. Safety Tests (142 tests)

Verify safety mechanisms work correctly:

- **Injection Detection**: `INJECTION_PATTERNS` detect known attacks
- **Rate Limiter**: Per-tool call limits enforced
- **Circuit Breaker**: Session limits (turns, tokens, time) enforced
- **Tier Budgets**: Per-tier recursion budgets prevent runaway T1 calls

```bash
npm run test:agent-eval:safety
```

### 3. Outcome Tests (49 tests)

Verify business-critical paths and trust tier enforcement:

- **Trust Tier Enforcement**: T1/T2/T3 distribution is correct per agent
- **Critical Paths**: All capabilities for key user journeys exist

```bash
npm run test:agent-eval:outcomes
```

## Adding New Capabilities

When adding a new agent capability:

1. **Add to capability map** in `capabilities/<agent>-agent.cap.ts`:

```typescript
{
  id: 'new-capability',
  description: 'What this capability does',
  requiredTool: 'new_tool',
  trustTier: 'T2',
  promptKeywords: ['keyword1', 'keyword2'],
  category: 'catalog',
}
```

2. **Add the tool** to the agent's toolset in `src/agent/<agent>/tools.ts`

3. **Update the prompt** to mention the capability keywords

4. **Run tests** to verify parity:

```bash
npm run test:agent-eval
```

## Adding New Agents

When adding a new agent type:

1. Create `capabilities/<agent>-agent.cap.ts` with the capability map
2. Add the agent to `capabilities/index.ts` exports
3. Update parity tests to include the new agent
4. Add critical paths if applicable

## CI Integration

The agent evaluation tests run on every push that touches agent code:

- `.github/workflows/agent-eval.yml` - GitHub Actions workflow
- Runs automatically on PRs touching `server/src/agent/**`
- Fast feedback loop (~500ms total runtime)

## Philosophy

### Why No LLM Calls?

These tests validate the **infrastructure** around agents, not the LLM behavior:

- Capability maps are static contracts
- Safety mechanisms are deterministic code
- Critical paths are data-driven assertions

This gives us:

- **Speed**: 275 tests in ~500ms
- **Reliability**: No flaky LLM responses
- **Cost**: Zero API calls

### When to Use LLM-Based Tests

For testing actual agent behavior (response quality, tool selection), use:

- Integration tests with mocked LLM responses
- E2E tests with real agents in staging

## Troubleshooting

### "Missing tool for capability"

The capability map references a tool that doesn't exist. Either:

- Add the tool to the agent's toolset
- Remove the capability from the map

### "Prompt keyword not found"

The system prompt doesn't mention the capability's keywords. Either:

- Update the prompt to include the keywords
- Update the capability's `promptKeywords` to match the prompt

### "Injection pattern not detected"

A test case doesn't match any `INJECTION_PATTERNS`. Either:

- The test case is too loose (update to match pattern syntax)
- A new pattern is needed (add to `INJECTION_PATTERNS` in types.ts)
