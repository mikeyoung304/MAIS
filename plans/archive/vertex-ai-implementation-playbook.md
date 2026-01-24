# Vertex AI Implementation Playbook

**Date:** January 2026
**Status:** Ready for Execution
**Parent Plan:** `vertex-ai-agent-rebuild.md`

---

## How to Use This Document

This playbook separates tasks into two categories:

| Icon             | Meaning                                         |
| ---------------- | ----------------------------------------------- |
| **[MANUAL]**     | You must do this in Google Cloud Console or CLI |
| **[COPY/PASTE]** | Ready-to-use code/config - just copy and paste  |

---

## Part 1: Foundation Setup (Week 1)

### 1.1 [MANUAL] Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: `handled-ai-agents`
3. Note the Project ID (you'll use it everywhere)
4. Set up billing account

---

### 1.2 [COPY/PASTE] Enable Required APIs

Run this in Cloud Shell or your terminal with gcloud configured:

```bash
# Set your project
export PROJECT_ID="handled-ai-agents"
gcloud config set project $PROJECT_ID

# Enable all required APIs
gcloud services enable \
  aiplatform.googleapis.com \
  agentengine.googleapis.com \
  iam.googleapis.com \
  compute.googleapis.com \
  storage.googleapis.com \
  pubsub.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

echo "APIs enabled successfully"
```

---

### 1.3 [COPY/PASTE] Create Service Accounts

```bash
export PROJECT_ID="handled-ai-agents"

# Orchestrator (The Concierge)
gcloud iam service-accounts create sa-orchestrator \
  --display-name="HANDLED Orchestrator Agent" \
  --description="Concierge agent that delegates to specialists"

# Specialist Agents
gcloud iam service-accounts create sa-marketing-agent \
  --display-name="Marketing Specialist Agent"

gcloud iam service-accounts create sa-research-agent \
  --display-name="Research Specialist Agent"

gcloud iam service-accounts create sa-image-agent \
  --display-name="Image Generation Agent"

gcloud iam service-accounts create sa-video-agent \
  --display-name="Video Generation Agent"

gcloud iam service-accounts create sa-storefront-agent \
  --display-name="Storefront Editor Agent"

gcloud iam service-accounts create sa-booking-agent \
  --display-name="Customer Booking Agent"

gcloud iam service-accounts create sa-projecthub-agent \
  --display-name="Project Hub Mediator Agent"

echo "Service accounts created"
```

---

### 1.4 [COPY/PASTE] IAM Role Bindings

```bash
export PROJECT_ID="handled-ai-agents"

# Orchestrator gets A2A Invoker role (can delegate to other agents)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sa-orchestrator@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/agentengine.a2aInvoker"

# Orchestrator gets Agent Engine user (can run agents)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sa-orchestrator@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# All agents get AI Platform user role
for AGENT in marketing research image video storefront booking projecthub; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:sa-${AGENT}-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
done

# Image/Video agents get Vertex AI Image/Video permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sa-image-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.imageUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sa-video-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.videoUser"

# Storage access for media
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sa-image-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sa-video-agent@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

echo "IAM bindings applied"
```

---

### 1.5 [MANUAL] Request Quota Increases

Go to: **IAM & Admin → Quotas** in Google Cloud Console

Request increases for:

| Quota                                                        | Current Default | Request |
| ------------------------------------------------------------ | --------------- | ------- |
| `aiplatform.googleapis.com/agent_engine_concurrent_requests` | ~100            | 1,000   |
| `aiplatform.googleapis.com/imagen_requests_per_minute`       | ~60             | 300     |
| `aiplatform.googleapis.com/veo_requests_per_minute`          | ~10             | 50      |
| `aiplatform.googleapis.com/gemini_requests_per_minute`       | ~60             | 500     |

**Note:** Quota increases can take 24-48 hours. Request early!

---

### 1.6 [COPY/PASTE] Create Storage Bucket

```bash
export PROJECT_ID="handled-ai-agents"
export LOCATION="us-central1"

# Staging bucket for agent deployments
gsutil mb -l $LOCATION gs://${PROJECT_ID}-agent-staging

# Media bucket for generated images/videos
gsutil mb -l $LOCATION gs://${PROJECT_ID}-media

# Set lifecycle policy to auto-delete orphaned drafts after 30 days
cat > /tmp/lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["drafts/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set /tmp/lifecycle.json gs://${PROJECT_ID}-media

echo "Storage buckets created"
```

---

## Part 2: Agent Cards (A2A Protocol)

The A2A protocol requires each agent to have an "Agent Card" - a JSON manifest describing its capabilities.

### 2.1 [COPY/PASTE] Concierge Orchestrator Card

Save as `agents/concierge/agent-card.json`:

```json
{
  "name": "handled_concierge",
  "version": "1.0.0",
  "description": "Primary interface for HANDLED service professionals. Routes requests to specialist agents.",
  "protocol": "a2a-v1",
  "capabilities": [
    "intent_classification",
    "task_delegation",
    "context_aggregation",
    "preview_coordination"
  ],
  "delegates_to": [
    "marketing_specialist",
    "research_specialist",
    "image_specialist",
    "video_specialist",
    "storefront_specialist"
  ],
  "model": {
    "name": "gemini-3-pro",
    "thinking_level": "high",
    "temperature": 0.2
  },
  "trust_tier": {
    "T1": ["read_operations", "delegate_operations"],
    "T2": ["preview_mutations"],
    "T3": ["publish_operations"]
  }
}
```

---

### 2.2 [COPY/PASTE] Marketing Specialist Card

Save as `agents/marketing/agent-card.json`:

```json
{
  "name": "marketing_specialist",
  "version": "1.0.0",
  "description": "Generates and refines website copy, headlines, taglines, and marketing content.",
  "protocol": "a2a-v1",
  "capabilities": [
    "generate_headline",
    "generate_tagline",
    "generate_service_description",
    "generate_about_content",
    "generate_seo_content",
    "refine_copy"
  ],
  "accepts_from": ["handled_concierge"],
  "model": {
    "name": "gemini-2.5-flash",
    "temperature": 0.7
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "content": { "type": "string" },
      "variants": { "type": "array", "items": { "type": "string" } },
      "confidence": { "type": "number" }
    }
  }
}
```

---

### 2.3 [COPY/PASTE] Research Specialist Card

Save as `agents/research/agent-card.json`:

```json
{
  "name": "research_specialist",
  "version": "1.0.0",
  "description": "Gathers market intelligence - competitor pricing, industry benchmarks, local market analysis.",
  "protocol": "a2a-v1",
  "capabilities": [
    "search_local_competitors",
    "extract_pricing_data",
    "analyze_market_position",
    "generate_swot_analysis",
    "generate_pricing_recommendation"
  ],
  "accepts_from": ["handled_concierge"],
  "model": {
    "name": "gemini-2.5-flash",
    "temperature": 0.3
  },
  "tools": {
    "google_search": true,
    "web_scraper": true
  },
  "rate_limits": {
    "scrape_requests_per_hour": 100,
    "search_requests_per_hour": 200
  }
}
```

---

### 2.4 [COPY/PASTE] Image Specialist Card

Save as `agents/image/agent-card.json`:

```json
{
  "name": "image_specialist",
  "version": "1.0.0",
  "description": "Generates and enhances images using Imagen 3.",
  "protocol": "a2a-v1",
  "capabilities": [
    "generate_image",
    "enhance_photo",
    "remove_background",
    "inpaint_object",
    "outpaint_extend"
  ],
  "accepts_from": ["handled_concierge"],
  "model": {
    "name": "gemini-2.5-flash",
    "temperature": 0.5
  },
  "media_model": {
    "name": "imagen-3",
    "safety_filter_level": "block_some",
    "person_generation": "allow_adult"
  },
  "cost_controls": {
    "requires_estimate": true,
    "warn_at_percent": 80,
    "tier_limits": {
      "handled": { "images_per_month": 20 },
      "fully_handled": { "images_per_month": 100 }
    }
  }
}
```

---

### 2.5 [COPY/PASTE] Video Specialist Card

Save as `agents/video/agent-card.json`:

```json
{
  "name": "video_specialist",
  "version": "1.0.0",
  "description": "Generates promotional videos using Veo 2.",
  "protocol": "a2a-v1",
  "capabilities": ["generate_promo_video", "image_to_video", "extend_video", "estimate_video_cost"],
  "accepts_from": ["handled_concierge"],
  "model": {
    "name": "gemini-2.5-flash",
    "temperature": 0.5
  },
  "media_model": {
    "name": "veo-002",
    "person_safety_setting": "allow_adult",
    "max_duration_seconds": 8
  },
  "cost_controls": {
    "requires_estimate": true,
    "requires_explicit_confirm": true,
    "tier_limits": {
      "handled": { "videos_per_month": 5, "seconds_per_month": 40 },
      "fully_handled": { "videos_per_month": 25, "seconds_per_month": 200 }
    }
  },
  "async": {
    "polling_interval_ms": 5000,
    "max_wait_seconds": 300
  }
}
```

---

### 2.6 [COPY/PASTE] Storefront Specialist Card

Save as `agents/storefront/agent-card.json`:

```json
{
  "name": "storefront_specialist",
  "version": "1.0.0",
  "description": "Manages storefront structure, layout, sections, and branding.",
  "protocol": "a2a-v1",
  "capabilities": [
    "get_page_structure",
    "update_section",
    "reorder_sections",
    "add_section",
    "remove_section",
    "update_branding",
    "preview_draft",
    "discard_draft"
  ],
  "accepts_from": ["handled_concierge"],
  "model": {
    "name": "gemini-2.5-flash",
    "temperature": 0.3
  },
  "mcp_tools": {
    "prisma_database": true,
    "tenant_context": true
  }
}
```

---

### 2.7 [COPY/PASTE] Booking Agent Card

Save as `agents/booking/agent-card.json`:

```json
{
  "name": "booking_agent",
  "version": "1.0.0",
  "description": "Customer-facing agent for service discovery and booking completion.",
  "protocol": "a2a-v1",
  "capabilities": [
    "get_services",
    "get_service_details",
    "check_availability",
    "get_business_info",
    "answer_faq",
    "recommend_package",
    "create_booking"
  ],
  "model": {
    "name": "gemini-2.5-flash",
    "temperature": 0.5
  },
  "grounding": {
    "rag_enabled": true,
    "data_sources": ["tenant_services", "tenant_faqs"]
  },
  "security": {
    "public_facing": true,
    "rate_limit_per_ip": 60,
    "prompt_injection_detection": true
  },
  "trust_tier": {
    "T1": ["read_operations", "availability_check"],
    "T3": ["create_booking"]
  }
}
```

---

### 2.8 [COPY/PASTE] Project Hub Agent Card

Save as `agents/project-hub/agent-card.json`:

```json
{
  "name": "project_hub_agent",
  "version": "1.0.0",
  "description": "Dual-faced agent mediating customer-tenant communication post-booking.",
  "protocol": "a2a-v1",
  "capabilities": {
    "customer_context": [
      "get_project_status",
      "get_prep_checklist",
      "answer_prep_question",
      "submit_request",
      "upload_file",
      "get_timeline"
    ],
    "tenant_context": [
      "get_pending_requests",
      "get_customer_activity",
      "approve_request",
      "deny_request",
      "send_message_to_customer",
      "update_project_status"
    ]
  },
  "model": {
    "name": "gemini-2.5-flash",
    "temperature": 0.4
  },
  "mediation": {
    "auto_handle_threshold": 0.8,
    "escalate_threshold": 0.5,
    "always_escalate_keywords": ["refund", "complaint", "lawyer", "legal", "cancel"]
  },
  "escalation": {
    "expiry_hours": 72,
    "auto_response_on_expiry": true
  }
}
```

---

## Part 3: Concierge System Prompt (Enhanced)

### 3.1 [COPY/PASTE] Production-Ready System Prompt

Save as `agents/concierge/system-prompt.md` or paste directly into Vertex AI Agent Builder:

```markdown
# HANDLED Concierge - System Prompt

## Identity

You are the HANDLED Concierge - a terse, cheeky, anti-corporate assistant who knows he's good and gets things done. You help service professionals build and optimize their business.

## Personality Rules

- **Terse**: Don't waste words. "Done." beats "I have successfully completed your request."
- **Cheeky**: Light humor, no corporate speak. "Your headlines are giving 'dental office from 2003'" is fine.
- **Action-Oriented**: Bias toward doing, not discussing. Don't ask for permission when you can show a preview.
- **Confident**: You're good at this. Don't hedge. "Try this" not "Perhaps you might consider maybe trying this?"
- **Moves Forward**: When something fails, fix it and move on. Don't dwell.

## Decision Tree (BEFORE ANY ACTION)
```

User Request Received
│
├─ Is this a GREETING or SMALL TALK?
│ → Respond directly (brief, cheeky)
│ → Do NOT delegate
│
├─ Is this a READ operation? (show me, what is, list)
│ → Use get\_\* tools directly
│ → Do NOT delegate to specialists
│
├─ Does this require COPY/TEXT generation?
│ → Delegate to MARKETING_SPECIALIST
│ → Wait for response → Show in preview
│
├─ Does this require MARKET RESEARCH?
│ → Delegate to RESEARCH_SPECIALIST
│ → Warn: "This takes 30-60 seconds, I'm scraping real data"
│ → Wait for response → Summarize findings
│
├─ Does this require IMAGE generation?
│ → FIRST: Call estimate_image_cost
│ → THEN: Show cost to user
│ → ONLY IF CONFIRMED: Delegate to IMAGE_SPECIALIST
│
├─ Does this require VIDEO generation?
│ → FIRST: Call estimate_video_cost
│ → THEN: Show cost + "This is T3, requires your explicit approval"
│ → ONLY IF CONFIRMED: Delegate to VIDEO_SPECIALIST
│
├─ Does this require LAYOUT/STRUCTURE changes?
│ → Delegate to STOREFRONT_SPECIALIST
│ → Wait for response → Show in preview
│
└─ UNCLEAR what they want?
→ Ask ONE clarifying question
→ Do NOT guess and delegate

```

## Delegation Protocol (A2A)

When delegating, ALWAYS:

1. **Include tenant context**: `{ tenantId, tenantSlug, subscriptionTier }`
2. **Specify expected output**: "Return JSON with `content` and `variants` fields"
3. **Set timeout**: Research = 60s, Media = 120s, Others = 30s

## Trust Tier Behaviors

| Tier | Behavior | Example |
|------|----------|---------|
| T1 | Execute immediately | Read operations, estimates |
| T2 | Execute + show preview | Copy changes, layout changes |
| T3 | Show preview + REQUIRE explicit "Submit" | Publish live, create booking, generate video |

## Preview Panel Protocol

After ANY mutation (T2 or T3):
1. Push changes to preview panel via WebSocket
2. Tell user: "Check the preview on the right →"
3. Wait for their reaction before continuing

## Error Handling

If a specialist fails:
1. Log the error (they won't see this)
2. Try ONE more time with simpler parameters
3. If still fails: "That didn't work. [Brief reason]. Want me to try a different approach?"

Do NOT:
- Apologize excessively
- Explain technical details
- Give up without offering an alternative

## Context Injection (You receive these automatically)

```

CURRENT CONTEXT:
Business: {business_name}
Industry: {industry}
Location: {location}
Tier: {subscription_tier}
Current Focus: {current_task}
Session Cost So Far: {session_cost}

```

## Examples

**Good Response:**
User: "Write me better headlines"
You: "On it. Check the preview →"
[Delegates to Marketing, pushes 3 variants to preview]
"Got 3 options. Which vibes?"

**Bad Response:**
User: "Write me better headlines"
You: "I'd be happy to help you with that! Generating compelling headlines is one of my specialties. I'll delegate this to our Marketing Specialist who will create several options for you to review. Please note that this may take a moment..."

**Good Response (Error):**
User: "Generate a video of my studio"
[Video generation fails]
You: "Video gen choked. Probably too complex a scene. Want to try a simpler shot - just the exterior?"

**Bad Response (Error):**
User: "Generate a video of my studio"
[Video generation fails]
You: "I apologize, but I encountered an error while attempting to generate your video. The Veo 2 API returned a 500 Internal Server Error. This could be due to server load or an issue with the prompt parameters. I'm very sorry for the inconvenience..."
```

---

## Part 4: ADK Implementation Code

### 4.1 [COPY/PASTE] Orchestrator Agent (TypeScript)

Save as `server/src/agent-v2/agents/concierge/concierge-orchestrator.ts`:

```typescript
import { LlmAgent, InMemoryRunner } from '@google/adk';
import { createUserContent } from '@google/genai';
import { z } from 'zod';
import { FunctionTool } from '@google/adk';

// Import specialist agents
import { marketingAgent } from '../marketing/marketing-agent';
import { researchAgent } from '../research/research-agent';
import { imageAgent } from '../image/image-agent';
import { videoAgent } from '../video/video-agent';
import { storefrontAgent } from '../storefront/storefront-agent';

// Import the system prompt
import { CONCIERGE_SYSTEM_PROMPT } from './system-prompt';

// Tenant context tool - provides business info to the agent
const getTenantContext = new FunctionTool({
  name: 'get_tenant_context',
  description: 'Retrieves current business context for the tenant',
  parameters: z.object({}),
  execute: async (_, context) => {
    const tenantId = context.session.state.get('tenantId');
    // This would call your MAIS backend
    const tenant = await fetchTenantContext(tenantId);
    return {
      business_name: tenant.businessName,
      industry: tenant.industry,
      location: tenant.location,
      subscription_tier: tenant.subscriptionTier,
      current_task: tenant.currentTask || 'general assistance',
    };
  },
});

// Preview publishing tool
const publishPreview = new FunctionTool({
  name: 'publish_preview',
  description: 'Pushes changes to the preview panel for user review',
  parameters: z.object({
    section: z.string().describe('Section being updated'),
    content: z.any().describe('New content for the section'),
    variants: z.array(z.any()).optional().describe('Alternative options'),
  }),
  execute: async ({ section, content, variants }, context) => {
    const sessionId = context.session.id;
    // Push to WebSocket for real-time preview
    await publishToPreviewPanel(sessionId, { section, content, variants });
    return { success: true, message: 'Preview updated' };
  },
});

// Main Concierge Orchestrator
export const conciergeOrchestrator = new LlmAgent({
  name: 'ConciergeOrchestrator',
  description: 'Primary interface for HANDLED service professionals',

  // CRITICAL: Use Gemini 3 Pro with high thinking for orchestration
  model: 'gemini-3-pro',

  // System prompt with personality and decision tree
  instruction: CONCIERGE_SYSTEM_PROMPT,

  // Hub-and-spoke: Concierge delegates to these specialists
  subAgents: [marketingAgent, researchAgent, imageAgent, videoAgent, storefrontAgent],

  // Direct tools (not delegated)
  tools: [getTenantContext, publishPreview],

  // Model configuration
  generateContentConfig: {
    temperature: 0.2, // Low for consistent routing
    maxOutputTokens: 2048,
    // CRITICAL: Enable deep thinking for orchestration quality
    thinkingConfig: {
      thinkingLevel: 'high',
    },
  },

  // Callbacks for logging and security
  beforeToolCallback: async ({ tool, args, context }) => {
    const tenantId = context.session.state.get('tenantId');
    await logToolCall(tenantId, tool.name, args);
    return undefined;
  },

  afterToolCallback: async ({ tool, args, context, response }) => {
    // Track costs for media generation
    if (tool.name.includes('image') || tool.name.includes('video')) {
      await trackMediaCost(context.session.state.get('tenantId'), tool.name, response);
    }
    return undefined;
  },
});

// Helper functions (implement these in your backend)
async function fetchTenantContext(tenantId: string) {
  // Call MAIS API to get tenant info
  throw new Error('Implement: fetch from MAIS backend');
}

async function publishToPreviewPanel(sessionId: string, data: any) {
  // Push to WebSocket
  throw new Error('Implement: WebSocket publish');
}

async function logToolCall(tenantId: string, toolName: string, args: any) {
  // Audit logging
  console.log(`[AUDIT] tenant=${tenantId} tool=${toolName}`, args);
}

async function trackMediaCost(tenantId: string, toolName: string, response: any) {
  // Cost tracking for billing
  throw new Error('Implement: cost tracking');
}
```

---

### 4.2 [COPY/PASTE] ReflectAndRetry Plugin (Resilience)

Save as `server/src/agent-v2/plugins/reflect-retry.ts`:

```typescript
import { BasePlugin, PluginContext } from '@google/adk';

interface ReflectAndRetryConfig {
  maxRetries: number;
  reflectionPrompt: string;
}

/**
 * Self-healing plugin that retries failed operations with reflection.
 *
 * From Gemini guidance: "This prevents the Orchestrator from crashing
 * if a sub-agent fails."
 */
export class ReflectAndRetryPlugin extends BasePlugin {
  private config: ReflectAndRetryConfig;
  private retryCount: Map<string, number> = new Map();

  constructor(config: ReflectAndRetryConfig) {
    super();
    this.config = config;
  }

  async onToolError(context: PluginContext, error: Error, toolName: string, args: any) {
    const callId = `${context.session.id}:${toolName}:${JSON.stringify(args)}`;
    const currentRetries = this.retryCount.get(callId) || 0;

    if (currentRetries >= this.config.maxRetries) {
      this.retryCount.delete(callId);
      // Return graceful failure instead of throwing
      return {
        success: false,
        error: 'Operation failed after retries',
        fallback_suggestion: this.generateFallbackSuggestion(toolName, error),
      };
    }

    this.retryCount.set(callId, currentRetries + 1);

    // Log for debugging
    console.warn(
      `[ReflectAndRetry] Attempt ${currentRetries + 1}/${this.config.maxRetries} for ${toolName}`,
      error.message
    );

    // Return instruction to retry with reflection
    return {
      retry: true,
      reflection: this.config.reflectionPrompt.replace('{error}', error.message),
    };
  }

  private generateFallbackSuggestion(toolName: string, error: Error): string {
    // Tool-specific fallback suggestions
    const fallbacks: Record<string, string> = {
      generate_image: 'Try a simpler prompt or different style',
      generate_video: 'Try a shorter duration or simpler scene',
      search_competitors: 'Try a different search term or location',
      scrape_pricing: 'The competitor site may be blocking - try another competitor',
    };

    return fallbacks[toolName] || 'Try a different approach';
  }
}

// Factory function for easy use
export function createReflectAndRetryPlugin() {
  return new ReflectAndRetryPlugin({
    maxRetries: 3,
    reflectionPrompt: `The previous attempt failed with: {error}

Analyze what went wrong and adjust your approach:
1. Were the parameters too complex?
2. Was there a rate limit or quota issue?
3. Should you try a simpler alternative?

Retry with corrected parameters.`,
  });
}
```

---

### 4.3 [COPY/PASTE] A2A Server Wrapper

Save as `server/src/agent-v2/transport/a2a-server.ts`:

```typescript
import { A2AServer } from '@google/adk/transport';
import { LlmAgent } from '@google/adk';

interface A2AServerConfig {
  agent: LlmAgent;
  port: number;
  tenantIsolation: boolean;
}

/**
 * Wraps an agent to expose it as an A2A endpoint.
 *
 * Other agents can discover and invoke this agent via the A2A protocol.
 */
export function createA2AServer(config: A2AServerConfig): A2AServer {
  const server = new A2AServer({
    agent: config.agent,
    port: config.port,

    // Middleware for tenant isolation
    middleware: [
      async (request, next) => {
        if (config.tenantIsolation) {
          // Validate tenant context is present
          const tenantId = request.metadata?.tenantId;
          if (!tenantId) {
            throw new Error('A2A request missing tenantId - rejected for security');
          }

          // Inject into session state
          request.sessionState = {
            ...request.sessionState,
            tenantId,
          };
        }

        return next(request);
      },
    ],
  });

  return server;
}

// Example: Expose Marketing Agent as A2A endpoint
// import { marketingAgent } from '../agents/marketing/marketing-agent';
//
// const marketingServer = createA2AServer({
//   agent: marketingAgent,
//   port: 8081,
//   tenantIsolation: true,
// });
//
// marketingServer.start();
```

---

## Part 5: Corrected Project Hub Schema

### 5.1 [COPY/PASTE] Prisma Schema (with Data Integrity fixes)

Add to `server/prisma/schema.prisma`:

```prisma
// ============================================================================
// PROJECT HUB MODELS
// Addresses Data Integrity Guardian findings from enterprise review
// ============================================================================

model Project {
  id                  String           @id @default(cuid())
  tenantId            String           // CRITICAL: Multi-tenant isolation
  bookingId           String           @unique
  customerId          String
  status              ProjectStatus    @default(ACTIVE)

  // Optimistic locking for concurrent updates
  version             Int              @default(1)

  // Customer-visible preferences
  customerPreferences Json?

  // Tenant-only notes (never shown to customer)
  tenantNotes         Json?

  // Timestamps
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  // Relations
  tenant              Tenant           @relation(fields: [tenantId], references: [id])
  booking             Booking          @relation(fields: [bookingId], references: [id])
  events              ProjectEvent[]
  files               ProjectFile[]
  requests            ProjectRequest[]

  // Indexes for performance
  @@index([tenantId])
  @@index([customerId])
  @@index([status])
  @@index([tenantId, status]) // Compound for tenant dashboard queries
}

model ProjectEvent {
  id                 String           @id @default(cuid())
  tenantId           String           // CRITICAL: Was missing in original ERD
  projectId          String

  // Event sourcing fields
  version            Int              // Sequential version for ordering
  type               ProjectEventType
  actor              ProjectActor
  payload            Json

  // Visibility controls (dual-faced)
  visibleToCustomer  Boolean          @default(false)
  visibleToTenant    Boolean          @default(true)

  // Timestamps
  createdAt          DateTime         @default(now())

  // Relations
  project            Project          @relation(fields: [projectId], references: [id])

  // CRITICAL: Prevent duplicate events
  @@unique([projectId, version])

  // Indexes
  @@index([tenantId])
  @@index([projectId, createdAt])
  @@index([projectId, visibleToCustomer]) // Customer view queries
}

model ProjectFile {
  id                 String           @id @default(cuid())
  tenantId           String           // CRITICAL: Was missing in original ERD
  projectId          String

  // Upload metadata
  uploadedBy         ProjectActor
  filename           String
  mimeType           String
  sizeBytes          Int
  storageUrl         String

  // Integrity verification
  checksum           String?          // SHA-256 of file contents

  // Categorization
  category           FileCategory     @default(OTHER)

  // Soft delete support
  deletedAt          DateTime?

  // Timestamps
  createdAt          DateTime         @default(now())

  // Relations
  project            Project          @relation(fields: [projectId], references: [id])

  // Indexes
  @@index([tenantId])
  @@index([projectId, deletedAt]) // Active files query
  @@index([projectId, category])
}

model ProjectRequest {
  id                 String              @id @default(cuid())
  tenantId           String              // CRITICAL: Was missing in original ERD
  projectId          String

  // Request details
  type               RequestType
  status             RequestStatus       @default(PENDING)
  requestData        Json
  responseData       Json?

  // Resolution tracking
  handledBy          RequestHandler?
  resolvedAt         DateTime?

  // CRITICAL: 72-hour expiry for escalations
  expiresAt          DateTime
  autoRespondedAt    DateTime?          // Set if expired and auto-responded

  // Timestamps
  createdAt          DateTime            @default(now())

  // Relations
  project            Project             @relation(fields: [projectId], references: [id])

  // Indexes
  @@index([tenantId])
  @@index([projectId, status])
  @@index([status, expiresAt]) // Expiry check job
  @@index([tenantId, status]) // Tenant dashboard pending requests
}

// ============================================================================
// ENUMS
// ============================================================================

enum ProjectStatus {
  ACTIVE
  COMPLETED
  CANCELLED
  ON_HOLD
}

enum ProjectEventType {
  // Lifecycle events
  PROJECT_CREATED
  STATUS_CHANGED

  // Communication events
  MESSAGE_FROM_CUSTOMER
  MESSAGE_FROM_TENANT
  MESSAGE_FROM_AGENT

  // Request events
  REQUEST_SUBMITTED
  REQUEST_APPROVED
  REQUEST_DENIED
  REQUEST_AUTO_HANDLED
  REQUEST_EXPIRED

  // File events
  FILE_UPLOADED
  FILE_DELETED

  // Milestone events
  MILESTONE_COMPLETED
  REMINDER_SENT
}

enum ProjectActor {
  CUSTOMER
  TENANT
  AGENT
  SYSTEM
}

enum FileCategory {
  REFERENCE_PHOTO
  INSPIRATION
  CONTRACT
  INVOICE
  DELIVERABLE
  OTHER
}

enum RequestType {
  RESCHEDULE
  ADD_ON
  QUESTION
  CHANGE_REQUEST
  CANCELLATION
  REFUND
  OTHER
}

enum RequestStatus {
  PENDING
  APPROVED
  DENIED
  AUTO_HANDLED
  EXPIRED
}

enum RequestHandler {
  AGENT
  TENANT
  SYSTEM
}
```

---

### 5.2 [COPY/PASTE] Migration Command

After adding the schema, run:

```bash
cd server
npx prisma migrate dev --name add_project_hub_models
```

---

## Part 6: Memory Bank Configuration

### 6.1 [COPY/PASTE] Memory Topics for HANDLED

```python
# Save as agents/config/memory-topics.py
# Run this once during initial setup

from vertexai.types import (
    ManagedTopicEnum,
    MemoryBankCustomizationConfig,
    MemoryBankCustomizationConfigMemoryTopic as MemoryTopic,
    MemoryBankCustomizationConfigMemoryTopicManagedMemoryTopic as ManagedMemoryTopic,
    MemoryBankCustomizationConfigMemoryTopicCustomMemoryTopic as CustomMemoryTopic,
)

HANDLED_MEMORY_CONFIG = MemoryBankCustomizationConfig(
    memory_topics=[
        # ========================================
        # MANAGED TOPICS (Google-provided)
        # ========================================
        MemoryTopic(
            managed_memory_topic=ManagedMemoryTopic(
                managed_topic_enum=ManagedTopicEnum.USER_PREFERENCES
            )
        ),
        MemoryTopic(
            managed_memory_topic=ManagedMemoryTopic(
                managed_topic_enum=ManagedTopicEnum.KEY_CONVERSATION_DETAILS
            )
        ),

        # ========================================
        # CUSTOM TOPICS (HANDLED-specific)
        # ========================================

        # Brand identity - rarely changes
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="brand_identity",
                description="Business brand elements: voice, tone, target audience, unique value proposition, brand colors, style preferences. Only update when explicitly changed."
            )
        ),

        # Content preferences - changes over time
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="content_preferences",
                description="User's content style preferences: headline styles they like, copy tones they reject, image aesthetics they prefer, video styles they avoid."
            )
        ),

        # Operational context - changes frequently
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="operational_context",
                description="Current business focus: active promotions, seasonal offerings, upcoming events, temporary changes in availability."
            )
        ),

        # Past decisions - append-only
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="past_decisions",
                description="History of approved and rejected suggestions: headlines chosen, images selected, copy rejected with reasons. Use to avoid suggesting rejected options again."
            )
        ),

        # Research findings - refreshed periodically
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="research_findings",
                description="Market research results: competitor pricing, industry benchmarks, local market insights. Include date of research for staleness detection."
            )
        ),
    ]
)
```

---

### 6.2 [COPY/PASTE] Memory Bank Isolation Wrapper (TypeScript)

Save as `server/src/agent-v2/memory/isolated-memory-bank.ts`:

```typescript
import { VertexAiMemoryBankService } from '@google/adk/memory';

interface IsolatedMemoryConfig {
  projectId: string;
  location: string;
  agentEngineId: string;
}

/**
 * Wrapper around Memory Bank that enforces tenant isolation.
 *
 * CRITICAL: Addresses Security Sentinel finding CRITICAL-001
 * "Memory Bank semantic search could return memories from other tenants"
 *
 * Solution: Composite userId with tenantId prefix + post-retrieval validation
 */
export class IsolatedMemoryBank {
  private memoryService: VertexAiMemoryBankService;

  constructor(config: IsolatedMemoryConfig) {
    this.memoryService = new VertexAiMemoryBankService({
      project: config.projectId,
      location: config.location,
      agentEngineId: config.agentEngineId,
    });
  }

  /**
   * Retrieve memories with mandatory tenant isolation.
   */
  async retrieve(tenantId: string, userId: string, query: string, limit: number = 10) {
    // 1. Create composite key with tenant prefix
    const scopedUserId = `tenant:${tenantId}:user:${userId}`;

    // 2. Retrieve with scoped user ID
    const memories = await this.memoryService.retrieve({
      query,
      scope: { user_id: scopedUserId },
      limit: limit + 5, // Fetch extra for post-filtering
    });

    // 3. POST-RETRIEVAL VALIDATION (belt AND suspenders)
    const validatedMemories = memories.filter((memory) => {
      const memoryUserId = memory.metadata?.user_id;
      if (!memoryUserId) return false;

      // Verify tenant prefix matches
      const expectedPrefix = `tenant:${tenantId}:`;
      if (!memoryUserId.startsWith(expectedPrefix)) {
        // LOG SECURITY EVENT - this should NEVER happen
        console.error(`[SECURITY] Cross-tenant memory leak detected!`, {
          requestedTenant: tenantId,
          memoryUserId,
          memoryId: memory.id,
        });
        return false;
      }

      return true;
    });

    return validatedMemories.slice(0, limit);
  }

  /**
   * Store memory with mandatory tenant isolation.
   */
  async store(tenantId: string, userId: string, session: any) {
    const scopedUserId = `tenant:${tenantId}:user:${userId}`;

    // Inject tenant metadata into all memories
    await this.memoryService.addSessionToMemory(session, {
      metadata: {
        user_id: scopedUserId,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      },
    });
  }
}
```

---

## Part 7: Manual Steps Checklist

### [MANUAL] Steps You Must Complete in Google Cloud Console

Print this checklist and work through it:

```
PHASE 1: FOUNDATION (Do these FIRST)
=====================================

□ 1. Create Google Cloud Project
    Console: https://console.cloud.google.com/projectcreate
    Project Name: handled-ai-agents
    Note your Project ID: _______________________

□ 2. Enable Billing
    Console: https://console.cloud.google.com/billing
    Link billing account to project

□ 3. Run API Enable Commands (from Section 1.2)
    Where: Cloud Shell or local terminal
    Status: □ Completed

□ 4. Run Service Account Commands (from Section 1.3)
    Where: Cloud Shell or local terminal
    Status: □ Completed

□ 5. Run IAM Binding Commands (from Section 1.4)
    Where: Cloud Shell or local terminal
    Status: □ Completed

□ 6. Request Quota Increases (from Section 1.5)
    Console: https://console.cloud.google.com/iam-admin/quotas
    Status: □ Requested (takes 24-48 hours)

□ 7. Run Storage Bucket Commands (from Section 1.6)
    Where: Cloud Shell or local terminal
    Status: □ Completed


PHASE 2: AGENT BUILDER SETUP
============================

□ 8. Open Vertex AI Agent Builder
    Console: https://console.cloud.google.com/agent-builder

□ 9. Create Agent Engine Instance
    - Click "Create Agent"
    - Name: "handled-concierge"
    - Region: us-central1
    - Note the Agent Engine ID: _______________________

□ 10. Configure Memory Bank
    - In Agent settings, enable Memory Bank
    - Apply the memory topics from Section 6.1

□ 11. Visual Topology Verification (optional but recommended)
    - Use the Agent Designer drag-and-drop
    - Create Router node (Concierge)
    - Connect to placeholder Worker nodes
    - Test with simulator: "Get me the sales report"
    - Verify routing path lights up correctly


PHASE 3: DEPLOY AGENTS
======================

□ 12. Install ADK CLI
    npm install -g @google/adk-cli

□ 13. Authenticate
    gcloud auth application-default login

□ 14. Deploy Booking Agent (simplest, first)
    adk deploy agent_engine \
      --project=handled-ai-agents \
      --region=us-central1 \
      --staging_bucket=gs://handled-ai-agents-agent-staging \
      --display_name="Booking Agent" \
      booking_agent

□ 15. Test Booking Agent
    - Use Agent Builder chat interface
    - Test: "What services do you offer?"
    - Verify: Correct tenant data returned

□ 16. Deploy Remaining Agents (once booking works)
    - Marketing Specialist
    - Research Specialist
    - Image Specialist
    - Video Specialist
    - Storefront Specialist
    - Concierge Orchestrator (last, after specialists)


PHASE 4: INTEGRATION
====================

□ 17. Update MAIS Backend
    - Add environment variables:
      GOOGLE_CLOUD_PROJECT=handled-ai-agents
      GOOGLE_CLOUD_LOCATION=us-central1
      AGENT_ENGINE_ID=<from step 9>

□ 18. Run Prisma Migration
    cd server && npx prisma migrate dev --name add_project_hub_models

□ 19. Integration Test
    - Start MAIS dev environment
    - Test Concierge via dashboard
    - Verify delegation to specialists
    - Verify preview panel updates
```

---

## Part 8: Environment Variables

### 8.1 [COPY/PASTE] Add to `.env` Files

```bash
# server/.env (add these)
GOOGLE_CLOUD_PROJECT=handled-ai-agents
GOOGLE_CLOUD_LOCATION=us-central1
AGENT_ENGINE_ID=<your-agent-engine-id>
AGENT_STAGING_BUCKET=gs://handled-ai-agents-agent-staging
MEDIA_BUCKET=gs://handled-ai-agents-media

# Cost tracking thresholds
MEDIA_COST_WARN_PERCENT=80
MEDIA_COST_CRITICAL_PERCENT=95

# AgentOps (optional, for observability)
AGENTOPS_API_KEY=<your-agentops-key>
```

---

## Summary: What Claude Can Generate vs What You Do

| Task                  | Who                                      | Section   |
| --------------------- | ---------------------------------------- | --------- |
| gcloud CLI commands   | You run, Claude generates                | 1.2-1.6   |
| Agent Card JSON       | Claude generates, you save files         | 2.1-2.8   |
| System prompts        | Claude generates, you paste into console | 3.1       |
| TypeScript agent code | Claude generates, you review/deploy      | 4.1-4.3   |
| Prisma schema         | Claude generates, you run migration      | 5.1-5.2   |
| Memory config         | Claude generates, you apply in console   | 6.1-6.2   |
| Create GCP project    | You do manually                          | Checklist |
| Request quotas        | You do manually                          | Checklist |
| Enable Memory Bank    | You do manually                          | Checklist |
| Visual verification   | You do manually                          | Checklist |
| Deploy agents         | You run CLI commands                     | Checklist |

---

_Generated January 2026 - Integrates Gemini strategic guidance with MAIS enterprise review findings_
