---
status: complete
priority: p1
issue_id: 902
tags: [docs-audit, dead-reference, agents, multi-agent-review]
dependencies: []
---

# Phantom Archive Directory: server/src/agent-v2/archive/ Referenced But Doesn't Exist

## Problem Statement

CLAUDE.md and SERVICE_REGISTRY.md both reference `server/src/agent-v2/archive/` as containing 5 archived agents for "30-day rollback safety." The directory does not exist. Git history shows it was created then deleted on Feb 1 (commit `4e65d93d`).

**Why it matters:**

- CLAUDE.md tells every AI agent session that archived code is in this directory
- SERVICE_REGISTRY.md line 32 claims archived code exists for rollback
- The "30-day rollback" safety net doesn't actually exist
- AI agents may try to reference or restore from this non-existent archive

## Findings

**Verified by 4/8 agents:** ADR Consistency, Architecture Strategist, Conflicting Docs, Doc Cross-Reference

### What CLAUDE.md says:

> "Archived Agents (5 total, in `server/src/agent-v2/archive/`):
>
> - booking-agent → migrated to customer-agent
> - project-hub-agent → split between customer-agent and tenant-agent
> - storefront-agent → migrated to tenant-agent
> - marketing-agent → migrated to tenant-agent
> - concierge-agent → migrated to tenant-agent"

### What SERVICE_REGISTRY.md says:

> "Archived code is in `server/src/agent-v2/archive/` for 30-day rollback safety"

### What actually exists:

```
server/src/agent-v2/deploy/
├── customer/
├── research/
├── tenant/
├── SERVICE_REGISTRY.md
└── ZOD_LIMITATIONS.md
```

No `archive/` directory. Git history shows it was created and deleted within the same day.

## Recommended Fix

1. Remove archive directory references from CLAUDE.md
2. Remove "30-day rollback safety" claim from SERVICE_REGISTRY.md
3. Either: (a) recreate the archive from git history if rollback is genuinely needed, OR (b) acknowledge the archived code only lives in git history

## Sources

- ADR Consistency Agent: Finding 8 (MEDIUM)
- Architecture Strategist: Phantom directory finding
- Multiple agents confirmed via `ls` command
