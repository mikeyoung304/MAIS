# Config-Driven, Agent-Powered Widget Platform: Master Analysis (Part 2)

## Part 1 Continued: Directed Discovery (Questions 8-15)

### 8. Frontend State Management

**How does the widget handle real-time config changes? Hot-reload support?**

**Finding:** State management is **WELL-DESIGNED** but requires full page refresh for config changes (7.5/10).

**State Management Architecture:**

```
┌────────────────────────────────────────────────────────────┐
│                    React Query (Global)                    │
│  client/src/lib/queryClient.ts                             │
│                                                             │
│  - Server state caching (5-15 min stale times)             │
│  - Automatic refetching on window focus                    │
│  - Background updates                                      │
│  - Request deduplication                                   │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│                    AuthContext (Global)                    │
│  client/src/contexts/AuthContext.tsx                       │
│                                                             │
│  - JWT token management                                    │
│  - User role/tenant information                            │
│  - Auto-expiry checking (every 5 seconds)                  │
│  - Login/logout state                                      │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│              Branding Hook (Widget-specific)               │
│  client/src/hooks/useBranding.ts                           │
│                                                             │
│  - Fetches branding on mount                               │
│  - Applies CSS variables to document root                  │
│  - Loads Google Fonts dynamically                          │
│  - Injects custom CSS                                      │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│              Custom Hooks (Feature-specific)               │
│  client/src/features/catalog/hooks.ts                      │
│                                                             │
│  - usePackages() - Fetches packages with React Query       │
│  - usePackage(slug) - Fetches single package               │
│  - useAddOns() - Fetches add-ons for package               │
└────────────────────────────────────────────────────────────┘
```

**React Query Configuration** (`client/src/lib/queryClient.ts:6-20`):

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
      refetchOnWindowFocus: true, // ✅ Auto-refetch on tab focus
      refetchOnReconnect: true, // ✅ Auto-refetch on reconnect
      retry: 1, // Retry failed requests once
    },
  },
});
```

**Branding State Flow:**

**Step 1: Initial Load** (`client/src/widget/WidgetApp.tsx:50-62`)

```typescript
const { data: branding, isLoading: brandingLoading } = useQuery<TenantBrandingDto>({
  queryKey: ['tenant', 'branding', config.tenant],
  queryFn: () => {
    // TODO: Currently returns hardcoded defaults
    return Promise.resolve({
      primaryColor: '#7C3AED',
      secondaryColor: '#DDD6FE',
      fontFamily: 'Inter, system-ui, sans-serif',
    });
  },
});
```

**Step 2: Apply Branding** (`client/src/widget/WidgetApp.tsx:64-96`)

```typescript
useEffect(() => {
  if (branding) {
    const root = document.documentElement;

    // Set CSS variables
    if (branding.primaryColor) {
      root.style.setProperty('--primary-color', branding.primaryColor);
    }
    if (branding.secondaryColor) {
      root.style.setProperty('--secondary-color', branding.secondaryColor);
    }
    if (branding.fontFamily) {
      root.style.setProperty('--font-family', branding.fontFamily);
      loadGoogleFont(branding.fontFamily); // Dynamic font loading
    }

    // Inject custom CSS
    if (branding.customCss) {
      const styleEl = document.createElement('style');
      styleEl.id = 'tenant-custom-css';
      styleEl.textContent = branding.customCss;
      document.head.appendChild(styleEl);

      return () => {
        // Cleanup on unmount
        const existingStyle = document.getElementById('tenant-custom-css');
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }
}, [branding]); // ← Re-runs when branding changes
```

**Real-Time Config Changes:**

**Current Behavior:**

1. Admin updates branding via `PUT /v1/tenant/admin/branding`
2. Server updates database immediately
3. Widget React Query cache is stale for 5 minutes
4. **User must refresh page** to see changes

**Why No Hot-Reload:**

- React Query uses `staleTime: 5 * 60 * 1000` (5 minutes)
- Widget doesn't poll for changes
- No WebSocket or Server-Sent Events (SSE)
- No "invalidate cache" notification mechanism

**How to Implement Hot-Reload:**

**Option 1: Reduce Stale Time (Quick Fix)**

```typescript
// In widget-main.tsx or WidgetApp.tsx
const { data: branding } = useQuery<TenantBrandingDto>({
  queryKey: ['tenant', 'branding', config.tenant],
  queryFn: () => api.tenant.branding.get(),
  staleTime: 30 * 1000, // ← 30 seconds instead of 5 minutes
  refetchInterval: 30 * 1000, // ← Poll every 30 seconds
});
```

**Pros:** Simple, no backend changes
**Cons:** Unnecessary API calls, 30-second delay

**Option 2: postMessage from Parent (Better)**

```typescript
// Parent site notifies widget of branding changes
window.MAISWidget.updateBranding({
  primaryColor: '#FF0000',
});

// Widget listens for postMessage
window.addEventListener('message', (event) => {
  if (event.data.type === 'UPDATE_BRANDING') {
    queryClient.invalidateQueries(['tenant', 'branding', config.tenant]);
    // React Query refetches automatically
  }
});
```

**Pros:** Instant updates, controlled by parent
**Cons:** Parent must know when branding changes

**Option 3: WebSocket Connection (Best)**

```typescript
// Backend sends real-time updates
const socket = new WebSocket(`wss://api.elope.com/tenant/${tenantId}/live`);

socket.onmessage = (event) => {
  const update = JSON.parse(event.data);

  if (update.type === 'branding.updated') {
    // Invalidate React Query cache
    queryClient.invalidateQueries(['tenant', 'branding', tenantId]);
  }
};
```

**Pros:** True real-time, scalable
**Cons:** Requires WebSocket infrastructure

**React Context Usage:**

**AuthContext** (`client/src/contexts/AuthContext.tsx:36-150`)

```typescript
interface AuthContextValue {
  token: string | null;
  role: UserRole | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('authToken');
  });

  const [role, setRole] = useState<UserRole | null>(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    const decoded = jwtDecode<DecodedToken>(token);
    return decoded.role;
  });

  // ✅ Auto-expiry checking
  useEffect(() => {
    const interval = setInterval(() => {
      if (token && isTokenExpired(token)) {
        logout();  // Auto-logout when token expires
      }
    }, 5000);  // Check every 5 seconds

    return () => clearInterval(interval);
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await api.auth.login({ body: { email, password } });
    const { token: newToken } = response;

    localStorage.setItem('authToken', newToken);
    setToken(newToken);

    const decoded = jwtDecode<DecodedToken>(newToken);
    setRole(decoded.role);
    setTenantId(decoded.tenantId);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setRole(null);
    setTenantId(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, tenantId, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Global Stores:** ❌ None

- No Redux
- No Zustand
- No MobX
- State is entirely React Query + Context

**Subscriptions:** ❌ None

- No WebSocket subscriptions
- No Server-Sent Events
- No polling (except React Query's optional refetchInterval)

**Config Change Scenarios:**

**Scenario 1: Admin Changes Widget Color**

```
1. Admin: PUT /v1/tenant/admin/branding { primaryColor: '#FF0000' }
2. Server: Updates Tenant.branding immediately
3. Widget: Still shows old color (cached for 5 minutes)
4. After 5 minutes: Widget refetches on next window focus
5. Widget: Applies new color via useEffect
```

**Current Latency:** 0-5 minutes (depends on when user next focuses window)

**Scenario 2: Admin Creates New Package**

```
1. Admin: POST /v1/tenant/admin/packages { ... }
2. Server: Creates package immediately
3. Widget: Still shows old package list (cached for 5 minutes)
4. After 5 minutes: Widget refetches on next window focus
5. Widget: Displays new package
```

**Current Latency:** 0-5 minutes

**Hot-Reload Assessment:**

| Feature             | Current Support   | Latency | Notes                 |
| ------------------- | ----------------- | ------- | --------------------- |
| Branding changes    | ⚠️ Manual refresh | 0-5 min | React Query cache     |
| Package changes     | ⚠️ Manual refresh | 0-5 min | React Query cache     |
| Add-on changes      | ⚠️ Manual refresh | 0-5 min | React Query cache     |
| Layout changes      | ❌ Not supported  | N/A     | Hard-coded components |
| Theme preset switch | ❌ Not supported  | N/A     | No templates exist    |

**Recommendations:**

1. **Quick Fix (1 hour):** Reduce staleTime to 30 seconds for widget queries
2. **Better (4 hours):** Add postMessage API for parent to trigger cache invalidation
3. **Best (2-3 days):** Implement WebSocket connection for real-time updates
4. **Long-term (1 week):** Add admin preview mode with instant updates

---

### 9. Theme Generation & Ingestion

**Code to parse external sources? Color extraction?**

**Finding:** **MINIMAL CAPABILITIES** - Manual input only, no AI/automated generation (4/10).

**Current Theme Capabilities:**

**1. Manual Color Selection** (`client/src/components/ColorPicker.tsx:1-89`)

```typescript
// Basic color input with validation
export const ColorPicker = ({ value, onChange, label }: Props) => {
  const [localValue, setLocalValue] = useState(value || '#000000');
  const [error, setError] = useState<string | null>(null);

  const validateColor = (color: string): boolean => {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setLocalValue(newColor);

    if (validateColor(newColor)) {
      setError(null);
      onChange(newColor);
    } else {
      setError('Invalid hex color format');
    }
  };

  return (
    <div>
      <label>{label}</label>
      <input
        type="color"               // ← Browser native color picker
        value={localValue}
        onChange={handleChange}
      />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder="#RRGGBB"
      />
      {error && <span className="error">{error}</span>}
    </div>
  );
};
```

**Features:**

- ✅ Browser native color picker
- ✅ Hex validation
- ✅ Manual text input
- ❌ No color palette generation
- ❌ No complementary color suggestions
- ❌ No contrast checking (except basic WCAG notes in BrandingEditor)

**2. Manual Font Selection** (`client/src/components/FontSelector.tsx:1-92`)

```typescript
const SUPPORTED_FONTS = [
  'Inter',
  'Playfair Display',
  'Lora',
  'Montserrat',
  'Cormorant Garamond',
  'Raleway',
  'Crimson Text',
  'Poppins',
];

export const FontSelector = ({ value, onChange }: Props) => {
  const [selectedFont, setSelectedFont] = useState(value || 'Inter');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFont = e.target.value;
    setSelectedFont(newFont);
    onChange(newFont);
    loadGoogleFont(newFont);  // ← Dynamic font loading
  };

  return (
    <select value={selectedFont} onChange={handleChange}>
      {SUPPORTED_FONTS.map((font) => (
        <option key={font} value={font} style={{ fontFamily: font }}>
          {font}
        </option>
      ))}
    </select>
  );
};
```

**Features:**

- ✅ 8 curated wedding fonts
- ✅ Live preview in dropdown
- ✅ Dynamic Google Font loading
- ❌ No font pairing recommendations
- ❌ No AI-generated suggestions
- ❌ No upload custom fonts

**3. Preset Colors** (`client/src/features/tenant-admin/BrandingEditor.tsx:25-42`)

```typescript
const COLOR_PRESETS = [
  { name: 'Elegant Purple', primary: '#7C3AED', secondary: '#DDD6FE' },
  { name: 'Romantic Rose', primary: '#F43F5E', secondary: '#FED7E2' },
  { name: 'Classic Navy', primary: '#1E3A8A', secondary: '#BFDBFE' },
  { name: 'Garden Green', primary: '#059669', secondary: '#D1FAE5' },
  { name: 'Sunset Orange', primary: '#EA580C', secondary: '#FED7AA' },
  { name: 'Lavender Dream', primary: '#8B5CF6', secondary: '#E9D5FF' },
];

// User clicks preset button
const applyPreset = (preset: ColorPreset) => {
  setFormState({
    ...formState,
    primaryColor: preset.primary,
    secondaryColor: preset.secondary,
  });
};
```

**Features:**

- ✅ 6 curated wedding color schemes
- ✅ One-click application
- ❌ No palette generation from base color
- ❌ No analogous/complementary/triadic schemes

**External Source Parsing:**

**CSS Parsing:** ❌ Not Implemented

```typescript
// Doesn't exist, but would look like:
function parseCssColors(cssText: string): string[] {
  const colorRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g;
  return cssText.match(colorRegex) || [];
}
```

**Screenshot Color Extraction:** ❌ Not Implemented

```typescript
// Doesn't exist, but would look like:
async function extractColorsFromImage(imageUrl: string): Promise<string[]> {
  const response = await fetch('/api/extract-colors', {
    method: 'POST',
    body: JSON.stringify({ imageUrl }),
  });
  return response.json(); // Returns palette
}
```

**Design Token Import:** ❌ Not Implemented

```typescript
// Doesn't exist, but would look like:
interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  typography: {
    fontFamily: string;
    scale: { h1: number; h2: number; ... };
  };
}

function importDesignTokens(tokens: DesignTokens): TenantBrandingDto {
  return {
    primaryColor: tokens.colors.primary,
    secondaryColor: tokens.colors.secondary,
    fontFamily: tokens.typography.fontFamily,
  };
}
```

**Image Processing:**

**Logo Upload** (`server/src/services/upload.service.ts:1-150`)

```typescript
class UploadService {
  async uploadFile(
    file: Express.Multer.File,
    folder: string
  ): Promise<{ url: string; filename: string }> {
    // ✅ Supports image upload (JPG, PNG, WebP, SVG)
    // ✅ File validation (size, type)
    // ❌ NO color extraction from uploaded images
    // ❌ NO image analysis (dominant colors, palette)

    const filename = `${folder}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(this.uploadDir, folder, filename);

    // Write file to disk
    await fs.promises.writeFile(filepath, file.buffer);

    return {
      url: `/uploads/${folder}/${filename}`,
      filename,
    };
  }
}
```

**Features:**

- ✅ File upload (logo)
- ✅ File type validation
- ✅ Size validation (5MB max)
- ❌ NO color extraction from logo
- ❌ NO palette generation from logo
- ❌ NO image dominant color detection

**Theme Template System:**

❌ **Not Implemented** - No database-backed templates

```prisma
// Doesn't exist, but would look like:
model ThemeTemplate {
  id          String @id @default(cuid())
  name        String
  description String
  preview     String  // Screenshot URL
  config      Json    // TenantBrandingDto

  // Example configs:
  // "Elegant": { primaryColor: '#7C3AED', fontFamily: 'Playfair Display', ... }
  // "Modern": { primaryColor: '#1E3A8A', fontFamily: 'Inter', ... }
  // "Rustic": { primaryColor: '#A16207', fontFamily: 'Lora', ... }
}
```

**Where to Insert AI Capabilities:**

**1. Backend API Route** (Create new file: `server/src/routes/theme-generation.routes.ts`)

```typescript
router.post('/v1/tenant/admin/branding/generate', async (req, res) => {
  const { sourceType, sourceData } = req.body;
  // sourceType: 'color' | 'image' | 'url' | 'description'
  // sourceData: hex color | image URL | website URL | text prompt

  const generated = await themeGenerationService.generate(sourceType, sourceData);

  res.json(generated);
});
```

**2. Theme Generation Service** (Create new file: `server/src/services/theme-generation.service.ts`)

```typescript
class ThemeGenerationService {
  async generateFromColor(baseColor: string): Promise<TenantBrandingDto> {
    // Use color theory to generate palette
    const palette = this.generatePalette(baseColor);

    return {
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      // ... other fields
    };
  }

  async generateFromImage(imageUrl: string): Promise<TenantBrandingDto> {
    // Extract colors from image
    const colors = await this.extractColors(imageUrl);

    return {
      primaryColor: colors[0],
      secondaryColor: colors[1],
      // ... other fields
    };
  }

  async generateFromPrompt(prompt: string): Promise<TenantBrandingDto> {
    // Use LLM to generate theme
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a wedding theme designer. Generate branding configs.',
        },
        { role: 'user', content: prompt },
      ],
    });

    return JSON.parse(response.choices[0].message.content);
  }

  private generatePalette(baseColor: string): Palette {
    // Color theory algorithms
    // - Complementary
    // - Analogous
    // - Triadic
    // - Split-complementary
  }

  private async extractColors(imageUrl: string): Promise<string[]> {
    // Use sharp + vibrant.js
    const image = await sharp(imageUrl).toBuffer();
    const palette = await Vibrant.from(image).getPalette();

    return [
      palette.Vibrant?.getHex() || '#000000',
      palette.LightVibrant?.getHex() || '#FFFFFF',
      // ... more colors
    ];
  }
}
```

**3. Frontend Component** (Create new file: `client/src/features/tenant-admin/AIThemeGenerator.tsx`)

```typescript
export const AIThemeGenerator = ({ onGenerate }: Props) => {
  const [mode, setMode] = useState<'color' | 'image' | 'description'>('color');
  const [input, setInput] = useState('');

  const generateTheme = async () => {
    const response = await api.tenant.admin.branding.generate({
      body: { sourceType: mode, sourceData: input },
    });

    onGenerate(response);
  };

  return (
    <div>
      <h3>AI Theme Generator</h3>

      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="color">From Color</option>
        <option value="image">From Image</option>
        <option value="description">From Description</option>
      </select>

      {mode === 'color' && (
        <input
          type="color"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      )}

      {mode === 'image' && (
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            // Upload image, get URL, set as input
          }}
        />
      )}

      {mode === 'description' && (
        <textarea
          placeholder="Describe your wedding theme (e.g., 'Elegant garden wedding with lavender and gold')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      )}

      <button onClick={generateTheme}>Generate Theme</button>
    </div>
  );
};
```

**4. Color Utilities** (Create new directory: `server/src/lib/color-utils/`)

```typescript
// color-theory.ts
export function generateComplementary(hex: string): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  hsl.h = (hsl.h + 180) % 360; // Complementary = opposite on color wheel
  return hslToHex(hsl);
}

export function generateAnalogous(hex: string): string[] {
  const hsl = hexToHsl(hex);
  return [
    hslToHex({ h: (hsl.h - 30) % 360, s: hsl.s, l: hsl.l }),
    hslToHex({ h: hsl.h, s: hsl.s, l: hsl.l }),
    hslToHex({ h: (hsl.h + 30) % 360, s: hsl.s, l: hsl.l }),
  ];
}

export function generateTriadic(hex: string): string[] {
  const hsl = hexToHsl(hex);
  return [
    hslToHex({ h: hsl.h, s: hsl.s, l: hsl.l }),
    hslToHex({ h: (hsl.h + 120) % 360, s: hsl.s, l: hsl.l }),
    hslToHex({ h: (hsl.h + 240) % 360, s: hsl.s, l: hsl.l }),
  ];
}

// wcag-contrast.ts
export function calculateContrast(color1: string, color2: string): number {
  const lum1 = relativeLuminance(color1);
  const lum2 = relativeLuminance(color2);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (brighter + 0.05) / (darker + 0.05);
}

export function meetsWCAG_AA(contrast: number): boolean {
  return contrast >= 4.5; // WCAG AA standard
}

export function meetsWCAG_AAA(contrast: number): boolean {
  return contrast >= 7.0; // WCAG AAA standard
}
```

**Dependencies to Install:**

```bash
npm install --save sharp vibrant
npm install --save-dev @types/sharp

# Or use color-thief-node for color extraction
npm install color-thief-node
```

**Implementation Timeline:**

**Phase 1: Foundation (4 hours)**

- Install sharp, Vibrant.js
- Create color utility functions
- Add color theory algorithms (complementary, analogous, triadic)

**Phase 2: Image Processing (6 hours)**

- Implement color extraction from uploaded images
- Add palette generation from logo
- Create API endpoint for color extraction

**Phase 3: API Routes (4 hours)**

- Add POST /v1/tenant/admin/branding/generate
- Add validation for generation requests
- Add rate limiting (expensive operations)

**Phase 4: Frontend Component (8 hours)**

- Build AIThemeGenerator React component
- Add UI for color/image/description input
- Add preview of generated themes
- Add "Apply Theme" button

**Phase 5: Enhancements (8-12 hours)**

- Add font pairing recommendations
- Add template system (database-backed)
- Add export/import for themes
- Add LLM integration for description-based generation

**Total Effort:** 30-34 hours (1 week for one developer)

**Recommendations:**

1. **Phase 1:** Start with color theory utilities (quick win)
2. **Phase 2:** Add image color extraction (high impact)
3. **Phase 3:** Integrate LLM for description-based generation
4. **Phase 4:** Build comprehensive template library
5. **Phase 5:** Add real-time preview and A/B testing

---

### 10. Audit Logging & History

**Are actions logged with user, timestamp, before/after state?**

**Finding:** **CRITICAL GAP** - NO AUDIT LOGGING EXISTS (0/10).

**Current State:**

❌ **No AuditLog Table:**

```prisma
// Doesn't exist in schema.prisma
model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String   // Who made the change
  action    String   // e.g., "branding.update", "package.create"
  resource  String   // e.g., "branding", "package:abc123"
  before    Json?    // State before change
  after     Json?    // State after change
  timestamp DateTime @default(now())
  ipAddress String?
  userAgent String?

  @@index([tenantId, timestamp])
  @@index([userId])
  @@index([action])
}
```

❌ **No Logging Service:**

```typescript
// Doesn't exist
class AuditLogService {
  async log(entry: AuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: entry,
    });
  }

  async getHistory(
    tenantId: string,
    filters?: { action?: string; userId?: string; since?: Date }
  ): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: {
        tenantId,
        ...filters,
      },
      orderBy: { timestamp: 'desc' },
    });
  }
}
```

❌ **No Middleware:**

```typescript
// Doesn't exist
export const auditMiddleware = (action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const before = await fetchCurrentState(req);

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const after = await fetchCurrentState(req);

        await auditLogService.log({
          tenantId: req.user!.tenantId,
          userId: req.user!.userId,
          action,
          resource: req.params.id || req.path,
          before,
          after,
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
    });

    next();
  };
};
```

**Impact:**

1. **Cannot answer "who changed this?"**
2. **Cannot answer "when was this changed?"**
3. **Cannot answer "what was the old value?"**
4. **Cannot detect unauthorized changes**
5. **Cannot comply with regulations** (GDPR, HIPAA, PCI-DSS require audit trails)
6. **Cannot troubleshoot issues** (no change history)

**Compliance Requirements:**

| Regulation | Requirement                   | Status  |
| ---------- | ----------------------------- | ------- |
| GDPR       | Log all data access/changes   | ❌ FAIL |
| HIPAA      | Audit trail for PHI access    | ❌ FAIL |
| PCI-DSS    | Track all payment data access | ❌ FAIL |
| SOC 2      | Comprehensive audit logging   | ❌ FAIL |

**Where Logging Should Happen:**

**1. Branding Changes:**

```typescript
// server/src/controllers/tenant-admin.controller.ts:99-130
async updateBranding(req: AuthenticatedRequest, res: Response) {
  const { tenantId, userId } = req.user!;
  const updates = req.body;

  const before = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { branding: true },
  });

  const after = await prisma.tenant.update({
    where: { id: tenantId },
    data: { branding: updates },
  });

  // ❌ MISSING: Audit log
  await auditLogService.log({
    tenantId,
    userId,
    action: 'branding.update',
    resource: 'branding',
    before: before?.branding,
    after: after.branding,
    timestamp: new Date(),
  });

  res.json(after.branding);
}
```

**2. Package Changes:**

```typescript
// server/src/controllers/tenant-admin.controller.ts
async createPackage(req: AuthenticatedRequest, res: Response) {
  const { tenantId, userId } = req.user!;
  const packageData = req.body;

  const created = await packageRepo.create(packageData, tenantId);

  // ❌ MISSING: Audit log
  await auditLogService.log({
    tenantId,
    userId,
    action: 'package.create',
    resource: `package:${created.id}`,
    before: null,  // New creation
    after: created,
    timestamp: new Date(),
  });

  res.json(created);
}

async updatePackage(req: AuthenticatedRequest, res: Response) {
  const { tenantId, userId } = req.user!;
  const { id } = req.params;
  const updates = req.body;

  const before = await packageRepo.findById(id, tenantId);
  const after = await packageRepo.update(id, updates, tenantId);

  // ❌ MISSING: Audit log
  await auditLogService.log({
    tenantId,
    userId,
    action: 'package.update',
    resource: `package:${id}`,
    before,
    after,
    timestamp: new Date(),
  });

  res.json(after);
}

async deletePackage(req: AuthenticatedRequest, res: Response) {
  const { tenantId, userId } = req.user!;
  const { id } = req.params;

  const before = await packageRepo.findById(id, tenantId);
  await packageRepo.delete(id, tenantId);

  // ❌ MISSING: Audit log
  await auditLogService.log({
    tenantId,
    userId,
    action: 'package.delete',
    resource: `package:${id}`,
    before,
    after: null,  // Deleted
    timestamp: new Date(),
  });

  res.status(204).send();
}
```

**3. Booking Status Changes:**

```typescript
async updateBookingStatus(req: AuthenticatedRequest, res: Response) {
  const { tenantId, userId } = req.user!;
  const { id } = req.params;
  const { status } = req.body;

  const before = await bookingRepo.findById(id, tenantId);
  const after = await bookingRepo.updateStatus(id, status, tenantId);

  // ❌ MISSING: Audit log (CRITICAL for bookings)
  await auditLogService.log({
    tenantId,
    userId,
    action: 'booking.status_change',
    resource: `booking:${id}`,
    before: { status: before.status },
    after: { status: after.status },
    timestamp: new Date(),
  });

  res.json(after);
}
```

**Implementation Plan:**

**Phase 1: Database Schema (1 hour)**

```prisma
// Add to schema.prisma
model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String
  userId      String
  action      String   // "branding.update", "package.create", etc.
  resource    String   // "branding", "package:abc123", etc.
  before      Json?
  after       Json?
  timestamp   DateTime @default(now())
  ipAddress   String?
  userAgent   String?

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  user        User     @relation(fields: [userId], references: [id])

  @@index([tenantId, timestamp])
  @@index([userId])
  @@index([action])
  @@index([resource])
}

// Run migration
$ npx prisma migrate dev --name add_audit_logging
```

**Phase 2: Audit Log Service (2 hours)**

```typescript
// server/src/services/audit-log.service.ts
export class AuditLogService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(entry: {
    tenantId: string;
    userId: string;
    action: string;
    resource: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        ...entry,
        before: entry.before ? JSON.parse(JSON.stringify(entry.before)) : null,
        after: entry.after ? JSON.parse(JSON.stringify(entry.after)) : null,
        timestamp: new Date(),
      },
    });
  }

  async getHistory(
    tenantId: string,
    filters?: {
      action?: string;
      userId?: string;
      resource?: string;
      since?: Date;
      until?: Date;
    },
    pagination?: { page: number; limit: number }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const where = {
      tenantId,
      ...(filters?.action && { action: filters.action }),
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.resource && { resource: filters.resource }),
      ...(filters?.since && { timestamp: { gte: filters.since } }),
      ...(filters?.until && { timestamp: { lte: filters.until } }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: pagination?.limit || 50,
        skip: pagination ? (pagination.page - 1) * pagination.limit : 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getResourceHistory(tenantId: string, resource: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { tenantId, resource },
      orderBy: { timestamp: 'desc' },
    });
  }
}
```

**Phase 3: Middleware (1 hour)**

```typescript
// server/src/middleware/audit.ts
export const auditAction = (action: string, resourceFn: (req: Request) => string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const resource = resourceFn(req);
    let before: unknown = null;

    // Capture before state for updates/deletes
    if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      before = await captureState(req, resource);
    }

    // Intercept response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const after = req.method === 'DELETE' ? null : body;

        // Log asynchronously (don't block response)
        auditLogService
          .log({
            tenantId: req.user!.tenantId,
            userId: req.user!.userId,
            action,
            resource,
            before,
            after,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          })
          .catch((error) => {
            console.error('Audit log failed:', error);
            // Don't fail the request if audit logging fails
          });
      }

      return originalJson(body);
    };

    next();
  };
};

// Usage
router.put(
  '/v1/tenant/admin/branding',
  requireAuth,
  requireTenantAdmin,
  auditAction('branding.update', () => 'branding'), // ← Middleware
  validateBody(TenantBrandingDtoSchema),
  tenantAdminController.updateBranding
);
```

**Phase 4: API Endpoints (2 hours)**

```typescript
// server/src/routes/audit-log.routes.ts
router.get(
  '/v1/tenant/admin/audit-log',
  requireAuth,
  requireTenantAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const { tenantId } = req.user!;
    const { action, userId, resource, since, until, page = 1, limit = 50 } = req.query;

    const { logs, total } = await auditLogService.getHistory(
      tenantId,
      {
        action: action as string,
        userId: userId as string,
        resource: resource as string,
        since: since ? new Date(since as string) : undefined,
        until: until ? new Date(until as string) : undefined,
      },
      { page: Number(page), limit: Number(limit) }
    );

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }
);

router.get(
  '/v1/tenant/admin/audit-log/:resource',
  requireAuth,
  requireTenantAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const { tenantId } = req.user!;
    const { resource } = req.params;

    const logs = await auditLogService.getResourceHistory(tenantId, resource);

    res.json(logs);
  }
);
```

**Phase 5: Frontend UI (4 hours)**

```typescript
// client/src/features/tenant-admin/AuditLogViewer.tsx
export const AuditLogViewer = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api.tenant.admin.auditLog.list(),
  });

  return (
    <div>
      <h2>Audit Log</h2>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {logs?.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.user.email}</td>
              <td>{log.action}</td>
              <td>{log.resource}</td>
              <td>
                <button onClick={() => showDiff(log.before, log.after)}>
                  View Changes
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Total Effort:** 8-10 hours (1-2 days for one developer)

**Recommendations:**

1. **URGENT:** Implement audit logging before production (compliance requirement)
2. Add audit log viewer to tenant admin dashboard
3. Add export/download capability for compliance audits
4. Add alerts for suspicious activity (e.g., mass deletions)
5. Consider log retention policy (e.g., 90 days, then archive)

---

(Continuing in CONFIG_DRIVEN_PIVOT_MASTER_ANALYSIS_PART3.md due to length...)
