# 8003 — Auto-Deploy Doesn't Trigger for Shared Dependency Changes

**Priority:** P2
**Status:** complete
**Created:** 2026-02-11

## Problem

GitHub Actions `deploy-agents.yml` only triggers agent redeploys when files in `server/src/agent-v2/deploy/*/src/**` change. Shared dependencies, API contract changes, or internal API schema changes don't trigger agent redeploys.

This caused the research-agent to stay at a 9-day-old revision while the MAIS API and tenant-agent evolved.

## Fix

Update `.github/workflows/deploy-agents.yml` trigger paths to include:

- `packages/contracts/src/**` — shared API contracts
- `server/src/shared/**` — shared constants
- `server/src/services/**` — service layer changes that affect internal API

Or add a periodic "deploy all agents" scheduled job (weekly).
