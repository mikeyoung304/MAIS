# ADK Zod Type Limitations

Google ADK converts Zod schemas to Gemini function declarations. These types are **NOT supported** and will cause deploy failures or runtime errors.

## Unsupported Types

| Zod Type                 | Issue                             | Alternative                            |
| ------------------------ | --------------------------------- | -------------------------------------- |
| `z.record()`             | Cannot convert to function schema | `z.any().describe('Key-value object')` |
| `z.tuple()`              | Fixed-length arrays not supported | `z.array()` with appropriate type      |
| `z.intersection()`       | Type intersection not mapped      | Flatten into single `z.object()`       |
| `z.lazy()`               | Recursive types not supported     | Avoid recursion, limit depth           |
| `z.union()` with objects | Complex unions fail               | Use `z.enum()` or `z.any()`            |

## Examples

### z.record() - NOT SUPPORTED

```typescript
// WRONG - will fail
const Params = z.object({
  metadata: z.record(z.string()),
  headers: z.record(z.string(), z.string()),
});

// CORRECT - use z.any() with description
const Params = z.object({
  metadata: z.any().describe('Object with string keys and string values'),
  headers: z.any().describe('HTTP headers as key-value pairs'),
});
```

### z.tuple() - NOT SUPPORTED

```typescript
// WRONG - will fail
const Params = z.object({
  coordinates: z.tuple([z.number(), z.number()]),
  range: z.tuple([z.string(), z.string()]),
});

// CORRECT - use z.array() with constraints
const Params = z.object({
  coordinates: z.array(z.number()).length(2).describe('Latitude, longitude pair'),
  range: z.array(z.string()).length(2).describe('Start date, end date'),
});
```

### z.intersection() - NOT SUPPORTED

```typescript
// WRONG - will fail
const BaseParams = z.object({ tenantId: z.string() });
const SpecificParams = z.object({ serviceId: z.string() });
const Params = z.intersection(BaseParams, SpecificParams);

// CORRECT - flatten to single object
const Params = z.object({
  tenantId: z.string(),
  serviceId: z.string(),
});
```

### Complex z.union() - PROBLEMATIC

```typescript
// WRONG - object unions are problematic
const Params = z.object({
  content: z.union([
    z.object({ type: z.literal('text'), value: z.string() }),
    z.object({ type: z.literal('image'), url: z.string() }),
  ]),
});

// CORRECT - use z.any() with description
const Params = z.object({
  content: z.any().describe('Either {type:"text", value:string} or {type:"image", url:string}'),
});

// ALTERNATIVE - use discriminated approach in prompt instead
const Params = z.object({
  contentType: z.enum(['text', 'image']),
  value: z.string().optional(),
  url: z.string().optional(),
});
```

## Safe Types (Use These)

| Zod Type       | Example                        | Notes                                   |
| -------------- | ------------------------------ | --------------------------------------- |
| `z.string()`   | `name: z.string()`             | Works perfectly                         |
| `z.number()`   | `price: z.number()`            | Works perfectly                         |
| `z.boolean()`  | `active: z.boolean()`          | Works perfectly                         |
| `z.array()`    | `tags: z.array(z.string())`    | Arrays of primitives work               |
| `z.object()`   | `user: z.object({...})`        | Nested objects work                     |
| `z.enum()`     | `status: z.enum(['a', 'b'])`   | Enums work well                         |
| `z.optional()` | `notes: z.string().optional()` | Optional fields work                    |
| `z.default()`  | `count: z.number().default(0)` | Defaults work                           |
| `z.describe()` | `z.any().describe('...')`      | **HIGHLY RECOMMENDED**                  |
| `z.any()`      | `data: z.any()`                | Use with `.describe()` for LLM guidance |

## The z.any() + .describe() Pattern

When you need flexibility, use `z.any()` with a detailed `.describe()` to guide the LLM:

```typescript
const ContentUpdateParams = z.object({
  sectionId: z.string().describe('ID of the section to update'),

  // Complex nested content - use z.any() with detailed description
  content: z.any().describe(`
    Content object with fields to update. Structure depends on section type:
    - Hero section: { headline: string, subheadline: string, ctaText: string }
    - About section: { title: string, body: string, teamMembers: array }
    - Gallery section: { images: array of { url: string, caption: string } }
  `),

  // Metadata can have any string keys
  metadata: z.any().describe('Optional metadata as key-value pairs'),
});
```

## Validation Script

Run this before deploying to check for unsupported patterns:

```bash
#!/bin/bash
# Check for unsupported Zod types in agent files

echo "Checking for unsupported Zod patterns..."

AGENTS="booking marketing storefront research concierge"
ISSUES=0

for AGENT in $AGENTS; do
  FILE="server/src/agent-v2/deploy/$AGENT/src/agent.ts"
  if [ -f "$FILE" ]; then
    if grep -qE 'z\.(record|tuple|intersection|lazy)\(' "$FILE"; then
      echo "ISSUE in $AGENT:"
      grep -nE 'z\.(record|tuple|intersection|lazy)\(' "$FILE"
      ISSUES=$((ISSUES + 1))
    fi
  fi
done

if [ $ISSUES -eq 0 ]; then
  echo "All agents use supported Zod types."
else
  echo ""
  echo "Found $ISSUES agent(s) with unsupported Zod types."
  echo "See ZOD_LIMITATIONS.md for alternatives."
  exit 1
fi
```

## Related

- [ADK A2A Prevention Index](../../docs/solutions/patterns/ADK_A2A_PREVENTION_INDEX.md) - Full prevention strategies
- [ADK Agent Deployment Pattern](../../server/docs/solutions/patterns/adk-agent-deployment-pattern.md) - Deployment guide
