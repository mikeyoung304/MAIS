# 918 - CLAUDE.md Pitfall Numbering Gaps

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (code-philosopher)
**File:** `CLAUDE.md` pitfall sections

## Problem

The commit renumbered pitfalls 1-27 (closing gaps from retired entries) but left gaps elsewhere:

- 28-31: Gap between General pitfalls (end at 27) and ADK/A2A (start at 32)
- 56-57: Gap between Deployment (end at 55) and CI/CD (start at 58)
- 92: Gap between Agent-Frontend (end at 91) and Workspace Build (start at 93)

Inconsistent treatment: one gap was closed, two others were left.

## Fix

Either:

1. Close all gaps with a full renumber pass (risk: breaks external references), OR
2. Add a note at the top: "Numbers are intentionally sparse — retired pitfalls leave gaps to preserve external references"

Option 2 is simpler and safer.
