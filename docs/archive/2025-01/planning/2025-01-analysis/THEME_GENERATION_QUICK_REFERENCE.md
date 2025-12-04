# Theme Generation - Quick Reference Guide

## Current State vs. Desired State

### Frontend Components

| Component        | File                                       | Current State                      | Enhancement Needed         |
| ---------------- | ------------------------------------------ | ---------------------------------- | -------------------------- |
| ColorPicker      | `components/ColorPicker.tsx`               | Manual hex input + visual picker   | Add palette suggestions    |
| FontSelector     | `components/FontSelector.tsx`              | Fixed 8 fonts, live preview        | Add font pairing AI        |
| BrandingEditor   | `features/tenant-admin/BrandingEditor.tsx` | 6 hardcoded presets + manual input | Add AI generation tab      |
| useBranding hook | `hooks/useBranding.ts`                     | CSS variable injection             | Extend for dynamic theming |

### Backend Services

| Service          | File                            | Current State        | Enhancement Needed          |
| ---------------- | ------------------------------- | -------------------- | --------------------------- |
| UploadService    | `services/upload.service.ts`    | File validation only | Add image processing        |
| Branding Routes  | `routes/tenant-admin.routes.ts` | GET/PUT endpoints    | Add POST /generate endpoint |
| Theme Generation | MISSING                         | N/A                  | Create new service          |
| Color Utils      | MISSING                         | N/A                  | Create library              |
| Image Processing | MISSING                         | N/A                  | Add extraction logic        |

## Implementation Checklist

### Phase 1: Foundation Libraries

```
[ ] npm install --save sharp vibrant chroma-js
[ ] Create server/src/lib/color-utils/
    [ ] color-extraction.ts
    [ ] palette-generation.ts
    [ ] font-matching.ts
    [ ] theme-validation.ts
[ ] Update packages/contracts/src/dto.ts with new schemas
```

### Phase 2: Core Service

```
[ ] Create server/src/services/theme-generation.service.ts
[ ] Implement color extraction from image buffer
[ ] Implement palette generation algorithms
    [ ] Complementary colors
    [ ] Analogous colors
    [ ] Triadic colors
    [ ] Monochromatic
[ ] Implement WCAG validation
```

### Phase 3: API Routes

```
[ ] Add POST /v1/tenant-admin/branding/generate endpoint
[ ] Wire theme-generation.service
[ ] Add multer middleware for image upload
[ ] Add error handling and validation
```

### Phase 4: Frontend UI

```
[ ] Create AIThemeGenerator.tsx component
[ ] Add "Generate with AI" button to BrandingEditor
[ ] Implement image upload & preview
[ ] Add mood/style selector
[ ] Add theme variant carousel
[ ] Wire to backend API
```

### Phase 5: Enhancements

```
[ ] Add font pairing recommendations
[ ] Add template system (database + UI)
[ ] Add theme export/import
[ ] Add A/B testing framework
```

## Key Integration Points

### Adding AI Generation Tab to BrandingEditor

**Current Structure (Line ~350):**

```tsx
<div className="space-y-3">
  <Label className="text-lavender-100 text-lg">Quick Start Themes</Label>
  {/* 6 preset buttons */}
</div>
```

**Enhancement Point:** Add tab system above this:

```tsx
<Tabs defaultValue="presets" className="space-y-3">
  <TabsList>
    <TabsTrigger value="presets">Presets</TabsTrigger>
    <TabsTrigger value="ai">Generate with AI</TabsTrigger>
  </TabsList>

  <TabsContent value="presets">{/* existing presets code */}</TabsContent>

  <TabsContent value="ai">
    <AIThemeGenerator onThemeGenerated={handleThemeGenerated} />
  </TabsContent>
</Tabs>
```

### Adding Generation Endpoint

**Route Location:** `server/src/routes/tenant-admin.routes.ts` after line 249

```typescript
router.post(
  '/branding/generate',
  uploadPackagePhoto.single('image'),
  handleMulterError,
  async (req, res, next) => {
    try {
      const tenantAuth = res.locals.tenantAuth;
      const tenantId = tenantAuth.tenantId;

      const themeGen = new ThemeGenerationService();
      const result = await themeGen.generateTheme({
        image: req.file,
        mood: req.body.mood,
        style: req.body.style,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);
```

### Database-Backed Templates

**Migration Needed:**

```prisma
model BrandingTemplate {
  id        String   @id @default(cuid())
  name      String
  category  String
  mood      String
  style     String

  primaryColor    String
  secondaryColor  String
  accentColor     String?
  fontFamily      String

  headingFont     String?
  bodyFont        String?

  metadata        Json

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## File Dependencies

```
server/src/services/theme-generation.service.ts
  ├─ server/src/lib/color-utils/color-extraction.ts
  ├─ server/src/lib/color-utils/palette-generation.ts
  ├─ server/src/lib/color-utils/font-matching.ts
  └─ server/src/lib/color-utils/theme-validation.ts

client/src/features/tenant-admin/BrandingEditor.tsx
  ├─ client/src/components/AIThemeGenerator.tsx (NEW)
  │  └─ client/src/lib/api.ts (extend interface)
  ├─ client/src/components/ColorPicker.tsx
  └─ client/src/components/FontSelector.tsx

packages/contracts/src/
  ├─ dto.ts (add GenerateThemeRequestDto, GeneratedThemeDto)
  └─ api.v1.ts (add theme generation endpoint contract)
```

## Missing Libraries to Install

**Production Dependencies:**

```bash
npm install --save sharp vibrant chroma-js colorsys
```

**Types:**

```bash
npm install --save-dev @types/vibrant
```

**Optional (for AI features):**

```bash
npm install --save openai  # For Claude/GPT integration
npm install --save @huggingface/inference  # For local ML
```

## API Contract Examples

### Request: Generate Theme from Image

```typescript
POST /v1/tenant-admin/branding/generate
Content-Type: multipart/form-data

{
  image: <binary file>,
  mood: "romantic",
  style: "elegant",
  preferredColors: ["#F7C5C7"]
}
```

### Response: Generated Theme with Variants

```typescript
{
  status: 200,
  body: {
    primary: [
      {
        primaryColor: "#F7C5C7",
        secondaryColor: "#C9A0A4",
        accentColor: "#8B7355",
        fontFamily: "Playfair Display",
        headingFont: "Playfair Display",
        bodyFont: "Inter",
        confidence: 0.92,
        reasoning: "Extracted from uploaded logo",
        palette: ["#F7C5C7", "#C9A0A4", "#8B7355", "#FFFFFF", "#F5F5F5"]
      }
    ],
    alternatives: [
      // 2 more theme variants
    ]
  }
}
```

## Performance Considerations

1. **Image Processing**: Sharp handles 200MB+ files efficiently
2. **Color Extraction**: Vibrant.js uses sampling (configurable)
3. **Palette Generation**: O(n) algorithms using Chroma.js
4. **Caching**: Cache generated themes for 24 hours
5. **Rate Limiting**: 10 generations per tenant per day

## Testing Strategy

### Unit Tests

- Color conversion functions (RGB↔HSL↔HEX)
- Palette harmony algorithms
- WCAG contrast validation
- Font matching logic

### Integration Tests

- Image upload → color extraction pipeline
- API endpoint response validation
- Database storage and retrieval

### E2E Tests

- User uploads image → receives theme → applies branding
- User selects mood → receives suggestions
- Generated theme passes accessibility checks

## Security Considerations

1. **File Validation**
   - Validate image MIME types
   - Limit file size (2-5MB)
   - Scan for malware

2. **Input Validation**
   - Validate mood/style enums
   - Sanitize text inputs
   - Rate limit API calls

3. **Data Privacy**
   - Don't store uploaded images permanently
   - Delete after processing (24 hours)
   - Log access for audit trail

## Success Metrics

- [ ] Color extraction accuracy > 85%
- [ ] Theme generation < 2s response time
- [ ] User adoption rate > 60% (vs. manual)
- [ ] WCAG AA compliance: 100%
- [ ] User satisfaction > 4/5 stars

---

## Quick Links to Code

| Component        | Path                     | Key Lines |
| ---------------- | ------------------------ | --------- |
| Presets          | `BrandingEditor.tsx`     | 44-81     |
| Manual Colors    | `BrandingEditor.tsx`     | 397-430   |
| Font Selection   | `BrandingEditor.tsx`     | 518-555   |
| Contrast Check   | `BrandingEditor.tsx`     | 467-516   |
| API Calls        | `BrandingEditor.tsx`     | 210-263   |
| Upload Service   | `upload.service.ts`      | 108-141   |
| Branding Routes  | `tenant-admin.routes.ts` | 198-250   |
| useBranding Hook | `useBranding.ts`         | 78-99     |
| Color Utils Stub | `ColorPicker.tsx`        | 21-34     |
| Font Loading     | `useBranding.ts`         | 14-46     |
