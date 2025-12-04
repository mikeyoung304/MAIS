# ServicesManager Integration Example

## Quick Start

### 1. Import and Use in a Page

```tsx
// In your tenant admin scheduling page (e.g., TenantSchedulingPage.tsx)
import { ServicesManager } from '@/features/tenant-admin/scheduling/ServicesManager';

export function TenantSchedulingPage() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Scheduling Services</h1>
        <p className="text-white/70">Manage your appointment types, durations, and pricing.</p>
      </div>

      <ServicesManager />
    </div>
  );
}
```

### 2. Add Route (React Router)

```tsx
// In your routes configuration
import { TenantSchedulingPage } from "@/features/tenant-admin/scheduling/TenantSchedulingPage";

// Add to your tenant admin routes
{
  path: "/tenant/scheduling/services",
  element: <TenantSchedulingPage />,
}
```

### 3. Add Navigation Link

```tsx
// In your tenant admin navigation/sidebar
<Link to="/tenant/scheduling/services" className="nav-link">
  <Calendar className="w-5 h-5" />
  Services
</Link>
```

## Complete Page Example

```tsx
import { ServicesManager } from '@/features/tenant-admin/scheduling/ServicesManager';
import { Calendar } from 'lucide-react';

export function TenantSchedulingPage() {
  return (
    <div className="min-h-screen bg-macon-navy-800">
      {/* Page Header */}
      <div className="border-b border-white/20 bg-macon-navy-900">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-macon-orange" />
            <h1 className="text-3xl font-bold text-white">Scheduling Services</h1>
          </div>
          <p className="text-white/70 text-lg">
            Create and manage appointment types for your business.
          </p>
        </div>
      </div>

      {/* Services Manager */}
      <div className="container mx-auto px-6 py-8">
        <ServicesManager />
      </div>
    </div>
  );
}
```

## With Tabs (Multiple Sections)

```tsx
import { useState } from 'react';
import { ServicesManager } from '@/features/tenant-admin/scheduling/ServicesManager';
import { AvailabilityManager } from '@/features/tenant-admin/scheduling/AvailabilityManager';
import { AppointmentsManager } from '@/features/tenant-admin/scheduling/AppointmentsManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TenantSchedulingPage() {
  return (
    <div className="min-h-screen bg-macon-navy-800 p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Scheduling</h1>

      <Tabs defaultValue="services" className="space-y-6">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <ServicesManager />
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityManager />
        </TabsContent>

        <TabsContent value="appointments">
          <AppointmentsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## Authentication Required

The component expects a tenant JWT token in localStorage (key: `tenantToken`). Make sure:

1. User is authenticated as a tenant admin
2. Token is stored in localStorage after login
3. Token is automatically included in API requests via the api client

```tsx
// Example: Protect the route
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedTenantSchedulingPage() {
  const { tenantToken } = useAuth();

  if (!tenantToken) {
    return <Navigate to="/tenant/login" />;
  }

  return <TenantSchedulingPage />;
}
```

## Customization

### Override Success Messages

```tsx
// The component uses internal success messages, but you can add
// additional handling by wrapping it:

export function CustomServicesManager() {
  const handleChange = () => {
    // Custom logic after services change
    console.log('Services updated!');
  };

  return <ServicesManager onServicesChange={handleChange} />;
}
```

### Custom Styling

The component uses the MAIS design system classes. To customize:

1. Modify the component files directly
2. Or wrap in a container with custom styles:

```tsx
<div className="custom-services-wrapper my-custom-class">
  <ServicesManager />
</div>
```

## Testing

### Manual Testing Checklist

1. Create a new service
2. Edit an existing service
3. Delete a service (verify confirmation dialog)
4. Toggle active/inactive status
5. Verify slug auto-generation
6. Test validation errors
7. Test with empty state (no services)
8. Test loading state

### API Mocking (for development)

```tsx
// Mock the API client for testing
import { api } from '@/lib/api';

// Before tests
const originalGetServices = api.tenantAdminGetServices;
api.tenantAdminGetServices = async () => ({
  status: 200,
  body: [
    {
      id: '1',
      slug: 'strategy-session',
      name: 'Strategy Session',
      // ... other fields
    },
  ],
});

// After tests
api.tenantAdminGetServices = originalGetServices;
```

## Common Issues

### 401 Unauthorized

- Ensure tenant is logged in
- Check localStorage for `tenantToken`
- Verify token is not expired

### Slug Already Exists (409 Conflict)

- Auto-generated slug may conflict with existing service
- User must manually modify the slug

### Services Not Loading

- Check browser console for API errors
- Verify backend is running
- Check network tab in DevTools

## Next Steps

After integrating ServicesManager, you may want to:

1. Create AvailabilityManager for scheduling rules
2. Create AppointmentsManager for booking management
3. Add analytics/reporting dashboard
4. Implement email notifications
5. Add calendar sync (Google Calendar, etc.)
