# Issue #697 - Storefront Agent Publish Wrapper Fix - Visual Reference

## The Problem (Before Fix)

```
USER WORKFLOW
─────────────────────────────────────────────────────────────────
Storefront Agent → "Publishing headlines..."
         ↓
  Backend: /storefront/publish endpoint
         ↓
  Wrapper Construction (BROKEN):
  ┌─────────────────────────────────┐
  │ {                               │
  │   published: draftConfig,  ✗    │  Missing publishedAt!
  │   draft: null,             ✓    │
  │   draftUpdatedAt: null,    ✓    │
  │ }                               │
  └─────────────────────────────────┘
         ↓
  Database: Stored incomplete wrapper
         ↓
  Public API: findBySlugPublic()
         ↓
  Validation Layer: publishedAt is missing
         ↓
  Silent Failure: Can't deserialize
         ↓
  UI: Shows placeholder "[Your Transformation Headline]"
         ↓
Agent Message: "Done! ✓ Storefront" (false positive)
User sees: No changes persisted
```

## The Solution (After Fix)

```
USER WORKFLOW
─────────────────────────────────────────────────────────────────
Storefront Agent → "Publishing headlines..."
         ↓
  Backend: /storefront/publish endpoint
         ↓
  Wrapper Construction (FIXED):
  ┌──────────────────────────────────────────┐
  │ createPublishedWrapper(draftConfig)      │  ← Helper function
  │    returns:                              │
  │ {                                        │
  │   published: draftConfig,         ✓      │
  │   publishedAt: "2026-01-20T15..." ✓ NEW  │  ISO timestamp
  │   draft: null,                    ✓      │
  │   draftUpdatedAt: null,           ✓      │
  │ }                                        │
  └──────────────────────────────────────────┘
         ↓
  Database: Stored complete wrapper with timestamp
         ↓
  Public API: findBySlugPublic()
         ↓
  Validation Layer: All required fields present ✓
         ↓
  Deserialization: Success ✓
         ↓
  UI: Renders published headlines correctly
         ↓
Agent Message: "Done! ✓ Storefront" (accurate)
User sees: Changes persisted and visible
```

## Code Comparison

### BEFORE (Broken)

```typescript
// server/src/routes/internal-agent.routes.ts - line 1500
router.post('/storefront/publish', async (req: Request, res: Response) => {
  try {
    const { tenantId } = TenantIdSchema.parse(req.body);
    const tenant = await tenantRepo.find(tenantId);

    if (!tenant.landingPageConfigDraft) {
      res.status(400).json({ error: 'No draft to publish' });
      return;
    }

    // ✗ BROKEN: Missing publishedAt field
    const draftConfig = tenant.landingPageConfigDraft;
    await tenantRepo.update(tenantId, {
      landingPageConfig: { published: draftConfig }, // ← INCOMPLETE WRAPPER
      landingPageConfigDraft: null,
    });

    res.json({ success: true, action: 'published' });
  } catch (error) {
    handleError(res, error, '/storefront/publish');
  }
});
```

### AFTER (Fixed)

```typescript
// server/src/routes/internal-agent.routes.ts - line 1500
import { createPublishedWrapper } from '../lib/landing-page-utils'; // ← NEW IMPORT

router.post('/storefront/publish', async (req: Request, res: Response) => {
  try {
    const { tenantId } = TenantIdSchema.parse(req.body);
    const tenant = await tenantRepo.find(tenantId);

    if (!tenant.landingPageConfigDraft) {
      res.status(400).json({ error: 'No draft to publish' });
      return;
    }

    // ✓ FIXED: Using helper function that includes publishedAt
    const draftConfig = tenant.landingPageConfigDraft;
    await tenantRepo.update(tenantId, {
      landingPageConfig: createPublishedWrapper(draftConfig), // ← COMPLETE WRAPPER
      landingPageConfigDraft: null,
    });

    res.json({ success: true, action: 'published' });
  } catch (error) {
    handleError(res, error, '/storefront/publish');
  }
});
```

## The Helper Function

```typescript
// server/src/lib/landing-page-utils.ts
export function createPublishedWrapper(draftConfig: unknown): PublishedWrapper {
  return {
    draft: null,                          // Clear draft copy
    draftUpdatedAt: null,                 // Clear draft timestamp
    published: draftConfig,               // The content to publish
    publishedAt: new Date().toISOString(), // ← Critical timestamp!
  };
}

// Generated output example:
{
  draft: null,
  draftUpdatedAt: null,
  published: { pages: { home: { sections: [...] } } },
  publishedAt: "2026-01-20T15:30:00.000Z"  // ISO 8601 format
}
```

## Dual Draft System Architecture

```
TENANT MODEL
──────────────────────────────────────────────────────────────

┌─ landingPageConfigDraft
│  └─ { pages: {...} }  ← Working copy while editing
│
└─ landingPageConfig
   ├─ draft: null           ← Cleared when publishing
   ├─ draftUpdatedAt: null  ← Cleared when publishing
   ├─ published: {...}      ← The live content
   └─ publishedAt: "..."    ← Publish timestamp (was missing!)

PUBLISHING FLOW
──────────────────────────────────────────────────────────────

Before Publish:
  landingPageConfigDraft: { pages: { home: [...] } }
  landingPageConfig: { draft: {...}, published: {...} }

After Publish:
  landingPageConfigDraft: null                    ← Cleared
  landingPageConfig: {                            ← Updated
    draft: null,
    draftUpdatedAt: null,
    published: { pages: { home: [...] } },        ← Was draftConfig
    publishedAt: "2026-01-20T15:30:00.000Z"       ← Was missing!
  }
```

## All Code Paths Using createPublishedWrapper

```
Single Source of Truth
─────────────────────────────────────────────────────────────

lib/landing-page-utils.ts
└── createPublishedWrapper()  (One function, all paths use it)
    ├── server/src/services/landing-page.service.ts
    │   └── publishBuildModeDraft()  ✓ Already using
    │
    ├── server/src/agent/executors/storefront-executors.ts
    │   └── publish_draft executor  ✓ Already using
    │
    └── server/src/routes/internal-agent.routes.ts
        └── POST /v1/internal/agent/storefront/publish  ✓ NOW FIXED
```

## Why Validation Failed Silently

```
DATA FLOW ISSUE
───────────────────────────────────────────────────────────────

1. Store incomplete wrapper (missing publishedAt)
   └─> Database accepts it (no schema validation on JSON field)

2. Public API reads wrapper
   └─> Validation layer expects { draft, draftUpdatedAt, published, publishedAt }
   └─> publishedAt is missing
   └─> Validation fails

3. Deserialization attempts to create PublishedWrapper type
   └─> publishedAt is required (non-nullable)
   └─> Cannot deserialize
   └─> Returns null or default

4. UI tries to render content
   └─> published field is null or missing
   └─> Shows placeholder instead of actual content

5. No error thrown
   └─> Agent message says "✓ Success"
   └─> User confusion: "Why didn't it work?"

Solution: Ensure wrapper has all required fields BEFORE storing
```

## Prevention Checklist Flowchart

```
Need to publish landing page config?
│
├─ Question 1: Are you constructing a wrapper manually?
│  ├─ YES: ✗ WRONG - Use createPublishedWrapper()
│  └─ NO: Continue
│
├─ Question 2: Are you importing from landing-page-utils?
│  ├─ NO: ✗ WRONG - import { createPublishedWrapper } from '../lib/landing-page-utils'
│  └─ YES: Continue
│
├─ Question 3: Does your code look like this?
│  │
│  │ const wrapper = createPublishedWrapper(draftConfig);
│  │ await db.update({
│  │   landingPageConfig: wrapper,
│  │   landingPageConfigDraft: null,
│  │ });
│  │
│  ├─ YES: ✓ CORRECT - Ready to merge
│  └─ NO: ✗ Check syntax
│
└─ Before merging: Test round-trip
   ├─ [ ] Publish changes
   ├─ [ ] Query published config
   ├─ [ ] Verify publishedAt exists
   ├─ [ ] Check UI renders content (not placeholders)
   └─ [ ] Merge ✓
```

## Impact by Component

```
SERVICE LAYER (landing-page.service.ts)
├─ publishBuildModeDraft()
├─ Status: ✓ Already using createPublishedWrapper
└─ No changes needed

AGENT EXECUTORS (storefront-executors.ts)
├─ publish_draft executor
├─ Status: ✓ Already using createPublishedWrapper
└─ No changes needed

AGENT ROUTES (internal-agent.routes.ts)  ← THIS ONE WAS BROKEN
├─ POST /v1/internal/agent/storefront/publish
├─ Status: ✓ NOW FIXED
└─ Change: Updated to use createPublishedWrapper

PUBLIC API (Not directly affected)
├─ findBySlugPublic(slug)
├─ Now works correctly with fixed wrapper
└─ Returns published content instead of null
```

## Testing Verification

```
MANUAL TEST SCENARIO
───────────────────────────────────────────────────────────────

Before Publishing:
  GET /storefront/preview → Shows draft content

Publish Changes via Agent:
  POST /storefront/publish (with draft config)

Verify Wrapper in Database:
  SELECT landingPageConfig FROM tenants WHERE id = 'test'
  Result: {
    "draft": null,
    "draftUpdatedAt": null,
    "published": { pages: {...} },
    "publishedAt": "2026-01-20T15:30:00.000Z"  ← Must be present
  }

Check Public API:
  GET /t/[slug] (public storefront)
  Result: Content renders from published wrapper ✓

Check UI Preview:
  Navigate to preview
  Result: Headlines appear (not "[Your Transformation Headline]")

All Tests Pass: ✓ Fix verified
```

## Key Metrics

| Metric                | Before              | After                                             |
| --------------------- | ------------------- | ------------------------------------------------- |
| Wrapper fields        | 1 (published)       | 4 (published, publishedAt, draft, draftUpdatedAt) |
| publishedAt timestamp | ✗ Missing           | ✓ Present (ISO 8601)                              |
| Validation success    | ✗ Fails silently    | ✓ Passes                                          |
| Content persistence   | ✗ Lost              | ✓ Saved                                           |
| User experience       | ✗ Sees placeholders | ✓ Sees published content                          |
| Agent accuracy        | ✗ False positive    | ✓ Accurate reporting                              |
