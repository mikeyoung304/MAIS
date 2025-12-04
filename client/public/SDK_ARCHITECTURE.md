# MAIS Widget SDK - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Customer Website                          │
│  (example.com)                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  <script src="https://widget.mais.com/sdk/mais-sdk.min.js"      │
│          data-tenant="bellaweddings"                             │
│          data-api-key="pk_live_...">                             │
│  </script>                                                       │
│                                                                   │
│  <div id="mais-widget">                                          │
│    ┌─────────────────────────────────────────────┐              │
│    │           MAIS Widget (iframe)              │              │
│    │  https://widget.mais.com?tenant=...         │              │
│    │                                             │              │
│    │  ┌───────────────────────────────────┐     │              │
│    │  │   Package Selection               │     │              │
│    │  ├───────────────────────────────────┤     │              │
│    │  │   Customer Information Form       │     │              │
│    │  ├───────────────────────────────────┤     │              │
│    │  │   Payment (Stripe/Square)         │     │              │
│    │  └───────────────────────────────────┘     │              │
│    │                                             │              │
│    └─────────────────────────────────────────────┘              │
│  </div>                                                          │
│                                                                   │
│  window.MAISWidget.on('bookingCompleted', ...)                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         MAIS SDK (mais-sdk.js)                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Configuration  │  │ Iframe Manager  │  │ Event Emitter   │  │
│  │                │  │                 │  │                 │  │
│  │ • Tenant       │  │ • Create iframe │  │ • on()          │  │
│  │ • API Key      │  │ • Build URL     │  │ • emit()        │  │
│  │ • Container    │  │ • Style iframe  │  │ • Handlers{}    │  │
│  │ • Mode         │  │ • Append to DOM │  │                 │  │
│  └────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                   │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Message        │  │ Security        │  │ Public API      │  │
│  │ Handler        │  │                 │  │                 │  │
│  │                │  │ • Origin check  │  │ • openBooking() │  │
│  │ • READY        │  │ • API key valid │  │ • close()       │  │
│  │ • RESIZE       │  │ • Source valid  │  │ • destroy()     │  │
│  │ • BOOKING_*    │  │ • CSP compliant │  │                 │  │
│  │ • ERROR        │  │                 │  │                 │  │
│  └────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Message Flow

### Initialization Flow

```
Customer Website                SDK                 Widget (iframe)
      │                         │                         │
      │  1. Load SDK script     │                         │
      ├────────────────────────>│                         │
      │                         │                         │
      │  2. Extract config      │                         │
      │     from data-* attrs   │                         │
      │                         │                         │
      │  3. Validate API key    │                         │
      │                         │                         │
      │  4. Create iframe       │                         │
      │     + event listener    │                         │
      │                         │                         │
      │  5. Append iframe       │                         │
      │                         │  6. Load widget app     │
      │                         ├────────────────────────>│
      │                         │                         │
      │                         │  7. READY message       │
      │                         │<────────────────────────│
      │                         │                         │
      │  8. Emit 'ready' event  │                         │
      │<────────────────────────│                         │
      │                         │                         │
```

### Resize Flow

```
Customer Website                SDK                 Widget (iframe)
      │                         │                         │
      │                         │  Content height changes │
      │                         │                         │
      │                         │  RESIZE message         │
      │                         │  { height: 850 }        │
      │                         │<────────────────────────│
      │                         │                         │
      │  Set iframe.style.height│                         │
      │  = "850px"              │                         │
      │                         │                         │
```

### Booking Flow

```
Customer Website                SDK                 Widget (iframe)
      │                         │                         │
      │                         │  User submits booking   │
      │                         │                         │
      │                         │  BOOKING_CREATED        │
      │                         │  { bookingId, ... }     │
      │                         │<────────────────────────│
      │                         │                         │
      │  Emit 'bookingCreated'  │                         │
      │<────────────────────────│                         │
      │                         │                         │
      │  Analytics tracking     │                         │
      │  gtag('event', ...)     │                         │
      │                         │                         │
      │                         │  User completes payment │
      │                         │                         │
      │                         │  BOOKING_COMPLETED      │
      │                         │  { bookingId, status }  │
      │                         │<────────────────────────│
      │                         │                         │
      │  Emit 'bookingCompleted'│                         │
      │<────────────────────────│                         │
      │                         │                         │
      │  Redirect to thank you  │                         │
      │  page (optional)        │                         │
      │                         │                         │
```

### Error Flow

```
Customer Website                SDK                 Widget (iframe)
      │                         │                         │
      │                         │  Payment fails          │
      │                         │                         │
      │                         │  ERROR message          │
      │                         │  { error, details }     │
      │                         │<────────────────────────│
      │                         │                         │
      │  Emit 'error' event     │                         │
      │<────────────────────────│                         │
      │                         │                         │
      │  console.error(...)     │                         │
      │  Display error message  │                         │
      │                         │                         │
```

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                        Security Layers                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Layer 1: API Key Validation                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  • Format: pk_live_[tenant]_[16-hex-chars]                 │ │
│  │  • Validated before iframe creation                        │ │
│  │  • Error logged if invalid                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Layer 2: Origin Validation (postMessage)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Parent → Widget: Must be from allowed origins             │ │
│  │  Widget → Parent: Must be from widget.mais.com             │ │
│  │  Invalid origins: Silently ignored                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Layer 3: Message Source Validation                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  • All messages must include 'source' field                │ │
│  │  • Parent: source = 'mais-parent'                          │ │
│  │  • Widget: source = 'mais-widget'                          │ │
│  │  • Invalid source: Silently ignored                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Layer 4: Content Security Policy                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  • No inline scripts                                       │ │
│  │  • No eval() or Function() constructor                     │ │
│  │  • frame-src directive required                            │ │
│  │  • script-src directive required                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Layer 5: Same-Origin Policy (iframe isolation)                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  • Widget runs in separate origin                          │ │
│  │  • Cannot access parent DOM                                │ │
│  │  • Cannot access parent cookies                            │ │
│  │  • Communication only via postMessage                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Parent    │         │     SDK     │         │   Widget    │
│   Website   │         │   (iframe)  │         │  Application│
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      │ Configuration         │                       │
      │ (data-* attrs)        │                       │
      ├──────────────────────>│                       │
      │                       │                       │
      │                       │ URL Parameters        │
      │                       │ ?tenant=...&apiKey=...│
      │                       ├──────────────────────>│
      │                       │                       │
      │                       │                       │ Validate
      │                       │                       │ API key
      │                       │                       │ with API
      │                       │                       │
      │                       │ READY                 │
      │                       │<──────────────────────│
      │                       │                       │
      │ ready event           │                       │
      │<──────────────────────│                       │
      │                       │                       │
      │                       │                       │ User
      │                       │                       │ interacts
      │                       │                       │
      │                       │ RESIZE (height: 850)  │
      │                       │<──────────────────────│
      │                       │                       │
      │ Resize iframe         │                       │
      │                       │                       │
      │                       │                       │ User
      │                       │                       │ submits
      │                       │                       │ booking
      │                       │                       │
      │                       │                       │ POST to
      │                       │                       │ API
      │                       │                       │
      │                       │ BOOKING_CREATED       │
      │                       │<──────────────────────│
      │                       │                       │
      │ bookingCreated event  │                       │
      │<──────────────────────│                       │
      │                       │                       │
      │ Track analytics       │                       │
      │                       │                       │
```

---

## File Structure

```
client/public/
├── mais-sdk.js              # Development SDK (6.6KB, 2.2KB gzipped)
│   ├── Configuration parser
│   ├── API key validator
│   ├── Iframe manager
│   ├── Message handler
│   ├── Event emitter
│   └── Public API
│
├── mais-sdk.min.js          # Production SDK (3.4KB, 1.4KB gzipped)
│   └── (Same as above, minified)
│
├── example.html             # Integration example
│   ├── HTML structure
│   ├── Event listeners
│   ├── Analytics tracking
│   └── UI controls
│
├── test-sdk.html            # Automated test suite
│   ├── Script loading test
│   ├── Configuration test
│   ├── API key validation test
│   ├── Widget instance test
│   ├── Methods test
│   ├── Event system test
│   ├── Iframe creation test
│   └── URL formatting test
│
├── SDK_README.md            # Full documentation
│   ├── Usage instructions
│   ├── API reference
│   ├── Security features
│   ├── Browser compatibility
│   ├── Troubleshooting
│   └── Advanced examples
│
├── QUICK_START.md           # Quick start guide
│   └── 30-second integration
│
└── SDK_ARCHITECTURE.md      # This file
    ├── System overview
    ├── Component architecture
    ├── Message flows
    ├── Security model
    └── Data flow
```

---

## Environment Detection

```javascript
// SDK auto-detects environment from script src
const widgetBaseUrl =
  currentScript.src.indexOf('localhost') !== -1
    ? 'http://localhost:5173' // Development
    : 'https://widget.mais.com'; // Production
```

**Development Mode:**

- SDK loaded from localhost
- Widget iframe: `http://localhost:5173`
- Hot module reload
- Unminified code
- Console logging

**Production Mode:**

- SDK loaded from CDN
- Widget iframe: `https://widget.mais.com`
- Minified code
- Error tracking
- Performance monitoring

---

## Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      Build & Deploy Process                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Development                                                   │
│     └── mais-sdk.js (source)                                     │
│                                                                   │
│  2. Minification                                                  │
│     └── mais-sdk.min.js (terser/uglify)                          │
│                                                                   │
│  3. Versioning                                                    │
│     ├── mais-sdk.min.js (latest)                                 │
│     └── mais-sdk-v1.0.0.min.js (pinned)                          │
│                                                                   │
│  4. CDN Upload                                                    │
│     └── https://widget.mais.com/sdk/                             │
│         ├── mais-sdk.min.js                                      │
│         └── mais-sdk-v1.0.0.min.js                               │
│                                                                   │
│  5. Cache Headers                                                 │
│     ├── Cache-Control: public, max-age=31536000                  │
│     └── Content-Type: application/javascript                     │
│                                                                   │
│  6. Compression                                                   │
│     ├── Gzip: 1.4KB                                              │
│     └── Brotli: ~1.2KB (optional)                                │
│                                                                   │
│  7. Monitoring                                                    │
│     ├── Error tracking (Sentry)                                  │
│     ├── Performance (RUM)                                        │
│     └── Usage analytics                                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Checklist

- [ ] Copy SDK to your website or use CDN URL
- [ ] Add `<script>` tag with data-tenant and data-api-key
- [ ] Add `<div id="mais-widget"></div>` container
- [ ] (Optional) Add event listeners for tracking
- [ ] (Optional) Add CSP directives if using strict CSP
- [ ] Test in all target browsers
- [ ] Verify analytics tracking
- [ ] Deploy to production

---

## Performance Metrics

**Load Performance:**

- Script parse time: < 5ms
- Initialization time: < 10ms
- Time to interactive: < 50ms

**Runtime Performance:**

- Message handling: < 1ms
- Resize handling: < 5ms
- Memory footprint: < 100KB

**Network Performance:**

- SDK download: 1.4KB (gzipped)
- First paint: Immediate (iframe loads async)
- LCP impact: Minimal (non-blocking)

---

## Maintenance Notes

**Version Updates:**

1. Update version in SDK header comment
2. Update CHANGELOG.md
3. Create new versioned file (mais-sdk-v1.1.0.min.js)
4. Update latest (mais-sdk.min.js)
5. Test all examples still work
6. Update documentation if API changes

**Breaking Changes:**

- Always maintain backwards compatibility
- Deprecate old features (don't remove)
- Provide migration guide
- Support old versions for 12 months

---

## Future Enhancements

**Phase 3 Potential Features:**

- [ ] Modal mode support
- [ ] Multiple widgets per page
- [ ] Widget preloading for faster display
- [ ] Lazy loading for below-fold widgets
- [ ] A/B testing API
- [ ] Custom styling API
- [ ] Offline mode / service worker
- [ ] React/Vue/Angular wrapper components
