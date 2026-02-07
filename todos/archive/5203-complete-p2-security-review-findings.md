# P2: Security Review Findings

**Source:** Dashboard Rebuild Review (PR #39, 2026-02-07)

## Findings

1. **CSS selector injection via `data-section-id`**: User-controlled section IDs used in `querySelector` without sanitization. Could inject CSS selectors. Sanitize with allowlist of known section types.

2. **Preview JWT in URL query string**: JWT token passed as `?token=` in iframe src. Tokens appear in browser history, server logs, Referer headers. Use PostMessage to pass token after iframe loads.

3. **RevealTransition iframe missing `sandbox`**: Iframe in reveal animation has no `sandbox` attribute. Add `sandbox="allow-scripts allow-same-origin"`.

4. **Agent tool results not schema-validated**: `handleConciergeToolComplete` extracts `dashboardAction` from tool results without Zod validation. Could be malformed. Add `safeParse` on extraction.

## Fix

- Validate `data-section-id` against `CANONICAL_SECTION_TYPES`
- Switch iframe auth to PostMessage-based token delivery
- Add sandbox attr to RevealTransition iframe
- Add Zod schema for DashboardAction at extraction point
