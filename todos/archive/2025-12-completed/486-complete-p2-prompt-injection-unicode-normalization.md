# P2: Prompt Injection Detection Missing Unicode Normalization

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P2 - Important Security Issue**

## Description

The prompt injection patterns in customer orchestrator are basic regex patterns that can be bypassed using Unicode lookalike characters, encoding tricks, or zero-width characters. The `detectPromptInjection()` method doesn't normalize input before pattern matching.

## Location

- `server/src/agent/customer/customer-orchestrator.ts` (lines 55-66)

## Current Code

```typescript
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:previous|your|all)\s+instruction/i,
  // ... etc
];

private detectPromptInjection(message: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(message));
  // No unicode normalization before matching!
}
```

## Expected Code

```typescript
private detectPromptInjection(message: string): boolean {
  // Normalize unicode to catch lookalike characters
  const normalized = message.normalize('NFKC');
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}
```

## Impact

- **Security**: Prompt injection attacks using unicode bypass
- **AI Safety**: Malicious prompts could manipulate chatbot behavior
- **Data Integrity**: Attackers could extract or modify data

## Bypass Examples

- `ⅰgnore previous instructions` (Unicode i)
- `ignore\u200Bprevious` (zero-width space)
- `ignore​previous` (looks same but has invisible char)

## Fix Steps

1. Add `normalize('NFKC')` before pattern matching
2. Consider additional sanitization (remove zero-width chars)
3. Add tests for unicode bypass attempts
4. Consider more comprehensive injection detection library

## Related Files

- `server/src/agent/orchestrator/orchestrator.ts` - Check for same pattern
- `server/src/lib/core/sanitization.ts` - May have helpers

## Testing

- Test with Unicode lookalike characters
- Test with zero-width space injection
- Test with various encoding tricks

## Tags

security, agent, prompt-injection, unicode, code-review
