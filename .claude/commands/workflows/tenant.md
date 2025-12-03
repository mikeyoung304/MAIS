# Unified Tenant Management Workflow

You are helping Mike manage tenants for the MAIS platform. This command handles both new tenant setup AND modifications to existing tenants.

## Input

$ARGUMENTS

## No Arguments? Prompt for Action

If `$ARGUMENTS` is empty or blank, ask:

```
What would you like to do?

1. **New tenant** - Set up a brand new tenant from scratch
   Example: "new riverside retreat, boutique farm venue, earthy vibes, 4-15k pricing"

2. **View existing tenant** - See current configuration
   Example: "little-bit-farm" or "show little-bit-farm"

3. **Add to existing tenant** - Add segments, packages, or add-ons
   Example: "little-bit-farm add corporate events segment"

4. **Update existing tenant** - Modify prices, descriptions, branding
   Example: "little-bit-farm update elopement prices +15%"

Which would you like? Or just tell me what you need:
```

Then wait for user response before proceeding.

## Action Detection

Parse the input to determine the action:

| If input contains... | Action | Description |
|---------------------|--------|-------------|
| "new", "create", "setup" + tenant name | `new` | Create a brand new tenant with full configuration |
| Existing tenant slug + "add", "new segment/package/addon" | `add` | Add segments, packages, or add-ons to existing tenant |
| Existing tenant slug + "update", "change", "modify" | `update` | Modify existing segments, packages, or add-ons |
| Existing tenant slug + "status", "show", "what does X have" | `status` | Show current tenant configuration |
| Just a tenant slug (no action words) | `status` | Default to showing status |

## Authentication for Existing Tenants

When modifying an existing tenant:
1. Use platform admin authentication (impersonation)
2. First fetch the tenant by slug: `GET /v1/admin/tenants?slug={slug}`
3. Use the tenant's secret key for subsequent API calls
4. All operations are scoped to that tenant

## Actions

### ACTION: new

**Full tenant setup from scratch.**

Follow these steps:
1. Parse Mike's stream-of-consciousness input for name, colors, pricing, packages, vibe
2. Fill gaps intelligently based on interpretation rules
3. Present configuration for approval
4. Execute creation via APIs
5. Show onboarding checklist

**Default Structure:**
- 3 segments (e.g., Weddings, Elopements, Retreats)
- 3 packages per segment (Good/Better/Best pricing tiers)
- 3 add-ons per segment (segment-specific upgrades)

See the detailed workflow in [newtenant.md](#) for full new tenant setup process.

---

### ACTION: add

**Add new items to an existing tenant.**

First, fetch and display current tenant status, then:

```
## Adding to: [Tenant Name]

### Current Configuration
- Segments: [list existing]
- Packages: [count per segment]
- Add-ons: [count per segment]

### What to Add
[Parse Mike's input for what he wants to add]

### Proposed Additions
[Show what will be created]

Does this look right? Say 'yes' to create, or tell me what to change.
```

**Add Segments:**
```
POST /v1/tenant-admin/segments
{
  "slug": "...",
  "name": "...",
  "heroTitle": "...",
  "heroSubtitle": "...",
  "description": "...",
  "sortOrder": N,
  "isActive": true
}
```

**Add Packages:**
```
POST /v1/tenant-admin/packages
{
  "slug": "...",
  "title": "...",
  "description": "...",
  "priceCents": N,
  "segmentId": "...",
  "grouping": "...",
  "groupingOrder": N
}
```

**Add Add-ons:**
```
POST /v1/tenant-admin/addons
{
  "packageId": "...",
  "title": "...",
  "description": "...",
  "priceCents": N
}
```

---

### ACTION: update

**Modify existing tenant configuration.**

First, fetch and display current state, then show diff:

```
## Updating: [Tenant Name]

### Current vs Proposed

| Item | Current | Proposed |
|------|---------|----------|
| [Field] | [old value] | [new value] |

Does this look right? Say 'yes' to update, or tell me what to change.
```

**Update Segment:**
```
PUT /v1/tenant-admin/segments/:id
{
  "name": "...",
  "heroTitle": "...",
  ...
}
```

**Update Package:**
```
PUT /v1/tenant-admin/packages/:id
{
  "title": "...",
  "priceCents": N,
  ...
}
```

**Update Add-on:**
```
PUT /v1/tenant-admin/addons/:id
{
  "title": "...",
  "priceCents": N,
  ...
}
```

**Update Branding:**
```
PUT /v1/tenant-admin/branding
{
  "primaryColor": "#...",
  "secondaryColor": "#...",
  "accentColor": "#...",
  "backgroundColor": "#..."
}
```

---

### ACTION: status

**Show current tenant configuration.**

```
## Tenant Status: [Name]

### Branding
- Slug: [slug]
- Primary: [color]
- Secondary: [color]
- Accent: [color]
- Background: [color]
- Logo: [url or "Not uploaded"]

### Segments ([count])

#### 1. [Segment Name]
Hero: "[Title]"
Subtitle: "[Subtitle]"

Packages ([count]):
| Package | Price | Grouping |
|---------|-------|----------|
| [Name] | $X,XXX | [tier] |

Add-ons ([count]):
- [Name]: $XXX
- [Name]: $XXX

[Repeat for each segment]

### Setup Status
- [ ] Stripe Connect: [Connected / Not connected]
- [ ] Logo: [Uploaded / Not uploaded]
- [ ] Packages with photos: [X of Y]

### Quick Actions
- "add a new segment for retreats"
- "update elopement pricing to $5000-$15000"
- "add photography add-on to all segments"
```

---

## API Reference

### Fetch Tenant Status
```
GET /v1/admin/tenants?slug={slug}  # Platform admin - get tenant ID
GET /v1/tenant-admin/segments      # Tenant admin - get segments
GET /v1/tenant-admin/packages      # Tenant admin - get packages
GET /v1/tenant-admin/addons        # Tenant admin - get add-ons
GET /v1/tenant-admin/branding      # Tenant admin - get branding
```

### Create/Update/Delete
```
# Segments
POST   /v1/tenant-admin/segments
PUT    /v1/tenant-admin/segments/:id
DELETE /v1/tenant-admin/segments/:id

# Packages
POST   /v1/tenant-admin/packages
PUT    /v1/tenant-admin/packages/:id
DELETE /v1/tenant-admin/packages/:id

# Add-ons
POST   /v1/tenant-admin/addons
PUT    /v1/tenant-admin/addons/:id
DELETE /v1/tenant-admin/addons/:id

# Branding
PUT    /v1/tenant-admin/branding
POST   /v1/tenant-admin/logo (multipart/form-data)
```

---

## Interpretation Rules

| If Mike says... | You should... |
|-----------------|---------------|
| Vague colors ("elegant", "earthy") | Pick specific hex codes that match the vibe |
| Vague pricing ("high end", "budget") | Generate appropriate price ranges |
| No descriptions | Write compelling descriptions based on context |
| Exact values | Use them verbatim, no changes |
| "you decide" or "fill it in" | Make all decisions, present for approval |
| "same as before" | Keep existing values |
| "remove X" or "delete X" | Confirm before deletion |

---

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

---

## Price Range Suggestions

| Market | Entry | Mid | Premium |
|--------|-------|-----|---------|
| Budget | $500-1,500 | $1,500-3,000 | $3,000-5,000 |
| Mid-Market | $2,000-4,000 | $4,000-7,000 | $7,000-12,000 |
| High-End | $5,000-10,000 | $10,000-20,000 | $20,000-50,000 |
| Ultra-Luxury | $15,000-30,000 | $30,000-75,000 | $75,000+ |

---

## Example Interactions

### New Tenant
```
/workflows:tenant new riverside retreat, boutique farm-to-table venue in sonoma,
earthy vibes, they do elopements and weekend retreats, pricing 4-15k
```

### Add to Existing
```
/workflows:tenant little-bit-farm add a corporate events segment,
packages for team building and retreats, $3000-8000 range
```

### Update Existing
```
/workflows:tenant little-bit-farm update elopement packages,
increase all prices by 15%, update descriptions to emphasize new garden area
```

### Show Status
```
/workflows:tenant little-bit-farm
```

---

## Important Notes

- Always convert dollars to cents for API calls ($2,500 = 250000)
- Slugs must be lowercase, hyphen-separated, unique per tenant
- For existing tenants, always confirm current state before making changes
- After modifications, show updated status
- NEVER delete segments/packages without explicit confirmation
