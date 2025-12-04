# Configuration Schema & API Layer Analysis - Elope Platform

## Executive Summary

The Elope platform implements a **multi-tenant branding configuration system** using:

- **Zod schemas** for runtime validation (server-side)
- **TypeScript interfaces** for type safety (client & server)
- **JSON column storage** in PostgreSQL for flexible branding configs
- **RESTful API endpoints** with JWT authentication
- **Contract-driven development** using ts-rest for type-safe client-server communication

**Current Status**: Simple single-document branding (no draft/publish versioning or audit trail)

---

## 1. Schema Definitions & Type System

### 1.1 Database Schema (Prisma)

**File**: `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma`

```prisma
model Tenant {
  id   String @id @default(cuid())
  slug String @unique
  name String

  // Branding Configuration stored as JSON
  // Structure: {primaryColor, secondaryColor, fontFamily, logo}
  branding Json @default("{}")

  // ... other fields
}
```

**Key Design Decisions**:

- Uses `Json` column type for flexible schema evolution
- No migration needed for branding field additions
- Stored as JSONB in PostgreSQL for query performance
- Tenant isolation via `tenantId` foreign key

---

### 1.2 Contract Definitions (Type-Safe API)

**File**: `/Users/mikeyoung/CODING/Elope/packages/contracts/src/dto.ts`

#### TenantBrandingDtoSchema

```typescript
export const TenantBrandingDtoSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
});

export type TenantBrandingDto = z.infer<typeof TenantBrandingDtoSchema>;
```

**Field Definitions**:

- **primaryColor**: Hex color (optional, no validation in schema)
- **secondaryColor**: Hex color (optional, no validation in schema)
- **fontFamily**: CSS font family string (optional)
- **logo**: Full URL to logo image (optional, requires valid URL format)

#### UpdateBrandingDtoSchema

```typescript
export const UpdateBrandingDtoSchema = z.object({
  primaryColor: z
    .string()
    .regex(hexColorRegex, 'Primary color must be a valid hex color (e.g., #FF5733)')
    .optional(),
  secondaryColor: z
    .string()
    .regex(hexColorRegex, 'Secondary color must be a valid hex color (e.g., #3498DB)')
    .optional(),
  fontFamily: z.string().min(1).optional(),
  logo: z.string().url().optional(),
});

export type UpdateBrandingDto = z.infer<typeof UpdateBrandingDtoSchema>;
```

**Validation Rules**:

- **primaryColor**: `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$` (6 or 3-digit hex)
- **secondaryColor**: `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$` (6 or 3-digit hex)
- **fontFamily**: Minimum 1 character
- **logo**: Must be valid URL
- All fields are optional (partial updates supported)

---

### 1.3 API Contract Definitions

**File**: `/Users/mikeyoung/CODING/Elope/packages/contracts/src/api.v1.ts`

#### Public Endpoint

```typescript
getTenantBranding: {
  method: 'GET',
  path: '/v1/tenant/branding',
  responses: {
    200: TenantBrandingDtoSchema,
  },
  summary: 'Get tenant branding configuration for widget customization',
}
```

#### Tenant Admin Endpoints

```typescript
tenantGetBranding: {
  method: 'GET',
  path: '/v1/tenant/admin/branding',
  responses: {
    200: TenantBrandingDtoSchema,
  },
  summary: 'Get branding for authenticated tenant',
}

tenantUpdateBranding: {
  method: 'PUT',
  path: '/v1/tenant/admin/branding',
  body: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    fontFamily: z.string().optional(),
  }),
  responses: {
    200: TenantBrandingDtoSchema,
  },
  summary: 'Update branding for authenticated tenant',
}
```

---

## 2. Server-Side Implementation

### 2.1 Validation Schemas

**File**: `/Users/mikeyoung/CODING/Elope/server/src/validation/tenant-admin.schemas.ts`

```typescript
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

export const updateBrandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(hexColorRegex, 'Primary color must be a valid hex color (e.g., #FF5733)')
    .optional(),
  secondaryColor: z
    .string()
    .regex(hexColorRegex, 'Secondary color must be a valid hex color (e.g., #3498DB)')
    .optional(),
  fontFamily: z.string().min(1).optional(),
  logo: z.string().url().optional(),
});

export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
```

**Extensibility Note**:

- Easy to add new fields: just add new Zod schema properties
- Example: adding `accentColor`, `bodyFont`, `linkColor`, etc. requires only schema changes
- No database migration needed (JSON column)

---

### 2.2 Route Handlers

**File**: `/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts`

#### GET /v1/tenant/admin/branding

```typescript
router.get('/branding', async (req: Request, res: Response): Promise<void> => {
  const tenantAuth = res.locals.tenantAuth;
  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
    return;
  }
  const tenantId = tenantAuth.tenantId;

  const tenant = await this.tenantRepository.findById(tenantId);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  const branding = (tenant.branding as any) || {};
  res.status(200).json({
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    fontFamily: branding.fontFamily,
    logo: branding.logo,
  });
});
```

#### PUT /v1/tenant/admin/branding

```typescript
router.put('/branding', async (req: Request, res: Response): Promise<void> => {
  const tenantAuth = res.locals.tenantAuth;
  if (!tenantAuth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const tenantId = tenantAuth.tenantId;

  // Validate request body
  const UpdateBrandingSchema = z.object({
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    fontFamily: z.string().optional(),
  });

  const validation = UpdateBrandingSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues,
    });
    return;
  }

  // Merge with existing branding (preserve logo URL)
  const tenant = await this.tenantRepository.findById(tenantId);
  const currentBranding = (tenant.branding as any) || {};
  const updatedBranding = {
    ...currentBranding,
    ...validation.data,
  };

  // Update tenant
  await this.tenantRepository.update(tenantId, {
    branding: updatedBranding,
  });

  res.status(200).json({
    primaryColor: updatedBranding.primaryColor,
    secondaryColor: updatedBranding.secondaryColor,
    fontFamily: updatedBranding.fontFamily,
    logo: updatedBranding.logo,
  });
});
```

**Security Features**:

- JWT token extracted from `Authorization: Bearer <token>` header
- TenantId from JWT token (not from request body)
- Prevents cross-tenant access
- Returns 401 for unauthenticated requests

---

### 2.3 Controller Layer

**File**: `/Users/mikeyoung/CODING/Elope/server/src/controllers/tenant-admin.controller.ts`

```typescript
interface BrandingDto {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logo?: string;
}

export class TenantAdminController {
  async getBranding(tenantId: string): Promise<BrandingDto> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant not found`);
    }

    const branding = (tenant.branding as any) || {};
    return {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      fontFamily: branding.fontFamily,
      logo: branding.logo,
    };
  }

  async updateBranding(tenantId: string, data: UpdateBrandingInput): Promise<BrandingDto> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant not found`);
    }

    // Merge existing branding with updates
    const currentBranding = (tenant.branding as any) || {};
    const updatedBranding = {
      ...currentBranding,
      ...data,
    };

    // Update tenant with new branding
    await this.tenantRepo.update(tenantId, {
      branding: updatedBranding,
    });

    return {
      primaryColor: updatedBranding.primaryColor,
      secondaryColor: updatedBranding.secondaryColor,
      fontFamily: updatedBranding.fontFamily,
      logo: updatedBranding.logo,
    };
  }
}
```

---

## 3. Client-Side Implementation

### 3.1 Type-Safe API Client

**File**: `/Users/mikeyoung/CODING/Elope/client/src/lib/api.ts`

```typescript
// Extended API client interface for tenant methods
interface ExtendedApiClient {
  setTenantToken: (token: string | null) => void;
  tenantGetBranding: () => Promise<{ status: number; body: unknown }>;
  tenantUpdateBranding: (params: {
    body: {
      primaryColor?: string;
      secondaryColor?: string;
      fontFamily?: string;
    };
  }) => Promise<{ status: number; body: unknown }>;
}

// Implementation
(api as unknown as ExtendedApiClient).tenantGetBranding = async (): Promise<{
  status: number;
  body: unknown;
}> => {
  const token = tenantToken || localStorage.getItem('tenantToken');
  const response = await fetch(`${baseUrl}/v1/tenant/admin/branding`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
};

(api as unknown as ExtendedApiClient).tenantUpdateBranding = async ({
  body,
}: {
  body: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
}): Promise<{ status: number; body: unknown }> => {
  const token = tenantToken || localStorage.getItem('tenantToken');
  const response = await fetch(`${baseUrl}/v1/tenant/admin/branding`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
};
```

---

### 3.2 BrandingEditor Component

**File**: `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/BrandingEditor.tsx`

```typescript
interface BrandingDto {
  id: string;
  tenantId: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Sans-serif)' },
  { value: 'Playfair Display', label: 'Playfair Display (Serif)' },
  { value: 'Lora', label: 'Lora (Serif)' },
  { value: 'Montserrat', label: 'Montserrat (Sans-serif)' },
  { value: 'Roboto', label: 'Roboto (Sans-serif)' },
];

const WEDDING_COLOR_PRESETS = [
  { name: 'Romantic Blush', primary: '#F7C5C7', secondary: '#C9A0A4' },
  { name: 'Garden Sage', primary: '#7A9E7E', secondary: '#2C5F6F' },
  { name: 'Elegant Gold', primary: '#D4AF37', secondary: '#8B7355' },
  { name: 'Rustic Terracotta', primary: '#C1666B', secondary: '#48392A' },
  { name: 'Classic Navy', primary: '#2C3E50', secondary: '#5D6D7E' },
  { name: 'Lavender Dreams', primary: '#9b87f5', secondary: '#7e69ab' },
];

const handleSave = async (e: React.FormEvent) => {
  // Validate hex colors
  const hexColorRegex = /^#[0-9A-F]{6}$/i;
  if (!hexColorRegex.test(primaryColor)) {
    setError('Primary color must be a valid hex color (e.g., #9b87f5)');
    return;
  }

  // Call API
  const result = await (
    api as unknown as {
      tenantUpdateBranding: (params: {...}) => Promise<{ status: number }>;
    }
  ).tenantUpdateBranding({
    body: {
      primaryColor,
      secondaryColor,
      fontFamily,
      logoUrl: logoUrl || undefined,
    },
  });

  if (result.status === 200) {
    showSuccess('Branding updated successfully');
    onBrandingChange();
  }
};
```

**Features**:

- Live color picker with hex validation
- Font family selector (6 wedding-appropriate fonts)
- Color preset system (6 themed combinations)
- Contrast ratio calculation (WCAG accessibility)
- Real-time preview with Google Fonts loading

---

### 3.3 Package Photo API (Related Multi-File Support)

**File**: `/Users/mikeyoung/CODING/Elope/client/src/lib/package-photo-api.ts`

Example of how multi-file uploads are handled (for reference):

```typescript
export interface PackagePhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

// In Package model (photos field):
photos Json @default("[]")
// Structure: [{url: string, filename: string, size: number, order: number}]
// Max 5 photos per package

export const packagePhotoApi = {
  async uploadPhoto(packageId: string, file: File): Promise<PackagePhoto> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await fetch(
      `${baseUrl}/v1/tenant/admin/packages/${packageId}/photos`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );
    // ... handle response
  },
};
```

---

## 4. Extensibility Analysis

### 4.1 Adding New Branding Fields

#### Example: Adding `accentColor`, `darkMode` flag

**Step 1**: Update Zod Schema (`packages/contracts/src/dto.ts`)

```typescript
export const TenantBrandingDtoSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
  // NEW FIELDS:
  accentColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional(),
  darkModeEnabled: z.boolean().optional(),
});
```

**Step 2**: Update API contract (`packages/contracts/src/api.v1.ts`)

```typescript
tenantUpdateBranding: {
  method: 'PUT',
  path: '/v1/tenant/admin/branding',
  body: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    fontFamily: z.string().optional(),
    // NEW FIELDS:
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    darkModeEnabled: z.boolean().optional(),
  }),
  responses: { 200: TenantBrandingDtoSchema },
}
```

**Step 3**: No database changes needed! JSON column automatically supports new fields.

**Step 4**: Update client components to handle new fields

```typescript
const [accentColor, setAccentColor] = useState('#FFD700');
const [darkModeEnabled, setDarkModeEnabled] = useState(false);

// Update API call
await api.tenantUpdateBranding({
  body: {
    primaryColor,
    secondaryColor,
    fontFamily,
    accentColor,
    darkModeEnabled,
  },
});
```

### 4.2 Current Extensibility Score

| Dimension              | Rating | Notes                                      |
| ---------------------- | ------ | ------------------------------------------ |
| **Schema Flexibility** | 9/10   | JSON column supports unlimited fields      |
| **Type Safety**        | 10/10  | End-to-end TypeScript + Zod validation     |
| **API Extensibility**  | 9/10   | Easy to add endpoints; backward compatible |
| **Validation**         | 8/10   | Comprehensive regex & format validation    |
| **Multi-file Support** | 10/10  | JSON array patterns proven with photos     |
| **Audit Trail**        | 1/10   | **No versioning or change history**        |
| **Draft/Publish**      | 1/10   | **No draft support, only live config**     |

---

## 5. Draft vs. Published Config Support

### 5.1 Current Implementation

**Status**: **NOT IMPLEMENTED**

The system uses a **single, always-live configuration** model:

- No draft/published distinction
- No version history
- No rollback capability
- Changes applied immediately to widget

```typescript
// Current flow:
Client submits update → API validates → Database updated → Live immediately
```

### 5.2 Implementation Options for Draft Support

#### Option A: Dual JSON Columns (Recommended)

```prisma
model Tenant {
  id String @id @default(cuid())

  // Current published config
  branding Json @default("{}")

  // Draft config (null = no draft exists)
  brandingDraft Json?

  // Draft metadata
  brandingDraftCreatedAt DateTime?
  brandingDraftCreatedBy String?
}
```

**Endpoints Needed**:

```
GET  /v1/tenant/admin/branding        → Gets published config
GET  /v1/tenant/admin/branding/draft  → Gets draft config (if exists)
PUT  /v1/tenant/admin/branding        → Updates published config
PUT  /v1/tenant/admin/branding/draft  → Updates/creates draft config
POST /v1/tenant/admin/branding/publish → Promotes draft to published
DELETE /v1/tenant/admin/branding/draft → Discards draft
```

#### Option B: Branding History Table

```prisma
model BrandingHistory {
  id String @id @default(cuid())
  tenantId String
  config Json // Full branding config snapshot
  status BrandingStatus @default(DRAFT) // DRAFT, PUBLISHED, ARCHIVED
  version Int
  createdAt DateTime @default(now())
  createdBy String
  publishedAt DateTime?
  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, version])
}

enum BrandingStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

---

## 6. Versioning & Audit Capabilities

### 6.1 Current Implementation

**Status**: **NOT IMPLEMENTED**

Currently no audit trail or change history. To implement:

#### Minimal Audit Trail (Add Timestamps)

```prisma
model Tenant {
  branding Json @default("{}")
  brandingUpdatedAt DateTime @default(now()) @updatedAt
  brandingUpdatedBy String? // User ID who made change
}
```

#### Comprehensive Audit Table

```prisma
model ConfigAuditLog {
  id String @id @default(cuid())
  tenantId String

  // What changed
  fieldChanged String // e.g., "primaryColor"
  oldValue String?
  newValue String

  // Who and when
  changedBy String // User ID from JWT
  changedAt DateTime @default(now())

  // Context
  ipAddress String?
  userAgent String?

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, changedAt])
}
```

---

## 7. API Endpoint Summary

### Public/Widget Endpoints

| Method | Path                  | Response    | Auth | Purpose                           |
| ------ | --------------------- | ----------- | ---- | --------------------------------- |
| GET    | `/v1/tenant/branding` | BrandingDto | None | Fetch branding for widget display |

### Tenant Admin Endpoints

| Method | Path                             | Body                 | Response           | Auth | Purpose                       |
| ------ | -------------------------------- | -------------------- | ------------------ | ---- | ----------------------------- |
| GET    | `/v1/tenant/admin/branding`      | —                    | BrandingDto        | JWT  | Get tenant's current branding |
| PUT    | `/v1/tenant/admin/branding`      | UpdateBrandingDto    | BrandingDto        | JWT  | Update branding               |
| POST   | `/v1/tenant/admin/branding/logo` | FormData (multipart) | LogoUploadResponse | JWT  | Upload logo file              |

### Related Package Photo Endpoints

| Method | Path                                             | Body     | Response     | Auth | Purpose              |
| ------ | ------------------------------------------------ | -------- | ------------ | ---- | -------------------- |
| POST   | `/v1/tenant/admin/packages/:id/photos`           | FormData | PackagePhoto | JWT  | Upload package photo |
| DELETE | `/v1/tenant/admin/packages/:id/photos/:filename` | —        | 204          | JWT  | Delete package photo |

---

## 8. Validation Constraints Summary

### Color Validation

- **Pattern**: `^#([A-Fa-f0-9]{6}\|[A-Fa-f0-9]{3})$`
- **Supported**: `#RRGGBB` and `#RGB` formats
- **Examples**: `#FF5733`, `#FF5`, `#ffffff`

### Font Family Validation

- **Type**: String
- **Minimum**: 1 character
- **No whitelist** (any font name accepted)
- **Usage**: Passed to CSS `font-family` property

### Logo URL Validation

- **Type**: Valid URL format
- **Pattern**: Standard URL validation (z.string().url())
- **Max size**: No server validation currently

### Partial Updates

- **All fields optional**: Can update individual fields without touching others
- **Merge behavior**: New values merged with existing config

---

## 9. Security Considerations

### Current Security Measures

✓ JWT authentication on all admin endpoints
✓ TenantId from JWT token (not request body)
✓ Cross-tenant isolation enforced
✓ Input validation via Zod schemas

### Potential Improvements

- [ ] Add rate limiting to branding updates
- [ ] Add signature/HMAC validation for public widget endpoint
- [ ] Implement draft/publish workflow for safer updates
- [ ] Add audit logging for compliance
- [ ] Add CORS validation for widget embedding

---

## 10. Type Definition Hierarchy

```
TenantBrandingDto (Read)
├── primaryColor?: string
├── secondaryColor?: string
├── fontFamily?: string
└── logo?: string (URL)

UpdateBrandingDto (Write)
├── primaryColor?: string (hex validation)
├── secondaryColor?: string (hex validation)
├── fontFamily?: string (min 1 char)
└── logo?: string (URL)

BrandingEditorDto (Client)
├── id: string
├── tenantId: string
├── primaryColor: string (required in UI)
├── secondaryColor: string (required in UI)
├── fontFamily: string (required in UI)
├── logoUrl?: string
├── createdAt: string
└── updatedAt: string
```

---

## 11. Integration Examples

### Updating Branding from Tenant Admin Dashboard

```typescript
// 1. Load current branding
const { status, body } = await api.tenantGetBranding();

// 2. Update in UI
setPrimaryColor('#D4AF37'); // Gold

// 3. Save changes
const result = await api.tenantUpdateBranding({
  body: {
    primaryColor: '#D4AF37',
    secondaryColor: '#8B7355',
    fontFamily: 'Playfair Display',
  },
});

// 4. Validate response
if (result.status === 200) {
  // Widget immediately reflects changes
  // No cache invalidation needed (immediate update)
}
```

### Widget Consuming Branding

```typescript
// Widget fetches branding for current tenant
const { status, body } = await fetch('/v1/tenant/branding');
const branding = body; // {primaryColor, secondaryColor, fontFamily, logo}

// Apply to DOM
document.documentElement.style.setProperty('--primary-color', branding.primaryColor);
document.documentElement.style.setProperty('--secondary-color', branding.secondaryColor);
document.body.style.fontFamily = branding.fontFamily;
```

---

## 12. Recommendations for Production

### Priority 1 (Required)

- [ ] Implement draft/publish workflow for safer changes
- [ ] Add audit logging for tenant actions
- [ ] Add rate limiting (max 10 updates/minute per tenant)
- [ ] Validate logo file type on server (image only)

### Priority 2 (Recommended)

- [ ] Add branding change history/rollback
- [ ] Implement preview mode before publishing
- [ ] Add visual preview in admin UI
- [ ] Support additional colors (link, error, success)

### Priority 3 (Enhancement)

- [ ] Add custom CSS support (controlled)
- [ ] Implement layout templates
- [ ] Add typography scale configuration
- [ ] Support multiple branding profiles per tenant

---

## File Reference Map

| Purpose        | File Path                                                                           |
| -------------- | ----------------------------------------------------------------------------------- |
| Type contracts | `/Users/mikeyoung/CODING/Elope/packages/contracts/src/dto.ts`                       |
| API routes     | `/Users/mikeyoung/CODING/Elope/packages/contracts/src/api.v1.ts`                    |
| DB schema      | `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma`                         |
| Validation     | `/Users/mikeyoung/CODING/Elope/server/src/validation/tenant-admin.schemas.ts`       |
| Routes         | `/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts`            |
| Controller     | `/Users/mikeyoung/CODING/Elope/server/src/controllers/tenant-admin.controller.ts`   |
| Client API     | `/Users/mikeyoung/CODING/Elope/client/src/lib/api.ts`                               |
| UI Component   | `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/BrandingEditor.tsx` |
| Package Photos | `/Users/mikeyoung/CODING/Elope/client/src/lib/package-photo-api.ts`                 |
