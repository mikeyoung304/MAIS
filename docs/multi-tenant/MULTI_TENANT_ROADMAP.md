# Multi-Tenant Self-Service Roadmap

**Document Version:** 1.1
**Last Updated:** December 2, 2025
**Current Status:** Phase 5 In Progress (33% complete - 1 of 3 features done)
**Architecture Maturity:** 95% Complete
**Next Milestone:** Complete Phase 5 - Self-Service Foundation (Q1 2026)

---

## Executive Summary

### Current Maturity Score: 7/10 (Updated December 2025)

MAIS has successfully transformed from a single-tenant booking platform into a production-ready multi-tenant SaaS platform. **Phase 4 is complete**, and Phase 5 is 33% complete with package photo uploads operational. The platform now supports tenant authentication, branding management, self-service operations, and visual package catalogs.

**What's Working:**

- Multi-tenant data isolation (row-level, 100% secure)
- Tenant branding (logo, colors, fonts)
- Tenant authentication (email/password + JWT)
- Package management with photo uploads (NEW: Phase 5.1 complete)
- Blackout date management
- Booking view and filtering
- Stripe Connect for variable commissions (8-15%)
- Tenant admin dashboard for operations

**What's Missing (Phase 5+ Priorities):**

- Add-on management UI (tenants cannot create/edit add-ons) - IN PROGRESS
- Email template customization (fixed platform templates) - IN PROGRESS
- UI copy/content management (hardcoded platform branding)
- Cloud storage for media (currently local file storage)
- Multi-language support
- Advanced booking features (dynamic pricing, refunds, modifications)

### Vision for Full Self-Service

Enable 50 independent wedding businesses to operate as **white-label platforms** with zero platform support required after onboarding. Each tenant should:

1. Manage complete service catalogs (packages + add-ons)
2. Upload photos for visual merchandising
3. Customize all customer-facing copy and branding
4. Configure email templates with their logo/colors
5. Set dynamic pricing and discounts
6. Handle bookings, refunds, and customer communications independently

### Timeline Overview

| Phase                                 | Duration  | Effort        | Completion Target |
| ------------------------------------- | --------- | ------------- | ----------------- |
| Phase 5: Self-Service Foundation      | 4-6 weeks | 80-100 hours  | Q1 2026           |
| Phase 6: Content & Copy Management    | 3-4 weeks | 60-80 hours   | Q1 2026           |
| Phase 7: Media & Cloud Infrastructure | 2-3 weeks | 40-60 hours   | Q2 2026           |
| Phase 8: Advanced Features            | 4-6 weeks | 100-120 hours | Q2-Q3 2026        |
| Phase 9: Analytics & Optimization     | 2-3 weeks | 40-60 hours   | Q3 2026           |
| Phase 10: Marketplace & Templates     | 3-4 weeks | 60-80 hours   | Q4 2026           |

**Total Time to Maturity Score 9/10:** 6-9 months (18-26 weeks)

---

## Current State (Phase 4 Complete - November 2025)

### Completed Features

#### 1. Multi-Tenant Foundation (Phase 1)

**Files:**

- `server/prisma/schema.prisma` - Tenant model with encrypted secrets
- `server/src/lib/encryption.service.ts` - AES-256-GCM encryption
- `server/src/middleware/tenant.ts` - X-Tenant-Key authentication

**Capabilities:**

- Row-level data isolation (100% secure, no cross-tenant leakage)
- API key generation (`pk_live_*` and `sk_live_*`)
- Commission calculation service (10-15% variable rates)
- Tenant-scoped database queries (all repositories)

#### 2. Embeddable Widget Core (Phase 2)

**Files:**

- `client/src/widget/` - Widget application
- `client/public/widget-loader.js` - SDK loader (<3KB)
- `server/src/routes/branding.routes.ts` - Branding API

**Capabilities:**

- JavaScript SDK for tenant website embedding
- Iframe-based widget with postMessage communication
- Dynamic branding application (logo, colors, fonts)
- Auto-resize based on content
- Mobile-responsive design

#### 3. Stripe Connect Integration (Phase 3)

**Files:**

- `server/src/services/stripe-connect.service.ts` - Connect service
- `server/src/services/commission.service.ts` - Commission engine

**Capabilities:**

- Stripe Express Connected Accounts
- Variable commission payments (10%, 12.5%, 15%)
- Server-side commission calculation (security)
- Onboarding link generation
- Payment intent with application fees

#### 4. Tenant Admin UI (Phase 4)

**Files:**

- `server/src/routes/tenant-admin.routes.ts` - Admin API routes (8 endpoints)
- `server/src/services/tenant-auth.service.ts` - JWT authentication
- `server/src/services/upload.service.ts` - File upload service
- `client/src/components/ColorPicker.tsx` - Color customization UI
- `client/src/components/FontSelector.tsx` - Font selection UI
- `client/src/hooks/useBranding.ts` - Branding hook

**Capabilities:**

- Tenant authentication (email/password + JWT)
- Logo upload (2MB max, local storage)
- Color customization (primary, secondary)
- Font selection (8 curated Google Fonts)
- Package CRUD (create, read, update, delete)
- Blackout date management
- Booking view (read-only with filters)

**API Endpoints:**

```
POST   /v1/tenant/logo             # Upload logo
PUT    /v1/tenant/branding         # Update colors/fonts
GET    /v1/tenant/branding         # Get current branding
GET    /v1/tenant-admin/packages   # List packages
POST   /v1/tenant-admin/packages   # Create package
PUT    /v1/tenant-admin/packages/:id    # Update package
DELETE /v1/tenant-admin/packages/:id    # Delete package
GET    /v1/tenant-admin/blackouts  # List blackout dates
POST   /v1/tenant-admin/blackouts  # Add blackout
DELETE /v1/tenant-admin/blackouts/:id  # Remove blackout
GET    /v1/tenant-admin/bookings   # View bookings
```

### Gaps Analysis

#### Priority 1: Self-Service Blockers

1. **Add-On Management Missing** - Tenants cannot create/edit add-ons (only packages)
2. **Photo Upload Limited** - Only logo upload exists; no package/add-on photo management
3. **Email Templates Fixed** - Hardcoded platform templates; no tenant customization
4. **UI Copy Hardcoded** - Platform branding in widget; no tenant content control

#### Priority 2: Production Readiness

5. **Local File Storage** - Logo files stored locally (not production-ready)
6. **No Image Optimization** - No resize/compress; large files impact performance
7. **Limited Font Selection** - Only 8 fonts; no custom font upload
8. **No Email Tracking** - Cannot view sent emails or resend confirmations

#### Priority 3: Advanced Features

9. **Static Pricing** - No seasonal pricing, discounts, or deposit options
10. **Basic Booking View** - No modification, refund, or customer communication tools
11. **Calendar Gaps** - No visual calendar or recurring blackouts
12. **Single Language** - English only; no multi-language support

---

## Phase 5: Priority 1 - Self-Service Foundation (4-6 weeks)

**Status:** In Progress (December 2025)
**Progress:** 1 of 3 features complete (33%)
**Target Completion:** Q1 2026

### Completed ✅

- **5.1 Package Photo Upload System** (Completed December 2025)
  - Database schema updated (photos JSON column)
  - Upload service extended (uploadPackagePhoto, deletePackagePhoto)
  - API endpoints implemented (POST/DELETE /v1/tenant-admin/packages/:id/photos)
  - Static serving configured (/uploads/packages/)
  - PackagePhotoUploader component with drag-and-drop UI
  - Photo reordering and management
  - Tenant ownership verification enforced
  - Max 5 photos per package, 5MB limit per photo
  - Full E2E test coverage added

### In Progress 🔄

- **5.2 Add-On Management System** (December 2025)
  - Backend API routes for add-on CRUD
  - Frontend UI components
  - Validation and testing

- **5.2 Email Template Customization** (December 2025 - Q1 2026)
  - Email template model and service
  - Template editor UI
  - Preview system

### Pending ⏳

None - All Phase 5 features have been initiated

### Goal

Enable tenants to fully manage their service offerings independently without platform support.

### Timeline: Q1 2026 (January - February)

### Features

#### 5.1 Add-On Management System

**Why:** Tenants cannot offer additional services (photography albums, videography, extra hours) without this feature. Currently, only platform admins can create add-ons.

**Effort:** 2 weeks (40 hours)

**Requirements:**

1. **Backend API Endpoints**
   - `GET /v1/tenant-admin/add-ons` - List all add-ons for tenant
   - `POST /v1/tenant-admin/add-ons` - Create new add-on
   - `PUT /v1/tenant-admin/add-ons/:id` - Update add-on (verify ownership)
   - `DELETE /v1/tenant-admin/add-ons/:id` - Delete add-on (verify ownership)

2. **Database Schema** (Already exists in Prisma)

   ```prisma
   model AddOn {
     id        String   @id @default(cuid())
     tenantId  String   // Already tenant-scoped
     slug      String
     title     String
     description String?
     priceCents Int
     active    Boolean  @default(true)
     photoUrl  String?

     @@unique([tenantId, slug])
   }
   ```

3. **Frontend Components**
   - `TenantAddOnsManager.tsx` - Main add-on management page
   - `AddOnForm.tsx` - Create/edit form with validation
   - `AddOnCard.tsx` - Display card with edit/delete actions

4. **Validation Schema** (`server/src/validation/tenant-admin.schemas.ts`)
   ```typescript
   export const createAddOnSchema = z.object({
     slug: z
       .string()
       .min(1)
       .max(50)
       .regex(/^[a-z0-9-]+$/),
     title: z.string().min(1).max(100),
     description: z.string().max(500).optional(),
     priceCents: z.number().int().min(0),
     photoUrl: z.string().url().optional(),
   });
   ```

**Implementation Steps:**

1. Create backend API routes in `server/src/routes/tenant-admin.routes.ts`
2. Add validation schemas for add-on CRUD operations
3. Build `TenantAddOnsManager` component with CRUD UI
4. Add photo URL input (temporary until Phase 5.2 implements upload)
5. Integrate with existing `CatalogService` (already has add-on methods)
6. Test multi-tenant isolation (verify Tenant A cannot access Tenant B's add-ons)

**Acceptance Criteria:**

- [x] Tenant can create add-ons with title, description, price, photo URL
- [x] Tenant can edit their own add-ons (cannot edit other tenants' add-ons)
- [x] Tenant can delete their own add-ons (soft delete maintains booking history)
- [x] Add-ons appear in booking widget immediately after creation
- [x] Multi-tenant isolation enforced (API tests verify)
- [x] Validation errors displayed clearly in UI

**Files to Create:**

- `server/src/routes/tenant-admin.routes.ts` (add 4 endpoints to existing file)
- `client/src/features/tenant-admin/TenantAddOnsManager.tsx` (new component)
- `client/src/features/tenant-admin/AddOnForm.tsx` (new component)
- `server/src/validation/tenant-admin.schemas.ts` (extend existing)

**Files to Modify:**

- `server/src/routes/tenant-admin.routes.ts` (add add-on routes)
- `client/src/App.tsx` (add route for add-on manager)

**Testing:**

```bash
# API Tests
curl -X POST http://localhost:5000/v1/tenant-admin/add-ons \
  -H "X-Tenant-Key: pk_live_bellaweddings_xxx" \
  -H "Authorization: Bearer <tenant_jwt>" \
  -d '{
    "slug": "photo-album",
    "title": "Professional Photo Album",
    "description": "50-page leather-bound album",
    "priceCents": 25000
  }'

# Isolation Test
# Tenant A creates add-on, verify Tenant B cannot access/edit it
```

---

#### 5.2 Email Template Customization

**Why:** Branded communications are critical for professionalism. Currently, all tenants receive identical platform emails with generic platform branding.

**Effort:** 2-3 weeks (50 hours)

**Requirements:**

1. **Email Template Model**

   ```prisma
   model EmailTemplate {
     id          String   @id @default(cuid())
     tenantId    String
     type        String   // 'booking_confirmation', 'reminder', 'cancellation'
     subject     String
     bodyHtml    String   @db.Text
     bodyText    String?  @db.Text
     variables   Json     // Available template variables
     createdAt   DateTime @default(now())
     updatedAt   DateTime @updatedAt

     @@unique([tenantId, type])
   }
   ```

2. **Template Variables**
   - `{{customerName}}` - Couple name
   - `{{packageName}}` - Selected package
   - `{{eventDate}}` - Wedding date
   - `{{totalPrice}}` - Total cost
   - `{{addOns}}` - List of add-ons
   - `{{tenantLogo}}` - Tenant logo URL
   - `{{tenantPrimaryColor}}` - Tenant primary color

3. **Backend API**
   - `GET /v1/tenant-admin/email-templates` - List all templates
   - `GET /v1/tenant-admin/email-templates/:type` - Get specific template
   - `PUT /v1/tenant-admin/email-templates/:type` - Update template
   - `POST /v1/tenant-admin/email-templates/:type/preview` - Preview with sample data

4. **Frontend Components**
   - `EmailTemplateEditor.tsx` - Rich text editor with variable insertion
   - `EmailTemplatePreview.tsx` - Live preview with sample data
   - `EmailTemplateList.tsx` - List of customizable templates

5. **Email Service Integration**
   - Extend `EmailProvider` interface to support templates
   - Load tenant template from database (or fall back to default)
   - Inject tenant branding (logo, colors) automatically
   - Replace variables with actual booking data

**Implementation Steps:**

1. Create `EmailTemplate` Prisma model and run migration
2. Build `email-template.service.ts` with CRUD operations
3. Extend `emailProvider` to load tenant templates
4. Create rich text editor component (use `react-quill` or similar)
5. Build preview system with sample data injection
6. Add default templates for all tenants (booking confirmation, reminder, cancellation)
7. Test template rendering with different tenants

**Acceptance Criteria:**

- [x] Customize booking confirmation email (subject + body)
- [x] Customize reminder emails (2 days before event)
- [x] Customize cancellation/refund emails
- [x] Preview templates with sample data before saving
- [x] Logo and branding colors automatically injected
- [x] Template variables auto-replaced with booking data
- [x] Fallback to default template if tenant hasn't customized

**Files to Create:**

- `server/src/services/email-template.service.ts` (new service)
- `client/src/features/tenant-admin/EmailTemplateEditor.tsx` (new component)
- `client/src/features/tenant-admin/EmailTemplatePreview.tsx` (new component)
- `server/prisma/migrations/xxx_add_email_templates.sql` (new migration)

**Files to Modify:**

- `server/prisma/schema.prisma` (add EmailTemplate model)
- `server/src/adapters/postmark.adapter.ts` (load tenant templates)
- `server/src/di.ts` (inject email template service)

**Testing:**

```bash
# Update confirmation email template
curl -X PUT http://localhost:5000/v1/tenant-admin/email-templates/booking_confirmation \
  -H "X-Tenant-Key: pk_live_xxx" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "subject": "Your {{packageName}} is Confirmed!",
    "bodyHtml": "<h1>Hi {{customerName}},</h1><p>Your wedding on {{eventDate}} is confirmed!</p>"
  }'

# Preview template
curl -X POST http://localhost:5000/v1/tenant-admin/email-templates/booking_confirmation/preview \
  -H "X-Tenant-Key: pk_live_xxx" \
  -H "Authorization: Bearer <jwt>" \
  -d '{
    "customerName": "John & Jane",
    "packageName": "Business Growth Package",
    "eventDate": "2026-06-15",
    "totalPrice": "$1,500"
  }'
```

---

### Success Metrics (Phase 5)

**Quantitative:**

- 100% of tenants can manage add-ons independently
- 90%+ of packages have photos uploaded
- 80% of tenants customize email templates
- 50% reduction in support tickets for service management
- <100ms API response time for add-on CRUD

**Qualitative:**

- Tenants report "easy to use" for add-on manager (survey)
- Email branding consistent with tenant visual identity
- Zero cross-tenant data leaks (security audit)
- Tenant satisfaction score >8/10 for Phase 5 features

---

## Phase 6: Content & Copy Management (3-4 weeks)

### Goal

Enable true white-label experience with full content control over all customer-facing text.

### Timeline: Q1 2026 (February - March)

### Features

#### 6.1 UI Copy Customization System

**Why:** Widget currently shows hardcoded platform branding and generic copy. Tenants need to customize all text to match their brand voice.

**Effort:** 2 weeks (40 hours)

**Requirements:**

1. **Content Model**

   ```typescript
   interface TenantContent {
     hero: {
       title: string; // "Capture Your Perfect Day"
       subtitle: string; // "Premium Wedding Photography"
       ctaText: string; // "View Packages"
     };
     about: {
       heading: string; // "About Us"
       body: string; // Rich text
     };
     features: Array<{
       icon: string; // Icon name
       title: string; // "All-Day Coverage"
       description: string; // "From prep to reception"
     }>;
     buttons: {
       bookNow: string; // "Book Now"
       viewDetails: string; // "View Details"
       addToCart: string; // "Add to Cart"
     };
     footer: {
       copyright: string; // "© 2026 Bella Weddings"
       links: Array<{
         text: string;
         url: string;
       }>;
     };
   }
   ```

2. **Database Storage**
   - Add `content: Json?` field to Tenant model (or extend `branding` JSON)
   - Store structured content as JSON
   - Fallback to default English copy if not customized

3. **Backend API**
   - `GET /v1/tenant/content` - Get current content (public endpoint)
   - `PUT /v1/tenant-admin/content` - Update content (admin endpoint)
   - `POST /v1/tenant-admin/content/preview` - Preview changes

4. **Frontend Components**
   - `ContentEditor.tsx` - Form-based editor for all copy sections
   - `ContentPreview.tsx` - Live preview of widget with updated copy
   - Integration into widget to load tenant content

**Implementation Steps:**

1. Extend Tenant model with `content` JSON field
2. Create content editor UI with sections (hero, about, features, buttons)
3. Add content loading to widget (fetch from `/v1/tenant/content`)
4. Implement preview system (render widget with draft content)
5. Add reset to defaults button
6. Test with multiple languages (verify Unicode support)

**Acceptance Criteria:**

- [x] Tenant can edit hero section (title, subtitle, CTA)
- [x] Tenant can edit about section (heading, rich text body)
- [x] Tenant can customize feature descriptions
- [x] Tenant can change button text (Book Now, View Details, etc.)
- [x] Changes reflected immediately on public widget
- [x] Fallback to defaults if not customized
- [x] Preview system works without publishing

**Files to Create:**

- `client/src/features/tenant-admin/ContentEditor.tsx` (new component)
- `client/src/features/tenant-admin/ContentPreview.tsx` (new component)

**Files to Modify:**

- `server/prisma/schema.prisma` (add content field to Tenant)
- `server/src/routes/tenant-admin.routes.ts` (add content endpoints)
- `client/src/widget/WidgetApp.tsx` (load tenant content)

---

#### 6.2 Testimonials Management

**Why:** Social proof is critical for wedding bookings. Tenants need to showcase customer reviews.

**Effort:** 1 week (20 hours)

**Requirements:**

1. **Testimonial Model**

   ```prisma
   model Testimonial {
     id          String   @id @default(cuid())
     tenantId    String
     customerName String
     quote       String   @db.Text
     packageName String?
     eventDate   DateTime?
     photoUrl    String?
     featured    Boolean  @default(false)
     displayOrder Int     @default(0)
     createdAt   DateTime @default(now())

     @@index([tenantId, featured])
     @@index([tenantId, displayOrder])
   }
   ```

2. **Backend API**
   - `GET /v1/tenant/testimonials` - Public endpoint (featured only)
   - `GET /v1/tenant-admin/testimonials` - List all (admin)
   - `POST /v1/tenant-admin/testimonials` - Create testimonial
   - `PUT /v1/tenant-admin/testimonials/:id` - Update testimonial
   - `DELETE /v1/tenant-admin/testimonials/:id` - Delete testimonial

3. **Frontend Components**
   - `TestimonialManager.tsx` - CRUD interface
   - `TestimonialForm.tsx` - Create/edit form
   - `TestimonialCarousel.tsx` - Widget display component

**Acceptance Criteria:**

- [x] CRUD testimonials via dashboard
- [x] Upload customer photo (optional)
- [x] Mark testimonials as "featured" for homepage display
- [x] Reorder testimonials (drag-and-drop)
- [x] Display on widget homepage (carousel or grid)
- [x] Configurable display count (3, 5, 10 testimonials)

**Files to Create:**

- `server/prisma/migrations/xxx_add_testimonials.sql` (new migration)
- `client/src/features/tenant-admin/TestimonialManager.tsx` (new component)
- `client/src/widget/components/TestimonialCarousel.tsx` (new component)

**Files to Modify:**

- `server/prisma/schema.prisma` (add Testimonial model)
- `server/src/routes/tenant-admin.routes.ts` (add testimonial endpoints)

---

#### 6.3 Legal Pages (Terms, Privacy)

**Why:** Each tenant needs custom legal pages for compliance (GDPR, CCPA, etc.)

**Effort:** 1 week (20 hours)

**Requirements:**

1. **Legal Page Model**

   ```prisma
   model LegalPage {
     id        String   @id @default(cuid())
     tenantId  String
     type      String   // 'terms', 'privacy', 'refund'
     title     String
     content   String   @db.Text
     updatedAt DateTime @updatedAt

     @@unique([tenantId, type])
   }
   ```

2. **Backend API**
   - `GET /v1/tenant/legal/:type` - Public endpoint (terms, privacy, refund)
   - `PUT /v1/tenant-admin/legal/:type` - Update legal page

3. **Frontend Components**
   - `LegalPageEditor.tsx` - Rich text editor (React Quill)
   - Auto-generated pages at `/terms`, `/privacy`, `/refund`
   - Footer links automatically appear when pages exist

**Acceptance Criteria:**

- [x] Tenant can write custom terms of service
- [x] Tenant can write custom privacy policy
- [x] Tenant can write custom refund policy
- [x] Rich text editor with formatting (headings, lists, links)
- [x] Pages accessible at `/terms`, `/privacy` on widget
- [x] Footer links automatically added when pages exist
- [x] Default templates provided for common legal text

**Files to Create:**

- `client/src/features/tenant-admin/LegalPageEditor.tsx` (new component)
- `client/src/widget/pages/LegalPage.tsx` (new widget page)

**Files to Modify:**

- `server/prisma/schema.prisma` (add LegalPage model)
- `server/src/routes/tenant-admin.routes.ts` (add legal page endpoints)
- `client/src/widget/App.tsx` (add legal page routes)

---

### Success Metrics (Phase 6)

**Quantitative:**

- 100% of tenants can customize all customer-facing copy
- 70%+ of tenants add testimonials
- 90%+ of tenants customize legal pages
- Zero hardcoded platform branding in tenant widgets

**Qualitative:**

- Widget feels like tenant's brand (not platform brand)
- Legal pages meet compliance requirements
- Testimonials increase conversion rate by 15%+

---

## Phase 7: Media & Cloud Infrastructure (2-3 weeks)

### Goal

Production-ready media management with cloud storage and CDN delivery.

### Timeline: Q2 2026 (March - April)

### Features

#### 7.1 Cloud Storage Migration

**Why:** Local file storage is not production-ready. Need scalable, redundant, CDN-delivered media.

**Effort:** 1.5 weeks (30 hours)

**Requirements:**

1. **Cloud Storage Provider** (Choose one)
   - **Option A: AWS S3 + CloudFront**
     - Pros: Full control, lowest cost at scale
     - Cons: Complex setup, manage CDN separately
   - **Option B: Cloudinary** (Recommended)
     - Pros: Image optimization built-in, CDN included, easy API
     - Cons: Higher cost, vendor lock-in

2. **Migration Plan**
   - Create adapter interface: `MediaStorageProvider`
   - Implement `CloudinaryAdapter` or `S3Adapter`
   - Migrate existing local files to cloud
   - Update all `photoUrl` references to cloud URLs
   - Keep local adapter for development mode

3. **Features**
   - Automatic image optimization (resize, compress)
   - CDN delivery (global edge locations)
   - Backup and redundancy (99.9% uptime SLA)
   - Automatic format conversion (WebP, AVIF)
   - Thumbnail generation (multiple sizes)

**Implementation Steps:**

1. Create `MediaStorageProvider` interface in `lib/ports.ts`
2. Implement `CloudinaryAdapter` or `S3Adapter`
3. Update `upload.service.ts` to use new adapter
4. Add environment variables (API keys, bucket names)
5. Write migration script to move existing files
6. Update all upload endpoints to return cloud URLs
7. Test upload/delete/retrieve operations

**Acceptance Criteria:**

- [x] All uploads go to cloud storage (S3 or Cloudinary)
- [x] Images served via CDN (<100ms load time globally)
- [x] Automatic image optimization (50%+ size reduction)
- [x] 99.9%+ uptime SLA
- [x] Backup and redundancy configured
- [x] Local adapter still works for development

**Files to Create:**

- `server/src/adapters/cloudinary.adapter.ts` (new adapter)
- `server/src/lib/ports.ts` (add MediaStorageProvider interface)
- `server/scripts/migrate-to-cloud-storage.ts` (migration script)

**Files to Modify:**

- `server/src/services/upload.service.ts` (use new adapter)
- `server/src/di.ts` (inject cloud storage adapter)
- `server/.env.example` (add cloud storage variables)

**Testing:**

```bash
# Upload test
curl -X POST http://localhost:5000/v1/tenant/logo \
  -H "X-Tenant-Key: pk_live_xxx" \
  -F "logo=@test-logo.png"

# Verify CDN URL returned
# Response: { "url": "https://res.cloudinary.com/.../test-logo.png" }

# Verify image loads from CDN
curl https://res.cloudinary.com/.../test-logo.png
```

---

#### 7.2 Media Library UI

**Why:** Tenants need centralized media management to see all uploaded images, reuse images, and delete unused files.

**Effort:** 1 week (20 hours)

**Requirements:**

1. **Media Library Model**

   ```prisma
   model MediaAsset {
     id          String   @id @default(cuid())
     tenantId    String
     filename    String
     url         String
     thumbnailUrl String?
     mimeType    String
     sizeBytes   Int
     width       Int?
     height      Int?
     usedIn      Json?    // { packages: [], addOns: [], testimonials: [] }
     uploadedAt  DateTime @default(now())

     @@index([tenantId, uploadedAt])
   }
   ```

2. **Backend API**
   - `GET /v1/tenant-admin/media` - List all media assets
   - `POST /v1/tenant-admin/media` - Upload new media
   - `DELETE /v1/tenant-admin/media/:id` - Delete media (if not in use)
   - `GET /v1/tenant-admin/media/usage/:id` - Show where media is used

3. **Frontend Components**
   - `MediaLibrary.tsx` - Grid view of all media
   - `MediaUploader.tsx` - Bulk upload with progress
   - `MediaSelector.tsx` - Reusable picker for packages/add-ons
   - Filters: type (image/video), date, usage status

**Acceptance Criteria:**

- [x] Upload multiple files at once (drag-and-drop)
- [x] View all uploaded media in grid
- [x] Search and filter media (name, date, type)
- [x] Delete unused media (warn if media is in use)
- [x] See where each image is used (packages, add-ons, testimonials)
- [x] Reuse media across multiple entities (select from library)

**Files to Create:**

- `client/src/features/tenant-admin/MediaLibrary.tsx` (new component)
- `client/src/features/tenant-admin/MediaUploader.tsx` (new component)
- `client/src/components/MediaSelector.tsx` (new reusable component)

**Files to Modify:**

- `server/prisma/schema.prisma` (add MediaAsset model)
- `server/src/routes/tenant-admin.routes.ts` (add media endpoints)

---

### Success Metrics (Phase 7)

**Quantitative:**

- 50%+ reduction in image load times (CDN vs local)
- Zero local filesystem dependencies
- 99.9%+ uptime for media delivery
- 50%+ reduction in storage costs (optimization)

**Qualitative:**

- Tenants can manage media independently
- Images load fast globally
- No media-related support tickets

---

## Phase 8: Advanced Features (4-6 weeks)

### Goal

Competitive feature parity with established booking platforms (Acuity, Calendly, Honeybook).

### Timeline: Q2-Q3 2026 (April - July)

### Features

#### 8.1 Dynamic Pricing Engine

**Why:** Tenants need seasonal pricing, early bird discounts, and deposit options for competitiveness.

**Effort:** 2 weeks (40 hours)

**Requirements:**

1. **Pricing Rule Model**

   ```prisma
   model PricingRule {
     id          String   @id @default(cuid())
     tenantId    String
     name        String
     type        String   // 'seasonal', 'earlybird', 'lastminute', 'discount_code'
     packageIds  Json     // Array of package IDs
     startDate   DateTime?
     endDate     DateTime?
     discountPercent Decimal?
     discountAmount  Int?
     minDaysAdvance  Int?
     active      Boolean  @default(true)
     createdAt   DateTime @default(now())

     @@index([tenantId, active])
   }
   ```

2. **Pricing Engine Service**
   - Calculate final price based on rules
   - Apply discounts in priority order
   - Validate discount codes
   - Calculate deposit amounts

3. **Discount Code System**

   ```prisma
   model DiscountCode {
     id          String   @id @default(cuid())
     tenantId    String
     code        String   // "SUMMER2026"
     discountPercent Decimal?
     discountAmount  Int?
     maxUses     Int?
     currentUses Int      @default(0)
     validFrom   DateTime?
     validUntil  DateTime?
     active      Boolean  @default(true)

     @@unique([tenantId, code])
   }
   ```

4. **Features**
   - Seasonal pricing (summer vs winter rates)
   - Early bird discounts (book 6+ months in advance)
   - Last-minute discounts (book <30 days out)
   - Discount codes (SUMMER2026, EARLYBIRD, etc.)
   - Deposit options (pay 30% now, rest later)
   - Payment plans (split into 2-3 installments)

**Acceptance Criteria:**

- [x] Create seasonal pricing rules (date range, percentage/amount)
- [x] Early bird discounts (book 90+ days in advance)
- [x] Last-minute discounts (book <30 days out)
- [x] Discount codes with usage limits
- [x] Deposit options (percentage or fixed amount)
- [x] Payment plans (2-3 installments)
- [x] Pricing displayed in widget (with discounts shown)

**Files to Create:**

- `server/src/services/pricing-engine.service.ts` (new service)
- `client/src/features/tenant-admin/PricingRulesManager.tsx` (new component)
- `client/src/features/tenant-admin/DiscountCodeManager.tsx` (new component)

**Files to Modify:**

- `server/prisma/schema.prisma` (add PricingRule and DiscountCode models)
- `server/src/services/booking.service.ts` (integrate pricing engine)
- `client/src/widget/components/PackageCard.tsx` (show discounted prices)

---

#### 8.2 Advanced Booking Management

**Why:** Tenants need to modify bookings, process refunds, and communicate with customers.

**Effort:** 2 weeks (40 hours)

**Requirements:**

1. **Booking Modification Interface**
   - Change event date (if available)
   - Modify package (upgrade/downgrade)
   - Add/remove add-ons
   - Update customer details
   - Calculate price difference (refund or charge additional)

2. **Refund Processing UI**
   - Full refund (cancel booking)
   - Partial refund (downgrade package)
   - Refund to original payment method
   - Track refund status (pending, completed)

3. **Customer Communication Tools**
   - Send custom message to customer (email)
   - Pre-written templates (reminder, rescheduling, thank you)
   - Email history (view all sent emails)
   - Resend confirmation email

4. **Internal Notes and Tags**
   - Add private notes to bookings
   - Tag bookings (VIP, special request, follow-up needed)
   - Filter bookings by tags
   - Search bookings by notes

**Acceptance Criteria:**

- [x] Modify booking date (check availability first)
- [x] Modify booking package (calculate price difference)
- [x] Process full/partial refunds via Stripe
- [x] Send custom emails to customers
- [x] View email history for each booking
- [x] Add internal notes (not visible to customers)
- [x] Tag bookings for organization

**Files to Create:**

- `client/src/features/tenant-admin/BookingModificationModal.tsx` (new component)
- `client/src/features/tenant-admin/RefundModal.tsx` (new component)
- `client/src/features/tenant-admin/CustomerMessageModal.tsx` (new component)

**Files to Modify:**

- `server/src/services/booking.service.ts` (add modification methods)
- `server/src/adapters/stripe.adapter.ts` (add refund methods)
- `server/prisma/schema.prisma` (add notes and tags to Booking)

---

#### 8.3 Visual Calendar System

**Why:** Tenants need visual calendar to see bookings, blackouts, and availability at a glance.

**Effort:** 1.5 weeks (30 hours)

**Requirements:**

1. **Calendar Views**
   - Month view (traditional calendar grid)
   - Week view (detailed daily schedule)
   - List view (all bookings in order)

2. **Features**
   - Color-coded bookings (confirmed, pending, cancelled)
   - Drag-and-drop to reschedule (check availability)
   - Recurring blackouts (every Monday, first week of month)
   - Booking details on hover
   - Export calendar (iCal format)

3. **Calendar Library** (Use existing)
   - `react-big-calendar` or `FullCalendar` (React)
   - Integrate with booking/blackout data
   - Custom styling to match tenant branding

**Acceptance Criteria:**

- [x] Month/week/list calendar views
- [x] Color-coded bookings by status
- [x] Drag-and-drop rescheduling (with availability check)
- [x] Recurring blackout patterns (every Monday, etc.)
- [x] Booking timeline visualization
- [x] Export calendar to iCal (import to Google Calendar)

**Files to Create:**

- `client/src/features/tenant-admin/Calendar.tsx` (new component)
- `client/src/features/tenant-admin/RecurringBlackoutModal.tsx` (new component)

**Files to Modify:**

- `server/src/routes/tenant-admin.routes.ts` (add calendar export endpoint)
- `server/prisma/schema.prisma` (add recurring patterns to BlackoutDate)

---

#### 8.4 Multi-Language Support

**Why:** Tenants operating in multilingual regions need localized widgets.

**Effort:** 1 week (20 hours)

**Requirements:**

1. **Language System**
   - Default language per tenant (English, Spanish, French, etc.)
   - UI translation files (JSON)
   - Language selector in widget (if multi-language enabled)
   - Fallback to English if translation missing

2. **Translation Management**
   - Admin UI to manage translations
   - Export/import translation files (JSON)
   - Auto-translate with Google Translate API (optional)

3. **Supported Languages** (Initial)
   - English (en-US)
   - Spanish (es-ES)
   - French (fr-FR)
   - German (de-DE)
   - Italian (it-IT)

**Acceptance Criteria:**

- [x] Tenant can set default language
- [x] Widget displays in tenant's default language
- [x] Language selector in widget (optional)
- [x] All UI strings translated (buttons, labels, messages)
- [x] Date/number formatting localized
- [x] Fallback to English if translation missing

**Files to Create:**

- `client/src/i18n/translations/en-US.json` (new translation file)
- `client/src/i18n/translations/es-ES.json` (new translation file)
- `client/src/hooks/useTranslation.ts` (new hook)

**Files to Modify:**

- `server/prisma/schema.prisma` (add defaultLanguage to Tenant)
- `client/src/widget/WidgetApp.tsx` (integrate i18n)

---

### Success Metrics (Phase 8)

**Quantitative:**

- 50%+ of tenants use dynamic pricing
- 30%+ of tenants offer payment plans
- 80%+ of tenants use calendar view daily
- 20%+ of tenants enable multi-language

**Qualitative:**

- Feature parity with top 3 competitors
- Tenant satisfaction score >9/10
- Tenants report "powerful" and "easy to use"

---

## Phase 9: Analytics & Optimization (2-3 weeks)

### Goal

Data-driven insights for tenants to optimize pricing, packages, and conversion.

### Timeline: Q3 2026 (July - August)

### Features

#### 9.1 Revenue Dashboards

**Effort:** 1 week (20 hours)

**Metrics:**

- Total revenue (monthly, yearly)
- Average booking value
- Revenue by package (which packages sell best)
- Revenue by add-on
- Commission paid to platform
- Revenue trends (growing, flat, declining)

---

#### 9.2 Booking Analytics

**Effort:** 1 week (20 hours)

**Metrics:**

- Total bookings (confirmed, pending, cancelled)
- Booking conversion rate (checkouts → confirmed)
- Lead time (days between booking and event)
- Booking sources (direct, referral, social media)
- Cancellation rate and reasons

---

#### 9.3 Conversion Tracking

**Effort:** 1 week (20 hours)

**Metrics:**

- Widget visitors (unique, pageviews)
- Package views
- Add to cart rate
- Checkout started rate
- Checkout completed rate
- Funnel visualization (where users drop off)

---

#### 9.4 A/B Testing Framework

**Effort:** 1 week (20 hours)

**Features:**

- Test different pricing (A/B test price points)
- Test package descriptions (which copy converts better)
- Test button text ("Book Now" vs "Reserve Your Date")
- Test hero section copy
- Statistical significance calculator

---

#### 9.5 Package Performance Insights

**Effort:** 1 week (20 hours)

**Metrics:**

- Views per package
- Conversion rate per package
- Average revenue per package
- Most popular add-ons per package
- Seasonal trends per package

---

### Success Metrics (Phase 9)

**Quantitative:**

- 100% of tenants have access to analytics dashboard
- 50%+ of tenants use analytics weekly
- 20%+ of tenants run A/B tests

**Qualitative:**

- Tenants make data-driven pricing decisions
- Conversion rates improve by 15%+ on average
- Tenants report "invaluable insights"

---

## Phase 10: Marketplace & Templates (3-4 weeks)

### Goal

Accelerate tenant onboarding with pre-built templates and shared resources.

### Timeline: Q4 2026 (September - October)

### Features

#### 10.1 Pre-Built Package Templates

**Effort:** 1 week (20 hours)

**Templates:**

- "Romantic Elopement" (2 hours, 100 photos)
- "Full-Day Wedding" (8 hours, 500 photos, album)
- "Engagement Session" (1 hour, 50 photos)
- "Micro-Wedding" (4 hours, 300 photos)

---

#### 10.2 Theme Marketplace

**Effort:** 1.5 weeks (30 hours)

**Themes:**

- Pre-designed widget themes (colors, fonts, layouts)
- One-click theme application
- Theme preview before applying
- Community-submitted themes (optional)

---

#### 10.3 Email Template Gallery

**Effort:** 1 week (20 hours)

**Templates:**

- 10+ pre-written email templates
- Professional copywriting
- Industry best practices
- One-click import

---

#### 10.4 Service Catalog Templates

**Effort:** 1 week (20 hours)

**Templates:**

- Complete catalog for photography business
- Complete catalog for videography business
- Complete catalog for photo booth business
- Complete catalog for DJ service

---

### Success Metrics (Phase 10)

**Quantitative:**

- 80%+ of new tenants use templates
- Onboarding time <30 minutes (down from 2 hours)
- 50%+ of tenants try multiple themes

**Qualitative:**

- "Templates saved me hours" (tenant feedback)
- Faster time to first booking
- Higher quality initial setup

---

## Implementation Priorities

### Must-Have (Phase 5) - Q1 2026

**Total Effort:** 110 hours (4-6 weeks)
**Current Progress:** 33% complete (December 2025)

1. **Package Photos** - ✅ COMPLETE (20 hours)
   - Photo upload system operational
   - Drag-and-drop UI implemented
   - Gallery component with reordering
   - E2E tests added

2. **Add-On Management** - 🔄 IN PROGRESS (40 hours, 2 weeks)
   - Backend API (4 endpoints)
   - Frontend UI (CRUD interface)
   - Validation and testing

3. **Email Templates** - 🔄 IN PROGRESS (50 hours, 2-3 weeks)
   - Template model and service
   - Rich text editor
   - Preview system

### Should-Have (Phase 6-7) - Q1-Q2 2026

**Total Effort:** 130 hours (5-7 weeks)

4. **Content/Copy CMS** - 60 hours (3-4 weeks)
   - UI copy customization
   - Testimonials manager
   - Legal pages editor

5. **Cloud Storage** - 50 hours (2-3 weeks)
   - Cloud adapter (Cloudinary/S3)
   - Migration script
   - Media library UI

### Nice-to-Have (Phase 8+) - Q2-Q4 2026

**Total Effort:** 260+ hours (13+ weeks)

6. **Advanced Features** - 120 hours (6 weeks)
   - Dynamic pricing engine
   - Booking modifications
   - Visual calendar
   - Multi-language support

7. **Analytics** - 60 hours (3 weeks)
   - Revenue dashboards
   - Conversion tracking
   - A/B testing

8. **Marketplace** - 80 hours (4 weeks)
   - Package templates
   - Theme marketplace
   - Email template gallery

---

## Technical Debt & Refactoring

### Before Phase 5

**Priority:** HIGH

- [x] Refactor upload service to support multiple entity types (logos, packages, add-ons, testimonials)
- [x] Create reusable photo uploader component (used in packages, add-ons, testimonials)
- [x] Standardize file validation patterns (DRY principle)
- [x] Add comprehensive error handling to upload service
- [ ] Document upload service API and usage patterns

**Estimated Effort:** 8 hours (1 day)

### During Phase 6

**Priority:** MEDIUM

- [ ] Implement proper CSS variable consumption in all components
- [ ] Refactor hardcoded copy into CMS system (extract all strings)
- [ ] Create content fallback mechanism (graceful degradation)
- [ ] Add content versioning (track copy changes over time)
- [ ] Create content preview system (see changes before publishing)

**Estimated Effort:** 16 hours (2 days)

### During Phase 7

**Priority:** HIGH

- [ ] Replace local storage adapter with cloud storage adapter
- [ ] Implement image optimization pipeline (resize, compress, format conversion)
- [ ] Add CDN integration (CloudFront or Cloudinary CDN)
- [ ] Write migration script for existing local files
- [ ] Add media backup and disaster recovery plan

**Estimated Effort:** 24 hours (3 days)

---

## Resource Requirements

### Development Team

#### Phase 5-6 (Q1 2026) - Self-Service Foundation

**Duration:** 7-10 weeks

- **Backend Engineer:** 1 FTE
  - API endpoints for add-ons, email templates, content
  - Database migrations
  - Service layer extensions

- **Frontend Engineer:** 1 FTE
  - Admin UI components (add-on manager, email editor, content editor)
  - Photo uploader and gallery
  - Integration with backend APIs

- **DevOps Engineer:** 0.25 FTE (10 hours/week)
  - Cloud storage setup (Phase 7)
  - CDN configuration
  - Environment management

- **Designer:** 0.5 FTE (20 hours/week)
  - UI/UX for new admin features
  - Icon design
  - Template design

**Total:** 2.75 FTE

#### Phase 7-8 (Q2-Q3 2026) - Advanced Features

**Duration:** 6-9 weeks

- **Backend Engineer:** 1 FTE
  - Pricing engine
  - Booking modifications
  - Refund processing

- **Frontend Engineer:** 1 FTE
  - Calendar component
  - Advanced booking UI
  - Analytics dashboards

- **DevOps Engineer:** 0.25 FTE
  - Performance optimization
  - Monitoring setup

- **Designer:** 0.25 FTE
  - Calendar UI
  - Analytics dashboard design

**Total:** 2.5 FTE

#### Phase 9-10 (Q3-Q4 2026) - Polish & Marketplace

**Duration:** 5-7 weeks

- **Full Stack Engineer:** 1 FTE
  - Analytics implementation
  - Template marketplace
  - A/B testing framework

- **Designer:** 0.5 FTE
  - Template designs
  - Theme marketplace

- **Content Writer:** 0.25 FTE
  - Email templates
  - Package descriptions
  - Documentation

**Total:** 1.75 FTE

---

### Infrastructure Costs

#### Development Environment (Current)

**Monthly Cost:** ~$0

- Local development (no cloud costs)
- Free tier databases (Supabase)
- Free tier hosting (local testing)

#### Production Environment (Phase 7+)

**Monthly Cost:** ~$150-300

**Cloud Storage (Cloudinary or AWS S3):**

- Cloudinary: $99/month (Pro plan)
  - 75GB storage
  - 150GB bandwidth
  - Image transformations included
  - CDN included

- AWS S3 Alternative: $50-100/month
  - S3 storage: $5-10/month
  - CloudFront CDN: $30-50/month
  - Lambda@Edge: $10-20/month
  - Data transfer: $5-20/month

**Email Service (Postmark or SendGrid):**

- Postmark: $15/month (10,000 emails)
- SendGrid: $20/month (50,000 emails)

**Database (Supabase or Neon):**

- Supabase Pro: $25/month
  - 8GB database
  - 250GB bandwidth
  - Automated backups

**Monitoring & Error Tracking:**

- Sentry: $26/month (Team plan)
- Uptime monitoring: $10/month

**Total Infrastructure:** ~$175-285/month

**Annual Cost:** ~$2,100-3,400/year

---

### Third-Party Services

#### Required for Phase 7

- **Cloudinary Account** (Image management)
  - Pro plan: $99/month
  - Features: Storage, CDN, transformations

- **OR AWS Account** (S3 + CloudFront)
  - Pay-as-you-go
  - ~$50-100/month for 50 tenants

#### Required for Phase 9

- **Google Analytics 4** (Free)
  - Website analytics
  - Conversion tracking

- **Mixpanel or Amplitude** (Optional)
  - Advanced product analytics
  - Free tier available

#### Optional for Phase 10

- **Figma** ($12/editor/month)
  - Design templates
  - Theme mockups

---

## Risk Mitigation

### Technical Risks

#### Risk 1: Cloud Storage Migration Complexity

**Probability:** MEDIUM
**Impact:** HIGH (could delay Phase 7 by 1-2 weeks)

**Mitigation:**

- Start with Cloudinary (simpler than AWS S3)
- Test migration on staging with 10 tenants first
- Keep local storage adapter as fallback
- Write rollback script in case of issues
- Schedule migration during low-traffic period

**Contingency:**

- If migration fails, rollback to local storage
- Reschedule for next sprint
- Consider hiring Cloudinary consultant

#### Risk 2: Email Template Rendering Issues

**Probability:** MEDIUM
**Impact:** MEDIUM (emails may look broken in some clients)

**Mitigation:**

- Use proven email template framework (MJML or Foundation for Emails)
- Test in all major email clients (Gmail, Outlook, Apple Mail, Yahoo)
- Use Litmus or Email on Acid for email testing
- Provide plain-text fallback
- Pre-test with 5 tenants before rollout

**Contingency:**

- Fall back to simple text emails if HTML issues
- Hire email specialist for complex issues
- Provide basic templates only until resolved

#### Risk 3: Performance Degradation with Media Library

**Probability:** MEDIUM
**Impact:** MEDIUM (slow load times for admin dashboard)

**Mitigation:**

- Implement pagination (50 images per page)
- Add lazy loading for thumbnails
- Use CDN for fast media delivery
- Add loading states and skeleton screens
- Cache media library queries (5 min TTL)

**Contingency:**

- Reduce thumbnails per page (25 instead of 50)
- Add search/filter to reduce results
- Optimize database queries with indexes

#### Risk 4: Rich Text Editor XSS Vulnerabilities

**Probability:** LOW
**Impact:** HIGH (security risk)

**Mitigation:**

- Use well-vetted library (React Quill, Slate.js)
- Sanitize all HTML before saving (DOMPurify)
- Implement Content Security Policy (CSP)
- Validate on backend (don't trust client)
- Regular security audits

**Contingency:**

- Disable rich text editor if XSS detected
- Fall back to plain text only
- Emergency security patch
- Notify all tenants

---

### Business Risks

#### Risk 1: Feature Creep (Scope Expansion)

**Probability:** HIGH
**Impact:** HIGH (delays, budget overruns)

**Mitigation:**

- Stick to phased roadmap (no mid-sprint changes)
- Require business case for new features
- Defer non-essential features to future phases
- Communicate timeline to stakeholders
- Review scope every 2 weeks

**Contingency:**

- Push new features to Phase 11 (Q1 2027)
- Re-prioritize if critical feature emerges
- Add resources only if business-critical

#### Risk 2: Tenant Migration (Breaking Changes)

**Probability:** MEDIUM
**Impact:** MEDIUM (tenant frustration, support load)

**Mitigation:**

- Communicate changes 2 weeks in advance
- Provide migration guides with screenshots
- Offer migration support (office hours, video calls)
- Test all features with 3 pilot tenants first
- Provide rollback option for 30 days

**Contingency:**

- If issues, pause rollout and fix bugs
- Extend migration period from 30 to 60 days
- Create dedicated support channel for migrations

#### Risk 3: Support Load (New Features = More Questions)

**Probability:** HIGH
**Impact:** MEDIUM (support team overwhelmed)

**Mitigation:**

- Create comprehensive documentation before each phase launch
- Record video tutorials for complex features
- Build in-app tooltips and onboarding tours
- Launch FAQ section in admin dashboard
- Implement in-app chat support (Intercom or similar)

**Contingency:**

- Hire temporary support staff during launches
- Create knowledge base for self-service
- Prioritize bug fixes over new features

---

## Success Criteria

### Phase 5 Complete When:

- ✅ Tenants can manage add-ons independently (CRUD operations)
- ✅ All packages have photos uploaded (90%+ adoption)
- ✅ Emails are fully branded with tenant logos/colors (80%+ customization)
- ✅ Zero critical bugs for 2 weeks post-launch
- ✅ Support tickets reduced by 50% (self-service working)
- ✅ Tenant satisfaction score >8/10 for Phase 5 features

### Phase 6 Complete When:

- ✅ Tenants control all customer-facing copy (hero, about, buttons)
- ✅ No hardcoded platform branding remains (100% white-label)
- ✅ Legal pages customizable (terms, privacy, refund)
- ✅ Testimonials appear on 70%+ of tenant widgets
- ✅ Widget feels like tenant's brand (user testing confirms)
- ✅ Zero critical bugs for 2 weeks post-launch

### Phase 7 Complete When:

- ✅ All uploads go to cloud storage (100% migration)
- ✅ Images served via CDN (<100ms load time globally)
- ✅ 50%+ reduction in image file sizes (optimization working)
- ✅ 99.9%+ uptime for media delivery (monitoring confirms)
- ✅ Zero local filesystem dependencies
- ✅ Media library UI adopted by 80%+ of tenants

### Phase 8 Complete When:

- ✅ 50%+ of tenants use dynamic pricing features
- ✅ 30%+ of tenants offer payment plans
- ✅ 80%+ of tenants use calendar view daily
- ✅ Feature parity with top 3 competitors (feature audit)
- ✅ Tenant satisfaction score >9/10
- ✅ Zero critical bugs for 2 weeks post-launch

### Full Self-Service Achieved When:

- ✅ 95%+ of tenant operations require zero platform admin support
- ✅ Onboarding time <30 minutes (down from 2+ hours)
- ✅ Tenant satisfaction score >8/10 (NPS survey)
- ✅ Support ticket volume <5 per week per 50 tenants
- ✅ Platform maturity score 9/10 (internal audit)
- ✅ Churn rate <5% annually (tenants stay)
- ✅ Revenue per tenant >$500/month (engagement high)

---

## Measuring Progress

### Key Performance Indicators (KPIs)

#### Self-Service Adoption

- **Metric:** % of tenants using each new feature
- **Target:** >70% adoption within 60 days of launch
- **Measurement:** Track feature usage in database

#### Support Ticket Reduction

- **Metric:** # of support tickets per tenant per month
- **Target:** <2 tickets/tenant/month (down from 8)
- **Measurement:** Support system analytics

#### Onboarding Time

- **Metric:** Time to first booking (from tenant creation)
- **Target:** <30 minutes (down from 2+ hours)
- **Measurement:** Timestamp analysis (account created → first booking)

#### Tenant Satisfaction (NPS)

- **Metric:** Net Promoter Score
- **Target:** >50 (8+/10 satisfaction)
- **Measurement:** Quarterly survey

#### Feature Usage

- **Metric:** Daily/weekly active users of new features
- **Target:** >80% use add-on manager monthly
- **Measurement:** Feature usage analytics

#### Revenue Impact

- **Metric:** Average revenue per tenant
- **Target:** >$500/month (bookings × commission)
- **Measurement:** Stripe dashboard

---

## Conclusion

This roadmap provides a **clear, actionable path** from current maturity score 6/10 to full self-service maturity score 9/10. The phased approach balances:

1. **Quick Wins (Phase 5)** - Deliver immediate value with add-on management and email templates
2. **Foundation (Phase 6-7)** - Build scalable infrastructure with cloud storage and CMS
3. **Differentiation (Phase 8-10)** - Add competitive features that attract and retain tenants

**Timeline Summary:**

- **Q1 2026:** Phases 5-6 (Self-Service Foundation + Content Management) - 7-10 weeks
- **Q2 2026:** Phases 7-8 (Cloud Infrastructure + Advanced Features) - 6-9 weeks
- **Q3-Q4 2026:** Phases 9-10 (Analytics + Marketplace) - 5-7 weeks
- **Total:** 18-26 weeks (6-9 months) to full maturity

**Investment Required:**

- **Development Effort:** 500+ hours (~2.5 engineers × 6 months)
- **Infrastructure:** ~$2,100-3,400/year (production cloud services)
- **ROI:** Reduced support costs, higher tenant retention, increased GMV

**Next Steps:**

1. Review and approve roadmap (stakeholder sign-off)
2. Allocate resources for Q1 2026 (2 engineers, 1 designer)
3. Begin Phase 5 kickoff (January 2026)
4. Schedule weekly progress reviews
5. Set up KPI tracking dashboard

---

**Document Maintained By:** Product & Engineering Team
**Last Updated:** December 2, 2025
**Current Phase:** Phase 5 (33% complete - Package photos done, Add-ons and Email templates in progress)
**Next Review:** End of Phase 5 (estimated Q1 2026)
**Questions/Feedback:** Reference specific phase and feature IDs in discussions

**Related Documents:**

- [PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md](../../PHASE_4_TENANT_ADMIN_COMPLETION_REPORT.md) - Current state documentation
- [MULTI_TENANT_IMPLEMENTATION_GUIDE.md](../../MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - Technical implementation details
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture overview
- [IMPROVEMENT-ROADMAP.md](../../IMPROVEMENT-ROADMAP.md) - Original single-tenant roadmap
