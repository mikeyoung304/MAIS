# Phase 5 Execution Plan - Optimal Subagent Strategy

## Executive Summary

This document outlines the tactical execution plan for completing Phase 5: Self-Service Foundation. It leverages Claude Code's multi-agent capabilities to maximize parallel work and maintain momentum.

**Timeline:** Weeks 1-6 (Nov 7 - Dec 19, 2024)
**Goal:** Enable tenants to fully manage service offerings independently
**Approach:** Parallel subagent execution where possible, sequential for dependencies

---

## Current Status (Nov 7, 2024, End of Day)

### Completed Today ✅

- **Phase 5.1 Backend:** Package photo upload API (35 minutes of focused work)
- **Documentation:** Comprehensive roadmap and implementation specs
- **Database:** Photos JSON column added to Package model
- **API Endpoints:** POST/DELETE for package photos operational
- **Static Serving:** /uploads/packages/ route configured
- **Commits:** 2 commits (docs + backend implementation)

### Today's Commit Details

```
feat(phase-5.1): Implement package photo upload backend

Changes:
- Added photos JSON column to Package model
- Extended UploadService for package photos
- POST /v1/tenant-admin/packages/:id/photos
- DELETE /v1/tenant-admin/packages/:id/photos/:filename
- Max 5 photos enforced, 5MB per photo
- Tenant ownership verification on all operations

Files Modified:
- server/prisma/schema.prisma
- server/src/app.ts
- server/src/routes/tenant-admin.routes.ts
- server/src/services/upload.service.ts

Stats: +243 lines, -23 lines
```

### Metrics

- **Maturity Score:** 6.5/10 (up from 6/10)
- **Phase 5 Progress:** 17% complete (1 of 6 components)
- **Development Velocity:** High (backend feature in 35 min)
- **Code Quality:** TypeScript clean, multi-tenant secure

### What's Left to Complete Phase 5

**Feature 5.1: Package Photo Upload (50% complete)**

- [x] Backend API (completed today)
- [ ] Frontend component with drag-and-drop
- [ ] Dashboard integration
- [ ] Manual testing and polish

**Feature 5.2: Add-On Management (0% complete)**

- [ ] Backend API endpoints (4 CRUD routes)
- [ ] Frontend manager component
- [ ] Form validation
- [ ] Dashboard integration
- [ ] Manual testing

**Feature 5.3: Email Template Customization (0% complete)**

- [ ] Database model and migration
- [ ] Template service layer
- [ ] Default templates (3 types)
- [ ] Rich text editor component
- [ ] Preview component
- [ ] Dashboard integration
- [ ] Manual testing

---

## Week 1: Complete Package Photo Upload (Days 1-3)

### Day 1 (Nov 8): Frontend Component Development

**Session Goal:** Build PackagePhotoUploader React component with drag-and-drop

**Parallel Subagent Execution Plan:**

Launch 3 agents simultaneously to work on independent pieces:

#### Agent 1: Package Photo Component Builder

**Type:** general-purpose
**Task:** Create PackagePhotoUploader.tsx component
**Deliverable:** Complete drag-and-drop photo uploader

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/PackagePhotoUploader.tsx

Requirements:
1. Use react-dropzone for drag-and-drop (install if needed: npm install react-dropzone)
2. Use react-beautiful-dnd for reordering (install if needed: npm install react-beautiful-dnd @types/react-beautiful-dnd)
3. Component props: packageId: string, existingPhotos: PhotoDto[]
4. Features:
   - Drag-and-drop zone (or click to upload)
   - File validation: images only (JPG, PNG, WebP), 5MB max
   - Preview grid with thumbnails
   - Delete button per photo
   - Reorder via drag-and-drop
   - Max 5 photos enforcement
   - Upload progress indicators
   - Error states (file too large, wrong type, max reached)

5. TypeScript types:
   interface PhotoDto {
     url: string;
     filename: string;
     size: number;
     order: number;
   }

6. API integration:
   - POST /v1/tenant-admin/packages/:packageId/photos (FormData with 'photo' field)
   - DELETE /v1/tenant-admin/packages/:packageId/photos/:filename
   - Use Authorization: Bearer {token} and X-Tenant-Key headers

7. Style with Tailwind CSS (already in project)
```

**Location:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/PackagePhotoUploader.tsx`

**Success Criteria:**

- [x] Component renders without errors
- [x] Drag-and-drop accepts image files
- [x] Upload triggers API call with FormData
- [x] Photos display in grid with thumbnails
- [x] Delete removes photo from UI and server
- [x] Max 5 photos enforced in UI
- [x] Reorder updates photo order

**Estimated Time:** 2 hours

---

#### Agent 2: API Client Integration

**Type:** general-purpose
**Task:** Add package photo methods to client API helper
**Deliverable:** TypeScript API client methods

**Instructions:**

```
Add to /Users/mikeyoung/CODING/Elope/client/src/lib/api.ts (or create if doesn't exist)

Add these methods:

async function uploadPackagePhoto(packageId: string, file: File, token: string, tenantKey: string): Promise<PhotoDto> {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch(`/v1/tenant-admin/packages/${packageId}/photos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Key': tenantKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

async function deletePackagePhoto(packageId: string, filename: string, token: string, tenantKey: string): Promise<void> {
  const response = await fetch(`/v1/tenant-admin/packages/${packageId}/photos/${filename}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Key': tenantKey,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Delete failed');
  }
}

Export both methods.
```

**Location:** `/Users/mikeyoung/CODING/Elope/client/src/lib/api.ts`

**Success Criteria:**

- [x] Methods compile without TypeScript errors
- [x] Proper error handling
- [x] FormData construction correct
- [x] Headers include auth token and tenant key

**Estimated Time:** 30 minutes

---

#### Agent 3: Dashboard Integration Prep

**Type:** general-purpose
**Task:** Locate and understand TenantPackagesManager component for integration
**Deliverable:** Integration plan and component location

**Instructions:**

```
1. Find TenantPackagesManager component (likely in /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/)
2. Read the component to understand:
   - How packages are listed/edited
   - Where the edit form is rendered
   - How to add a photo upload section
3. Document:
   - Current form structure
   - Where to add <PackagePhotoUploader /> component
   - What props to pass (packageId, existing photos)
   - How to fetch existing photos from package data

Output a markdown comment block at the top of the integration plan.
```

**Location:** Research task (no file creation)

**Success Criteria:**

- [x] TenantPackagesManager component located
- [x] Integration point identified
- [x] Props mapping documented

**Estimated Time:** 30 minutes

---

**Sequential Dependency Chain:**

```
Agent 1 (Component) ──┐
                      ├──> Agent 4 (Integration)
Agent 2 (API)     ────┤
                      │
Agent 3 (Research) ───┘
```

After Agents 1-3 complete, launch:

#### Agent 4: Wire Up Integration

**Type:** general-purpose
**Task:** Integrate PackagePhotoUploader into TenantPackagesManager
**Deliverable:** Working photo upload in package editor

**Instructions:**

```
Based on Agent 3's research:

1. Import PackagePhotoUploader component
2. Add photo upload section to package edit form/modal
3. Pass required props:
   - packageId (from current package being edited)
   - existingPhotos (from package.photos JSON field)
4. Ensure photos field is included when fetching package data
5. Add loading state while photos upload
6. Show success message after upload
7. Refresh package data after photo operations

Test:
1. Edit a package
2. Upload a photo
3. Verify it appears immediately
4. Delete a photo
5. Verify it's removed
```

**Success Criteria:**

- [x] Photo uploader appears in edit package UI
- [x] Upload works end-to-end
- [x] Delete works end-to-end
- [x] UI updates immediately

**Estimated Time:** 1 hour

---

**Total Day 1 Time:** 4 hours (2 hours if agents run in parallel)

**Manual Testing Checklist (End of Day 1):**

```bash
# Start both servers
cd /Users/mikeyoung/CODING/Elope/server && npm run dev
cd /Users/mikeyoung/CODING/Elope/client && npm run dev

# Navigate to tenant dashboard
# http://localhost:3000/tenant/dashboard

# Test flow:
1. Click Packages tab
2. Click Edit on an existing package
3. Find photo upload section
4. Drag and drop an image (JPG, PNG, or WebP)
5. Verify photo appears in grid
6. Upload 4 more photos (total 5)
7. Try to upload 6th photo - should show "max 5" error
8. Delete one photo - should remove from grid
9. Try uploading oversized file (>5MB) - should show error
10. Try uploading non-image file - should show error
11. Reorder photos via drag-and-drop - should update order
12. Save package - photos should persist after refresh
```

**Blockers & Solutions:**

- **Blocker:** React dependencies not installed
  **Solution:** `npm install react-dropzone react-beautiful-dnd @types/react-beautiful-dnd`

- **Blocker:** CORS errors in development
  **Solution:** Check server CORS config allows localhost:3000

- **Blocker:** 413 Payload Too Large errors
  **Solution:** Already handled - backend configured for 5MB package photos

---

### Day 2 (Nov 9): Polish & Testing

**Session Goal:** Polish UI, test edge cases, commit working feature

**Single Agent Execution:**

#### Agent: QA & Polish Specialist

**Type:** general-purpose
**Task:** Polish UI, add loading states, test edge cases
**Deliverable:** Production-ready photo upload feature

**Instructions:**

```
Polish tasks:

1. Loading States:
   - Add spinner during upload
   - Show progress bar (if possible with fetch API)
   - Disable upload button while uploading
   - Show "Uploading..." text

2. Error Handling:
   - Improve error messages:
     * "File too large (max 5MB)" instead of generic error
     * "Invalid file type. Please upload JPG, PNG, or WebP"
     * "Maximum 5 photos allowed"
   - Display errors in red, dismissible alert
   - Clear error after 5 seconds

3. Styling:
   - Make photo grid responsive (2 cols mobile, 3 cols tablet, 4-5 cols desktop)
   - Add hover effects on photos (show delete button only on hover)
   - Style drag-and-drop zone with dashed border, hover state
   - Add photo thumbnail shadows for depth
   - Show photo order numbers (1, 2, 3, 4, 5)

4. UX Improvements:
   - Add "Delete" confirmation modal ("Are you sure?")
   - Show file size under each thumbnail (e.g., "1.2 MB")
   - Add "Upload Photo" button text if drag zone is missed
   - Show success toast after upload ("Photo uploaded successfully!")

5. Accessibility:
   - Add aria-labels to buttons
   - Keyboard navigation for reorder
   - Alt text for photo previews
```

**Estimated Time:** 2-3 hours

**Manual Testing Checklist:**

- [ ] Upload valid image (JPG, PNG, WebP) - success
- [ ] Upload oversized image (>5MB) - error shown
- [ ] Upload non-image file (PDF, TXT) - error shown
- [ ] Delete photo - confirmation modal appears
- [ ] Confirm delete - photo removed
- [ ] Reorder photos via drag - order persists on save
- [ ] Upload to different packages - isolated correctly (Tenant A photos don't show in Tenant B)
- [ ] Mobile responsive - works on phone screen (test Chrome DevTools mobile view)
- [ ] Refresh page after upload - photos still there

**Edge Cases to Test:**

- [ ] Rapid consecutive uploads (5 photos quickly) - all succeed
- [ ] Network error during upload - error shown, retry works
- [ ] Delete photo that doesn't exist - graceful error
- [ ] Logout and login - photos still visible
- [ ] Multiple browser tabs - changes sync after refresh

---

**Deliverable: Commit Package Photo Frontend**

After testing complete, commit:

```bash
cd /Users/mikeyoung/CODING/Elope

# Check changes
git status
git diff

# Add all new files
git add client/src/features/tenant-admin/PackagePhotoUploader.tsx
git add client/src/lib/api.ts
git add client/src/features/tenant-admin/TenantPackagesManager.tsx # if modified

# Commit with detailed message
git commit -m "feat(phase-5.1): Complete package photo upload frontend

Built PackagePhotoUploader component with drag-and-drop:
- Integrated react-dropzone for file upload
- Integrated react-beautiful-dnd for photo reordering
- Max 5 photos per package enforced
- File validation: images only, 5MB max
- Responsive grid layout with hover states
- Loading indicators and error handling
- Delete confirmation modal
- Wired into TenantPackagesManager edit form

API Integration:
- uploadPackagePhoto() method in api.ts
- deletePackagePhoto() method in api.ts
- Uses FormData for multipart upload
- Auth token and tenant key headers

Testing:
- Manual testing complete across 15 scenarios
- Edge cases verified (rapid upload, network errors, multi-tenant isolation)
- Mobile responsive verified
- Accessibility improvements (aria-labels, keyboard nav)

Phase 5.1: COMPLETE ✅

Next: Phase 5.2 - Add-On Management System

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote (optional)
# git push origin main
```

---

### Day 3: Buffer Day

**Purpose:** Catch up if Days 1-2 took longer, or get ahead on Add-On Management

**If ahead of schedule:**

- Start researching Add-On Management requirements
- Read existing AddOn model in schema.prisma
- Check if CatalogService already has add-on methods
- Draft component wireframes for TenantAddOnsManager

**If behind schedule:**

- Finish photo upload feature
- Fix any bugs found in testing
- Improve documentation

**If on schedule:**

- Update PHASE_5_IMPLEMENTATION_SPEC.md with completion notes
- Update MULTI_TENANT_ROADMAP.md progress tracker
- Write user-facing documentation for photo upload feature
- Record a quick demo video (Loom or QuickTime)

---

## Week 2: Add-On Management System (Days 4-8)

### Day 4 (Nov 10): Add-On Backend Development

**Session Goal:** Build complete CRUD API for add-on management

**Parallel Subagent Execution Plan:**

Launch 3 agents simultaneously:

#### Agent 1: Add-On Database Review

**Type:** general-purpose
**Task:** Review AddOn model and plan any schema changes
**Deliverable:** Migration plan (if needed)

**Instructions:**

```
1. Read /Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma
2. Find AddOn model (should already exist)
3. Verify fields needed:
   - id, tenantId, slug, name, description, price
   - photoUrl (string, optional)
   - isActive (boolean, default true)
   - displayOrder (int, default 0)
4. If missing fields, create migration:
   - Add photoUrl if missing
   - Add displayOrder if missing
   - Ensure tenantId foreign key exists
5. Run: npx prisma db push (to sync schema)
6. Document any changes made
```

**Estimated Time:** 30 minutes

---

#### Agent 2: Add-On Validation Schemas

**Type:** general-purpose
**Task:** Create Zod validation schemas for add-on CRUD
**Deliverable:** Validation exports in tenant-admin.schemas.ts

**Instructions:**

```
Add to /Users/mikeyoung/CODING/Elope/server/src/validation/tenant-admin.schemas.ts

Create these Zod schemas:

import { z } from 'zod';

// Create add-on schema
export const createAddOnSchema = z.object({
  slug: z.string()
    .min(1, 'Slug is required')
    .max(50, 'Slug must be 50 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  price: z.number()
    .int('Price must be an integer (cents)')
    .min(0, 'Price cannot be negative'),
  photoUrl: z.string()
    .url('Invalid URL format')
    .optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number()
    .int('Display order must be an integer')
    .min(0, 'Display order cannot be negative')
    .default(0),
});

// Update add-on schema (all fields optional except what's being updated)
export const updateAddOnSchema = z.object({
  slug: z.string()
    .min(1).max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  price: z.number().int().min(0).optional(),
  photoUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

Export both schemas.
```

**Location:** `/Users/mikeyoung/CODING/Elope/server/src/validation/tenant-admin.schemas.ts`

**Success Criteria:**

- [x] Schemas compile without TypeScript errors
- [x] Validation rules enforce constraints
- [x] Error messages are clear

**Estimated Time:** 30 minutes

---

#### Agent 3: Add-On Service Layer Methods

**Type:** general-purpose
**Task:** Check if CatalogService has add-on methods, extend if needed
**Deliverable:** Service methods for add-on CRUD

**Instructions:**

```
1. Read /Users/mikeyoung/CODING/Elope/server/src/services/catalog.service.ts
2. Check if these methods exist:
   - getAddOnsByTenant(tenantId: string, filters?: { isActive?: boolean })
   - getAddOnById(tenantId: string, addOnId: string)
   - createAddOn(tenantId: string, data: CreateAddOnDto)
   - updateAddOn(tenantId: string, addOnId: string, data: UpdateAddOnDto)
   - deleteAddOn(tenantId: string, addOnId: string)

3. If methods don't exist, add them to CatalogService:

async getAddOnsByTenant(tenantId: string, filters?: { isActive?: boolean }): Promise<AddOn[]> {
  const where: any = { tenantId };
  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }
  return this.prisma.addOn.findMany({
    where,
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' }
    ],
  });
}

async getAddOnById(tenantId: string, addOnId: string): Promise<AddOn | null> {
  return this.prisma.addOn.findFirst({
    where: { id: addOnId, tenantId },
  });
}

async createAddOn(tenantId: string, data: CreateAddOnDto): Promise<AddOn> {
  // Check slug uniqueness within tenant
  const existing = await this.prisma.addOn.findFirst({
    where: { tenantId, slug: data.slug },
  });
  if (existing) {
    throw new Error(`Add-on with slug "${data.slug}" already exists for this tenant`);
  }

  return this.prisma.addOn.create({
    data: {
      ...data,
      tenantId,
    },
  });
}

async updateAddOn(tenantId: string, addOnId: string, data: UpdateAddOnDto): Promise<AddOn> {
  // Verify ownership
  const addOn = await this.getAddOnById(tenantId, addOnId);
  if (!addOn) {
    throw new Error('Add-on not found or access denied');
  }

  // Check slug uniqueness if updating slug
  if (data.slug && data.slug !== addOn.slug) {
    const existing = await this.prisma.addOn.findFirst({
      where: { tenantId, slug: data.slug },
    });
    if (existing) {
      throw new Error(`Add-on with slug "${data.slug}" already exists for this tenant`);
    }
  }

  return this.prisma.addOn.update({
    where: { id: addOnId },
    data,
  });
}

async deleteAddOn(tenantId: string, addOnId: string): Promise<void> {
  // Verify ownership
  const addOn = await this.getAddOnById(tenantId, addOnId);
  if (!addOn) {
    throw new Error('Add-on not found or access denied');
  }

  // Soft delete: set isActive to false
  await this.prisma.addOn.update({
    where: { id: addOnId },
    data: { isActive: false },
  });
}

4. Define TypeScript types:
   interface CreateAddOnDto {
     slug: string;
     name: string;
     description?: string;
     price: number;
     photoUrl?: string;
     isActive?: boolean;
     displayOrder?: number;
   }

   interface UpdateAddOnDto {
     slug?: string;
     name?: string;
     description?: string | null;
     price?: number;
     photoUrl?: string | null;
     isActive?: boolean;
     displayOrder?: number;
   }
```

**Location:** `/Users/mikeyoung/CODING/Elope/server/src/services/catalog.service.ts`

**Success Criteria:**

- [x] All CRUD methods implemented
- [x] Tenant scoping enforced (WHERE tenantId)
- [x] Ownership verification on update/delete
- [x] Slug uniqueness checked within tenant
- [x] TypeScript compiles cleanly

**Estimated Time:** 1.5 hours

---

**Sequential Agent (after parallel agents complete):**

#### Agent 4: Add-On API Routes

**Type:** general-purpose
**Task:** Add 4 CRUD endpoints to tenant-admin routes
**Deliverable:** Working API endpoints

**Instructions:**

```
Add to /Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts

Add after the blackouts section (around line 440):

// ============================================================
// ADD-ON MANAGEMENT ENDPOINTS
// ============================================================

/**
 * GET /v1/tenant-admin/add-ons
 * List all add-ons for authenticated tenant
 */
router.get('/add-ons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const isActive = req.query.isActive === 'true' ? true :
                     req.query.isActive === 'false' ? false :
                     undefined;

    const addOns = await catalogService.getAddOnsByTenant(tenantAuth.tenantId, { isActive });

    res.json({
      addOns: addOns.map(a => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        price: a.price,
        photoUrl: a.photoUrl,
        isActive: a.isActive,
        displayOrder: a.displayOrder,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/tenant-admin/add-ons
 * Create new add-on
 */
router.post('/add-ons', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate request body
    const validatedData = createAddOnSchema.parse(req.body);

    const addOn = await catalogService.createAddOn(tenantAuth.tenantId, validatedData);

    res.status(201).json({
      id: addOn.id,
      slug: addOn.slug,
      name: addOn.name,
      description: addOn.description,
      price: addOn.price,
      photoUrl: addOn.photoUrl,
      isActive: addOn.isActive,
      displayOrder: addOn.displayOrder,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    next(error);
  }
});

/**
 * PUT /v1/tenant-admin/add-ons/:id
 * Update add-on
 */
router.put('/add-ons/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const addOnId = req.params.id;

    // Validate request body
    const validatedData = updateAddOnSchema.parse(req.body);

    const addOn = await catalogService.updateAddOn(tenantAuth.tenantId, addOnId, validatedData);

    res.json({
      id: addOn.id,
      slug: addOn.slug,
      name: addOn.name,
      description: addOn.description,
      price: addOn.price,
      photoUrl: addOn.photoUrl,
      isActive: addOn.isActive,
      displayOrder: addOn.displayOrder,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    next(error);
  }
});

/**
 * DELETE /v1/tenant-admin/add-ons/:id
 * Delete (soft delete) add-on
 */
router.delete('/add-ons/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const addOnId = req.params.id;

    await catalogService.deleteAddOn(tenantAuth.tenantId, addOnId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

Import at top of file:
import { createAddOnSchema, updateAddOnSchema } from '../validation/tenant-admin.schemas.js';
```

**Success Criteria:**

- [x] 4 endpoints compile without errors
- [x] Validation schemas applied
- [x] Tenant auth checked on all routes
- [x] Proper HTTP status codes (200, 201, 204, 400, 401)

**Estimated Time:** 1 hour

---

**Testing (End of Day 4):**

```bash
# Get tenant JWT token first
export TENANT_TOKEN="your_jwt_token_here"
export TENANT_KEY="pk_live_bellaweddings_xxx"

# Test 1: Create add-on
curl -X POST http://localhost:3001/v1/tenant-admin/add-ons \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "photo-album",
    "name": "Professional Photo Album",
    "description": "50-page leather-bound album",
    "price": 25000
  }'

# Expected: 201 Created, returns add-on with ID

# Test 2: List add-ons
curl http://localhost:3001/v1/tenant-admin/add-ons \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY"

# Expected: 200 OK, returns array with new add-on

# Test 3: Update add-on
curl -X PUT http://localhost:3001/v1/tenant-admin/add-ons/{id} \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 30000,
    "description": "Premium 75-page leather-bound album"
  }'

# Expected: 200 OK, returns updated add-on

# Test 4: Delete add-on
curl -X DELETE http://localhost:3001/v1/tenant-admin/add-ons/{id} \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY"

# Expected: 204 No Content

# Test 5: Verify soft delete (should have isActive = false)
curl http://localhost:3001/v1/tenant-admin/add-ons?isActive=false \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY"

# Expected: Deleted add-on in list with isActive: false

# Test 6: Multi-tenant isolation
# Use different tenant token/key, try to access first tenant's add-on
# Expected: 404 or error "not found"
```

**Day 4 Total Time:** 3.5 hours

---

### Day 5 (Nov 11): Add-On Frontend Components

**Session Goal:** Build TenantAddOnsManager UI with full CRUD

**Parallel Subagent Execution Plan:**

Launch 2 agents simultaneously:

#### Agent 1: Add-On Manager Component

**Type:** general-purpose
**Task:** Create TenantAddOnsManager.tsx main UI
**Deliverable:** Full CRUD interface

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/TenantAddOnsManager.tsx

Requirements:

1. Layout:
   - Header: "Add-Ons" + "Create Add-On" button
   - Grid of add-on cards (3 cols desktop, 2 cols tablet, 1 col mobile)
   - Each card shows: photo (if exists), name, description, price, active status
   - Each card has Edit and Delete buttons

2. State management:
   - Fetch add-ons on mount: GET /v1/tenant-admin/add-ons
   - Track loading, error, success states
   - Store add-ons in useState

3. Create/Edit Modal:
   - Use AddOnForm component (Agent 2 will create)
   - Modal opens when "Create" or "Edit" clicked
   - Pass add-on data to form for editing
   - On submit, refresh add-on list

4. Delete confirmation:
   - Show confirmation modal: "Delete {name}? This cannot be undone."
   - On confirm, DELETE /v1/tenant-admin/add-ons/:id
   - Remove from UI on success

5. Active/Inactive toggle:
   - Toggle switch on each card
   - PUT /v1/tenant-admin/add-ons/:id with { isActive: true/false }
   - Visual indicator (grayed out if inactive)

6. Empty state:
   - Show "No add-ons yet. Create your first add-on to get started." if empty

7. Styling:
   - Use Tailwind CSS
   - Match design of TenantPackagesManager (consistent UI)
   - Responsive grid
   - Hover effects on cards

API client methods (add to api.ts):
- fetchAddOns(token, tenantKey)
- createAddOn(data, token, tenantKey)
- updateAddOn(id, data, token, tenantKey)
- deleteAddOn(id, token, tenantKey)
```

**Location:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/TenantAddOnsManager.tsx`

**Success Criteria:**

- [x] Component renders add-on grid
- [x] Create button opens modal
- [x] Edit button opens modal with data
- [x] Delete shows confirmation
- [x] Active toggle works
- [x] Empty state displays when no add-ons

**Estimated Time:** 2.5 hours

---

#### Agent 2: Add-On Form Component

**Type:** general-purpose
**Task:** Create AddOnForm.tsx reusable form
**Deliverable:** Form for create/edit operations

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/AddOnForm.tsx

Requirements:

1. Props:
   interface AddOnFormProps {
     addOn?: AddOnDto; // If editing, pass existing add-on
     onSubmit: (data: AddOnFormData) => Promise<void>;
     onCancel: () => void;
   }

2. Form fields:
   - Slug (text input, lowercase with validation pattern)
   - Name (text input, required)
   - Description (textarea, optional)
   - Price (number input, in dollars, convert to cents on submit)
   - Photo URL (text input, optional) - temporary until photo upload integrated
   - Is Active (checkbox, default true)
   - Display Order (number input, default 0)

3. Validation:
   - Use React Hook Form or native form validation
   - Slug: required, lowercase alphanumeric + hyphens only
   - Name: required, max 100 chars
   - Description: max 500 chars
   - Price: required, positive number
   - Photo URL: valid URL format or empty

4. UX:
   - Pre-fill fields if editing
   - Show validation errors inline
   - Disable submit button while submitting
   - Show success message on submit
   - Clear form after create (not after edit)

5. Styling:
   - Match existing form styles in dashboard
   - Use Tailwind CSS
   - Two-column layout on desktop, single column on mobile
   - Primary button for submit, secondary for cancel

6. Submit handler:
   - Convert price from dollars to cents (multiply by 100)
   - Call onSubmit prop with form data
   - Handle errors (display in form)
```

**Location:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/AddOnForm.tsx`

**Success Criteria:**

- [x] Form validates all fields
- [x] Pre-fills data when editing
- [x] Converts price dollars ↔ cents correctly
- [x] Calls onSubmit with clean data
- [x] Handles errors gracefully

**Estimated Time:** 2 hours

---

**Sequential Agent (after Agents 1-2 complete):**

#### Agent 3: Dashboard Integration

**Type:** general-purpose
**Task:** Add Add-Ons tab to TenantDashboard
**Deliverable:** Integrated add-on manager in dashboard

**Instructions:**

```
Find /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/TenantDashboard.tsx

Assuming it has tabs like: Packages, Bookings, Blackouts, Branding

Add 5th tab: "Add-Ons"

1. Import TenantAddOnsManager
2. Add tab button: "Add-Ons"
3. Add tab panel that renders <TenantAddOnsManager />
4. Ensure proper routing (if using react-router)
5. Match existing tab styling

Example tab structure:
<Tabs>
  <TabList>
    <Tab>Packages</Tab>
    <Tab>Bookings</Tab>
    <Tab>Blackouts</Tab>
    <Tab>Branding</Tab>
    <Tab>Add-Ons</Tab> {/* NEW */}
  </TabList>

  <TabPanel>{/* Packages content */}</TabPanel>
  <TabPanel>{/* Bookings content */}</TabPanel>
  <TabPanel>{/* Blackouts content */}</TabPanel>
  <TabPanel>{/* Branding content */}</TabPanel>
  <TabPanel>
    <TenantAddOnsManager /> {/* NEW */}
  </TabPanel>
</Tabs>
```

**Success Criteria:**

- [x] Add-Ons tab appears in dashboard
- [x] Clicking tab shows TenantAddOnsManager
- [x] Tab styling matches other tabs
- [x] Navigation works smoothly

**Estimated Time:** 30 minutes

---

**Manual Testing (End of Day 5):**

```
1. Navigate to tenant dashboard
2. Click "Add-Ons" tab
3. Verify empty state shows if no add-ons
4. Click "Create Add-On"
5. Fill form:
   - Slug: photo-album
   - Name: Professional Photo Album
   - Description: 50-page leather-bound album
   - Price: $250.00
   - Photo URL: https://example.com/album.jpg
   - Is Active: checked
6. Click Submit
7. Verify add-on appears in grid
8. Click Edit on the add-on
9. Change price to $300.00
10. Submit
11. Verify price updated
12. Toggle "Active" switch off
13. Verify add-on grayed out
14. Click Delete
15. Confirm deletion
16. Verify add-on removed from grid
17. Refresh page - verify changes persisted
```

**Day 5 Total Time:** 5 hours

---

### Day 6-7 (Nov 12-13): Add-On Advanced Features

**Session Goal:** Add package association and bulk operations

**Features to implement:**

#### Feature 1: Associate Add-Ons with Packages

**Why:** Add-ons should be tied to specific packages (e.g., "Photo Album" add-on only available with "Full Day Wedding" package)

**Backend:**

- Already exists: PackageAddOn junction table
- Endpoint: PUT /v1/tenant-admin/packages/:id/add-ons
- Body: { addOnIds: ['addon1', 'addon2'] }

**Frontend:**

- Add multi-select in package form
- Show associated add-ons in package card
- Allow editing associations

**Estimated Time:** 3 hours

---

#### Feature 2: Bulk Operations

**Why:** Enable/disable multiple add-ons at once (e.g., seasonal add-ons)

**Backend:**

- Endpoint: PUT /v1/tenant-admin/add-ons/bulk
- Body: { addOnIds: ['id1', 'id2'], isActive: false }

**Frontend:**

- Checkboxes on add-on cards
- "Bulk Actions" dropdown (Enable Selected, Disable Selected)
- Select All / Deselect All

**Estimated Time:** 2 hours

---

#### Feature 3: Add-On Display in Booking Widget

**Why:** Customers need to see add-ons when booking

**Frontend (Widget):**

- Fetch add-ons for selected package
- Display as checkboxes in booking flow
- Add to cart with price calculation
- Pass selected add-ons to booking API

**Estimated Time:** 2 hours

---

**Day 6-7 Total Time:** 7 hours

**Commit after Day 7:**

```bash
git add -A
git commit -m "feat(phase-5.2): Complete add-on management system

Backend:
- Added 4 CRUD endpoints for add-ons
- Validation schemas with Zod
- Service layer methods with tenant scoping
- Slug uniqueness enforcement within tenant
- Soft delete (isActive flag)

Frontend:
- TenantAddOnsManager component with grid layout
- AddOnForm component with validation
- Create/edit/delete operations
- Active/inactive toggle
- Dashboard integration (5th tab)

Advanced Features:
- Package-add-on associations
- Bulk enable/disable operations
- Add-on display in booking widget

Testing:
- 20+ manual test scenarios passed
- Multi-tenant isolation verified
- Edge cases handled (slug conflicts, etc.)

Phase 5.2: COMPLETE ✅

Next: Phase 5.3 - Email Template Customization

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Day 8: Buffer Day

**Purpose:** Catch up, polish, documentation

**Tasks if ahead:**

- Write add-on management user guide
- Record demo video
- Update API documentation
- Start researching email template requirements

**Tasks if behind:**

- Finish add-on features
- Fix bugs
- Complete manual testing

---

## Week 3-4: Email Template Customization (Days 9-15)

### Day 9-10 (Nov 14-15): Email Backend Infrastructure

**Session Goal:** Build email template database model, service, and default templates

**Parallel Subagent Execution Plan:**

Launch 4 agents simultaneously:

#### Agent 1: Email Template Database Model

**Type:** general-purpose
**Task:** Create EmailTemplate Prisma model and migration
**Deliverable:** Database schema and migration

**Instructions:**

```
Add to /Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma

model EmailTemplate {
  id          String   @id @default(cuid())
  tenantId    String
  type        String   // 'booking_confirmation', 'reminder', 'cancellation'
  subject     String
  bodyHtml    String   @db.Text
  bodyText    String?  @db.Text  // Plain text fallback
  variables   Json     // Available template variables
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, type])
  @@index([tenantId])
}

Add relation to Tenant model:
model Tenant {
  // ... existing fields
  emailTemplates EmailTemplate[]
}

Run migration:
npx prisma db push
```

**Success Criteria:**

- [x] Model created in schema
- [x] Migration successful
- [x] Unique constraint on tenantId + type

**Estimated Time:** 30 minutes

---

#### Agent 2: Email Template Service

**Type:** general-purpose
**Task:** Create EmailTemplateService with CRUD methods
**Deliverable:** Service layer for template management

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/server/src/services/email-template.service.ts

export class EmailTemplateService {
  constructor(private prisma: PrismaClient) {}

  // Get template by type (returns tenant custom or default)
  async getTemplate(tenantId: string, type: TemplateType): Promise<EmailTemplate | null> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: {
        tenantId_type: { tenantId, type },
      },
    });

    // If no custom template, return default (from constants)
    if (!template) {
      return this.getDefaultTemplate(type);
    }

    return template;
  }

  // List all templates for tenant
  async listTemplates(tenantId: string): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({
      where: { tenantId },
      orderBy: { type: 'asc' },
    });
  }

  // Upsert template (create or update)
  async upsertTemplate(
    tenantId: string,
    type: TemplateType,
    data: UpsertTemplateDto
  ): Promise<EmailTemplate> {
    return this.prisma.emailTemplate.upsert({
      where: {
        tenantId_type: { tenantId, type },
      },
      create: {
        tenantId,
        type,
        ...data,
      },
      update: data,
    });
  }

  // Delete template (revert to default)
  async deleteTemplate(tenantId: string, type: TemplateType): Promise<void> {
    await this.prisma.emailTemplate.delete({
      where: {
        tenantId_type: { tenantId, type },
      },
    });
  }

  // Render template with variables
  async renderTemplate(
    tenantId: string,
    type: TemplateType,
    variables: Record<string, any>
  ): Promise<{ subject: string; bodyHtml: string; bodyText: string }> {
    const template = await this.getTemplate(tenantId, type);
    if (!template) {
      throw new Error(`Template not found: ${type}`);
    }

    // Simple variable replacement (use mustache or handlebars for production)
    let subject = template.subject;
    let bodyHtml = template.bodyHtml;
    let bodyText = template.bodyText || '';

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      bodyHtml = bodyHtml.replace(new RegExp(placeholder, 'g'), String(value));
      bodyText = bodyText.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return { subject, bodyHtml, bodyText };
  }

  // Get default template (fallback)
  private getDefaultTemplate(type: TemplateType): DefaultTemplate {
    // Return from DEFAULT_TEMPLATES constant
    return DEFAULT_TEMPLATES[type];
  }
}

Types:
type TemplateType = 'booking_confirmation' | 'reminder' | 'cancellation';

interface UpsertTemplateDto {
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables?: Record<string, string>;
}
```

**Location:** `/Users/mikeyoung/CODING/Elope/server/src/services/email-template.service.ts`

**Success Criteria:**

- [x] All CRUD methods implemented
- [x] Template rendering works
- [x] Default fallback implemented
- [x] TypeScript compiles

**Estimated Time:** 2 hours

---

#### Agent 3: Default Email Templates

**Type:** general-purpose
**Task:** Create 3 default HTML email templates
**Deliverable:** Template constants file

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/server/src/constants/email-templates.ts

Use MJML or simple HTML for email compatibility.

Template types:
1. booking_confirmation
2. reminder (2 days before event)
3. cancellation

Variables available:
- {{customerName}} - Couple name
- {{packageName}} - Selected package
- {{eventDate}} - Wedding date (formatted)
- {{totalPrice}} - Total cost (formatted)
- {{addOns}} - List of add-ons (HTML list)
- {{tenantLogo}} - Tenant logo URL
- {{tenantPrimaryColor}} - Tenant primary color (hex)
- {{tenantName}} - Tenant business name

Example booking_confirmation template:

export const DEFAULT_TEMPLATES = {
  booking_confirmation: {
    type: 'booking_confirmation',
    subject: 'Your {{packageName}} is Confirmed! 🎉',
    bodyHtml: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px; background: {{tenantPrimaryColor}}; }
          .logo { max-width: 200px; }
          .content { padding: 20px; }
          .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="{{tenantLogo}}" alt="Logo" class="logo">
          </div>
          <div class="content">
            <h1>Booking Confirmed!</h1>
            <p>Hi {{customerName}},</p>
            <p>Great news! Your <strong>{{packageName}}</strong> is confirmed for <strong>{{eventDate}}</strong>.</p>

            <h2>Booking Details</h2>
            <ul>
              <li><strong>Package:</strong> {{packageName}}</li>
              <li><strong>Date:</strong> {{eventDate}}</li>
              <li><strong>Total:</strong> {{totalPrice}}</li>
            </ul>

            {{#if addOns}}
            <h3>Add-Ons</h3>
            {{addOns}}
            {{/if}}

            <p>We're excited to be part of your special day!</p>
            <p>If you have any questions, feel free to reply to this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 {{tenantName}}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    bodyText: `
Hi {{customerName}},

Great news! Your {{packageName}} is confirmed for {{eventDate}}.

BOOKING DETAILS
- Package: {{packageName}}
- Date: {{eventDate}}
- Total: {{totalPrice}}

We're excited to be part of your special day!

If you have any questions, feel free to reply to this email.

---
{{tenantName}}
    `,
    variables: {
      customerName: 'Customer name',
      packageName: 'Package name',
      eventDate: 'Event date',
      totalPrice: 'Total price',
      addOns: 'Add-ons list (HTML)',
      tenantLogo: 'Your logo URL',
      tenantPrimaryColor: 'Your primary color',
      tenantName: 'Your business name',
    },
  },

  reminder: {
    type: 'reminder',
    subject: 'Reminder: {{packageName}} in 2 Days',
    bodyHtml: `...`, // Similar structure
    bodyText: `...`,
    variables: { /* same */ },
  },

  cancellation: {
    type: 'cancellation',
    subject: 'Booking Cancellation Confirmation',
    bodyHtml: `...`,
    bodyText: `...`,
    variables: { /* same */ },
  },
};
```

**Location:** `/Users/mikeyoung/CODING/Elope/server/src/constants/email-templates.ts`

**Success Criteria:**

- [x] 3 templates created
- [x] HTML is email-client compatible
- [x] Plain text fallback provided
- [x] Variables documented

**Estimated Time:** 2 hours

---

#### Agent 4: Email Template API Endpoints

**Type:** general-purpose
**Task:** Add template endpoints to tenant-admin routes
**Deliverable:** 4 API endpoints

**Instructions:**

```
Add to /Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts

// ============================================================
// EMAIL TEMPLATE ENDPOINTS
// ============================================================

/**
 * GET /v1/tenant-admin/email-templates
 * List all templates (custom or defaults)
 */
router.get('/email-templates', async (req, res, next) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const templates = await emailTemplateService.listTemplates(tenantAuth.tenantId);

    // Include defaults for types not customized
    const allTypes = ['booking_confirmation', 'reminder', 'cancellation'];
    const existingTypes = templates.map(t => t.type);
    const missingTypes = allTypes.filter(t => !existingTypes.includes(t));

    const defaults = missingTypes.map(type => ({
      type,
      isDefault: true,
      ...DEFAULT_TEMPLATES[type],
    }));

    res.json({
      templates: [...templates, ...defaults],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/tenant-admin/email-templates/:type
 * Get specific template
 */
router.get('/email-templates/:type', async (req, res, next) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const template = await emailTemplateService.getTemplate(
      tenantAuth.tenantId,
      req.params.type as TemplateType
    );

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /v1/tenant-admin/email-templates/:type
 * Update template
 */
router.put('/email-templates/:type', async (req, res, next) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = upsertEmailTemplateSchema.parse(req.body);

    const template = await emailTemplateService.upsertTemplate(
      tenantAuth.tenantId,
      req.params.type as TemplateType,
      validatedData
    );

    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    next(error);
  }
});

/**
 * DELETE /v1/tenant-admin/email-templates/:type
 * Delete custom template (revert to default)
 */
router.delete('/email-templates/:type', async (req, res, next) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await emailTemplateService.deleteTemplate(
      tenantAuth.tenantId,
      req.params.type as TemplateType
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/tenant-admin/email-templates/:type/preview
 * Preview template with sample data
 */
router.post('/email-templates/:type/preview', async (req, res, next) => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sampleData = req.body; // Customer provides sample variables

    const rendered = await emailTemplateService.renderTemplate(
      tenantAuth.tenantId,
      req.params.type as TemplateType,
      sampleData
    );

    res.json(rendered);
  } catch (error) {
    next(error);
  }
});

Validation schema (add to tenant-admin.schemas.ts):
export const upsertEmailTemplateSchema = z.object({
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
});
```

**Success Criteria:**

- [x] 5 endpoints added (list, get, put, delete, preview)
- [x] Validation schema applied
- [x] Default templates returned if not customized
- [x] Preview endpoint works with sample data

**Estimated Time:** 1.5 hours

---

**Day 9-10 Total Time:** 6 hours

**Testing (End of Day 10):**

```bash
# Get tenant token
export TENANT_TOKEN="your_jwt_token"
export TENANT_KEY="pk_live_xxx"

# Test 1: List templates (should show defaults)
curl http://localhost:3001/v1/tenant-admin/email-templates \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY"

# Expected: 3 templates (all defaults with isDefault: true)

# Test 2: Update booking confirmation template
curl -X PUT http://localhost:3001/v1/tenant-admin/email-templates/booking_confirmation \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Your {{packageName}} is Confirmed!",
    "bodyHtml": "<h1>Hi {{customerName}},</h1><p>Your wedding on {{eventDate}} is confirmed!</p>"
  }'

# Expected: 200 OK, returns updated template

# Test 3: Preview template with sample data
curl -X POST http://localhost:3001/v1/tenant-admin/email-templates/booking_confirmation/preview \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John & Jane",
    "packageName": "Romantic Elopement",
    "eventDate": "June 15, 2026",
    "totalPrice": "$1,500"
  }'

# Expected: Rendered HTML with variables replaced

# Test 4: Delete custom template (revert to default)
curl -X DELETE http://localhost:3001/v1/tenant-admin/email-templates/booking_confirmation \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "X-Tenant-Key: $TENANT_KEY"

# Expected: 204 No Content
```

---

### Day 11-13 (Nov 16-18): Email Template Frontend

**Session Goal:** Build template editor and preview components

**Parallel Subagent Execution Plan:**

Launch 3 agents simultaneously:

#### Agent 1: Email Template Editor Component

**Type:** general-purpose
**Task:** Create EmailTemplateEditor.tsx with rich text editor
**Deliverable:** Template editing UI

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/EmailTemplateEditor.tsx

Requirements:

1. Install dependencies:
   npm install react-quill
   npm install @types/react-quill --save-dev

2. Component structure:
   - Dropdown to select template type (confirmation, reminder, cancellation)
   - Subject line input
   - Rich text editor for HTML body (React Quill)
   - Plain text editor (textarea) for fallback
   - Variable insertion buttons (click to insert {{variable}})
   - Save button, Reset to Default button
   - Preview button (opens preview modal)

3. Variable insertion:
   - Show available variables as chips
   - Click to insert at cursor position
   - Variables: {{customerName}}, {{packageName}}, {{eventDate}}, {{totalPrice}}, {{addOns}}, {{tenantLogo}}, {{tenantPrimaryColor}}, {{tenantName}}

4. State management:
   - Fetch template on mount: GET /v1/tenant-admin/email-templates/:type
   - Track subject, bodyHtml, bodyText
   - Track isDefault flag (show "Using default" badge if true)

5. Save handler:
   - PUT /v1/tenant-admin/email-templates/:type
   - Show success message
   - Update isDefault to false after save

6. Reset handler:
   - DELETE /v1/tenant-admin/email-templates/:type
   - Reload default template
   - Show confirmation: "Reset to default?"

7. Styling:
   - Use Tailwind CSS
   - Rich text editor full width
   - Variable chips colorful and clickable
   - Preview button prominent
```

**Location:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/EmailTemplateEditor.tsx`

**Success Criteria:**

- [x] Template loads from API
- [x] Rich text editor works
- [x] Variable insertion works
- [x] Save updates template
- [x] Reset reverts to default
- [x] Preview opens modal

**Estimated Time:** 3 hours

---

#### Agent 2: Email Preview Component

**Type:** general-purpose
**Task:** Create EmailTemplatePreview.tsx
**Deliverable:** Live preview with sample data

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/EmailTemplatePreview.tsx

Requirements:

1. Props:
   interface EmailTemplatePreviewProps {
     type: TemplateType;
     subject?: string;
     bodyHtml?: string;
     isOpen: boolean;
     onClose: () => void;
   }

2. Modal structure:
   - Full-screen or large modal
   - Tabs: Desktop view, Mobile view, Plain Text
   - Subject line preview at top
   - Iframe to render HTML (prevents CSS conflicts)
   - Sample data input form (optional)

3. Sample data:
   - Pre-fill with realistic sample data
   - Allow editing sample data
   - Re-render preview on change

4. Preview rendering:
   - POST /v1/tenant-admin/email-templates/:type/preview
   - Send sample data in request
   - Render returned HTML in iframe

5. Responsive:
   - Desktop view: 600px width (standard email width)
   - Mobile view: 320px width
   - Plain text: monospace font, no HTML

6. Styling:
   - Modal background dark overlay
   - Preview iframe with border
   - Close button prominent
   - Device toggle buttons (desktop/mobile icons)
```

**Location:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/EmailTemplatePreview.tsx`

**Success Criteria:**

- [x] Preview renders HTML in iframe
- [x] Variables replaced with sample data
- [x] Desktop/mobile views work
- [x] Plain text preview works
- [x] Modal closes properly

**Estimated Time:** 2.5 hours

---

#### Agent 3: Email Template List Component

**Type:** general-purpose
**Task:** Create EmailTemplateList.tsx navigation
**Deliverable:** Template selector UI

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/EmailTemplateList.tsx

Requirements:

1. Layout:
   - List of 3 template types (cards or list items)
   - Each shows: Icon, Name, Status (Custom/Default)
   - Click to edit template

2. Template types:
   - Booking Confirmation (✉️ icon)
   - Reminder (🔔 icon)
   - Cancellation (❌ icon)

3. Status indicator:
   - "Custom" badge if tenant has customized
   - "Default" badge if using platform default
   - Color-coded (green for custom, gray for default)

4. Actions:
   - Click card to open editor
   - Show last updated date if custom

5. State management:
   - Fetch templates: GET /v1/tenant-admin/email-templates
   - Track which templates are customized
   - Pass selected template to editor

6. Styling:
   - Grid layout (3 columns desktop, 1 column mobile)
   - Cards with hover effect
   - Icons prominent
   - Status badge in corner
```

**Location:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/EmailTemplateList.tsx`

**Success Criteria:**

- [x] Lists 3 template types
- [x] Shows custom/default status
- [x] Click opens editor
- [x] Fetches from API

**Estimated Time:** 1.5 hours

---

**Sequential Agent (after Agents 1-3 complete):**

#### Agent 4: Dashboard Integration

**Type:** general-purpose
**Task:** Add Emails tab to TenantDashboard
**Deliverable:** Integrated email template manager

**Instructions:**

```
Add to /Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/TenantDashboard.tsx

Add 6th tab: "Emails"

Structure:
<Tab>Emails</Tab>

<TabPanel>
  <EmailTemplateList onSelectTemplate={(type) => setSelectedTemplate(type)} />
  {selectedTemplate && (
    <EmailTemplateEditor
      type={selectedTemplate}
      onClose={() => setSelectedTemplate(null)}
    />
  )}
</TabPanel>

Flow:
1. Tab shows EmailTemplateList
2. Click template opens EmailTemplateEditor
3. Editor has Preview button that opens EmailTemplatePreview
4. Save updates template, returns to list
```

**Success Criteria:**

- [x] Emails tab appears
- [x] List → Editor → Preview flow works
- [x] Save returns to list

**Estimated Time:** 1 hour

---

**Day 11-13 Total Time:** 8 hours

**Manual Testing (End of Day 13):**

```
1. Navigate to tenant dashboard
2. Click "Emails" tab
3. See 3 templates listed (all "Default" status)
4. Click "Booking Confirmation"
5. Editor opens with default content
6. Edit subject line: "Your Dream Wedding is Confirmed!"
7. Edit body HTML (use rich text editor)
8. Click variable button to insert {{customerName}}
9. Click Preview
10. Preview modal opens with sample data
11. Toggle Desktop/Mobile views
12. Close preview
13. Click Save
14. Verify status changes to "Custom"
15. Click Reset to Default
16. Confirm reset
17. Verify status returns to "Default"
18. Refresh page - changes persist
```

---

### Day 14-15 (Nov 19-20): Email Testing & Polish

**Session Goal:** Test email rendering across email clients, polish UI

**Testing Strategy:**

#### Email Client Testing

Use [Litmus](https://litmus.com/) or [Email on Acid](https://www.emailonacid.com/) (free trials) to test rendering in:

- Gmail (web, mobile)
- Outlook (2016, 2019, web)
- Apple Mail (macOS, iOS)
- Yahoo Mail
- Thunderbird

**Test checklist:**

- [ ] Subject line renders correctly
- [ ] Logo displays
- [ ] Colors match tenant branding
- [ ] Variables replaced correctly
- [ ] Links work
- [ ] Mobile responsive
- [ ] Plain text fallback works

---

#### Polish Tasks

**UI Improvements:**

- [ ] Add tooltips to variable buttons ("Click to insert")
- [ ] Syntax highlighting in HTML editor (optional)
- [ ] Auto-save draft every 30 seconds
- [ ] Undo/redo in editor
- [ ] Character count for subject (show "50/200")
- [ ] HTML validation (check for broken tags)

**UX Improvements:**

- [ ] Show preview automatically on edit (live preview)
- [ ] Add "Send Test Email" button (email to tenant admin)
- [ ] Template comparison (show default vs custom side-by-side)
- [ ] Copy template to clipboard (export HTML)

**Error Handling:**

- [ ] Handle missing variables gracefully
- [ ] Validate HTML structure
- [ ] Show warnings for email compatibility issues
- [ ] Prevent saving invalid templates

---

**Commit after Day 15:**

```bash
git add -A
git commit -m "feat(phase-5.3): Complete email template customization

Backend:
- EmailTemplate Prisma model and migration
- EmailTemplateService with CRUD and rendering
- 3 default templates (confirmation, reminder, cancellation)
- 5 API endpoints (list, get, update, delete, preview)
- Variable replacement engine
- Plain text fallback support

Frontend:
- EmailTemplateList component (template selector)
- EmailTemplateEditor with React Quill rich text editor
- EmailTemplatePreview with desktop/mobile/plain text views
- Variable insertion UI (click to insert)
- Save/Reset functionality
- Dashboard integration (6th tab)

Testing:
- Email client compatibility verified (Gmail, Outlook, Apple Mail)
- Mobile responsive rendering tested
- Variable replacement tested with 20+ scenarios
- Default fallback system verified

Polish:
- Auto-save drafts
- Live preview
- Send test email feature
- Template export

Phase 5.3: COMPLETE ✅

PHASE 5 COMPLETE! 🎉

All 3 features delivered:
✅ 5.1 Package Photo Upload
✅ 5.2 Add-On Management
✅ 5.3 Email Template Customization

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Week 5-6: Integration, Testing, Documentation (Days 16-25)

### Day 16-20 (Nov 21-25): End-to-End Testing

**Session Goal:** Comprehensive testing of all Phase 5 features

**Parallel Subagent Testing Plan:**

Launch 3 test agents simultaneously:

#### Agent 1: Package Photo Testing Suite

**Type:** general-purpose
**Task:** Test all package photo flows
**Deliverable:** Bug report and fixes

**Test scenarios:**

1. Upload photos to new package
2. Upload photos to existing package
3. Reorder photos
4. Delete photos
5. Upload max 5 photos
6. Try to upload 6th photo (error)
7. Upload oversized file (error)
8. Upload non-image file (error)
9. Multi-tenant isolation (Tenant A can't see Tenant B photos)
10. Photos persist after refresh
11. Photos display in widget
12. Mobile responsive upload
13. Network error handling
14. Rapid consecutive uploads
15. Edge case: Delete photo that doesn't exist

**Estimated Time:** 3 hours

---

#### Agent 2: Add-On Testing Suite

**Type:** general-purpose
**Task:** Test all add-on CRUD operations
**Deliverable:** Bug report and fixes

**Test scenarios:**

1. Create add-on with all fields
2. Create add-on with minimal fields
3. Edit add-on
4. Delete add-on (soft delete)
5. Toggle active/inactive
6. Slug uniqueness enforcement
7. Associate add-on with package
8. Display add-on in booking widget
9. Multi-tenant isolation
10. Bulk operations (enable/disable multiple)
11. Validation errors (invalid slug, negative price)
12. Add-on appears in booking cart
13. Price calculation with add-ons
14. Mobile responsive form
15. Edge case: Edit deleted add-on

**Estimated Time:** 3 hours

---

#### Agent 3: Email Template Testing Suite

**Type:** general-purpose
**Task:** Test template rendering and emails
**Deliverable:** Bug report and fixes

**Test scenarios:**

1. Customize booking confirmation template
2. Customize reminder template
3. Customize cancellation template
4. Preview with sample data
5. Send test email
6. Variable replacement accuracy
7. Logo injection
8. Color injection
9. Reset to default
10. Multi-tenant isolation (Tenant A templates separate from Tenant B)
11. Email client rendering (Gmail, Outlook)
12. Mobile email rendering
13. Plain text fallback
14. Missing variable handling
15. Edge case: Invalid HTML in template

**Estimated Time:** 3 hours

---

**Day 16-20 Total Time:** 9 hours

**Bugs found → Fix immediately:**

- Document bugs in GitHub Issues or markdown file
- Prioritize critical bugs (P0: blocks usage, P1: breaks feature, P2: minor issue)
- Fix P0 and P1 bugs before moving to documentation

---

### Day 21-25 (Nov 26-30): Documentation & Launch Prep

**Session Goal:** Write comprehensive documentation for Phase 5 features

**Parallel Documentation Agents:**

#### Agent 1: User Guide Writer

**Type:** general-purpose
**Task:** Create tenant admin user guide for Phase 5 features
**Deliverable:** Comprehensive user guide with screenshots

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/TENANT_ADMIN_PHASE_5_USER_GUIDE.md

Structure:

# Tenant Admin User Guide - Phase 5 Features

## Overview
This guide covers the three new self-service features added in Phase 5.

## Feature 1: Package Photo Upload

### How to Upload Photos
1. Navigate to Tenant Dashboard
2. Click Packages tab
3. Click Edit on a package
4. Find "Photos" section
5. Drag and drop up to 5 images (or click to browse)
6. Photos appear immediately in grid
7. Reorder by dragging photos
8. Delete by clicking trash icon
9. Click Save Package

### Tips
- Maximum 5 photos per package
- Maximum 5MB per photo
- Supported formats: JPG, PNG, WebP
- First photo is the primary photo (shows in catalog)

### Troubleshooting
- "File too large" error: Compress image or use smaller file
- "Invalid file type": Only images allowed
- Photos not saving: Check internet connection

---

## Feature 2: Add-On Management

### How to Create Add-Ons
1. Navigate to Tenant Dashboard
2. Click Add-Ons tab
3. Click Create Add-On
4. Fill in form:
   - Slug: lowercase-with-hyphens (e.g., photo-album)
   - Name: Professional Photo Album
   - Description: 50-page leather-bound album
   - Price: $250.00
   - Photo URL: (optional)
   - Is Active: checked
5. Click Save
6. Add-on appears in grid

### How to Associate Add-Ons with Packages
1. Edit a package
2. Find "Add-Ons" section
3. Check boxes for add-ons to include
4. Save package
5. Add-ons appear in booking widget for that package

### Tips
- Create reusable add-ons (apply to multiple packages)
- Use descriptive names (customers see these)
- Set competitive prices
- Disable seasonal add-ons when not available

---

## Feature 3: Email Template Customization

### How to Customize Emails
1. Navigate to Tenant Dashboard
2. Click Emails tab
3. Click on template type (Booking Confirmation, Reminder, Cancellation)
4. Editor opens with current template
5. Edit subject line
6. Edit email body (use rich text editor)
7. Insert variables by clicking variable buttons
8. Click Preview to see with sample data
9. Click Save

### Available Variables
- {{customerName}} - Couple's name
- {{packageName}} - Package title
- {{eventDate}} - Wedding date
- {{totalPrice}} - Total cost
- {{addOns}} - List of add-ons
- {{tenantLogo}} - Your logo
- {{tenantPrimaryColor}} - Your brand color
- {{tenantName}} - Your business name

### Tips
- Preview on desktop and mobile before saving
- Send test email to yourself
- Use your brand voice (friendly, professional, etc.)
- Keep subject lines under 50 characters for mobile
- Include call-to-action (contact us, view details)

### Reset to Default
If you want to undo changes:
1. Click Reset to Default button
2. Confirm
3. Template reverts to platform default

---

## FAQ

**Q: Can I upload videos to packages?**
A: Not yet. Currently only images (JPG, PNG, WebP) are supported.

**Q: Can I create unlimited add-ons?**
A: Yes, no limit on add-ons.

**Q: Will emails work with my custom domain?**
A: Yes, emails send from your tenant account.

**Q: Can I export my email templates?**
A: Yes, use Copy to Clipboard feature (coming soon).

Include screenshots for each step.
```

**Location:** `/Users/mikeyoung/CODING/Elope/TENANT_ADMIN_PHASE_5_USER_GUIDE.md`

**Success Criteria:**

- [x] Covers all 3 features
- [x] Step-by-step instructions
- [x] Screenshots included
- [x] Troubleshooting section
- [x] FAQ section

**Estimated Time:** 3 hours

---

#### Agent 2: API Documentation Updater

**Type:** general-purpose
**Task:** Update API docs with Phase 5 endpoints
**Deliverable:** Updated API documentation

**Instructions:**

```
Update API documentation with new endpoints:

Package Photos:
- POST /v1/tenant-admin/packages/:id/photos
- DELETE /v1/tenant-admin/packages/:id/photos/:filename

Add-Ons:
- GET /v1/tenant-admin/add-ons
- POST /v1/tenant-admin/add-ons
- PUT /v1/tenant-admin/add-ons/:id
- DELETE /v1/tenant-admin/add-ons/:id
- PUT /v1/tenant-admin/add-ons/bulk

Email Templates:
- GET /v1/tenant-admin/email-templates
- GET /v1/tenant-admin/email-templates/:type
- PUT /v1/tenant-admin/email-templates/:type
- DELETE /v1/tenant-admin/email-templates/:type
- POST /v1/tenant-admin/email-templates/:type/preview

For each endpoint:
- Method and path
- Request headers (Authorization, X-Tenant-Key)
- Request body schema
- Response schema
- Example request
- Example response
- Error codes
```

**Estimated Time:** 2 hours

---

#### Agent 3: Migration Guide Writer

**Type:** general-purpose
**Task:** Write migration notes for existing tenants
**Deliverable:** Migration guide

**Instructions:**

```
Create /Users/mikeyoung/CODING/Elope/PHASE_5_MIGRATION_GUIDE.md

# Phase 5 Migration Guide

## Overview
Phase 5 adds 3 new features. This guide helps existing tenants adopt them.

## Database Migrations
All migrations are automatic. No manual steps required.

Changes:
- Package.photos JSON column added
- AddOn.photoUrl, displayOrder fields added
- EmailTemplate model added

## Feature Availability
All features are available immediately in tenant dashboard.

## Recommended Adoption Steps

### Week 1: Add Photos to Packages
1. Login to tenant dashboard
2. Add photos to your top 3 packages
3. Test photos appear in widget
4. Add photos to remaining packages

### Week 2: Create Add-Ons
1. List your current add-ons (albums, extra hours, etc.)
2. Create add-ons in dashboard
3. Associate with relevant packages
4. Test add-on booking flow

### Week 3: Customize Emails
1. Review default email templates
2. Customize booking confirmation first
3. Add your logo and brand colors
4. Send test email to yourself
5. Customize reminder and cancellation emails

## Breaking Changes
NONE. All changes are additive.

## Support
Contact support@elope.com if you need help.
```

**Estimated Time:** 1 hour

---

**Day 21-25 Total Time:** 6 hours

---

## Optimal Subagent Usage Patterns

### When to Use Parallel Agents ✅

**Independent Tasks:**
Tasks that don't depend on each other's outputs can run simultaneously.

**Examples:**

- Database schema + validation schemas + service layer (no dependencies)
- Multiple UI components that don't interact
- Documentation for different features
- Testing different features

**Launch Pattern:**

```bash
# Example: 3 agents working in parallel
Agent 1: Database migration
Agent 2: Validation schemas
Agent 3: Type definitions

# All complete → Integrate results
```

**Time Savings:**

- Sequential: 1 + 1 + 1 = 3 hours
- Parallel: max(1, 1, 1) = 1 hour
- **Savings: 66%**

---

### When to Use Sequential Agents ⚠️

**Dependent Tasks:**
Tasks where one depends on another's output must run sequentially.

**Examples:**

- API methods must exist before UI can call them
- Component must be built before integration
- Database must be migrated before service layer uses new fields

**Launch Pattern:**

```bash
# Example: Sequential dependency chain
Agent 1: Build component
  ↓ (wait for completion)
Agent 2: Add API client methods
  ↓ (wait for completion)
Agent 3: Wire component into dashboard
```

**Critical Path:**
Identify the longest chain of dependencies and optimize around it.

---

### Optimal Launch Pattern 🚀

**For each feature, follow this 4-phase pattern:**

#### Phase 1: Foundation (Parallel)

Launch 2-3 agents simultaneously:

```
Agent 1: Database migration
Agent 2: Validation schemas
Agent 3: Type definitions
```

**Time:** 30-60 minutes

---

#### Phase 2: Backend (Sequential)

One agent after Phase 1:

```
Agent 4: Service layer methods (uses Phase 1 outputs)
  ↓
Agent 5: API endpoints (uses service methods)
```

**Time:** 1-2 hours

---

#### Phase 3: Frontend (Parallel)

Launch 2-3 agents after Phase 2:

```
Agent 6: UI component
Agent 7: API client methods
Agent 8: Dashboard integration prep
```

**Time:** 2-3 hours

---

#### Phase 4: Polish (Single)

One agent for final touches:

```
Agent 9: Error handling, loading states, edge cases, manual testing
```

**Time:** 1-2 hours

---

**Total Time:**

- Sequential: 8-12 hours
- Optimized Parallel: 5-8 hours
- **Savings: 30-40%**

---

## Daily Workflow Template

### Morning Session (2-3 hours)

**1. Plan (5 min)**

```
- Review yesterday's progress
- Choose feature to build today
- Identify parallel work opportunities
- List agent tasks with dependencies
```

**2. Launch Agents (10 min)**

```
- Start 2-4 agents on independent tasks
- Provide clear, specific instructions
- Set success criteria for each agent
- Note expected completion time
```

**3. Monitor Progress (30 min)**

```
- Check agent outputs every 15 minutes
- Answer clarification questions
- Prepare next sequential task
- Identify blockers early
```

**4. Integrate (60-90 min)**

```
- Combine agent outputs
- Resolve any conflicts (e.g., naming, imports)
- Test integration (compile, run, manual test)
- Fix bugs found during integration
```

**5. Manual Test (30 min)**

```
- Use the feature yourself (dogfooding)
- Test happy path + 5 edge cases
- Note improvements needed
- Document bugs
```

---

### Afternoon Session (2-3 hours)

**6. Polish (60-90 min)**

```
- Improve UX based on testing
- Add loading states and error messages
- Style components (responsive, accessible)
- Optimize performance
```

**7. Commit (10 min)**

```
- Review all changes: git diff
- Write descriptive commit message
- Reference feature and phase number
- Document what's complete vs. in-progress
- Push to remote (if working with team)
```

**8. Document (30-60 min)**

```
- Update progress tracker (README, roadmap)
- Add inline code comments
- Write user-facing docs (if feature complete)
- Update PHASE_5_EXECUTION_PLAN.md checkboxes
```

**9. Plan Tomorrow (10 min)**

```
- Review what's left
- Identify tomorrow's parallel tasks
- Prepare agent instructions
- Set realistic goals
```

---

### End of Week Review (30 min)

**Friday afternoon:**

```
1. Update maturity score (track progress)
2. Review completed features (what worked well)
3. Note blockers encountered (how resolved)
4. Plan next week's features
5. Celebrate wins! 🎉
```

---

## Success Metrics

### Phase 5 Complete When:

**Technical Checklist:**

- [x] All 3 features fully functional
- [x] TypeScript compiles with 0 errors
- [x] No console errors in browser
- [x] No security vulnerabilities (eslint-plugin-security)
- [x] All API endpoints return proper status codes
- [x] Multi-tenant isolation verified (Tenant A can't access Tenant B data)

**User Experience Checklist:**

- [x] Tenant can upload 5 package photos via dashboard
- [x] Tenant can create/edit/delete add-ons
- [x] Tenant can customize 3 email templates
- [x] All operations work without platform admin intervention
- [x] Mobile responsive on all features
- [x] Accessible (keyboard nav, screen reader friendly)

**Documentation Checklist:**

- [x] User guide published
- [x] API docs updated with new endpoints
- [x] Migration guide complete (for existing tenants)
- [x] Inline code comments added
- [x] Roadmap shows Phase 5 ✅

**Performance Checklist:**

- [x] Photo upload completes in < 3 seconds
- [x] Dashboard loads in < 2 seconds
- [x] API responses in < 500ms (95th percentile)
- [x] No memory leaks (test with Chrome DevTools)
- [x] Images optimized (WebP format preferred)

---

## Risk Mitigation

### Common Blockers & Solutions

#### Blocker 1: Agents Produce Conflicting Code

**Symptoms:**

- Import statements conflict
- Function names overlap
- TypeScript errors after merging

**Solution:**

- Launch dependent tasks sequentially, not parallel
- Provide clear naming conventions in instructions
- Review Agent 1 output before launching Agent 2

**Prevention:**

- Map out dependencies before launching agents
- Use unique prefixes (e.g., PackagePhoto vs AddOn)

---

#### Blocker 2: TypeScript Errors After Agent Work

**Symptoms:**

- Red squigglies in VSCode
- `npm run typecheck` fails
- Build errors

**Solution:**

- Always run `npm run typecheck` before committing
- Fix type errors immediately (don't accumulate)
- Use `any` sparingly (prefer proper types)

**Prevention:**

- Include TypeScript compilation in agent success criteria
- Test compile after each agent completes

---

#### Blocker 3: Complex Drag-and-Drop Not Working

**Symptoms:**

- Drag events not firing
- Order not updating
- Browser compatibility issues

**Solution:**

- Start with simple list, add DnD later
- Use well-tested library (react-beautiful-dnd)
- Test in Chrome first, then other browsers

**Prevention:**

- Break feature into: MVP (list) → Enhancement (DnD)
- Ship working version first, polish later

---

#### Blocker 4: Email Rendering Broken in Some Clients

**Symptoms:**

- Emails look good in Gmail, broken in Outlook
- Layout shifts on mobile
- Images don't load

**Solution:**

- Use tested email template framework (MJML)
- Test in Litmus or Email on Acid
- Inline all CSS (email clients strip <style> tags)
- Use tables for layout (not flexbox/grid)

**Prevention:**

- Start with proven template (Foundation for Emails)
- Test early and often in multiple clients
- Provide plain text fallback

---

#### Blocker 5: Lost Momentum Midweek

**Symptoms:**

- Features taking longer than estimated
- Feeling overwhelmed
- Context switching frequently

**Solution:**

- Ship smallest working version first, polish later
- Take breaks (Pomodoro technique: 25 min focus, 5 min break)
- Ask for help if stuck > 30 minutes

**Prevention:**

- Set realistic daily goals (1-2 features max)
- Celebrate small wins (commit often)
- Keep scope tight (defer nice-to-haves)

---

## Phase 5 Completion Checklist

### Week 1: Package Photos ✅

- [x] Backend API (completed Nov 7)
- [ ] Frontend component (Day 1)
- [ ] Dashboard integration (Day 1)
- [ ] Manual testing (Day 2)
- [ ] Polish and commit (Day 2)

### Week 2: Add-Ons

- [ ] Database review (Day 4)
- [ ] Validation schemas (Day 4)
- [ ] Service layer methods (Day 4)
- [ ] Backend API routes (Day 4)
- [ ] Frontend manager component (Day 5)
- [ ] Frontend form component (Day 5)
- [ ] Dashboard integration (Day 5)
- [ ] Advanced features (Day 6-7)
- [ ] Manual testing and commit (Day 7)

### Week 3-4: Email Templates

- [ ] Database model and migration (Day 9)
- [ ] Template service layer (Day 9)
- [ ] Default templates (Day 10)
- [ ] Backend API endpoints (Day 10)
- [ ] Frontend editor component (Day 11-12)
- [ ] Frontend preview component (Day 12)
- [ ] Frontend list component (Day 13)
- [ ] Dashboard integration (Day 13)
- [ ] Email client testing (Day 14)
- [ ] Polish and commit (Day 15)

### Week 5-6: Integration & Launch

- [ ] End-to-end testing (Day 16-20)
- [ ] User guide (Day 21-22)
- [ ] API documentation (Day 23)
- [ ] Migration guide (Day 24)
- [ ] Final polish (Day 25)
- [ ] Production deployment (Day 26)
- [ ] Announce to tenants (Day 26)

---

## Next Steps (After This Document)

### Immediate (Today - Nov 7)

1. ✅ Review and approve this execution plan
2. Schedule Week 1 work sessions (Nov 8-10)
3. Prepare development environment:
   ```bash
   cd /Users/mikeyoung/CODING/Elope/client
   npm install react-dropzone react-beautiful-dnd @types/react-beautiful-dnd
   ```

### Tomorrow (Day 1 - Nov 8)

1. Launch 3 parallel agents for PackagePhotoUploader:
   - Agent 1: Build component
   - Agent 2: Add API client methods
   - Agent 3: Research dashboard integration
2. Wire everything together (Agent 4)
3. Manual testing
4. Note any issues for Day 2

### This Week (Nov 8-10)

1. Complete package photo feature end-to-end ✅
2. Polish and commit (Day 2)
3. Buffer day (Day 3)
4. Celebrate first Phase 5 feature complete! 🎉

### Next Week (Nov 11-15)

1. Add-On Management backend (Day 4-5)
2. Add-On Management frontend (Day 5-7)
3. Advanced features (Day 6-7)
4. Commit and celebrate 🎉

### Weeks 3-4 (Nov 16-30)

1. Email Template backend (Day 9-10)
2. Email Template frontend (Day 11-13)
3. Testing and polish (Day 14-15)
4. Commit and celebrate 🎉

### Weeks 5-6 (Dec 1-19)

1. Integration testing (Day 16-20)
2. Documentation (Day 21-25)
3. Production deployment (Day 26)
4. Launch announcement 🚀

---

## Velocity Tracking

### Estimated vs. Actual Time

**Week 1: Package Photos**

- Estimated: 12 hours
- Actual: \_\_ hours
- Variance: \_\_ hours

**Week 2: Add-Ons**

- Estimated: 20 hours
- Actual: \_\_ hours
- Variance: \_\_ hours

**Week 3-4: Email Templates**

- Estimated: 28 hours
- Actual: \_\_ hours
- Variance: \_\_ hours

**Week 5-6: Testing & Docs**

- Estimated: 20 hours
- Actual: \_\_ hours
- Variance: \_\_ hours

**Total Phase 5:**

- Estimated: 80 hours (4-6 weeks @ 15-20 hrs/week)
- Actual: \_\_ hours
- Variance: \_\_ hours

**Learnings:**
(Update as you go to improve future estimates)

---

## Document Status

**Status:** ✅ Ready for execution
**Created:** November 7, 2024
**Last Updated:** November 7, 2024
**Owner:** Development Team
**Next Review:** End of Week 1 (Nov 10, 2024)

---

**Related Documents:**

- `/Users/mikeyoung/CODING/Elope/MULTI_TENANT_ROADMAP.md` - Overall roadmap
- `/Users/mikeyoung/CODING/Elope/PHASE_5_IMPLEMENTATION_SPEC.md` - Technical specs
- `/Users/mikeyoung/CODING/Elope/README.md` - Project overview
- `/Users/mikeyoung/CODING/Elope/PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md` - Previous phase

---

**Let's ship Phase 5! 🚀**
