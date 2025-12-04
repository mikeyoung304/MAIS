# Agent/LLM Integration Implementation Guide

**Purpose**: Practical examples and patterns for implementing AI agents that safely interact with Elope APIs

---

## Quick Reference: Authentication Flow

### Step 1: Login (Get Token)

```bash
curl -X POST http://localhost:3001/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "photographer@example.com",
    "password": "secure_password_123"
  }'

# Response (200 OK):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Step 2: Verify Token & Get Context

```bash
curl -X GET http://localhost:3001/v1/auth/verify \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Response (200 OK) for tenant admin:
{
  "tenantId": "tenant_abc123",
  "slug": "photographer-jane",
  "email": "photographer@example.com",
  "type": "tenant"
}

# Response (200 OK) for platform admin:
{
  "userId": "admin_xyz789",
  "email": "admin@company.com",
  "role": "admin"
}
```

---

## Use Case 1: Create Package with Add-ons

### Objective

Agent helps photographer create a wedding package with 2 add-ons

### Implementation Pattern

```typescript
async function createWeddingPackage(token: string) {
  // Step 1: Create package
  const packageRes = await fetch('http://localhost:3001/v1/tenant/admin/packages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slug: 'deluxe-wedding-2025',
      title: 'Deluxe Wedding Package',
      description: 'Full day coverage with 2 photographers and engagement session',
      priceCents: 350000, // $3,500.00
    }),
  });

  if (!packageRes.ok) {
    console.error('Package creation failed:', await packageRes.json());
    throw new Error(`Failed to create package: ${packageRes.status}`);
  }

  const pkg = await packageRes.json();
  const packageId = pkg.id;
  console.log(`Created package: ${packageId}`);

  // Step 2: Create add-on 1 (Engagement Session)
  const addon1Res = await fetch(
    `http://localhost:3001/v1/tenant/admin/packages/${packageId}/addons`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Engagement Session',
        priceCents: 50000, // $500.00
      }),
    }
  );

  if (!addon1Res.ok) {
    console.error('Add-on 1 creation failed:', await addon1Res.json());
    // ⚠️ Package exists but add-on failed - need rollback strategy
    throw new Error(`Failed to create add-on: ${addon1Res.status}`);
  }

  const addon1 = await addon1Res.json();
  console.log(`Created add-on 1: ${addon1.id}`);

  // Step 3: Create add-on 2 (Bridal Party Photos)
  const addon2Res = await fetch(
    `http://localhost:3001/v1/tenant/admin/packages/${packageId}/addons`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Bridal Party Photos',
        priceCents: 75000, // $750.00
      }),
    }
  );

  if (!addon2Res.ok) {
    console.error('Add-on 2 creation failed:', await addon2Res.json());
    throw new Error(`Failed to create add-on: ${addon2Res.status}`);
  }

  const addon2 = await addon2Res.json();
  console.log(`Created add-on 2: ${addon2.id}`);

  return {
    packageId,
    addonIds: [addon1.id, addon2.id],
  };
}
```

### Error Recovery

```typescript
async function createWeddingPackageWithRollback(token: string) {
  let createdPackageId: string | null = null;
  const createdAddonIds: string[] = [];

  try {
    // Create package
    const pkg = await createPackage(token, {
      slug: 'deluxe-wedding-2025',
      title: 'Deluxe Wedding Package',
      description: 'Full day coverage',
      priceCents: 350000,
    });
    createdPackageId = pkg.id;

    // Create add-ons
    const addon1 = await createAddOn(token, pkg.id, {
      title: 'Engagement Session',
      priceCents: 50000,
    });
    createdAddonIds.push(addon1.id);

    const addon2 = await createAddOn(token, pkg.id, {
      title: 'Bridal Party Photos',
      priceCents: 75000,
    });
    createdAddonIds.push(addon2.id);

    return { packageId: pkg.id, addonIds: createdAddonIds };
  } catch (error) {
    // Rollback on error
    console.error('Operation failed, rolling back...', error);

    if (createdPackageId) {
      try {
        await deletePackage(token, createdPackageId);
        console.log(`Rolled back package: ${createdPackageId}`);
      } catch (rollbackError) {
        console.error('Rollback failed!', rollbackError);
        // Package orphaned - needs manual cleanup
      }
    }

    throw error;
  }
}
```

---

## Use Case 2: Update Pricing for Package & All Add-ons

### Objective

Agent helps photographer increase package price by 10%

### Implementation Pattern

```typescript
async function updatePackagePricing(token: string, packageId: string, percentageIncrease: number) {
  // Step 1: Get current package + add-ons
  const pkgRes = await fetch(`http://localhost:3001/v1/tenant/admin/packages`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const packages = await pkgRes.json();
  const pkg = packages.find((p: any) => p.id === packageId);

  if (!pkg) {
    throw new Error(`Package not found: ${packageId}`);
  }

  // Step 2: Calculate new prices
  const oldPackagePrice = pkg.priceCents;
  const newPackagePrice = Math.round(oldPackagePrice * (1 + percentageIncrease / 100));

  const oldAddons = pkg.photos || []; // ⚠️ API returns photos, not add-ons!
  // Need to get add-ons separately since they're not included

  // Step 3: Update package price
  const updateRes = await fetch(`http://localhost:3001/v1/tenant/admin/packages/${packageId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      priceCents: newPackagePrice,
    }),
  });

  if (!updateRes.ok) {
    throw new Error(`Failed to update package price: ${updateRes.status}`);
  }

  console.log(`Updated package price: $${oldPackagePrice / 100} → $${newPackagePrice / 100}`);

  return {
    oldPrice: oldPackagePrice,
    newPrice: newPackagePrice,
  };
}
```

### Issue: Add-ons Not Returned in Package

The package endpoint returns `photos` array but not `addOns`. Need different approach:

```typescript
async function getPackageWithAddons(token: string, packageId: string) {
  // Fetch all packages to get the one we want (not ideal but necessary)
  const res = await fetch('http://localhost:3001/v1/tenant/admin/packages', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`Failed to fetch packages`);

  const packages = await res.json();
  const pkg = packages.find((p: any) => p.id === packageId);

  if (!pkg) throw new Error(`Package ${packageId} not found`);

  // ⚠️ API doesn't return add-ons with package!
  // Add-ons must be fetched separately (not implemented in current API)
  // Workaround: Store add-on IDs in description or metadata

  return pkg;
}
```

---

## Use Case 3: Create Bulk Blackout Dates

### Objective

Agent creates unavailable dates for photographer's vacation

### Implementation Pattern

```typescript
async function createBlackoutDatesForVacation(
  token: string,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
) {
  const dates = generateDateRange(startDate, endDate);
  const reason = 'Photographer vacation - unavailable';

  const results = {
    created: [] as string[],
    failed: [] as { date: string; error: string }[],
  };

  // ⚠️ No bulk endpoint - must create individually
  for (const date of dates) {
    try {
      const res = await fetch('http://localhost:3001/v1/tenant/admin/blackouts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date,
          reason,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        results.failed.push({
          date,
          error: errorData.error || `HTTP ${res.status}`,
        });
      } else {
        results.created.push(date);
      }
    } catch (error) {
      results.failed.push({
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Rate limiting: 120 requests per 15 minutes
    // Add delay to avoid hitting limit
    await delay(500); // 500ms between requests
  }

  return results;
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const last = new Date(end);

  while (current <= last) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Expected Response

```json
{
  "created": ["2025-06-01", "2025-06-02", "2025-06-03"],
  "failed": []
}
```

---

## Use Case 4: Update Branding with Color Validation

### Objective

Agent updates photographer's brand colors

### Implementation Pattern

```typescript
async function updateBranding(token: string, colors: { primary: string; secondary: string }) {
  // Validate colors are valid 6-digit hex (required by API)
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;

  if (!hexRegex.test(colors.primary)) {
    throw new Error(
      `Invalid primary color: ${colors.primary}. Must be 6-digit hex (e.g., #FF5733)`
    );
  }

  if (!hexRegex.test(colors.secondary)) {
    throw new Error(
      `Invalid secondary color: ${colors.secondary}. Must be 6-digit hex (e.g., #3498DB)`
    );
  }

  // Update branding
  const res = await fetch('http://localhost:3001/v1/tenant/admin/branding', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Failed to update branding: ${error.error}`);
  }

  const branding = await res.json();
  return branding;
}

// Example: Convert RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
      .toUpperCase()
  );
}

// Usage
const primaryColor = rgbToHex(255, 87, 51); // #FF5733
const secondaryColor = rgbToHex(52, 152, 219); // #3498DB

await updateBranding(token, {
  primary: primaryColor,
  secondary: secondaryColor,
});
```

---

## Use Case 5: Safe Configuration Changes with Verification

### Objective

Agent makes configuration changes and verifies they were applied

### Implementation Pattern

```typescript
async function updateConfigurationWithVerification(
  token: string,
  changes: {
    packageId?: string;
    newTitle?: string;
    newPrice?: number;
    newBlackoutDates?: string[];
  }
) {
  const before = {
    package: null as any,
    blackouts: null as any[],
  };

  const after = {
    package: null as any,
    blackouts: null as any[],
  };

  try {
    // Step 1: Capture current state
    if (changes.packageId) {
      const res = await fetch('http://localhost:3001/v1/tenant/admin/packages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const packages = await res.json();
      before.package = packages.find((p: any) => p.id === changes.packageId);
    }

    const blackoutRes = await fetch('http://localhost:3001/v1/tenant/admin/blackouts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    before.blackouts = await blackoutRes.json();

    // Step 2: Apply changes
    if (changes.packageId && (changes.newTitle || changes.newPrice)) {
      await updatePackage(token, changes.packageId, {
        title: changes.newTitle,
        priceCents: changes.newPrice,
      });

      console.log(`✓ Updated package ${changes.packageId}`);
    }

    if (changes.newBlackoutDates) {
      for (const date of changes.newBlackoutDates) {
        await createBlackout(token, date);
      }

      console.log(`✓ Created ${changes.newBlackoutDates.length} blackout dates`);
    }

    // Step 3: Verify changes
    if (changes.packageId) {
      const res = await fetch('http://localhost:3001/v1/tenant/admin/packages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const packages = await res.json();
      after.package = packages.find((p: any) => p.id === changes.packageId);

      // Verify price change
      if (changes.newPrice && after.package.priceCents !== changes.newPrice) {
        throw new Error(
          `Price verification failed: expected ${changes.newPrice}, got ${after.package.priceCents}`
        );
      }
    }

    if (changes.newBlackoutDates) {
      const blackoutRes = await fetch('http://localhost:3001/v1/tenant/admin/blackouts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      after.blackouts = await blackoutRes.json();

      const createdDates = after.blackouts
        .filter((b) => changes.newBlackoutDates!.includes(b.date))
        .map((b) => b.date);

      if (createdDates.length !== changes.newBlackoutDates.length) {
        throw new Error(
          `Blackout date verification failed: created ${createdDates.length}, expected ${changes.newBlackoutDates.length}`
        );
      }
    }

    console.log('✓ All changes verified successfully');

    return {
      success: true,
      before,
      after,
      message: 'Configuration updated and verified',
    };
  } catch (error) {
    console.error('Configuration update failed:', error);

    return {
      success: false,
      before,
      after,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Configuration update failed - manual verification recommended',
    };
  }
}
```

---

## Rate Limit Handling

### Pattern: Detect and Handle Rate Limits

```typescript
async function makeRequestWithRateLimitHandling<T>(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<T> {
  let retries = 0;
  let lastError: Error | null = null;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);

      // Handle rate limit (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60s

        console.warn(
          `Rate limited (429). Waiting ${delay / 1000}s before retry ${retries + 1}/${maxRetries}...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        retries++;
        continue;
      }

      // Handle other errors
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors (400, 401, 403, 404)
      if (error instanceof TypeError) {
        throw error; // Network error
      }

      retries++;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
```

### Budget Rate Limits

```typescript
class RateLimitBudget {
  private requestsAllowed = 120; // Admin routes: 120/15min
  private windowMs = 15 * 60 * 1000;
  private requests: number[] = [];

  canMakeRequest(): boolean {
    const now = Date.now();

    // Remove old requests outside window
    this.requests = this.requests.filter((time) => now - time < this.windowMs);

    return this.requests.length < this.requestsAllowed;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter((time) => now - time < this.windowMs);
    return this.requestsAllowed - this.requests.length;
  }

  getResetTime(): Date {
    if (this.requests.length === 0) {
      return new Date();
    }

    const oldestRequest = Math.min(...this.requests);
    return new Date(oldestRequest + this.windowMs);
  }
}

// Usage
const budget = new RateLimitBudget();

async function makeRateLimitedRequest(url: string, options: RequestInit) {
  if (!budget.canMakeRequest()) {
    const resetTime = budget.getResetTime();
    throw new Error(`Rate limit budget exhausted. Reset at ${resetTime.toISOString()}`);
  }

  const response = await fetch(url, options);
  budget.recordRequest();

  console.log(`Remaining requests: ${budget.getRemainingRequests()}/120`);

  return response;
}
```

---

## Error Classification & Handling

### Pattern: Classify API Errors

```typescript
enum ErrorType {
  VALIDATION = 'VALIDATION', // 400 - Invalid input
  AUTHENTICATION = 'AUTHENTICATION', // 401 - Missing/invalid token
  FORBIDDEN = 'FORBIDDEN', // 403 - Insufficient permissions
  NOT_FOUND = 'NOT_FOUND', // 404 - Resource not found
  CONFLICT = 'CONFLICT', // 409 - Resource already exists
  RATE_LIMITED = 'RATE_LIMITED', // 429 - Too many requests
  SERVER_ERROR = 'SERVER_ERROR', // 5xx - Server error
  NETWORK_ERROR = 'NETWORK_ERROR', // Network failure
  UNKNOWN = 'UNKNOWN', // Other errors
}

interface ApiError {
  type: ErrorType;
  status: number;
  message: string;
  details?: any;
  retryable: boolean;
}

function classifyApiError(response: Response, data: any): ApiError {
  const status = response.status;

  switch (status) {
    case 400:
      return {
        type: ErrorType.VALIDATION,
        status,
        message: data.error || 'Validation failed',
        details: data.details,
        retryable: false,
      };

    case 401:
      return {
        type: ErrorType.AUTHENTICATION,
        status,
        message: data.error || 'Authentication failed',
        retryable: false,
      };

    case 403:
      return {
        type: ErrorType.FORBIDDEN,
        status,
        message: data.error || 'Forbidden',
        retryable: false,
      };

    case 404:
      return {
        type: ErrorType.NOT_FOUND,
        status,
        message: data.error || 'Not found',
        retryable: false,
      };

    case 409:
      return {
        type: ErrorType.CONFLICT,
        status,
        message: data.error || 'Conflict',
        retryable: false,
      };

    case 429:
      return {
        type: ErrorType.RATE_LIMITED,
        status,
        message: data.message || 'Rate limited',
        retryable: true,
      };

    case 500:
    case 502:
    case 503:
      return {
        type: ErrorType.SERVER_ERROR,
        status,
        message: `Server error (${status})`,
        retryable: true,
      };

    default:
      return {
        type: ErrorType.UNKNOWN,
        status,
        message: `Unknown error (${status})`,
        retryable: false,
      };
  }
}

// Usage
try {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const error = classifyApiError(response, data);

    if (error.retryable) {
      console.log(`Retryable error: ${error.message}`);
    } else {
      console.log(`Non-retryable error: ${error.message}`);
    }

    throw error;
  }
} catch (error) {
  // Handle error
}
```

---

## Key Safety Principles for Agents

### 1. Always Verify Authentication Before Operations

```typescript
async function verifyAuthBeforeOperation(token: string) {
  const res = await fetch('http://localhost:3001/v1/auth/verify', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Token expired or invalid');
  }

  return res.json();
}
```

### 2. Never Assume Success Without Verification

```typescript
// ❌ BAD: Assume operation succeeded
await fetch('/v1/tenant/admin/packages', {
  method: 'POST',
  body: JSON.stringify(packageData),
});

// ✓ GOOD: Check response and verify state
const response = await fetch('/v1/tenant/admin/packages', {
  method: 'POST',
  body: JSON.stringify(packageData),
});

if (!response.ok) {
  throw new Error(`Failed: ${response.status}`);
}

const pkg = await response.json();
console.log(`Package created: ${pkg.id}`);
```

### 3. Handle Partial Failures Gracefully

```typescript
// When operations span multiple requests, track partial success
const operations = {
  packageCreated: false,
  addonCreated: false,
  photoUploaded: false
};

try {
  // Create package
  const pkg = await createPackage(...);
  operations.packageCreated = true;

  // Create add-on
  const addon = await createAddOn(...);
  operations.addonCreated = true;

  // Upload photo
  const photo = await uploadPhoto(...);
  operations.photoUploaded = true;

  return { success: true, operations };
} catch (error) {
  // Rollback completed operations if needed
  if (operations.packageCreated) {
    await deletePackage(pkg.id);
  }

  return { success: false, operations, error };
}
```

### 4. Respect Rate Limits

```typescript
// Track requests and wait if approaching limit
const maxRequestsPerWindow = 120;
const windowMs = 15 * 60 * 1000;

async function throttledFetch(url: string, options: RequestInit) {
  while (!rateLimit.canMakeRequest()) {
    const resetTime = rateLimit.getResetTime();
    const waitMs = resetTime.getTime() - Date.now();

    console.log(`Rate limit approaching. Waiting ${waitMs}ms...`);
    await delay(Math.min(waitMs, 10000)); // Wait up to 10s
  }

  const response = await fetch(url, options);
  rateLimit.recordRequest();
  return response;
}
```

### 5. Validate Input Before Sending

```typescript
function validatePackageInput(data: any) {
  if (!data.slug || data.slug.length === 0) {
    throw new Error('slug is required');
  }

  if (!data.title || data.title.length === 0) {
    throw new Error('title is required');
  }

  if (typeof data.priceCents !== 'number' || data.priceCents < 0) {
    throw new Error('priceCents must be non-negative number');
  }

  if (data.photoUrl && !/^https?:\/\//.test(data.photoUrl)) {
    throw new Error('photoUrl must be valid HTTP(S) URL');
  }

  return data; // Valid
}
```

---

## Logging & Debugging

### Pattern: Comprehensive Request Logging

```typescript
interface RequestLog {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  success: boolean;
  error?: string;
}

const requestLogs: RequestLog[] = [];

async function loggedFetch(url: string, options: RequestInit): Promise<Response> {
  const startTime = Date.now();
  const method = options.method || 'GET';

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    requestLogs.push({
      timestamp: new Date().toISOString(),
      method,
      url,
      status: response.status,
      duration,
      success: response.ok,
    });

    if (!response.ok) {
      console.log(`[${method}] ${url} - ${response.status} (${duration}ms)`);
    }

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    requestLogs.push({
      timestamp: new Date().toISOString(),
      method,
      url,
      status: 0,
      duration,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

// Export logs for debugging
function exportRequestLog(format: 'json' | 'csv' = 'json'): string {
  if (format === 'json') {
    return JSON.stringify(requestLogs, null, 2);
  }

  // CSV format
  return [
    ['Timestamp', 'Method', 'URL', 'Status', 'Duration (ms)', 'Success'].join(','),
    ...requestLogs.map((log) =>
      [
        log.timestamp,
        log.method,
        log.url,
        log.status,
        log.duration,
        log.success ? 'Yes' : 'No',
      ].join(',')
    ),
  ].join('\n');
}
```

---

## Conclusion

**Key Takeaways for Agent Developers**:

1. **Always authenticate** before making requests
2. **Verify state** after operations using GET requests
3. **Handle rate limits** with exponential backoff
4. **Classify errors** to determine retry strategy
5. **Track partial failures** for proper rollback
6. **Validate input** before sending to API
7. **Log all operations** for debugging and audit

**Test in Mock Mode First** before using real credentials - the API includes `/v1/dev/*` endpoints for safe testing.
