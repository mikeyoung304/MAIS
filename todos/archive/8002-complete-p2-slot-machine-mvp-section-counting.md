# 8002 — Slot Machine Counts Non-MVP Sections Toward Build Threshold

**Priority:** P2
**Status:** pending
**Created:** 2026-02-11

## Problem

The slot machine's `readySections.length >= 3` threshold counts non-MVP sections (CONTACT, CTA) toward the trigger. These sections only need `businessType`, so they become "ready" immediately after Q2, causing premature `BUILD_FIRST_DRAFT` signals.

## Expected Behavior

The threshold should require the 3 **MVP sections** (HERO, ABOUT, SERVICES) to be ready, not just any 3 sections.

## Impact

- Agent may trigger build too early, before ABOUT and SERVICES facts are collected
- Agent could skip core discovery questions and jump to secondary facts

## Files

- `server/src/lib/slot-machine.ts` — `readySections` calculation (line ~310)
- `SECTION_REQUIREMENTS` — section → required facts mapping

## Proposed Fix

Either:

1. Filter `readySections` to only count MVP sections toward the threshold
2. Change condition to `mvpSections.every(s => readySections.includes(s))`
3. Add explicit check: `readySections.includes('hero') && readySections.includes('about') && readySections.includes('services')`
