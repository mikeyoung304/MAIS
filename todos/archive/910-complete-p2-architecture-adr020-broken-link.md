# 910 - ARCHITECTURE.md ADR-020 Broken Filename Reference

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (security-sentinel, architecture-strategist, code-philosopher)
**File:** `ARCHITECTURE.md:354`

## Problem

Line 354 references `docs/adrs/ADR-020-three-agent-consolidation.md` but the actual file is `docs/adrs/ADR-020-unified-agent-architecture.md`. This is a broken internal link.

Additionally, the supersession note says "(supersedes ADR-018)" but ADR-020 supersedes BOTH ADR-018 and ADR-019.

## Fix

```diff
-- ADR: `docs/adrs/ADR-020-three-agent-consolidation.md` (supersedes ADR-018)
+- ADR: `docs/adrs/ADR-020-unified-agent-architecture.md` (supersedes ADR-018, ADR-019)
```
