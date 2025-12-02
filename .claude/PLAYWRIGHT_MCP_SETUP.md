# Playwright MCP Server Setup

## Overview

This document describes the Playwright MCP (Model Context Protocol) server configuration for the MAIS project. The Playwright MCP server provides browser automation capabilities directly within Claude Code, allowing for automated testing, web scraping, screenshot generation, and browser-based interactions.

## What Was Configured

### 1. MCP Server Registration (.mcp.json)

Added the Playwright MCP server to the project's MCP server configuration:

```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```

This configuration:

- Uses the official `@playwright/mcp` package from Microsoft
- Runs via `npx` for automatic package management
- Always fetches the latest version with the `-y` flag for automatic confirmation

### 2. Server Enablement (.claude/settings.local.json)

Enabled the Playwright server in the local Claude settings:

- Added "playwright" to the `enabledMcpjsonServers` array

### 3. Permissions Configuration (.claude/settings.local.json)

Granted the following Playwright MCP permissions:

**Navigation & Page Loading:**

- `mcp__playwright__navigate` - Navigate to URLs
- `mcp__playwright__goto` - Go to specific pages
- `mcp__playwright__wait_for_load_state` - Wait for page load states (load, domcontentloaded, networkidle)

**Element Interaction:**

- `mcp__playwright__click` - Click on elements
- `mcp__playwright__fill` - Fill form fields
- `mcp__playwright__select_option` - Select from dropdowns
- `mcp__playwright__press` - Press keyboard keys
- `mcp__playwright__type` - Type text into elements

**Element Inspection:**

- `mcp__playwright__inner_text` - Get element text content
- `mcp__playwright__get_attribute` - Get element attributes
- `mcp__playwright__get_content` - Get page HTML content
- `mcp__playwright__wait_for_selector` - Wait for elements to appear

**Advanced Features:**

- `mcp__playwright__screenshot` - Take page screenshots
- `mcp__playwright__pdf` - Generate PDF from pages
- `mcp__playwright__evaluate` - Execute JavaScript in the page context

## How to Use

### Basic Navigation

```
Navigate to https://example.com and take a screenshot
```

### Form Interaction

```
1. Navigate to the login page
2. Fill in the username field with "testuser"
3. Fill in the password field
4. Click the submit button
5. Wait for the dashboard to load
```

### Testing Workflows

```
Test the user registration flow:
1. Navigate to /register
2. Fill out the registration form
3. Submit the form
4. Verify the success message appears
5. Take a screenshot of the result
```

### Data Extraction

```
Navigate to the product listing page and extract:
- All product titles
- Prices
- Availability status
```

### PDF Generation

```
Navigate to the documentation page and generate a PDF
```

## Example Commands

### Take a Screenshot

```
Go to https://www.elopetomaconga.com and take a screenshot of the homepage
```

### Test Form Validation

```
Test the contact form validation:
1. Navigate to /contact
2. Click submit without filling fields
3. Verify error messages appear
4. Screenshot the validation errors
```

### Check Element Presence

```
Navigate to the dashboard and verify:
1. The welcome message is displayed
2. The navigation menu is present
3. The user avatar appears in the top-right
```

### Execute JavaScript

```
Navigate to the app and evaluate: document.title
```

## Troubleshooting Tips

### MCP Server Not Starting

If the Playwright MCP server doesn't start:

1. **Check Node.js version**: Ensure you have Node.js 18+ installed

   ```bash
   node --version
   ```

2. **Clear npx cache**: Sometimes cached packages cause issues

   ```bash
   npx clear-npx-cache
   ```

3. **Verify package availability**:
   ```bash
   npx -y @playwright/mcp@latest --help
   ```

### Permission Errors

If you encounter permission errors:

1. Verify all required permissions are in `.claude/settings.local.json`
2. Restart Claude Code to reload the configuration
3. Check that the permission names match exactly (they're case-sensitive)

### Browser Launch Failures

If Playwright can't launch browsers:

1. **Install Playwright browsers** (if not already installed):

   ```bash
   npx playwright install
   ```

2. **Check system dependencies** (Linux only):

   ```bash
   npx playwright install-deps
   ```

3. **Use headless mode**: The MCP server typically runs in headless mode by default

### Timeout Issues

If operations timeout:

1. Increase wait times for slow-loading pages
2. Use `wait_for_load_state` with appropriate states:
   - `load` - full page load (default)
   - `domcontentloaded` - DOM ready
   - `networkidle` - no network activity

### Screenshot or PDF Not Generated

1. Ensure the page has fully loaded before taking screenshots
2. Check that the target directory has write permissions
3. Verify the page doesn't have content that blocks rendering

### Element Not Found

If selectors fail to find elements:

1. **Wait for elements**: Use `wait_for_selector` before interacting
2. **Verify selectors**: Use browser DevTools to test CSS/XPath selectors
3. **Check for dynamic content**: Some elements load after initial page load

## Configuration Files

### /Users/mikeyoung/CODING/Elope/.mcp.json

Contains the MCP server definitions, including the Playwright server configuration.

### /Users/mikeyoung/CODING/Elope/.claude/settings.local.json

Contains:

- Enabled MCP servers list
- Permission grants for MCP tools
- Local Claude Code settings

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright MCP Package](https://github.com/microsoft/playwright-mcp)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)

## Notes

- The Playwright MCP server runs in a sandboxed environment
- Browser sessions are ephemeral and don't persist between commands
- Screenshots and PDFs are typically saved to temporary locations unless specified
- The server uses Chromium by default but can support Firefox and WebKit

## Next Steps

1. **Restart Claude Code** to load the new MCP server configuration
2. **Test basic functionality** with a simple navigation and screenshot command
3. **Integrate into workflows** for automated testing of the MAIS application
4. **Create test scripts** for common user flows (registration, login, booking, etc.)
5. **Monitor performance** and adjust timeouts as needed for your specific use cases
