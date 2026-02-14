# 8001 — Research Agent 404 + Cold Start Issue

**Priority:** P1
**Status:** pending (deploy in progress)
**Created:** 2026-02-11

## Problem

The research-agent Cloud Run service returns 404 on `/research` endpoint, causing the entire onboarding flow to fail:

1. Tenant-agent calls `POST https://research-agent-yi5kkn2wqq-uc.a.run.app/research` → **404**
2. Research-agent cold-starts 11 seconds AFTER the request arrives (too late)
3. Without research data, `build_first_draft` generates incomplete content
4. Cascading failure: agent enters "I'm having trouble" error loop

## Root Cause

- Research-agent last deployed **Feb 2** (revision 4) — 9 days stale
- Auto-deploy only triggers when `server/src/agent-v2/deploy/research/` files change
- Shared dependencies and API contract changes don't trigger research-agent redeploy

## Fix Applied

- Triggered `Deploy AI Agents to Cloud Run` workflow for all 3 agents (run #21928897447)
- This rebuilds research-agent with current `main` code

## Follow-up Needed

- [ ] Verify research-agent responds 200 on `/research` after deploy
- [ ] Consider setting `--min-instances=1` to avoid cold starts
- [ ] Add shared contract changes to the auto-deploy trigger paths
- [ ] Re-run onboarding smoke test after deploy completes
