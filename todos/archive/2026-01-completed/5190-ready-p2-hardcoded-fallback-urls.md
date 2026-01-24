---
status: done
priority: p2
issue_id: '5190'
tags: [code-review, agent-v2, security, configuration]
dependencies: []
---

# Hardcoded Fallback URLs in Concierge Agent

## Problem Statement

The Concierge agent has hardcoded Cloud Run URLs as fallbacks for specialist agents. These URLs contain project numbers that will change between environments.

**Why it matters:** If deployed to a different GCP project or environment, these fallback URLs would point to wrong (or non-existent) endpoints, potentially causing silent failures or security issues.

## Findings

**Location:** `server/src/agent-v2/deploy/concierge/src/agent.ts` (lines 28-32)

```typescript
const SPECIALIST_URLS = {
  marketing:
    process.env.MARKETING_AGENT_URL || 'https://marketing-agent-506923455711.us-central1.run.app',
  storefront:
    process.env.STOREFRONT_AGENT_URL || 'https://storefront-agent-506923455711.us-central1.run.app',
  research:
    process.env.RESEARCH_AGENT_URL || 'https://research-agent-506923455711.us-central1.run.app',
};
```

This violates documented pitfall #38 in CLAUDE.md: "Hardcoded Cloud Run URLs - Always use environment variables; URLs contain project numbers that change"

## Proposed Solutions

### Option A: Remove Fallbacks, Fail Fast (Recommended)

**Pros:** Clear error if misconfigured, no accidental wrong-endpoint calls
**Cons:** Requires all env vars to be set
**Effort:** Small (30 min)

```typescript
const SPECIALIST_URLS = {
  marketing: requireEnv('MARKETING_AGENT_URL'),
  storefront: requireEnv('STOREFRONT_AGENT_URL'),
  research: requireEnv('RESEARCH_AGENT_URL'),
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
```

### Option B: Validation at Startup

**Pros:** Warns but doesn't break local dev
**Cons:** Could still silently fail in production
**Effort:** Small (30 min)

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/concierge/src/agent.ts`

## Acceptance Criteria

- [x] No hardcoded Cloud Run URLs with project numbers
- [x] Agent fails at startup with clear error if env vars missing
- [ ] Documentation updated to list required env vars

## Work Log

| Date       | Action    | Notes                                                                                                                         |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-19 | Created   | From code review finding                                                                                                      |
| 2026-01-23 | Completed | Concierge agent already fixed. Fixed remaining hardcoded URL in vertex-agent.service.ts. Now uses requireEnv() for fail-fast. |
