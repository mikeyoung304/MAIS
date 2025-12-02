# MAIS Theme Zones Documentation

**Created**: November 17, 2025
**Purpose**: Define which pages use light theme vs dark theme for consistent UI/UX

---

## Theme Strategy

The MAIS application uses **two distinct theme zones** to optimize user experience:

### 🌞 **Light Theme** - Customer-Facing Pages
- **Purpose**: Welcoming, clean, professional browsing and booking experience
- **Colors**: White backgrounds, neutral grays, Macon brand colors for accents
- **Target Users**: Couples browsing packages, booking services, viewing confirmations

### 🌙 **Dark Theme** - Admin-Facing Pages
- **Purpose**: Focused, productive work environment for business operations
- **Colors**: Navy backgrounds (Macon Navy #1a365d), reduced eye strain for long sessions
- **Target Users**: Platform administrators, tenant administrators managing operations

---

## Customer-Facing Pages (Light Theme)

These pages should use **light backgrounds** (white, gray-50, neutral-50):

| Page | File Path | Status | Priority |
|------|-----------|--------|----------|
| Homepage | `/pages/Home.tsx` | ✅ CORRECT | - |
| Package Catalog | `/features/catalog/CatalogGrid.tsx` | ❌ DARK | HIGH |
| Package Details | `/features/catalog/PackagePage.tsx` | ❌ DARK | HIGH |
| Date Picker | `/features/booking/DatePicker.tsx` | ❌ DARK | HIGH |
| Add-On Selection | `/features/booking/AddOnList.tsx` | ❌ DARK | HIGH |
| Success Page | `/pages/success/Success.tsx` | ❌ DARK | MEDIUM |
| Success Content | `/pages/success/SuccessContent.tsx` | ❌ DARK | MEDIUM |

### Light Theme Color Palette

```css
/* Backgrounds */
bg-white
bg-gray-50
bg-neutral-50

/* Text */
text-gray-900
text-gray-700
text-gray-600

/* Borders */
border-gray-200
border-gray-300

/* Cards */
bg-white with shadow-elevation-1 or shadow-elevation-2

/* Accents */
bg-macon-orange (buttons, CTAs)
bg-macon-teal (secondary actions)
text-macon-navy (headings, emphasis)
```

---

## Admin-Facing Pages (Dark Theme)

These pages should use **dark backgrounds** (navy-800, navy-900):

| Page | File Path | Status |
|------|-----------|--------|
| Login | `/pages/Login.tsx` | ✅ CORRECT |
| Platform Admin Dashboard | `/pages/admin/PlatformAdminDashboard.tsx` | ✅ CORRECT |
| Platform Admin Components | `/features/admin/Dashboard.tsx` | ✅ CORRECT |
| Platform Package Manager | `/features/admin/PackagesManager.tsx` | ✅ CORRECT |
| Tenant Dashboard | `/pages/tenant/TenantAdminDashboard.tsx` | ✅ CORRECT |
| Tenant Components | `/features/tenant-admin/TenantDashboard.tsx` | ✅ CORRECT |
| Tenant Package Manager | `/features/tenant-admin/TenantPackagesManager.tsx` | ✅ CORRECT |
| Branding Editor | `/features/tenant-admin/BrandingEditor.tsx` | ✅ CORRECT |

### Dark Theme Color Palette

```css
/* Backgrounds */
bg-macon-navy-900
bg-macon-navy-800
bg-macon-navy-700

/* Text */
text-macon-navy-50
text-macon-navy-100
text-macon-navy-200

/* Borders */
border-macon-navy-600
border-macon-navy-700

/* Cards */
bg-macon-navy-800 with border-macon-navy-600

/* Accents */
bg-macon-orange (primary actions)
bg-macon-teal (secondary actions)
```

---

## Conversion Requirements

### HIGH PRIORITY (Booking Flow)

**Files to Convert:**
1. `/features/catalog/CatalogGrid.tsx`
2. `/features/catalog/PackagePage.tsx`
3. `/features/booking/DatePicker.tsx`
4. `/features/booking/AddOnList.tsx`

**Key Changes:**
- Replace `bg-macon-navy-800` → `bg-white`
- Replace `bg-macon-navy-900` → `bg-gray-50`
- Replace `text-macon-navy-50` → `text-gray-900`
- Replace `text-macon-navy-100` → `text-gray-700`
- Replace `border-macon-navy-600` → `border-gray-200`

### MEDIUM PRIORITY (Success Pages)

**Files to Convert:**
1. `/pages/success/Success.tsx`
2. `/pages/success/SuccessContent.tsx`

**Rationale:** Success confirmation should feel celebratory and bright, not dark.

---

## Design Principles

### Light Theme Guidelines
- Use ample white space and generous padding
- Cards should have subtle shadows (`shadow-elevation-1` or `shadow-elevation-2`)
- Brand colors (orange, teal) for accents and CTAs only
- Text should have strong contrast (gray-900 on white)
- Borders should be subtle (gray-200, gray-300)

### Dark Theme Guidelines
- Maintain navy background hierarchy (900 > 800 > 700)
- Text should be light but not pure white (navy-50, navy-100)
- Cards should have border definition rather than shadows
- Orange accent for primary actions (stands out on dark)
- Avoid pure black backgrounds (use navy tones)

---

## Validation Checklist

After converting customer-facing pages:

- [ ] Package catalog cards have white/light backgrounds
- [ ] DatePicker calendar uses light theme with brand color accents
- [ ] Add-on selection cards are light themed with visible selection states
- [ ] Success page feels bright and celebratory
- [ ] All customer-facing text is dark on light (high contrast)
- [ ] Admin pages remain dark themed (no accidental changes)
- [ ] Theme boundary is clear: customers see light, admins see dark

---

## Implementation Status

**Analysis Complete**: November 17, 2025
**Conversions Pending**: 7 customer-facing pages
**Current Score**: 12/19 pages correctly themed (63%)
**Target Score**: 19/19 pages correctly themed (100%)

---

## Notes

- **Homepage already correct**: Use `Home.tsx` as reference for light theme implementation
- **Admin pages stable**: No changes needed to admin interfaces
- **Booking flow critical**: Highest priority for conversion (customers see these most)
- **Maintain brand consistency**: Use Macon colors for accents in both themes
