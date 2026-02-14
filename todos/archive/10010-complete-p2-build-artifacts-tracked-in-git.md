# TODO 10010: Build Artifacts Tracked in Git

**Priority:** P2
**Status:** pending
**Source:** Technical Debt Audit 2026-02-13, Issue #10
**Audit Doc:** `docs/solutions/architecture/TECHNICAL_DEBT_AUDIT_2026-02-13.md`

## Problem

Build artifacts (`.tsbuildinfo`, `.js`, `.d.ts` output files) are tracked in git. Causes noisy diffs, merge conflicts on generated files, and inflated repo size.

## Fix Strategy

1. Add patterns to `.gitignore`:
   - `*.tsbuildinfo`
   - `server/dist/`
   - `packages/*/dist/`
2. Remove tracked files: `git rm --cached` for all build artifacts
3. Verify CI/CD builds from source (not relying on committed artifacts)
4. Single commit: gitignore update + cached removal
