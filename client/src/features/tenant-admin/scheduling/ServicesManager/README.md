# ServicesManager Component

A comprehensive service management component for tenant admins in the MAIS scheduling platform.

## Overview

The `ServicesManager` allows tenant administrators to:

- View all their scheduling services in a table
- Create new services with auto-generated slugs
- Edit existing services
- Delete services with confirmation
- Toggle active/inactive status
- See formatted durations and prices

## File Structure

```
ServicesManager/
├── index.tsx                      # Main orchestrator component
├── ServicesList.tsx               # Table display of services
├── ServiceForm.tsx                # Create/edit form
├── CreateServiceButton.tsx        # Create button component
├── DeleteConfirmationDialog.tsx   # Delete confirmation modal
├── SuccessMessage.tsx             # Success message banner
├── useServicesManager.ts          # Hook for state/API management
├── types.ts                       # TypeScript type definitions
└── README.md                      # This file
```

## Usage

```tsx
import { ServicesManager } from '@/features/tenant-admin/scheduling/ServicesManager';

function SchedulingPage() {
  return (
    <div>
      <h1>Manage Services</h1>
      <ServicesManager />
    </div>
  );
}
```

## API Endpoints

The component uses these tenant admin API endpoints:

- `GET /v1/tenant-admin/services` - List all services
- `POST /v1/tenant-admin/services` - Create new service
- `PUT /v1/tenant-admin/services/:id` - Update service
- `DELETE /v1/tenant-admin/services/:id` - Delete service

All endpoints require tenant admin authentication via JWT token.

## Features

### Auto-Slug Generation

When creating a new service, the slug is automatically generated from the name:

- Converts to lowercase
- Replaces spaces with hyphens
- Removes special characters
- Ensures format: `^[a-z0-9-]+$`

Example: "Strategy Session" → "strategy-session"

### Validation

- **Name**: Required, max 100 characters
- **Slug**: Required, lowercase alphanumeric + hyphens only, max 100 characters
- **Duration**: Required, 5-480 minutes (5 min to 8 hours)
- **Buffer**: Optional, 0-120 minutes
- **Price**: Required, 0 or greater (in cents)
- **Sort Order**: Optional, 0 or greater

### Active/Inactive Toggle

Click the status badge to quickly toggle a service's active status without editing.

### Delete Confirmation

All deletes require confirmation via AlertDialog to prevent accidental deletions.

### Success Messages

All successful operations display a 3-second success message banner.

## Component Props

### ServicesManager

No props required - fully self-contained.

### ServicesList

```typescript
interface ServicesListProps {
  services: ServiceDto[];
  onEdit: (service: ServiceDto) => void;
  onDelete: (service: ServiceDto) => void;
  onToggleActive: (service: ServiceDto) => void;
  isLoading?: boolean;
}
```

### ServiceForm

```typescript
interface ServiceFormProps {
  serviceForm: ServiceFormData;
  editingServiceId: string | null;
  isSaving: boolean;
  error: string | null;
  onFormChange: (form: ServiceFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}
```

## Service Fields

- `slug`: URL-friendly identifier (auto-generated)
- `name`: Display name
- `description`: Optional description (max 2000 chars)
- `durationMinutes`: Service duration (5-480)
- `bufferMinutes`: Buffer time after service (0-120)
- `priceCents`: Price in cents
- `timezone`: Service timezone (default: America/New_York)
- `active`: Active status (default: true)
- `sortOrder`: Display order (default: 0)

## State Management

The component uses the custom `useServicesManager` hook which handles:

- Service CRUD operations
- Form state management
- Delete confirmation dialog state
- Success/error messaging
- Auto-slug generation
- Form validation

## Styling

Uses the MAIS design system:

- `macon-navy` color palette for backgrounds
- `macon-orange` for primary actions
- `white/opacity` for text and borders
- Radix UI components for dialogs and tables
- Lucide React icons

## Error Handling

Errors are handled at multiple levels:

1. **Validation errors**: Displayed inline in the form
2. **API errors**: Displayed via toast notifications (sonner)
3. **Network errors**: Logged to console and shown via toast

## Accessibility

- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly
- Color contrast compliance

## Multi-Tenant Isolation

All API calls automatically include the tenant JWT token from localStorage. The backend ensures all operations are scoped to the authenticated tenant via middleware.
