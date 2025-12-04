# MAIS Widget SDK - Usage Snippets

Quick copy-paste snippets for common integration scenarios.

---

## Basic Integration

### Minimal Setup

```html
<div id="mais-widget"></div>
<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="YOUR_TENANT"
  data-api-key="YOUR_API_KEY"
></script>
```

---

## Event Tracking

### Google Analytics 4

```html
<script>
  window.MAISWidget.on('bookingCreated', function (data) {
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
    gtag('event', 'purchase', {
      transaction_id: data.bookingId,
      value: data.total,
      currency: 'USD',
    });
  });
</script>
```

### Facebook Pixel

```html
<script>
  window.MAISWidget.on('bookingCreated', function (data) {
    fbq('track', 'InitiateCheckout', {
      value: data.total,
      currency: 'USD',
      content_name: data.packageName,
    });
  });

  window.MAISWidget.on('bookingCompleted', function (data) {
    fbq('track', 'Purchase', {
      value: data.total,
      currency: 'USD',
      transaction_id: data.bookingId,
    });
  });
</script>
```

### Custom Analytics

```html
<script>
  window.MAISWidget.on('ready', function () {
    console.log('Widget loaded');
    trackEvent('widget_loaded');
  });

  window.MAISWidget.on('bookingCreated', function (data) {
    trackEvent('booking_created', {
      booking_id: data.bookingId,
      package: data.packageSlug,
      amount: data.total,
    });
  });

  window.MAISWidget.on('bookingCompleted', function (data) {
    trackEvent('booking_completed', {
      booking_id: data.bookingId,
      status: data.status,
    });

    // Redirect to thank you page
    window.location.href = '/thank-you?id=' + data.bookingId;
  });

  window.MAISWidget.on('error', function (data) {
    trackEvent('widget_error', {
      error: data.error,
      details: data.details,
    });
  });
</script>
```

---

## Dynamic Package Opening

### From Buttons

```html
<button onclick="openPackage('basic')">Basic Package</button>
<button onclick="openPackage('premium')">Premium Package</button>
<button onclick="openPackage('luxury')">Luxury Package</button>

<div id="mais-widget"></div>

<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="bellaweddings"
  data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
></script>

<script>
  function openPackage(packageSlug) {
    window.MAISWidget.openBooking(packageSlug);

    // Optional: scroll to widget
    document.getElementById('mais-widget').scrollIntoView({
      behavior: 'smooth',
    });
  }
</script>
```

### From URL Parameters

```html
<script>
  // Load SDK first
</script>

<script>
  // After SDK loads, check URL for package parameter
  window.addEventListener('load', function () {
    const urlParams = new URLSearchParams(window.location.search);
    const packageSlug = urlParams.get('package');

    if (packageSlug && window.MAISWidget) {
      window.MAISWidget.openBooking(packageSlug);
    }
  });
</script>
```

Example URL: `https://example.com/booking?package=luxury`

### From Deep Links

```html
<script>
  // Handle deep links like /book/luxury-package
  window.addEventListener('load', function () {
    const path = window.location.pathname;
    const match = path.match(/\/book\/([a-z0-9-]+)/);

    if (match && match[1] && window.MAISWidget) {
      window.MAISWidget.openBooking(match[1]);
    }
  });
</script>
```

---

## Custom Container

### Different Container ID

```html
<div id="my-booking-form"></div>

<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="bellaweddings"
  data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
  data-container="my-booking-form"
></script>
```

### Multiple Containers (Conditional)

```html
<!-- Mobile container -->
<div id="mobile-widget" class="md:hidden"></div>

<!-- Desktop container -->
<div id="desktop-widget" class="hidden md:block"></div>

<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="bellaweddings"
  data-api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
  data-container="mobile-widget"
></script>

<script>
  // Dynamically switch container based on screen size
  if (window.matchMedia('(min-width: 768px)').matches) {
    window.MAISWidget.config.containerId = 'desktop-widget';
    window.MAISWidget.init(); // Re-initialize with new container
  }
</script>
```

---

## WordPress Integration

### In Theme Template

```php
<!-- In your theme's page template -->
<div id="mais-widget"></div>

<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="<?php echo get_option('mais_tenant_slug'); ?>"
  data-api-key="<?php echo get_option('mais_api_key'); ?>">
</script>
```

### As Shortcode

```php
// In functions.php
function mais_widget_shortcode($atts) {
    $atts = shortcode_atts([
        'tenant' => get_option('mais_tenant_slug'),
        'api_key' => get_option('mais_api_key'),
        'package' => '',
    ], $atts);

    $container_id = 'mais-widget-' . uniqid();

    ob_start();
    ?>
    <div id="<?php echo $container_id; ?>"></div>
    <script
      src="https://widget.mais.com/sdk/mais-sdk.min.js"
      data-tenant="<?php echo esc_attr($atts['tenant']); ?>"
      data-api-key="<?php echo esc_attr($atts['api_key']); ?>"
      data-container="<?php echo $container_id; ?>">
    </script>
    <?php if ($atts['package']): ?>
    <script>
    window.addEventListener('load', function() {
      if (window.MAISWidget) {
        window.MAISWidget.openBooking('<?php echo esc_js($atts['package']); ?>');
      }
    });
    </script>
    <?php endif; ?>
    <?php
    return ob_get_clean();
}
add_shortcode('mais_widget', 'mais_widget_shortcode');
```

Usage in WordPress editor:

```
[mais_widget]
[mais_widget package="luxury"]
```

---

## Shopify Integration

### In Theme Liquid Template

```liquid
<!-- In your theme's page template -->
<div id="mais-widget"></div>

<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="{{ shop.metafields.mais.tenant }}"
  data-api-key="{{ shop.metafields.mais.api_key }}">
</script>

<script>
window.MAISWidget.on('bookingCompleted', function(data) {
  // Track Shopify conversion
  if (typeof Shopify !== 'undefined' && Shopify.analytics) {
    Shopify.analytics.publish('booking_completed', {
      booking_id: data.bookingId,
      value: data.total
    });
  }
});
</script>
```

---

## React Integration

### Functional Component

```jsx
import { useEffect, useRef } from 'react';

function MAISWidgetEmbed({ tenant, apiKey, onBookingCompleted }) {
  const containerRef = useRef(null);
  const scriptRef = useRef(null);

  useEffect(() => {
    // Create and append script
    const script = document.createElement('script');
    script.src = 'https://widget.mais.com/sdk/mais-sdk.min.js';
    script.setAttribute('data-tenant', tenant);
    script.setAttribute('data-api-key', apiKey);
    script.setAttribute('data-container', 'mais-widget-react');
    script.async = true;

    document.body.appendChild(script);
    scriptRef.current = script;

    // Listen for events
    const handleBookingCompleted = (data) => {
      if (onBookingCompleted) {
        onBookingCompleted(data);
      }
    };

    script.onload = () => {
      if (window.MAISWidget) {
        window.MAISWidget.on('bookingCompleted', handleBookingCompleted);
      }
    };

    // Cleanup
    return () => {
      if (window.MAISWidget) {
        window.MAISWidget.destroy();
      }
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current);
      }
    };
  }, [tenant, apiKey, onBookingCompleted]);

  return <div id="mais-widget-react" ref={containerRef} />;
}

// Usage
function BookingPage() {
  const handleBookingCompleted = (data) => {
    console.log('Booking completed:', data);
    // Navigate to success page
    window.location.href = `/success?booking=${data.bookingId}`;
  };

  return (
    <div>
      <h1>Book Your Wedding</h1>
      <MAISWidgetEmbed
        tenant="bellaweddings"
        apiKey="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
        onBookingCompleted={handleBookingCompleted}
      />
    </div>
  );
}
```

---

## Vue Integration

### Vue 3 Component

```vue
<template>
  <div id="mais-widget-vue"></div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  tenant: String,
  apiKey: String,
});

const emit = defineEmits(['booking-completed']);

let scriptElement = null;

onMounted(() => {
  // Load SDK
  const script = document.createElement('script');
  script.src = 'https://widget.mais.com/sdk/mais-sdk.min.js';
  script.setAttribute('data-tenant', props.tenant);
  script.setAttribute('data-api-key', props.apiKey);
  script.setAttribute('data-container', 'mais-widget-vue');

  script.onload = () => {
    if (window.MAISWidget) {
      window.MAISWidget.on('bookingCompleted', (data) => {
        emit('booking-completed', data);
      });
    }
  };

  document.body.appendChild(script);
  scriptElement = script;
});

onUnmounted(() => {
  if (window.MAISWidget) {
    window.MAISWidget.destroy();
  }
  if (scriptElement) {
    document.body.removeChild(scriptElement);
  }
});
</script>

<!-- Usage -->
<MAISWidget
  tenant="bellaweddings"
  api-key="pk_live_bellaweddings_a3f8c9d2e1b4f7g8"
  @booking-completed="handleBookingCompleted"
/>
```

---

## Content Security Policy

### Required CSP Directives

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://widget.mais.com;
  frame-src https://widget.mais.com;
  connect-src 'self' https://api.mais.com;
  style-src 'self' 'unsafe-inline';
```

### HTML Meta Tag

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
  default-src 'self';
  script-src 'self' https://widget.mais.com;
  frame-src https://widget.mais.com;
  connect-src 'self' https://api.mais.com;
"
/>
```

---

## Error Handling

### Production Error Tracking

```html
<script>
  window.MAISWidget.on('error', function (data) {
    // Log to Sentry
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(new Error(data.error), {
        extra: {
          details: data.details,
          tenant: window.MAISWidget.config.tenant,
        },
      });
    }

    // Show user-friendly error
    alert('Sorry, there was an error processing your booking. Please try again.');
  });
</script>
```

### Custom Error Display

```html
<div id="mais-widget"></div>
<div id="error-message" style="display: none; color: red; padding: 20px;">
  <p><strong>Error:</strong> <span id="error-text"></span></p>
  <button onclick="retryBooking()">Try Again</button>
</div>

<script>
  window.MAISWidget.on('error', function (data) {
    document.getElementById('error-text').textContent = data.error;
    document.getElementById('error-message').style.display = 'block';
    document.getElementById('mais-widget').style.display = 'none';
  });

  function retryBooking() {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('mais-widget').style.display = 'block';
    window.MAISWidget.init(); // Reinitialize widget
  }
</script>
```

---

## Development vs Production

### Environment Detection

```html
<script>
  // Dynamically choose SDK based on environment
  const sdkUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:5173/mais-sdk.js'
      : 'https://widget.mais.com/sdk/mais-sdk.min.js';

  const script = document.createElement('script');
  script.src = sdkUrl;
  script.setAttribute('data-tenant', 'bellaweddings');
  script.setAttribute('data-api-key', 'pk_live_bellaweddings_a3f8c9d2e1b4f7g8');
  document.body.appendChild(script);
</script>
```

### Debug Mode

```html
<script>
  // Enable debug logging
  window.MAIS_DEBUG = true;

  window.MAISWidget.on('ready', function () {
    console.log('[DEBUG] Widget ready');
  });

  window.MAISWidget.on('bookingCreated', function (data) {
    console.log('[DEBUG] Booking created:', JSON.stringify(data, null, 2));
  });
</script>
```

---

## Testing

### Local Testing with Static HTML

```bash
# Serve the example locally
cd client/public
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/example.html
```

### Test API Key Validation

```html
<!-- This will fail with error message -->
<script
  src="https://widget.mais.com/sdk/mais-sdk.min.js"
  data-tenant="bellaweddings"
  data-api-key="invalid_key"
></script>
<!-- Check console for error: "[MAIS SDK] Invalid API key format" -->
```

---

## Performance Optimization

### Lazy Load Widget Below Fold

```html
<div id="mais-widget" data-lazy-load="true"></div>

<script>
  // Load SDK only when widget container is visible
  const observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      const script = document.createElement('script');
      script.src = 'https://widget.mais.com/sdk/mais-sdk.min.js';
      script.setAttribute('data-tenant', 'bellaweddings');
      script.setAttribute('data-api-key', 'pk_live_bellaweddings_a3f8c9d2e1b4f7g8');
      document.body.appendChild(script);
      observer.disconnect();
    }
  });

  observer.observe(document.getElementById('mais-widget'));
</script>
```

### Preconnect to Widget Domain

```html
<link rel="preconnect" href="https://widget.mais.com" />
<link rel="dns-prefetch" href="https://widget.mais.com" />
```

---

## Common Issues & Solutions

### Widget Not Appearing

```javascript
// Debug checklist
console.log('Container exists:', !!document.getElementById('mais-widget'));
console.log('MAISWidget loaded:', !!window.MAISWidget);
console.log('Config:', window.MAISWidget?.config);
console.log('Iframe created:', !!document.querySelector('#mais-widget iframe'));
```

### Events Not Firing

```javascript
// Ensure event listeners are added after SDK loads
window.addEventListener('load', function () {
  if (window.MAISWidget) {
    window.MAISWidget.on('ready', function () {
      console.log('Widget ready!');
    });
  } else {
    console.error('MAISWidget not loaded');
  }
});
```
