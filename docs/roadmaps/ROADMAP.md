# Roadmap

## Recent Progress

### Phase 5.1: Package Photo Upload Backend (Nov 7, 2024) ✅

**Completed in 35 minutes** using momentum-driven development:

**Database:**

- Added `photos` JSON column to Package model
- Schema: `[{url, filename, size, order}]` - max 5 photos

**Backend:**

- Extended UploadService with package photo methods
- POST /v1/tenant-admin/packages/:id/photos - Upload with 5MB limit
- DELETE /v1/tenant-admin/packages/:id/photos/:filename - Delete photo
- Static serving at /uploads/packages/

**Architecture Decisions:**

- JSON column approach (simpler than separate table for MVP)
- 5MB limit per photo (vs 2MB for logos)
- Tenant ownership verification on all operations
- Order field for future drag-and-drop reordering

**Files Modified:**

- server/prisma/schema.prisma - Added photos column
- server/src/services/upload.service.ts - Extended upload methods
- server/src/app.ts - Added static serving route
- server/src/routes/tenant-admin.routes.ts - Added photo endpoints

**Next Steps:**

- Build PackagePhotoUploader React component
- Add drag-and-drop interface
- Wire up to tenant dashboard

---

## MVP ✅ COMPLETE (v0.1.0)

- ✅ Packages + add‑ons (catalog domain with CRUD)
- ✅ Availability check (mock busy, later GCal)
- ✅ Checkout (mock, later Stripe Checkout)
- ✅ Confirmation email (console, later Postmark)
- ✅ Admin (bookings, packages CRUD, blackout dates)
- ✅ Success page with booking details
- ✅ E2E test suite (Playwright - 7 scenarios)

## Phase 2: Real Adapters ✅ COMPLETE (v0.2.0)

- ✅ **PostgreSQL Database** (Prisma ORM with migrations)
- ✅ **Stripe Payment Processing** (test mode + webhook handling)
- ✅ **Email Delivery** (file-sink with optional Postmark)
- ✅ **Calendar Integration** (mock with optional Google Calendar)
- ✅ **Admin Authentication** (bcrypt password hashing)
- ✅ **All Integration Tests Passing** (5/5 tests green)

### Completed (2025-10-23):

- Database schema with User passwordHash field
- Prisma migrations and seed script
- Stripe webhook signature verification
- Real-mode environment configuration
- Fixed critical Prisma repository bugs
- Comprehensive testing suite

### Next (Phase 2.1):

- Image storage (R2/S3)
- Analytics (Plausible)
- SEO polish (OG images, sitemap)

## Stack Migration ✅ COMPLETE (Phase 1 - 2025-10-23)

Migrated from hexagonal architecture to layered architecture to align with rebuild-6.0:

- ✅ **Architecture**: Hexagonal → Layered (domains → services, ports consolidated)
- ✅ **Package Manager**: pnpm → npm workspaces
- ✅ **Directory Structure**: apps/api → server, apps/web → client
- ✅ **Dependencies**: Express 5→4, React 19→18
- ✅ **Import Paths**: Fixed 21+ files with updated paths
- ✅ **TypeScript Config**: Added esModuleInterop, removed base config extends
- ✅ **Library Consolidation**: Created unified ports.ts, entities.ts, errors.ts

**Pending**: Prisma schema alignment (field name mismatches)

See MIGRATION_LOG.md for detailed changelog.

## Phase 3

- Deposits / rescheduling rules
- User accounts with magic links (optional)
- Vendor surfaces
