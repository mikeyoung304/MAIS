# New Tenant Setup Workflow

You are helping Mike set up a new tenant for the MAIS platform. Parse his stream-of-consciousness input and create a complete tenant configuration.

## Input

$ARGUMENTS

## Your Job

1. **Parse the input** - Extract whatever Mike provided (name, colors, pricing, packages, vibe, etc.)
2. **Fill gaps intelligently** - If Mike was vague, make smart assumptions. If exact, follow precisely.
3. **Ask clarifying questions** - Only for critical missing info
4. **Generate the full configuration** - Present it for approval
5. **Execute the setup** - Create everything via existing APIs
6. **Show onboarding checklist** - Remind Mike what's left to do

## Default Structure (unless Mike specifies otherwise)

- **3 segments** (e.g., Weddings, Elopements, Retreats)
- **3 packages per segment** (Good/Better/Best pricing tiers)
- **3 add-ons per segment** (segment-specific upgrades)

## Interpretation Rules

| If Mike says... | You should... |
|-----------------|---------------|
| Vague colors ("elegant", "earthy") | Pick specific hex codes that match the vibe |
| Vague pricing ("high end", "budget") | Generate appropriate price ranges |
| No descriptions | Write compelling descriptions based on context |
| Exact values | Use them verbatim, no changes |
| "you decide" or "fill it in" | Make all decisions, present for approval |

## Data Models Reference

### Tenant
```
slug: string (URL-safe, lowercase, hyphens)
name: string (Display name)
primaryColor: hex (main brand - buttons, headers)
secondaryColor: hex (accent - CTAs, highlights)
accentColor: hex (success/positive actions)
backgroundColor: hex (page background, usually white/cream)
```

### Segment
```
slug: string (URL-safe)
name: string (Display name)
heroTitle: string (Landing page headline)
heroSubtitle?: string (Tagline)
description?: string (SEO/landing page text)
sortOrder: number (display order)
```

### Package
```
slug: string (URL-safe)
name: string (Display name)
description?: string (Sales copy)
basePrice: number (in cents - $2500 = 250000)
segmentId: string (which segment)
grouping?: string (tier label: "Budget", "Premium", etc.)
groupingOrder?: number (order within tier)
```

### AddOn
```
slug: string (URL-safe)
name: string (Display name)
description?: string
price: number (in cents)
segmentId?: string (null = available to all segments)
```

## Workflow Steps

### Step 1: Parse & Present

After parsing Mike's input, present a structured summary:

```
## Tenant Setup: [Name]

### Branding
- Slug: [slug]
- Primary: [color] (buttons, headers)
- Secondary: [color] (accents, CTAs)
- Accent: [color] (success states)
- Background: [color]

### Segments & Packages

#### 1. [Segment Name]
Hero: "[Hero Title]"
Subtitle: "[Subtitle]"

| Package | Price | Description |
|---------|-------|-------------|
| [Name] | $X,XXX | [Brief description] |
| [Name] | $X,XXX | [Brief description] |
| [Name] | $X,XXX | [Brief description] |

Add-ons:
- [Name]: $XXX - [Description]
- [Name]: $XXX - [Description]
- [Name]: $XXX - [Description]

[Repeat for each segment]

### Questions (if any)
1. [Question about missing critical info]
```

### Step 2: Get Approval

Ask: "Does this look right? Say 'yes' to create, or tell me what to change."

### Step 3: Execute

Once approved, create in this order:
1. Tenant (if new) - via signup or direct DB
2. Segments - via `POST /v1/tenant-admin/segments`
3. Packages - via `POST /v1/tenant-admin/packages`
4. Add-ons - via `POST /v1/tenant-admin/addons`

Use the existing API contracts. All prices in CENTS.

### Step 4: Onboarding Checklist

After creation, show:

```
## Onboarding Checklist for [Tenant Name]

### Immediate (do now)
- [ ] Upload photos for each package (Visual Editor: /tenant/editor)
- [ ] Review and tweak descriptions
- [ ] Set up Stripe Connect (Payments tab)

### Before Launch
- [ ] Upload logo (Branding tab)
- [ ] Test booking flow end-to-end
- [ ] Verify email notifications working

Would you like me to note anything specific for this tenant?
```

## Color Palette Suggestions by Vibe

| Vibe | Primary | Secondary | Accent |
|------|---------|-----------|--------|
| Elegant/Luxury | #1a1a2e (deep navy) | #d4af37 (gold) | #f5f5dc (cream) |
| Rustic/Barn | #5c4033 (brown) | #daa520 (goldenrod) | #8b4513 (saddle) |
| Modern/Minimal | #2d3436 (charcoal) | #00b894 (mint) | #fdcb6e (yellow) |
| Romantic/Soft | #c9a9c7 (lavender) | #f8b4b4 (blush) | #ffeaa7 (cream) |
| Natural/Earthy | #2d5016 (forest) | #c4a35a (wheat) | #8fbc8f (sage) |
| Coastal/Beach | #1e3d59 (ocean) | #ffc857 (sand) | #17bebb (teal) |
| Bold/Vibrant | #e63946 (red) | #1d3557 (navy) | #f1faee (white) |

## Price Range Suggestions

| Market | Entry | Mid | Premium |
|--------|-------|-----|---------|
| Budget | $500-1,500 | $1,500-3,000 | $3,000-5,000 |
| Mid-Market | $2,000-4,000 | $4,000-7,000 | $7,000-12,000 |
| High-End | $5,000-10,000 | $10,000-20,000 | $20,000-50,000 |
| Ultra-Luxury | $15,000-30,000 | $30,000-75,000 | $75,000+ |

## Example Interaction

**Mike's input:**
```
bella vista weddings napa valley, luxury venue, gold and burgundy vibes,
they do full weddings and intimate elopements, barn and vineyard spaces,
pricing around 8-25k, owner sarah wants elegant but approachable copy
```

**Your response:**
```
## Tenant Setup: Bella Vista Weddings

### Branding
- Slug: bella-vista-weddings
- Primary: #722F37 (burgundy wine)
- Secondary: #D4AF37 (champagne gold)
- Accent: #F5E6D3 (warm cream)
- Background: #FFFEF9 (soft white)

### Segments & Packages

#### 1. Grand Celebrations
Hero: "Your Dream Wedding, Realized"
Subtitle: "Full-service luxury weddings in Napa Valley"

| Package | Price | Description |
|---------|-------|-------------|
| Vineyard Estate | $25,000 | Our signature experience among the vines... |
| Barn Romance | $18,000 | Rustic elegance in our restored barn... |
| Garden Soirée | $12,000 | Intimate celebration in manicured gardens... |

Add-ons:
- Rehearsal Dinner: $3,500 - Private evening before the big day
- Extended Hours: $1,500 - Celebrate until midnight
- Bridal Suite: $800 - Luxurious prep space for you and your party

#### 2. Intimate Elopements
Hero: "Just the Two of You"
Subtitle: "Romantic ceremonies for couples seeking simplicity"

| Package | Price | Description |
|---------|-------|-------------|
| Sunset Vows | $8,000 | Golden hour ceremony with vineyard backdrop... |
| Secret Garden | $5,500 | Tucked-away ceremony in our rose garden... |
| Sunrise Promise | $4,000 | Early morning magic as the valley awakens... |

Add-ons:
- Photography Hour: $1,200 - Extra time for portraits
- Champagne Toast: $350 - Bubbly celebration for two
- Floral Crown: $275 - Hand-crafted seasonal blooms

#### 3. Weekend Retreats
Hero: "Make It a Getaway"
Subtitle: "Extended celebrations for you and your closest"

| Package | Price | Description |
|---------|-------|-------------|
| Full Estate Takeover | $45,000 | Three days, exclusive access... |
| Vineyard Weekend | $28,000 | Two nights of celebration... |
| Welcome Party | $8,500 | Friday night gathering to kick things off... |

Add-ons:
- Wine Tasting: $2,000 - Private barrel room experience
- Farm Dinner: $4,500 - Chef's table under the stars
- Morning Yoga: $600 - Wellness session for the group

### Confirmation

Does this look right? Say 'yes' to create, or tell me what to change.
```

## Important Notes

- Always convert dollars to cents for API calls ($2,500 = 250000)
- Slugs must be lowercase, hyphen-separated, unique per tenant
- If tenant already exists, skip tenant creation, just add segments/packages
- After setup, remind about photos - that's Mike's job via the UI
