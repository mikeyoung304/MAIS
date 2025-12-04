# Stripe Connect Admin API - Phase 3 Implementation Report

## Overview

This document describes the admin API endpoints for Stripe Connect management (Phase 3). These endpoints allow platform administrators to manage Stripe Connect accounts for tenants.

## Files Created/Modified

### 1. New Files Created

#### `/Users/mikeyoung/CODING/Elope/server/src/routes/admin/stripe.routes.ts`

Admin routes for Stripe Connect management. Protected with admin authentication middleware.

**Endpoints:**

- `POST /api/v1/admin/tenants/:tenantId/stripe/connect` - Create Stripe Connect account
- `POST /api/v1/admin/tenants/:tenantId/stripe/onboarding` - Generate onboarding link
- `GET /api/v1/admin/tenants/:tenantId/stripe/status` - Check account status

**Dependencies:**

- Requires `StripeConnectService` (to be created by another agent)
- Uses Prisma for tenant validation
- Returns appropriate errors if service not available

#### `/Users/mikeyoung/CODING/Elope/server/scripts/create-tenant-with-stripe.ts`

CLI tool for creating tenants with automatic Stripe Connect setup.

**Features:**

- Creates tenant in database
- Generates API keys
- Creates Stripe Connect account
- Generates onboarding link
- Displays all credentials in one operation

### 2. Files Modified

#### `/Users/mikeyoung/CODING/Elope/packages/contracts/src/dto.ts`

Added three new DTOs for Stripe Connect:

```typescript
// Stripe Connect account info
export const StripeConnectDtoSchema = z.object({
  accountId: z.string(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
});

// Onboarding link response
export const StripeOnboardingLinkDtoSchema = z.object({
  url: z.string().url(),
  expiresAt: z.number(),
});

// Full account status with requirements
export const StripeAccountStatusDtoSchema = z.object({
  accountId: z.string(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  requirements: z.object({
    currentlyDue: z.array(z.string()),
    eventuallyDue: z.array(z.string()),
    pastDue: z.array(z.string()),
  }),
});
```

#### `/Users/mikeyoung/CODING/Elope/server/src/routes/index.ts`

Wired the new Stripe routes into the main router:

```typescript
import adminStripeRoutes from './admin/stripe.routes';

// Register admin Stripe Connect routes (Express router, not ts-rest)
app.use('/v1/admin/tenants', authMiddleware, adminStripeRoutes);
```

#### `/Users/mikeyoung/CODING/Elope/server/package.json`

Added npm script for the new CLI tool:

```json
"create-tenant-with-stripe": "tsx scripts/create-tenant-with-stripe.ts"
```

## API Endpoint Documentation

### 1. Create Stripe Connect Account

Creates a new Stripe Connect account for a tenant.

**Endpoint:** `POST /api/v1/admin/tenants/:tenantId/stripe/connect`

**Authentication:** Required (Admin Bearer token)

**Path Parameters:**

- `tenantId` (string, required) - The tenant ID

**Request Body:**

```json
{
  "country": "US", // optional, default: "US"
  "email": "owner@example.com" // optional
}
```

**Response:** `201 Created`

```json
{
  "accountId": "acct_1234567890",
  "chargesEnabled": false,
  "payoutsEnabled": false,
  "detailsSubmitted": false
}
```

**Error Responses:**

- `404 Not Found` - Tenant not found
- `400 Bad Request` - Tenant already has Stripe account
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Service error

### 2. Generate Onboarding Link

Generates a Stripe Connect onboarding link for a tenant to complete their account setup.

**Endpoint:** `POST /api/v1/admin/tenants/:tenantId/stripe/onboarding`

**Authentication:** Required (Admin Bearer token)

**Path Parameters:**

- `tenantId` (string, required) - The tenant ID

**Request Body:**

```json
{
  "refreshUrl": "https://admin.example.com/tenants/:id/stripe", // optional
  "returnUrl": "https://admin.example.com/tenants/:id/stripe/success" // optional
}
```

**Response:** `200 OK`

```json
{
  "url": "https://connect.stripe.com/setup/e/acct_1234567890/abc123...",
  "expiresAt": 1699564800
}
```

**Error Responses:**

- `404 Not Found` - Tenant not found
- `400 Bad Request` - Tenant does not have Stripe account (create one first)
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Service error

### 3. Check Account Status

Retrieves the current status of a tenant's Stripe Connect account, including any requirements.

**Endpoint:** `GET /api/v1/admin/tenants/:tenantId/stripe/status`

**Authentication:** Required (Admin Bearer token)

**Path Parameters:**

- `tenantId` (string, required) - The tenant ID

**Response:** `200 OK`

```json
{
  "accountId": "acct_1234567890",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "detailsSubmitted": true,
  "requirements": {
    "currentlyDue": [],
    "eventuallyDue": ["business_profile.url"],
    "pastDue": []
  }
}
```

**Error Responses:**

- `404 Not Found` - Tenant not found
- `400 Bad Request` - Tenant does not have Stripe account
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Service error

## CLI Script Usage

### Create Tenant with Stripe Connect

The `create-tenant-with-stripe` script automates the entire tenant creation and Stripe setup process.

**Usage:**

```bash
cd server
pnpm create-tenant-with-stripe --slug=<slug> --name=<name> [options]
```

**Options:**

- `--slug` (required) - URL-safe tenant identifier (3-50 chars, lowercase, letters/numbers/hyphens)
- `--name` (required) - Display name for tenant
- `--commission` (optional) - Platform commission percentage (0-100, default: 10.0)
- `--country` (optional) - Country code for Stripe account (default: "US")
- `--email` (optional) - Email for Stripe account notifications

**Examples:**

```bash
# Basic tenant with Stripe
pnpm create-tenant-with-stripe --slug=bellaweddings --name="Bella Weddings"

# With custom commission and email
pnpm create-tenant-with-stripe \
  --slug=acme \
  --name="ACME Events" \
  --commission=12.5 \
  --email=owner@acme.com

# International tenant
pnpm create-tenant-with-stripe \
  --slug=londonweddings \
  --name="London Weddings" \
  --country=GB \
  --email=owner@londonweddings.co.uk
```

**Output:**

The script provides detailed output including:

1. Tenant information (ID, slug, name, commission, status)
2. API keys (public and secret - SECRET SHOWN ONCE)
3. Stripe Connect account details
4. Stripe onboarding URL (expires in 1 hour)
5. Next steps and verification commands

**Important Notes:**

- The secret API key is shown only once - save it immediately
- The Stripe onboarding URL expires in 1 hour
- Complete the Stripe onboarding to enable payment processing
- Verify account status after onboarding completion

## curl Examples for Testing

### 1. Admin Login (Get Bearer Token)

First, authenticate to get an admin bearer token:

```bash
curl -X POST http://localhost:5000/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Save the token:

```bash
export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Create Stripe Connect Account

```bash
curl -X POST http://localhost:5000/v1/admin/tenants/tenant_123/stripe/connect \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "US",
    "email": "owner@example.com"
  }'
```

Response:

```json
{
  "accountId": "acct_1234567890",
  "chargesEnabled": false,
  "payoutsEnabled": false,
  "detailsSubmitted": false
}
```

### 3. Generate Onboarding Link

```bash
curl -X POST http://localhost:5000/v1/admin/tenants/tenant_123/stripe/onboarding \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshUrl": "http://localhost:3000/admin/tenants/tenant_123/stripe",
    "returnUrl": "http://localhost:3000/admin/tenants/tenant_123/stripe/success"
  }'
```

Response:

```json
{
  "url": "https://connect.stripe.com/setup/e/acct_1234567890/abc123...",
  "expiresAt": 1699564800
}
```

**Usage:**
Copy the URL and open it in a browser to complete onboarding.

### 4. Check Account Status

```bash
curl -X GET http://localhost:5000/v1/admin/tenants/tenant_123/stripe/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Response:

```json
{
  "accountId": "acct_1234567890",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "detailsSubmitted": true,
  "requirements": {
    "currentlyDue": [],
    "eventuallyDue": [],
    "pastDue": []
  }
}
```

### 5. Complete Workflow Example

```bash
#!/bin/bash

# Set your admin credentials
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"
BASE_URL="http://localhost:5000"

# 1. Login to get admin token
echo "1. Authenticating..."
TOKEN=$(curl -s -X POST $BASE_URL/v1/admin/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. Create tenant (assuming you already have the tenant ID)
TENANT_ID="tenant_123"

# 3. Create Stripe Connect account
echo -e "\n2. Creating Stripe Connect account..."
curl -X POST $BASE_URL/v1/admin/tenants/$TENANT_ID/stripe/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "US",
    "email": "owner@example.com"
  }' | jq '.'

# 4. Generate onboarding link
echo -e "\n3. Generating onboarding link..."
ONBOARDING=$(curl -s -X POST $BASE_URL/v1/admin/tenants/$TENANT_ID/stripe/onboarding \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshUrl": "http://localhost:3000/admin/tenants/'$TENANT_ID'/stripe",
    "returnUrl": "http://localhost:3000/admin/tenants/'$TENANT_ID'/stripe/success"
  }')

echo $ONBOARDING | jq '.'

ONBOARDING_URL=$(echo $ONBOARDING | jq -r '.url')
echo -e "\n⚠️  Complete onboarding at: $ONBOARDING_URL"
echo -e "\nPress Enter after completing onboarding..."
read

# 5. Check account status
echo -e "\n4. Checking account status..."
curl -s -X GET $BASE_URL/v1/admin/tenants/$TENANT_ID/stripe/status \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

## Integration Notes

### Service Dependencies

The routes expect a `StripeConnectService` class with the following methods:

```typescript
class StripeConnectService {
  constructor(prisma: PrismaClient);

  // Create a Stripe Connect account for a tenant
  async createConnectedAccount(
    tenantId: string,
    options?: { country?: string; email?: string }
  ): Promise<StripeConnectDto>;

  // Generate an onboarding link for a tenant
  async generateOnboardingLink(
    tenantId: string,
    refreshUrl?: string,
    returnUrl?: string
  ): Promise<StripeOnboardingLinkDto>;

  // Get the current status of a tenant's Stripe account
  async getAccountStatus(tenantId: string): Promise<StripeAccountStatusDto>;
}
```

**If the service is not yet created:**

- The routes will return a helpful error message
- The CLI script will exit with instructions
- No runtime errors will occur

### Authentication

All endpoints require admin authentication using the existing `authMiddleware`:

- Bearer token in `Authorization` header
- Token obtained via `/v1/admin/login`
- Middleware applied automatically via route registration

### Tenant Validation

All endpoints validate that:

1. The tenant exists in the database
2. The tenant's Stripe account state is appropriate for the operation
3. Returns clear error messages for invalid states

### Error Handling

All endpoints use the existing error handling system:

- `ValidationError` for invalid input or state
- `NotFoundError` for missing tenants
- Express error middleware handles formatting and status codes

## Testing Checklist

### Prerequisites

- [ ] StripeConnectService is implemented
- [ ] Stripe API credentials are configured
- [ ] Admin user exists in the system
- [ ] Database is migrated and running

### Manual Testing Steps

1. **Create Tenant with Stripe CLI**

   ```bash
   cd server
   pnpm create-tenant-with-stripe --slug=testcorp --name="Test Corp"
   ```

   - [ ] Verify tenant created
   - [ ] Verify API keys displayed
   - [ ] Verify Stripe account created
   - [ ] Verify onboarding URL displayed

2. **Complete Onboarding**
   - [ ] Open onboarding URL in browser
   - [ ] Complete Stripe onboarding flow
   - [ ] Verify successful completion

3. **Test API Endpoints**
   - [ ] Login and get admin token
   - [ ] Create Connect account (new tenant)
   - [ ] Generate onboarding link
   - [ ] Check account status
   - [ ] Verify error handling (invalid tenant, etc.)

4. **Verify Data**
   - [ ] Check database for Stripe account ID
   - [ ] Verify account status reflects onboarding state
   - [ ] Test with multiple tenants

## Security Considerations

1. **Authentication Required**: All endpoints require admin authentication
2. **Tenant Isolation**: Each endpoint validates tenant existence
3. **Error Messages**: Don't expose internal system details
4. **Onboarding URLs**: Expire after 1 hour (Stripe default)
5. **API Keys**: Secret key shown only once in CLI script

## Future Enhancements

1. **Webhook Integration**: Handle Stripe account.updated webhooks
2. **Batch Operations**: Create multiple accounts at once
3. **Status Dashboard**: Admin UI for monitoring all tenant accounts
4. **Automated Reminders**: Email tenants who haven't completed onboarding
5. **Account Updates**: Support updating existing Connect accounts
6. **Disconnect/Delete**: Add ability to disconnect Stripe accounts

## Troubleshooting

### "StripeConnectService not available"

**Problem:** Service not yet created
**Solution:** Wait for service implementation or create it following the interface above

### "Tenant already has Stripe account"

**Problem:** Attempting to create duplicate account
**Solution:** Use the status endpoint to check existing account, or generate new onboarding link

### "Tenant does not have Stripe account"

**Problem:** Attempting to get status/onboarding for non-existent account
**Solution:** Create Connect account first using the create endpoint

### Onboarding link expired

**Problem:** Link not used within 1 hour
**Solution:** Generate a new onboarding link using the onboarding endpoint

### "Charges not enabled" after onboarding

**Problem:** Onboarding incomplete or additional requirements pending
**Solution:** Check the requirements field in status response, complete pending requirements

## Summary

This implementation provides:

- ✅ Three admin API endpoints for Stripe Connect management
- ✅ Type-safe DTOs using Zod schemas
- ✅ CLI tool for automated tenant creation with Stripe
- ✅ Comprehensive error handling and validation
- ✅ Full integration with existing auth middleware
- ✅ Clear documentation and examples

All files follow existing patterns and conventions. The implementation is ready for the StripeConnectService to be created by another agent.
