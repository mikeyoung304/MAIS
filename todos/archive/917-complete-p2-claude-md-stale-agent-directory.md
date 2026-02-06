# 917 - CLAUDE.md Stale agent/ Directory in Project Structure

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (code-philosopher)
**File:** `CLAUDE.md:447-452`

## Problem

The Project Structure section shows:

```
server/src/
├── agent/           # AI agent system
│   ├── customer/    # Customer chatbot
│   ├── onboarding/  # Business advisor
│   └── tools/       # Agent tools
```

This references `agent/` but the actual directory is `agent-v2/`. The subdirectories `customer/`, `onboarding/`, `tools/` don't reflect the current 3-agent structure under `agent-v2/deploy/` (`customer/`, `tenant/`, `research/`).

## Fix

Update to reflect actual structure:

```
server/src/
├── agent-v2/        # AI agent system (v2)
│   ├── deploy/      # Cloud Run agents
│   │   ├── customer/  # Customer-facing agent (13 tools)
│   │   ├── tenant/    # Tenant-facing agent (34 tools)
│   │   └── research/  # Web research agent
│   └── shared/      # Shared agent utilities
```
