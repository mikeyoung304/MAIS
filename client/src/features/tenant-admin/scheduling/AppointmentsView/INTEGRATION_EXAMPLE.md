# AppointmentsView Integration Example

This document shows how to integrate the AppointmentsView component into a tenant admin dashboard page.

## Basic Integration

### Option 1: Standalone Page

Create a dedicated appointments page:

```typescript
// client/src/pages/TenantAppointmentsPage.tsx

import { AppointmentsView } from '@/features/tenant-admin/scheduling/AppointmentsView';

export function TenantAppointmentsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">My Appointments</h1>
        <p className="text-white/70 mt-2">
          View and manage your scheduled appointments
        </p>
      </div>

      <AppointmentsView />
    </div>
  );
}
```

### Option 2: Dashboard Tab/Section

Add as a tab in the existing tenant dashboard:

```typescript
// client/src/features/tenant-admin/TenantDashboard/index.tsx

import { AppointmentsView } from '@/features/tenant-admin/scheduling/AppointmentsView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TenantDashboard() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="appointments">Appointments</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        {/* Dashboard overview content */}
      </TabsContent>

      <TabsContent value="appointments">
        <AppointmentsView />
      </TabsContent>

      <TabsContent value="services">
        {/* Services content */}
      </TabsContent>
    </Tabs>
  );
}
```

## Router Integration

### React Router v6

```typescript
// client/src/App.tsx or routes config

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TenantAppointmentsPage } from '@/pages/TenantAppointmentsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/tenant/dashboard" element={<TenantDashboard />} />
        <Route path="/tenant/appointments" element={<TenantAppointmentsPage />} />
        {/* Other routes */}
      </Routes>
    </BrowserRouter>
  );
}
```

## Navigation Integration

Add to tenant admin navigation menu:

```typescript
// client/src/features/tenant-admin/TenantNav.tsx

import { Calendar, Home, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TenantNav() {
  return (
    <nav className="space-y-2">
      <Link
        to="/tenant/dashboard"
        className="flex items-center gap-2 px-4 py-2 hover:bg-macon-navy-700"
      >
        <Home className="w-5 h-5" />
        Dashboard
      </Link>

      <Link
        to="/tenant/appointments"
        className="flex items-center gap-2 px-4 py-2 hover:bg-macon-navy-700"
      >
        <Calendar className="w-5 h-5" />
        Appointments
      </Link>

      <Link
        to="/tenant/services"
        className="flex items-center gap-2 px-4 py-2 hover:bg-macon-navy-700"
      >
        <Package className="w-5 h-5" />
        Services
      </Link>
    </nav>
  );
}
```

## Authentication Guard

Protect the appointments route with authentication:

```typescript
// client/src/components/ProtectedRoute.tsx

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isTenantAdmin } = useAuth();

  if (!isAuthenticated || !isTenantAdmin) {
    return <Navigate to="/tenant/login" replace />;
  }

  return <>{children}</>;
}

// Usage in routes
<Route
  path="/tenant/appointments"
  element={
    <ProtectedRoute>
      <TenantAppointmentsPage />
    </ProtectedRoute>
  }
/>
```

## Layout Wrapper

Wrap in a consistent tenant admin layout:

```typescript
// client/src/layouts/TenantAdminLayout.tsx

import { TenantNav } from '@/features/tenant-admin/TenantNav';
import { Outlet } from 'react-router-dom';

export function TenantAdminLayout() {
  return (
    <div className="min-h-screen bg-macon-navy-900">
      <header className="bg-macon-navy-800 border-b border-white/20">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">Tenant Dashboard</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Navigation */}
          <aside className="col-span-3">
            <TenantNav />
          </aside>

          {/* Main Content */}
          <main className="col-span-9">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

// Usage
<Route element={<TenantAdminLayout />}>
  <Route path="/tenant/dashboard" element={<TenantDashboard />} />
  <Route path="/tenant/appointments" element={<TenantAppointmentsPage />} />
</Route>
```

## Complete Example

Here's a full working example with all pieces:

```typescript
// client/src/pages/TenantAppointmentsPage.tsx
import { AppointmentsView } from '@/features/tenant-admin/scheduling/AppointmentsView';
import { Calendar } from 'lucide-react';

export function TenantAppointmentsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Calendar className="w-8 h-8 text-macon-orange" />
        <div>
          <h1 className="text-3xl font-bold text-white">Appointments</h1>
          <p className="text-white/70 mt-1">
            Manage your scheduled appointments and time slots
          </p>
        </div>
      </div>

      {/* Appointments View Component */}
      <AppointmentsView />
    </div>
  );
}
```

## Testing the Integration

1. Start the development server:

   ```bash
   npm run dev:client
   ```

2. Login as a tenant admin

3. Navigate to `/tenant/appointments`

4. You should see:
   - Filter controls for status, service, and date range
   - Table with appointments showing:
     - Date/time with timezone
     - Service name
     - Client name
     - Contact info (email/phone)
     - Status badge
     - Notes

## Troubleshooting

### No appointments showing

- Check that you have TIMESLOT bookings (not DATE bookings)
- Verify the tenant admin is logged in with a valid JWT
- Check browser console for API errors
- Verify the `/v1/tenant-admin/appointments` endpoint is working

### Customer/Service names not showing

- The component gracefully handles missing customer endpoint
- Service names require the `/v1/tenant-admin/services` endpoint
- Customer details require the `/v1/tenant-admin/customers` endpoint (optional)

### Authentication errors

- Ensure `tenantToken` is stored in localStorage
- Check that JWT token is not expired
- Verify tenant admin middleware is applied to routes
