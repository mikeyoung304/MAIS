# Missing Agent URL Environment Variable Documentation

## Metadata

- **ID:** 749
- **Status:** ready
- **Priority:** p2
- **Tags:** code-review, devops, documentation
- **Created:** 2026-01-26
- **Source:** Legacy Agent Migration Review

## Problem Statement

The `.env.example` file is missing documentation for 5 critical environment variables required by the Concierge agent to communicate with specialist agents. This could cause deployment failures when setting up new environments.

**Impact:** New deployments or environment clones will fail silently or require trial-and-error to determine missing variables.

## Findings

**DevOps Harmony Analyst finding:**

The concierge agent (`server/src/agent-v2/deploy/concierge/src/agent.ts`) uses `requireEnv()` for these URLs, meaning it will fail to start without them:

| Variable                | Required By                   | Status in .env.example |
| ----------------------- | ----------------------------- | ---------------------- |
| `MARKETING_AGENT_URL`   | Concierge (line 72)           | **MISSING**            |
| `STOREFRONT_AGENT_URL`  | Concierge (line 73)           | **MISSING**            |
| `RESEARCH_AGENT_URL`    | Concierge (line 74)           | **MISSING**            |
| `PROJECT_HUB_AGENT_URL` | Concierge (line 75)           | **MISSING**            |
| `GOOGLE_CLOUD_PROJECT`  | VertexAgentService (line 141) | **MISSING**            |

Currently documented:

- `BOOKING_AGENT_URL` - Yes
- `CONCIERGE_AGENT_URL` - Yes

## Proposed Solutions

### Option 1: Update .env.example (Recommended)

Add all missing agent URLs to `server/.env.example`:

```bash
# Specialist Agents (required for Concierge orchestration)
MARKETING_AGENT_URL=https://marketing-agent-PROJECTNUM.us-central1.run.app
STOREFRONT_AGENT_URL=https://storefront-agent-PROJECTNUM.us-central1.run.app
RESEARCH_AGENT_URL=https://research-agent-PROJECTNUM.us-central1.run.app
PROJECT_HUB_AGENT_URL=https://project-hub-agent-PROJECTNUM.us-central1.run.app

# Google Cloud (required for agent authentication)
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

**Pros:** Simple, consistent with existing documentation
**Cons:** None
**Effort:** Small (15 min)
**Risk:** None

### Option 2: Create deployment checklist doc

Create `docs/deployment/RENDER_ENV_VARS.md` with complete env var checklist.

**Pros:** More comprehensive
**Cons:** Doesn't help quick `.env` setup
**Effort:** Medium
**Risk:** None

## Technical Details

**Affected files:**

- `server/.env.example`

## Acceptance Criteria

- [ ] All 5 missing env vars documented in `.env.example`
- [ ] Comments explain which service requires each variable
- [ ] `npm run doctor` still passes

## Work Log

| Date       | Action                   | Learnings                                   |
| ---------- | ------------------------ | ------------------------------------------- |
| 2026-01-26 | Created from code review | Concierge agent has strict env requirements |

## Resources

- Service Registry: `server/src/agent-v2/deploy/SERVICE_REGISTRY.md`
- Concierge agent: `server/src/agent-v2/deploy/concierge/src/agent.ts`
