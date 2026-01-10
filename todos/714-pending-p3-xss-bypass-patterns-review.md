---
status: pending
priority: p3
issue_id: '714'
tags: [code-review, security, xss]
dependencies: []
---

# XSS Sanitization Bypass Patterns Need Review

## Problem Statement

Security testing revealed several encoding patterns that bypass the current XSS sanitization in `parseQuickReplies.ts`. While the current sanitization catches common patterns, sophisticated attackers could exploit these gaps.

## Bypass Patterns Found

The following inputs PASS sanitization but could be malicious:

| Pattern          | Example                                  | Risk                            |
| ---------------- | ---------------------------------------- | ------------------------------- |
| HTML entities    | `&#60;script&#62;`                       | Browser decodes after sanitizer |
| Spaced keywords  | `java script:alert(1)`                   | Some browsers ignore spaces     |
| Null byte        | `java\0script:`                          | Null byte stripped by browser   |
| Tab/newline      | `java\tscript:`                          | Whitespace normalized           |
| URL encoding     | `%3Cscript%3E`                           | Double-encoding attacks         |
| CSS expression   | `expression(alert(1))`                   | Legacy IE, some parsers         |
| Angular template | `{{constructor.constructor("alert")()}}` | If using Angular                |

## Current Mitigation

The quick replies are rendered in contexts where these patterns are largely neutralized:

- React's JSX escaping prevents most execution
- No `dangerouslySetInnerHTML` used
- CSP headers block inline scripts

## Recommended Action

**Low priority** - Current defenses are defense-in-depth. However, consider:

1. Add HTML entity decoding before pattern check
2. Normalize whitespace before pattern matching
3. URL decode before checking

```typescript
function normalizeForCheck(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/[\s\0\t\n\r]/g, '')
    .toLowerCase();
}
```

## Acceptance Criteria

- [ ] Review current CSP headers effectiveness
- [ ] Consider adding input normalization
- [ ] Document accepted risk if not fixing

## Resources

- Security Sentinel review: agent ae05de2
- OWASP XSS Prevention Cheat Sheet
- Related: `apps/web/src/lib/parseQuickReplies.ts`
