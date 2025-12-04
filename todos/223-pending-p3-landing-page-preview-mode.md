---
status: pending
priority: p3
issue_id: "223"
tags: [ux, admin, preview, landing-page]
dependencies: []
---

# TODO-223: Missing Landing Page Preview Mode for Admin

## Priority: P3 (Nice-to-have)

## Status: Deferred

## Source: Code Review - Landing Page Implementation

## Deferral Reason

This feature is being deferred because it requires significant architectural changes beyond the current MVP scope:

1. **Schema Changes Required**: Need to extend the `branding.landingPage` structure to support both `draft` and `published` configurations, plus metadata fields (`lastDraftSaved`, `lastPublished`)

2. **New API Endpoints**: Requires publish/discard workflow endpoints that don't currently exist:
   - `PUT /v1/tenant-admin/landing-page/publish` - Copy draft to published
   - `DELETE /v1/tenant-admin/landing-page/draft` - Discard draft changes
   - `GET /v1/landing-page?preview=true` - Fetch draft config

3. **Admin UI Dependency**: This feature depends on TODO-205 (Missing Tenant Admin Landing Page UI) being implemented first, as preview mode only makes sense when there's a UI to edit draft content

4. **Authentication for Preview**: Preview mode needs authentication to prevent unauthorized access to draft content, adding additional complexity

**Prerequisites:**
- ✅ TODO-202 (Backend Landing Page Routes) - Complete
- ⏳ TODO-205 (Tenant Admin Landing Page UI) - Required before this can be implemented

**Future Implementation Note**: The architecture outlined in this TODO is sound and should be followed when this feature is prioritized post-MVP.

## Description

Tenant admins should be able to preview landing page changes before publishing. Currently, changes would go live immediately.

## Suggested Implementation

### Draft Mode Architecture

1. Store draft config separately from published config
2. Preview route loads draft config
3. Publish action copies draft to published

### Schema Extension

```typescript
// landing-page.ts
export const LandingPageDraftSchema = z.object({
  draft: LandingPageConfigSchema.optional(),
  published: LandingPageConfigSchema.optional(),
  lastDraftSaved: z.date().optional(),
  lastPublished: z.date().optional(),
});
```

### Preview Route

```typescript
// Add query param support
// /t/tenant-slug?preview=true

function LandingPage({ tenant }: LandingPageProps) {
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

  // Load draft config if preview mode
  const config = isPreview
    ? tenant.branding?.landingPage?.draft
    : tenant.branding?.landingPage?.published;

  return (
    <>
      {isPreview && (
        <div className="bg-yellow-100 text-yellow-800 p-2 text-center sticky top-0 z-50">
          Preview Mode - Changes not yet published
        </div>
      )}
      <LandingPageContent config={config} />
    </>
  );
}
```

### Admin Preview Button

```typescript
// In LandingPageSettings.tsx
function PreviewButton({ tenantSlug }: { tenantSlug: string }) {
  const previewUrl = `/t/${tenantSlug}?preview=true`;

  return (
    <a
      href={previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-secondary"
    >
      Preview Changes
    </a>
  );
}
```

### Publish Workflow

```typescript
// API endpoint
PUT /v1/tenant-admin/landing-page/publish

// Copies draft to published
async function publishLandingPage(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { branding: true },
  });

  const draft = tenant.branding?.landingPage?.draft;
  if (!draft) throw new Error('No draft to publish');

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      branding: {
        ...tenant.branding,
        landingPage: {
          ...tenant.branding.landingPage,
          published: draft,
          lastPublished: new Date(),
        },
      },
    },
  });
}
```

## Features

- Live preview of unpublished changes
- Clear visual indicator in preview mode
- Publish/discard draft actions
- Preview link shareable for review

## Acceptance Criteria

- [ ] Draft config saved separately from published
- [ ] Preview route shows draft content
- [ ] Preview banner visible in preview mode
- [ ] Publish action updates live site
- [ ] Discard action reverts to published

## Tags

ux, admin, preview, landing-page
