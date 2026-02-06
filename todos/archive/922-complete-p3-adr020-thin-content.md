# 922 - ADR-020 Could Be More Thorough

**Priority:** P3 (Nice-to-have)
**Status:** pending
**Source:** workflows:review commit 104ad180 (architecture-strategist, code-philosopher)
**File:** `docs/adrs/ADR-020-unified-agent-architecture.md`

## Problem

ADR-020 is 57 lines — significantly thinner than ADR-018 (303 lines) and ADR-019. Missing sections:

- "Alternatives Considered" (why not 2 agents? Why not different orchestration?)
- References to migration plan or SERVICE_REGISTRY
- Commit/tag/branch references for archived agents
- Version history

## Fix

Add "Alternatives Considered" and "References" sections. Low priority but improves future readability.
