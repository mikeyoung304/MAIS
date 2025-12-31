# Sage Color Mismatch Between Config and Guide

## Metadata

- **ID:** 438
- **Status:** pending
- **Priority:** P3
- **Tags:** design, brand, frontend
- **Source:** Brand Review - Frontend Design Specialist

## Problem Statement

The Tailwind config defines sage as `#4A7C6F` but the Brand Voice Guide specifies `#7B9E87`. The config version is darker and more saturated.

## Findings

- `apps/web/tailwind.config.js` line 16: `sage: '#4A7C6F'`
- `docs/design/BRAND_VOICE_GUIDE.md`: `sage: '#7B9E87'`

The difference:

- Guide: `#7B9E87` — lighter, more muted sage
- Config: `#4A7C6F` — darker, more saturated teal-green

Both are acceptable greens, but they should match for brand consistency.

## Proposed Solutions

### Option A: Update Config to Match Guide

Change Tailwind to `#7B9E87`

**Pros:** Matches documented brand
**Cons:** May require visual review of all sage usage
**Effort:** Small
**Risk:** Low

### Option B: Update Guide to Match Config

Change guide to `#4A7C6F`

**Pros:** No code changes, current look is intentional
**Cons:** Admits guide was aspirational
**Effort:** Small
**Risk:** Low

## Recommended Action

Verify which color was the intentional design decision, then align.

## Technical Details

**Affected Files:**

- `apps/web/tailwind.config.js`
- `docs/design/BRAND_VOICE_GUIDE.md`

## Acceptance Criteria

- [ ] Sage color is consistent between config and guide
- [ ] Hover state color also aligned

## Work Log

| Date       | Action  | Notes                                 |
| ---------- | ------- | ------------------------------------- |
| 2025-12-27 | Created | From brand review - Design Specialist |
