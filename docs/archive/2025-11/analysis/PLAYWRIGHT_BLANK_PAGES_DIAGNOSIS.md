# Playwright Multiple `about:blank` Pages - Root Cause & Solution

**Issue:** When using Playwright (especially MCP), opening one browser window creates dozens of blank pages with `about:blank` URLs.

**Date Diagnosed:** November 19, 2025
**Severity:** High - Causes resource waste and confusion
**Status:** Root cause identified, solution documented

---

## 🔍 Root Cause Analysis

### The Problem in Detail

When Playwright MCP or custom scripts open a browser, you see:

```
1. Browser launches
2. Window 1: about:blank (unexpected)
3. Window 2: about:blank (unexpected)
4. Window 3: about:blank (unexpected)
... (dozens more)
5. Finally: Your actual URL
```

### Why This Happens

**Primary Cause: Fixture Dependency Conflicts**

Playwright's built-in fixtures (`page`, `context`, `browser`) have a dependency chain:

```
page → context → browser
```

When you mix built-in fixtures with custom browser/context creation, you create **parallel fixture trees**:

```
❌ WRONG: Multiple contexts created
Test uses: browser + page
└─ page fixture auto-creates:
   └─ context (hidden)
      └─ browser (hidden)
         └─ blank page #1
└─ Your custom code creates:
   └─ context (explicit)
      └─ page (explicit)
         └─ blank page #2
```

**Result:** Multiple blank pages, one from each fixture chain.

### Secondary Causes

1. **MCP Server State Leakage**
   - MCP server reuses browser instances across requests
   - Doesn't properly close contexts between operations
   - Accumulates `about:blank` pages over time

2. **Browser Launch Options**
   - `--restore-last-session` flag creates blank pages on each launch
   - Persistent context mode opens extra blank page by design

3. **Event Handler Accumulation**
   - Multiple `page.on('popup')` listeners not removed
   - Each listener creates a new blank page reference

4. **Page Object Pattern Misuse**
   - Initializing page objects in `beforeEach` hooks
   - Separate page instances created for page object vs. test

---

## ✅ Solutions

### Solution 1: Avoid Fixture Mixing (Recommended)

**Don't do this:**

```typescript
// ❌ BAD: Uses both 'page' fixture and creates custom context
test('my test', async ({ browser, page }) => {
  const context = await browser.newContext(); // Creates context #2
  const customPage = await context.newPage(); // Creates page #2
  // 'page' fixture already created context #1 and page #1
});
```

**Do this instead:**

```typescript
// ✅ GOOD: Only use browser fixture, create everything yourself
test('my test', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Only one context, only one page
});
```

**Or this:**

```typescript
// ✅ GOOD: Use page fixture directly, don't create custom
test('my test', async ({ page }) => {
  // Use the provided page, don't create another
  await page.goto('https://example.com');
});
```

### Solution 2: MCP Server Pattern

**Problem pattern in MCP:**

```typescript
// ❌ BAD: Creates new context every request without cleanup
export async function handleBrowserNavigate(url: string) {
  const browser = await chromium.launch(); // Reused across requests
  const context = await browser.newContext(); // New context each time
  const page = await context.newPage(); // New page each time
  // Contexts never closed → accumulates blank pages
}
```

**Fixed pattern:**

```typescript
// ✅ GOOD: Proper lifecycle management
class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async navigate(url: string): Promise<Page> {
    // Close existing context if present
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }

    // Launch browser once
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false,
      });
    }

    // Create fresh context for this session
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    await this.page.goto(url);

    return this.page;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    this.context = null;
    this.page = null;
    this.browser = null;
  }
}
```

### Solution 3: Configuration-Based Fix

**playwright.config.ts optimization:**

```typescript
export default defineConfig({
  use: {
    // Move all page-level config to global level
    ignoreHTTPSErrors: true, // Don't pass to newPage()
    viewport: { width: 1280, height: 720 },

    // Prevent automatic blank page
    launchOptions: {
      // Remove --restore-last-session
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        // DON'T include --restore-last-session
      ],
    },
  },

  // Use only one project to avoid context multiplication
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

### Solution 4: Page Object Pattern Fix

**Don't do this:**

```typescript
// ❌ BAD: beforeEach creates page separate from test context
let homePage: HomePage;

test.beforeEach(async ({ page }) => {
  homePage = new HomePage(page); // Uses fixture page
});

test('my test', async ({ browser }) => {
  const context = await browser.newContext(); // New context
  const customPage = await context.newPage(); // Blank page created
  // Now you have 2 pages: one from fixture, one from test
});
```

**Do this instead:**

```typescript
// ✅ GOOD: Use same page throughout
test('my test', async ({ page }) => {
  const homePage = new HomePage(page); // Same page instance
  await homePage.navigate();
});
```

**Or this:**

```typescript
// ✅ GOOD: Create page object from custom context
test('my test', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const homePage = new HomePage(page); // From your context
});
```

---

## 🧪 Diagnostic Script

Use this script to test if you have the issue:

```typescript
// test-blank-pages.ts
import { chromium } from 'playwright';

async function testBlankPages() {
  console.log('Test 1: Proper pattern (should create 1 page)');
  const browser1 = await chromium.launch({ headless: false });
  const context1 = await browser1.newContext();
  const page1 = await context1.newPage();

  const pages1 = context1.pages();
  console.log(`Pages created: ${pages1.length}`); // Should be 1
  console.log(`URLs: ${pages1.map((p) => p.url()).join(', ')}`);

  await context1.close();
  await browser1.close();

  console.log('\n---\n');

  console.log('Test 2: Problematic pattern (may create multiple)');
  const browser2 = await chromium.launch({ headless: false });

  // Creating multiple contexts without cleanup
  const context2a = await browser2.newContext();
  const page2a = await context2a.newPage();

  const context2b = await browser2.newContext();
  const page2b = await context2b.newPage();

  // Check how many pages browser has across all contexts
  console.log(`Context A pages: ${context2a.pages().length}`);
  console.log(`Context B pages: ${context2b.pages().length}`);

  await browser2.close();
}

testBlankPages().catch(console.error);
```

**Run:**

```bash
npx tsx test-blank-pages.ts
```

---

## 🎯 Specific Fixes for Common Scenarios

### Scenario 1: MCP Playwright Server

**Location:** MCP server implementation (likely in `node_modules/@playwright/mcp` or custom wrapper)

**Fix:** Implement singleton pattern with proper cleanup:

```typescript
// Singleton browser manager for MCP
class MCPBrowserSingleton {
  private static instance: MCPBrowserSingleton;
  private browser: Browser | null = null;
  private activeContexts: Map<string, BrowserContext> = new Map();
  private maxContexts = 1; // MCP should typically use 1 context at a time

  static getInstance(): MCPBrowserSingleton {
    if (!MCPBrowserSingleton.instance) {
      MCPBrowserSingleton.instance = new MCPBrowserSingleton();
    }
    return MCPBrowserSingleton.instance;
  }

  async getPage(sessionId: string = 'default'): Promise<Page> {
    // Close old context if exists
    if (this.activeContexts.has(sessionId)) {
      const oldContext = this.activeContexts.get(sessionId)!;
      await oldContext.close();
      this.activeContexts.delete(sessionId);
    }

    // Ensure browser is launched
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false,
        args: ['--disable-dev-shm-usage'],
      });
    }

    // Create fresh context
    const context = await this.browser.newContext();
    this.activeContexts.set(sessionId, context);

    // Return the first (and only) page
    return context.newPage();
  }

  async cleanup(): Promise<void> {
    // Close all contexts
    for (const context of this.activeContexts.values()) {
      await context.close();
    }
    this.activeContexts.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

### Scenario 2: E2E Test Suite

**Fix in playwright.config.ts:**

```typescript
export default defineConfig({
  // Don't use built-in page fixture if you create custom contexts
  use: {
    // Remove any page-specific settings that trigger automatic page creation
  },

  // Use test-level context creation
  testMatch: /.*\.spec\.ts$/,
});
```

**Fix in tests:**

```typescript
// e2e/tests/example.spec.ts

// ❌ DON'T mix fixtures
test('bad example', async ({ browser, page }) => {
  // ...
});

// ✅ DO use only what you need
test('good example 1', async ({ page }) => {
  // Use provided page
  await page.goto('http://localhost:5173');
});

test('good example 2', async ({ browser }) => {
  // Create your own context/page
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:5173');
  await context.close();
});
```

### Scenario 3: Our capture-landing.js Script

**Current script** (may have issues):

```javascript
// capture-landing.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch(); // ✅ OK
  const page = await browser.newPage(); // ⚠️  Implicit context created

  // Multiple calls without cleanup
  await page.goto('http://localhost:5173');
  await page.screenshot({ path: 'landing-page.png' });

  await browser.close();
})();
```

**Fixed script:**

```javascript
// capture-landing.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Explicitly create context (best practice)
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  // Create single page
  const page = await context.newPage();

  // Use the page
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'landing-page.png', fullPage: true });

  // Proper cleanup
  await context.close();
  await browser.close();
})();
```

---

## 📊 Verification Checklist

After applying fixes, verify:

- [ ] **Single page created:** Browser inspector shows only 1 tab/page
- [ ] **No about:blank URLs:** No pages stuck at about:blank
- [ ] **Memory stable:** Browser memory doesn't grow over time
- [ ] **Fast navigation:** Page transitions happen immediately
- [ ] **Clean close:** Browser closes completely without hanging

**How to check:**

```typescript
// Add to your test/script
const allPages = context.pages();
console.log(`Total pages: ${allPages.length}`); // Should be 1
console.log(`Page URLs: ${allPages.map((p) => p.url()).join(', ')}`);
```

---

## 🚀 Recommended Implementation

For the MAIS project specifically:

### 1. Update capture-landing.js

Replace current script with:

```javascript
const { chromium } = require('playwright');

async function captureLandingPage() {
  let browser, context;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Verify single page
    console.log(`Pages created: ${context.pages().length}`);

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'landing-page-full.png',
      fullPage: true,
    });

    await page.screenshot({
      path: 'landing-page-viewport.png',
    });

    console.log('Screenshots saved successfully');
    console.log(`Final page count: ${context.pages().length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

captureLandingPage();
```

### 2. Update E2E Tests

Audit all tests in `e2e/tests/` for fixture mixing:

```bash
# Find tests using both browser and page fixtures
grep -r "async ({ browser, page })" e2e/tests/
```

### 3. If Using Custom MCP Server

Implement the `MCPBrowserSingleton` pattern above.

---

## 📚 Additional Resources

- [Playwright Issue #13714 - Extra Blank Window](https://github.com/microsoft/playwright/issues/13714)
- [Playwright Issue #24134 - Blank Pages with Context Reuse](https://github.com/microsoft/playwright/issues/24134)
- [Playwright Docs - Browser Contexts](https://playwright.dev/docs/browser-contexts)
- [Playwright Docs - Pages](https://playwright.dev/docs/pages)

---

## 🎓 Key Takeaways

1. **Never mix built-in fixtures with custom browser/context creation**
2. **Always close contexts explicitly before creating new ones**
3. **Use only what you need:** Either `page` OR `browser`, not both
4. **MCP servers need singleton pattern with proper lifecycle management**
5. **Configuration belongs in playwright.config.ts, not in newPage() calls**

---

**Status:** ✅ Diagnosis complete, solutions documented
**Next Steps:** Apply fixes to capture-landing.js and audit E2E tests
**Estimated Fix Time:** 30 minutes
