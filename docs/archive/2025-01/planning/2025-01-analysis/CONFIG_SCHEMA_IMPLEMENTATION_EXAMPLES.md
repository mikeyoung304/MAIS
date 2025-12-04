# Configuration Schema - Implementation Examples

## 1. Complete Type Definitions

### Server-Side Type Hierarchy

```typescript
// Base branding DTO (read-only response)
export const TenantBrandingDtoSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
});
export type TenantBrandingDto = z.infer<typeof TenantBrandingDtoSchema>;

// Update DTO (request body with validation)
export const UpdateBrandingDtoSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be hex color: #RRGGBB or #RGB')
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be hex color: #RRGGBB or #RGB')
    .optional(),
  fontFamily: z.string().min(1, 'Font family required').optional(),
  logo: z.string().url('Invalid URL').optional(),
});
export type UpdateBrandingDto = z.infer<typeof UpdateBrandingDtoSchema>;

// Controller layer DTO (internal use)
interface BrandingDto {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logo?: string;
}
```

### Database Model

```prisma
model Tenant {
  id   String @id @default(cuid())
  slug String @unique
  name String
  email String?

  // Branding configuration - flexible JSON schema
  branding Json @default("{}")
  // Example value:
  // {
  //   "primaryColor": "#9b87f5",
  //   "secondaryColor": "#7e69ab",
  //   "fontFamily": "Inter",
  //   "logo": "https://cdn.example.com/logo.png"
  // }

  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
}
```

---

## 2. API Contract Definition

```typescript
// From packages/contracts/src/api.v1.ts

// Public endpoint - no auth needed
getTenantBranding: {
  method: 'GET',
  path: '/v1/tenant/branding',
  responses: {
    200: TenantBrandingDtoSchema,
    // Example: { primaryColor: "#9b87f5", secondaryColor: "#7e69ab" }
  },
  summary: 'Get tenant branding for widget customization',
}

// Admin endpoints - JWT auth required
tenantGetBranding: {
  method: 'GET',
  path: '/v1/tenant/admin/branding',
  responses: {
    200: TenantBrandingDtoSchema,
  },
  summary: 'Get current branding (authenticated)',
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
    400: z.object({ error: z.string() }),
    401: z.object({ error: z.string() }),
  },
  summary: 'Update branding (authenticated)',
}
```

---

## 3. Server Implementation

### Route Handler

```typescript
// From server/src/routes/tenant-admin.routes.ts

router.get('/branding', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const tenantId = tenantAuth.tenantId; // From JWT token
    const tenant = await tenantRepository.findById(tenantId);

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
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/branding', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantAuth = res.locals.tenantAuth;
    if (!tenantAuth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const tenantId = tenantAuth.tenantId;

    // Validate request
    const schema = z.object({
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

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
      return;
    }

    // Get current tenant
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Merge updates with existing config
    const currentBranding = (tenant.branding as any) || {};
    const updatedBranding = {
      ...currentBranding,
      ...validation.data,
    };

    // Save to database
    await tenantRepository.update(tenantId, {
      branding: updatedBranding,
    });

    // Return updated config
    res.status(200).json({
      primaryColor: updatedBranding.primaryColor,
      secondaryColor: updatedBranding.secondaryColor,
      fontFamily: updatedBranding.fontFamily,
      logo: updatedBranding.logo,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Controller Layer

```typescript
// From server/src/controllers/tenant-admin.controller.ts

export class TenantAdminController {
  constructor(private readonly tenantRepo: PrismaTenantRepository) {}

  async getBranding(tenantId: string): Promise<BrandingDto> {
    const tenant = await this.tenantRepo.findById(tenantId);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
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
      throw new NotFoundError('Tenant not found');
    }

    // Merge with existing
    const currentBranding = (tenant.branding as any) || {};
    const updatedBranding = {
      ...currentBranding,
      ...data,
    };

    // Update in database
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

## 4. Client Implementation

### API Client Wrapper

```typescript
// From client/src/lib/api.ts

let tenantToken: string | null = null;

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

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${baseUrl}/v1/tenant/admin/branding`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json().catch(() => null),
  };
};
```

### React Component

```typescript
// From client/src/features/tenant-admin/BrandingEditor.tsx

interface BrandingDto {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
}

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Sans-serif)' },
  { value: 'Playfair Display', label: 'Playfair Display (Serif)' },
  { value: 'Lora', label: 'Lora (Serif)' },
];

const PRESET_COLORS = [
  { name: 'Romantic Blush', primary: '#F7C5C7', secondary: '#C9A0A4' },
  { name: 'Garden Sage', primary: '#7A9E7E', secondary: '#2C5F6F' },
  { name: 'Elegant Gold', primary: '#D4AF37', secondary: '#8B7355' },
];

export function BrandingEditor({ onBrandingChange }: Props): JSX.Element {
  const [primaryColor, setPrimaryColor] = useState('#9b87f5');
  const [secondaryColor, setSecondaryColor] = useState('#7e69ab');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    // Validate hex format
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(primaryColor)) {
      setError('Primary color must be valid hex (#RRGGBB)');
      return;
    }
    if (!hexRegex.test(secondaryColor)) {
      setError('Secondary color must be valid hex (#RRGGBB)');
      return;
    }

    setSaving(true);
    try {
      const result = await (
        api as unknown as {
          tenantUpdateBranding: (params: {
            body: {
              primaryColor?: string;
              secondaryColor?: string;
              fontFamily?: string;
            };
          }) => Promise<{ status: number }>;
        }
      ).tenantUpdateBranding({
        body: {
          primaryColor,
          secondaryColor,
          fontFamily,
        },
      });

      if (result.status === 200) {
        onBrandingChange();
      } else {
        setError('Failed to save branding');
      }
    } catch (err) {
      setError('Error saving branding');
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: typeof PRESET_COLORS[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {error && <div className="text-red-600">{error}</div>}

      <div>
        <label>Primary Color</label>
        <input
          type="color"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          className="w-16 h-10"
        />
        <input
          type="text"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          placeholder="#9b87f5"
        />
      </div>

      <div>
        <label>Secondary Color</label>
        <input
          type="color"
          value={secondaryColor}
          onChange={(e) => setSecondaryColor(e.target.value)}
          className="w-16 h-10"
        />
        <input
          type="text"
          value={secondaryColor}
          onChange={(e) => setSecondaryColor(e.target.value)}
          placeholder="#7e69ab"
        />
      </div>

      <div>
        <label>Font Family</label>
        <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => applyPreset(preset)}
            className="px-4 py-2 rounded"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <button type="submit" disabled={saving}>
        {saving ? 'Saving...' : 'Save Branding'}
      </button>
    </form>
  );
}
```

---

## 5. Error Handling Examples

### Server-Side Validation Errors

```typescript
// Request with invalid hex color
POST /v1/tenant/admin/branding
Content-Type: application/json
Authorization: Bearer <token>

{
  "primaryColor": "invalid-color",
  "secondaryColor": "#7e69ab"
}

// Response (400 Bad Request)
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_string",
      "validation": "regex",
      "message": "Must be hex color: #RRGGBB or #RGB",
      "path": ["primaryColor"]
    }
  ]
}
```

### Missing Authentication

```typescript
// Request without token
GET /v1/tenant/admin/branding

// Response (401 Unauthorized)
{
  "error": "Unauthorized: No tenant authentication"
}
```

### Cross-Tenant Access Prevention

```typescript
// Tenant A's JWT token attempting to access Tenant B's data
// The tenantId is extracted from the JWT token, not the request
// If token is for Tenant A but tries to access Tenant B's resource,
// the controller will fail the ownership check

// Controller logic:
const tenantId = JWT.decode(token).tenantId; // Always from token
const tenant = await repo.findById(tenantId); // Uses tenantId from token
// Even if URL says /tenants/other-tenant-id, we use token's tenantId
```

---

## 6. Testing Examples

### Unit Test - Validation

```typescript
import { updateBrandingSchema } from '@/validation/tenant-admin.schemas';

describe('updateBrandingSchema', () => {
  it('accepts valid hex colors', () => {
    const result = updateBrandingSchema.safeParse({
      primaryColor: '#FF5733',
      secondaryColor: '#3498DB',
    });
    expect(result.success).toBe(true);
  });

  it('accepts 3-digit hex colors', () => {
    const result = updateBrandingSchema.safeParse({
      primaryColor: '#F57',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid hex colors', () => {
    const result = updateBrandingSchema.safeParse({
      primaryColor: 'red', // Not hex
    });
    expect(result.success).toBe(false);
  });

  it('accepts partial updates', () => {
    const result = updateBrandingSchema.safeParse({
      primaryColor: '#FF5733', // Only primary, secondary is optional
    });
    expect(result.success).toBe(true);
  });

  it('requires valid URLs for logos', () => {
    const result = updateBrandingSchema.safeParse({
      logo: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});
```

### Integration Test - API

```typescript
import { api } from '@/lib/api';

describe('Branding API', () => {
  it('fetches tenant branding', async () => {
    const { status, body } = await api.tenantGetBranding();

    expect(status).toBe(200);
    expect(body).toHaveProperty('primaryColor');
    expect(body).toHaveProperty('secondaryColor');
  });

  it('updates branding successfully', async () => {
    const { status } = await api.tenantUpdateBranding({
      body: {
        primaryColor: '#FF5733',
        secondaryColor: '#3498DB',
      },
    });

    expect(status).toBe(200);

    // Verify update
    const { body } = await api.tenantGetBranding();
    expect(body.primaryColor).toBe('#FF5733');
  });

  it('rejects invalid hex colors', async () => {
    const { status } = await api.tenantUpdateBranding({
      body: {
        primaryColor: 'not-hex',
      },
    });

    expect(status).toBe(400);
  });
});
```

---

## 7. Migration Path for Extensions

### Adding `accentColor` Field

**Step 1**: Update Zod schema

```typescript
// packages/contracts/src/dto.ts
export const TenantBrandingDtoSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
  accentColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional(),
});
```

**Step 2**: Update API contract

```typescript
// packages/contracts/src/api.v1.ts
tenantUpdateBranding: {
  method: 'PUT',
  path: '/v1/tenant/admin/branding',
  body: z.object({
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    fontFamily: z.string().optional(),
    accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }),
  responses: {
    200: TenantBrandingDtoSchema,
  },
}
```

**Step 3**: No database changes needed!

```prisma
// PostgreSQL JSONB automatically handles new fields
// No migration required
// Existing records will just have accentColor: null
```

**Step 4**: Update client component

```typescript
const [accentColor, setAccentColor] = useState('#FFD700');

// ... in handleSave
await api.tenantUpdateBranding({
  body: {
    primaryColor,
    secondaryColor,
    fontFamily,
    accentColor, // New field
  },
});
```

That's it! Backward compatible, no downtime.
