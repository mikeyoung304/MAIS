---
status: complete
priority: p3
issue_id: 907
tags: [docs-audit, env-vars, ci-cd, multi-agent-review]
dependencies: []
completed_date: 2026-02-05
---

# Environment and CI/CD Cleanup Items

## Problem Statement

Several environment and CI/CD artifacts contain stale references that don't affect functionality but create confusion and technical debt.

**Why it matters:**

- Missing env vars in .env.example means new developers miss required config
- Stale CI environment variables reference retired agent URLs
- CORS_ORIGIN example points to wrong port (5173 Vite vs 3000 Next.js)

## Findings

### .env.example Missing Agent Env Vars

- Missing: `CUSTOMER_AGENT_URL`, `TENANT_AGENT_URL`, `RESEARCH_AGENT_URL`
- Missing: GCP-related vars for agent deployment
- These are required for agent features but not documented

### docs/setup/ENVIRONMENT.md

- CORS_ORIGIN example points to port 5173 (Vite) — should be 3000 (Next.js)
- No mention of agent-related environment variables

### deploy-agents.yml Stale Blocks

- Line 172: Dead conditional for "concierge" agent (unreachable in matrix)
- Lines 174-175: MARKETING_AGENT_URL and STOREFRONT_AGENT_URL env vars (retired agents)

### CLAUDE.md API Key Format

- Says both public and secret keys are 32 chars — public is actually 16 chars

## Recommended Fix

1. Add agent env vars to .env.example
2. Update ENVIRONMENT.md CORS_ORIGIN example: 5173 → 3000
3. Add agent env var documentation to ENVIRONMENT.md
4. Remove dead concierge block from deploy-agents.yml (line 172)
5. Remove stale MARKETING_AGENT_URL and STOREFRONT_AGENT_URL (lines 174-175)
6. Fix API key format documentation in CLAUDE.md

## Sources

- Conflicting Docs Agent: Conflicts 9-10
- Git History Agent: .env.example analysis
- Security Sentinel: API key format finding
