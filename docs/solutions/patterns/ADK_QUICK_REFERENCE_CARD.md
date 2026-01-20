# ADK A2A Quick Reference Card

**Print this. Pin it. Never debug these again.**

---

## A2A Protocol: camelCase!

```typescript
// ✅ CORRECT
{
  appName: 'agent',
  userId: 'tenant:user',
  sessionId: 'session-123',
  newMessage: { role: 'user', parts: [{ text: msg }] }
}

// ❌ WRONG (silent failure)
{
  app_name: 'agent',    // ADK ignores this
  user_id: '...',       // "Session not found"
  session_id: '...',
  new_message: {...}
}
```

---

## App Name Discovery

```bash
# After deploy, verify app name:
TOKEN=$(gcloud auth print-identity-token)
curl -H "Authorization: Bearer $TOKEN" "$URL/list-apps"
# Returns: ["agent"] ← Use THIS, not directory name
```

---

## Response Parsing

```typescript
// ADK returns ARRAY, not object
const data = await response.json(); // [{ content: {...} }]

// Find model response (iterate from end)
for (let i = data.length - 1; i >= 0; i--) {
  if (data[i].content?.role === 'model') {
    return data[i].content.parts[0].text;
  }
}
```

---

## Zod Limitations

| ❌ Don't Use       | ✅ Use Instead            |
| ------------------ | ------------------------- |
| `z.record()`       | `z.any().describe('...')` |
| `z.tuple()`        | `z.array()`               |
| `z.intersection()` | Flatten to `z.object()`   |
| `z.lazy()`         | Avoid recursion           |

---

## Tool-First Prompts

```markdown
❌ WRONG - LLM copies this verbatim
User: "Write headlines"
You: "On it. Check the preview →"

✅ CORRECT - Forces tool call
User: "Write headlines"
→ FIRST: Call delegate_to_marketing(...)
→ WAIT for result
→ THEN respond with content
```

---

## Identity Tokens

| Context         | Method              |
| --------------- | ------------------- |
| Agent → Agent   | Metadata service    |
| Backend → Agent | GoogleAuth          |
| Local dev       | gcloud CLI fallback |

```typescript
// Always have fallback
try {
  const client = await auth.getIdTokenClient(url);
  return (await client.getRequestHeaders())['Authorization'];
} catch {
  const { stdout } = await execAsync('gcloud auth print-identity-token');
  return `Bearer ${stdout.trim()}`;
}
```

---

## Debugging Commands

```bash
# Check service URL
gcloud run services describe $SERVICE --format='value(status.url)'

# Create session
curl -X POST "$URL/apps/agent/users/test%3Auser/sessions" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"state":{"tenantId":"test"}}'

# Send message & check for tool calls
curl -X POST "$URL/run" -H "Authorization: Bearer $TOKEN" \
  -d '{"appName":"agent","userId":"test:user","sessionId":"$SID",
       "newMessage":{"role":"user","parts":[{"text":"Write headlines"}]}}' \
  | jq '.[] | select(.content.parts[].functionCall)'
```

---

## Cloud Run Logs

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="concierge-agent"' \
  --project=handled-484216 --limit=30 \
  --format="table(timestamp,textPayload)"
```

---

## The 8 Pitfalls (32-39)

| #   | Issue        | One-Liner                |
| --- | ------------ | ------------------------ |
| 32  | camelCase    | `appName` not `app_name` |
| 33  | App name     | Use `/list-apps`         |
| 34  | Zod types    | No `z.record()`          |
| 35  | Response     | Array not object         |
| 36  | Auth         | Fallback for local       |
| 37  | Prompts      | No `You: "..."` examples |
| 38  | URLs         | Use env vars             |
| 39  | Array format | Iterate from end         |

---

**Full docs:** `docs/solutions/patterns/ADK_A2A_ORCHESTRATOR_COMPOUND.md`
