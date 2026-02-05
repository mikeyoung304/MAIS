# 911 - ARCHITECTURE.md & README.md Stale Tenant-Agent Tool Count

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (code-simplicity-reviewer, architecture-strategist, code-philosopher)
**Files:** `ARCHITECTURE.md:323`, `README.md:240`

## Problem

ARCHITECTURE.md line 323 and README.md line 240 say tenant-agent has **24 tools**. CLAUDE.md was correctly updated to **34 tools** in this same commit, and the actual `agent.ts` confirms 34. The fix was applied to one file but missed in two others.

## Fix

Update both files: 24 -> 34 for tenant-agent tool count.
