# MAIS Widget Integration Guide

**Version:** 2.0
**Last Updated:** January 2025
**For:** Tenant websites embedding the MAIS booking widget

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration Options](#configuration-options)
3. [Display Modes](#display-modes)
4. [Branding & Customization](#branding--customization)
5. [Event Handling](#event-handling)
6. [Complete Examples](#complete-examples)
7. [Troubleshooting](#troubleshooting)
8. [Security Best Practices](#security-best-practices)
9. [API Reference](#api-reference)

---

## Quick Start

Embed the MAIS booking widget on your website in 3 simple steps:

### Step 1: Get Your API Key

Login to your MAIS admin dashboard and copy your **Public API Key** from the "Widget" section:

```
pk_live_yourcompany_abc123xyz789
```

**Important:**

- Use `pk_live_*` keys for production
- Use `pk_test_*` keys for testing (if available)
- Never share your secret key (`sk_live_*`)

### Step 2: Add the Embed Code

Add this code snippet to your website where you want the booking widget to appear:

```html
<!-- MAIS Booking Widget -->
<div id="mais-booking-widget"></div>

<script>
  (function () {
    window.MaisConfig = {
      apiKey: 'pk_live_yourcompany_abc123xyz789',
      container: '#mais-booking-widget',
    };
    var s = document.createElement('script');
    s.src = 'https://widget.mais.com/sdk/mais-sdk.js';
    s.async = true;
    document.head.appendChild(s);
  })();
</script>
```

**For local development:**

```javascript
s.src = 'http://localhost:5173/widget-loader.js';
```

### Step 3: Test Your Integration

1. Open your website in a browser
2. You should see the booking widget load within a few seconds
3. Test the booking flow:
   - Browse packages
   - Select a date
   - Add any add-ons
   - Complete checkout (use test card `4242 4242 4242 4242` in test mode)

**That's it!** The widget will automatically match your branding settings from the MAIS admin dashboard.

---

## Configuration Options

### Basic Configuration

```javascript
window.MaisConfig = {
  // REQUIRED: Your public API key
  apiKey: 'pk_live_yourcompany_abc123xyz789',

  // OPTIONAL: Container selector (default: '#mais-booking-widget')
  container: '#booking-section',

  // OPTIONAL: Display mode ('embedded' or 'modal', default: 'embedded')
  mode: 'embedded',

  // OPTIONAL: Theme override ('light' or 'dark', default: auto-detect)
  theme: 'light',
};
```

### Advanced Configuration

```javascript
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  container: '#mais-booking-widget',
  mode: 'embedded',

  // Pre-select a package by slug
  defaultPackage: 'intimate-ceremony',

  // Pre-select a date (ISO 8601 format)
  defaultDate: '2025-06-15',

  // Prefill customer information
  prefill: {
    name: 'John Smith',
    email: 'john@example.com',
    guestCount: 25,
  },

  // Custom CSS class for the widget container
  className: 'my-custom-widget',

  // Language (if multi-language support is enabled)
  locale: 'en-US',

  // Event callbacks (see Event Handling section)
  onBookingComplete: function (booking) {
    console.log('Booking completed!', booking);
  },

  onError: function (error) {
    console.error('Widget error:', error);
  },
};
```

### Configuration via Data Attributes

Alternatively, you can configure the widget using HTML data attributes:

```html
<div
  id="mais-booking-widget"
  data-api-key="pk_live_yourcompany_abc123xyz789"
  data-mode="embedded"
  data-theme="light"
  data-default-package="intimate-ceremony"
  data-default-date="2025-06-15"
></div>

<script src="https://widget.mais.com/sdk/mais-sdk.js" async></script>
```

---

## Display Modes

The widget supports two display modes:

### 1. Embedded Mode (Default)

The widget renders inline within your page content.

```javascript
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  mode: 'embedded',
};
```

**Best for:**

- Dedicated booking pages
- Full-width sections
- Step-by-step booking flows

**Example:**

```html
<section class="booking-section">
  <h2>Book Your Wedding Date</h2>
  <div id="mais-booking-widget"></div>
</section>
```

### 2. Modal/Popup Mode

The widget opens in a modal overlay when triggered by a button click.

```javascript
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  mode: 'modal',
  trigger: '#book-now-button', // Button that opens the modal
};
```

**Best for:**

- Homepage call-to-action buttons
- Navigation menu links
- Floating booking buttons

**Example:**

```html
<button id="book-now-button">Book Your Date</button>

<script>
  window.MaisConfig = {
    apiKey: 'pk_live_yourcompany_abc123xyz789',
    mode: 'modal',
    trigger: '#book-now-button',
  };
</script>
<script src="https://widget.mais.com/sdk/mais-sdk.js" async></script>
```

**Programmatic Control:**

```javascript
// Open modal programmatically
if (window.Mais) {
  window.Mais.open();
}

// Close modal
window.Mais.close();

// Check if modal is open
const isOpen = window.Mais.isOpen();
```

---

## Branding & Customization

### Automatic Branding

The widget automatically inherits branding settings from your MAIS admin dashboard:

- **Primary Color** - Buttons, links, accents
- **Logo** - Displayed in widget header
- **Font Family** - Custom brand fonts
- **Border Radius** - Rounded vs. sharp corners

**To customize branding:**

1. Login to MAIS admin dashboard
2. Navigate to **Settings** → **Branding**
3. Update colors, logo, fonts
4. Changes apply immediately to all widget instances

### Custom CSS

For additional styling, you can target the widget with custom CSS:

```css
/* Target the widget container */
.mais-widget-container {
  max-width: 800px;
  margin: 0 auto;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Custom button styling (use your brand colors) */
.mais-widget-container button[type='submit'] {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Customize package cards */
.mais-package-card {
  border: 2px solid #e5e7eb;
  transition: transform 0.2s;
}

.mais-package-card:hover {
  transform: translateY(-4px);
  border-color: #667eea;
}
```

**CSS Class Reference:**

| Class                    | Description             |
| ------------------------ | ----------------------- |
| `.mais-widget-container` | Main widget wrapper     |
| `.mais-package-card`     | Individual package card |
| `.mais-date-picker`      | Date selection calendar |
| `.mais-addon-item`       | Add-on selection item   |
| `.mais-summary-panel`    | Booking summary sidebar |
| `.mais-checkout-button`  | Primary checkout button |

### Dark Mode Support

The widget automatically detects and adapts to dark mode:

```javascript
// Force light mode
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  theme: 'light',
};

// Force dark mode
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  theme: 'dark',
};

// Auto-detect (default)
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  theme: 'auto',
};
```

---

## Event Handling

The widget emits events at key points in the booking flow, allowing you to integrate with analytics, CRM systems, or custom workflows.

### Available Events

#### 1. `booking:started`

Fired when a customer begins the booking process.

```javascript
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  onBookingStarted: function (data) {
    console.log('Booking started:', data);
    // data = { packageId, packageName, eventDate }

    // Example: Send to Google Analytics
    if (window.gtag) {
      gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: data.packagePrice / 100,
        items: [
          {
            item_id: data.packageId,
            item_name: data.packageName,
          },
        ],
      });
    }
  },
};
```

**Event Data:**

```javascript
{
  packageId: "pkg_abc123",
  packageName: "Intimate Ceremony",
  packagePrice: 500000, // in cents ($5,000)
  eventDate: "2025-06-15"
}
```

#### 2. `booking:completed`

Fired when a booking is successfully completed and payment is confirmed.

```javascript
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  onBookingComplete: function (booking) {
    console.log('Booking completed!', booking);

    // Example: Send to Google Analytics
    if (window.gtag) {
      gtag('event', 'purchase', {
        transaction_id: booking.bookingId,
        value: booking.totalPrice / 100,
        currency: 'USD',
        items: [
          {
            item_id: booking.packageId,
            item_name: booking.packageName,
            quantity: 1,
            price: booking.totalPrice / 100,
          },
        ],
      });
    }

    // Example: Redirect to thank you page
    window.location.href = '/thank-you?booking=' + booking.bookingId;
  },
};
```

**Event Data:**

```javascript
{
  bookingId: "booking_xyz789",
  packageId: "pkg_abc123",
  packageName: "Intimate Ceremony",
  eventDate: "2025-06-15",
  totalPrice: 550000, // in cents ($5,500 with add-ons)
  customerEmail: "customer@example.com",
  customerName: "John & Jane Smith",
  addOns: [
    { id: "addon_1", name: "Photography Package", price: 50000 }
  ]
}
```

#### 3. `booking:error`

Fired when an error occurs during the booking process.

```javascript
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  onError: function (error) {
    console.error('Booking error:', error);

    // Example: Show custom error message
    if (error.code === 'DATE_UNAVAILABLE') {
      alert('Sorry, that date is no longer available. Please choose another date.');
    }
  },
};
```

**Error Codes:**

- `DATE_UNAVAILABLE` - Selected date is already booked
- `PAYMENT_FAILED` - Payment processing failed
- `INVALID_DATA` - Form validation error
- `NETWORK_ERROR` - Connection issue
- `API_ERROR` - Server error

#### 4. `widget:loaded`

Fired when the widget finishes loading and is ready for interaction.

```javascript
window.MaisConfig = {
  apiKey: 'pk_live_yourcompany_abc123xyz789',
  onWidgetLoaded: function () {
    console.log('Widget loaded successfully');

    // Example: Hide custom loading spinner
    document.getElementById('custom-loader').style.display = 'none';
  },
};
```

### Global Event Listener

You can also listen to all widget events using a global listener:

```javascript
window.addEventListener('message', function (event) {
  // Verify origin for security
  if (event.origin !== 'https://widget.mais.com') return;

  switch (event.data.type) {
    case 'mais:booking:started':
      console.log('Booking started:', event.data);
      break;

    case 'mais:booking:completed':
      console.log('Booking completed:', event.data);
      break;

    case 'mais:error':
      console.error('Error:', event.data);
      break;

    case 'mais:resize':
      // Widget height changed (automatic, no action needed)
      break;
  }
});
```

---

## Complete Examples

### Example 1: Basic Embedded Widget

**Use case:** Simple booking page with embedded widget.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Book Your Wedding - Bella Weddings</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
        background: #f9fafb;
      }

      .header {
        text-align: center;
        margin-bottom: 3rem;
      }

      .header h1 {
        font-size: 2.5rem;
        color: #111827;
        margin-bottom: 0.5rem;
      }

      .header p {
        font-size: 1.125rem;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Book Your Perfect Day</h1>
      <p>Select your package, choose your date, and let's make it official!</p>
    </div>

    <!-- Widget Container -->
    <div id="mais-booking-widget"></div>

    <!-- Widget Configuration & Loader -->
    <script>
      (function () {
        window.MaisConfig = {
          apiKey: 'pk_live_bellaweddings_abc123xyz789',
          container: '#mais-booking-widget',
          mode: 'embedded',

          // Track bookings with Google Analytics
          onBookingComplete: function (booking) {
            console.log('Booking completed:', booking);

            if (window.gtag) {
              gtag('event', 'purchase', {
                transaction_id: booking.bookingId,
                value: booking.totalPrice / 100,
                currency: 'USD',
              });
            }

            // Redirect to thank you page
            setTimeout(() => {
              window.location.href = '/thank-you.html';
            }, 2000);
          },
        };

        var script = document.createElement('script');
        script.src = 'https://widget.mais.com/sdk/mais-sdk.js';
        script.async = true;
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>
```

### Example 2: Modal/Popup Widget

**Use case:** Homepage with call-to-action button that opens booking modal.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bella Weddings - Intimate Elopements</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .hero {
        text-align: center;
        padding: 2rem;
      }

      .hero h1 {
        font-size: 3rem;
        margin-bottom: 1rem;
        font-weight: 700;
      }

      .hero p {
        font-size: 1.25rem;
        margin-bottom: 2rem;
        opacity: 0.9;
      }

      .cta-button {
        background: white;
        color: #667eea;
        border: none;
        padding: 1rem 3rem;
        font-size: 1.125rem;
        font-weight: 600;
        border-radius: 50px;
        cursor: pointer;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        transition:
          transform 0.2s,
          box-shadow 0.2s;
      }

      .cta-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
      }
    </style>
  </head>
  <body>
    <div class="hero">
      <h1>Say "I Do" Your Way</h1>
      <p>Beautiful, intimate elopements in stunning locations</p>
      <button id="book-now-button" class="cta-button">Book Your Date</button>
    </div>

    <!-- Widget Configuration & Loader -->
    <script>
      (function () {
        window.MaisConfig = {
          apiKey: 'pk_live_bellaweddings_abc123xyz789',
          mode: 'modal',
          trigger: '#book-now-button',

          onBookingComplete: function (booking) {
            // Close modal and redirect
            window.Mais.close();
            window.location.href = '/confirmation?booking=' + booking.bookingId;
          },

          onError: function (error) {
            alert('Oops! ' + error.message);
          },
        };

        var script = document.createElement('script');
        script.src = 'https://widget.mais.com/sdk/mais-sdk.js';
        script.async = true;
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>
```

### Example 3: Pre-filled Booking

**Use case:** Email campaign link that pre-selects a package and date.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Special Offer - Book Your June Wedding</title>
  </head>
  <body>
    <div id="mais-booking-widget"></div>

    <script>
      // Extract URL parameters
      const urlParams = new URLSearchParams(window.location.search);

      (function () {
        window.MaisConfig = {
          apiKey: 'pk_live_bellaweddings_abc123xyz789',
          container: '#mais-booking-widget',

          // Pre-select package from URL
          defaultPackage: urlParams.get('package') || 'intimate-ceremony',

          // Pre-select date from URL
          defaultDate: urlParams.get('date') || '2025-06-15',

          // Prefill customer info if available
          prefill: {
            email: urlParams.get('email') || '',
            name: urlParams.get('name') || '',
          },

          onBookingComplete: function (booking) {
            // Track campaign conversion
            if (window.gtag) {
              gtag('event', 'conversion', {
                send_to: 'AW-123456789/ABC123',
                value: booking.totalPrice / 100,
                currency: 'USD',
                transaction_id: booking.bookingId,
              });
            }
          },
        };

        var script = document.createElement('script');
        script.src = 'https://widget.mais.com/sdk/mais-sdk.js';
        script.async = true;
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>
```

---

## Troubleshooting

### Widget Not Loading

**Symptom:** Empty space where widget should appear.

**Solutions:**

1. **Check API key format:**

   ```javascript
   // Correct format
   apiKey: 'pk_live_yourcompany_abc123xyz789';

   // Common mistakes
   apiKey: 'sk_live_...'; // Wrong! Don't use secret key
   apiKey: 'pk_test_...'; // Test key won't work in production
   ```

2. **Check container exists:**

   ```javascript
   // Ensure container is in DOM before script runs
   console.log(document.querySelector('#mais-booking-widget')); // Should not be null
   ```

3. **Check browser console for errors:**

   ```javascript
   // Press F12 to open DevTools → Console tab
   // Look for errors like:
   // - "Invalid API key"
   // - "Container not found"
   // - CORS errors
   ```

4. **Verify HTTPS:**
   ```
   Widget requires HTTPS in production.
   Use http://localhost for local development only.
   ```

### Widget Not Resizing

**Symptom:** Scrollbars inside widget, or widget is too tall/short.

**Solutions:**

1. **Ensure container has no fixed height:**

   ```css
   /* BAD */
   #mais-booking-widget {
     height: 500px; /* Don't set fixed height! */
   }

   /* GOOD */
   #mais-booking-widget {
     min-height: 400px;
     /* Widget will auto-resize via postMessage */
   }
   ```

2. **Check for CSS conflicts:**
   ```css
   /* Ensure no parent container restricts height */
   .parent-container {
     overflow: hidden; /* Can cause issues */
     height: 500px; /* Can cause issues */
   }
   ```

### Branding Not Applied

**Symptom:** Widget uses default colors instead of your brand colors.

**Solutions:**

1. **Verify branding settings in admin dashboard:**
   - Login to MAIS admin
   - Navigate to **Settings** → **Branding**
   - Ensure primary color, logo are saved
   - Try clearing cache and reloading

2. **Allow 5-10 minutes for cache refresh:**
   ```
   Branding changes may take a few minutes to propagate to CDN.
   Hard refresh your page (Ctrl+Shift+R or Cmd+Shift+R).
   ```

### Payment Errors

**Symptom:** "Payment failed" error during checkout.

**Solutions:**

1. **Check Stripe connection:**
   - Login to MAIS admin
   - Navigate to **Settings** → **Payments**
   - Ensure Stripe account is connected
   - Test mode: Use test card `4242 4242 4242 4242`

2. **Verify test vs. live mode:**

   ```javascript
   // Development/testing
   apiKey: 'pk_test_yourcompany_...'; // Uses Stripe test mode

   // Production
   apiKey: 'pk_live_yourcompany_...'; // Uses Stripe live mode
   ```

### Date Not Available

**Symptom:** All dates show as unavailable.

**Solutions:**

1. **Check calendar integration:**
   - Login to MAIS admin
   - Navigate to **Settings** → **Availability**
   - Ensure Google Calendar is connected
   - Check blackout dates

2. **Verify package settings:**
   - Ensure packages are marked as "Active"
   - Check minimum/maximum guest counts
   - Verify advance booking window (e.g., "Book at least 30 days in advance")

### Performance Issues

**Symptom:** Widget loads slowly.

**Solutions:**

1. **Use async loading:**

   ```javascript
   // GOOD - Non-blocking
   script.async = true;

   // BAD - Blocks page render
   script.async = false;
   ```

2. **Optimize images:**

   ```
   - Compress package photos
   - Use WebP format
   - Set reasonable dimensions (max 1200px width)
   ```

3. **Check network:**
   ```
   - Open DevTools → Network tab
   - Look for slow requests
   - Check CDN latency
   ```

### CORS Errors

**Symptom:** Console shows "Cross-Origin Request Blocked" error.

**Solutions:**

1. **Add your domain to allowed domains:**
   - Login to MAIS admin
   - Navigate to **Settings** → **Security**
   - Add your domain to "Allowed Domains" list
   - Include both `www` and non-`www` versions

2. **Ensure correct domain format:**

   ```
   CORRECT:
   - example.com
   - www.example.com
   - booking.example.com

   INCORRECT:
   - https://example.com  (no protocol)
   - example.com/        (no trailing slash)
   ```

---

## Security Best Practices

### 1. Use Public Keys Only

```javascript
// CORRECT - Public key is safe to embed in HTML
apiKey: 'pk_live_yourcompany_abc123xyz789';

// WRONG - Never embed secret key in client-side code!
apiKey: 'sk_live_yourcompany_...'; // NEVER DO THIS!
```

### 2. Restrict Allowed Domains

Prevent unauthorized use of your widget by restricting which domains can embed it:

1. Login to MAIS admin dashboard
2. Navigate to **Settings** → **Security** → **Allowed Domains**
3. Add only your authorized domains:
   ```
   yourcompany.com
   www.yourcompany.com
   ```

**Note:** Localhost is automatically allowed for development.

### 3. Use HTTPS

Always serve your website over HTTPS in production:

```
✅ https://yourcompany.com  - Secure
❌ http://yourcompany.com   - Insecure (widget may not load)
```

### 4. Validate Booking Confirmations

Never rely solely on client-side `onBookingComplete` callback for critical operations. Always verify booking status server-side:

```javascript
// Client-side (widget callback)
onBookingComplete: function(booking) {
  // Show success message to user
  showSuccessMessage(booking.bookingId);

  // Send booking ID to your server for verification
  fetch('/api/verify-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: booking.bookingId })
  });
}
```

```javascript
// Server-side (your backend)
app.post('/api/verify-booking', async (req, res) => {
  const { bookingId } = req.body;

  // Verify booking with MAIS API using your secret key
  const response = await fetch(`https://api.mais.com/v1/bookings/${bookingId}`, {
    headers: {
      Authorization: `Bearer ${process.env.MAIS_SECRET_KEY}`,
      'X-Tenant-Key': 'pk_live_yourcompany_abc123xyz789',
    },
  });

  const booking = await response.json();

  if (booking.status === 'CONFIRMED') {
    // Safe to proceed
    sendConfirmationEmail(booking);
  }
});
```

### 5. Content Security Policy (CSP)

If your website uses CSP headers, whitelist the MAIS widget domain:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://widget.mais.com;
  frame-src https://widget.mais.com;
  connect-src 'self' https://api.mais.com;
  img-src 'self' https://cdn.mais.com;
```

---

## API Reference

### Global `Mais` Object

After the widget loads, a global `window.Mais` object is available for programmatic control.

#### Methods

##### `Mais.open()`

Opens the booking widget (modal mode only).

```javascript
document.getElementById('custom-button').addEventListener('click', function () {
  window.Mais.open();
});
```

##### `Mais.close()`

Closes the booking widget (modal mode only).

```javascript
window.Mais.close();
```

##### `Mais.isOpen()`

Returns `true` if modal is currently open.

```javascript
if (window.Mais.isOpen()) {
  console.log('Modal is open');
}
```

##### `Mais.reset()`

Resets the booking flow to the initial state.

```javascript
window.Mais.reset();
```

##### `Mais.setPackage(packageSlug)`

Pre-selects a package by slug.

```javascript
window.Mais.setPackage('intimate-ceremony');
```

##### `Mais.setDate(dateString)`

Pre-selects a date (ISO 8601 format: `YYYY-MM-DD`).

```javascript
window.Mais.setDate('2025-06-15');
```

##### `Mais.getBookingData()`

Returns current booking state (for debugging).

```javascript
const bookingData = window.Mais.getBookingData();
console.log(bookingData);
// {
//   packageId: "pkg_abc123",
//   eventDate: "2025-06-15",
//   addOns: [...],
//   totalPrice: 550000
// }
```

---

## Support

### Documentation

- **Integration Guide:** This document
- **API Documentation:** https://docs.mais.com/api
- **Admin Dashboard Help:** https://docs.mais.com/admin

### Contact

- **Email Support:** support@mais.com
- **Live Chat:** Available in MAIS admin dashboard
- **Phone:** +1 (555) 123-4567 (Mon-Fri, 9am-5pm EST)

### Feedback

We're constantly improving the widget! Share your feedback:

- **Feature Requests:** feature-requests@mais.com
- **Bug Reports:** bugs@mais.com

---

**Last Updated:** January 2025
**Widget Version:** 2.0
**SDK Version:** https://widget.mais.com/sdk/mais-sdk.js
