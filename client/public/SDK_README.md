# MAIS Widget SDK Documentation

## Overview

The MAIS Widget SDK is a lightweight JavaScript loader that embeds the MAIS wedding booking widget into any website. It handles iframe creation, postMessage communication, auto-resizing, and provides a simple API for widget control.

## File Sizes

- **Development**: `mais-sdk.js` - 6.6KB (2.2KB gzipped)
- **Production**: `mais-sdk.min.js` - 3.5KB (1.4KB gzipped)

Both versions are well under the 5KB minified target.

## Browser Compatibility

The SDK is written in ES5-compatible JavaScript and supports:

- Chrome 49+ (2016)
- Firefox 45+ (2016)
- Safari 10+ (2016)
- Edge 14+ (2016)
- IE 11 (with caveats - see below)

### IE11 Considerations

While the SDK uses ES5 syntax, IE11 users may experience:

- No support for `document.currentScript` - the SDK will fail to load with an error message
- URL encoding/decoding issues may require polyfills in the widget application
- postMessage works but has stricter CORS requirements

**Recommendation**: For IE11 support, add a polyfill for `document.currentScript` before loading the SDK.

## Basic Usage

### 1. Add the SDK Script Tag

```html
<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="your-tenant-slug"
  data-api-key="pk_live_yourtenant_0123456789abcdef"
></script>
```

### 2. Add the Widget Container

```html
<div id="mais-widget"></div>
```

### Complete Example

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Wedding Business</title>
  </head>
  <body>
    <h1>Book Your Dream Wedding</h1>

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

## Configuration Options

Configure the SDK using `data-*` attributes on the script tag:

| Attribute        | Required | Default       | Description                                       |
| ---------------- | -------- | ------------- | ------------------------------------------------- |
| `data-tenant`    | Yes      | -             | Your tenant slug (e.g., "bellaweddings")          |
| `data-api-key`   | Yes      | -             | Your publishable API key starting with `pk_live_` |
| `data-container` | No       | "mais-widget" | ID of the container element                       |
| `data-mode`      | No       | "embedded"    | Display mode: "embedded" or "modal"               |

### API Key Format

API keys must match the format: `pk_live_[tenant]_[16-hex-chars]`

Example: `pk_live_bellaweddings_a3f8c9d2e1b4f7g8`

## JavaScript API

The SDK exposes a `window.MAISWidget` object with methods and events:

### Methods

#### `openBooking(packageSlug)`

Open the widget to a specific package:

```javascript
window.MAISWidget.openBooking('luxury-package');
```

#### `close()`

Close the widget (useful in modal mode):

```javascript
window.MAISWidget.close();
```

#### `destroy()`

Remove the widget from the page and clean up event listeners:

```javascript
window.MAISWidget.destroy();
```

### Events

Subscribe to widget events using the `on()` method:

#### `ready`

Fired when the widget has loaded:

```javascript
window.MAISWidget.on('ready', function () {
  console.log('Widget is ready!');
});
```

#### `bookingCreated`

Fired when a booking is created:

```javascript
window.MAISWidget.on('bookingCreated', function (data) {
  console.log('Booking ID:', data.bookingId);
  console.log('Package:', data.packageSlug);
  console.log('Customer:', data.customerEmail);
});
```

**Event Data:**

```javascript
{
  bookingId: string,
  packageSlug: string,
  customerEmail: string,
  customerName: string,
  total: number
}
```

#### `bookingCompleted`

Fired when payment is completed:

```javascript
window.MAISWidget.on('bookingCompleted', function (data) {
  console.log('Booking completed!', data.bookingId);
  // Optionally redirect or show confirmation
});
```

**Event Data:**

```javascript
{
  bookingId: string,
  status: 'paid',
  returnUrl?: string
}
```

If `returnUrl` is provided, the SDK will automatically redirect the user.

#### `error`

Fired on widget errors:

```javascript
window.MAISWidget.on('error', function (data) {
  console.error('Widget error:', data.error);
  console.error('Details:', data.details);
});
```

## Advanced Examples

### Custom Event Handling

```html
<script>
  // Wait for widget to be available
  window.addEventListener('load', function () {
    if (window.MAISWidget) {
      // Track bookings with analytics
      window.MAISWidget.on('bookingCreated', function (data) {
        // Google Analytics 4
        gtag('event', 'begin_checkout', {
          currency: 'USD',
          value: data.total,
          items: [
            {
              item_id: data.packageSlug,
              item_name: data.packageName,
            },
          ],
        });
      });

      window.MAISWidget.on('bookingCompleted', function (data) {
        // Google Analytics 4
        gtag('event', 'purchase', {
          transaction_id: data.bookingId,
          value: data.total,
          currency: 'USD',
        });

        // Facebook Pixel
        fbq('track', 'Purchase', {
          value: data.total,
          currency: 'USD',
        });
      });
    }
  });
</script>
```

### Dynamic Package Opening

```html
<button onclick="bookPackage('basic')">Book Basic Package</button>
<button onclick="bookPackage('luxury')">Book Luxury Package</button>

<div id="mais-widget"></div>

<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="bellaweddings"
  data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
></script>

<script>
  function bookPackage(packageSlug) {
    if (window.MAISWidget) {
      window.MAISWidget.openBooking(packageSlug);
    }
  }
</script>
```

### Custom Container

```html
<!-- Custom container ID -->
<div id="my-booking-widget"></div>

<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="bellaweddings"
  data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
  data-container="my-booking-widget"
></script>
```

## Security Features

### 1. API Key Validation

The SDK validates API key format before initialization:

- Must start with `pk_live_`
- Must contain tenant slug
- Must have 16-character hex suffix

### 2. Origin Validation

All postMessage communications validate the origin:

- Production: `https://widget.mais.com`
- Development: `http://localhost:5173`

Messages from other origins are silently ignored.

### 3. Message Source Validation

All messages must include `source: 'mais-widget'` or `source: 'mais-parent'` to be processed.

### 4. CSP Compliance

The SDK is compatible with Content Security Policy:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://widget.mais.com;
  frame-src https://widget.mais.com;
  connect-src https://api.mais.com;
```

## Communication Protocol

### Messages from Widget (iframe) to Parent

#### READY

```javascript
{
  source: 'mais-widget',
  type: 'READY'
}
```

#### RESIZE

```javascript
{
  source: 'mais-widget',
  type: 'RESIZE',
  height: 800
}
```

#### BOOKING_CREATED

```javascript
{
  source: 'mais-widget',
  type: 'BOOKING_CREATED',
  bookingId: 'bk_abc123',
  packageSlug: 'luxury-package',
  customerEmail: 'customer@example.com',
  customerName: 'Jane Doe',
  total: 5000
}
```

#### BOOKING_COMPLETED

```javascript
{
  source: 'mais-widget',
  type: 'BOOKING_COMPLETED',
  bookingId: 'bk_abc123',
  status: 'paid',
  returnUrl: 'https://example.com/thank-you'
}
```

#### ERROR

```javascript
{
  source: 'mais-widget',
  type: 'ERROR',
  error: 'Payment failed',
  details: { code: 'card_declined' }
}
```

### Messages from Parent to Widget (iframe)

#### OPEN_BOOKING

```javascript
{
  source: 'mais-parent',
  type: 'OPEN_BOOKING',
  packageSlug: 'luxury-package'
}
```

#### CLOSE

```javascript
{
  source: 'mais-parent',
  type: 'CLOSE'
}
```

## Deployment

### Development

```html
<script src="http://localhost:5173/mais-sdk.js" ...>
```

The SDK auto-detects localhost and connects to `http://localhost:5173` for the widget.

### Production

```html
<script src="https://widget.mais.com/sdk/mais-sdk.min.js" ...>
```

## Troubleshooting

### Widget doesn't appear

1. Check browser console for errors
2. Verify container element exists: `document.getElementById('mais-widget')`
3. Verify API key format matches: `pk_live_[tenant]_[16-hex]`
4. Check that the script tag has both `data-tenant` and `data-api-key`

### Widget appears but doesn't resize

1. Check browser console for postMessage errors
2. Verify origin validation is passing
3. Ensure the widget application is sending RESIZE messages

### Events not firing

1. Add event listeners AFTER the SDK loads (wrap in `window.addEventListener('load', ...)`)
2. Check that `window.MAISWidget` exists
3. Verify the widget is emitting messages with correct `source: 'mais-widget'`

### CORS errors

1. Verify the widget URL matches the expected origin
2. Check that iframe `src` includes `parentOrigin` parameter
3. Ensure the widget application is validating `parentOrigin`

## Support

For technical support or questions:

- Email: support@mais.com
- Documentation: https://docs.mais.com
- Status: https://status.mais.com
