# Phase 2 Handoff: Admin UI for Segment Management

**Project**: Elope Multi-Tenant Segment Implementation
**Phase**: Phase 2 - Admin UI
**Status**: 🟡 READY TO START (0% complete)
**Prerequisites**: ✅ Phase 1 Complete (Backend foundation)
**Estimated Duration**: 1-2 sessions

## Phase 1 Recap

✅ **Completed** (100%):
- Database schema with Segment table
- PrismaSegmentRepository (full CRUD)
- SegmentService (validation + caching)
- 9 API endpoints (3 public + 6 admin)
- 47 integration tests passing
- Full documentation

## Phase 2 Overview

Build admin UI components for segment management, enabling Little Bit Farm administrators to create, edit, and manage their business line segments (e.g., "Weekend Getaway", "Micro-Wedding", "Wellness Retreat").

**Goal**: Enable tenant admins to configure their multi-segment catalog without touching code.

## Architecture Context

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: React Query (TanStack Query) for server state
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: Custom components + Tailwind CSS
- **HTTP Client**: Axios with tenant context

### Admin UI Location
- **Directory**: `/apps/web/src/pages/admin/`
- **Route**: `https://app.elopetomaconga.com/admin/segments`
- **Auth**: Requires tenant admin authentication
- **Layout**: Uses existing AdminLayout component

### Existing Admin UI Patterns

Reference these existing admin pages for consistency:

1. **PackageManager** (`/apps/web/src/pages/admin/PackageManager.tsx`)
   - List view with create/edit/delete
   - Table layout with actions column
   - Modal-based forms
   - React Query for data fetching
   - Optimistic updates with cache invalidation

2. **PackageForm** (`/apps/web/src/pages/admin/PackageForm.tsx`)
   - React Hook Form with Zod validation
   - Controlled inputs with error display
   - Save/Cancel buttons
   - Loading states during submission

3. **AdminHome** (`/apps/web/src/pages/admin/AdminHome.tsx`)
   - Dashboard with cards for each admin section
   - Navigation to sub-pages
   - Summary stats display

## Tasks Breakdown

### Task 1: Create SegmentManager Component (40%)
**File**: `/apps/web/src/pages/admin/SegmentManager.tsx`

**Requirements**:
- List view showing all segments (active + inactive) for tenant
- Table columns: Name, Slug, Status (Active/Inactive), Sort Order, Packages Count, Actions
- "Create Segment" button in header
- Actions per row: Edit, Delete, Toggle Active status
- Empty state when no segments exist
- Loading state during data fetch
- Error handling with retry option

**React Query Setup**:
```typescript
const { data: segments, isLoading, error, refetch } = useQuery({
  queryKey: ['segments', tenantId],
  queryFn: async () => {
    const res = await api.get(`/v1/tenant/admin/segments`);
    return res.data;
  },
});
```

**Delete Mutation**:
```typescript
const deleteMutation = useMutation({
  mutationFn: async (id: string) => {
    await api.delete(`/v1/tenant/admin/segments/${id}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['segments']);
    toast.success('Segment deleted');
  },
});
```

**UI Wireframe**:
```
┌─────────────────────────────────────────────────────────────┐
│ Segment Manager                          [+ Create Segment] │
├─────────────────────────────────────────────────────────────┤
│ Name              │ Slug          │ Status │ Packages │ ... │
├─────────────────────────────────────────────────────────────┤
│ Weekend Getaway   │ weekend-...   │ Active │ 3        │ ⚙️ │
│ Micro-Wedding     │ micro-wed...  │ Active │ 5        │ ⚙️ │
│ Wellness Retreat  │ wellness-...  │ Inactive │ 2      │ ⚙️ │
└─────────────────────────────────────────────────────────────┘
```

### Task 2: Create SegmentForm Component (40%)
**File**: `/apps/web/src/pages/admin/SegmentForm.tsx`

**Requirements**:
- Support both create and edit modes
- Form fields:
  - **slug** (required, lowercase alphanumeric + hyphens, unique per tenant)
  - **name** (required, display name)
  - **heroTitle** (required, landing page title)
  - **heroSubtitle** (optional)
  - **heroImage** (optional, URL input)
  - **description** (optional, textarea for SEO)
  - **metaTitle** (optional, max 60 chars)
  - **metaDescription** (optional, max 160 chars)
  - **sortOrder** (number, default 0)
  - **active** (boolean, checkbox, default true)
- Real-time validation with error messages
- Save button (disabled during submission)
- Cancel button
- Auto-generate slug from name (kebab-case) with manual override option
- Display character counts for SEO fields
- Modal or full-page form (recommend modal for consistency)

**Zod Validation Schema**:
```typescript
const segmentSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Lowercase alphanumeric + hyphens only'),
  name: z.string().min(1).max(100),
  heroTitle: z.string().min(1).max(200),
  heroSubtitle: z.string().max(300).optional(),
  heroImage: z.string().url().optional().or(z.literal('')),
  description: z.string().max(2000).optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
});
```

**React Hook Form Setup**:
```typescript
const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm({
  resolver: zodResolver(segmentSchema),
  defaultValues: segment || {
    slug: '',
    name: '',
    heroTitle: '',
    sortOrder: 0,
    active: true,
  },
});

// Auto-generate slug from name
const name = watch('name');
useEffect(() => {
  if (!segment && name) {
    setValue('slug', name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  }
}, [name, segment, setValue]);
```

**Create/Update Mutation**:
```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    if (segment) {
      return api.put(`/v1/tenant/admin/segments/${segment.id}`, data);
    } else {
      return api.post('/v1/tenant/admin/segments', data);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['segments']);
    toast.success(segment ? 'Segment updated' : 'Segment created');
    onClose();
  },
});
```

### Task 3: Update AdminHome to Include Segments (10%)
**File**: `/apps/web/src/pages/admin/AdminHome.tsx`

**Requirements**:
- Add "Segments" card to admin dashboard
- Display segment count as summary stat
- Link to `/admin/segments` route
- Icon: Use existing icon library (same style as Packages, Bookings)
- Position: Above or alongside Packages card

**Example Card**:
```typescript
<Card>
  <CardHeader>
    <SegmentIcon className="w-6 h-6" />
    <h3>Segments</h3>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold">{segmentCount}</p>
    <p className="text-sm text-gray-600">Business Lines</p>
    <Link to="/admin/segments">Manage Segments →</Link>
  </CardContent>
</Card>
```

### Task 4: Add Segment Selection to PackageForm (5%)
**File**: `/apps/web/src/pages/admin/PackageForm.tsx`

**Requirements**:
- Add optional "Segment" dropdown field
- Fetch active segments for dropdown options
- Allow "None" option (for non-segmented packages)
- Update package create/edit mutations to include `segmentId`
- Display current segment in edit mode

**Example**:
```typescript
<FormField label="Segment (Optional)">
  <select {...register('segmentId')}>
    <option value="">None (General Catalog)</option>
    {segments?.map(seg => (
      <option key={seg.id} value={seg.id}>{seg.name}</option>
    ))}
  </select>
</FormField>
```

### Task 5: Add Segment Selection to AddOnForm (5%)
**File**: `/apps/web/src/pages/admin/AddOnForm.tsx`

**Requirements**:
- Add optional "Segment" dropdown field
- Fetch active segments for dropdown options
- Allow "Global" option (segmentId = null, available to all segments)
- Allow segment-specific option (ties add-on to one segment)
- Update add-on create/edit mutations to include `segmentId`

**Example**:
```typescript
<FormField label="Availability">
  <select {...register('segmentId')}>
    <option value="">Global (All Segments)</option>
    {segments?.map(seg => (
      <option key={seg.id} value={seg.id}>{seg.name} only</option>
    ))}
  </select>
  <HelpText>Global add-ons are available to all segments</HelpText>
</FormField>
```

### Task 6: Add Routing for Segments (Minimal)
**File**: `/apps/web/src/App.tsx` or router config

**Requirements**:
- Add route: `/admin/segments` → `<SegmentManager />`
- Protect with admin auth guard (already exists)

### Task 7: Component Tests (Optional but Recommended)
**Files**: `*.spec.tsx` or `*.test.tsx`

**Requirements**:
- Unit tests for SegmentForm validation
- Integration tests for SegmentManager CRUD flow
- Mock API responses with MSW (Mock Service Worker)
- Test error states and loading states

## API Endpoints Reference

All endpoints already implemented in Phase 1:

### Admin Endpoints (Authenticated)
```
GET    /v1/tenant/admin/segments           # List all segments
POST   /v1/tenant/admin/segments           # Create segment
GET    /v1/tenant/admin/segments/:id       # Get segment by ID
PUT    /v1/tenant/admin/segments/:id       # Update segment
DELETE /v1/tenant/admin/segments/:id       # Delete segment
GET    /v1/tenant/admin/segments/:id/stats # Get stats (package/add-on counts)
```

### Request/Response Examples

**GET /v1/tenant/admin/segments**:
```json
[
  {
    "id": "seg_123",
    "tenantId": "tenant_456",
    "slug": "weekend-getaway",
    "name": "Weekend Getaway",
    "heroTitle": "Escape for the Weekend",
    "heroSubtitle": "Romantic retreats in nature",
    "heroImage": "https://example.com/hero.jpg",
    "description": "...",
    "metaTitle": "Weekend Getaway | Little Bit Farm",
    "metaDescription": "...",
    "sortOrder": 0,
    "active": true,
    "createdAt": "2025-01-15T...",
    "updatedAt": "2025-01-15T..."
  }
]
```

**POST /v1/tenant/admin/segments**:
```json
{
  "slug": "wellness-retreat",
  "name": "Wellness Retreats",
  "heroTitle": "Rejuvenate Your Mind & Body",
  "heroSubtitle": "Escape to nature",
  "heroImage": "https://example.com/wellness.jpg",
  "description": "Extended description for SEO",
  "metaTitle": "Wellness Retreats | Little Bit Farm",
  "metaDescription": "Discover our wellness retreat packages",
  "sortOrder": 2,
  "active": true
}
```

## Design Guidelines

### UI/UX Consistency
- Match existing admin UI style (colors, typography, spacing)
- Use same button styles as PackageManager
- Use same table layout as PackageManager
- Use same modal/form patterns as PackageForm
- Consistent error messages and loading states

### Accessibility
- Proper form labels with htmlFor
- ARIA labels for icon buttons
- Keyboard navigation support
- Focus management in modals
- Screen reader friendly error messages

### Responsive Design
- Mobile-friendly table (stack/scroll on mobile)
- Touch-friendly button sizes
- Responsive modal widths

## Technical Notes

### Axios Configuration
The frontend already has an axios instance with tenant context. Use it:
```typescript
import { api } from '@/lib/api'; // or wherever it's configured

const response = await api.get('/v1/tenant/admin/segments');
```

### Tenant Context
Tenant ID is already available in the app context:
```typescript
const { tenantId } = useTenant(); // or similar hook
```

### Toast Notifications
Use existing toast library:
```typescript
import { toast } from '@/lib/toast';

toast.success('Segment created successfully');
toast.error('Failed to create segment');
```

### Form Validation
Use React Hook Form + Zod (already in use):
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
```

## Testing Strategy

### Manual Testing Checklist
- [ ] Create segment with all fields
- [ ] Create segment with minimal fields (required only)
- [ ] Edit segment (change name, slug, status)
- [ ] Delete segment (verify packages unlinked, not deleted)
- [ ] Toggle segment active status
- [ ] Validate slug uniqueness (try duplicate slug)
- [ ] Validate slug format (try uppercase, spaces, special chars)
- [ ] Test SEO field character limits (60/160)
- [ ] Test sort order (verify list reorders)
- [ ] Test with 0 segments (empty state)
- [ ] Test with 10+ segments (scrolling/pagination if needed)
- [ ] Test error states (network failure, validation errors)
- [ ] Test loading states (slow network simulation)

### Integration Testing with Backend
1. Start backend: `npm run dev` (in `/server`)
2. Start frontend: `npm run dev` (in `/apps/web`)
3. Test CRUD operations end-to-end
4. Verify cache invalidation (create → list updates)
5. Verify multi-tenant isolation (switch tenants, verify separate data)

## Success Criteria

Phase 2 is complete when:
- [x] SegmentManager component functional (list, create, edit, delete)
- [x] SegmentForm component functional (validation, submission)
- [x] AdminHome includes Segments card with link
- [x] PackageForm has segment dropdown
- [x] AddOnForm has segment dropdown (global vs specific)
- [x] Routes configured and protected
- [x] All manual tests pass
- [x] No TypeScript errors
- [x] UI matches existing admin style

## Common Pitfalls to Avoid

1. **Slug Validation**: Don't allow uppercase or spaces in slug field
2. **Global Add-Ons**: Remember `segmentId = null` means global, not empty string
3. **Cache Invalidation**: Always invalidate queries after mutations
4. **Error Handling**: Display user-friendly error messages, not raw API errors
5. **Loading States**: Always show loading indicators during async operations
6. **Optimistic Updates**: Consider using React Query's optimistic updates for better UX
7. **Segment Deletion**: Warn user that packages will be unlinked (not deleted)
8. **SEO Fields**: Display character count and max limit for metaTitle/metaDescription

## Next Steps After Phase 2

Phase 3: Customer-Facing Routes
- Home page with segment cards
- Segment landing pages (`/segments/:slug`)
- Package detail pages with segment context
- Breadcrumb navigation

Phase 4: Analytics
- Google Analytics 4 integration
- Segment view tracking
- Package view tracking by segment

## Resources

### Existing Code References
- `/apps/web/src/pages/admin/PackageManager.tsx` - List view pattern
- `/apps/web/src/pages/admin/PackageForm.tsx` - Form pattern
- `/apps/web/src/pages/admin/AdminHome.tsx` - Dashboard pattern
- `/apps/web/src/lib/api.ts` - Axios configuration
- `/apps/web/src/hooks/useTenant.ts` - Tenant context

### Backend Documentation
- `/server/docs/phase-1-completion-report.md` - Full backend API reference
- `/server/docs/phase-1-test-verification.md` - Test coverage details
- `/server/src/validation/segment.schemas.ts` - Validation schema reference

### External Documentation
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [TanStack Query (React Query)](https://tanstack.com/query/latest)
- [React Router v6](https://reactrouter.com/)

---

**Ready to Start**: Phase 2 can begin immediately. Backend is complete and tested.
**Estimated Time**: 4-6 hours for experienced React developer
**Priority**: High (blocks Little Bit Farm onboarding)
