# TODO-224: Landing Page Section Order is Hardcoded

## Priority: P3 (Nice-to-have)

## Status: Deferred

## Source: Code Review - Landing Page Implementation

## Deferral Reason

This feature has been deferred because:

1. **MVP Acceptability**: The current hardcoded section order works well for MVP. Most tenants will be satisfied with the default professional layout.

2. **Schema Complexity**: Implementing dynamic ordering requires adding a `sectionOrder` array to the database schema and significant LandingPage.tsx refactoring to support dynamic section rendering.

3. **Admin UI Dependencies**: This feature requires a drag-and-drop interface in the tenant admin panel (depends on TODO-205: Missing Tenant Admin Landing Page UI).

4. **Development Effort**: The implementation is well-documented below and can be tackled in a future sprint when admin UI infrastructure is ready.

**Future Implementation**: When ready to implement, follow the schema, component, and admin UI patterns documented in this TODO.

## Description

Section render order is hardcoded in LandingPage.tsx. Tenants might want to reorder sections (e.g., move testimonials above about section).

## Current Implementation

```typescript
// LandingPage.tsx - Fixed order
<div className="landing-page">
  {sections?.hero && <HeroSection />}
  {sections?.socialProofBar && <SocialProofBar />}
  {sections?.segmentSelector && <SegmentSelector />}
  {sections?.about && <AboutSection />}
  {sections?.testimonials && <TestimonialsSection />}
  {sections?.accommodation && <AccommodationSection />}
  {sections?.gallery && <GallerySection />}
  {sections?.faq && <FaqSection />}
  {sections?.finalCta && <FinalCtaSection />}
</div>
```

## Suggested Enhancement

### Schema Change

```typescript
// landing-page.ts
const SectionTypeEnum = z.enum([
  'hero',
  'socialProofBar',
  'segmentSelector',
  'about',
  'testimonials',
  'accommodation',
  'gallery',
  'faq',
  'finalCta',
]);

export const LandingPageConfigSchema = z.object({
  // Ordered list of enabled sections
  sectionOrder: z.array(SectionTypeEnum).default([
    'hero',
    'socialProofBar',
    'segmentSelector',
    'about',
    'testimonials',
    'accommodation',
    'gallery',
    'faq',
    'finalCta',
  ]),
  // Section configs remain the same
  hero: HeroSectionConfigSchema.optional(),
  // ...
});
```

### Component Change

```typescript
// LandingPage.tsx
const SECTION_COMPONENTS: Record<string, React.ComponentType<{ config: unknown }>> = {
  hero: HeroSection,
  socialProofBar: SocialProofBar,
  segmentSelector: SegmentSelectorSection,
  about: AboutSection,
  testimonials: TestimonialsSection,
  accommodation: AccommodationSection,
  gallery: GallerySection,
  faq: FaqSection,
  finalCta: FinalCtaSection,
};

function LandingPageContent({ tenant }: LandingPageProps) {
  const landingPage = tenant.branding?.landingPage;
  const sectionOrder = landingPage?.sectionOrder || DEFAULT_ORDER;

  return (
    <div className="landing-page">
      {sectionOrder.map((sectionType) => {
        const Component = SECTION_COMPONENTS[sectionType];
        const config = landingPage?.[sectionType];

        if (!config && sectionType !== 'segmentSelector') return null;

        return <Component key={sectionType} config={config} />;
      })}
    </div>
  );
}
```

### Admin UI - Drag and Drop

```typescript
// SectionOrderEditor.tsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

function SectionOrderEditor({ order, onChange }) {
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = order.indexOf(active.id);
      const newIndex = order.indexOf(over.id);
      const newOrder = arrayMove(order, oldIndex, newIndex);
      onChange(newOrder);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {order.map((section) => (
          <SortableItem key={section} id={section} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

## Acceptance Criteria

- [ ] Section order stored in config
- [ ] LandingPage renders in configured order
- [ ] Admin UI allows drag-and-drop reordering
- [ ] Default order preserved for backward compatibility

## Implementation Notes

**Prerequisites:**
- TODO-205: Tenant Admin Landing Page UI (required for admin interface)
- Consider using `@dnd-kit` library for drag-and-drop (lightweight, accessible)

**Migration Strategy:**
- The `sectionOrder` field should have a sensible default to maintain backward compatibility
- Existing tenants without `sectionOrder` will use the current hardcoded order
- New tenants will get the default order in their config

**Recommended Approach:**
The solution outlined above (with `sectionOrder` array, component mapping, and drag-and-drop admin UI) is the recommended implementation path when this feature is prioritized.

## Tags

ux, admin, landing-page, drag-drop, deferred
