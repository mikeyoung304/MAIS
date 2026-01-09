# ✨ Storefront AI-Chatbot Integration — Final Implementation Plan

**Version:** 2.0 (Post-Review)
**Created:** 2026-01-08
**Status:** Phases 1-4 Complete ✅
**Reviewed By:** DHH, Kieran (TypeScript), Security Sentinel, Architecture Strategist, Code Simplicity, Agent-Native Architect

### Implementation Progress

| Phase                                     | Status      | Notes                                                                                   |
| ----------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Phase 1: Schema Foundation                | ✅ Complete | SectionIdSchema, generateSectionId, DEFAULT_PAGES_CONFIG with stable IDs                |
| Phase 2: Discovery Tools + Migration      | ✅ Complete | list_section_ids, get_section_by_id, get_unfilled_placeholders, migration ran on dev DB |
| Phase 3: ID-Based Tools                   | ✅ Complete | update_page_section, remove_page_section support sectionId                              |
| Phase 4: Unification + Agent Intelligence | ✅ Complete | MARKETING phase has full storefront tools, disambiguation flow in system prompt         |
| Phase 5: Testing & Polish                 | 🔲 Pending  | E2E verification, edge case testing                                                     |

---

## Executive Summary

Transform the tenant storefront system for seamless AI-chatbot-guided website building. When tenants sign up, they receive a template with self-documenting placeholders that the AI can understand and update by stable section IDs.

**Core Change:** Replace fragile array indices with human-readable section IDs like `home-hero-main`.

**Goal:** Tenant says _"Change the Hero Headline to 'Reset. Reconnect. Return Stronger.'"_ → AI updates `home-hero-main.headline` reliably.

---

## Implementation Phases

### Phase 1: Schema Foundation + Defaults (P0) ✅ COMPLETE

**Estimated Time:** 3-4 hours
**Files:** `packages/contracts/src/landing-page.ts`

#### 1.1 Add SectionIdSchema with Strict Validation

```typescript
// Reserved patterns that could cause issues with JavaScript objects
const RESERVED_PATTERNS = ['__proto__', 'constructor', 'prototype'];

// Page and section type constants for validation
export const PAGE_NAMES = [
  'home',
  'about',
  'services',
  'faq',
  'contact',
  'gallery',
  'testimonials',
] as const;
export type PageName = (typeof PAGE_NAMES)[number];

export const SECTION_TYPES = [
  'hero',
  'text',
  'gallery',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'pricing',
  'features',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * Section ID Schema - Strict validation for human-readable IDs
 * Format: {page}-{type}-{qualifier}
 * Examples: home-hero-main, about-text-intro, faq-faq-2
 */
export const SectionIdSchema = z
  .string()
  .max(50)
  .regex(
    /^(home|about|services|faq|contact|gallery|testimonials)-(hero|text|gallery|testimonials|faq|contact|cta|pricing|features)-(main|[a-z]+|[0-9]+)$/,
    'Section ID must be {page}-{type}-{qualifier} format (e.g., home-hero-main, about-text-2)'
  )
  .refine((id) => !RESERVED_PATTERNS.some((pattern) => id.includes(pattern)), {
    message: 'Section ID contains reserved JavaScript pattern',
  });

export type SectionId = z.infer<typeof SectionIdSchema>;
```

#### 1.2 Add Type Guard Function

```typescript
/**
 * Type guard to check if a section has a valid stable ID
 * Use this during migration period when IDs are optional
 */
export function isSectionWithId<T extends Section>(section: T): section is T & { id: SectionId } {
  return (
    'id' in section &&
    typeof section.id === 'string' &&
    SectionIdSchema.safeParse(section.id).success
  );
}

/**
 * Generate a unique section ID for a new section
 * Uses monotonic counter (never reuses IDs, even after deletion)
 */
export function generateSectionId(
  pageName: PageName,
  sectionType: SectionType,
  existingIds: Set<string>
): SectionId {
  const baseId = `${pageName}-${sectionType}-main`;
  if (!existingIds.has(baseId)) return baseId as SectionId;

  // Monotonic counter: find highest existing number, increment
  let maxCounter = 1;
  const counterPattern = new RegExp(`^${pageName}-${sectionType}-(\\d+)$`);
  for (const id of existingIds) {
    const match = id.match(counterPattern);
    if (match) {
      maxCounter = Math.max(maxCounter, parseInt(match[1], 10));
    }
  }
  return `${pageName}-${sectionType}-${maxCounter + 1}` as SectionId;
}
```

#### 1.3 Update All Section Schemas

Add optional `id` field to each of the 9 section types:

```typescript
// Base section metadata (shared by all types)
const SectionMetaSchema = z.object({
  id: SectionIdSchema.optional(), // Optional during migration, required after Phase 2
});

// Update each section type
export const HeroSectionSchema = SectionMetaSchema.extend({
  type: z.literal('hero'),
  headline: z.string().min(1).max(60),
  subheadline: z.string().max(150).optional(),
  ctaText: z.string().max(30).default('View Packages'),
  backgroundImageUrl: SafeImageUrlOptionalSchema,
});

export const TextSectionSchema = SectionMetaSchema.extend({
  type: z.literal('text'),
  headline: z.string().max(60).optional(),
  content: z.string().min(1).max(5000),
  imageUrl: SafeImageUrlOptionalSchema,
  imagePosition: z.enum(['left', 'right']).default('left'),
});

export const GallerySectionSchema = SectionMetaSchema.extend({
  type: z.literal('gallery'),
  headline: z.string().max(60).default('Our Work'),
  images: z.array(GalleryImageSchema).max(50),
  instagramHandle: z.string().max(30).optional(),
});

export const TestimonialsSectionSchema = SectionMetaSchema.extend({
  type: z.literal('testimonials'),
  headline: z.string().max(60).default('What Our Clients Say'),
  items: z.array(TestimonialSchema).max(20),
});

export const FAQSectionSchema = SectionMetaSchema.extend({
  type: z.literal('faq'),
  headline: z.string().max(60).default('Frequently Asked Questions'),
  items: z.array(FAQItemSchema).max(30),
});

export const ContactSectionSchema = SectionMetaSchema.extend({
  type: z.literal('contact'),
  headline: z.string().max(60).default('Get in Touch'),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  hours: z.string().max(200).optional(),
});

export const CTASectionSchema = SectionMetaSchema.extend({
  type: z.literal('cta'),
  headline: z.string().min(1).max(100),
  subheadline: z.string().max(200).optional(),
  ctaText: z.string().max(30).default('Get Started'),
  backgroundColor: z.string().optional(),
});

export const PricingSectionSchema = SectionMetaSchema.extend({
  type: z.literal('pricing'),
  headline: z.string().max(60).default('Our Packages'),
  showPrices: z.boolean().default(true),
  tiers: z.array(PricingTierSchema).max(10),
});

export const FeaturesSectionSchema = SectionMetaSchema.extend({
  type: z.literal('features'),
  headline: z.string().max(60).default('Why Choose Us'),
  columns: z.enum(['2', '3', '4']).default('3'),
  items: z.array(FeatureItemSchema).max(12),
});
```

#### 1.4 Update DEFAULT_PAGES_CONFIG

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
        id: 'home-cta-main',
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
        id: 'about-text-main',
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
    enabled: false,
    sections: [
      {
        id: 'gallery-gallery-main',
        type: 'gallery',
        headline: '[Gallery Headline]',
        images: [],
        instagramHandle: '[Instagram Handle]',
      },
    ],
  },
  testimonials: {
    enabled: false,
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

#### 1.5 Tests for Phase 1

```typescript
// test/contracts/section-id.test.ts
describe('SectionIdSchema', () => {
  it('accepts valid section IDs', () => {
    expect(SectionIdSchema.safeParse('home-hero-main').success).toBe(true);
    expect(SectionIdSchema.safeParse('about-text-2').success).toBe(true);
    expect(SectionIdSchema.safeParse('faq-faq-main').success).toBe(true);
  });

  it('rejects invalid page names', () => {
    expect(SectionIdSchema.safeParse('invalid-hero-main').success).toBe(false);
  });

  it('rejects invalid section types', () => {
    expect(SectionIdSchema.safeParse('home-invalid-main').success).toBe(false);
  });

  it('rejects reserved JavaScript patterns', () => {
    expect(SectionIdSchema.safeParse('home-hero-__proto__').success).toBe(false);
    expect(SectionIdSchema.safeParse('home-hero-constructor').success).toBe(false);
  });

  it('rejects IDs over 50 characters', () => {
    const longId = 'home-hero-' + 'a'.repeat(45);
    expect(SectionIdSchema.safeParse(longId).success).toBe(false);
  });
});

describe('isSectionWithId', () => {
  it('returns true for sections with valid IDs', () => {
    const section = { id: 'home-hero-main', type: 'hero', headline: 'Test' };
    expect(isSectionWithId(section)).toBe(true);
  });

  it('returns false for sections without IDs', () => {
    const section = { type: 'hero', headline: 'Test' };
    expect(isSectionWithId(section)).toBe(false);
  });
});

describe('generateSectionId', () => {
  it('generates main for first section', () => {
    const id = generateSectionId('home', 'hero', new Set());
    expect(id).toBe('home-hero-main');
  });

  it('generates sequential numbers for additional sections', () => {
    const existing = new Set(['home-text-main']);
    const id = generateSectionId('home', 'text', existing);
    expect(id).toBe('home-text-2');
  });

  it('never reuses deleted IDs (monotonic)', () => {
    const existing = new Set(['home-text-main', 'home-text-3']);
    const id = generateSectionId('home', 'text', existing);
    expect(id).toBe('home-text-4'); // Not 2, which is "available"
  });
});
```

#### 1.6 Acceptance Criteria

- [ ] `SectionIdSchema` validates format and rejects reserved patterns
- [ ] All 9 section types have optional `id` field
- [ ] `isSectionWithId()` type guard works correctly
- [ ] `generateSectionId()` produces unique, monotonic IDs
- [ ] `DEFAULT_PAGES_CONFIG` has IDs and placeholder content
- [ ] All tests pass
- [ ] `npm run typecheck` passes across all workspaces

---

### Phase 2: Discovery Tools + Migration (P0) ✅ COMPLETE

**Estimated Time:** 5-6 hours
**Files:**

- `server/src/agent/tools/storefront-tools.ts`
- `server/src/agent/proposals/executor-schemas.ts`
- `server/scripts/migrate-section-ids.ts`

#### 2.1 Add `list_section_ids` Tool

```typescript
// server/src/agent/tools/storefront-tools.ts

/**
 * Section summary for discovery response
 */
interface SectionSummary {
  id: string;
  page: PageName;
  type: SectionType;
  headline: string;
  hasPlaceholder: boolean;
  placeholderFields: string[];
  existsInDraft: boolean;
  existsInLive: boolean;
  itemCount?: number; // For arrays (FAQ items, testimonials, etc.)
}

export const listSectionIdsTool: AgentTool = {
  name: 'list_section_ids',
  trustTier: 'T1', // Auto-confirm (read-only)
  description: `Discover all sections in the tenant's storefront. Returns section IDs, types, and whether they contain placeholder content. Call this FIRST before updating any sections.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        enum: PAGE_NAMES,
        description: 'Filter by page (optional). Omit to get all pages.',
      },
      sectionType: {
        type: 'string',
        enum: SECTION_TYPES,
        description: 'Filter by section type (optional).',
      },
      includeOnlyPlaceholders: {
        type: 'boolean',
        description: 'If true, only return sections with placeholder content.',
      },
    },
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const { pageName, sectionType, includeOnlyPlaceholders } = params as {
      pageName?: PageName;
      sectionType?: SectionType;
      includeOnlyPlaceholders?: boolean;
    };

    // Get both draft and live configs
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true, landingPageConfigDraft: true },
    });

    const draftConfig = tenant?.landingPageConfigDraft as LandingPageConfig | null;
    const liveConfig = tenant?.landingPageConfig as LandingPageConfig | null;
    const workingConfig = draftConfig || liveConfig || { pages: DEFAULT_PAGES_CONFIG };

    const sections: SectionSummary[] = [];
    const draftIds = new Set<string>();
    const liveIds = new Set<string>();

    // Collect all IDs from draft
    if (draftConfig?.pages) {
      for (const [page, pageConfig] of Object.entries(draftConfig.pages)) {
        for (const section of pageConfig.sections || []) {
          if (section.id) draftIds.add(section.id);
        }
      }
    }

    // Collect all IDs from live
    if (liveConfig?.pages) {
      for (const [page, pageConfig] of Object.entries(liveConfig.pages)) {
        for (const section of pageConfig.sections || []) {
          if (section.id) liveIds.add(section.id);
        }
      }
    }

    // Build section list from working config
    for (const [page, pageConfig] of Object.entries(workingConfig.pages || {})) {
      if (pageName && page !== pageName) continue;

      for (const section of pageConfig.sections || []) {
        if (sectionType && section.type !== sectionType) continue;

        const sectionId = section.id || `${page}-${section.type}-legacy`;
        const headline =
          (section as any).headline || (section as any).content?.substring(0, 50) || '';
        const placeholderFields = findPlaceholderFields(section);
        const hasPlaceholder = placeholderFields.length > 0;

        if (includeOnlyPlaceholders && !hasPlaceholder) continue;

        sections.push({
          id: sectionId,
          page: page as PageName,
          type: section.type as SectionType,
          headline,
          hasPlaceholder,
          placeholderFields,
          existsInDraft: draftIds.has(sectionId),
          existsInLive: liveIds.has(sectionId),
          itemCount: getItemCount(section),
        });
      }
    }

    return {
      success: true,
      data: {
        sections,
        totalCount: sections.length,
        hasDraft: !!draftConfig,
        placeholderCount: sections.filter((s) => s.hasPlaceholder).length,
      },
    };
  },
};

// Helper: Find fields containing placeholder text [Like This]
function findPlaceholderFields(section: any): string[] {
  const placeholders: string[] = [];
  const PLACEHOLDER_REGEX = /^\[[\w\s-]+\]$/;

  const checkValue = (key: string, value: any) => {
    if (typeof value === 'string' && PLACEHOLDER_REGEX.test(value)) {
      placeholders.push(key);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          Object.entries(item).forEach(([k, v]) => {
            if (typeof v === 'string' && PLACEHOLDER_REGEX.test(v)) {
              placeholders.push(`${key}[${index}].${k}`);
            }
          });
        }
      });
    }
  };

  Object.entries(section).forEach(([key, value]) => {
    if (key !== 'type' && key !== 'id') {
      checkValue(key, value);
    }
  });

  return placeholders;
}

// Helper: Get item count for array-based sections
function getItemCount(section: any): number | undefined {
  if (section.items) return section.items.length;
  if (section.images) return section.images.length;
  if (section.tiers) return section.tiers.length;
  return undefined;
}
```

#### 2.2 Add `get_section_by_id` Tool

```typescript
export const getSectionByIdTool: AgentTool = {
  name: 'get_section_by_id',
  trustTier: 'T1', // Auto-confirm (read-only)
  description:
    'Get full content of a section by its ID. Use this to see current content before making updates.',
  inputSchema: {
    type: 'object',
    properties: {
      sectionId: {
        type: 'string',
        description: 'Section ID (e.g., "home-hero-main"). Get IDs from list_section_ids.',
      },
    },
    required: ['sectionId'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;
    const { sectionId } = params as { sectionId: string };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true, landingPageConfigDraft: true },
    });

    const draftConfig = tenant?.landingPageConfigDraft as LandingPageConfig | null;
    const liveConfig = tenant?.landingPageConfig as LandingPageConfig | null;
    const workingConfig = draftConfig || liveConfig || { pages: DEFAULT_PAGES_CONFIG };

    // Find section by ID
    for (const [pageName, pageConfig] of Object.entries(workingConfig.pages || {})) {
      for (const section of pageConfig.sections || []) {
        const currentId = section.id || `${pageName}-${section.type}-legacy`;
        if (currentId === sectionId) {
          return {
            success: true,
            data: {
              section,
              page: pageName,
              source: draftConfig ? 'draft' : 'live',
              placeholderFields: findPlaceholderFields(section),
            },
          };
        }
      }
    }

    // Not found - provide helpful error
    const allIds = await getAllSectionIds(workingConfig);
    return {
      success: false,
      error: `Section '${sectionId}' not found. Available sections: ${allIds.join(', ')}`,
    };
  },
};

async function getAllSectionIds(config: LandingPageConfig): Promise<string[]> {
  const ids: string[] = [];
  for (const [pageName, pageConfig] of Object.entries(config.pages || {})) {
    for (const section of pageConfig.sections || []) {
      ids.push(section.id || `${pageName}-${section.type}-legacy`);
    }
  }
  return ids;
}
```

#### 2.3 Add `get_unfilled_placeholders` Tool

```typescript
export const getUnfilledPlaceholdersTool: AgentTool = {
  name: 'get_unfilled_placeholders',
  trustTier: 'T1', // Auto-confirm (read-only)
  description:
    'Get all sections and fields that still contain placeholder content [Like This]. Use this to guide users through setup.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  async execute(context: ToolContext): Promise<AgentToolResult> {
    const { tenantId, prisma } = context;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { landingPageConfig: true, landingPageConfigDraft: true },
    });

    const draftConfig = tenant?.landingPageConfigDraft as LandingPageConfig | null;
    const liveConfig = tenant?.landingPageConfig as LandingPageConfig | null;
    const workingConfig = draftConfig || liveConfig || { pages: DEFAULT_PAGES_CONFIG };

    const unfilledItems: Array<{
      sectionId: string;
      page: string;
      sectionType: string;
      field: string;
      currentValue: string;
    }> = [];

    let totalFields = 0;
    let filledFields = 0;

    for (const [pageName, pageConfig] of Object.entries(workingConfig.pages || {})) {
      for (const section of pageConfig.sections || []) {
        const sectionId = section.id || `${pageName}-${section.type}-legacy`;
        const placeholders = findPlaceholderFields(section);

        // Count fields for completion percentage
        const sectionFields = countEditableFields(section);
        totalFields += sectionFields;
        filledFields += sectionFields - placeholders.length;

        for (const field of placeholders) {
          const value = getFieldValue(section, field);
          unfilledItems.push({
            sectionId,
            page: pageName,
            sectionType: section.type,
            field,
            currentValue: value,
          });
        }
      }
    }

    const percentComplete = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 100;

    return {
      success: true,
      data: {
        unfilledItems,
        unfilledCount: unfilledItems.length,
        percentComplete,
        summary:
          unfilledItems.length === 0
            ? 'All content is filled in! Ready to publish.'
            : `${unfilledItems.length} fields still need content. ${percentComplete}% complete.`,
      },
    };
  },
};

function countEditableFields(section: any): number {
  let count = 0;
  const editableKeys = [
    'headline',
    'subheadline',
    'content',
    'ctaText',
    'email',
    'phone',
    'address',
    'hours',
  ];
  for (const key of editableKeys) {
    if (key in section) count++;
  }
  if (section.items) count += section.items.length * 2; // question + answer or quote + author
  return Math.max(count, 1);
}

function getFieldValue(section: any, fieldPath: string): string {
  const parts = fieldPath.split(/[\[\].]+/).filter(Boolean);
  let value: any = section;
  for (const part of parts) {
    value = value?.[part];
  }
  return typeof value === 'string' ? value : '';
}
```

#### 2.4 Migration Script

```typescript
// server/scripts/migrate-section-ids.ts

import { PrismaClient } from '../src/generated/prisma/client';
import { LandingPageConfig, generateSectionId, PAGE_NAMES, SectionType } from '@macon/contracts';

const prisma = new PrismaClient();

interface MigrationOptions {
  dryRun: boolean;
  tenantId?: string; // Optional: migrate single tenant
}

async function migrateSectionIds(options: MigrationOptions) {
  const { dryRun, tenantId } = options;

  console.log(`🚀 Section ID Migration ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('─'.repeat(50));

  const tenants = await prisma.tenant.findMany({
    where: tenantId ? { id: tenantId } : { landingPageConfig: { not: null } },
    select: { id: true, slug: true, landingPageConfig: true, landingPageConfigDraft: true },
  });

  console.log(`Found ${tenants.length} tenant(s) to process\n`);

  let totalMigrated = 0;
  let totalSections = 0;

  for (const tenant of tenants) {
    console.log(`\n📦 Tenant: ${tenant.slug} (${tenant.id})`);

    // CRITICAL: Fresh Set per tenant for isolation
    const existingIds = new Set<string>();

    // Migrate live config
    if (tenant.landingPageConfig) {
      const { config: migratedLive, count } = addIdsToConfig(
        tenant.landingPageConfig as LandingPageConfig,
        existingIds
      );
      totalSections += count;

      if (!dryRun) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { landingPageConfig: migratedLive as any },
        });
      }
      console.log(`  ✅ Live config: ${count} sections assigned IDs`);
    }

    // Migrate draft config (using same existingIds to prevent collisions)
    if (tenant.landingPageConfigDraft) {
      const { config: migratedDraft, count } = addIdsToConfig(
        tenant.landingPageConfigDraft as LandingPageConfig,
        existingIds
      );
      totalSections += count;

      if (!dryRun) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { landingPageConfigDraft: migratedDraft as any },
        });
      }
      console.log(`  ✅ Draft config: ${count} sections assigned IDs`);
    }

    totalMigrated++;
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`✅ Migration complete: ${totalMigrated} tenants, ${totalSections} sections`);

  if (dryRun) {
    console.log('\n⚠️  This was a dry run. No changes were made.');
    console.log('   Run without --dry-run to apply changes.');
  }
}

function addIdsToConfig(
  config: LandingPageConfig,
  existingIds: Set<string>
): { config: LandingPageConfig; count: number } {
  let count = 0;
  const pages = { ...config.pages };

  for (const [pageName, pageConfig] of Object.entries(pages)) {
    if (!pageConfig?.sections) continue;

    const newSections = pageConfig.sections.map((section) => {
      if (section.id && !existingIds.has(section.id)) {
        existingIds.add(section.id);
        return section; // Already has valid unique ID
      }

      // Generate new ID
      const newId = generateSectionId(
        pageName as (typeof PAGE_NAMES)[number],
        section.type as SectionType,
        existingIds
      );
      existingIds.add(newId);
      count++;

      return { ...section, id: newId };
    });

    pages[pageName as keyof typeof pages] = {
      ...pageConfig,
      sections: newSections,
    };
  }

  return { config: { ...config, pages }, count };
}

// CLI entry point
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tenantIdArg = args.find((a) => a.startsWith('--tenant-id='));
const tenantId = tenantIdArg?.split('=')[1];

migrateSectionIds({ dryRun, tenantId })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

#### 2.5 Add Uniqueness Validation in Executors

```typescript
// server/src/agent/executors/storefront-executors.ts

/**
 * Validate section ID uniqueness within a page config
 */
function validateSectionIdUniqueness(pages: PagesConfig): void {
  const allIds = new Set<string>();

  for (const [pageName, pageConfig] of Object.entries(pages)) {
    for (const section of pageConfig.sections || []) {
      if (section.id) {
        if (allIds.has(section.id)) {
          throw new Error(`Duplicate section ID '${section.id}' found. IDs must be unique.`);
        }
        allIds.add(section.id);
      }
    }
  }
}

// Call in update_page_section executor before saving
registerProposalExecutor('update_page_section', async (tenantId, payload, prisma) => {
  // ... existing validation ...

  // Validate uniqueness before saving
  validateSectionIdUniqueness(updatedPages);

  // Add audit logging
  logger.info(
    {
      tenantId,
      sectionId: sectionData.id,
      action: sectionIndex === -1 ? 'CREATE' : 'UPDATE',
      pageName,
    },
    'Section modified'
  );

  await saveDraftConfig(prisma, tenantId, updatedPages);
  // ... rest of executor ...
});
```

#### 2.6 Acceptance Criteria

- [ ] `list_section_ids` returns all sections with IDs, placeholder info, and draft/live status
- [ ] `get_section_by_id` returns full section content
- [ ] `get_unfilled_placeholders` returns completion percentage
- [ ] Migration script runs successfully in dry-run mode
- [ ] Migration script correctly isolates per-tenant
- [ ] No duplicate IDs after migration
- [ ] Uniqueness validation in executors works
- [ ] All tests pass

---

### Phase 3: ID-Based Tool Updates (P1) ✅ COMPLETE

**Estimated Time:** 3-4 hours
**Files:**

- `server/src/agent/tools/storefront-tools.ts`
- `server/src/agent/proposals/executor-schemas.ts`
- `server/src/agent/executors/storefront-executors.ts`

#### 3.1 Update Executor Schemas

```typescript
// server/src/agent/proposals/executor-schemas.ts

/**
 * Section locator - identify section by ID (preferred) or index (deprecated)
 */
export const SectionLocatorSchema = z
  .object({
    sectionId: SectionIdSchema.optional(),
    sectionIndex: z.number().int().min(-1).optional(),
  })
  .refine(
    (data) => {
      // Must have at least one, but not both (unless index is -1 for append)
      const hasId = data.sectionId !== undefined;
      const hasIndex = data.sectionIndex !== undefined;
      if (!hasId && !hasIndex) return true; // Append mode
      if (hasId && hasIndex && data.sectionIndex !== -1) return false;
      return true;
    },
    {
      message:
        'Provide sectionId OR sectionIndex, not both (exception: sectionIndex=-1 for append)',
    }
  );

export const UpdatePageSectionPayloadSchema = z
  .object({
    pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
    sectionData: SectionSchema,
  })
  .merge(SectionLocatorSchema);

export const RemovePageSectionPayloadSchema = z
  .object({
    pageName: z.enum(PAGE_NAMES as unknown as [string, ...string[]]),
  })
  .merge(
    SectionLocatorSchema.refine(
      (data) => data.sectionId !== undefined || data.sectionIndex !== undefined,
      { message: 'sectionId or sectionIndex required for removal' }
    )
  );
```

#### 3.2 Update Tool Definitions

```typescript
// server/src/agent/tools/storefront-tools.ts

export const updatePageSectionTool: AgentTool = {
  name: 'update_page_section',
  trustTier: 'T2', // Soft-confirm
  description: `Update or add a section on a page. Use sectionId (preferred) to update existing section, or omit to append new section.`,
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        enum: PAGE_NAMES,
        description: 'Target page',
      },
      sectionId: {
        type: 'string',
        description:
          'Section ID to update (e.g., "home-hero-main"). Get IDs from list_section_ids. Omit to add new section.',
      },
      sectionIndex: {
        type: 'number',
        description:
          'DEPRECATED: Use sectionId instead. Index kept for backward compatibility only.',
      },
      sectionType: {
        type: 'string',
        enum: SECTION_TYPES,
        description: 'Section type (required when adding new section)',
      },
      // ... other section-specific fields
    },
    required: ['pageName'],
  },
  async execute(context: ToolContext, params: Record<string, unknown>): Promise<AgentToolResult> {
    const { sectionId, sectionIndex, pageName, sectionType, ...sectionFields } = params;

    // Mutual exclusivity check
    if (sectionId !== undefined && sectionIndex !== undefined && sectionIndex !== -1) {
      return {
        success: false,
        error: 'Provide either sectionId or sectionIndex, not both. Use sectionId (recommended).',
      };
    }

    // ... rest of execution (resolve ID to index, create proposal, etc.)
  },
};

export const removePageSectionTool: AgentTool = {
  name: 'remove_page_section',
  trustTier: 'T2', // Soft-confirm
  description: 'Remove a section from a page by its ID.',
  inputSchema: {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        enum: PAGE_NAMES,
        description: 'Target page',
      },
      sectionId: {
        type: 'string',
        description: 'Section ID to remove (e.g., "home-cta-main"). Get IDs from list_section_ids.',
      },
      sectionIndex: {
        type: 'number',
        description: 'DEPRECATED: Use sectionId instead.',
      },
    },
    required: ['pageName'],
  },
  // ... execution
};
```

#### 3.3 Adjust Trust Tiers

```typescript
// Upgrade publish_draft to T3 (requires explicit confirmation)
export const publishDraftTool: AgentTool = {
  name: 'publish_draft',
  trustTier: 'T3', // CHANGED from T2 - this makes changes live to visitors
  description:
    'Publish all draft changes to the live storefront. This makes changes visible to visitors.',
  // ...
};

// Upgrade page visibility tools to T2
export const togglePageEnabledTool: AgentTool = {
  name: 'toggle_page_enabled',
  trustTier: 'T2', // CHANGED from T1 - hiding a page affects visitor experience
  // ...
};

export const reorderPageSectionsTool: AgentTool = {
  name: 'reorder_page_sections',
  trustTier: 'T2', // CHANGED from T1 - affects UX significantly
  // ...
};
```

#### 3.4 Add Audit Logging

```typescript
// In each executor
import { logger } from '../../lib/core/logger';

registerProposalExecutor('update_page_section', async (tenantId, payload, prisma) => {
  // ... validation and update logic ...

  // Audit log
  logger.info(
    {
      tenantId,
      sectionId: sectionData.id,
      pageName,
      action: isNewSection ? 'CREATE' : 'UPDATE',
      proposalId: context.proposalId,
    },
    'Section modified via agent tool'
  );

  // ...
});

registerProposalExecutor('remove_page_section', async (tenantId, payload, prisma) => {
  // ... validation and removal logic ...

  logger.info(
    {
      tenantId,
      sectionId,
      pageName,
      action: 'DELETE',
      proposalId: context.proposalId,
    },
    'Section removed via agent tool'
  );

  // ...
});
```

#### 3.5 Acceptance Criteria

- [ ] `update_page_section` accepts `sectionId` parameter
- [ ] `remove_page_section` accepts `sectionId` parameter
- [ ] Mutual exclusivity validation works (sectionId XOR sectionIndex)
- [ ] Clear error when section ID not found
- [ ] Old `sectionIndex` parameter still works (backward compat)
- [ ] `publish_draft` is T3 (explicit confirmation)
- [ ] Audit logs include sectionId
- [ ] All tests pass

---

### Phase 4: Unification + Agent Intelligence (P2) ✅ COMPLETE

**Estimated Time:** 2-3 hours
**Files:**

- `server/src/agent/onboarding/advisor-orchestrator.ts`
- `server/src/agent/prompts/onboarding-system-prompt.ts`

#### 4.1 Expose Build Mode Tools During Onboarding

```typescript
// server/src/agent/onboarding/advisor-orchestrator.ts

function getToolsForPhase(phase: OnboardingPhase): AgentTool[] {
  const baseTools = [
    /* discovery tools, etc. */
  ];

  if (phase === 'MARKETING') {
    // Full Build Mode capabilities during marketing phase
    return [
      ...baseTools,
      listSectionIdsTool,
      getSectionByIdTool,
      getUnfilledPlaceholdersTool,
      updatePageSectionTool,
      removePageSectionTool,
      reorderPageSectionsTool,
      togglePageEnabledTool,
      updateStorefrontBrandingTool,
      publishDraftTool,
      discardDraftTool,
    ];
  }

  return baseTools;
}
```

#### 4.2 Update System Prompt with Disambiguation Flow

```markdown
## Website Customization (MARKETING Phase)

You have full control over the tenant's storefront. Follow this workflow:

### Step 1: Discover Sections

ALWAYS call `list_section_ids` first to see what sections exist and which need content.

### Step 2: Reference Sections by ID

Use stable section IDs like "home-hero-main", not array indices.

- IDs follow the pattern: {page}-{type}-{qualifier}
- Examples: home-hero-main, about-text-intro, faq-faq-main

### Step 3: Handle Ambiguous References

When user says something ambiguous like "update the hero":

1. Call `list_section_ids` with sectionType filter
2. If 1 match → proceed with update
3. If multiple matches → ask for clarification:
   "I found 2 hero sections: 'home-hero-main' (Home page) and 'services-hero-main' (Services page). Which one would you like to update?"
4. If no matches → suggest available sections

### Natural Language Mapping

- "the hero" → Check all pages for hero, disambiguate if >1
- "main headline" → home-hero-main.headline (home is default page)
- "services hero" → services-hero-main
- "the FAQ about booking" → Search FAQ items for "book" keyword

### Placeholder Content

Sections with `[Placeholder Text]` need content. Use `get_unfilled_placeholders` to see completion status and guide users through filling in their storefront.

### Draft/Publish Workflow

All changes go to draft first. Remind users to `publish_draft` when they're happy with changes.
```

#### 4.3 Acceptance Criteria

- [ ] All Build Mode tools available during MARKETING phase
- [ ] System prompt includes disambiguation guidance
- [ ] AI can guide user through full website setup
- [ ] `list_section_ids` is called before section updates
- [ ] Draft/publish workflow explained to users

---

## File Change Summary

| File                                                   | Changes                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/landing-page.ts`               | Add SectionIdSchema, type guard, generator, update all section schemas, update DEFAULT_PAGES_CONFIG      |
| `server/src/agent/tools/storefront-tools.ts`           | Add list_section_ids, get_section_by_id, get_unfilled_placeholders, update existing tools for ID support |
| `server/src/agent/proposals/executor-schemas.ts`       | Add SectionLocatorSchema, update Update/Remove payload schemas                                           |
| `server/src/agent/executors/storefront-executors.ts`   | Add uniqueness validation, audit logging, ID resolution                                                  |
| `server/scripts/migrate-section-ids.ts`                | New file - migration script                                                                              |
| `server/src/agent/onboarding/advisor-orchestrator.ts`  | Expose Build Mode tools in MARKETING phase                                                               |
| `server/src/agent/prompts/onboarding-system-prompt.ts` | Add disambiguation flow and section ID guidance                                                          |

---

## Testing Checklist

### Unit Tests

- [ ] SectionIdSchema validation (valid IDs, invalid formats, reserved patterns)
- [ ] isSectionWithId type guard
- [ ] generateSectionId uniqueness and monotonicity
- [ ] findPlaceholderFields detection
- [ ] SectionLocatorSchema mutual exclusivity

### Integration Tests

- [ ] list_section_ids returns correct structure
- [ ] get_section_by_id finds sections
- [ ] get_unfilled_placeholders calculates completion
- [ ] update_page_section by ID works
- [ ] remove_page_section by ID works
- [ ] Migration script tenant isolation
- [ ] Migration script dry-run mode
- [ ] No duplicate IDs after migration

### E2E Tests

- [ ] AI can discover sections
- [ ] AI can update section by ID
- [ ] AI handles disambiguation
- [ ] AI guides through placeholder completion
- [ ] Draft/publish workflow with IDs

---

## Rollback Plan

If issues occur after deployment:

1. **Schema rollback:** The `id` field is optional, so old code ignores it
2. **Tool rollback:** Both sectionId and sectionIndex work; can revert to index-only
3. **Migration rollback:** IDs are additive; can be ignored if not used
4. **Data rollback:** IDs don't affect rendering; safe to leave in place

---

## Success Metrics

| Metric                                | Target           | Measurement             |
| ------------------------------------- | ---------------- | ----------------------- |
| Section update success rate           | >98%             | Proposal execution logs |
| AI-guided setup completion            | +25% vs baseline | Onboarding funnel       |
| "How to edit website" support tickets | -50%             | Support system          |
| Time to first customization           | <5 minutes       | Session analytics       |
