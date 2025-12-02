---
status: complete
priority: p2
issue_id: "036"
tags: [code-review, dependencies, bloat]
dependencies: []
---

# Unused Dependencies - 250MB+ Bloat

## Problem Statement

Several declared dependencies are not used in the codebase, adding unnecessary bloat to installs and potentially bundle size.

**Why this matters:** 250MB+ of unnecessary downloads, longer CI times, potential security surface.

## Findings

### Confirmed Unused

1. **prom-client@15.1.3** (server)
   - +15KB bundle, never imported
   - Added for future metrics, never implemented

2. **puppeteer@24.27.0** (root devDependencies)
   - +200MB download (duplicate Chromium)
   - Only used in legacy `test-redesign.js`
   - Project uses Playwright for E2E

3. **body-parser@2.2.1** (server)
   - +5KB, redundant
   - Express 4.16+ includes body parsing built-in

4. **wait-on@9.0.1** (root devDependencies)
   - +30KB, never used
   - Custom polling in `wait-for-servers.js` instead

## Proposed Solutions

### Option A: Remove All Unused (Recommended)
**Effort:** Small | **Risk:** Low

```bash
npm remove prom-client body-parser wait-on
npm remove --save-dev puppeteer
rm test-redesign.js  # Legacy script
```

## Acceptance Criteria

- [ ] prom-client removed
- [ ] puppeteer removed
- [ ] body-parser removed
- [ ] wait-on removed
- [ ] test-redesign.js deleted
- [ ] All tests pass after removal

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during dependency audit |
