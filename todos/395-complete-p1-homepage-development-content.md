---
status: ready
priority: p1
issue_id: "395"
tags:
  - ui
  - production
  - code-review
dependencies: []
---

# Homepage Shows Development Status Instead of Production Content

## Problem Statement

The main landing page at `apps/web/src/app/page.tsx` displays a "Next.js Migration Status" development checklist instead of the actual Macon AI Solutions marketing content. This is not production-ready.

## Findings

**Found by:** Visual Playwright inspection

**Location:** `apps/web/src/app/page.tsx:33-56`

```tsx
<div className="mt-24 rounded-3xl border border-neutral-100 bg-white p-8 shadow-lg">
  <h2 className="text-lg font-semibold text-text-primary">Next.js Migration Status</h2>
  <ul className="mt-4 space-y-2 text-left text-sm text-text-muted">
    <li>✓ Next.js 14 app created</li>
    <li>✓ Tailwind CSS configured with design tokens</li>
    <li>✓ Button component ported</li>
    <li>○ ts-rest SSR client (in progress)</li>
    <li>○ NextAuth.js integration (pending)</li>
    <li>○ Tenant site pages (pending)</li>
  </ul>
</div>
```

**Screenshot:** `.playwright-mcp/main-landing-page.png`

**Impact:** Users visiting maconaisolutions.com see internal development progress instead of marketing content.

## Proposed Solutions

### Option 1: Build production landing page (Recommended)
- Create full marketing landing page following BRAND_VOICE_GUIDE.md
- Include: Hero, Features, How It Works, Pricing, Testimonials, CTA sections
- Remove development status section

**Pros:** Professional appearance, marketing-ready
**Cons:** Design work required
**Effort:** Medium-Large
**Risk:** Low

### Option 2: Redirect to Vite client landing page
- Redirect root to existing client/ landing page until Next.js version ready

**Pros:** Quick fix
**Cons:** Inconsistent architecture
**Effort:** Small
**Risk:** Low

### Option 3: Simple placeholder page
- Replace dev status with simple "Coming Soon" or minimal branding page

**Pros:** Quick, professional placeholder
**Cons:** Not marketing-functional
**Effort:** Small
**Risk:** Low

## Recommended Action

Option 1 for production launch, Option 3 as immediate stopgap.

## Technical Details

**Files to modify:**
- `apps/web/src/app/page.tsx` - Replace entire content

**Design reference:**
- `docs/design/BRAND_VOICE_GUIDE.md` - Voice, colors, typography
- `client/src/pages/LandingPage.tsx` - Existing Vite landing page

## Acceptance Criteria

- [ ] Development status section removed
- [ ] Production marketing content displays
- [ ] Follows BRAND_VOICE_GUIDE.md design system
- [ ] Mobile responsive
- [ ] Core Web Vitals pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from Playwright visual inspection | Dev content exposed in production |
| 2025-12-25 | **Approved for work** - Status: ready | P1 - Production blocker |

## Resources

- Playwright screenshot: `.playwright-mcp/main-landing-page.png`
- Design guide: `docs/design/BRAND_VOICE_GUIDE.md`
