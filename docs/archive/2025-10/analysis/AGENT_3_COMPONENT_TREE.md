# Agent 3: Component Hierarchy

## Route Structure

```
/tenant/login
  └── TenantLogin (page)
      └── TenantLogin (component)
          └── Form with email/password

/tenant/dashboard
  └── TenantDashboard (page)
      └── TenantDashboard (component)
          ├── Header with logout
          ├── Metrics Cards (4)
          ├── Tab Navigation
          └── Tab Content:
              ├── Packages Tab
              │   └── TenantPackagesManager
              │       ├── Create Package Button
              │       ├── Package Form (when creating/editing)
              │       └── Package List with Edit/Delete
              ├── Blackouts Tab
              │   └── BlackoutsManager
              │       ├── Add Blackout Form
              │       └── Blackouts Table
              ├── Bookings Tab
              │   └── TenantBookingList
              │       ├── Filters (date range, status)
              │       ├── Export CSV Button
              │       └── Bookings Table
              └── Branding Tab
                  └── BrandingEditor
                      ├── Branding Form (colors, font, logo)
                      └── Live Preview Panel
```

## Data Flow

### Authentication Flow

```
User → TenantLogin → POST /v1/tenant/login → JWT Token
  → api.setTenantToken(token) → localStorage
  → Navigate to /tenant/dashboard
```

### Dashboard Data Flow

```
TenantDashboard (page)
  ↓
  GET /v1/tenant/info → tenantInfo
  ↓
TenantDashboard (component)
  ├── Packages Tab → GET /v1/tenant/packages
  ├── Blackouts Tab → GET /v1/tenant/blackouts
  ├── Bookings Tab → GET /v1/tenant/bookings
  └── Branding Tab → GET /v1/tenant/branding
```

### CRUD Operations

```
Packages:
  - Create: POST /v1/tenant/packages
  - Update: PUT /v1/tenant/packages/:id
  - Delete: DELETE /v1/tenant/packages/:id

Blackouts:
  - Create: POST /v1/tenant/blackouts
  - Delete: DELETE /v1/tenant/blackouts/:id

Branding:
  - Update: PUT /v1/tenant/branding
```

## Component Responsibilities

### TenantLogin Component

- Email/password form
- Loading states
- Error display
- Calls login endpoint

### TenantDashboard Component

- Tab navigation
- Metric cards
- Tab content rendering
- Data loading per tab

### TenantPackagesManager

- Package CRUD operations
- Form validation
- Success/error messages
- Package list display

### BlackoutsManager

- Add blackout dates
- Delete blackouts
- Date formatting
- Table display

### TenantBookingList

- Read-only bookings
- Filtering (date, status)
- CSV export
- Status badges

### BrandingEditor

- Color pickers
- Font selector
- Live preview
- Form validation
- Color/font application preview
