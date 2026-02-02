# Real-Time Storefront Preview

**Date:** 2026-02-01
**Status:** Ready for Planning
**Participants:** Mike Young, Claude

---

## What We're Building

A real-time preview system where changes made by the AI agent appear instantly in the preview iframe. When a tenant says "update my headline," they should see the change within 1 second - not wonder if the product is broken.

### The Core Problem

The preview shows stale content because:

1. `PricingSectionSchema` requires `tiers.min(1)` - at least one pricing tier
2. When **any** section is invalid, the **entire** draft fails Zod validation
3. Failed validation triggers "graceful degradation" → `branding: undefined`
4. Preview receives empty branding → falls back to live/default content
5. User sees old content despite agent saying "Updated in draft"

**Server log evidence:**

```
WARN: Invalid draft config in findBySlugForPreview
  errors: [{ path: ["pages", "home", "sections", 6, "tiers"], message: "Array must contain at least 1 element(s)" }]
INFO: Preview data served
  hasDraft: false  ← THE BUG
```

---

## Why This Approach

### Core Design Decisions

| Decision            | Choice                | Rationale                                                                                   |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| Draft validation    | **Lenient**           | Drafts are work-in-progress. Empty pricing section = valid draft.                           |
| Strict validation   | **Publish-time only** | Block publishing incomplete content, not editing.                                           |
| Schema approach     | **Dual schemas**      | `LenientSectionSchema` for drafts, `StrictSectionSchema` for publish. Compile-time clarity. |
| Preview refresh     | **dashboardAction**   | Tool returns `{ type: 'REFRESH_PREVIEW', sectionId }`. Infrastructure exists.               |
| Auto-scroll         | **Yes**               | Scroll to updated section after refresh. Clear visual feedback.                             |
| Incomplete sections | **Placeholder UI**    | "Add pricing tiers to complete this section" - visible, actionable.                         |
| Publish errors      | **Agent explains**    | Natural conversation: "I can't publish yet - pricing needs at least one tier."              |
| Undo system         | **Agent handles**     | No infrastructure needed. User says "put it back" → agent understands context.              |
| Success indicator   | **Keep simple**       | API success = show checkmark. Don't over-verify.                                            |

### Unified Storage Design

**Current state (technical debt):**

- `landingPageConfigDraft` - AI agent writes here
- `landingPageConfig` with wrapper `{ draft, published }` - Visual Editor writes here
- Preview must check both places
- Bugs hide in the gaps

**New design (clean):**

| Column                | Purpose           | Format                       |
| --------------------- | ----------------- | ---------------------------- |
| `storefrontDraft`     | Work in progress  | Raw `LandingPageConfig` JSON |
| `storefrontPublished` | Live site content | Raw `LandingPageConfig` JSON |

**Operations:**

- **Edit:** Agent writes to `storefrontDraft`
- **Preview:** Read from `storefrontDraft` (lenient validation)
- **Live site:** Read from `storefrontPublished`
- **Publish:** Copy draft → published (after strict validation)
- **Discard:** Copy published → draft

**Benefits:**

- One source of truth for drafts
- One source of truth for published
- No wrapper extraction gymnastics
- Clear naming matches product language

### Scope

- **In scope:** AI agent editing path, preview system, unified storage
- **Out of scope:** Visual Editor (deprecated for now, can be updated later)
- **No migration needed:** No real user data exists yet

---

## Key Decisions

### 1. Lenient Draft Schemas

Create `LenientPricingSectionSchema` where `tiers` can be empty:

```typescript
// Lenient (drafts) - empty array OK
tiers: z.array(PricingTierSchema).max(5).default([]);

// Strict (publish) - at least 1 required
tiers: z.array(PricingTierSchema).min(1).max(5);
```

Apply same pattern to all sections with `.min()` constraints.

### 2. Preview Refresh via dashboardAction

Agent tools already return `dashboardAction`. Wire it up:

```typescript
// In storefront-write.ts
return {
  success: true,
  dashboardAction: {
    type: 'REFRESH_PREVIEW',
    sectionId: params.sectionId, // For auto-scroll
  },
};
```

Frontend already handles this pattern in `ConciergeChat.tsx` lines 89-100.

### 3. Placeholder Rendering for Incomplete Sections

When rendering a pricing section with 0 tiers:

```tsx
{
  section.tiers.length === 0 ? (
    <PlaceholderSection
      message="Add pricing tiers to complete this section"
      icon={<DollarSign />}
    />
  ) : (
    <PricingGrid tiers={section.tiers} />
  );
}
```

### 4. Storage Column Rename

Prisma migration:

```sql
ALTER TABLE "Tenant" RENAME COLUMN "landingPageConfigDraft" TO "storefrontDraft";
ALTER TABLE "Tenant" ADD COLUMN "storefrontPublished" JSONB;
-- Migrate existing published data from wrapper format
UPDATE "Tenant" SET "storefrontPublished" = "landingPageConfig"->'published'
  WHERE "landingPageConfig"->'published' IS NOT NULL;
```

---

## Open Questions

1. **Placeholder design:** What should incomplete section placeholders look like? (Can be decided during implementation)

2. **Auto-scroll behavior:** Scroll to section top or center the section in viewport? (Suggest: top)

3. **Section ID format:** Current IDs are indices. Should we use stable UUIDs for scroll targeting? (Suggest: yes, generate on section creation)

---

## Success Criteria

1. **Real-time updates:** Changes appear in preview within 1 second of agent confirmation
2. **No silent fallback:** If draft can't be shown, display explicit error - never silently show live
3. **Auto-scroll:** Preview scrolls to show the updated section
4. **Resilient to partial invalidity:** One broken section doesn't prevent viewing others
5. **Natural publish flow:** Agent explains what's incomplete in conversation, offers to help fix

---

## Test Scenario

1. Start dev servers: `npm run dev:all`
2. Login as tenant
3. Go to Website tab (preview shows on right)
4. In chat: "Add a pricing section to my homepage"
5. **EXPECTED:** Preview shows placeholder: "Add pricing tiers to complete this section"
6. In chat: "Add a basic tier for $99/month"
7. **EXPECTED:** Preview shows pricing section with one tier, scrolled into view
8. In chat: "Publish my site"
9. **EXPECTED:** Agent says "I can't publish yet - [any other incomplete sections]. Want me to help complete them?"

---

## Next Steps

Run `/workflows:plan` to create detailed implementation plan covering:

1. Dual schema creation (Lenient + Strict)
2. Storage migration (unified columns)
3. Preview refresh wiring
4. Placeholder component design
5. Auto-scroll implementation
6. Publish-time validation
