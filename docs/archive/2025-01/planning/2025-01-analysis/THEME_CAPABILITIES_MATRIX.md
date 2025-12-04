# Theme Capabilities Matrix

## Current Implementation Status

### Color Management

| Capability                 | Status     | Location                   | Quality | Notes                                |
| -------------------------- | ---------- | -------------------------- | ------- | ------------------------------------ |
| Manual hex input           | ✅ DONE    | ColorPicker.tsx            | Good    | Supports manual entry + validation   |
| Visual color picker        | ✅ DONE    | ColorPicker.tsx            | Good    | React-colorful HexColorPicker        |
| Preset application         | ✅ DONE    | BrandingEditor.tsx:174-181 | Good    | 6 hardcoded wedding presets          |
| CSS variable injection     | ✅ DONE    | useBranding.ts:78-99       | Good    | --color-primary, --color-secondary   |
| Contrast validation (WCAG) | ✅ PARTIAL | BrandingEditor.tsx:84-108  | Good    | AA/AAA checking, but no auto-fix     |
| Color space conversion     | ❌ MISSING | -                          | -       | No RGB↔HSL↔HSV support             |
| Palette generation         | ❌ MISSING | -                          | -       | No complementary/harmony generation  |
| Image color extraction     | ❌ MISSING | -                          | -       | No color pulling from logos          |
| Shade/tint generation      | ❌ MISSING | -                          | -       | No automatic lighter/darker variants |

### Font Management

| Capability               | Status     | Location               | Quality | Notes                                |
| ------------------------ | ---------- | ---------------------- | ------- | ------------------------------------ |
| Font selection dropdown  | ✅ DONE    | FontSelector.tsx       | Good    | 8 curated wedding fonts              |
| Live font preview        | ✅ DONE    | FontSelector.tsx       | Good    | Shows preview text in selected font  |
| Google Fonts loading     | ✅ DONE    | FontSelector.tsx:79-89 | Good    | Dynamic loading, caches loaded fonts |
| Font application (CSS)   | ✅ DONE    | useBranding.ts:93-97   | Basic   | Only --font-family, no weights/sizes |
| Font pairing suggestions | ❌ MISSING | -                      | -       | No heading+body combinations         |
| Font metadata            | ❌ MISSING | -                      | -       | No weight/style options              |
| Font preview variants    | ❌ MISSING | -                      | -       | No weight/italic previews            |

### Image Processing

| Capability            | Status     | Location                   | Quality | Notes                  |
| --------------------- | ---------- | -------------------------- | ------- | ---------------------- |
| Logo URL input        | ✅ DONE    | BrandingEditor.tsx:562-572 | Good    | Text field for URL     |
| Logo file upload      | ❌ TODO    | BrandingEditor.tsx:575     | -       | Marked for Phase 4     |
| Image validation      | ✅ PARTIAL | upload.service.ts:71-90    | Good    | MIME type + size check |
| Image optimization    | ❌ MISSING | -                          | -       | No resize/compress     |
| Logo color extraction | ❌ MISSING | -                          | -       | No color analysis      |
| Logo preview display  | ❌ MISSING | -                          | -       | No visual preview      |

### Data Management

| Capability                | Status     | Location                       | Quality | Notes                          |
| ------------------------- | ---------- | ------------------------------ | ------- | ------------------------------ |
| Branding storage (DB)     | ✅ DONE    | schema.prisma:56 (JSON field)  | Good    | Stored as JSON in Tenant model |
| Branding retrieval        | ✅ DONE    | tenant-admin.routes.ts:198-225 | Good    | GET /v1/tenant/branding        |
| Branding updates          | ✅ DONE    | tenant-admin.routes.ts:131-192 | Good    | PUT /v1/tenant/branding        |
| Multi-tenant isolation    | ✅ DONE    | All routes                     | Good    | TenantId validation throughout |
| Theme validation (schema) | ✅ DONE    | dto.ts:144-154                 | Good    | Hex regex validation           |
| Template system           | ❌ MISSING | -                              | -       | No database templates          |
| Theme export              | ❌ MISSING | -                              | -       | No JSON export                 |
| Theme import              | ❌ MISSING | -                              | -       | No JSON import                 |

### Advanced Features

| Capability              | Status     | Location                   | Quality | Notes                        |
| ----------------------- | ---------- | -------------------------- | ------- | ---------------------------- |
| AI theme generation     | ❌ MISSING | -                          | -       | No generative AI integration |
| Description-to-theme    | ❌ MISSING | -                          | -       | No natural language input    |
| Template marketplace    | ❌ MISSING | -                          | -       | No community templates       |
| A/B testing framework   | ❌ MISSING | -                          | -       | No variant testing           |
| Dark mode support       | ✅ DONE    | tailwind.config.js         | Good    | Default dark theme           |
| Responsive theming      | ❌ PARTIAL | tailwind.config.js         | Limited | Only base colors, not layout |
| Animation customization | ❌ MISSING | -                          | -       | No animation controls        |
| Accessibility report    | ✅ PARTIAL | BrandingEditor.tsx:467-516 | Basic   | Contrast check only          |

---

## Component Deep Dive

### BrandingEditor.tsx (690 lines)

**Sections:**

1. **Imports** (1-12): React, icons, UI components, API
2. **Type Definitions** (19-28): BrandingDto interface
3. **Font Options** (36-42): Hardcoded FONT_OPTIONS array
4. **Color Presets** (44-81): WEDDING_COLOR_PRESETS array
5. **Utility Functions** (84-108): getLuminance(), getContrastRatio()
6. **Main Component** (110+)
   - useState hooks: primaryColor, secondaryColor, fontFamily, logoUrl, etc.
   - useEffect: Load branding, load tenant info, load font
   - Callbacks: showSuccess, applyPreset, resetToDefaults, handleSave
   - Render: Grid layout with form + live preview

**Rendering Order:**

- Success message (if shown)
- First-time setup welcome (if no branding)
- Grid container:
  - LEFT: Branding form
    - Color presets grid
    - Divider
    - Primary color input + picker
    - Secondary color input + picker
    - Contrast accessibility checker
    - Font dropdown + preview
    - Logo URL input
    - Action buttons (Save, Reset)
  - RIGHT: Live preview
    - Sample package card
    - Color reference boxes

**API Calls:**

- Line 135-146: tenantGetInfo() to fetch slug
- Line 229-247: tenantUpdateBranding() to save

---

## ColorPicker.tsx (154 lines)

**Key Features:**

```typescript
// Props: label, value, onChange, className
// State: color, inputValue, isPickerOpen

// Main Flow:
1. HexColorPicker from react-colorful
2. Manual hex input field
3. Normalization & validation
4. onChange callback to parent
5. Validation error message display
```

**Validation Rules:**

- Must match: `/^#[0-9A-Fa-f]{6}$/`
- Auto-normalizes to uppercase
- Auto-adds # prefix if missing

---

## FontSelector.tsx (222 lines)

**Key Features:**

```typescript
// Props: value, onChange, className
// State: selectedFont, isOpen

// Font Loading:
function loadGoogleFont(fontUrl: string) {
  // Check if already loaded
  // Create <link> tag dynamically
  // Append to document.head
}

// Display:
1. Dropdown button with current selection
2. Dropdown menu with all options
3. Live preview text below dropdown
```

**Font List (8 total):**

- Inter (modern sans-serif)
- Playfair Display (elegant serif)
- Lora (classic serif)
- Montserrat (clean sans-serif)
- Cormorant Garamond (romantic serif)
- Raleway (refined sans-serif)
- Crimson Text (traditional serif)
- Poppins (friendly sans-serif)

---

## Upload Service (237 lines)

**Methods:**

1. **uploadLogo(file, tenantId)** - Lines 108-141
   - Validates file (size, MIME type)
   - Generates unique filename
   - Writes to disk
   - Returns public URL

2. **uploadPackagePhoto(file, packageId)** - Lines 149-182
   - Same as above, 5MB limit

3. **deleteLogo(filename)** - Lines 188-200
4. **deletePackagePhoto(filename)** - Lines 206-218
5. **Helper methods**
   - ensureUploadDir()
   - validateFile()
   - generateFilename()

**Configuration:**

```typescript
logoUploadDir = process.env.UPLOAD_DIR || 'uploads/logos';
maxFileSizeMB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '2', 10);
maxPackagePhotoSizeMB = 5;
allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
```

---

## useBranding Hook (107 lines)

**Purpose:** Fetch tenant branding and apply to page

**Key Logic:**

1. **Query Hook** (56-76)
   - Fetches from `api.getTenantBranding()`
   - 5-minute cache (staleTime)
   - Parses response structure

2. **CSS Variable Injection** (79-99)
   - Sets `--color-primary`
   - Sets `--color-secondary`
   - Sets `--font-family`
   - Calls loadGoogleFont()

3. **Font Loading** (14-46)
   - Hardcoded fontUrlMap for each font
   - Checks if already loaded
   - Creates `<link>` tag dynamically

**Limitations:**

- Font URLs hardcoded (requires code change to add fonts)
- Only two colors + one font supported
- No nested color system
- No responsive breakpoints

---

## Tailwind Configuration (104 lines)

**Color Palette:**

```javascript
lavender: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 }
navy: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 }
purple: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 }
primary: { DEFAULT: '#8770B7', foreground: '#FFFFFF' }
secondary: { DEFAULT: '#3D405B', foreground: '#F5F6FA' }
muted: { DEFAULT: '#30334D', foreground: '#C7CAD7' }
accent: { DEFAULT: '#A593C9', foreground: '#FFFFFF' }
border: '#5A6082'
input: '#3D405B'
background: '#30334D'
foreground: '#F5F6FA'
```

**Typography:**

```javascript
fontFamily: {
  heading: ['Playfair Display', 'serif'],
  body: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', ...]
}
```

**Challenge:** All hardcoded, no dynamic switching

---

## API Contracts (156 lines in dto.ts)

**Current Branding DTO:**

```typescript
export const TenantBrandingDtoSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
});
```

**Update Branding DTO:**

```typescript
export const UpdateBrandingDtoSchema = z.object({
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

**Missing Contracts:**

- GenerateThemeRequestDto
- GeneratedThemeDto
- BrandingTemplateDto
- ThemeMetadataDto

---

## Database Schema (280 lines)

**Tenant Model - Branding Field:**

```prisma
model Tenant {
  // ...
  branding Json @default("{}")
  // ...
}
```

**Current JSON Structure:**

```json
{
  "primaryColor": "#9b87f5",
  "secondaryColor": "#7e69ab",
  "fontFamily": "Inter",
  "logo": "https://example.com/logo.png"
}
```

**Missing Models:**

- BrandingTemplate (for templates)
- ColorPalette (for full palettes)
- ThemeVariant (for alternatives)
- ThemeAnalytics (for usage tracking)

---

## File Size & Complexity Analysis

| File                   | Size      | Complexity | Maintainability                  |
| ---------------------- | --------- | ---------- | -------------------------------- |
| BrandingEditor.tsx     | 690 lines | High       | Medium - component getting large |
| ColorPicker.tsx        | 154 lines | Low        | High - single purpose            |
| FontSelector.tsx       | 222 lines | Low        | High - single purpose            |
| useBranding.ts         | 107 lines | Low        | High - hook logic clear          |
| upload.service.ts      | 237 lines | Medium     | High - well-structured           |
| tenant-admin.routes.ts | 705 lines | High       | Medium - many endpoints          |
| tailwind.config.js     | 104 lines | Low        | Medium - color tweaks needed     |

---

## Recommended Next Steps

### Immediate (Week 1)

1. Create `server/src/lib/color-utils/` directory structure
2. Install: `sharp vibrant chroma-js`
3. Add new DTOs to contracts

### Short-term (Weeks 2-3)

1. Implement color extraction service
2. Add palette generation algorithms
3. Create API endpoint

### Medium-term (Weeks 4-5)

1. Build frontend UI component
2. Integrate with BrandingEditor
3. Add database template system

### Long-term (Weeks 6-8)

1. AI integration (Claude/OpenAI)
2. Font pairing recommendations
3. Template marketplace
4. Analytics dashboard
