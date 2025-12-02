# Tenant Admin User Guide

**Version**: 1.1
**Last Updated**: December 2, 2025
**Platform Status**: Multi-tenant architecture 95% complete, Phase 5 in progress

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Branding Your Booking Experience](#branding-your-booking-experience)
3. [Managing Packages](#managing-packages)
4. [Managing Blackout Dates](#managing-blackout-dates)
5. [Viewing Bookings](#viewing-bookings)
6. [API Authentication](#api-authentication)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Getting Started

### What is MAIS?

MAIS (Macon AI Solutions) is a multi-tenant SaaS platform that enables entrepreneurs and small businesses to offer online booking for their packages and services. As a tenant administrator, you have full control over your branding, packages, availability, and booking management.

### Your Tenant Account

When your account was created, you received:
- **Tenant Slug**: Your unique identifier (e.g., `bellaweddings`)
- **Public API Key**: For embedding widgets and API calls (e.g., `pk_bellaweddings_abc123`)
- **Secret API Key**: For server-side operations (⚠️ keep this secure!)

### Quick Start Checklist

- [ ] Customize your branding (logo, colors, fonts)
- [ ] Create your first package
- [ ] Set up blackout dates (if needed)
- [ ] Test your booking flow
- [ ] Share your booking link with customers

---

## Branding Your Booking Experience

### Overview

Make your booking experience uniquely yours with custom branding:
- **Logo**: Your business logo
- **Colors**: Primary and secondary brand colors
- **Fonts**: Choose from curated wedding-appropriate fonts

### Uploading Your Logo

#### Via API

```bash
curl -X POST https://api.yourplatform.com/v1/tenant/logo \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY" \
  -F "logo=@/path/to/your-logo.png"
```

**Requirements**:
- **File Types**: JPG, PNG, SVG, WebP
- **Max Size**: 2MB
- **Recommended**: Square or horizontal logos work best
- **Dimensions**: 500x200px or similar (will be scaled)

**Response**:
```json
{
  "url": "https://api.yourplatform.com/uploads/logos/logo-1234567890-abc123.png",
  "filename": "logo-1234567890-abc123.png",
  "size": 45678,
  "mimetype": "image/png"
}
```

Your logo URL is automatically saved to your branding and will appear on your booking pages.

### Customizing Colors

Choose colors that match your brand identity.

#### Via API

```bash
curl -X PUT https://api.yourplatform.com/v1/tenant/branding \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#7C3AED",
    "secondaryColor": "#DDD6FE"
  }'
```

**Color Format**: Hex colors in `#RRGGBB` format (e.g., `#7C3AED`)

**Recommendations**:
- **Primary Color**: Main brand color (buttons, highlights)
- **Secondary Color**: Accent color (backgrounds, borders)
- **Contrast**: Ensure good contrast for accessibility

### Selecting Fonts

Choose from our curated collection of wedding-appropriate fonts:

| Font Name | Style | Best For |
|-----------|-------|----------|
| **Inter** | Modern Sans-Serif | Clean, professional look |
| **Playfair Display** | Elegant Serif | Luxury, sophisticated weddings |
| **Lora** | Classic Serif | Traditional, timeless feel |
| **Montserrat** | Clean Sans-Serif | Modern, minimalist style |
| **Cormorant Garamond** | Romantic Serif | Romantic, vintage weddings |
| **Raleway** | Refined Sans-Serif | Elegant, contemporary look |
| **Crimson Text** | Traditional Serif | Classic, formal events |
| **Poppins** | Friendly Sans-Serif | Casual, approachable vibe |

#### Via API

```bash
curl -X PUT https://api.yourplatform.com/v1/tenant/branding \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fontFamily": "Playfair Display"
  }'
```

### Viewing Your Current Branding

```bash
curl -X GET https://api.yourplatform.com/v1/tenant/branding \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

**Response**:
```json
{
  "primaryColor": "#7C3AED",
  "secondaryColor": "#DDD6FE",
  "fontFamily": "Playfair Display",
  "logo": "https://api.yourplatform.com/uploads/logos/logo-1234567890.png"
}
```

### Testing Your Branding

1. Visit your public booking page: `https://yourplatform.com/t/{your-slug}`
2. Your logo should appear in the header
3. Colors should be applied to buttons and accents
4. Font should be applied to all text

---

## Managing Packages

### Overview

Packages are the wedding experiences you offer to customers. Each package includes:
- Title and description
- Base price
- Optional photo
- Add-ons (optional extras)

### Listing Your Packages

```bash
curl -X GET https://api.yourplatform.com/v1/tenant-admin/packages \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

**Response**:
```json
[
  {
    "id": "pkg_abc123",
    "slug": "basic-elopement",
    "title": "Basic MAISment",
    "description": "Simple, intimate ceremony for two",
    "priceCents": 50000,
    "photoUrl": "https://example.com/photo.jpg"
  }
]
```

### Creating a Package

```bash
curl -X POST https://api.yourplatform.com/v1/tenant-admin/packages \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "garden-romance",
    "title": "Garden Romance Package",
    "description": "Beautiful outdoor ceremony in our exclusive garden venue. Includes officiant, photographer, and 2-hour reception.",
    "priceCents": 150000,
    "photoUrl": "https://example.com/garden.jpg"
  }'
```

**Field Guide**:
- **slug**: URL-friendly identifier (lowercase, no spaces)
- **title**: Display name (what customers see)
- **description**: Detailed description (sell your package!)
- **priceCents**: Price in cents (e.g., $1,500.00 = 150000)
- **photoUrl**: Optional photo URL (upload to your own hosting)

### Updating a Package

```bash
curl -X PUT https://api.yourplatform.com/v1/tenant-admin/packages/pkg_abc123 \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Package Name",
    "priceCents": 160000
  }'
```

You can update any field. Only include fields you want to change.

### Deleting a Package

```bash
curl -X DELETE https://api.yourplatform.com/v1/tenant-admin/packages/pkg_abc123 \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

⚠️ **Warning**: This permanently deletes the package. Existing bookings are not affected.

### Package Tips

1. **Use High-Quality Photos**: Photos sell packages
2. **Write Compelling Descriptions**: Highlight unique value
3. **Price Strategically**: Consider your market and competition
4. **Offer Variety**: Multiple price points attract more customers
5. **Update Seasonally**: Refresh packages for different seasons

---

## Managing Blackout Dates

### Overview

Blackout dates are days when you're unavailable for bookings (holidays, personal time, already booked events).

### Listing Blackout Dates

```bash
curl -X GET https://api.yourplatform.com/v1/tenant-admin/blackouts \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

**Response**:
```json
[
  {
    "id": "blk_abc123",
    "date": "2025-12-25",
    "reason": "Christmas Holiday"
  }
]
```

### Adding a Blackout Date

```bash
curl -X POST https://api.yourplatform.com/v1/tenant-admin/blackouts \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-12-25",
    "reason": "Christmas Holiday"
  }'
```

**Field Guide**:
- **date**: Date in YYYY-MM-DD format
- **reason**: Optional description (internal use)

### Removing a Blackout Date

```bash
curl -X DELETE https://api.yourplatform.com/v1/tenant-admin/blackouts/blk_abc123 \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

### Blackout Best Practices

1. **Plan Ahead**: Add holidays and vacations early
2. **Use Reasons**: Track why dates are blocked
3. **Review Regularly**: Remove outdated blackouts
4. **Communicate**: Update blackouts when plans change

---

## Viewing Bookings

### Overview

View all customer bookings with filtering options.

### Listing All Bookings

```bash
curl -X GET https://api.yourplatform.com/v1/tenant-admin/bookings \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

**Response**:
```json
[
  {
    "id": "bkg_abc123",
    "packageId": "pkg_xyz789",
    "coupleName": "Sarah & Alex",
    "email": "sarah@example.com",
    "phone": "+1234567890",
    "eventDate": "2025-06-15",
    "addOnIds": ["addon_123"],
    "totalCents": 175000,
    "status": "PAID",
    "createdAt": "2025-01-15T10:30:00Z"
  }
]
```

### Filtering Bookings

#### By Status
```bash
curl -X GET "https://api.yourplatform.com/v1/tenant-admin/bookings?status=PAID" \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

**Status Values**:
- `PAID`: Confirmed and paid
- `REFUNDED`: Refunded
- `CANCELED`: Canceled

#### By Date Range
```bash
curl -X GET "https://api.yourplatform.com/v1/tenant-admin/bookings?startDate=2025-06-01&endDate=2025-06-30" \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

#### Combined Filters
```bash
curl -X GET "https://api.yourplatform.com/v1/tenant-admin/bookings?status=PAID&startDate=2025-06-01&endDate=2025-06-30" \
  -H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

### Booking Management Tips

1. **Regular Reviews**: Check bookings daily during busy season
2. **Follow Up**: Contact couples 1 week before event
3. **Export Data**: Save booking data for records
4. **Track Trends**: Identify popular packages and dates
5. **Customer Service**: Respond promptly to inquiries

---

## API Authentication

### API Keys

You have two API keys:

1. **Public API Key** (`pk_...`)
   - ✅ Safe for client-side use
   - ✅ Can be embedded in websites
   - ✅ Used for tenant-scoped operations
   - ❌ Cannot access sensitive admin functions

2. **Secret API Key** (`sk_...`)
   - ❌ NEVER expose to clients
   - ❌ Server-side only
   - ✅ Full admin access (future feature)

### Using Your API Key

All API requests require your public API key in the header:

```bash
-H "X-Tenant-Key: YOUR_PUBLIC_API_KEY"
```

**Example**:
```bash
curl -X GET https://api.yourplatform.com/v1/tenant/branding \
  -H "X-Tenant-Key: pk_bellaweddings_abc123"
```

### Security Best Practices

1. **Protect Your Secret Key**: Store in environment variables
2. **Use HTTPS**: Always use secure connections
3. **Rotate Keys**: If compromised, contact support immediately
4. **Monitor Usage**: Review API logs for suspicious activity
5. **Limit Access**: Only share keys with trusted team members

---

## Troubleshooting

### Common Issues

#### "Unauthorized: No tenant context"
**Problem**: API key not provided or invalid
**Solution**: Check that you're including the `X-Tenant-Key` header with your public API key

#### "File size exceeds maximum of 2MB"
**Problem**: Logo file too large
**Solution**: Compress your logo or use a smaller file

#### "Invalid hex color format"
**Problem**: Color not in #RRGGBB format
**Solution**: Use hex colors like `#7C3AED` (must start with #, 6 hex digits)

#### "Package not found"
**Problem**: Package ID doesn't exist or belongs to another tenant
**Solution**: Verify the package ID and ensure it's yours

#### Logo Not Displaying
**Problem**: Logo uploaded but not showing on booking page
**Solution**:
1. Clear browser cache
2. Verify logo URL is accessible
3. Check that branding was saved (`GET /v1/tenant/branding`)

### Getting Help

If you need assistance:

1. **Check Documentation**: Review this guide and API reference
2. **Test with cURL**: Verify API calls work via command line
3. **Review Error Messages**: Error responses include helpful details
4. **Contact Support**: Email support with:
   - Your tenant slug
   - Description of the issue
   - API response (if applicable)
   - Steps to reproduce

---

## FAQ

### General Questions

**Q: Can I have multiple admins for my tenant?**
A: Currently, one admin per tenant. Multi-user support coming in future updates.

**Q: Can I change my tenant slug?**
A: Contact support for slug changes. This affects your booking URL.

**Q: How do customers book?**
A: Share your booking URL: `https://yourplatform.com/t/{your-slug}`

**Q: Can I offer discounts or promo codes?**
A: Not yet. This feature is planned for a future update.

### Branding Questions

**Q: Can I use custom CSS?**
A: Not in the current version. Coming in Phase 5.

**Q: What if I need a font not in the list?**
A: Contact support to request additional fonts.

**Q: Can I have different branding for different packages?**
A: Not currently. Branding applies to all your packages.

**Q: How do I remove my logo?**
A: Contact support to remove or replace your logo.

### Package Questions

**Q: Can I have unlimited packages?**
A: Yes, create as many as you need.

**Q: How do I add photos to packages?**
A: Host photos on your own server/CDN and provide the URL.

**Q: Can I archive packages instead of deleting?**
A: Delete removes from customer view but doesn't affect existing bookings.

**Q: What happens to bookings if I delete a package?**
A: Existing bookings are preserved even if the package is deleted.

### Booking Questions

**Q: Can I cancel or refund bookings?**
A: Contact support for refund processing. Direct refund API coming soon.

**Q: How do I get paid?**
A: Payments are processed via Stripe Connect. Set up in admin portal.

**Q: Can I export booking data?**
A: Save the JSON response from the API. CSV export coming soon.

**Q: How are commission fees calculated?**
A: Your commission percentage is set when your account is created.

---

## Quick Reference

### API Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Upload logo | POST | `/v1/tenant/logo` |
| Update branding | PUT | `/v1/tenant/branding` |
| Get branding | GET | `/v1/tenant/branding` |
| List packages | GET | `/v1/tenant-admin/packages` |
| Create package | POST | `/v1/tenant-admin/packages` |
| Update package | PUT | `/v1/tenant-admin/packages/:id` |
| Delete package | DELETE | `/v1/tenant-admin/packages/:id` |
| List blackouts | GET | `/v1/tenant-admin/blackouts` |
| Add blackout | POST | `/v1/tenant-admin/blackouts` |
| Remove blackout | DELETE | `/v1/tenant-admin/blackouts/:id` |
| List bookings | GET | `/v1/tenant-admin/bookings` |

### Common cURL Examples

**Upload Logo:**
```bash
curl -X POST https://api.yourplatform.com/v1/tenant/logo \
  -H "X-Tenant-Key: pk_your_key" \
  -F "logo=@logo.png"
```

**Update Colors:**
```bash
curl -X PUT https://api.yourplatform.com/v1/tenant/branding \
  -H "X-Tenant-Key: pk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"primaryColor":"#7C3AED","secondaryColor":"#DDD6FE"}'
```

**Create Package:**
```bash
curl -X POST https://api.yourplatform.com/v1/tenant-admin/packages \
  -H "X-Tenant-Key: pk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"slug":"new-package","title":"New Package","description":"Description","priceCents":100000}'
```

**Add Blackout:**
```bash
curl -X POST https://api.yourplatform.com/v1/tenant-admin/blackouts \
  -H "X-Tenant-Key: pk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-12-25","reason":"Holiday"}'
```

---

## Support

For additional help or to report issues:

- **Email**: support@yourplatform.com
- **Documentation**: https://docs.yourplatform.com
- **Status Page**: https://status.yourplatform.com

---

**User Guide Version**: 1.1
**Last Updated**: December 2, 2025
**Platform Version**: Phase 5 (In Progress)
**Architecture Maturity**: 95% Complete
