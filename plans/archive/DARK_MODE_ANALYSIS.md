# Dark Mode Feature Analysis: HANDLED (MAIS) Platform

**Date:** December 27, 2025
**Status:** Analysis Complete
**Scope:** Next.js Storefronts (apps/web) + Legacy Admin (client)

---

## Executive Summary

Dark mode is **not yet implemented** for MAIS. Current state:

- Tailwind config missing `darkMode` setting in both apps
- ThemeProvider placeholder exists in `apps/web/src/app/providers.tsx`
- Vite admin (client) has scattered `dark:` utilities but no theme infrastructure
- Light mode palette fully defined; dark mode tokens missing
- FOUC (Flash of Unstyled Content) risk on SSR due to color flashing

**Key Finding:** The codebase is ready for dark mode—design tokens exist, but theme provider logic and dark color palette are absent.

---

## 1. User Personas and Scenarios

### Primary Personas

#### 1.1 Service Professional (Tenant Storefront User)

- **Role:** Photographer, coach, therapist, wedding planner viewing their HANDLED storefront
- **Usage Time:** Evenings (checking bookings), multiple visits at different times
- **Environment:** Office, home, outdoor (mobile)
- **Pain Point:** Screen brightness at night causes eye strain

**Scenarios:**

- **Evening Browsing:** Coach checking client messages at 9 PM; prefers dark mode to reduce eye strain
- **Mobile Outdoors:** Photographer viewing storefront stats on sunny day; dark mode helps readability
- **System Preference:** Uses device dark mode; expects website to respect it
- **Manual Toggle:** Occasionally wants to switch regardless of system preference

#### 1.2 Admin (Tenant Dashboard User)

- **Role:** Tenant admin managing bookings, settings, analytics
- **Usage Time:** All day, especially mornings and late afternoons
- **Environment:** Office (computer), home office (multiple screens)
- **Pain Point:** Booking dashboard backlight causes fatigue during 8+ hour shifts

**Scenarios:**

- **Long Session:** Admin managing 20+ bookings; needs dark mode after 4 hours
- **Multi-Monitor Setup:** Dark mode on one screen, light on another (system override needed)
- **Accessibility:** Admin with light sensitivity (photophobia); dark mode is medical need
- **Brand Consistency:** Wants dark admin UI matching tenant's custom brand

#### 1.3 Platform Admin (HANDLED Staff)

- **Role:** Monitoring tenants, customer support, system health
- **Usage Time:** 9-5, but often with multiple browser tabs open
- **Environment:** Developer machine, mobile for urgent checks
- **Pain Point:** Rapid context-switching; needs consistent theme across tools

**Scenarios:**

- **Development/QA:** Switching between code editor (dark), browser (currently light), terminal (dark)
- **Customer Support:** Helping tenant debug at night via Zoom (camera-on video call; dark mode reduces glare)

#### 1.4 End User (Visitor to Tenant Storefront)

- **Role:** Potential client booking a service
- **Usage Time:** Any time
- **Environment:** Mobile (mostly), desktop
- **Pain Point:** Landing pages often too bright at night

**Scenarios:**

- **Late Night Browsing:** Potential client researching photographer at 11 PM
- **Incognito Mode:** Checking website in private/incognito window (no persistent storage)
- **Offline Mode:** Partial offline access for saved content (not applicable for storefronts)

---

## 2. Edge Cases and Gotchas

### Critical (Must Handle)

#### 2.1 SSR Hydration Mismatch

**Problem:** Server renders light mode HTML. Browser detects dark system preference and switches to dark mode. FOUC happens.

**Scenario:**

```
1. User with dark system preference visits at 2 AM
2. Server renders light mode (no theme context yet)
3. Browser hydrates, detects dark preference, renders dark
4. 100-200ms white screen flash before dark mode applies
```

**Impact:** Jarring UX, accessibility concern (sudden brightness flicker)

**Solutions:**

- ✅ **Recommended:** Detect theme in middleware/layout before render
- ✅ **Fallback:** Use CSS-in-JS to apply theme before React hydration
- ❌ **Avoid:** CSS media queries only (server can't know client preference)

#### 2.2 localStorage Unavailable (Incognito/Private Mode)

**Problem:** Theme preference stored in localStorage. User in private browsing mode loses preference.

**Scenario:**

```
1. User in Chrome incognito toggles dark mode
2. Preference stored? → No (localStorage throws error or silent-fails)
3. Refresh page → Reverts to system preference
4. User toggles again manually → Frustration
```

**Impact:** Incognito users can't customize; wasted toggle clicks

**Solutions:**

- ✅ Graceful fallback: Try localStorage, catch error, use memory + system preference
- ✅ Try/catch wrapper with logging
- ✅ Consider IndexedDB as secondary storage (still may be blocked)

#### 2.3 System Preference Change While App Open

**Problem:** User changes OS dark mode setting. App doesn't update.

**Scenario:**

```
1. User opens HANDLED at 8 PM in light mode
2. At 2 AM, switches OS to dark mode
3. App stays light mode (theme preference "stale")
4. User expects app to respond to system change
```

**Impact:** Trust erosion; users expect real-time sync with system

**Solutions:**

- ✅ Listen to `prefers-color-scheme` media query changes with `matchMedia().addListener()`
- ✅ Update theme on `change` event
- ❌ Polling system setting (bad UX, battery drain)

#### 2.4 Persistence Across Sessions vs Manual Override

**Problem:** Should system preference update app if user explicitly toggled to light/dark?

**Scenario:**

```
Scenario A (Current behavior):
1. System: dark mode
2. User: manually toggles to light mode
3. User: changes system to light mode
4. App: should stay light (respects override)

Scenario B (Priority question):
1. System: dark mode
2. User: never manually toggles
3. User: changes system to light mode
4. App: should switch to light (follows system)
```

**Impact:** Design decision—affects theme state complexity

**Recommendation:** Track "manual override" state separately from "system preference"

```typescript
interface ThemeState {
  systemPreference: 'light' | 'dark';
  userOverride: 'light' | 'dark' | null; // null = follow system
  effective: 'light' | 'dark'; // computed: override || system
}
```

#### 2.5 Print Mode

**Problem:** Dark mode looks terrible when printing (white text on transparent background).

**Scenario:**

```
1. User on dark mode views booking confirmation
2. Clicks "Print" or Ctrl+P
3. Print preview shows dark mode
4. Prints as unreadable white-on-black PDF
```

**Impact:** Support tickets, invoice disputes

**Solutions:**

- ✅ Force light mode on print media queries: `@media print { body { light mode } }`
- ✅ Add print styles to component classes

#### 2.6 Third-Party Components (Radix UI)

**Problem:** Radix UI and Shadcn components styled with light mode colors by default. Dark mode variants may not exist.

**Components Affected:**

- Dialog boxes (dark background, light text)
- Dropdowns
- Selects
- Tooltips
- Alerts (esp. status alerts)

**Solutions:**

- ✅ Audit all Radix UI usage in components/ui/
- ✅ Add explicit dark: variants to all component classes
- ✅ Test component dark mode in isolation (Storybook/Chromatic would help)

#### 2.7 Embedded Iframes/Widgets

**Problem:** If HANDLED embeds third-party widgets, they may not respond to dark mode.

**Scenarios:**

- Stripe booking widget embedded on partner sites
- Google Calendar widget
- Third-party chatbot

**Impact:** Jarring contrast; looks broken

**Solutions:**

- ✅ Wrap iframes in light-mode container if third-party doesn't support dark
- ✅ Document that embedded widgets only support light mode
- ✅ Provide option to disable dark mode for specific pages

---

### High (Should Handle)

#### 2.8 Tenant Brand Colors in Dark Mode

**Problem:** Tenant customization allows custom brand colors. What happens to custom sage in dark mode?

**Scenario:**

```
Tenant: "My brand color is #E8D5C4 (light tan)"
In dark mode:
- Button with #E8D5C4 text on dark background = 1.2:1 contrast (fail WCAG)
- Text completely unreadable
```

**Impact:** Broken UX for branded tenants; accessibility violation

**Solutions:**

- ✅ Generate dark-mode variants of custom colors (use `color-convert` lib)
- ✅ Require tenants to specify both light and dark brand colors
- ✅ Disable dark mode per-tenant if they don't provide dark colors
- ✅ Show warning: "Your brand color doesn't work in dark mode"

#### 2.9 Overlays and Transparency

**Problem:** Dark overlay on dark background (e.g., modal backdrop) becomes invisible.

**Scenario:**

```
Current: Modal backdrop is `bg-black/40` (semi-transparent black)
In dark mode: Black on dark gray = barely visible
```

**Solutions:**

- ✅ Use `bg-white/20` for dark mode instead
- ✅ Create semantic overlay color: `overlay-light` and `overlay-dark`

#### 2.10 Color Contrast in Dark Mode

**Problem:** Colors with good 4.5:1 contrast in light mode may fail in dark mode.

**Example:**

```
Light mode: text-macon-navy (#1a365d) on cream (#FFFBF8) = 11:1 ✓
Dark mode: text-macon-navy (#1a365d) on dark (#1f2937) = ??? (too dark)
Need: text-macon-navy-50 (#f8fafc) instead
```

**Impact:** WCAG failures; legal/accessibility liability

**Solutions:**

- ✅ Audit contrast for EVERY color combination
- ✅ Create dark-mode-specific color tokens:
  ```css
  @media (prefers-color-scheme: dark) {
    :root {
      --text-primary: #f8fafc; /* was #1a1815 */
      --bg-primary: #1f2937; /* was #ffffff */
    }
  }
  ```

---

### Medium (Nice to Have)

#### 2.11 Animated Transitions When Toggling

**Problem:** Instant theme switch can be disorienting.

**Solution:** Add smooth transition on theme toggle

```css
* {
  transition:
    background-color 200ms,
    color 200ms,
    border-color 200ms;
}
```

**Trade-off:** Performance (more paint operations during transition)

#### 2.12 Dark Mode for Images

**Problem:** Bright hero images look wrong on dark UI.

**Scenario:**

```
Light mode: Bright, cheerful image
Dark mode: Still bright, but UI is dark → Jarring contrast
```

**Solutions:**

- ✅ Dim images with overlay in dark mode: `brightness(0.8)`
- ✅ Use different image for dark mode (designer pick best version)
- ✅ Add "force light background" behind image

#### 2.13 Code Blocks and Pre Elements

**Problem:** If HANDLED displays code (docs, snippets), dark mode is expected.

**Solutions:**

- ✅ Use Prism.js with dark theme
- ✅ Use Shiki for code highlighting

---

### Low (Out of Scope or Tenant-Specific)

#### 2.14 Adaptive Theme (Time-Based)

**Problem:** User might want theme to auto-switch at sunset.

**Solution:** Future feature (not MVP), requires geolocation + sunset times API

#### 2.15 High Contrast Mode

**Problem:** Dark mode + high contrast accessibility setting.

**Solution:** Separate feature; out of scope for this analysis

---

## 3. Tenant-Specific Considerations

### 3.1 Should Tenants Control Dark Mode Availability?

**Option A: Force On (All Tenants)**

- ✅ Consistent experience across all storefronts
- ✅ No per-tenant configuration
- ✅ Better for end users
- ❌ Tenant's brand might not work in dark mode (see section 2.8)

**Option B: Configurable Per Tenant**

- ✅ Tenants with light-only brands can disable it
- ✅ Flexible for premium tiers
- ✅ Better tenant control
- ❌ More UI complexity; support burden
- ❌ Default should be on (don't hide good UX)

**Recommendation:** **Option A (Default On)** with Option B as premium feature

- Launch with dark mode on for all
- Add toggle in tenant settings: "Disable dark mode" (for brands that break)
- Store in `tenant.settings.darkModeEnabled: boolean`

---

### 3.2 Tenant Brand Colors in Dark Mode

**Current State:**

- Tenants can customize `primaryColor`, `secondaryColor`, `accentColor`
- No dark-mode equivalents

**Solutions:**

**Option 1: Auto-Generate Dark Variants**

```typescript
import { lighten } from 'polished'; // or similar

const darkColor = lighten(0.2, tenantBrandColor); // Lighten by 20%
```

- ✅ No tenant effort
- ❌ Auto-generated colors may look bad
- ❌ No contrast checking

**Option 2: Require Dark Colors**

```typescript
interface TenantBrandColors {
  light: { primary: string; secondary: string };
  dark: { primary: string; secondary: string };
}
```

- ✅ Designer-approved colors
- ❌ Extra tenant configuration
- ❌ Most tenants won't fill this in

**Option 3: Hybrid**

- Allow tenants to override auto-generated colors if needed
- Default to auto-generated for most
- Warn if contrast fails: "This color combo has poor contrast in dark mode"

**Recommendation:** **Option 3 (Hybrid)**

- Auto-generate sensible dark variants
- Expose "Advanced: Custom dark mode colors" for design-conscious tenants
- Run WCAG contrast check on save; warn but don't block

---

### 3.3 Per-Page Dark Mode Control

**Question:** Should some tenant pages be light-only?

**Use Cases:**

- Portfolio galleries (photos look better on light)
- Pricing page (designed for light mode)
- Custom HTML blocks (third-party HTML may not be dark-mode compatible)

**Recommendation:** **Out of MVP** but design for it

- Add `Section.darkModeDisabled: boolean` to schema
- If true, force light mode for that section
- Admin UI checkbox: "Force light mode on this section"

---

## 4. Testing Scenarios

### 4.1 Unit Tests

```typescript
// Theme detection
test('should detect system dark preference', () => {
  mockMediaQuery('(prefers-color-scheme: dark)', true);
  expect(getSystemTheme()).toBe('dark');
});

test('should detect system light preference', () => {
  mockMediaQuery('(prefers-color-scheme: light)', true);
  expect(getSystemTheme()).toBe('light');
});

// Persistence
test('should persist theme to localStorage', () => {
  setTheme('dark');
  expect(localStorage.getItem('theme')).toBe('dark');
});

test('should gracefully handle localStorage errors', () => {
  localStorage.setItem = jest.fn(() => {
    throw new Error('QuotaExceeded');
  });
  expect(() => setTheme('dark')).not.toThrow();
});

// System preference changes
test('should update theme when system preference changes', (done) => {
  const listener = jest.fn();
  onThemeChange(listener);

  // Simulate system preference change
  triggerMediaQueryChange('(prefers-color-scheme: dark)');

  setTimeout(() => {
    expect(listener).toHaveBeenCalledWith('dark');
    done();
  }, 50);
});

// Manual override
test('should prioritize manual override over system preference', () => {
  setUserOverride('light');
  mockMediaQuery('(prefers-color-scheme: dark)', true);
  expect(getEffectiveTheme()).toBe('light');
});

test('should clear manual override when user selects "Auto"', () => {
  setUserOverride('light');
  setUserOverride(null);
  mockMediaQuery('(prefers-color-scheme: dark)', true);
  expect(getEffectiveTheme()).toBe('dark');
});
```

### 4.2 Integration Tests

```typescript
// Hydration
test('SSR: should not cause FOUC on dark system', async () => {
  const { container } = render(<App />, {
    ssrTheme: 'light',
    systemTheme: 'dark',
  });

  // Check that dark styles are applied immediately
  expect(container.querySelector('html').classList.contains('dark')).toBe(true);
  expect(getComputedStyle(container.querySelector('body')).backgroundColor)
    .toBe('rgb(31, 41, 55)'); // dark mode bg
});

// Component colors
test('Button should have correct colors in dark mode', () => {
  const { getByRole } = render(<Button>Click me</Button>, {
    theme: 'dark',
  });

  const button = getByRole('button');
  expect(getComputedStyle(button).backgroundColor).toBe('rgb(26, 54, 93)'); // macon-navy in dark
});

// Print mode
test('Print should force light mode', () => {
  const { container } = render(<Page />, { theme: 'dark' });

  // Simulate print media query
  const printStyles = getComputedStyle(container, '@media print');
  expect(printStyles.getPropertyValue('--bg-primary')).toBe('#ffffff');
});
```

### 4.3 E2E Tests (Playwright)

```typescript
// Theme toggle
test('should toggle theme when clicking theme button', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const html = page.locator('html');

  // Check initial theme (system preference)
  await expect(html).toHaveAttribute('data-theme', 'light'); // or dark

  // Click toggle
  await page.locator('[data-testid="theme-toggle"]').click();

  // Check theme switched
  await expect(html).toHaveAttribute('data-theme', 'dark');

  // Reload and check persistence
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

// System preference
test('should respect system dark preference on first visit', async ({ page, context }) => {
  // Set dark system preference
  await context.emulateMedia({ colorScheme: 'dark' });

  await page.goto('http://localhost:3000');
  const html = page.locator('html');

  // Should be dark on first visit
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

// Incognito mode
test('should work in incognito mode', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000');
  const toggle = page.locator('[data-testid="theme-toggle"]');

  // Toggle should work (even if not persisted)
  await toggle.click();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await context.close();
});

// Color contrast
test('should have sufficient contrast in dark mode', async ({ page }) => {
  await context.emulateMedia({ colorScheme: 'dark' });
  await page.goto('http://localhost:3000');

  // Audit with axe
  const results = await page.evaluate(() => axe.run());
  expect(results.violations).toEqual([]);
});

// Print preview
test('should use light colors in print preview', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // In dark mode
  await page.locator('[data-testid="theme-toggle"]').click();

  // Open print preview
  // (Playwright limitation: can't directly access print styles)
  // Alternative: Check CSS @media print rules are applied
  const printCSS = await page.evaluate(() => {
    const stylesheet = document.querySelector('[data-print-styles]');
    return stylesheet?.textContent;
  });

  expect(printCSS).toContain('@media print');
  expect(printCSS).toContain('light'); // force light mode
});
```

### 4.4 Manual Testing Checklist

- [ ] System preference dark → Visit site → Dark on load (no FOUC)
- [ ] System preference light → Visit site → Light on load
- [ ] Toggle theme → Persists across reload
- [ ] Toggle theme → Smooth transition (no flicker)
- [ ] Incognito mode → Toggle → Works (not persisted)
- [ ] Change system preference → App updates automatically
- [ ] Manual override + system change → Override wins
- [ ] Print dark mode page → Print preview shows light mode
- [ ] All buttons/alerts/modals → Correct colors in dark mode
- [ ] Images → Not too bright on dark background
- [ ] Custom tenant color → Readable in dark mode
- [ ] Accessibility audit → No contrast violations
- [ ] Mobile dark mode toggle → Works on all screen sizes
- [ ] Dark mode + high contrast → Still readable

---

## 5. Acceptance Criteria (Gherkin Format)

### Feature: Dark Mode Theme Support

#### Scenario 1: System Preference Detection

```gherkin
Feature: Dark Mode
  Background:
    Given the website is loaded
    And the system preference is dark mode

  Scenario: Detect and apply system dark preference
    When I visit the website for the first time
    Then the page should render in dark mode
    And no white flash should appear before dark mode applies
```

#### Scenario 2: Manual Theme Toggle

```gherkin
Scenario: Toggle between light and dark theme
    Given the page is loaded in light mode
    And the theme toggle button is visible
    When I click the theme toggle button
    Then the page should switch to dark mode
    And the transition should be smooth (no flicker)
    And the effective colors should all be dark mode variants

Scenario: Persist theme preference
    Given I have toggled to dark mode
    When I refresh the page
    Then the page should load in dark mode

Scenario: Persist theme across different URLs
    Given I have toggled to dark mode on the home page
    When I navigate to the about page
    Then the about page should also be in dark mode
```

#### Scenario 3: System Preference Change

```gherkin
Scenario: Respond to system preference change
    Given the website is open in light mode
    And my system preference is light mode
    When I change the system preference to dark mode
    Then the website should automatically switch to dark mode within 1 second
    And the header should update first (no cascading flicker)

Scenario: Manual override takes precedence
    Given the system preference is dark mode
    And I have manually toggled to light mode
    When the system preference changes to light mode
    Then the website should stay in light mode
    And when the system preference changes to dark mode
    Then the website should still stay in light mode
    And the toggle button should show "override active" state
```

#### Scenario 4: Incognito/Private Mode

```gherkin
Scenario: Theme toggle works in private browsing
    Given I am in private/incognito mode
    When I toggle the theme
    Then the theme should change on the page

Scenario: Theme is not persisted in incognito
    Given I am in private/incognito mode
    And I have toggled to dark mode
    When I reload the page
    Then the page should revert to system preference
    And the toggle should show system preference state
```

#### Scenario 5: Print Mode

```gherkin
Scenario: Force light mode for printing
    Given the website is in dark mode
    When I open the print preview
    Then the preview should show light mode colors
    And text should be black on white (readable)

Scenario: Print CSS should not affect screen view
    Given the website is in dark mode
    When I close the print preview
    Then the website should still be in dark mode
```

#### Scenario 6: Component Colors in Dark Mode

```gherkin
Scenario: All components have correct dark mode colors
    Given the page is in dark mode
    Then all buttons should use dark mode color variants
    And all text should have sufficient contrast (WCAG AA)
    And all backgrounds should be dark or dark-compatible
    And all borders should be visible
    And all status alerts (error, warning, success) should use dark variants

Scenario: Radix UI components respect theme
    Given a Dialog component is rendered in dark mode
    And the dialog contains various input elements
    When the dialog is displayed
    Then the dialog background should be dark
    And all text should be light
    And all form inputs should have dark mode styling
```

#### Scenario 7: Third-Party Components

```gherkin
Scenario: Third-party components degrade gracefully
    Given a third-party widget (e.g., Stripe) is embedded
    And the page is in dark mode
    And the third-party widget does not support dark mode
    Then the widget should be wrapped in a light mode container
    Or the widget should display with reduced opacity
    And the page should remain functional
```

#### Scenario 8: Tenant Brand Colors

```gherkin
Scenario: Tenant custom colors work in dark mode
    Given a tenant has set a custom brand color of #E8D5C4 (light tan)
    When the page is in dark mode
    Then the brand color should be adjusted for dark mode readability
    Or the admin should be warned: "This color has poor contrast in dark mode"

Scenario: Tenant can override dark mode colors
    Given a tenant with custom colors
    When the tenant visits the admin panel
    And selects "Advanced Settings" → "Dark Mode Colors"
    Then the tenant should be able to specify custom dark variants
    And a WCAG contrast check should validate the choices
```

#### Scenario 9: Accessibility

```gherkin
Scenario: Dark mode maintains accessibility
    Given the page is in dark mode
    When I run an accessibility audit (axe, pa11y)
    Then there should be no contrast violations
    And the color ratio should be >= 4.5:1 for normal text
    And the color ratio should be >= 3:1 for large text

Scenario: High contrast mode works with dark theme
    Given I have high contrast accessibility setting enabled
    When I toggle to dark mode
    Then all colors should be even more saturated/distinct
    Or the page should warn that dark mode + high contrast may not be optimal
```

#### Scenario 10: Mobile Dark Mode

```gherkin
Scenario: Dark mode works on mobile
    Given I am on a mobile device
    When I open the website
    And the system dark mode is enabled
    Then the mobile page should render in dark mode

Scenario: Mobile toggle button is accessible
    Given the mobile viewport is active
    And the theme toggle button is visible
    When I tap the toggle button
    Then the theme should change
    And the button should have sufficient size (min 44x44px)
    And the button should have visible focus state
```

---

## 6. Component Audit: Dark Mode Support Needed

### High Priority (User-Facing)

**Tenant Storefronts (apps/web/src/components/tenant/sections/):**

- [ ] HeroSection.tsx - Background overlays, text colors
- [ ] TextSection.tsx - Text contrast
- [ ] GallerySection.tsx - Image overlays, captions
- [ ] TestimonialsSection.tsx - Card backgrounds, text
- [ ] FAQSection.tsx - Accordion backgrounds
- [ ] CTASection.tsx - Button colors, background
- [ ] PricingSection.tsx - Card backgrounds, pricing badges
- [ ] ContactSection.tsx - Form inputs, labels
- [ ] FeaturesSection.tsx - Feature cards, icons

**Shared UI Components (apps/web/src/components/ui/):**

- [ ] Button.tsx - Background, text, hover states
- [ ] Card.tsx - Background, border
- [ ] Input.tsx - Border, background, placeholder text
- [ ] Select.tsx - Dropdown backgrounds
- [ ] Dialog.tsx - Modal background, overlay
- [ ] Alert.tsx - All status colors (danger, warning, success, info)
- [ ] Badge.tsx - Background, text
- [ ] Tooltip.tsx - Background, text, arrow
- [ ] Tabs.tsx - Tab backgrounds, active state
- [ ] Label.tsx - Text color
- [ ] Separator.tsx - Border color

### Medium Priority (Admin)

**Admin Components (client/src/features/):**

- [ ] BlackoutsManager - Already has scattered dark: utilities; needs audit
- [ ] AvailabilityRulesManager - Already has scattered dark: utilities; needs consistency
- [ ] TenantAdmin dashboard pages
- [ ] Forms and inputs
- [ ] Tables and data displays

### Low Priority (Content)

**Marketing/Landing (client/):**

- [ ] Homepage sections
- [ ] Pricing page
- [ ] Documentation pages (if any)

---

## 7. Architecture Recommendations

### 7.1 Theme Provider Implementation

**Recommended Pattern: React Context + System Listener**

```typescript
// lib/theme-context.tsx
interface ThemeContextType {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  systemTheme: 'light' | 'dark';
  userOverride: 'light' | 'dark' | null;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

// Provider component
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const [userOverride, setUserOverride] = useState<'light' | 'dark' | null>(null);

  const theme = userOverride || systemTheme;

  useEffect(() => {
    // Detect system preference
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(media.matches ? 'dark' : 'light');

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', handler);

    // Load saved preference
    try {
      const saved = localStorage.getItem('theme-override');
      if (saved === 'light' || saved === 'dark') {
        setUserOverride(saved);
      }
    } catch (e) {
      // Incognito mode or storage disabled
    }

    // Apply theme to DOM
    document.documentElement.classList.toggle('dark', theme === 'dark');

    return () => media.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (value: 'light' | 'dark' | 'system') => {
    if (value === 'system') {
      setUserOverride(null);
      try {
        localStorage.removeItem('theme-override');
      } catch {}
    } else {
      setUserOverride(value);
      try {
        localStorage.setItem('theme-override', value);
      } catch {}
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, systemTheme, userOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

### 7.2 SSR Hydration Fix

**Use Next.js Script Strategy:**

```typescript
// app/layout.tsx
export default function RootLayout() {
  return (
    <html>
      <head>
        {/* Inject theme detection script BEFORE React renders */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const override = localStorage.getItem('theme-override');
                  const theme = override || (
                    window.matchMedia('(prefers-color-scheme: dark)').matches
                      ? 'dark'
                      : 'light'
                  );
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 7.3 Tailwind Configuration

```js
// apps/web/tailwind.config.js
module.exports = {
  darkMode: 'class', // Use class-based dark mode, not prefers-color-scheme
  theme: {
    extend: {
      colors: {
        // Light mode (default)
        background: '#ffffff',
        foreground: '#111827', // neutral-900

        // Dark mode (add dark: variants)
        // Tailwind will apply when <html class="dark"> exists

        // Brand colors with dark variants
        sage: '#7B9E87',
        'sage-dark': '#A3BBA9', // lighter in dark mode

        // ... rest of colors
      },
    },
  },
};
```

### 7.4 CSS Custom Properties Fallback

For complex color logic, use CSS variables:

```css
/* styles/globals.css */
:root {
  --bg-primary: #ffffff;
  --text-primary: #1a1815;
  --sage: #7b9e87;
  /* ... etc */
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1f2937;
    --text-primary: #f8fafc;
    --sage: #a3bba9;
  }
}

/* Class-based override (for manual toggle) */
.dark {
  --bg-primary: #1f2937;
  --text-primary: #f8fafc;
  --sage: #a3bba9;
}
```

---

## 8. Risk Assessment

### Critical Risks

| Risk                             | Likelihood | Impact                 | Mitigation                                    |
| -------------------------------- | ---------- | ---------------------- | --------------------------------------------- |
| FOUC (white flash)               | High       | Critical UX regression | Inject theme script before hydration          |
| Accessibility violations         | High       | Legal/compliance issue | Audit all colors with WebAIM contrast checker |
| Third-party component breakage   | Medium     | Support burden         | Test all Radix UI components in dark mode     |
| localStorage errors in incognito | High       | Broken in private mode | Try/catch wrapper + graceful fallback         |
| Tenant colors unreadable         | Medium     | Support tickets        | Auto-generate dark variants + validation      |

### Medium Risks

| Risk                              | Likelihood | Impact                     | Mitigation                             |
| --------------------------------- | ---------- | -------------------------- | -------------------------------------- |
| Print mode still uses dark colors | Medium     | Users can't print invoices | Force light mode with @media print     |
| Images too bright on dark         | Low        | Visual jarring             | Add brightness overlay in dark mode    |
| Performance: theme switching      | Low        | Jank during toggle         | Use CSS transitions, avoid JS repaints |

---

## 9. Implementation Roadmap

### Phase 1: Foundation (1-2 sprints)

- [ ] Configure Tailwind `darkMode: 'class'`
- [ ] Create ThemeProvider + context hook
- [ ] Add SSR hydration fix script
- [ ] Audit all shared UI components
- [ ] Add dark color tokens to Tailwind
- [ ] Create dark: variants for all buttons, cards, inputs

### Phase 2: Components (1-2 sprints)

- [ ] Add dark mode to tenant section components
- [ ] Add dark mode to admin dashboard components
- [ ] Test Radix UI components in dark mode
- [ ] Fix modal/dialog overlays
- [ ] Audit print mode

### Phase 3: Polish (0.5-1 sprint)

- [ ] Smooth transitions on toggle
- [ ] Mobile dark mode toggle button
- [ ] Tenant brand color dark variants
- [ ] Accessibility audit
- [ ] E2E tests

### Phase 4: Quality (0.5 sprint)

- [ ] Manual testing checklist
- [ ] Documentation
- [ ] Support playbook ("dark mode broken")

---

## 10. Success Metrics

- [ ] 100% of components render correctly in dark mode
- [ ] 0 WCAG contrast violations in dark mode
- [ ] 0 FOUC (Flash of Unstyled Content) on page load
- [ ] Theme preference persists across sessions
- [ ] System preference changes trigger app update within 1s
- [ ] Incognito mode doesn't throw errors
- [ ] 95%+ pass rate on accessibility audit (axe)
- [ ] Print mode renders in light mode correctly
- [ ] All E2E tests pass
- [ ] No support tickets about dark mode breaking

---

## 11. Next Steps

1. **Prioritize:** Decide if dark mode is MVP or phase-2 feature
2. **Design Tokens:** Define complete dark color palette with designer
3. **Spike:** Create proof-of-concept ThemeProvider with 2-3 components
4. **Audit:** Full accessibility audit of dark colors (WebAIM contrast checker)
5. **Plan:** Create Jira tickets for each component
6. **Test Strategy:** Set up visual regression testing (Chromatic, Percy)

---

## Appendix: Color Palette (Draft)

### Light Mode (Existing)

```
Background: #FFFBF8 (cream)
Text Primary: #1A1815 (deep charcoal)
Text Muted: #4A4440 (medium charcoal)
Sage: #7B9E87
```

### Dark Mode (To Be Defined)

```
Background: #1F2937 (neutral-800)
Text Primary: #F8FAFC (neutral-50)
Text Muted: #CBD5E1 (neutral-200)
Sage: #A3BBA9 (lighter variant)

Status Colors:
  Success: #10B981 (green-500) → #6EE7B7 (green-300) in dark
  Warning: #F59E0B (amber-500) → #FBBF24 (amber-300) in dark
  Danger: #EF4444 (red-500) → #FCA5A5 (red-300) in dark
  Info: #3B82F6 (blue-500) → #93C5FD (blue-300) in dark
```

**Status:** Draft pending designer review and WCAG validation

---

## References

- Tailwind Dark Mode: https://tailwindcss.com/docs/dark-mode
- Next.js Dark Mode: https://github.com/pacocoursey/next-themes
- WCAG Contrast: https://webaim.org/articles/contrast/
- CSS Media Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries
- Prefers Color Scheme: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
- Print CSS: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/print
- Accessibility Testing: https://www.axe-core.org/

---

**Document Status:** Analysis Complete | Ready for Implementation Planning
