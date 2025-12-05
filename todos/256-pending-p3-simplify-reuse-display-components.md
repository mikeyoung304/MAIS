---
status: pending
priority: p3
issue_id: '256'
tags: [code-review, landing-page, simplification]
dependencies: ['246']
source: 'plan-review-2025-12-04'
---

# TODO-256: Simplify by Reusing Display Components for Editing

## Priority: P3 (Suggestion - Code Reduction)

## Status: Pending

## Source: Plan Review - Simplicity Reviewer

## Problem Statement

The plan creates 7 new "Editable" section components that duplicate existing display components. This doubles the maintenance burden and codebase size.

**Why It Matters:**

- 7 duplicated components = 2x maintenance burden
- Bug fixes needed in two places
- Visual inconsistency risk between editor and live site
- Estimated 1000+ lines of duplicate code

## Findings

### Existing Display Components

```
client/src/features/storefront/landing/sections/
├── HeroSection.tsx
├── AboutSection.tsx
├── TestimonialsSection.tsx
├── FaqSection.tsx
├── GallerySection.tsx
├── AccommodationSection.tsx
└── FinalCtaSection.tsx
```

### Plan Creates Duplicates

```
client/src/features/tenant-admin/landing-page-editor/sections/
├── EditableHeroSection.tsx      # Duplicates HeroSection
├── EditableAboutSection.tsx     # Duplicates AboutSection
├── EditableTestimonialsSection.tsx  # Duplicates TestimonialsSection
├── EditableFaqSection.tsx       # Duplicates FaqSection
├── EditableGallerySection.tsx   # Duplicates GallerySection
├── EditableAccommodationSection.tsx # Duplicates AccommodationSection
└── EditableFinalCtaSection.tsx  # Duplicates FinalCtaSection
```

## Proposed Solutions

### Option A: Add `editable` Prop to Existing Components (Recommended)
- **Effort:** 4-6 hours refactor
- **Risk:** Low
- Add `editable?: boolean` and `onUpdate?: (updates) => void` props
- Wrap text in `<EditableText>` when `editable={true}`
- Wrap images in `<EditableImage>` when `editable={true}`
- **Pros:** Zero duplication, one source of truth
- **Cons:** Existing components get slightly more complex

### Option B: Keep Separate Components
- **Effort:** 8-12 hours for new components
- **Risk:** Medium (maintenance burden)
- Create all editable components as planned
- **Pros:** Clean separation of concerns
- **Cons:** Duplication, drift risk

## Recommended Action

**Execute Option A:** Modify existing components:

```tsx
// HeroSection.tsx (modified)
interface HeroSectionProps {
  config: HeroSectionConfig;
  editable?: boolean;
  onUpdate?: (updates: Partial<HeroSectionConfig>) => void;
}

export const HeroSection = memo(function HeroSection({
  config,
  editable = false,
  onUpdate
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[600px] ...">
      {/* Background Image */}
      {editable ? (
        <EditableImage
          currentUrl={config.backgroundImageUrl}
          onUpload={(url) => onUpdate?.({ backgroundImageUrl: url })}
          className="absolute inset-0"
        />
      ) : (
        config.backgroundImageUrl && (
          <img src={config.backgroundImageUrl} className="absolute inset-0" />
        )
      )}

      {/* Headline */}
      {editable ? (
        <EditableText
          value={config.headline}
          onChange={(headline) => onUpdate?.({ headline })}
          className="text-5xl font-bold"
        />
      ) : (
        <h1 className="text-5xl font-bold">{config.headline}</h1>
      )}

      {/* ... similar for other fields */}
    </section>
  );
});
```

### Rendering in Editor

```tsx
// LandingPageEditor.tsx
<HeroSection
  config={draftConfig.hero}
  editable={true}
  onUpdate={(updates) => editor.updateSectionContent('hero', updates)}
/>
```

### Rendering in Storefront (unchanged)

```tsx
// LandingPage.tsx
<HeroSection config={tenant.landingPage.hero} />
```

## Acceptance Criteria

- [ ] All 7 section components support `editable` prop
- [ ] All 7 section components support `onUpdate` callback
- [ ] Zero new editable section files created
- [ ] Editor uses existing components with `editable={true}`
- [ ] Storefront unchanged (no prop changes)

## Work Log

| Date       | Action  | Notes                                               |
|------------|---------|-----------------------------------------------------|
| 2025-12-04 | Created | Simplicity review identified duplication opportunity |

## Tags

code-review, landing-page, simplification
