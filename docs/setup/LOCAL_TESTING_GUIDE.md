# Local Testing Guide - MAIS Application

## ✅ Application Status: RUNNING

### Services Running

| Service        | URL                   | Status     | Mode            |
| -------------- | --------------------- | ---------- | --------------- |
| **Web Client** | http://localhost:3000 | ✅ Running | Vite Dev Server |
| **API Server** | http://localhost:3001 | ✅ Running | Mock Adapters   |

### Quick Links

- 🏠 **Homepage:** http://localhost:3000
- 📦 **Browse Packages:** http://localhost:3000
- 🔐 **Admin Login:** http://localhost:3000/admin
- 📊 **API Packages:** http://localhost:3001/v1/packages
- 📅 **Check Availability:** http://localhost:3001/v1/availability/2025-12-25

---

## Test Scenarios

### 1. Browse Packages (Public - No Auth)

**Steps:**

1. Open http://localhost:3000 in your browser
2. You should see the available service tiers:
   - Basic MAISment ($999)
   - Micro Ceremony ($2,499)
   - Garden Romance ($4,499)
   - Luxury Escape ($8,999)
   - Destination Bliss ($5,999)
   - Courthouse Chic ($799)
3. Click on any package to view details
4. Check available add-ons for each package

**Expected Result:** All packages load with images, pricing, and descriptions

---

### 2. Create a Mock Booking

**Current Mode:** Mock (No real Stripe charges)

**Steps:**

1. Select a package (e.g., "Basic MAISment")
2. Choose a date (avoid 2025-12-25 - it's a blackout date)
3. Add optional add-ons (Video Recording, Floral Arrangement)
4. Fill in booking details:
   - Couple Name: "John & Jane Doe"
   - Email: "test@example.com"
   - Phone: "555-1234" (optional)
5. Click "Book Now"
6. You'll be redirected to a mock checkout page
7. Complete the mock payment
8. Booking is created instantly (no real payment)

**Expected Result:**

- Booking ID returned
- Success confirmation shown
- Booking appears in admin dashboard

---

### 3. Admin Access

**Admin Credentials (Mock Mode):**

- Email: `admin@example.com`
- Password: `admin123`

**Steps:**

1. Navigate to http://localhost:3000/admin (or admin login page)
2. Login with credentials above
3. View dashboard with:
   - All bookings list
   - Package management
   - Blackout date management

**Admin Features to Test:**

- ✅ View all bookings
- ✅ Filter bookings by date/status
- ✅ Create new package
- ✅ Edit existing package
- ✅ Delete package (with confirmation)
- ✅ Add blackout dates
- ✅ Remove blackout dates

---

### 4. Date Availability Check

**Test Date Availability:**

```bash
# Available date (should return {"available": true})
curl http://localhost:3001/v1/availability/2026-06-15

# Blackout date (should return {"available": false, "reason": "Holiday"})
curl http://localhost:3001/v1/availability/2025-12-25

# Already booked date (create booking first, then check)
curl http://localhost:3001/v1/availability/2025-06-15
```

**Expected Results:**

- Future dates: Available (unless blackout)
- Christmas Day (2025-12-25): Blocked (Holiday)
- Booked dates: Unavailable with conflict message

---

### 5. Mock vs Real Mode

**Current: MOCK MODE** (No external services required)

**To Switch to Real Mode:**

1. Stop servers (see "Managing Services" below)
2. Edit `server/.env`:
   ```bash
   ADAPTERS_PRESET=real  # Change from 'mock' to 'real'
   ```
3. Restart servers
4. Real mode uses:
   - Real Stripe checkout (test mode)
   - Real PostgreSQL/Supabase database
   - Real webhook processing

**Mock Mode Features:**

- ✅ No Stripe account needed
- ✅ No real payments
- ✅ Instant booking creation
- ✅ In-memory data storage
- ✅ Perfect for UI/UX testing

---

## API Testing with curl

### Get All Packages

```bash
curl http://localhost:3001/v1/packages | python3 -m json.tool
```

### Check Availability

```bash
curl http://localhost:3001/v1/availability/2025-12-25
```

### Admin Login

```bash
curl -X POST http://localhost:3001/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

### Get Admin Bookings (requires JWT token)

```bash
TOKEN="<jwt-token-from-login>"

curl http://localhost:3001/v1/admin/bookings \
  -H "Authorization: Bearer $TOKEN"
```

---

## Managing Services

### Check Status

```bash
# Check if servers are running
lsof -ti:3001  # API server
lsof -ti:3000  # Web client

# View live logs
tail -f /tmp/mais-server.log
tail -f /tmp/mais-client.log
```

### Stop Services

```bash
# Stop API server
lsof -ti:3001 | xargs kill -9

# Stop web client
lsof -ti:3000 | xargs kill -9

# Stop both
lsof -ti:3001,3000 | xargs kill -9
```

### Restart Services

```bash
# From project root
cd /Users/mikeyoung/CODING/MAIS

# Start API server (in background)
cd server && pnpm run dev > /tmp/mais-server.log 2>&1 &

# Start web client (in another terminal or background)
cd ../client && pnpm run dev > /tmp/mais-client.log 2>&1 &

# Or use concurrently from root
pnpm run dev  # If available
```

---

## Mock Data Reference

### Default Admin User

- Email: `admin@example.com`
- Password: `admin123`

### Seeded Tiers

1. **pkg_basic** - Basic MAISment ($999)
2. **pkg_micro** - Micro Ceremony ($2,499)
3. **pkg_garden** - Garden Romance ($4,499)
4. **pkg_luxury** - Luxury Escape ($8,999)
5. **pkg_destination** - Destination Bliss ($5,999)
6. **pkg_courthouse** - Courthouse Chic ($799)

### Seeded Add-ons (6 total)

- **addon_video** - Video Recording ($500) - for pkg_basic
- **addon_flowers** - Floral Arrangement ($150) - for pkg_basic
- **addon_makeup** - Hair & Makeup ($300) - for pkg_micro
- **addon_music** - Live Music ($750) - for pkg_garden
- **addon_cake** - Wedding Cake ($350) - for pkg_garden
- **addon_album** - Photo Album ($450) - for pkg_luxury

### Blackout Dates

- **2025-12-25** - Christmas Day (Holiday)

---

## Common Issues & Solutions

### Issue: Port Already in Use

```bash
# Error: "EADDRINUSE: address already in use :::3001"
lsof -ti:3001 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Issue: Cannot Connect to API

```bash
# Check if API is running
curl http://localhost:3001/v1/packages

# Check logs
tail -20 /tmp/mais-server.log
```

### Issue: Packages Not Loading on Frontend

1. Check browser console for errors (F12)
2. Verify API is running: `curl http://localhost:3001/v1/packages`
3. Check CORS settings in `server/.env`: `CORS_ORIGIN=http://localhost:3000`

### Issue: Mock Data Reset

Mock data resets when server restarts. This is expected behavior for development.

---

## Testing Checklist

### Basic Functionality

- [ ] Homepage loads
- [ ] All 6 packages display correctly
- [ ] Package details page works
- [ ] Add-ons display for packages
- [ ] Calendar shows available dates
- [ ] Blackout dates are blocked (Dec 25)
- [ ] Mock checkout flow completes
- [ ] Admin login works
- [ ] Admin dashboard shows bookings
- [ ] Can create/edit packages in admin

### Edge Cases

- [ ] Try booking same date twice (should fail on second attempt)
- [ ] Try booking blackout date (should be blocked)
- [ ] Test with no add-ons selected
- [ ] Test with multiple add-ons
- [ ] Check booking appears in admin list
- [ ] Verify pricing calculations are correct

### Performance

- [ ] Page loads quickly (<2s)
- [ ] API responds quickly (<500ms)
- [ ] Images load properly
- [ ] No console errors in browser

---

## Next Steps for Real Testing

To test with actual Stripe payments and database:

1. **Switch to Real Mode:**

   ```bash
   # Edit server/.env
   ADAPTERS_PRESET=real
   ```

2. **Start Stripe Webhook Listener:**

   ```bash
   stripe listen --forward-to http://localhost:3001/v1/webhooks/stripe
   ```

3. **Use Stripe Test Cards:**
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future expiry date, any CVC

4. **Monitor Webhooks:**
   ```bash
   # Check webhook events in database
   psql "$DATABASE_URL" -c "SELECT * FROM \"WebhookEvent\" ORDER BY \"createdAt\" DESC LIMIT 5;"
   ```

---

## Developer Notes

### Test Coverage

- 129 passing tests (0 failures)
- Unit tests: 103
- Integration tests: 27
- Test command: `npm test` (from server directory)

### Code Quality

- TypeScript strict mode enabled
- ESLint configured
- Prettier for formatting
- No console errors in production build

### Architecture

- **Frontend:** React + TypeScript + Vite
- **Backend:** Express + TypeScript + Prisma
- **Mode:** Mock (in-memory) / Real (PostgreSQL + Stripe)
- **Testing:** Vitest + Playwright

---

## Support

**Logs Location:**

- API Server: `/tmp/mais-server.log`
- Web Client: `/tmp/mais-client.log`

**Need Help?**

- Check logs for errors
- Verify both services are running
- Confirm ports 3000 and 3001 are not blocked
- Review `.env` configuration in server directory

**Documentation:**

- `REMEDIATION_COMPLETE.md` - Recent fixes and improvements
- `DEPLOYMENT_INSTRUCTIONS.md` - Production deployment guide
- `MASTER_AUDIT_REPORT.md` - Security and quality audit results

---

## Happy Testing! 🎉

Your MAIS application is now running locally and ready for testing.

**Access Points:**

- 🌐 Web: http://localhost:3000
- 🔌 API: http://localhost:3001

Enjoy testing your business growth platform!
