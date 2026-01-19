---
status: ready
priority: p1
issue_id: '5188'
tags: [code-review, agent-v2, architecture, functionality]
dependencies: []
---

# Marketing Agent Tools Return Instructions Instead of Generated Content

## Problem Statement

The Marketing agent's content generation tools (`generate_headline`, `generate_tagline`, `generate_service_description`, `refine_copy`) return instruction objects like `{instruction: "Generate 3 headlines..."}` instead of actually generating the content. This means the Marketing agent doesn't actually generate any marketing copy - it just tells itself what it should do.

**Why it matters:** The Marketing specialist is supposed to be the copy generation expert. If it returns instructions instead of content, either:

1. The LLM has to interpret the instructions and generate content in its response (unreliable, not tool-driven)
2. The Concierge receives instructions instead of actual headlines/taglines (broken delegation)

This defeats the purpose of having a specialist agent and makes the tool calls pointless.

## Findings

**Source:** Agent-v2 code review

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/marketing/src/agent.ts`

**generate_headline (lines 229-258):**

```typescript
const generateHeadlineTool = new FunctionTool({
  name: 'generate_headline',
  description: 'Generate compelling headlines for website sections...',
  parameters: GenerateHeadlineParams,
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) {
      return { error: 'No tenant context available' };
    }

    // Get business context for personalization
    const bizResult = await callMaisApi('/business-info', tenantId);
    const businessContext = bizResult.ok ? bizResult.data : {};

    // PROBLEM: Returns instruction instead of actual content
    return {
      toolAction: 'generate_headline',
      params,
      businessContext,
      instruction: `Generate 3 headline options for ${params.context}.
        Tone: ${params.tone}
        ${params.currentHeadline ? `Improve upon: "${params.currentHeadline}"` : ''}
        ${params.keywords?.length ? `Incorporate keywords: ${params.keywords.join(', ')}` : ''}
        Return as JSON with: { primary: string, variants: string[], rationale: string }`,
    };
  },
});
```

**generate_tagline (lines 298-326):**

```typescript
return {
  toolAction: 'generate_tagline',
  params,
  businessContext,
  instruction: `Generate a tagline for the business.
    Context: ${params.businessContext}
    Tone: ${params.tone}
    ${params.existingTagline ? `Improve upon: "${params.existingTagline}"` : ''}
    MUST be under 7 words.
    Return as JSON with: { primary: string, variants: string[], rationale: string }`,
};
```

**generate_service_description (lines 261-295):**

```typescript
return {
  toolAction: 'generate_service_description',
  params,
  businessContext,
  existingServices,
  instruction: `Generate a service description for "${params.serviceName}" (${params.serviceType}).
    Tone: ${params.tone}
    ...
    Return as JSON with: { primary: string, variants: string[], rationale: string }`,
};
```

**refine_copy (lines 329-355):**

```typescript
return {
  toolAction: 'refine_copy',
  params,
  businessContext,
  instruction: `Refine this ${params.copyType}:
    Original: "${params.originalCopy}"
    Feedback: ${params.feedback}
    Return as JSON with: { primary: string, variants: string[], rationale: string }`,
};
```

**All four tools follow this broken pattern.**

## Proposed Solutions

### Solution 1: Backend Content Generation Endpoint (Recommended)

**Approach:** Create backend endpoints that use Gemini to actually generate the content

```typescript
// server/src/routes/v1/internal/agent/marketing.ts
router.post('/generate-headline', async (req, res) => {
  const { tenantId, context, tone, currentHeadline, keywords } = req.body;

  const businessInfo = await getBusinessInfo(tenantId);

  const prompt = `Generate 3 headline options for ${context}.
    Business: ${businessInfo.name} (${businessInfo.industry})
    Tone: ${tone}
    ${currentHeadline ? `Improve upon: "${currentHeadline}"` : ''}
    ${keywords?.length ? `Keywords: ${keywords.join(', ')}` : ''}

    Return JSON: { primary: string, variants: string[], rationale: string }`;

  const result = await gemini.generateContent(prompt);
  const content = JSON.parse(result.response.text());

  return res.json(content);
});

// In marketing agent:
const generateHeadlineTool = new FunctionTool({
  name: 'generate_headline',
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { error: 'No tenant context' };

    const result = await callMaisApi('/marketing/generate-headline', tenantId, params);

    if (!result.ok) return { error: result.error };

    // Returns actual generated content
    return result.data; // { primary: "Your Story, Beautifully Told", variants: [...], rationale: "..." }
  },
});
```

**Pros:**

- Tools return actual generated content
- Backend can use appropriate model for creative tasks
- Centralized content generation logic
- Easier to add caching, rate limiting

**Cons:**

- Requires new backend endpoints
- Additional API calls
- Backend must have Gemini credentials

**Effort:** 4 hours

### Solution 2: Inline Generation Using ADK Agent's LLM

**Approach:** Use the agent's LLM to generate content within the tool execution

```typescript
// This approach relies on ADK's ability to make nested LLM calls
// Note: May not be supported in all ADK versions

const generateHeadlineTool = new FunctionTool({
  name: 'generate_headline',
  execute: async (params, context) => {
    const tenantId = getTenantId(context);
    if (!tenantId) return { error: 'No tenant context' };

    const bizResult = await callMaisApi('/business-info', tenantId);
    const businessContext = bizResult.ok ? bizResult.data : {};

    // Use context.generateContent if available in ADK
    // Otherwise, make direct Gemini API call
    const prompt = buildHeadlinePrompt(params, businessContext);

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);

    return JSON.parse(result.response.text());
  },
});
```

**Pros:**

- No backend changes needed
- Content generated in the specialist agent
- Immediate fix

**Cons:**

- Requires API key in agent deployment
- Nested LLM calls can be slow
- May conflict with ADK's execution model

**Effort:** 2 hours

### Solution 3: Fix the Anti-Pattern - Let LLM Generate in Response

**Approach:** Acknowledge the current design intent and make it work properly

The current implementation seems to expect the LLM to read the `instruction` field and generate content in its response. This works if:

1. The agent's system prompt tells it to interpret instruction responses
2. The LLM reliably generates structured JSON

```typescript
// Update system prompt to handle instruction responses:
const MARKETING_AGENT_SYSTEM_PROMPT = `...
## Tool Response Handling

When a tool returns an 'instruction' field, YOU must generate the content following that instruction.
Output the generated content in your response as structured JSON.
...`;

// Tool returns instruction (current behavior)
return {
  toolAction: 'generate_headline',
  instruction: `Generate 3 headlines...`,
};

// LLM response then includes the actual content
// "Based on the context, here are your headlines: { primary: '...', variants: [...] }"
```

**Pros:**

- No code changes to tools
- Works with current implementation

**Cons:**

- Unreliable - depends on LLM following instructions
- Harder to test
- Anti-pattern: tools should do work, not instruct
- Breaks delegation chain (Concierge receives instructions, not content)

**Effort:** 30 minutes (but not recommended)

## Recommended Action

**Implement Solution 1** - create backend endpoints that actually generate the marketing content. This is the proper architecture where:

- Tools perform specific operations
- Tools return results of those operations
- The agent orchestrates tools and presents results

Update system prompt to say "Tools return generated content" rather than "interpret instruction responses."

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent-v2/deploy/marketing/src/agent.ts`
  - `generateHeadlineTool` (lines 229-258)
  - `generateServiceDescriptionTool` (lines 261-295)
  - `generateTaglineTool` (lines 298-326)
  - `refineCopyTool` (lines 329-355)

**New Files Needed (Solution 1):**

- `/Users/mikeyoung/CODING/MAIS/server/src/routes/v1/internal/agent/marketing.ts`
- `/Users/mikeyoung/CODING/MAIS/server/src/services/marketing-generation.service.ts`

**Related Components:**

- Concierge delegation to Marketing specialist
- Backend `/v1/internal/agent/*` routes

**Database Schema:** No changes required

## Acceptance Criteria

- [ ] `generate_headline` tool returns actual headlines, not instructions
- [ ] `generate_tagline` tool returns actual taglines
- [ ] `generate_service_description` tool returns actual descriptions
- [ ] `refine_copy` tool returns refined content
- [ ] Test: Call generate_headline directly - get JSON with `{ primary, variants, rationale }`
- [ ] Test: Concierge delegates "write headlines" to Marketing - gets actual headlines back
- [ ] Response format matches documented structure
- [ ] Remove `instruction` field from all tool responses

## Work Log

| Date       | Action                          | Learnings                                        |
| ---------- | ------------------------------- | ------------------------------------------------ |
| 2026-01-19 | Issue identified in code review | Tools return instructions, not generated content |

## Resources

- **ADK Documentation:** FunctionTool execute return values
- **Related Pattern:** Tool should do work, not instruct
- **CLAUDE.md Reference:** Pitfall #37 - "LLM pattern-matching prompts"
- **Similar Issue:** analyze_market in Research agent has same pattern
