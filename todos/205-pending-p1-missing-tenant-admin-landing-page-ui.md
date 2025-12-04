---
status: pending
priority: p1
issue_id: "205"
tags: [frontend, tenant-admin, landing-page, ui, forms, deferred]
dependencies: []
---

# TODO-205: Missing Tenant Admin UI for Landing Page Configuration

## Priority: P1 (Critical)

## Status: Deferred - Ready for Development

## Source: Code Review - Landing Page Implementation

## Decision Rationale

This TODO is being deferred because:
1. **Substantial Scope**: Requires 10+ UI components, image upload integration, and route configuration
2. **Backend Complete**: TODO-202 (backend CRUD routes) has been successfully implemented
3. **Dedicated Sprint Required**: This feature needs focused development time, not parallel resolution
4. **Well Documented**: All requirements, component structure, and acceptance criteria are clearly defined

## Prerequisites Status

- ✅ **TODO-202 Complete**: All backend landing page CRUD routes implemented
  - `GET /v1/tenant-admin/landing-page` - Fetch configuration
  - `PUT /v1/tenant-admin/landing-page` - Update configuration
  - All routes validated with tests
- ⏳ **Image Upload System**: Existing photo upload system needs integration
- ⏳ **Router Configuration**: Client-side routes need setup

## Description

There is no admin interface for tenants to configure their landing pages. The feature requires manual database manipulation which is not viable for production use.

## Required Features

1. **Section Toggle Panel** - Enable/disable each of the 9 sections
2. **Hero Editor** - Headline, subheadline, CTA text, background image upload
3. **Social Proof Editor** - Add/edit/remove stat items
4. **About Editor** - Title, description, bullet points, image
5. **Testimonials Editor** - Add/edit/remove testimonials
6. **Accommodation Editor** - Title, description, amenities, image
7. **Gallery Editor** - Upload/reorder/remove images
8. **FAQ Editor** - Add/edit/remove Q&A pairs
9. **Final CTA Editor** - Headline, subheadline, CTA text/link

## Files to Create

```
client/src/features/tenant-admin/landing-page/
├── LandingPageSettings.tsx         # Main settings page
├── SectionTogglePanel.tsx          # Section enable/disable controls
├── editors/
│   ├── HeroEditor.tsx              # Hero section form
│   ├── SocialProofEditor.tsx       # Stats editor
│   ├── AboutEditor.tsx             # About section form
│   ├── TestimonialsEditor.tsx      # Testimonials list editor
│   ├── AccommodationEditor.tsx     # Accommodation section form
│   ├── GalleryEditor.tsx           # Image gallery manager
│   ├── FaqEditor.tsx               # FAQ list editor
│   └── FinalCtaEditor.tsx          # Final CTA form
├── hooks/
│   └── useLandingPageConfig.ts     # React Query hook
└── index.ts                        # Barrel export
```

## Routes to Add

```typescript
// client/src/app/routes.tsx
{
  path: 'landing-page',
  element: <LandingPageSettings />,
}
// Under /tenant/settings/landing-page
```

## Navigation to Add

```typescript
// In tenant admin sidebar/settings
<NavLink to="/tenant/settings/landing-page">
  Landing Page
</NavLink>
```

## Component Structure

```typescript
// LandingPageSettings.tsx
export function LandingPageSettings() {
  const { data: config, isLoading } = useLandingPageConfig();
  const [activeEditor, setActiveEditor] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: Section toggles */}
      <div className="col-span-1">
        <SectionTogglePanel
          sections={config?.sections}
          onToggle={handleToggle}
        />
      </div>

      {/* Right: Section editor */}
      <div className="col-span-2">
        {activeEditor === 'hero' && <HeroEditor config={config?.hero} />}
        {activeEditor === 'about' && <AboutEditor config={config?.about} />}
        {/* ... other editors */}
      </div>
    </div>
  );
}
```

## Dependencies

- ✅ **TODO-202 COMPLETE**: Backend CRUD routes implemented and tested
- ⏳ Requires image upload integration with existing photo upload system
- ⏳ Client-side router configuration needed

## Acceptance Criteria

- [ ] Landing page settings page accessible from tenant admin
- [ ] All 9 sections can be toggled on/off
- [ ] Each section has a dedicated editor component
- [ ] Changes save via API and reflect on storefront
- [ ] Image upload works for all image fields
- [ ] Preview functionality (optional but recommended)
- [ ] Mobile-responsive admin UI

## Next Steps for Implementation

When this feature is scheduled for development:

1. **Phase 1: Core Infrastructure** (1 day)
   - Set up route in `client/src/app/routes.tsx`
   - Create `LandingPageSettings.tsx` main container
   - Implement `useLandingPageConfig` React Query hook
   - Add navigation link in tenant admin sidebar

2. **Phase 2: Section Editors** (3-4 days)
   - Implement `SectionTogglePanel.tsx`
   - Create all 8 section editor components
   - Integrate with existing image upload system
   - Add form validation with Zod

3. **Phase 3: Testing & Polish** (1-2 days)
   - Add E2E tests for each editor
   - Implement preview functionality (optional)
   - Mobile responsive design
   - Error handling and loading states

**Estimated Timeline**: 5-7 days of focused development

## Tags

frontend, tenant-admin, landing-page, ui, forms, deferred
