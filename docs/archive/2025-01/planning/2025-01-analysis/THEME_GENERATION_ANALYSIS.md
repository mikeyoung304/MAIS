# Theme Generation, Ingestion, and Customization Analysis

## Executive Summary

The Elope platform currently has **basic manual theme customization** with:

- Manual hex color picker (primary & secondary colors)
- Font family dropdown selector (8 wedding-appropriate fonts)
- Logo URL input field
- Contrast ratio accessibility checker
- 6 curated wedding color presets

**Major gaps identified:**

- No AI-powered theme generation
- No image-based color extraction
- No CSS/design token parsing
- No theme template system beyond hardcoded presets
- No advanced color palette generation
- Manual, one-color-at-a-time customization
- No image processing for logo analysis

---

## 1. Current Theme Generation & Definition

### 1.1 Where Themes Are Defined

#### Frontend (Client-Side)

**File:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/BrandingEditor.tsx`

**Hardcoded Wedding Color Presets (Lines 44-81):**

```typescript
const WEDDING_COLOR_PRESETS = [
  {
    name: 'Romantic Blush',
    primary: '#F7C5C7',
    secondary: '#C9A0A4',
    description: 'Soft pink tones for romantic ceremonies',
  },
  {
    name: 'Garden Sage',
    primary: '#7A9E7E',
    secondary: '#2C5F6F',
    description: 'Natural greens for outdoor weddings',
  },
  // ... 4 more presets
];
```

**Approach:** Static array with 6 curated pairs. Users can:

1. Click a preset to apply it instantly
2. Manually override with hex color picker
3. Select from fixed font list

#### Backend (Server-Side)

**Database Schema:** `/Users/mikeyoung/CODING/Elope/server/prisma/schema.prisma` (Line 56)

```prisma
branding Json @default("{}") // Widget branding settings
```

**Structure stored in JSON:**

```json
{
  "primaryColor": "#9b87f5",
  "secondaryColor": "#7e69ab",
  "fontFamily": "Inter",
  "logo": "https://example.com/logo.png"
}
```

**Data Transfer Object (DTO):** `/Users/mikeyoung/CODING/Elope/packages/contracts/src/dto.ts` (Lines 134-156)

```typescript
export const TenantBrandingDtoSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
});
```

### 1.2 Available Font System

**File:** `/Users/mikeyoung/CODING/Elope/client/src/components/FontSelector.tsx` (Lines 19-68)

**Curated Font List (8 Options):**

```typescript
const FONT_OPTIONS: FontOption[] = [
  { name: 'Inter', displayName: 'Inter (Modern Sans-Serif)', googleFontUrl: '...' },
  {
    name: 'Playfair Display',
    displayName: 'Playfair Display (Elegant Serif)',
    googleFontUrl: '...',
  },
  { name: 'Lora', displayName: 'Lora (Classic Serif)', googleFontUrl: '...' },
  { name: 'Montserrat', displayName: 'Montserrat (Clean Sans-Serif)', googleFontUrl: '...' },
  {
    name: 'Cormorant Garamond',
    displayName: 'Cormorant Garamond (Romantic Serif)',
    googleFontUrl: '...',
  },
  { name: 'Raleway', displayName: 'Raleway (Refined Sans-Serif)', googleFontUrl: '...' },
  { name: 'Crimson Text', displayName: 'Crimson Text (Traditional Serif)', googleFontUrl: '...' },
  { name: 'Poppins', displayName: 'Poppins (Friendly Sans-Serif)', googleFontUrl: '...' },
];
```

**Font Loading:** Uses Google Fonts API dynamically (Lines 79-89)

### 1.3 Tailwind Color System

**File:** `/Users/mikeyoung/CODING/Elope/client/tailwind.config.js`

**Color Palette (Fixed/Extended):**

```javascript
colors: {
  lavender: { 50-900 }, // 10-step scale
  navy: { 50-900 },     // 10-step scale
  purple: { 50-900 },   // 10-step scale
  primary: { DEFAULT, foreground },
  secondary: { DEFAULT, foreground },
  // ... 5 more semantic colors
}
```

**Usage:** Hardcoded into components via Tailwind classes. **No dynamic theme injection mechanism exists.**

---

## 2. External Source Parsing Capabilities

### 2.1 CSS File Parsing

**Status:** NOT IMPLEMENTED

### 2.2 Screenshot/Image Analysis

**Status:** NOT IMPLEMENTED

### 2.3 Design Token Import

**Status:** NOT IMPLEMENTED

### Gap: No code exists to:

- Parse CSS files for color definitions
- Extract colors from uploaded images/screenshots
- Import design token systems (JSON, YAML, CSS variables)
- Analyze brand guidelines documents

---

## 3. Color Extraction & Palette Generation

### 3.1 Current Color Processing

**File:** `/Users/mikeyoung/CODING/Elope/client/src/components/ColorPicker.tsx`

**Hex Validation (Lines 21-34):**

```typescript
function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function normalizeHex(color: string): string {
  const normalized = color.trim();
  if (normalized.startsWith('#')) {
    return normalized.toUpperCase();
  }
  return `#${normalized}`.toUpperCase();
}
```

**That's it.** No color space conversions, no palette generation.

### 3.2 Accessibility Features (WCAG Contrast Checking)

**File:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/BrandingEditor.tsx` (Lines 84-108)

**Luminance Calculation (WCAG Formula):**

```typescript
function getLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;

  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}
```

**Features:**

- Validates contrast against white background (4.5:1 for normal, 3.0:1 for large text)
- Shows visual warnings for accessibility failures
- No automatic color adjustment suggestions

### 3.3 Gaps in Color Generation

- No complementary color suggestion
- No analogous palette generation
- No triadic harmony calculation
- No monochromatic shade generation
- No color space manipulation (HSL/HSV)
- No image color extraction
- No palette from brand logo

---

## 4. Typography System & Font Selection

### 4.1 Font Selection Mechanism

**File:** `/Users/mikeyoung/CODING/Elope/client/src/components/FontSelector.tsx`

**Key Features:**

```typescript
// Dynamic font loading from Google Fonts
function loadGoogleFont(fontUrl: string): void {
  const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrl;
  document.head.appendChild(link);
}

// Live preview with selected font applied
<div style={{ fontFamily: selectedOption.name }}>
  The quick brown fox jumps over the lazy dog
</div>
```

### 4.2 Font System in useBranding Hook

**File:** `/Users/mikeyoung/CODING/Elope/client/src/hooks/useBranding.ts` (Lines 14-46)

```typescript
function loadGoogleFont(fontFamily: string): void {
  if (!fontFamily || fontFamily === 'Inter') return;

  const fontUrlMap: Record<string, string> = {
    'Playfair Display': '...',
    Lora: '...',
    Montserrat: '...',
    // ... hardcoded mapping
  };

  const fontUrl = fontUrlMap[fontFamily];
  if (!fontUrl) return;

  // Dynamic load
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrl;
  document.head.appendChild(link);
}
```

**Limitation:** Font URLs are hardcoded; adding new fonts requires code changes.

### 4.3 Font Application via CSS Variables

**File:** `/Users/mikeyoung/CODING/Elope/client/src/hooks/useBranding.ts` (Lines 78-99)

```typescript
useEffect(() => {
  if (branding) {
    const root = document.documentElement;

    if (branding.primaryColor) {
      root.style.setProperty('--color-primary', branding.primaryColor);
    }

    if (branding.secondaryColor) {
      root.style.setProperty('--color-secondary', branding.secondaryColor);
    }

    if (branding.fontFamily) {
      root.style.setProperty('--font-family', branding.fontFamily);
      loadGoogleFont(branding.fontFamily);
    }
  }
}, [branding]);
```

**Limitation:** Only applies `--font-family` as CSS variable. No font weight, size, or line-height customization.

### 4.4 Gaps in Typography System

- No font pairing suggestions
- No heading vs body font customization
- No font weight selection
- No letter spacing adjustment
- No line height customization
- No font size scaling for responsive design
- No font matching based on primary color

---

## 5. Image Processing Capabilities

### 5.1 Current Image Upload System

**File:** `/Users/mikeyoung/CODING/Elope/server/src/services/upload.service.ts`

**Features:**

```typescript
export class UploadService {
  private logoUploadDir: string;
  private packagePhotoUploadDir: string;
  private maxFileSizeMB: number;
  private allowedMimeTypes: string[] = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/svg+xml',
    'image/webp',
  ];

  async uploadLogo(file: UploadedFile, tenantId: string): Promise<UploadResult> {
    // Validate file
    this.validateFile(file);

    // Generate unique filename
    const filename = this.generateFilename(file.originalname, 'logo');

    // Write to disk
    await fs.promises.writeFile(filepath, file.buffer);

    // Return public URL
    return {
      url: `${this.baseUrl}/uploads/logos/${filename}`,
      filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
```

**Limitations:**

- Only validates file size (2MB) and MIME type
- No image processing (resize, optimize, compress)
- No color extraction from uploaded images
- No image analysis
- Stores locally, not in cloud storage

### 5.2 File Upload Routes

**File:** `/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts` (Lines 240-245)

```typescript
router.post('/logo', upload.single('logo'), (req, res) => controller.uploadLogo(req, res));
```

**Gaps:**

- No post-processing pipeline
- No color palette generation from logo
- No image optimization
- No CDN integration

### 5.3 Frontend Logo Upload

**File:** `/Users/mikeyoung/CODING/Elope/client/src/features/tenant-admin/BrandingEditor.tsx` (Lines 557-577)

```typescript
<Input
  id="logoUrl"
  type="url"
  value={logoUrl}
  onChange={(e) => {
    setLogoUrl(e.target.value);
  }}
  placeholder="https://example.com/logo.png"
  className="bg-navy-900 border-navy-600 text-lavender-50 placeholder:text-navy-400 focus:border-lavender-500 text-lg h-12"
  disabled={isSaving}
/>
<div className="flex items-center gap-2 text-base text-lavender-200">
  <Image className="w-4 h-4" />
  <span>Logo upload will be implemented in Phase 4</span>
</div>
```

**Status:** Logo upload **not yet implemented**. Only URL input available.

---

## 6. Theme Template & Preset System

### 6.1 Preset Structure

**Location:** `BrandingEditor.tsx` (Lines 44-81)

**Current Presets (6 total):**

1. Romantic Blush (#F7C5C7, #C9A0A4)
2. Garden Sage (#7A9E7E, #2C5F6F)
3. Elegant Gold (#D4AF37, #8B7355)
4. Rustic Terracotta (#C1666B, #48392A)
5. Classic Navy (#2C3E50, #5D6D7E)
6. Lavender Dreams (#9b87f5, #7e69ab)

**Application Logic (Lines 174-181):**

```typescript
const applyPreset = useCallback(
  (preset: (typeof WEDDING_COLOR_PRESETS)[0]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
    showSuccess(`Applied "${preset.name}" color theme`);
  },
  [showSuccess]
);
```

### 6.2 Reset to Defaults

**Lines 183-189:**

```typescript
const resetToDefaults = useCallback(() => {
  setPrimaryColor('#9b87f5');
  setSecondaryColor('#7e69ab');
  setFontFamily('Inter');
  setLogoUrl('');
  showSuccess('Reset to default branding');
}, [showSuccess]);
```

### 6.3 Gaps in Template System

- **No database-stored templates:** Presets are hardcoded
- **No user-created templates:** Can't save custom palettes
- **No template marketplace:** Can't share templates across tenants
- **No variant generation:** Presets don't generate full palettes (lighter/darker shades)
- **No template metadata:** No description, category, mood, or usage guidelines
- **No adaptive templates:** No presets based on selected font or logo colors
- **No A/B testing:** No performance data on preset adoption

---

## 7. API Integration Points

### 7.1 Branding Endpoints

**File:** `/Users/mikeyoung/CODING/Elope/server/src/routes/tenant-admin.routes.ts`

**GET /v1/tenant/branding (Lines 198-225)**

```typescript
async getBranding(req: Request, res: Response): Promise<void> {
  const tenantAuth = res.locals.tenantAuth;
  const tenantId = tenantAuth.tenantId;

  const tenant = await this.tenantRepository.findById(tenantId);
  const branding = (tenant.branding as any) || {};

  res.status(200).json({
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    fontFamily: branding.fontFamily,
    logo: branding.logo,
  });
}
```

**PUT /v1/tenant/branding (Lines 131-192)**

```typescript
async updateBranding(req: Request, res: Response): Promise<void> {
  const validation = UpdateBrandingSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues,
    });
    return;
  }

  const currentBranding = (tenant.branding as any) || {};
  const updatedBranding = {
    ...currentBranding,
    ...validation.data,
  };

  await this.tenantRepository.update(tenantId, {
    branding: updatedBranding,
  });

  res.status(200).json(updatedBranding);
}
```

**Validation Schema (Lines 141-145):**

```typescript
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
```

### 7.2 Logo Upload Endpoint (Partially Implemented)

**POST /v1/tenant/logo (Lines 75-125)**

```typescript
async uploadLogo(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const result = await uploadService.uploadLogo(req.file as any, tenantId);

  const currentBranding = (tenant.branding as any) || {};
  const updatedBranding = {
    ...currentBranding,
    logo: result.url,
  };

  await this.tenantRepository.update(tenantId, {
    branding: updatedBranding,
  });

  res.status(200).json(result);
}
```

### 7.3 Client API Client Methods

**File:** `/Users/mikeyoung/CODING/Elope/client/src/lib/api.ts` (Lines 16-23)

```typescript
interface ExtendedApiClient {
  tenantGetBranding: () => Promise<{ status: number; body: unknown }>;
  tenantUpdateBranding: (params: {
    body: {
      primaryColor?: string;
      secondaryColor?: string;
      fontFamily?: string;
    };
  }) => Promise<{ status: number; body: unknown }>;
}
```

---

## 8. Where to Insert AI-Powered Theme Generation

### 8.1 Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Client)                                       │
├─────────────────────────────────────────────────────────┤
│ BrandingEditor.tsx                                      │
│  ├─ ColorPicker.tsx (manual)                           │
│  ├─ FontSelector.tsx (manual)                          │
│  └─ [NEW] AI Theme Generator Component                 │
│      ├─ Upload logo/screenshot                         │
│      ├─ Select mood/style preference                   │
│      ├─ AI generation form                             │
│      └─ Preview generated theme                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ API Layer (TypeScript/Zod Contracts)                    │
├─────────────────────────────────────────────────────────┤
│ packages/contracts/src/dto.ts                           │
│  └─ [NEW] GenerateThemeRequestDto                      │
│      ├─ imageUrl?: string                              │
│      ├─ mood?: string                                  │
│      ├─ style?: string                                 │
│      └─ preferences?: ThemePreferences                 │
│                                                         │
│ packages/contracts/src/api.v1.ts                        │
│  └─ [NEW] POST /v1/tenant/branding/generate            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Backend (Server)                                        │
├─────────────────────────────────────────────────────────┤
│ server/src/routes/tenant-admin.routes.ts               │
│  └─ POST /branding/generate                            │
│                                                         │
│ [NEW] server/src/services/theme-generation.service.ts │
│  ├─ generateThemeFromImage(file, preferences)          │
│  ├─ extractColorsFromImage(buffer)                     │
│  ├─ generateComplementaryPalette(baseColor)            │
│  ├─ matchFonts(colors, mood)                           │
│  ├─ validateContrast(palette)                          │
│  └─ rankThemeOptions(candidates)                       │
│                                                         │
│ [NEW] server/src/lib/color-utils/                      │
│  ├─ color-extraction.ts (image-to-colors)              │
│  ├─ palette-generation.ts (color harmony)              │
│  ├─ font-matching.ts (color-to-fonts)                  │
│  └─ theme-validation.ts (wcag, semantics)              │
│                                                         │
│ [NEW] server/src/adapters/ai/ (optional)               │
│  ├─ openai.adapter.ts (for Claude/GPT)                 │
│  ├─ huggingface.adapter.ts (for ML models)             │
│  └─ palette-api.adapter.ts (for Coolors/etc)           │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Implementation Insertion Points

#### Point 1: BrandingEditor Component

**File:** `client/src/features/tenant-admin/BrandingEditor.tsx`

**Add after line 82 (after WEDDING_COLOR_PRESETS):**

```typescript
// Add AI Theme Generation Tab/Section
// Option A: Modal triggered by new "Generate with AI" button
// Option B: Separate tab in branding editor
// Option C: Collapsible section above color presets
```

#### Point 2: API Routes

**File:** `server/src/routes/tenant-admin.routes.ts`

**Add after line 249 (after branding routes):**

```typescript
// New AI theme generation endpoint
router.post('/branding/generate', async (req, res) => {
  // Route handler to call theme-generation.service
});
```

#### Point 3: New Service Layer

**Create:** `server/src/services/theme-generation.service.ts`

**Main exports:**

```typescript
export class ThemeGenerationService {
  async generateThemeFromImage(file, preferences): Promise<GeneratedTheme>;
  async generateThemeFromDescription(prompt): Promise<GeneratedTheme>;
  async generatePaletteVariants(baseColor, count): Promise<Palette[]>;
  async suggestFonts(palette, mood): Promise<FontPair[]>;
  async validateTheme(theme): Promise<ValidationResult>;
}
```

#### Point 4: Color Utilities Library

**Create:** `server/src/lib/color-utils/`

**Modules:**

- `color-extraction.ts` - Vibrant.js or sharp for image analysis
- `palette-generation.ts` - Chroma.js or colorsys for harmony
- `font-matching.ts` - Font pairing algorithms
- `theme-validation.ts` - WCAG contrast, semantics

#### Point 5: Data Transfer Objects

**File:** `packages/contracts/src/dto.ts`

**Add after line 156 (after UpdateBrandingDto):**

```typescript
export const GenerateThemeRequestDtoSchema = z.object({
  imageUrl: z.string().url().optional(),
  mood: z.enum(['romantic', 'modern', 'rustic', 'classic', 'whimsical']).optional(),
  style: z.enum(['minimalist', 'ornate', 'bold', 'elegant', 'playful']).optional(),
  preferredColors: z.array(z.string()).optional(),
  excludeColors: z.array(z.string()).optional(),
});

export const GeneratedThemeDtoSchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accentColor: z.string().optional(),
  fontFamily: z.string(),
  fontPair: z
    .object({
      heading: z.string(),
      body: z.string(),
    })
    .optional(),
  palette: z.array(z.string()),
  confidence: z.number(),
  reasoning: z.string(),
});

export type GenerateThemeRequestDto = z.infer<typeof GenerateThemeRequestDtoSchema>;
export type GeneratedThemeDto = z.infer<typeof GeneratedThemeDtoSchema>;
```

---

## 9. Technical Gaps & Missing Dependencies

### 9.1 Image Processing Libraries Needed

| Library         | Purpose                               | Status        |
| --------------- | ------------------------------------- | ------------- |
| `sharp`         | Image processing, optimization        | NOT INSTALLED |
| `vibrant.js`    | Dominant color extraction from images | NOT INSTALLED |
| `chroma-js`     | Advanced color manipulation, harmony  | NOT INSTALLED |
| `colorsys`      | Color space conversion (RGB→HSL→etc)  | NOT INSTALLED |
| `wcag-contrast` | Advanced accessibility checking       | NOT INSTALLED |

### 9.2 Current Dependencies

```json
{
  "react-colorful": "^5.6.3" (only hex picker)
  "tailwindcss": "^3.4.0" (styling only)
  "zod": "^3.20.2" (validation)
}
```

### 9.3 Optional AI Integration Libraries

| Library                   | Purpose                      | Pros                     | Cons                      |
| ------------------------- | ---------------------------- | ------------------------ | ------------------------- |
| OpenAI API (Claude/GPT-4) | Theme description to palette | High quality, contextual | Costs $, requires API key |
| Hugging Face Transformers | Local ML inference           | Free, private            | Requires model download   |
| Coolors API               | Theme generation API         | Pre-built, reliable      | Rate-limited free tier    |
| Color.adobe.com API       | Adobe color harmony          | Professional             | Rate-limited free tier    |
| Local ML (TensorFlow.js)  | Client-side color analysis   | No backend needed        | Large bundle size         |

---

## 10. Current Capabilities Summary

### What Works

✅ Manual hex color selection (two colors)
✅ WCAG AA/AAA contrast validation
✅ 6 curated wedding color presets (apply instantly)
✅ 8 Google Fonts with live preview
✅ Logo URL input (file upload not yet implemented)
✅ CSS variable injection via useBranding hook
✅ Multi-tenant branding isolation (database level)
✅ Full API for branding CRUD operations
✅ Type-safe contracts with Zod validation

### What's Missing

❌ AI-powered theme generation from images
❌ Logo color extraction & analysis
❌ Color palette generation (complementary, analogous, triadic)
❌ Image processing (resize, optimize, extract dominant colors)
❌ CSS/design token parsing/import
❌ Font pairing recommendations
❌ Design system template library
❌ Color harmony validation
❌ Automatic shade/tint generation
❌ Theme import/export (JSON)
❌ Brand guidelines document analysis

---

## 11. Recommended Implementation Order

### Phase 1: Foundation (Weeks 1-2)

1. Install color utilities: `sharp`, `vibrant`, `chroma-js`
2. Create `color-utils/` library with:
   - Color space conversion functions
   - Palette generation (complementary, analogous, triadic)
   - Contrast validation
3. Add DTO schemas for theme generation
4. Create `ThemeGenerationService` with basic palette generation

### Phase 2: Image Processing (Weeks 2-3)

1. Implement image upload in frontend (`BrandingEditor.tsx`)
2. Create image color extraction service (vibrant.js)
3. Add image validation and optimization (sharp)
4. Build image preview component

### Phase 3: AI Integration (Weeks 3-4)

1. Add "Generate from Description" UI component
2. Integrate Claude/OpenAI for intelligent suggestions
3. Create font pairing recommendation engine
4. Build theme preview with multiple variants

### Phase 4: Polish & Distribution (Weeks 4-5)

1. Add theme templates to database
2. Create template management UI
3. Add import/export functionality
4. Performance optimization and caching

---

## 12. Code Locations Reference

| Feature          | File                                                  | Lines   |
| ---------------- | ----------------------------------------------------- | ------- |
| Color Picker     | `client/src/components/ColorPicker.tsx`               | 1-154   |
| Font Selector    | `client/src/components/FontSelector.tsx`              | 1-222   |
| Branding Editor  | `client/src/features/tenant-admin/BrandingEditor.tsx` | 1-690   |
| Color Presets    | `client/src/features/tenant-admin/BrandingEditor.tsx` | 44-81   |
| Contrast Check   | `client/src/features/tenant-admin/BrandingEditor.tsx` | 84-108  |
| useBranding Hook | `client/src/hooks/useBranding.ts`                     | 1-107   |
| Font Loading     | `client/src/hooks/useBranding.ts`                     | 14-46   |
| CSS Application  | `client/src/hooks/useBranding.ts`                     | 78-99   |
| Upload Service   | `server/src/services/upload.service.ts`               | 1-237   |
| Branding Routes  | `server/src/routes/tenant-admin.routes.ts`            | 198-225 |
| Branding DTOs    | `packages/contracts/src/dto.ts`                       | 134-156 |
| Tailwind Config  | `client/tailwind.config.js`                           | 1-104   |
| API Client       | `client/src/lib/api.ts`                               | 1-50    |
| Database Schema  | `server/prisma/schema.prisma`                         | 37-81   |
