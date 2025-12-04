# Wave 2 - God Components Identification

## Search Results

Date: 2025-11-14
Subagent: 2A - God Component Refactoring

## Components Over 300 Lines

| Rank | File                                                       | Lines | Priority | Complexity                                           |
| ---- | ---------------------------------------------------------- | ----- | -------- | ---------------------------------------------------- |
| 1    | client/src/components/PackagePhotoUploader.tsx             | 462   | HIGH     | Photo upload, grid display, delete, state management |
| 2    | client/src/features/tenant-admin/TenantPackagesManager.tsx | 425   | HIGH     | Package CRUD, form handling, list display            |
| 3    | client/src/features/admin/PackagesManager.tsx              | 411   | MEDIUM   | Admin package management                             |
| 4    | client/src/pages/Success.tsx                               | 351   | LOW      | Success page, less critical                          |
| 5    | client/src/features/admin/Dashboard.tsx                    | 343   | HIGH     | Tab management, multiple views                       |
| 6    | client/src/features/tenant-admin/BrandingEditor.tsx        | 317   | MEDIUM   | Branding customization                               |
| 7    | client/src/contexts/AuthContext.tsx                        | 303   | LOW      | Context provider, shouldn't split                    |

## Components 200-300 Lines (Watch List)

| File                                                   | Lines | Notes                   |
| ------------------------------------------------------ | ----- | ----------------------- |
| client/src/pages/admin/PlatformAdminDashboard.tsx      | 295   | Close to threshold      |
| client/src/features/tenant-admin/TenantDashboard.tsx   | 276   | Monitor for growth      |
| client/src/features/tenant-admin/TenantBookingList.tsx | 251   | Potential future target |

## Selected for Refactoring (Top 3)

### 1. PackagePhotoUploader.tsx (462 lines)

**Priority**: CRITICAL
**Responsibilities**:

- Photo upload functionality
- Photo grid display
- Delete confirmation
- State management for uploads
- Error handling

**Proposed structure**:

```
client/src/features/photos/
├── PhotoUploader.tsx (main component)
├── PhotoGrid.tsx (display grid)
├── PhotoUploadButton.tsx (upload trigger)
├── PhotoDeleteDialog.tsx (confirmation)
└── hooks/
    └── usePhotoUpload.ts (upload logic)
```

### 2. TenantPackagesManager.tsx (425 lines)

**Priority**: CRITICAL
**Responsibilities**:

- Package list display
- Package form (create/edit)
- Package deletion
- State management
- API integration

**Proposed structure**:

```
client/src/features/tenant-admin/packages/
├── TenantPackagesManager.tsx (layout)
├── PackageForm.tsx (form component)
├── PackageList.tsx (list view)
└── hooks/
    ├── usePackageForm.ts (form logic)
    └── usePackageManager.ts (state management)
```

### 3. Dashboard.tsx (343 lines)

**Priority**: HIGH
**Responsibilities**:

- Tab navigation
- Bookings view
- Blackouts view
- Packages view
- Tab state management

**Proposed structure**:

```
client/src/features/admin/dashboard/
├── DashboardLayout.tsx (main)
├── BookingsTab.tsx (bookings view)
├── BlackoutsTab.tsx (blackouts view)
├── PackagesTab.tsx (packages view)
└── hooks/
    └── useDashboardTabs.ts (tab state)
```

## Refactoring Strategy

1. Extract distinct UI sections to separate components
2. Move complex logic to custom hooks
3. Maintain backward compatibility with barrel exports
4. Update all imports after refactoring
5. Add basic tests for new components
6. Verify TypeScript compilation and functionality

## Success Metrics

- Target: Reduce each component from 300-462 lines to <150 lines main file
- Create 15-20 new focused components
- Each new file <200 lines
- All TypeScript compilation passing
- No functionality lost
