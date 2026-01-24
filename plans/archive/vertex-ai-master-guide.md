# Vertex AI Master Guide for MAIS Implementation

**Version:** January 2026
**Purpose:** Reference document for implementing Google's Vertex AI ecosystem
**Status:** Implementation-ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Agent Development Kit (ADK)](#agent-development-kit-adk)
3. [Agent Engine](#agent-engine)
4. [Sessions & Memory Bank](#sessions--memory-bank)
5. [Imagen & Veo](#imagen--veo)
6. [Grounding & RAG](#grounding--rag)
7. [Security & Compliance](#security--compliance)
8. [Pricing & Quotas](#pricing--quotas)
9. [Common Pitfalls](#common-pitfalls)
10. [Quick Reference](#quick-reference)

---

## Executive Summary

Google's Vertex AI ecosystem in 2026 provides a comprehensive platform for building production-ready AI agents. Key components:

| Component            | Purpose                         | Status (Jan 2026)                 |
| -------------------- | ------------------------------- | --------------------------------- |
| **ADK**              | Agent development framework     | GA (Python, TypeScript, Go, Java) |
| **Agent Engine**     | Production deployment & scaling | GA                                |
| **Sessions**         | Short-term conversation memory  | GA                                |
| **Memory Bank**      | Long-term personalization       | GA (billing starts Jan 28, 2026)  |
| **Gemini 3**         | Foundation models (Pro, Flash)  | GA                                |
| **Imagen 3 / Veo 2** | Image and video generation      | GA                                |
| **RAG Engine**       | Retrieval-augmented generation  | GA                                |

**Critical Dates:**

- **January 28, 2026:** Sessions, Memory Bank, and Code Execution begin charging for usage

---

## Agent Development Kit (ADK)

### Overview

ADK is Google's open-source, code-first framework for building AI agents. It treats agent development as software development, with full support for testing, versioning, and CI/CD.

**Official Resources:**

- [ADK Documentation](https://google.github.io/adk-docs/)
- [TypeScript SDK (adk-js)](https://github.com/google/adk-js)
- [Python SDK (adk-python)](https://github.com/google/adk-python)
- [Samples Repository](https://github.com/google/adk-samples)

### TypeScript SDK Installation

```bash
npm install @google/adk @google/adk-devtools @google/genai
```

### TypeScript vs Python Comparison

| Feature           | TypeScript              | Python                    |
| ----------------- | ----------------------- | ------------------------- |
| Package           | `@google/adk`           | `google-adk`              |
| Tools Location    | `@google/adk`           | `agents.tools`            |
| Schema Validation | Zod                     | Pydantic                  |
| Runner            | `InMemoryRunner`        | `Runner`                  |
| Typing            | Native TypeScript       | Type hints                |
| Model Config      | `generateContentConfig` | `generate_content_config` |

**When to choose TypeScript:**

- Frontend integration with React/Next.js
- Existing Node.js infrastructure
- Strong typing requirements
- Shared types with web application

**When to choose Python:**

- Data science workflows
- More mature ecosystem (as of Jan 2026)
- Jupyter notebook prototyping
- ML/AI team familiarity

### Core Agent Types

```typescript
import { LlmAgent, SequentialAgent, ParallelAgent, LoopAgent, BaseAgent } from '@google/adk';
```

| Agent Type        | Purpose                  | Use Case                          |
| ----------------- | ------------------------ | --------------------------------- |
| `LlmAgent`        | Single LLM-powered agent | Basic Q&A, tool calling           |
| `SequentialAgent` | Run agents in order      | Pipelines (research -> summarize) |
| `ParallelAgent`   | Run agents concurrently  | Multi-perspective analysis        |
| `LoopAgent`       | Iterative refinement     | Code review cycles                |
| `BaseAgent`       | Custom orchestration     | Complex workflows                 |

### Basic Agent Setup (TypeScript)

```typescript
import { LlmAgent, InMemoryRunner, GOOGLE_SEARCH } from '@google/adk';
import { createUserContent } from '@google/genai';

// 1. Define the agent
const rootAgent = new LlmAgent({
  name: 'customer_assistant',
  description: 'A helpful customer service assistant',
  model: 'gemini-3-flash', // Or 'gemini-3-pro' for complex reasoning
  instruction: `You are a helpful customer service agent for HANDLED.
    Answer questions about packages, bookings, and services.
    Use tools when you need current information.`,
  tools: [GOOGLE_SEARCH],
  generateContentConfig: {
    temperature: 0.7,
    maxOutputTokens: 2048,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
});

// 2. Create the runner
const runner = new InMemoryRunner({
  appName: 'mais-customer-agent',
  agent: rootAgent,
});

// 3. Create a session
const session = await runner.sessionService.createSession({
  appName: 'mais-customer-agent',
  userId: 'user-123',
  sessionId: 'session-456',
});

// 4. Run the agent
for await (const event of runner.runAsync({
  userId: 'user-123',
  sessionId: 'session-456',
  newMessage: createUserContent('What packages do you offer?'),
})) {
  if (event.content?.parts?.length) {
    console.log(`[${event.author}]:`, event.content.parts[0].text);
  }
}
```

### Creating Custom Tools

```typescript
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

// Custom tool with Zod validation
const getPackagesTool = new FunctionTool({
  name: 'get_packages',
  description: 'Retrieves available service packages for a tenant',
  parameters: z.object({
    tenantId: z.string().describe('The tenant identifier'),
    category: z.string().optional().describe('Package category filter'),
  }),
  execute: async ({ tenantId, category }) => {
    // CRITICAL: Always scope by tenantId
    const packages = await prisma.package.findMany({
      where: {
        tenantId, // Multi-tenant isolation
        active: true,
        ...(category && { category }),
      },
    });
    return { packages, count: packages.length };
  },
});
```

### Multi-Agent Orchestration Patterns

#### Sequential Pipeline

```typescript
import { SequentialAgent, LlmAgent } from '@google/adk';

const researchAgent = new LlmAgent({
  name: 'researcher',
  model: 'gemini-3-flash',
  instruction: 'Research the topic and gather information.',
  outputKey: 'research_results', // Saves to session state
  tools: [GOOGLE_SEARCH],
});

const summarizerAgent = new LlmAgent({
  name: 'summarizer',
  model: 'gemini-3-flash',
  instruction: 'Summarize the research findings from {research_results}.',
  outputKey: 'summary',
});

const pipeline = new SequentialAgent({
  name: 'research_pipeline',
  subAgents: [researchAgent, summarizerAgent],
});
```

#### Parallel Analysis

```typescript
import { ParallelAgent, SequentialAgent, LlmAgent } from '@google/adk';

// Multiple perspectives analyzed simultaneously
const optimistAgent = new LlmAgent({
  name: 'optimist',
  instruction: 'Analyze from an optimistic perspective.',
  outputKey: 'optimist_view',
});

const realistAgent = new LlmAgent({
  name: 'realist',
  instruction: 'Analyze from a realistic perspective.',
  outputKey: 'realist_view',
});

const parallelAnalysis = new ParallelAgent({
  name: 'perspectives',
  subAgents: [optimistAgent, realistAgent],
});

const synthesizer = new LlmAgent({
  name: 'synthesizer',
  instruction: 'Combine views from {optimist_view} and {realist_view}.',
});

const fullPipeline = new SequentialAgent({
  name: 'full_analysis',
  subAgents: [parallelAnalysis, synthesizer],
});
```

#### Iterative Refinement Loop

```typescript
import { LoopAgent, LlmAgent, BaseAgent, InvocationContext } from '@google/adk';
import type { Event } from '@google/genai';

// Custom agent to check completion condition
class QualityChecker extends BaseAgent {
  async *runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    const status = ctx.session.state['quality_status'];
    const shouldStop = status === 'approved';

    yield {
      id: 'check-event',
      author: this.name,
      actions: { escalate: shouldStop }, // Exits loop when true
      timestamp: Date.now(),
    };
  }
}

const drafterAgent = new LlmAgent({
  name: 'drafter',
  instruction: 'Draft or improve the content based on feedback.',
  outputKey: 'current_draft',
});

const reviewerAgent = new LlmAgent({
  name: 'reviewer',
  instruction: 'Review {current_draft}. Output "approved" or feedback.',
  outputKey: 'quality_status',
});

const refinementLoop = new LoopAgent({
  name: 'refinement',
  maxIterations: 5,
  subAgents: [drafterAgent, reviewerAgent, new QualityChecker({ name: 'checker' })],
});
```

### Agent Callbacks

```typescript
const monitoredAgent = new LlmAgent({
  name: 'monitored_agent',
  model: 'gemini-3-flash',
  instruction: 'You are a helpful assistant.',

  // Before model call - modify request or return early
  beforeModelCallback: async ({ context, request }) => {
    console.log('Model request:', request.contents);
    // Return undefined to continue, or return response to skip model
    return undefined;
  },

  // After model call - process or modify response
  afterModelCallback: async ({ context, response }) => {
    console.log('Model response:', response.content);
    return undefined; // Use original response
  },

  // Before tool execution
  beforeToolCallback: async ({ tool, args, context }) => {
    console.log(`Calling tool ${tool.name} with:`, args);
    // MAIS: Log all tool calls for audit
    await logger.info('tool_call', {
      tool: tool.name,
      args,
      tenantId: context.session.state.tenantId,
    });
    return undefined;
  },

  // After tool execution
  afterToolCallback: async ({ tool, args, context, response }) => {
    console.log(`Tool ${tool.name} returned:`, response);
    return undefined;
  },
});
```

### Structured Output with Schemas

```typescript
import { Type } from '@google/genai';

const dataExtractor = new LlmAgent({
  name: 'data_extractor',
  model: 'gemini-3-flash',
  instruction: 'Extract contact information from user messages.',
  outputSchema: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Person name' },
      email: { type: Type.STRING, description: 'Email address' },
      phone: { type: Type.STRING, description: 'Phone number' },
      company: { type: Type.STRING, description: 'Company name' },
    },
    required: ['name'],
  },
});

// NOTE: Agents with outputSchema cannot use tools or transfer to other agents
```

---

## Agent Engine

### Overview

[Agent Engine](https://docs.cloud.google.com/agent-builder/agent-engine/overview) is Google's managed service for deploying and scaling AI agents in production. It handles infrastructure, scaling, and monitoring.

### Deployment Options

```bash
# Deploy using ADK CLI (simplest)
PROJECT_ID=your-project-id
LOCATION=us-central1
GCS_BUCKET=gs://your-staging-bucket

adk deploy agent_engine \
  --project=$PROJECT_ID \
  --region=$LOCATION \
  --staging_bucket=$GCS_BUCKET \
  --display_name="MAIS Customer Agent" \
  customer_agent
```

### Programmatic Deployment (Python)

```python
import vertexai

client = vertexai.Client(
    project="PROJECT_ID",
    location="us-central1"
)

# Deploy the agent
remote_agent = client.agent_engines.create(
    agent=local_agent,
    config={
        "staging_bucket": "gs://your-bucket",
        "requirements": ["google-cloud-aiplatform[agent_engines,adk]"],
        "display_name": "MAIS Customer Agent",
        "description": "Customer service agent for MAIS platform",

        # Resource configuration
        "min_instances": 1,      # Minimum running instances
        "max_instances": 10,     # Maximum scaling
        "resource_limits": {
            "cpu": "4",          # 1, 2, 4, 6, or 8
            "memory": "8Gi"      # 1Gi to 32Gi
        },
        "container_concurrency": 9,  # Recommended: 2 * cpu + 1

        # Optional: Custom service account
        "service_account": "agent-sa@project.iam.gserviceaccount.com",
    },
)

print(f"Deployed: {remote_agent.api_resource.name}")
```

### Scaling Best Practices

**Cold Start Mitigation:**

| Scenario                  | Cold Start Latency | Warm Latency |
| ------------------------- | ------------------ | ------------ |
| Default (min_instances=1) | ~4.7 seconds       | ~0.4 seconds |
| Scaled (min_instances=10) | ~4.7 seconds       | ~0.4 seconds |

```python
# Optimal configuration for high-traffic scenarios
config={
    "min_instances": 5,          # Keeps instances warm
    "max_instances": 50,
    "resource_limits": {"cpu": "4", "memory": "8Gi"},
    "container_concurrency": 9,  # 2 * 4 + 1
}
```

**Traffic Pattern Recommendations:**

- Use a queue to send stable, continuous, predictable loads
- Sustained load of 1,500 QPM with min_instances=10 yields ~1.6s average latency
- Avoid burst traffic patterns which trigger cold starts

### Querying Deployed Agents

```python
# Streaming query (recommended for chat UX)
async for event in remote_agent.async_stream_query(
    user_id="user-123",
    message="What packages are available?",
):
    print(event)

# Non-streaming query
response = remote_agent.query(
    user_id="user-123",
    message="What packages are available?",
)
```

### Monitoring

```bash
# List available metrics
gcurl https://monitoring.googleapis.com/v3/projects/PROJECT_ID/metricDescriptors?filter='metric.type=starts_with("aiplatform.googleapis.com/reasoning_engine")'

# Key metrics:
# - aiplatform.googleapis.com/reasoning_engine/request_count
# - aiplatform.googleapis.com/reasoning_engine/request_latencies
```

### Management Operations

```python
# List all deployed agents
for agent in client.agent_engines.list():
    print(agent)

# Get specific agent
agent = client.agent_engines.get(
    name="projects/PROJECT/locations/LOCATION/reasoningEngines/RESOURCE_ID"
)

# Update agent
client.agent_engines.update(
    name=resource_name,
    agent=updated_agent,
    config={
        "display_name": "Updated Name",
        "min_instances": 2,
    },
)

# Delete agent
agent.delete(force=True)  # force=True if has sessions/memory
```

---

## Sessions & Memory Bank

### Sessions (Short-term Memory)

Sessions store conversation history within a single interaction.

```python
from google.adk.sessions import VertexAiSessionService

session_service = VertexAiSessionService(
    project="PROJECT_ID",
    location="us-central1",
    agent_engine_id="AGENT_ENGINE_ID"
)

# Create session
session = await session_service.create_session(
    app_name="mais-agent",
    user_id="user-123"
)

# Get session
session = await session_service.get_session(
    app_name="mais-agent",
    user_id="user-123",
    session_id=session.id
)
```

### Memory Bank (Long-term Memory)

[Memory Bank](https://docs.cloud.google.com/agent-builder/agent-engine/memory-bank/overview) provides persistent, cross-session memory for personalized agent experiences.

**Key Features:**

- Automatic memory extraction from conversations
- Semantic search for relevant memories
- Memory consolidation (deduplication, contradiction resolution)
- Scoped by user ID for multi-tenant isolation

#### Setup Memory Bank

```python
from google.adk.memory import VertexAiMemoryBankService
import vertexai

client = vertexai.Client(
    project="PROJECT_ID",
    location="us-central1"
)

# Create Agent Engine with Memory Bank
agent_engine = client.agent_engines.create()

# Initialize Memory Service
memory_service = VertexAiMemoryBankService(
    project="PROJECT_ID",
    location="us-central1",
    agent_engine_id=agent_engine.api_resource.name.split("/")[-1]
)
```

#### Configure Memory Topics

```python
from vertexai.types import (
    ManagedTopicEnum,
    MemoryBankCustomizationConfig as CustomizationConfig,
    MemoryBankCustomizationConfigMemoryTopic as MemoryTopic,
    MemoryBankCustomizationConfigMemoryTopicManagedMemoryTopic as ManagedMemoryTopic,
    MemoryBankCustomizationConfigMemoryTopicCustomMemoryTopic as CustomMemoryTopic,
)

# Configure what memories to extract
customization_config = CustomizationConfig(
    memory_topics=[
        # Managed topics (predefined)
        MemoryTopic(
            managed_memory_topic=ManagedMemoryTopic(
                managed_topic_enum=ManagedTopicEnum.USER_PERSONAL_INFO
            )
        ),
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

        # Custom topics specific to MAIS
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="booking_preferences",
                description="User preferences for bookings: preferred times, locations, service types, special requirements."
            )
        ),
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="service_history",
                description="Past services used, feedback, and recurring requests."
            )
        ),
    ]
)
```

#### Generate and Retrieve Memories

```python
# Trigger memory generation after conversation
async def save_memories(session):
    # Refresh session to get all events
    session = await session_service.get_session(
        app_name="mais-agent",
        user_id="user-123",
        session_id=session.id
    )

    # Generate memories
    await memory_service.add_session_to_memory(session)

# Retrieve memories for personalization
memories = client.agent_engines.memories.retrieve(
    name=agent_engine.api_resource.name,
    query="What are the user's booking preferences?",
    scope={"user_id": "user-123"}
)

# Use in agent instruction
from jinja2 import Template

template = Template("""
<USER_CONTEXT>
{% for memory in memories %}
- {{ memory.memory.fact }}
{% endfor %}
</USER_CONTEXT>

You are a helpful assistant. Use the user context above to personalize your responses.
""")

personalized_instruction = template.render(memories=list(memories))
```

### Multi-Tenant Memory Isolation

**CRITICAL:** All memory operations MUST be scoped by user_id to prevent data leakage.

```python
# CORRECT - Scoped by user_id
memories = client.agent_engines.memories.retrieve(
    name=agent_engine.api_resource.name,
    scope={"user_id": f"tenant_{tenant_id}:user_{user_id}"}  # Composite key
)

# WRONG - Could leak cross-tenant data
memories = client.agent_engines.memories.retrieve(
    name=agent_engine.api_resource.name,
    scope={"user_id": user_id}  # Missing tenant isolation
)
```

### IAM Conditions for Memory Access

```json
{
  "members": ["serviceAccount:mais-agent@project.iam.gserviceaccount.com"],
  "role": "roles/aiplatform.memoryViewer",
  "condition": {
    "title": "Tenant-scoped memory access",
    "expression": "api.getAttribute('aiplatform.googleapis.com/memoryScope', {})['user_id'].startsWith('tenant_')"
  }
}
```

---

## Imagen & Veo

### Imagen 3 (Image Generation)

[Imagen 3 Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/responsible-ai-imagen)

```typescript
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: 'your-project',
  location: 'us-central1',
});

// Generate image
const request = {
  prompt:
    'A professional photograph of a cozy coffee shop interior, warm lighting, minimalist design',

  // Safety configuration
  safetyFilterLevel: 'block_some', // "block_most", "block_some", "block_few"
  personGeneration: 'allow_adult', // "allow_all", "allow_adult", "dont_allow"

  // Generation parameters
  aspectRatio: '16:9',
  numberOfImages: 4,
};
```

### Veo 2 (Video Generation)

[Veo Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)

```python
# Generate video from text
response = client.models.generate_video(
    model="veo-002",
    prompt="A timelapse of a flower blooming in golden hour light",

    # Safety settings
    person_safety_setting="allow_adult",
    negative_prompt="blurry, low quality, distorted",

    # Video parameters
    duration_seconds=8,
    aspect_ratio="16:9",
)
```

### Safety Features

| Feature                   | Imagen 3              | Veo 2                   |
| ------------------------- | --------------------- | ----------------------- |
| Safety Filters            | `safety_filter_level` | Built-in                |
| Person Generation Control | `person_generation`   | `person_safety_setting` |
| Negative Prompts          | N/A                   | `negative_prompt`       |
| SynthID Watermarking      | Automatic             | Automatic               |

**SynthID:** All generated content includes invisible digital watermarks for authenticity verification.

---

## Grounding & RAG

### Overview

[Grounding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview) connects LLM responses to verifiable sources, reducing hallucinations.

### Implementation Options

| Option               | Best For                        | Complexity |
| -------------------- | ------------------------------- | ---------- |
| **Vertex AI Search** | Enterprise, multi-source search | Low        |
| **RAG Engine**       | Custom corpora, fine control    | Medium     |
| **DIY RAG**          | Maximum flexibility             | High       |

### Grounding with Vertex AI Search

```typescript
const vertexAIRetrievalTool = {
  retrieval: {
    vertexAiSearch: {
      datastore:
        'projects/PROJECT/locations/LOCATION/collections/default_collection/dataStores/DATASTORE_ID',
    },
    disableAttribution: false,
  },
};

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: 'What are our refund policies?' }] }],
  tools: [vertexAIRetrievalTool],
});

// Access grounding metadata
const groundingMetadata = result.response.candidates[0].groundingMetadata;
console.log('Sources:', groundingMetadata.groundingChunks);
```

### Grounding with Google Search

```typescript
const googleSearchRetrievalTool = {
  googleSearchRetrieval: {
    disableAttribution: false,
  },
};

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: 'What is the current weather in San Francisco?' }] }],
  tools: [googleSearchRetrievalTool],
});
```

### RAG Engine

```python
from vertexai.preview.rag import RagCorpus, RagFile

# Create corpus
corpus = RagCorpus.create(
    display_name="mais-knowledge-base",
    description="MAIS documentation and policies"
)

# Add documents
rag_file = RagFile.create(
    corpus=corpus,
    path="gs://bucket/documents/",
    display_name="Policy documents"
)

# Query with RAG
response = model.generate_content(
    "What is our cancellation policy?",
    tools=[corpus.as_tool()],
)
```

### Check Grounding API

Validate how grounded a response is:

```python
from vertexai.preview import grounding

result = grounding.check_grounding(
    answer_candidate="Our refund policy allows returns within 30 days.",
    facts=[
        "Customers can request refunds within 30 days of purchase.",
        "Digital products are non-refundable.",
    ]
)

print(f"Support score: {result.support_score}")  # 0-1
print(f"Citations: {result.cited_chunks}")
```

---

## Security & Compliance

### VPC Service Controls

[VPC-SC Documentation](https://docs.cloud.google.com/vertex-ai/docs/general/vpc-service-controls)

```python
# Deploy with VPC Service Controls
remote_agent = client.agent_engines.create(
    agent=local_agent,
    config={
        "psc_interface_config": {
            "network_attachment": "projects/PROJECT/regions/REGION/networkAttachments/ATTACHMENT",
            "dns_peering_configs": [
                {
                    "domain": "internal.mais.com",
                    "target_project": "PROJECT_ID",
                    "target_network": "vpc-network",
                },
            ],
        },
    },
)
```

**VPC-SC Behavior:**

- Without VPC-SC: Google-managed environment has internet access
- With VPC-SC: Internet access blocked; requires explicit egress configuration

### IAM Best Practices

```terraform
# Service account for agents
resource "google_service_account" "agent_sa" {
  account_id   = "mais-agent-sa"
  display_name = "MAIS Agent Service Account"
}

# Minimum required roles
resource "google_project_iam_member" "agent_roles" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/storage.objectViewer",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.agent_sa.email}"
}

# Memory access with conditions
resource "google_project_iam_binding" "memory_access" {
  project = var.project_id
  role    = "roles/aiplatform.memoryUser"
  members = ["serviceAccount:${google_service_account.agent_sa.email}"]

  condition {
    title      = "tenant_scoped"
    expression = "api.getAttribute('aiplatform.googleapis.com/memoryScope', {})['user_id'].startsWith('tenant_${var.tenant_id}')"
  }
}
```

### Audit Logging

All agent operations are logged to Cloud Logging:

```python
# Custom logging in agent
import google.cloud.logging

client = google.cloud.logging.Client()
logger = client.logger("mais-agent-audit")

logger.log_struct({
    "event": "tool_execution",
    "tool": "get_packages",
    "tenant_id": tenant_id,
    "user_id": user_id,
    "timestamp": datetime.now().isoformat(),
})
```

### Agent Engine Threat Detection (Preview)

Built-in Security Command Center integration detects:

- Prompt injection attempts
- Data exfiltration patterns
- Unauthorized access attempts

---

## Pricing & Quotas

### Pricing (As of January 2026)

| Component                | Cost                                       |
| ------------------------ | ------------------------------------------ |
| **Agent Engine Runtime** | $0.00994/vCPU-hour, $0.0105/GiB-hour       |
| **Sessions**             | Billing starts Jan 28, 2026                |
| **Memory Bank**          | Billing starts Jan 28, 2026                |
| **Gemini 3 Flash**       | $0.50/1M input tokens, $3/1M output tokens |
| **Gemini 3 Pro**         | See pricing page for current rates         |

### Free Tier

- **Vertex AI Express Mode:** Up to 10 agent engines, 90 days
- **New Users:** $300 credits valid for 90 days

### Quotas

```bash
# Check current quotas
gcloud ml-engine quotas describe --project=PROJECT_ID

# Request quota increase
gcloud alpha services quotas update \
  --service=aiplatform.googleapis.com \
  --consumer=projects/PROJECT_ID \
  --metric=aiplatform.googleapis.com/agent_engine_concurrent_requests \
  --unit=1/d/{project}/{region} \
  --value=1000
```

**Key Limits:**

- Default concurrent requests: Varies by region
- Maximum instances per agent: 100 (can be increased)
- Memory per instance: 1-32 GiB
- CPU per instance: 1-8 vCPUs

### Regional Availability

| Region       | Agent Engine | Memory Bank | RAG Engine |
| ------------ | ------------ | ----------- | ---------- |
| us-central1  | GA           | GA          | Allowlist  |
| us-east4     | GA           | GA          | Allowlist  |
| europe-west1 | GA           | GA          | GA         |
| asia-east1   | GA           | GA          | GA         |

---

## Common Pitfalls

### 1. Missing Tenant Scoping in Memory Operations

```typescript
// WRONG
const memories = await memoryService.retrieve({ userId: user.id });

// CORRECT - Include tenant isolation
const memories = await memoryService.retrieve({
  scope: { user_id: `tenant:${tenantId}:user:${user.id}` },
});
```

### 2. Cold Start Impact on Latency

```python
# WRONG - Single instance, high latency on bursts
config={"min_instances": 1}

# CORRECT - Multiple instances for production
config={
    "min_instances": 5,
    "max_instances": 50,
    "container_concurrency": 9,
}
```

### 3. Ignoring Safety Filter Responses

```typescript
// Always handle safety filter blocks
try {
  const result = await model.generateContent(request);
  if (result.response.promptFeedback?.blockReason) {
    logger.warn('Content blocked', {
      reason: result.response.promptFeedback.blockReason,
    });
    return { error: 'Unable to process this request' };
  }
} catch (error) {
  if (error.message.includes('SAFETY')) {
    return { error: 'Content policy violation' };
  }
  throw error;
}
```

### 4. Not Triggering Memory Generation

```python
# WRONG - Memory won't be saved
await call_agent(query, session_id, user_id)

# CORRECT - Explicitly trigger memory generation
await call_agent(query, session_id, user_id)

# After conversation ends
session = await session_service.get_session(...)
await memory_service.add_session_to_memory(session)
```

### 5. VPC-SC Without Egress Configuration

```python
# WRONG - Agent can't reach external services
config={}  # With project in VPC-SC perimeter

# CORRECT - Configure PSC for external access
config={
    "psc_interface_config": {
        "network_attachment": "...",
        "dns_peering_configs": [...]
    }
}
```

### 6. Using outputSchema with Tools

```typescript
// WRONG - Will fail silently
const agent = new LlmAgent({
  outputSchema: { ... },
  tools: [myTool],  // NOT ALLOWED with outputSchema
});

// CORRECT - Choose one or the other
const extractorAgent = new LlmAgent({ outputSchema: { ... } });
const toolAgent = new LlmAgent({ tools: [myTool] });
```

### 7. Hardcoding Model Names

```typescript
// WRONG - Model names change
const agent = new LlmAgent({ model: 'gemini-2.0-flash' });

// CORRECT - Use configuration
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-flash';
const agent = new LlmAgent({ model: MODEL_NAME });
```

---

## Quick Reference

### Environment Variables

```bash
# Required
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Optional (auto-detected in Agent Engine)
GOOGLE_CLOUD_AGENT_ENGINE_ID=your-engine-id
```

### CLI Commands

```bash
# Create new agent project
adk create my_agent --language typescript

# Run locally
adk run my_agent

# Web UI for development
adk web my_agent

# Deploy to Agent Engine
adk deploy agent_engine \
  --project=PROJECT \
  --region=LOCATION \
  --staging_bucket=gs://BUCKET \
  my_agent
```

### Model Selection Guide

| Use Case                | Recommended Model | Context Window |
| ----------------------- | ----------------- | -------------- |
| Fast responses, chat    | gemini-3-flash    | 200K tokens    |
| Complex reasoning       | gemini-3-pro      | 1M tokens      |
| Code generation         | gemini-3-pro      | 1M tokens      |
| Large document analysis | gemini-3-pro      | 1M tokens      |

### Thinking Level (Gemini 3)

```typescript
const config = {
  thinkingLevel: 'medium', // minimal, low, medium, high
  // Higher = better quality, more reasoning, higher latency/cost
};
```

---

## Official Documentation Links

- [ADK Documentation](https://google.github.io/adk-docs/)
- [Agent Engine Overview](https://docs.cloud.google.com/agent-builder/agent-engine/overview)
- [Memory Bank](https://docs.cloud.google.com/agent-builder/agent-engine/memory-bank/overview)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing)
- [VPC Service Controls](https://docs.cloud.google.com/vertex-ai/docs/general/vpc-service-controls)
- [RAG Engine](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-engine/rag-overview)
- [Imagen Responsible AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/responsible-ai-imagen)
- [Veo Video Generation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)

---

_Last updated: January 2026_
