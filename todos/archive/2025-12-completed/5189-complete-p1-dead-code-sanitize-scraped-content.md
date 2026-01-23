---
status: complete
priority: p1
issue_id: '5189'
tags: [code-review, agent-v2, dead-code, security]
dependencies: []
completed_at: '2026-01-23'
---

# Dead Code: sanitizeScrapedContent Function Never Called

## Problem Statement

The Research agent defines a `sanitizeScrapedContent` function for cleaning HTML artifacts and truncating scraped content, but it is never called anywhere in the codebase. The `scrape_competitor` tool filters for prompt injection but never sanitizes the content, leaving raw HTML artifacts and potentially very long content in tool responses.

**Why it matters:**

1. Dead code indicates incomplete implementation or abandoned refactoring
2. The security intent (sanitizing untrusted web content) is not being fulfilled
3. Unsanitized content may contain HTML entities, excessive whitespace, or be too long for LLM context
4. P1 because it's a security-related function that's supposed to protect against malicious scraped content

## Findings

**Source:** Agent-v2 code review

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/research/src/agent.ts`

**Dead function (lines 118-136):**

```typescript
/**
 * Clean and truncate scraped content
 */
function sanitizeScrapedContent(content: string, maxLength: number = 5000): string {
  // Remove excessive whitespace
  let cleaned = content.replace(/\s+/g, ' ').trim();

  // Remove common HTML artifacts
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');

  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + '... [truncated]';
  }

  return cleaned;
}
```

**Where it should be called (lines 329-364):**

```typescript
const scrapeCompetitorTool = new FunctionTool({
  name: 'scrape_competitor',
  description: `Scrape a competitor website for pricing and service information...`,
  parameters: ScrapeCompetitorParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    console.log(`[ResearchAgent] scrape_competitor called for: ${params.url}`);

    // Call backend to do the actual scraping
    const result = await callMaisApi('/research/scrape-competitor', tenantId, params);

    if (!result.ok) {
      return { error: result.error };
    }

    // The backend should return already-filtered content, but we double-check here
    const data = result.data as Record<string, unknown>;
    if (data.rawContent && typeof data.rawContent === 'string') {
      const filtered = filterPromptInjection(data.rawContent);
      if (!filtered.safe) {
        console.warn(
          `[ResearchAgent] Prompt injection detected in scraped content from ${params.url}`
        );
        data.rawContent = filtered.filtered;
        data.contentFiltered = true;
      }
      // MISSING: sanitizeScrapedContent should be called here!
    }

    return data;
  },
});
```

**Current flow:**

1. Backend scrapes website, returns `rawContent`
2. `filterPromptInjection` checks for injection patterns
3. Raw HTML content (with entities, excessive whitespace, unlimited length) passed to agent

**Expected flow:**

1. Backend scrapes website, returns `rawContent`
2. `filterPromptInjection` checks for injection patterns
3. **`sanitizeScrapedContent` cleans and truncates content**
4. Clean, bounded content passed to agent

## Proposed Solutions

### Solution 1: Wire Up the Function (Recommended)

**Approach:** Call `sanitizeScrapedContent` after prompt injection filtering

```typescript
execute: async (params, context) => {
  const tenantId = getTenantId(context);
  if (!tenantId) {
    return { error: 'No tenant context available' };
  }

  const result = await callMaisApi('/research/scrape-competitor', tenantId, params);

  if (!result.ok) {
    return { error: result.error };
  }

  const data = result.data as Record<string, unknown>;
  if (data.rawContent && typeof data.rawContent === 'string') {
    // Step 1: Check for prompt injection
    const filtered = filterPromptInjection(data.rawContent);
    if (!filtered.safe) {
      console.warn(`[ResearchAgent] Prompt injection detected from ${params.url}`);
      data.contentFiltered = true;
    }

    // Step 2: Sanitize and truncate (the missing step!)
    data.rawContent = sanitizeScrapedContent(filtered.filtered);
    data.contentLength = data.rawContent.length;
  }

  return data;
};
```

**Pros:**

- Simple fix (add one function call)
- Uses existing, tested code
- Completes the intended security design

**Cons:**

- None significant

**Effort:** 10 minutes

### Solution 2: Delete the Dead Code

**Approach:** If sanitization should happen only on the backend, remove the dead function

```typescript
// Delete lines 118-136 (sanitizeScrapedContent function)
// Add comment explaining backend handles sanitization
```

**Pros:**

- Removes dead code
- Clarifies that backend is responsible for sanitization

**Cons:**

- Loses defense-in-depth
- Backend may not be sanitizing properly
- Still need to verify backend implementation

**Effort:** 5 minutes (but requires backend verification)

### Solution 3: Comprehensive Content Processing Pipeline

**Approach:** Create a proper pipeline for processing scraped content

```typescript
interface ProcessedContent {
  sanitized: string;
  originalLength: number;
  truncated: boolean;
  injectionDetected: boolean;
  htmlRemoved: boolean;
}

function processScrapedContent(raw: string, maxLength: number = 5000): ProcessedContent {
  const originalLength = raw.length;

  // Step 1: Remove HTML tags
  let content = raw.replace(/<[^>]*>/g, '');
  const htmlRemoved = content.length < raw.length;

  // Step 2: Decode HTML entities
  content = content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, (match) => String.fromCharCode(parseInt(match.slice(2, -1))));

  // Step 3: Normalize whitespace
  content = content.replace(/\s+/g, ' ').trim();

  // Step 4: Check for prompt injection
  const injectionResult = filterPromptInjection(content);
  content = injectionResult.filtered;

  // Step 5: Truncate
  const truncated = content.length > maxLength;
  if (truncated) {
    content = content.substring(0, maxLength) + '... [truncated]';
  }

  return {
    sanitized: content,
    originalLength,
    truncated,
    injectionDetected: !injectionResult.safe,
    htmlRemoved,
  };
}
```

**Pros:**

- Comprehensive processing
- Clear metadata about what was done
- Reusable for other scraped content

**Cons:**

- More complex than just wiring up existing function
- May be over-engineering for current needs

**Effort:** 30 minutes

## Recommended Action

**Implement Solution 1** - simply call the existing `sanitizeScrapedContent` function after prompt injection filtering. This is a one-line fix that completes the intended implementation.

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/research/src/agent.ts`
  - Line 356 (add function call after filterPromptInjection)

**Related Components:**

- Backend `/research/scrape-competitor` endpoint
- `filterPromptInjection` function (already called)
- Research agent system prompt (mentions sanitization)

**Database Schema:** No changes required

## Acceptance Criteria

- [ ] `sanitizeScrapedContent` is called on all scraped content
- [ ] Test: Scrape page with HTML tags - tags are removed
- [ ] Test: Scrape page with `&nbsp;` entities - entities are decoded
- [ ] Test: Scrape page with 10KB content - truncated to 5KB
- [ ] Test: Content with prompt injection AND HTML - both handled
- [ ] Add unit test specifically for `sanitizeScrapedContent`
- [ ] Response includes metadata about truncation/filtering

## Work Log

| Date       | Action                          | Learnings                                        |
| ---------- | ------------------------------- | ------------------------------------------------ |
| 2026-01-19 | Issue identified in code review | Dead code found - sanitize function never called |

## Resources

- **ESLint Rule:** `no-unused-vars` would catch this with proper configuration
- **Related Pattern:** ESLINT_PREVENTION_INDEX.md - dead code detection
- **Security Context:** Defense in depth for untrusted web content
- **Related Issue:** Prompt injection filtering already implemented (lines 96-113)
