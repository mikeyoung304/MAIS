# MAIS Widget SDK - Quick Start

## 30-Second Integration

### Step 1: Add the Script Tag

```html
<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="YOUR_TENANT_SLUG"
  data-api-key="YOUR_API_KEY"
></script>
```

### Step 2: Add the Container

```html
<div id="mais-widget"></div>
```

### Done!

That's it. The widget will automatically load and display in the container.

---

## Complete Example

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Book Your Wedding</title>
  </head>
  <body>
    <h1>Available Wedding Packages</h1>

    <!-- Widget Container -->
    <div id="mais-widget"></div>

    <!-- SDK Loader -->
    <script
      src="https://widget.mais.com/sdk/mais-sdk.min.js"
      data-tenant="bellaweddings"
      data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
    ></script>
  </body>
</html>
```

---

## API Key

Get your API key from the MAIS dashboard:

1. Log in to https://app.mais.com
2. Go to Settings → API Keys
3. Copy your **Publishable Key** (starts with `pk_live_`)

**Important:** Never use your secret key (`sk_live_`) in client-side code!

---

## Optional: Track Events

```html
<script>
  window.MAISWidget.on('bookingCompleted', function (data) {
    // Redirect to thank you page
    window.location.href = '/thank-you?booking=' + data.bookingId;
  });
</script>
```

---

## Need Help?

- Full Documentation: See `SDK_README.md`
- Example: Open `example.html` in your browser
- Test Suite: Open `test-sdk.html` to verify integration

---

## File Sizes

- **Production**: 3.4KB (1.4KB gzipped)
- **Development**: 6.6KB (2.2KB gzipped)

Both versions are lightning-fast and won't slow down your website.
