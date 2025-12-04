# AppointmentsView Component

Main component for tenant admins to view and manage their scheduled appointments.

## Purpose

The AppointmentsView component allows tenant administrators to:

- View all scheduled time-slot appointments
- Filter appointments by status, service, and date range
- See enriched appointment details including customer and service information
- Sort and manage their appointment calendar

## Component Structure

```
AppointmentsView/
├── index.tsx                  # Main orchestrator component
├── AppointmentFilters.tsx     # Filter controls (status, service, date range)
├── AppointmentsList.tsx       # Table display with enriched data
├── types.ts                   # TypeScript type definitions
└── README.md                  # This file
```

## Usage

```typescript
import { AppointmentsView } from '@/features/tenant-admin/scheduling/AppointmentsView';

function TenantSchedulingPage() {
  return (
    <div>
      <h1>My Appointments</h1>
      <AppointmentsView />
    </div>
  );
}
```

## API Endpoints Used

### Primary Endpoint

- **GET** `/v1/tenant-admin/appointments`
  - Query params: `status`, `serviceId`, `startDate`, `endDate`
  - Returns: `AppointmentDto[]`
  - Requires: Tenant admin JWT token

### Enrichment Endpoints

- **GET** `/v1/tenant-admin/services`
  - Returns: `ServiceDto[]` (for displaying service names)

- **GET** `/v1/tenant-admin/customers` (optional)
  - Returns: `Customer[]` (for displaying customer details)
  - Falls back gracefully if endpoint doesn't exist

## Features

### Filtering

- **Status**: All, Pending, Confirmed, Canceled, Fulfilled
- **Service**: Filter by specific service type
- **Date Range**: Start date and end date filters

### Display Fields

- **Date/Time**: Formatted display of appointment start time with timezone
- **Service**: Service name (falls back to ID if name unavailable)
- **Client**: Customer name
- **Contact**: Email (clickable mailto) and phone (clickable tel)
- **Status**: Color-coded badge (green=confirmed, yellow=pending, red=canceled, blue=fulfilled)
- **Notes**: Appointment notes/details

### Status Badge Colors

- **PENDING**: Yellow/warning
- **CONFIRMED**: Green/success
- **CANCELED**: Red/destructive
- **FULFILLED**: Blue/info

## Data Enrichment

The component fetches three data sources and combines them:

1. **Appointments**: Core appointment data with references
2. **Services**: Service catalog to resolve service names
3. **Customers**: Customer data to resolve contact details

The enrichment happens client-side using `useMemo` to efficiently combine the data without additional API calls.

## Authentication

Requires a valid tenant admin JWT token stored in `localStorage` as `tenantToken`.

The token is automatically injected via the API client configured in `@/lib/api.ts`.

## Error Handling

- Displays error state if appointments fail to load
- Gracefully handles missing customer endpoint (optional enrichment)
- Shows loading state while fetching data
- Empty state when no appointments match filters

## State Management

Uses TanStack Query (React Query) for:

- Automatic caching of appointments, services, and customers
- Invalidation when filters change
- Loading and error states
- Background refetching

## Styling

Follows the MAIS dark navy theme:

- `bg-macon-navy-800`: Card backgrounds
- `bg-macon-navy-900`: Input backgrounds
- `border-white/20`: Subtle borders
- `text-white/90`: Primary text
- `text-white/60`: Secondary text

## Future Enhancements

Potential improvements:

1. Add export to CSV functionality
2. Add appointment detail modal/drawer
3. Add inline status updates (confirm/cancel)
4. Add sorting controls
5. Add pagination for large datasets
6. Server-side filtering instead of client-side
7. Enrich appointment data server-side (single API call)
