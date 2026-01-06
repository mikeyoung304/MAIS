# Legacy-to-Next.js Migration Plan (COMPLETE)

**Created:** 2025-01-05
**Status:** Ready for implementation
**Estimated Effort:** 6-8 development days

---

## Naming Convention Guide (MUST FOLLOW)

**Decision:** Use consistent terminology across the entire codebase.

### Canonical Terms

| Business Concept      | Model Name                       | API Endpoint                  | UI Display                          | Notes                                         |
| --------------------- | -------------------------------- | ----------------------------- | ----------------------------------- | --------------------------------------------- |
| **Customer Segment**  | `Segment`                        | `/segments`                   | "Segment"                           | Different storefronts for different audiences |
| **Pricing Tier**      | `Package`                        | `/packages`                   | "Package" or via `tierDisplayNames` | 1-10 per segment, push towards 3              |
| **Time-slot Booking** | `Service` → **`Appointment`** ⚠️ | `/services` → `/appointments` | "Appointment"                       | **Rename planned (see below)**                |
| **Date Booking**      | `Booking`                        | `/bookings`                   | "Booking"                           | The actual reservation                        |

### Field Naming Standards

| Field        | Database                                     | API Response                        | Notes                          |
| ------------ | -------------------------------------------- | ----------------------------------- | ------------------------------ |
| Price        | `basePrice` (Package), `priceCents` (others) | `priceCents`                        | Always in cents, convert in UI |
| Display Name | `name`                                       | `name` (prefer) or `title` (legacy) | New code uses `name`           |
| Order        | `groupingOrder`                              | `groupingOrder`                     | Lower = displayed first        |

### Rules for New Code in This Migration

1. **Always use "Package"** - Never say "tier" in code (variables, functions, files)
2. **UI can display "Tier"** - Use `tierDisplayNames` for customer-facing labels
3. **Use "Appointment"** in new UI copy - Even though model is still `Service`
4. **Prices in cents** - Use `priceCents` in all new API work, convert to dollars only in UI

### Future Task: Service → Appointment Rename

**Not in scope for this migration.** Tracked as separate task.

| What      | Current     | Target          | Files Affected              |
| --------- | ----------- | --------------- | --------------------------- |
| Model     | `Service`   | `Appointment`   | ~30 files                   |
| Endpoints | `/services` | `/appointments` | contracts, routes, frontend |
| Effort    | -           | 2-3 hours       | Mechanical find/replace     |

**When:** After UI migration complete. Create separate ADR + plan.

---

## Executive Summary

Complete the migration from the legacy Vite client (`client/`) to the Next.js app (`apps/web/`). The migration is ~70% complete. This plan addresses verified gaps in tenant scheduling features and platform admin functionality.

### Key Decisions Made

- **Naming convention:** Use "Package" everywhere in code, "Appointment" in new UI copy
- **Service → Appointment rename:** Deferred to separate task after migration
- **Segments nav item:** Remove from admin sidebar (segments are tenant-scoped)
- **Scheduling sub-pages:** Separate routes (`/tenant/scheduling/appointments`, etc.)
- **Photo uploads:** Update API proxy to handle multipart/form-data

---

## Gap Verification Results

### Already Migrated (DO NOT DUPLICATE)

| Feature                    | Next.js Location     | Status                                         |
| -------------------------- | -------------------- | ---------------------------------------------- |
| Tenant Dashboard           | `/tenant/dashboard`  | Complete                                       |
| Packages Manager           | `/tenant/packages`   | Complete (needs photo upload)                  |
| Scheduling Overview        | `/tenant/scheduling` | Partial (needs sub-pages)                      |
| Branding Editor            | `/tenant/branding`   | Complete                                       |
| Pages Manager              | `/tenant/pages`      | Complete                                       |
| Build Mode (Visual Editor) | `/tenant/build`      | Complete (replaces legacy landing page editor) |
| Payments/Stripe            | `/tenant/payments`   | Complete                                       |
| Domains                    | `/tenant/domains`    | Complete                                       |
| Settings                   | `/tenant/settings`   | Complete                                       |
| AI Assistant               | `/tenant/assistant`  | Complete                                       |
| Billing                    | `/tenant/billing`    | Complete                                       |
| Tenant List (Admin)        | `/admin/tenants`     | Complete                                       |

### Verified Gaps (MUST IMPLEMENT)

**Tier 1 - Tenant Admin:**
| Feature | Legacy Location | Priority |
|---------|-----------------|----------|
| Appointment Types Manager | `client/src/features/tenant-admin/scheduling/ServicesManager/` | HIGH |
| Availability Rules | `client/src/features/tenant-admin/scheduling/AvailabilityRulesManager/` | HIGH |
| Appointments View | `client/src/features/tenant-admin/scheduling/AppointmentsView/` | MEDIUM |
| Photo Uploads | `client/src/features/photos/` | MEDIUM |

**Tier 2 - Platform Admin:**
| Feature | Legacy Location | Priority |
|---------|-----------------|----------|
| Dashboard Metrics | `client/src/features/admin/dashboard/` | HIGH |
| Bookings List | `client/src/features/admin/BookingList.tsx` | HIGH |
| Blackouts Manager | `client/src/features/admin/dashboard/tabs/BlackoutsTab.tsx` | LOW |

---

## Phase 1: Tenant Scheduling Sub-Pages

**Effort:** 3-4 days | **Priority:** HIGH

### 1.1 Create Scheduling Layout with Sub-Navigation

**File:** `apps/web/src/app/(protected)/tenant/scheduling/layout.tsx`

```typescript
// Shared layout with tab navigation:
// - Overview (current /scheduling page content)
// - Appointment Types (/scheduling/appointment-types) - manage what can be booked
// - Availability (/scheduling/availability) - set working hours
// - Appointments (/scheduling/appointments) - view booked appointments
// - Blackouts (/scheduling/blackouts) - block out dates
```

**Complexity:** S

### 1.2 Appointment Types Manager Page

**UI Label:** "Appointment Types" | **API Model:** `Service` (rename deferred)

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `app/(protected)/tenant/scheduling/appointment-types/page.tsx` | Appointment types list + CRUD | M |
| `app/(protected)/tenant/scheduling/appointment-types/error.tsx` | Error boundary | S |
| `components/scheduling/AppointmentTypesList.tsx` | Table of appointment types | M |
| `components/scheduling/AppointmentTypeForm.tsx` | Create/edit form | M |
| `components/scheduling/DeleteAppointmentTypeDialog.tsx` | Delete confirmation | S |

**API Endpoints (existing - still uses /services until rename):**

- `GET /api/tenant-admin/services`
- `POST /api/tenant-admin/services`
- `PUT /api/tenant-admin/services/:id`
- `DELETE /api/tenant-admin/services/:id`

**Reference:** `client/src/features/tenant-admin/scheduling/ServicesManager/`

**Key Fields:**

- `name`, `slug` (auto-generated)
- `duration` (minutes), `bufferTime`
- `priceCents` (display as dollars in UI)
- `active` toggle
- `sortOrder`

### 1.3 Availability Rules Manager Page

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `app/(protected)/tenant/scheduling/availability/page.tsx` | Rules list + CRUD | M |
| `app/(protected)/tenant/scheduling/availability/error.tsx` | Error boundary | S |
| `components/scheduling/AvailabilityRulesList.tsx` | Rules grouped by day | M |
| `components/scheduling/AvailabilityRuleForm.tsx` | Create rule form | M |

**API Endpoints (existing):**

- `GET /api/tenant-admin/availability-rules`
- `POST /api/tenant-admin/availability-rules`
- `PUT /api/tenant-admin/availability-rules/:id`
- `DELETE /api/tenant-admin/availability-rules/:id`

**Reference:** `client/src/features/tenant-admin/scheduling/AvailabilityRulesManager/`

**Key Fields:**

- `dayOfWeek` (MON-SUN selector)
- `startTime`, `endTime` (time pickers)
- `serviceId` (optional - filter by service)

### 1.4 Appointments View Page

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `app/(protected)/tenant/scheduling/appointments/page.tsx` | Appointments list | M |
| `app/(protected)/tenant/scheduling/appointments/error.tsx` | Error boundary | S |
| `components/scheduling/AppointmentFilters.tsx` | Status/date/service filters | M |
| `components/scheduling/AppointmentsList.tsx` | Enriched appointments table | M |

**API Endpoints (existing):**

- `GET /api/tenant-admin/appointments?status=X&serviceId=Y&startDate=Z`
- `GET /api/tenant-admin/services` (for filter dropdown)

**Reference:** `client/src/features/tenant-admin/scheduling/AppointmentsView/`

**Key Features:**

- Status filter (PENDING, CONFIRMED, CANCELLED)
- Date range picker
- Service filter dropdown
- Customer email display

### 1.5 Blackouts Sub-Page (Extract from main)

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `app/(protected)/tenant/scheduling/blackouts/page.tsx` | Blackouts CRUD | S |
| `app/(protected)/tenant/scheduling/blackouts/error.tsx` | Error boundary | S |
| `components/scheduling/BlackoutForm.tsx` | Create blackout form | S |

**Modify:**
| File | Change |
|------|--------|
| `app/(protected)/tenant/scheduling/page.tsx` | Convert to overview/dashboard |

---

## Phase 2: Photo Upload Support

**Effort:** 1 day | **Priority:** MEDIUM

### 2.1 Update API Proxy for Multipart

**File to modify:** `apps/web/src/app/api/tenant-admin/[...path]/route.ts`

```typescript
// Add handling for multipart/form-data:
// - Detect content-type: multipart/form-data
// - Stream body directly instead of parsing as text
// - Forward to backend with proper headers
```

**Complexity:** M

### 2.2 Photo Upload Components

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `components/photos/PhotoUploader.tsx` | Drag & drop upload | M |
| `components/photos/PhotoGrid.tsx` | Photo gallery display | S |
| `components/photos/PhotoDeleteDialog.tsx` | Delete confirmation | S |
| `hooks/usePhotoUpload.ts` | Upload state + API | M |

**API Endpoints (existing):**

- `POST /api/tenant-admin/packages/:id/photos` (multipart)
- `DELETE /api/tenant-admin/packages/:id/photos/:filename`

**Reference:** `client/src/features/photos/`

**Key Features:**

- Max 5 photos per package
- File type validation (jpg, png, webp)
- Max 5MB file size
- Drag & drop support
- Optimistic UI updates

### 2.3 Integrate with Packages Page

**File to modify:** `apps/web/src/app/(protected)/tenant/packages/page.tsx`

Add `<PhotoUploader packageId={...} />` to package edit form/dialog.

---

## Phase 3: Platform Admin Dashboard

**Effort:** 2 days | **Priority:** HIGH

### 3.1 Create Admin API Proxy

**File to create:** `apps/web/src/app/api/admin/[...path]/route.ts`

Copy pattern from tenant-admin proxy, change path prefix to `/v1/admin/`.

**Complexity:** S

### 3.2 Admin Dashboard with Metrics

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `app/(protected)/admin/dashboard/page.tsx` | Dashboard with metrics | M |
| `app/(protected)/admin/dashboard/error.tsx` | Error boundary | S |
| `components/admin/DashboardMetrics.tsx` | Metrics cards grid | M |

**API Endpoints (need proxy):**

- `GET /api/admin/stats`

**Reference:** `client/src/features/admin/dashboard/`

**Metrics to Display:**

- Total Tenants / Active Tenants
- Total Bookings / Confirmed / Pending
- Revenue (total, this month)
- Bookings this month

### 3.3 Admin Bookings List

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `app/(protected)/admin/bookings/page.tsx` | All bookings list | M |
| `app/(protected)/admin/bookings/error.tsx` | Error boundary | S |
| `components/admin/BookingsList.tsx` | Bookings table | M |

**API Endpoints (need proxy):**

- `GET /api/admin/bookings`

**Reference:** `client/src/features/admin/BookingList.tsx`

**Features:**

- Status badges (CONFIRMED/PENDING/CANCELLED)
- Tenant name column
- Date range filter
- CSV export button

### 3.4 Update Admin Sidebar

**File to modify:** `apps/web/src/components/layouts/AdminSidebar.tsx`

```typescript
const adminNavItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/admin/tenants', label: 'Tenants', icon: <Building2 /> },
  { href: '/admin/bookings', label: 'Bookings', icon: <Calendar /> },
  // REMOVE: segments nav item
];
```

### 3.5 Fix Admin Dashboard Redirect

**File to modify:** `apps/web/src/app/(protected)/admin/page.tsx`

Update redirect from `/admin/tenants` to `/admin/dashboard`.

---

## Phase 4: Polish & Utilities

**Effort:** 0.5 days | **Priority:** LOW

### 4.1 Admin Blackouts Page (Optional)

**Files to create:**
| File | Purpose | Complexity |
|------|---------|------------|
| `app/(protected)/admin/blackouts/page.tsx` | Platform blackouts | S |

Only if platform-level blackouts are needed (may skip).

### 4.2 Sentry Integration (Optional)

**Files to create:**
| File | Purpose |
|------|---------|
| `apps/web/sentry.client.config.ts` | Client config |
| `apps/web/sentry.server.config.ts` | Server config |

Defer unless specifically requested - logging is already in place.

---

## Phase 5: Cleanup

**Effort:** 0.5 days | **Priority:** After all phases complete

### 5.1 Pre-Cleanup Verification Checklist

- [ ] All tenant scheduling routes work (appointment-types, availability, appointments, blackouts)
- [ ] Photo uploads work on packages page
- [ ] Admin dashboard shows metrics
- [ ] Admin bookings list loads with filters
- [ ] No 404s in navigation
- [ ] Mobile responsive on all new pages
- [ ] Naming conventions followed (Package, Appointment terminology)
- [ ] E2E tests pass (if applicable)

### 5.2 Legacy Client Removal

**Files to modify:**
| File | Change |
|------|--------|
| `package.json` (root) | Remove `client` workspace |
| `render.yaml` | Remove client deployment (if separate) |
| `CLAUDE.md` | Remove legacy client references |
| `docs/DEVELOPING.md` | Update commands |

**Directory to delete:** `client/`

### 5.3 Documentation Updates

- Update `apps/web/README.md` with new routes
- Archive legacy docs to `docs/archive/2025-01/`

---

## Dependency Graph

```
Phase 1 (Tenant Scheduling)
    │
    ├── 1.1 Scheduling Layout ────┐
    │                             │
    ├── 1.2 Appointment Types ────┼── can run in parallel
    │                             │
    ├── 1.3 Availability Rules ───┤
    │                             │
    ├── 1.4 Appointments View ────┤
    │                             │
    └── 1.5 Blackouts Extract ────┘

Phase 2 (Photo Uploads)
    │
    ├── 2.1 Update API Proxy ──► 2.2 Photo Components ──► 2.3 Integrate Packages

Phase 3 (Platform Admin) ── can run parallel with Phase 1-2
    │
    ├── 3.1 Admin API Proxy ──► 3.2 Dashboard ──► 3.3 Bookings
    │
    └── 3.4 Sidebar Update (do early, quick)

Phase 4 (Polish) ── after Phases 1-3
    │
    └── Optional items

Phase 5 (Cleanup) ── after ALL phases verified
```

---

## Critical Files Reference

| Purpose                      | File Path                                                      |
| ---------------------------- | -------------------------------------------------------------- |
| Scheduling page (extend)     | `apps/web/src/app/(protected)/tenant/scheduling/page.tsx`      |
| API proxy pattern            | `apps/web/src/app/api/tenant-admin/[...path]/route.ts`         |
| Sidebar navigation           | `apps/web/src/components/layouts/AdminSidebar.tsx`             |
| Legacy appointment types ref | `client/src/features/tenant-admin/scheduling/ServicesManager/` |
| Legacy photos ref            | `client/src/features/photos/`                                  |
| Legacy admin dashboard ref   | `client/src/features/admin/dashboard/`                         |
| API contracts                | `packages/contracts/src/api.v1.ts`                             |

---

## Risk Assessment

| Risk                                  | Probability | Impact | Mitigation                                      |
| ------------------------------------- | ----------- | ------ | ----------------------------------------------- |
| Photo proxy breaks existing endpoints | Low         | High   | Test all tenant-admin routes after proxy update |
| Scheduling layout breaks mobile       | Medium      | Medium | Test on mobile viewports                        |
| Missing API endpoints                 | Low         | Medium | Contracts already define all needed endpoints   |
| Performance regression                | Low         | Low    | Use React Query for caching                     |

---

## Success Criteria

When complete:

- [ ] `client/` folder deleted
- [ ] All tenant admin workflows function in Next.js
- [ ] All platform admin features accessible
- [ ] No dead links in navigation
- [ ] No 404s when clicking dashboard buttons
- [ ] Production runs on Next.js only
- [ ] Mobile responsive on all pages

---

## Agent-Native Architecture Review

**Reviewer:** `agent-native-reviewer`
**Result:** ✅ Plan is well-aligned with agent-native principles

### ✅ What's Good

1. **Complete CRUD tool coverage** already exists for core entities:
   - Packages, Segments, Bookings, Blackouts, Add-ons, Landing Pages, Branding
   - Booking Links (Calendly-style) fully covered via `manage_bookable_service`, `manage_working_hours`, `manage_date_overrides`

2. **Shared Data Space** - Agents and UI already see the same data immediately (same API endpoints)

3. **No new tools required** - The migration adds UI pages, but existing agent tools already cover these capabilities

### ⚠️ Minor Action Parity Gaps (Non-Blocking)

| Gap                                     | Severity    | Status                                               |
| --------------------------------------- | ----------- | ---------------------------------------------------- |
| `get_bookings` lacks `packageId` filter | Minor       | Can add later                                        |
| No `reorder_services` tool              | Minor       | Only if UI adds drag-and-drop                        |
| Per-service availability rules          | Low         | Document as limitation                               |
| Individual photo deletion               | Intentional | Visual task, UI-only is appropriate                  |
| Platform admin features                 | N/A         | Correct security boundary (agents are tenant-scoped) |

### 📋 Recommendations (Optional Enhancements)

1. **Proceed with migration as planned** - Tool coverage is sufficient
2. **Minor enhancement** - Add `packageId` filter to `get_bookings` when convenient
3. **System prompt update** - Use "Appointment" terminology (matches new UI) instead of "Service"
4. **No blocking issues** - All new UI features have agent tool equivalents

### 🔍 Agent Tools Audit

| New UI Feature         | Related Agent Tool                              | Status               |
| ---------------------- | ----------------------------------------------- | -------------------- |
| Appointment Types CRUD | `manage_bookable_service`                       | ✅ Covered           |
| Availability Rules     | `manage_working_hours`, `manage_date_overrides` | ✅ Covered           |
| Appointments View      | `get_bookings`                                  | ✅ Covered           |
| Blackouts CRUD         | `manage_date_overrides`                         | ✅ Covered           |
| Photo Uploads          | N/A (visual task)                               | 🚫 UI-only (correct) |
| Admin Dashboard        | N/A (platform admin)                            | 🚫 Security boundary |
| Admin Bookings         | N/A (platform admin)                            | 🚫 Security boundary |

**Conclusion:** The migration plan maintains full agent-native parity. No new agent tools are required for the UI features being migrated.
