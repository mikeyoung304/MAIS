---
status: closed
priority: p2
issue_id: '540'
tags: [code-review, agent-ecosystem, testing, architecture]
dependencies: []
triage_notes: 'OBSOLETE: System migrated from Anthropic to Google Vertex AI (Gemini). LLM client now uses factory pattern in vertex-client.ts.'
closed_at: '2026-01-26'
---

# Hard-coded Anthropic Client Makes Testing Difficult

## Problem Statement

The Anthropic client is created directly in the constructor, making it difficult to mock for testing.

## Findings

**Architecture Strategist:**

> "Hard-coded Anthropic client creation makes testing difficult without mocking `Anthropic` constructor."

**Location:** `base-orchestrator.ts` (lines 206-212)

```typescript
this.anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30 * 1000,
  maxRetries: 2,
});
```

## Proposed Solutions

Inject via constructor or factory:

```typescript
constructor(
  protected readonly prisma: PrismaClient,
  protected readonly anthropic?: Anthropic
) {
  this.anthropic = anthropic ?? new Anthropic({ /* defaults */ });
}
```

## Acceptance Criteria

- [ ] Anthropic client injectable
- [ ] Tests can mock Claude API
- [ ] Default behavior unchanged
- [ ] Tests pass
