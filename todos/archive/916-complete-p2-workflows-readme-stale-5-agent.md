# 916 - WORKFLOWS_README.md Stale 5-Agent Architecture References

**Priority:** P2 (Important)
**Status:** pending
**Source:** workflows:review commit 104ad180 (devops-harmony-analyst)
**File:** `WORKFLOWS_README.md:234-260`

## Problem

The WORKFLOWS_README.md still references the old 5-agent architecture (concierge, marketing, storefront, research, booking). This is stale — the current architecture uses 3 consolidated agents (customer-agent, tenant-agent, research-agent).

## Fix

Update lines 234-260 to reflect the 3-agent architecture per ADR-020.
