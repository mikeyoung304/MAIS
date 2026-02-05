# 912 - ARCHITECTURE.md Stale "Dual-Context Agents" Section

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (architecture-strategist, code-philosopher)
**File:** `ARCHITECTURE.md:330-335`

## Problem

The "Dual-Context Agents" Key Pattern describes `contextType` parameter and `requireContext()` guards — the ADR-019 pattern that was explicitly superseded by ADR-020. A grep for `requireContext` and `contextType` in both tenant and customer agent code returns zero matches. The agents use physical separation (different Cloud Run services) rather than runtime context guards.

This section is misleading — it describes an architecture that no longer exists in the code.

## Fix

Either:

1. Remove the "Dual-Context Agents" bullet entirely, OR
2. Reframe as: "**Physically-Separated User Contexts:** Customer-agent and tenant-agent run as separate Cloud Run services, ensuring user type isolation at the infrastructure level rather than runtime guards."
