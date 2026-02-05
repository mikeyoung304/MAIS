# 915 - README.md Phantom archive/ Directory Reference

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (code-philosopher, devops-harmony-analyst)
**File:** `README.md:242`

## Problem

The project structure tree shows:

```
│   │   │   └── archive/        # Archived legacy agents
```

But `server/src/agent-v2/archive/` does not exist on disk. The commit message for #902 says "Remove phantom archive/ directory refs from 10+ files" — this one was missed.

## Fix

Remove line 242 from README.md.
