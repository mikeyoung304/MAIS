---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: apps/web/src/components
severity: P2
related_commit: e2d6545
tags: [react, keys, performance, state-loss, component-identity]
---

# Quick Reference: React Keys & Stable Identifiers

## The Problem (TL;DR)

```typescript
// ❌ DON'T: Array index as key
{messages.map((msg, index) => (
  <MessageBubble key={index} />  // ← BUG: index changes when list reorders
))}

// Reorder: [A, B, C] → [B, A, C]
// Keys: [0, 1, 2] → [0, 1, 2]  ← Same keys, different messages!
// Result: Component state lost, React thinks it's a different message
```

**Impact:**

- Reorder list → Wrong state on wrong component
- Delete item → All states shift
- Add item → Rebuild all components

## The Solution (Copy & Paste)

### Option 1: UUID (New Data)

```typescript
interface ChatMessage {
  id: string;  // ← Add this
  role: 'user' | 'assistant';
  content: string;
}

// Create with UUID
const newMessage: ChatMessage = {
  id: crypto.randomUUID(),  // ← Stable, unique
  role: 'user',
  content: text,
};

// Use in map
{messages.map((msg) => (
  <MessageBubble key={msg.id} message={msg} />  // ✅ Stable
))}
```

### Option 2: Database ID (Persisted Data)

```typescript
// Messages come from API with id field
interface Message {
  id: string;     // ← UUID from database
  content: string;
}

{messages.map((msg) => (
  <MessageBubble key={msg.id} message={msg} />  // ✅ Use DB ID
))}
```

### Option 3: Composite Key (Multiple Instances)

```typescript
// If same data appears in multiple places
{items.map((item) => (
  <Item
    key={`${item.id}:${item.listId}:${item.timestamp}`}
    item={item}
  />
))}
```

## ESLint Rule (Required)

```javascript
// .eslintrc.js
{
  extends: ['plugin:react/recommended'],
  rules: {
    'react/no-array-index-key': 'error'  // ← Catch this at commit time
  }
}
```

This flags the anti-pattern:

```typescript
{list.map((item, i) => (
  <Item key={i} />  // ❌ ERROR: "Do not use Array index in keys"
))}
```

## When Array Index IS Okay

Only in these rare cases:

```typescript
// ✅ OKAY: Static, never reordered list
const COLORS = ['red', 'green', 'blue'];
{COLORS.map((color, index) => (
  <Swatch key={index} color={color} />
))}

// ✅ OKAY: Virtualized list where index is row number
<VirtualList>
  {({ index }) => (
    <Row key={`row-${index}`} rowNumber={index} />
  )}
</VirtualList>
```

## Test for Correct Behavior

```typescript
test('message state persists when list reorders', () => {
  const { rerender } = render(
    <ChatWindow messages={[msg1, msg2]} />
  );

  // User edits a message
  fireEvent.change(screen.getByDisplayValue(msg1.content), {
    target: { value: 'edited' }
  });

  // Reorder list
  rerender(<ChatWindow messages={[msg2, msg1]} />);

  // ✅ With stable UUID keys: Edit still on msg1
  // ❌ With array index keys: Edit now on msg2 (WRONG)
  expect(screen.getByDisplayValue('edited')).toHaveValue(msg1.content);
});
```

## Performance: Why It Matters

```
With Array Index Keys:
message list [A, B, C] → [B, A, C]
  A's key 0 → has B's state (WRONG)
  B's key 1 → has A's state (WRONG)
  React: Completely remount both components
  Cost: Unmount A, Mount A, Unmount B, Mount B = 4 operations

With Stable UUID Keys:
message list [A, B, C] → [B, A, C]
  B's key (UUID B) now at position 0
  A's key (UUID A) now at position 1
  React: Move DOM node, move DOM node = 2 operations
  Cost: 2x faster
```

## Implementation Checklist

When creating a component with `.map()`:

```typescript
{items.map((item) => (
  <Component
    key={???}  // ← Must answer these:
    item={item}
  />
))}
```

Ask in order:

1. Does item have an `id` field from database/API?
   - YES → Use it: `key={item.id}`
   - NO → Go to 2

2. Is this list static (never reorders)?
   - YES → Can use index: `key={index}`
   - NO → Go to 3

3. Does item come from user input?
   - YES → Generate UUID: `key={crypto.randomUUID()}`
   - NO → Go to 4

4. Is item from a config/constant?
   - YES → Can use index: `key={index}`
   - NO → Use composite: `key={`${item.name}:${item.id}`}`

## Common Anti-Patterns

| Pattern                        | Problem                | Fix                     |
| ------------------------------ | ---------------------- | ----------------------- |
| `key={index}`                  | Shifts on reorder      | Use `id` or UUID        |
| `key={i}`                      | Same as index          | Use `id` or UUID        |
| `key={Math.random()}`          | New key each render    | Use stable ID           |
| `key={item.name}` (non-unique) | Collides if duplicates | Use ID or add timestamp |
| No key                         | React uses index       | Always add key          |

## Component Example: Chat Widget

```typescript
// ✅ CORRECT IMPLEMENTATION
interface ChatMessage {
  id: string;              // ← UUID
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CustomerChatWidgetProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export function CustomerChatWidget({ messages, onSendMessage }: CustomerChatWidgetProps) {
  return (
    <div className="chat-history">
      {/* ✅ Using stable id field */}
      {messages.map((message) => (
        <MessageBubble
          key={message.id}  // ← Stable, unique, never changes
          message={message}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [isEditing, setIsEditing] = useState(false);  // ← State persists with stable key

  return (
    <div className="message">
      <p>{message.content}</p>
      <button onClick={() => setIsEditing(!isEditing)}>Edit</button>
      {/* State is tied to message.id, survives reorder */}
    </div>
  );
}
```

## File Locations in MAIS

- `apps/web/src/components/chat/CustomerChatWidget.tsx` - ✅ Fixed in PR #23
- Any component with `.map()` rendering lists
- Search for: `map((.*) => <`

## Pre-Commit Checks

```bash
# Catch array index keys before commit
git diff --cached | grep -E "key=\{.*index\}" && {
  echo "❌ Found array index key in diff"
  echo "Use stable IDs instead"
  exit 1
}

# Or use ESLint
npm run lint -- --fix  # Auto-fix if possible
```

## Troubleshooting

**Q: My list keeps re-rendering unnecessarily**

A: Likely key issue. Check:

```typescript
// Debug: Log key changes
{items.map((item, i) => {
  console.log(`Rendering item ${i} with key ${item.id}`);
  return <Item key={item.id} item={item} />;
})}
```

**Q: Component state resets on filter**

A: Array index key problem. Solution:

```typescript
// Instead of:
{filteredList.map((item, i) => <Item key={i} />)}

// Do:
{filteredList.map((item) => <Item key={item.id} />)}
```

**Q: Why does my form input lose focus?**

A: Component remounting due to key instability. Check `.map()` keys.

---

**Use This Document:** When implementing any `.map()` that renders components
**Related:** PR-23-PREVENTION-STRATEGIES.md - Issue #3
**Rule:** No array index keys. EVER. Use stable IDs or UUIDs.
