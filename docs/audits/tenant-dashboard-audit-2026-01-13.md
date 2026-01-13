# Tenant Dashboard Audit - January 13, 2026

**Objective:** Audit every button, link, and interactive element on the tenant-facing dashboard to achieve Apple-quality minimalism. Remove bloat, unnecessary buttons, sidebars that don't make sense, links to dead pages, etc.

---

## Executive Summary

The tenant dashboard currently has:

- **8 primary navigation items** in the sidebar
- **15+ action buttons** across the dashboard page
- **Multiple redundant pathways** to the same destination
- **Questionable "Site Builder" pattern** that just redirects back to dashboard with a query param
- **Settings page with disabled/placeholder features** (Business Settings, Delete Account)
- **API Keys section** that users may never need
- **Billing page** separate from dashboard (potential consolidation opportunity)

---

## Complete Inventory: Tenant Dashboard

### 1. SIDEBAR NAVIGATION (8 items)

| #   | Item       | Path                 | Icon            | Description                   | Justification                             |
| --- | ---------- | -------------------- | --------------- | ----------------------------- | ----------------------------------------- |
| 1   | Dashboard  | `/tenant/dashboard`  | LayoutDashboard | Overview and metrics          | ✅ **KEEP** - Central hub                 |
| 2   | Packages   | `/tenant/packages`   | Package         | Manage your offerings         | ✅ **KEEP** - Core business function      |
| 3   | Scheduling | `/tenant/scheduling` | Calendar        | Availability and appointments | ✅ **KEEP** - Core business function      |
| 4   | Branding   | `/tenant/branding`   | Palette         | Colors, logo, and style       | ⚠️ **QUESTION** - Could merge with Pages? |
| 5   | Pages      | `/tenant/pages`      | FileText        | Manage website pages          | ✅ **KEEP** - Essential for storefront    |
| 6   | Payments   | `/tenant/payments`   | CreditCard      | Stripe Connect setup          | ✅ **KEEP** - Required for revenue        |
| 7   | Domains    | `/tenant/domains`    | Globe           | Custom domain setup           | ⚠️ **ADVANCED** - Move to Settings?       |
| 8   | Settings   | `/tenant/settings`   | Settings        | Account settings              | ⚠️ **BLOATED** - Has unused features      |

**Sidebar Footer:**

- User email display
- User role badge
- Logout button (duplicate of Settings page logout)

**Sidebar Controls:**

- Collapse/expand toggle (desktop only)
- Mobile hamburger menu
- Close button (mobile overlay)

---

### 2. DASHBOARD PAGE (`/tenant/dashboard`)

#### A. Header Elements

- **Welcome message** with personalized greeting - ✅ Good UX
- **Overview subtitle** - ✅ Good UX

#### B. Trial Banner (Conditional)

- Displays if status is TRIALING or EXPIRED
- Shows days remaining
- **CTA:** "Upgrade Now" → redirects to `/tenant/billing`
- **Justification:** ✅ Essential for trial management

#### C. Start Trial Card (Conditional)

- Displays if `canStartTrial === true` (has packages but no trial)
- **Button:** "Start Trial" → API call
- **Justification:** ✅ Essential for trial activation

#### D. Error Card (Conditional)

- **Button:** "Retry" (with refresh icon) → re-fetches dashboard data
- **Justification:** ✅ Good error recovery UX

#### E. Stats Cards (4 cards, ALL clickable)

| #   | Title          | Value                  | Icon       | Links To             | Justification                                                        |
| --- | -------------- | ---------------------- | ---------- | -------------------- | -------------------------------------------------------------------- |
| 1   | Packages       | Count                  | Package    | `/tenant/packages`   | ✅ **KEEP** - Quick metric + navigation                              |
| 2   | Bookings       | Count                  | Calendar   | `/tenant/scheduling` | ✅ **KEEP** - Key business metric                                    |
| 3   | Blackout Dates | Count                  | Users      | `/tenant/scheduling` | ⚠️ **QUESTION** - Wrong icon (Users), goes to same place as Bookings |
| 4   | Payments       | "Connected" or "Setup" | DollarSign | `/tenant/payments`   | ✅ **KEEP** - Critical status indicator                              |

**Issues:**

1. **Stat Card #3 uses Users icon for "Blackout Dates"** - Semantically incorrect
2. **Cards #2 and #3 both link to `/tenant/scheduling`** - Redundant destinations

#### F. Quick Actions (3-4 cards)

| #   | Title           | Description                      | Icon         | Links To               | Highlight               | Justification                                  |
| --- | --------------- | -------------------------------- | ------------ | ---------------------- | ----------------------- | ---------------------------------------------- |
| 1   | Site Builder    | Preview and edit your storefront | Palette      | `/tenant/build`        | ✅ Yes (sage highlight) | ❌ **REMOVE** - Dead redirect (see below)      |
| 2   | Manage Pages    | Configure your website pages     | FileEdit     | `/tenant/pages`        | No                      | ⚠️ **DUPLICATE** - Sidebar already has "Pages" |
| 3   | View Storefront | See your public booking page     | ExternalLink | `/t/{slug}` (external) | No                      | ✅ **KEEP** - Useful external link             |

**Critical Issue: "Site Builder" is a Fake Page**

- Path: `/tenant/build/page.tsx`
- Implementation: **Server-side redirect** to `/tenant/dashboard?showPreview=true`
- Effect: Opens preview mode in agent panel
- **Verdict:** ❌ **REMOVE THIS ENTIRE CARD** - It's just a way to trigger `agentUIActions.showPreview('home')`. This should be handled by the Agent Panel directly, not a fake navigation item.

#### G. Stripe Setup Prompt (Conditional)

- Shows if `hasStripeConnected === false`
- **Card:** Amber warning card
- **Button:** "Connect Stripe" → `/tenant/payments`
- **Justification:** ✅ Essential onboarding nudge

---

### 3. PACKAGES PAGE (`/tenant/packages`)

#### Header

- **Title:** "Packages"
- **Button:** "Create Package" (sage) → Opens create dialog

#### Package Cards (Grid)

- **Photo Thumbnails** (aspect-video)
- **Photo Count Badge**
- **Active/Inactive Status Badge**
- **Price Display** with DollarSign icon
- **Deposit Amount** (if set)

#### Actions per Package

| Action | Style                     | Function                   | Justification |
| ------ | ------------------------- | -------------------------- | ------------- |
| Edit   | Outline button            | Opens PhotoUploader dialog | ✅ **KEEP**   |
| Delete | Outline button (red text) | Deletes package            | ✅ **KEEP**   |

#### Empty State

- Icon + "No packages yet"
- **Button:** "Create Your First Package"

---

### 4. SCHEDULING OVERVIEW (`/tenant/scheduling`)

#### Stats Cards (4 cards, ALL clickable)

| #   | Title             | Links To                               | Justification |
| --- | ----------------- | -------------------------------------- | ------------- |
| 1   | Total Bookings    | `/tenant/scheduling/appointments`      | ✅ **KEEP**   |
| 2   | Blackout Dates    | `/tenant/scheduling/blackouts`         | ✅ **KEEP**   |
| 3   | Appointment Types | `/tenant/scheduling/appointment-types` | ✅ **KEEP**   |
| 4   | Availability      | `/tenant/scheduling/availability`      | ✅ **KEEP**   |

#### Quick Access Sections (2 columns)

**1. Upcoming Bookings**

- Shows next 7 days
- Up to 3 bookings
- Date, package name, status badge
- **Link:** "View all" → `/tenant/scheduling/appointments`

**2. Upcoming Blackouts**

- Shows next 3 blackout periods
- Date range and reason
- **Link:** "Manage" → `/tenant/scheduling/blackouts`

**Justification:** ✅ Good overview/drill-down pattern

---

### 5. SCHEDULING SUB-PAGES

#### A. Appointments (`/tenant/scheduling/appointments`)

- Table or card view of bookings
- **No buttons** documented in exploration - ⚠️ **VERIFY IMPLEMENTATION**

#### B. Availability (`/tenant/scheduling/availability`)

- Set working hours
- **No buttons** documented - ⚠️ **VERIFY IMPLEMENTATION**

#### C. Blackouts (`/tenant/scheduling/blackouts`)

- Block out dates
- **No buttons** documented - ⚠️ **VERIFY IMPLEMENTATION**

#### D. Appointment Types (`/tenant/scheduling/appointment-types`)

- Configure appointment types
- **No buttons** documented - ⚠️ **VERIFY IMPLEMENTATION**

**Issue:** These sub-pages were not explored in detail. Need to audit.

---

### 6. BRANDING PAGE (`/tenant/branding`)

#### Form Inputs (Left Column)

| Input            | Type                     | Justification                                    |
| ---------------- | ------------------------ | ------------------------------------------------ |
| Primary Color    | Color picker + hex input | ✅ **KEEP**                                      |
| Secondary Color  | Color picker + hex input | ✅ **KEEP**                                      |
| Accent Color     | Color picker + hex input | ✅ **KEEP**                                      |
| Background Color | Color picker + hex input | ✅ **KEEP**                                      |
| Font Family      | Dropdown (6 options)     | ✅ **KEEP**                                      |
| Logo URL         | Text input               | ⚠️ **CONSIDER** - Should be file upload, not URL |

#### Actions

- **Button:** "Save Branding" (sage, full-width, rounded-full)

#### Live Preview (Right Column)

- Dynamic color/font preview
- Logo preview or placeholder
- Sample "Book Now" button
- Sample content card

#### Status Messages

- Success card (sage/green with CheckCircle)
- Error card (red with AlertCircle)

**Justification:** ✅ Essential for white-label customization

---

### 7. PAGES MANAGEMENT (`/tenant/pages`)

#### Header

- Title + description
- **Preview link:** `/t/{slug}` (external)
- **Button:** "Save Changes" (sage) with status indicators

#### Home Page Card (Always Enabled)

| Element                   | Type    | Links To               | Justification            |
| ------------------------- | ------- | ---------------------- | ------------------------ |
| Home icon                 | Visual  | N/A                    | ✅ Good visual hierarchy |
| Section count badge       | Display | N/A                    | ✅ Useful info           |
| Preview button (eye icon) | Link    | `/t/{slug}` (external) | ✅ **KEEP**              |
| Edit button (pencil icon) | Link    | `/tenant/pages/home`   | ✅ **KEEP**              |
| "Always On" label         | Display | N/A                    | ✅ Clear status          |

#### Optional Page Cards (6 pages)

- About, Services, Gallery, Testimonials, FAQ, Contact

| Element                   | Type    | Links To                   | Conditional     | Justification               |
| ------------------------- | ------- | -------------------------- | --------------- | --------------------------- |
| Page icon                 | Visual  | N/A                        | Always          | ✅ Good visual hierarchy    |
| Section count badge       | Display | N/A                        | Always          | ✅ Useful info              |
| Preview button (eye icon) | Link    | `/t/{slug}/{pageType}`     | Only if enabled | ✅ **KEEP**                 |
| Edit button (pencil icon) | Link    | `/tenant/pages/{pageType}` | Only if enabled | ✅ **KEEP**                 |
| ON/OFF label              | Display | N/A                        | Always          | ✅ Clear status             |
| Toggle switch             | Input   | N/A                        | Always          | ✅ **KEEP** - Core function |

#### Warning Card (Conditional)

- Shows if all optional pages disabled
- Amber AlertCircle icon

**Justification:** ✅ Clean toggle pattern, good UX

---

### 8. PAGE EDITOR (`/tenant/pages/[pageType]`)

**Status:** ⚠️ **NOT EXPLORED** - Need to audit buttons/actions on individual page editors

---

### 9. PAYMENTS (STRIPE CONNECT) (`/tenant/payments`)

#### No Account State

| Element                           | Type          | Function               | Justification       |
| --------------------------------- | ------------- | ---------------------- | ------------------- |
| Empty card with CreditCard icon   | Display       | N/A                    | ✅ Good empty state |
| "Connect Stripe" button           | Button (sage) | Opens setup dialog     | ✅ **KEEP**         |
| Setup Dialog: Email input         | Form          | Validation required    | ✅ **KEEP**         |
| Setup Dialog: Business name input | Form          | 2-100 chars            | ✅ **KEEP**         |
| Setup Dialog: Submit button       | Button        | Creates Stripe account | ✅ **KEEP**         |

#### Has Account State

| Element                          | Type             | Function                | Justification                         |
| -------------------------------- | ---------------- | ----------------------- | ------------------------------------- |
| Account ID (copyable, monospace) | Display          | Shows ID                | ⚠️ **QUESTION** - Do users need this? |
| Charges Enabled indicator        | Display          | Check/X icon            | ✅ **KEEP** - Critical status         |
| Payouts Enabled indicator        | Display          | Check/X icon            | ✅ **KEEP** - Critical status         |
| Details Submitted indicator      | Display          | Check/X icon            | ✅ **KEEP** - Critical status         |
| Requirements Warning (amber)     | Display          | Lists past due items    | ✅ **KEEP** - Important               |
| "Complete Setup" button          | Button (sage)    | Opens Stripe onboarding | ✅ **KEEP** - Essential CTA           |
| "Open Stripe Dashboard" button   | Button (outline) | Opens external link     | ✅ **KEEP** - Power user feature      |

**Justification:** ✅ Stripe integration is core revenue function

---

### 10. BILLING (SUBSCRIPTION) (`/tenant/billing`)

#### Current Plan Status Card

- Active: Green card "Active: {tier} Plan"
- Trialing: Sage card with days remaining

#### AI Usage Card

- Sparkles icon
- Shows used/limit/remaining messages
- Upgrade prompt for FREE/STARTER tiers

#### Pricing Tiers (2 cards)

| Tier        | Price      | Badge          | Button Text               | Button State           | Justification                              |
| ----------- | ---------- | -------------- | ------------------------- | ---------------------- | ------------------------------------------ |
| Starter     | $49/month  | None           | "Get Starter"             | Enabled if not current | ✅ **KEEP**                                |
| Growth      | $150/month | "Most Popular" | "Get Growth"              | Enabled if not current | ✅ **KEEP**                                |
| (Current)   | N/A        | "Current Plan" | "Current Plan"            | Disabled (green)       | ✅ Good status indicator                   |
| (Downgrade) | N/A        | None           | "Downgrade not available" | Disabled               | ⚠️ **CONSIDER** - Hide instead of disable? |

#### Messages (Conditional)

- Success: "Payment successful! Your subscription is now active."
- Canceled: "Checkout was canceled. No charges were made."

**Questions:**

1. **Why is Billing separate from Dashboard?** Could be a card on the dashboard instead of a full page.
2. **No way to view invoice history?** Missing feature or intentional simplicity?
3. **Why show disabled "Downgrade not available" button?** Better to hide it entirely.

---

### 11. DOMAINS PAGE (`/tenant/domains`)

#### Add Domain Form

| Element             | Type          | Function                      | Justification |
| ------------------- | ------------- | ----------------------------- | ------------- |
| Domain input        | Text input    | "www.example.com" placeholder | ✅ **KEEP**   |
| "Add Domain" button | Button (sage) | Adds domain                   | ✅ **KEEP**   |

#### Domain Cards (per domain)

| Element                          | Type                  | Function                           | Conditional               | Justification |
| -------------------------------- | --------------------- | ---------------------------------- | ------------------------- | ------------- |
| Domain name (monospace)          | Display               | N/A                                | Always                    | ✅ **KEEP**   |
| "Primary" badge                  | Badge                 | N/A                                | If primary                | ✅ **KEEP**   |
| Status badge                     | Badge                 | Verified (green) / Pending (amber) | Always                    | ✅ **KEEP**   |
| DNS Configuration section        | Display               | Shows TXT record                   | If unverified             | ✅ **KEEP**   |
| Record Name                      | Display (copyable)    | `_handled-verify.{domain}`         | If unverified             | ✅ **KEEP**   |
| Record Value                     | Display (copyable)    | `handled-verify={token}`           | If unverified             | ✅ **KEEP**   |
| "Verify" button (refresh icon)   | Button (outline)      | Re-checks verification             | If unverified             | ✅ **KEEP**   |
| "Set Primary" button (star icon) | Button (outline)      | Sets as primary                    | If verified & not primary | ✅ **KEEP**   |
| "Delete" button (trash icon)     | Button (outline, red) | Deletes domain                     | Always                    | ✅ **KEEP**   |

#### Help Section

- 5-step numbered guide for custom domain setup

**Questions:**

1. **Is custom domain a beginner feature?** Feels advanced. Could move to Settings → Advanced.
2. **Should this be a top-level nav item?** Only power users need this.

---

### 12. SETTINGS PAGE (`/tenant/settings`)

#### Account Information Card

| Element                          | Type  | Function     | Justification                                |
| -------------------------------- | ----- | ------------ | -------------------------------------------- |
| Email (read-only)                | Input | Display only | ✅ **KEEP**                                  |
| Tenant ID (read-only, monospace) | Input | Display only | ⚠️ **QUESTION** - Do users care? Debug info? |

#### API Keys Card

| Element                           | Type           | Function            | Justification                               |
| --------------------------------- | -------------- | ------------------- | ------------------------------------------- |
| Public API Key (masked, copyable) | Input + button | Shows/copies key    | ❌ **QUESTION** - How many users need this? |
| Copy button                       | Button (icon)  | Copies to clipboard | ❌ **QUESTION** - Related to above          |
| Secret Key warning card           | Display        | Amber warning       | ❌ **QUESTION** - Related to above          |

#### Business Settings Card

| Element                        | Type    | Function | Justification                                  |
| ------------------------------ | ------- | -------- | ---------------------------------------------- |
| "Coming soon" placeholder text | Display | N/A      | ❌ **REMOVE** - Don't show unfinished features |

#### Danger Zone Card

| Element                 | Type                            | Function | Justification                                        |
| ----------------------- | ------------------------------- | -------- | ---------------------------------------------------- |
| "Sign Out" button       | Button (outline, red)           | Logs out | ⚠️ **DUPLICATE** - Sidebar footer already has logout |
| "Delete Account" button | Button (outline, red, disabled) | N/A      | ❌ **REMOVE** - If disabled, don't show it           |

**Critical Issues:**

1. **API Keys section** - How many tenants actually integrate via API? This feels like developer-only functionality that most users will never touch.
2. **Business Settings "Coming soon"** - NEVER show unfinished features to users. Remove the entire card until it's ready.
3. **Delete Account (disabled)** - Don't show disabled destructive actions. Remove until implemented.
4. **Duplicate logout** - Sidebar footer already has logout. Remove from Settings.
5. **Tenant ID display** - This is debug info. Most users don't need to see their tenant ID.

---

### 13. BUILD MODE (`/tenant/build`)

**Current Implementation:**

```tsx
// apps/web/src/app/(protected)/tenant/build/page.tsx
export default function BuildPage() {
  redirect('/tenant/dashboard?showPreview=true');
}
```

**What Actually Happens:**

1. User clicks "Site Builder" on dashboard
2. Navigates to `/tenant/build`
3. Server-side redirect back to `/tenant/dashboard?showPreview=true`
4. Dashboard's `useEffect` detects query param
5. Calls `agentUIActions.showPreview('home')`
6. URL is cleaned up to `/tenant/dashboard`

**Verdict:** ❌ **REMOVE ENTIRE /tenant/build ROUTE** - This is a fake page. The "Site Builder" concept should be removed from the UI. Preview mode should be triggered by:

- Agent commands ("show me the homepage", "preview the about page")
- Direct button on dashboard labeled "Preview Site" (if needed)

---

## Redundancy Analysis

### Duplicate Navigation Paths

| Destination          | Path 1                  | Path 2                                | Path 3                              | Verdict                                           |
| -------------------- | ----------------------- | ------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `/tenant/packages`   | Sidebar → Packages      | Dashboard → Packages stat card        | N/A                                 | ✅ Acceptable - stat + nav                        |
| `/tenant/scheduling` | Sidebar → Scheduling    | Dashboard → Bookings card             | Dashboard → Blackout Dates card     | ⚠️ **3 ways** to reach same page                  |
| `/tenant/pages`      | Sidebar → Pages         | Dashboard → Manage Pages quick action | N/A                                 | ❌ **Unnecessary duplicate**                      |
| `/tenant/payments`   | Sidebar → Payments      | Dashboard → Payments stat card        | Dashboard → "Connect Stripe" prompt | ✅ Acceptable - multiple CTAs for critical action |
| Logout               | Sidebar footer → Logout | Settings → Sign Out                   | N/A                                 | ❌ **Unnecessary duplicate**                      |

---

## Dead Ends & Unfinished Features

| Location            | Element                | Issue                      | Recommendation                                     |
| ------------------- | ---------------------- | -------------------------- | -------------------------------------------------- |
| `/tenant/build`     | Entire page            | Fake redirect              | ❌ **REMOVE** page and "Site Builder" quick action |
| `/tenant/settings`  | Business Settings card | "Coming soon" placeholder  | ❌ **REMOVE** card entirely                        |
| `/tenant/settings`  | Delete Account button  | Disabled, not implemented  | ❌ **REMOVE** button entirely                      |
| `/tenant/settings`  | API Keys section       | Niche feature, clutters UI | ⚠️ **MOVE** to Settings → Advanced (new section)   |
| `/tenant/settings`  | Tenant ID              | Debug info                 | ⚠️ **MOVE** to Settings → Advanced or remove       |
| `/tenant/dashboard` | Blackout Dates card    | Wrong icon (Users)         | ⚠️ **FIX** icon                                    |

---

## Icon Inconsistencies

| Element             | Current Icon | Correct Icon     | Fix Needed |
| ------------------- | ------------ | ---------------- | ---------- |
| Blackout Dates card | Users        | CalendarX or Ban | ✅ Yes     |

---

## Comparison: Tenant vs Admin Dashboard

### Admin Dashboard Elements

**Navigation (3 items):**

1. Dashboard → Platform metrics
2. Tenants → Manage all tenants
3. Bookings → All platform bookings

**Tenants Page Actions:**

- Search tenants
- Filter by Stripe status
- **Impersonate button** (per tenant)
- Edit tenant
- View public site

**Key Differences:**

- **Admin is focused** - Only 3 nav items vs tenant's 8
- **Admin has impersonation** - Power feature for support
- **Tenant has more noise** - Settings bloat, fake pages, duplicates

**Lesson for Tenant Dashboard:** Admin dashboard is cleaner because it focuses on 3 core tasks: monitor platform, manage tenants, view bookings. Tenant dashboard should have similar focus.

---

## Recommendations

### IMMEDIATE ACTIONS (Remove Bloat)

#### 1. Remove Fake Pages

- ❌ **DELETE** `/tenant/build/page.tsx`
- ❌ **DELETE** "Site Builder" quick action card from dashboard
- ✅ **ADD** "Preview Site" button to dashboard (if needed) that directly calls `agentUIActions.showPreview('home')`

#### 2. Remove Unfinished Features

- ❌ **DELETE** Business Settings card from `/tenant/settings`
- ❌ **DELETE** Delete Account button from Settings (until implemented)

#### 3. Remove Duplicate Elements

- ❌ **DELETE** "Manage Pages" quick action from dashboard (sidebar already has Pages)
- ❌ **DELETE** Sign Out button from Settings page (sidebar footer already has Logout)

#### 4. Fix Icon Errors

- ✅ **CHANGE** Blackout Dates card icon from Users to CalendarX or Ban

---

### SIMPLIFICATION OPPORTUNITIES

#### Option A: Consolidate Settings

**Current:** Settings page has Account Info + API Keys + Business Settings + Danger Zone
**Proposed:**

```
Settings
├── Account (Email, basic info)
├── Advanced (collapsible)
│   ├── Tenant ID
│   └── API Keys
└── Sign Out button
```

#### Option B: Move Domains to Settings

**Rationale:** Custom domains are an advanced feature. Most tenants won't use them.
**Proposed:**

- Remove Domains from top-level sidebar nav
- Add "Custom Domain" section to Settings → Advanced
- Reduces sidebar nav from 8 to 7 items

#### Option C: Merge Branding into Pages

**Rationale:** Branding (colors/logo) and Pages (content) are both "website customization"
**Proposed:**

- Sidebar: "Website" → `/tenant/website`
- Tabs: Branding | Pages
- Reduces sidebar nav from 8 to 7 items

#### Option D: Consolidate Scheduling Sub-Pages

**Current:** 4 separate sub-pages (Appointments, Availability, Blackouts, Appointment Types)
**Proposed:**

- Single page: `/tenant/scheduling`
- Tabs or accordion sections for each sub-section
- Reduces cognitive load

---

### SIDEBAR NAV: PROPOSED MINIMAL VERSION

**8 items → 6 items:**

| #   | Item       | Path                 | Justification                              |
| --- | ---------- | -------------------- | ------------------------------------------ |
| 1   | Dashboard  | `/tenant/dashboard`  | Central hub                                |
| 2   | Packages   | `/tenant/packages`   | Core offering management                   |
| 3   | Scheduling | `/tenant/scheduling` | Appointments & availability (consolidated) |
| 4   | Website    | `/tenant/website`    | Branding + Pages (merged)                  |
| 5   | Payments   | `/tenant/payments`   | Stripe Connect & billing                   |
| 6   | Settings   | `/tenant/settings`   | Account + Advanced (domains, API keys)     |

**Removed:**

- ❌ Branding (merged into Website)
- ❌ Pages (merged into Website)
- ❌ Domains (moved to Settings → Advanced)

---

### DASHBOARD PAGE: PROPOSED MINIMAL VERSION

#### Keep:

1. ✅ Welcome header
2. ✅ Trial banner (if applicable)
3. ✅ Stats cards (fix icon for Blackout Dates)
4. ✅ "View Storefront" quick action (external link)
5. ✅ Stripe setup prompt (if not connected)

#### Remove:

1. ❌ "Site Builder" quick action (fake page)
2. ❌ "Manage Pages" quick action (duplicate of sidebar)

#### Simplify:

- **Blackout Dates card:** Change destination to `/tenant/scheduling#blackouts` (anchor link) instead of generic `/tenant/scheduling`

---

## Apple-Quality Checklist

| Principle                       | Current State                                           | Recommendation                    |
| ------------------------------- | ------------------------------------------------------- | --------------------------------- |
| **Every element has a purpose** | ❌ Fake "Site Builder" page, disabled buttons           | Remove all fake/disabled elements |
| **No dead ends**                | ❌ "Coming soon" placeholder                            | Remove unfinished features        |
| **No redundancy**               | ❌ Multiple paths to same destination, duplicate logout | Consolidate navigation            |
| **Clear information hierarchy** | ⚠️ 8 top-level nav items                                | Reduce to 6 via consolidation     |
| **Consistent iconography**      | ❌ Users icon for Blackout Dates                        | Fix semantic errors               |
| **Progressive disclosure**      | ❌ API Keys shown to all users                          | Move to Settings → Advanced       |
| **Minimal cognitive load**      | ❌ Too many top-level pages                             | Group related functionality       |

---

## Priority Matrix

### P0 (Must Fix Immediately)

1. ❌ Remove `/tenant/build` page and "Site Builder" button
2. ❌ Remove "Coming soon" Business Settings card
3. ❌ Remove disabled Delete Account button
4. ❌ Fix Blackout Dates icon (Users → CalendarX)

### P1 (High Impact, Quick Wins)

1. ❌ Remove "Manage Pages" duplicate from dashboard
2. ❌ Remove Sign Out duplicate from Settings
3. ⚠️ Hide API Keys section by default (Settings → Advanced)
4. ⚠️ Hide Tenant ID (Settings → Advanced)

### P2 (Simplification, Medium Effort)

1. Merge Branding + Pages into "Website"
2. Move Domains to Settings → Advanced
3. Consolidate Scheduling sub-pages into tabbed interface
4. Make Billing a card on dashboard instead of separate page

### P3 (Nice to Have)

1. Add invoice history to Billing page
2. Hide disabled "Downgrade not available" button
3. Add onboarding checklist to dashboard (if user is new)

---

## Next Steps

1. **Review this audit** with stakeholders
2. **Prioritize changes** using the P0/P1/P2/P3 matrix
3. **Create implementation plan** for approved changes
4. **Update designs** to reflect new minimal structure
5. **Test with users** to validate simplifications

---

## Appendix: Full File Paths

### Tenant Dashboard Files

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/layout.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/dashboard/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/packages/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/scheduling/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/branding/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/pages/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/payments/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/billing/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/domains/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/settings/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/tenant/build/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/layouts/AdminSidebar.tsx`

### Admin Dashboard Files

- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/admin/layout.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/admin/dashboard/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/admin/tenants/page.tsx`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/(protected)/admin/bookings/page.tsx`
