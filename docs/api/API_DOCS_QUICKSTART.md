# MAIS API Documentation - Quick Start Guide

## Accessing the Documentation

### Swagger UI (Interactive)

```
http://localhost:3001/api/docs
```

Use this for:

- Exploring all available endpoints
- Testing API calls directly from the browser
- Understanding request/response formats
- Testing authentication flows

### OpenAPI JSON (For Tools)

```
http://localhost:3001/api/docs/openapi.json
```

Use this for:

- Importing into Postman or Insomnia
- Generating client SDKs
- API contract validation
- Integration with other tools

## Quick Testing Guide

### 1. Start the Server

```bash
cd server
npm run dev:mock  # For testing with mock data
# or
npm run dev:real  # For testing with real services
```

### 2. Open Swagger UI

Navigate to: http://localhost:3001/api/docs

### 3. Get Your Tenant API Key

Before testing public endpoints, you need a tenant API key:

```bash
# Create a test tenant (if you haven't already)
cd server
npm run create-tenant -- \
  --name "Test Business" \
  --slug "test-business" \
  --email "test@example.com" \
  --commission 12.5

# Copy the Public Key from the output:
# Public Key: pk_live_test-business_abc123xyz...
```

### 4. Test Public Endpoints (Require X-Tenant-Key Header)

**Add Your Tenant Key to Swagger UI:**

1. Click the "Authorize" button (top right with lock icon)
2. In the "X-Tenant-Key" field, enter your public key: `pk_live_test-business_abc123xyz`
3. Click "Authorize"
4. Click "Close"

**Get All Packages:**

1. Find `GET /v1/packages`
2. Click "Try it out"
3. Click "Execute"
4. See the response below (shows only packages for your tenant)

**Check Date Availability:**

1. Find `GET /v1/availability`
2. Click "Try it out"
3. Enter a date (format: YYYY-MM-DD, e.g., 2024-06-15)
4. Click "Execute"

### 5. Test Admin Endpoints (JWT Auth Required)

Admin endpoints use JWT authentication (not X-Tenant-Key).

**Step 1: Get Authentication Token**

1. Find `POST /v1/admin/login`
2. Click "Try it out"
3. Use these credentials:
   ```json
   {
     "email": "admin@elope.example.com",
     "password": "admin123"
   }
   ```
4. Click "Execute"
5. Copy the `token` from the response

**Step 2: Add Token to Swagger UI**

1. Click the "Authorize" button (top right with lock icon)
2. In the "Bearer Auth" field, enter: `Bearer <your-token-here>`
3. Click "Authorize"
4. Click "Close"

**Step 3: Test Admin Endpoints**
Now all admin endpoints will automatically include your token. Try:

- `GET /v1/admin/bookings` - View all bookings
- `GET /v1/admin/blackouts` - View blackout dates
- `POST /v1/admin/packages` - Create a new package
- `GET /v1/admin/tenants` - View all tenants (platform admin)

## API Overview

### Multi-Tenant Authentication

MAIS is a **multi-tenant platform** supporting up to 50 independent wedding businesses. Each tenant has unique API keys:

**Public Key Format:** `pk_live_{slug}_{random}`

- Example: `pk_live_bella-weddings_7a9f3c2e1b4d8f6a`
- Safe to use in client-side code
- Required in `X-Tenant-Key` header for all public endpoints

**Secret Key Format:** `sk_live_{slug}_{random}`

- Example: `sk_live_bella-weddings_9x2k4m8p3n7q1w5z`
- Server-side only (never expose to clients)
- Used for admin operations and Stripe Connect

### Public Endpoints (Require X-Tenant-Key Header)

| Method | Endpoint              | Description                           | Auth         |
| ------ | --------------------- | ------------------------------------- | ------------ |
| GET    | /v1/packages          | List wedding packages for tenant      | X-Tenant-Key |
| GET    | /v1/packages/:slug    | Get package details for tenant        | X-Tenant-Key |
| GET    | /v1/availability      | Check if date is available for tenant | X-Tenant-Key |
| POST   | /v1/bookings/checkout | Create Stripe checkout for tenant     | X-Tenant-Key |
| GET    | /v1/bookings/:id      | Get booking details                   | X-Tenant-Key |

### Webhook Endpoints (Require Stripe Signature)

| Method | Endpoint            | Description                    | Auth             |
| ------ | ------------------- | ------------------------------ | ---------------- |
| POST   | /v1/webhooks/stripe | Handle Stripe payment webhooks | Stripe Signature |

### Admin Endpoints (Require JWT Token)

| Method | Endpoint                             | Description           | Auth         |
| ------ | ------------------------------------ | --------------------- | ------------ |
| POST   | /v1/admin/login                      | Get JWT token         | None         |
| GET    | /v1/admin/bookings                   | List all bookings     | Bearer Token |
| GET    | /v1/admin/blackouts                  | List blackout dates   | Bearer Token |
| POST   | /v1/admin/blackouts                  | Create blackout date  | Bearer Token |
| POST   | /v1/admin/packages                   | Create new package    | Bearer Token |
| PUT    | /v1/admin/packages/:id               | Update package        | Bearer Token |
| DELETE | /v1/admin/packages/:id               | Delete package        | Bearer Token |
| POST   | /v1/admin/packages/:packageId/addons | Add add-on to package | Bearer Token |
| PUT    | /v1/admin/addons/:id                 | Update add-on         | Bearer Token |
| DELETE | /v1/admin/addons/:id                 | Delete add-on         | Bearer Token |
| GET    | /v1/admin/tenants                    | List all tenants      | Bearer Token |
| POST   | /v1/admin/tenants                    | Create new tenant     | Bearer Token |
| PATCH  | /v1/admin/tenants/:id                | Update tenant         | Bearer Token |

## Common Error Responses

All errors follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human readable description"
}
```

| Status Code | Error Code           | Description                                   |
| ----------- | -------------------- | --------------------------------------------- |
| 400         | VALIDATION_ERROR     | Invalid request format or data                |
| 401         | UNAUTHORIZED         | Missing or invalid authentication token       |
| 403         | FORBIDDEN            | Insufficient permissions                      |
| 404         | NOT_FOUND            | Resource not found                            |
| 409         | CONFLICT             | Resource conflict (e.g., date already booked) |
| 422         | UNPROCESSABLE_ENTITY | Request cannot be processed                   |
| 500         | INTERNAL_ERROR       | Server error                                  |

## Rate Limits

- **Public endpoints:** 100 requests per 15 minutes per IP
- **Admin endpoints:** 20 requests per 15 minutes per IP

## Example Workflows

### Booking Flow (Customer Perspective)

All requests require `X-Tenant-Key` header with your public key:

1. **Browse packages:** `GET /v1/packages`

   ```bash
   curl -H "X-Tenant-Key: pk_live_bella-weddings_abc123" \
     http://localhost:3001/v1/packages
   ```

2. **Get package details:** `GET /v1/packages/intimate-ceremony`

   ```bash
   curl -H "X-Tenant-Key: pk_live_bella-weddings_abc123" \
     http://localhost:3001/v1/packages/intimate-ceremony
   ```

3. **Check date availability:** `GET /v1/availability?date=2024-06-15`

   ```bash
   curl -H "X-Tenant-Key: pk_live_bella-weddings_abc123" \
     "http://localhost:3001/v1/availability?date=2024-06-15"
   ```

4. **Create checkout:** `POST /v1/bookings/checkout`

   ```bash
   curl -X POST \
     -H "X-Tenant-Key: pk_live_bella-weddings_abc123" \
     -H "Content-Type: application/json" \
     -d '{
       "packageId": "pkg_123",
       "eventDate": "2024-06-15",
       "coupleName": "John & Jane Doe",
       "email": "john@example.com",
       "addOnIds": ["addon_456"]
     }' \
     http://localhost:3001/v1/bookings/checkout
   ```

5. **Redirect to Stripe:** Use `checkoutUrl` from response
6. **After payment:** Stripe webhook handles booking confirmation
7. **View confirmation:** `GET /v1/bookings/:id`
   ```bash
   curl -H "X-Tenant-Key: pk_live_bella-weddings_abc123" \
     http://localhost:3001/v1/bookings/:id
   ```

### Admin Flow (Managing Packages)

1. **Login:** `POST /v1/admin/login`
2. **View bookings:** `GET /v1/admin/bookings`
3. **Create package:** `POST /v1/admin/packages`
   ```json
   {
     "slug": "deluxe-ceremony",
     "title": "Deluxe Ceremony",
     "description": "A premium wedding experience",
     "priceCents": 250000,
     "photoUrl": "https://example.com/photo.jpg"
   }
   ```
4. **Add add-ons:** `POST /v1/admin/packages/:packageId/addons`
5. **Set blackout dates:** `POST /v1/admin/blackouts`
   ```json
   {
     "date": "2024-12-25",
     "reason": "Holiday closure"
   }
   ```

## Using with Other Tools

### Postman

1. Open Postman
2. Click "Import" > "Link"
3. Enter: `http://localhost:3001/api/docs/openapi.json`
4. Click "Import"
5. All endpoints will be imported as a collection

### Insomnia

1. Open Insomnia
2. Click "Create" > "Import From" > "URL"
3. Enter: `http://localhost:3001/api/docs/openapi.json`
4. Click "Fetch and Import"

### VS Code REST Client

Create a `.http` file:

```http
### Get all packages (requires tenant key)
GET http://localhost:3001/v1/packages
X-Tenant-Key: pk_live_test-business_abc123

### Check availability (requires tenant key)
GET http://localhost:3001/v1/availability?date=2024-06-15
X-Tenant-Key: pk_live_test-business_abc123

### Admin login
POST http://localhost:3001/v1/admin/login
Content-Type: application/json

{
  "email": "admin@elope.example.com",
  "password": "admin123"
}

### Get bookings (with JWT auth)
GET http://localhost:3001/v1/admin/bookings
Authorization: Bearer YOUR_TOKEN_HERE

### Get all tenants (platform admin)
GET http://localhost:3001/v1/admin/tenants
Authorization: Bearer YOUR_TOKEN_HERE
```

## Tips & Tricks

1. **Persistent Auth:** Swagger UI remembers your token between refreshes
2. **Filter Endpoints:** Use the search box to find specific endpoints
3. **Copy as cURL:** Each request in Swagger UI shows the equivalent cURL command
4. **Response Examples:** Click on response schemas to see example data
5. **Try Different Status Codes:** Each response status code is documented

## Need Help?

- **View full specification:** /api/docs/openapi.json
- **Interactive UI:** /api/docs
- **GitHub Issues:** Report bugs or request features
- **Email Support:** support@elope.example.com

## Development Notes

The API documentation is:

- **Auto-updating:** Restart the server to see documentation changes
- **Type-safe:** All schemas match TypeScript types
- **Comprehensive:** Includes all endpoints, errors, and examples
- **Standards-compliant:** Follows OpenAPI 3.0 specification

---

For more details, see `API_DOCUMENTATION_COMPLETION_REPORT.md`
