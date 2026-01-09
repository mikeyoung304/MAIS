# Storefront AI-Chatbot Integration Plan

**Created:** 2026-01-08
**Status:** Draft - Pending Review
**Author:** Claude (Architecture Session)

## Executive Summary

Transform the tenant storefront system to be optimally designed for AI-chatbot-guided website building. When tenants sign up, they receive a template website with self-documenting placeholders that the AI chatbot can seamlessly understand and update.

**Goal:** A tenant can say "Change the Hero Headline to 'Reset. Reconnect. Return Stronger.'" and the chatbot knows exactly where to plug it in.

## Problem Statement

### Current Gaps

| Gap                         | Severity | Impact                                                                      |
| --------------------------- | -------- | --------------------------------------------------------------------------- |
| **No Section IDs**          | P0       | Sections identified by array index - fragile, breaks on insert/reorder      |
| **Generic Default Content** | P1       | "Welcome to Our Studio" tells tenant nothing; should show "[Hero Headline]" |
| **Dual Tool Systems**       | P1       | Onboarding has 5 fields, Build Mode has full capabilities - confusing       |
| **No Section Metadata**     | P2       | Can't query "what sections exist on this page?"                             |

### Why This Matters

**Current flow (broken):**

1. Tenant signs up
2. Sees generic "Welcome to Our Studio" text
3. Asks chatbot: "Change my headline"
4. Chatbot: "Which section?" (no way to reference)
5. Tenant frustrated, abandons

**Proposed flow (seamless):**

1. Tenant signs up
2. Sees "[Hero Headline]" placeholder
3. Asks chatbot: "Change the Hero Headline to 'Equine Therapy for Executives'"
4. Chatbot: ✅ Updated `home-hero-main.headline`
5. Tenant sees change immediately

## Design Decisions

### D1: Human-Readable Section IDs

**Decision:** Use human-readable IDs over UUIDs.

**Rationale:**

- Tenants can reference sections directly: "update the home-hero-main section"
- Self-documenting: ID explains what the section is
- Chatbot can infer intent from ID structure
- Debug-friendly: logs show meaningful identifiers

**Convention:**

```
{page}-{type}-{qualifier}

Examples:
- home-hero-main       (main hero on home page)
- home-cta-bottom      (bottom CTA on home page)
- about-text-intro     (intro text on about page)
- about-text-story     (story text on about page)
- faq-faq-main         (main FAQ section)
```

**ID Rules:**

- Lowercase alphanumeric + hyphens only
- Max 50 characters
- Must be unique within tenant's landing config
- Immutable once created (never change IDs)

### D2: Self-Documenting Placeholder Content

**Decision:** All editable fields show their field names as placeholders.

**Format:** `[Field Name]` or `[Field Name - optional hint]`

**Examples:**

```typescript
{
  id: 'home-hero-main',
  type: 'hero',
  headline: '[Hero Headline]',
  subheadline: '[Hero Subheadline - one sentence about your business]',
  ctaText: '[CTA Button Text]',
  backgroundImageUrl: null, // Optional fields stay null
}
```

**Benefits:**

- Tenant sees exactly what to tell the chatbot
- Chatbot can parse "[Hero Headline]" to understand field name
- Clear visual indicator of incomplete setup
- Encourages engagement with chatbot to customize

### D3: Unified Tool System

**Decision:** Use Build Mode tools everywhere, deprecate limited onboarding tool.

**Current State:**

- `update_storefront` (onboarding): 5 fields (headline, tagline, voice, image, color)
- Build Mode: 8 comprehensive tools

**Proposed State:**

- Single tool system with full capabilities
- Available during onboarding and normal editing
- Consistent mental model for chatbot and user

**Tools to Expose:**
| Tool | Trust Tier | Purpose |
|------|------------|---------|
| `get_landing_page_draft` | T1 | Query current page/section state |
| `update_page_section` | T2 | Add/update any section |
| `remove_page_section` | T2 | Remove sections |
| `reorder_page_sections` | T1 | Move sections |
| `toggle_page_enabled` | T1 | Enable/disable pages |
| `update_storefront_branding` | T2 | Colors, fonts, logo |
| `publish_draft` | T2 | Go live |
| `discard_draft` | T2 | Rollback |

### D4: Migration Strategy

**Decision:** Add IDs to existing tenant sections via migration.

**Algorithm:**

```typescript
function generateSectionId(page: string, type: string, index: number): string {
  // For single sections of a type, use simple ID
  // For multiple of same type, append index
  return `${page}-${type}-${index === 0 ? 'main' : index}`;
}
```

**Migration Steps:**

1. Read each tenant's `landingPageConfig`
2. For each page, for each section, generate ID
3. Write back updated config
4. Validate no duplicate IDs within tenant

## Implementation Phases

### Phase 1: Schema Foundation (P0)

**Goal:** Add section IDs to schema, backward-compatible.

**Files to modify:**

- `packages/contracts/src/landing-page.ts`
  - Add `id` field to base section schema
  - Make `id` optional for backward compatibility during transition
  - Add ID validation regex

**Schema Change:**

```typescript
// New base schema
const SectionIdSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Section ID must be lowercase alphanumeric with hyphens');

// Each section type gains id field
const HeroSectionSchema = z.object({
  id: SectionIdSchema.optional(), // Optional during transition
  type: z.literal('hero'),
  headline: z.string().min(1).max(60),
  subheadline: z.string().max(150).optional(),
  ctaText: z.string().max(30).default('View Packages'),
  backgroundImageUrl: SafeImageUrlOptionalSchema,
});
```

**Tests to add:**

- Section with valid ID passes validation
- Section without ID passes (backward compat)
- Section with invalid ID fails (uppercase, special chars)
- Duplicate IDs within page fails

**Deliverables:**

- [ ] Updated section schemas with optional `id` field
- [ ] ID validation tests
- [ ] TypeScript types regenerated

### Phase 2: Default Content Update (P1)

**Goal:** Transform DEFAULT_PAGES_CONFIG to be self-documenting.

**Files to modify:**

- `packages/contracts/src/landing-page.ts` (DEFAULT_PAGES_CONFIG)

**Full Default Content:**

```typescript
export const DEFAULT_PAGES_CONFIG: PagesConfig = {
  home: {
    enabled: true,
    sections: [
      {
        id: 'home-hero-main',
        type: 'hero',
        headline: '[Hero Headline]',
        subheadline: '[Hero Subheadline - describe your business in one sentence]',
        ctaText: '[CTA Button Text]',
      },
      {
        id: 'home-cta-bottom',
        type: 'cta',
        headline: '[CTA Headline - call to action]',
        subheadline: '[CTA Subheadline]',
        ctaText: '[CTA Button Text]',
      },
    ],
  },
  about: {
    enabled: true,
    sections: [
      {
        id: 'about-text-intro',
        type: 'text',
        headline: '[About Headline]',
        content: '[About Content - tell your story, who you serve, and why you do what you do]',
      },
    ],
  },
  services: {
    enabled: true,
    sections: [], // Dynamically populated from segments/packages
  },
  faq: {
    enabled: true,
    sections: [
      {
        id: 'faq-faq-main',
        type: 'faq',
        headline: '[FAQ Headline]',
        items: [
          { question: '[Question 1]', answer: '[Answer 1]' },
          { question: '[Question 2]', answer: '[Answer 2]' },
          { question: '[Question 3]', answer: '[Answer 3]' },
        ],
      },
    ],
  },
  contact: {
    enabled: true,
    sections: [
      {
        id: 'contact-contact-main',
        type: 'contact',
        headline: '[Contact Headline]',
        email: '[Email Address]',
        phone: '[Phone Number]',
        address: '[Business Address]',
        hours: '[Business Hours]',
      },
    ],
  },
  gallery: {
    enabled: false, // Start disabled until images added
    sections: [
      {
        id: 'gallery-gallery-main',
        type: 'gallery',
        headline: '[Gallery Headline]',
        images: [], // Empty until populated
        instagramHandle: '[Instagram Handle]',
      },
    ],
  },
  testimonials: {
    enabled: false, // Start disabled until testimonials added
    sections: [
      {
        id: 'testimonials-testimonials-main',
        type: 'testimonials',
        headline: '[Testimonials Headline]',
        items: [
          {
            quote: '[Testimonial Quote]',
            authorName: '[Author Name]',
            authorRole: '[Author Role/Title]',
            rating: 5,
          },
        ],
      },
    ],
  },
};
```

**Deliverables:**

- [ ] Updated DEFAULT_PAGES_CONFIG with IDs and placeholders
- [ ] Visual review of new tenant storefront appearance
- [ ] Chatbot prompt update to understand placeholder format

### Phase 3: Migration Script (P1)

**Goal:** Add IDs to all existing tenant landing configs.

**Files to create:**

- `server/prisma/migrations/XXX_add_section_ids.ts` (data migration)

**Migration Logic:**

```typescript
async function migrateSectionIds(prisma: PrismaClient) {
  const tenants = await prisma.tenant.findMany({
    where: { landingPageConfig: { not: null } },
    select: { id: true, landingPageConfig: true },
  });

  for (const tenant of tenants) {
    const config = tenant.landingPageConfig as LandingPageConfig;
    const updatedConfig = addIdsToConfig(config);

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { landingPageConfig: updatedConfig },
    });
  }
}

function addIdsToConfig(config: LandingPageConfig): LandingPageConfig {
  const pages = config.pages || {};

  for (const [pageName, page] of Object.entries(pages)) {
    if (!page?.sections) continue;

    const typeCounts: Record<string, number> = {};

    page.sections = page.sections.map((section) => {
      if (section.id) return section; // Already has ID

      const typeCount = typeCounts[section.type] || 0;
      typeCounts[section.type] = typeCount + 1;

      const qualifier = typeCount === 0 ? 'main' : String(typeCount);
      const id = `${pageName}-${section.type}-${qualifier}`;

      return { ...section, id };
    });
  }

  return config;
}
```

**Rollback Strategy:**

- IDs are additive (no data loss)
- If rollback needed, simply ignore `id` field (schema allows optional)

**Deliverables:**

- [ ] Migration script
- [ ] Dry-run validation (count sections, preview IDs)
- [ ] Production execution
- [ ] Verification query

### Phase 4: Tool Unification (P2)

**Goal:** Expose Build Mode tools during onboarding, deprecate limited tool.

**Files to modify:**

- `server/src/agent/tools/onboarding-tools.ts` - Deprecate `update_storefront`
- `server/src/agent/onboarding/advisor-orchestrator.ts` - Add Build Mode tools
- `server/src/agent/prompts/onboarding-system-prompt.ts` - Update guidance

**Approach:**

1. During MARKETING phase, include Build Mode tools in available tools
2. Update system prompt to guide chatbot on using full tool set
3. Keep `update_storefront` for backward compat but mark deprecated
4. Update onboarding flow to work with draft/publish cycle

**Tool Registration:**

```typescript
// In advisor-orchestrator.ts
if (onboardingPhase === 'MARKETING') {
  tools.push(
    ...storefrontTools // Full Build Mode suite
  );
}
```

**System Prompt Update:**

```markdown
## Website Customization (MARKETING Phase)

You have full control over the tenant's website. Use these tools:

1. **Query current state:** `get_landing_page_draft`
2. **Update any section:** `update_page_section` with section ID
3. **Add new sections:** `update_page_section` with new ID
4. **Remove sections:** `remove_page_section` by ID
5. **Reorder sections:** `reorder_page_sections`
6. **Enable/disable pages:** `toggle_page_enabled`
7. **Update branding:** `update_storefront_branding`
8. **Publish changes:** `publish_draft`

Section IDs follow the pattern: `{page}-{type}-{qualifier}`
Example: "home-hero-main", "about-text-intro"
```

**Deliverables:**

- [ ] Build Mode tools available in onboarding
- [ ] Updated system prompt for MARKETING phase
- [ ] Deprecation notice on old `update_storefront` tool
- [ ] Integration test: chatbot updates section by ID

### Phase 5: Chatbot Intelligence (P2)

**Goal:** Enhance chatbot's understanding of placeholder format.

**System Prompt Enhancement:**

```markdown
## Understanding Placeholder Content

When a tenant's website has placeholder content like "[Hero Headline]", this means:

- The field is named "Hero Headline"
- It has not been customized yet
- Ask the tenant for their preferred content

Example conversation:
Tenant: "What's on my homepage?"
You: "Your homepage has a Hero section with placeholder content. Would you like to customize:

- Hero Headline (currently '[Hero Headline]')
- Hero Subheadline (currently '[Hero Subheadline]')
- CTA Button Text (currently '[CTA Button Text]')

What would you like your headline to say?"

When updating, use the section ID directly:

- Section ID: "home-hero-main"
- Field: "headline"
- Value: (tenant's input)
```

**Deliverables:**

- [ ] Updated system prompt with placeholder guidance
- [ ] Example conversation patterns
- [ ] Test: chatbot recognizes and explains placeholders

## Risk Assessment

| Risk                                    | Likelihood | Impact | Mitigation                                            |
| --------------------------------------- | ---------- | ------ | ----------------------------------------------------- |
| Migration corrupts existing configs     | Low        | High   | Dry-run first, backup before, validation after        |
| Duplicate IDs cause conflicts           | Medium     | Medium | Unique constraint validation in schema                |
| Placeholder text confuses tenants       | Low        | Low    | Clear visual styling, chatbot explains on first visit |
| Tool unification breaks onboarding flow | Medium     | Medium | Feature flag, gradual rollout                         |

## Success Metrics

1. **Section Reference Success Rate:** >95% of chatbot section updates succeed by ID
2. **Onboarding Completion Rate:** Measure before/after tool unification
3. **Time to First Customization:** Reduced with self-documenting placeholders
4. **Support Tickets:** Fewer "how do I update my website" questions

## Dependencies

- **Contracts package rebuild** after schema changes
- **Frontend deployment** after DEFAULT_PAGES_CONFIG update
- **Database migration** for existing tenants
- **Chatbot prompt update** for placeholder awareness

## Timeline Estimate

| Phase              | Effort    | Dependencies |
| ------------------ | --------- | ------------ |
| Phase 1: Schema    | 2-3 hours | None         |
| Phase 2: Defaults  | 1-2 hours | Phase 1      |
| Phase 3: Migration | 2-3 hours | Phase 1      |
| Phase 4: Tools     | 3-4 hours | Phase 1, 3   |
| Phase 5: Chatbot   | 1-2 hours | Phase 4      |

**Total:** ~10-14 hours of implementation work

## Open Questions

1. Should section IDs be editable by tenants, or immutable once created?
2. Should we show placeholder styling differently (e.g., italic, gray, dashed border)?
3. How do we handle tenants who want to add multiple sections of the same type?
4. Should the chatbot proactively suggest customizations on first visit?

---

## Appendix: File Impact Summary

| File                                                   | Change Type       | Phase |
| ------------------------------------------------------ | ----------------- | ----- |
| `packages/contracts/src/landing-page.ts`               | Schema + Defaults | 1, 2  |
| `server/prisma/migrations/XXX_add_section_ids.ts`      | New file          | 3     |
| `server/src/agent/tools/onboarding-tools.ts`           | Deprecation       | 4     |
| `server/src/agent/tools/storefront-tools.ts`           | ID-based updates  | 4     |
| `server/src/agent/onboarding/advisor-orchestrator.ts`  | Tool registration | 4     |
| `server/src/agent/prompts/onboarding-system-prompt.ts` | Guidance update   | 4, 5  |
| `apps/web/src/components/tenant/SectionRenderer.tsx`   | ID attribute      | 1     |
