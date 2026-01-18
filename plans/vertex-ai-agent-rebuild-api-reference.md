# Vertex AI Agent Rebuild - API Reference

**Generated:** January 2026
**Purpose:** Detailed API documentation for technologies used in the Vertex AI Agent rebuild

---

## Table of Contents

1. [Google ADK (Agent Development Kit) - TypeScript](#1-google-adk-agent-development-kit---typescript)
2. [Vertex AI Sessions & Memory Bank](#2-vertex-ai-sessions--memory-bank)
3. [Imagen 3 API](#3-imagen-3-api)
4. [Veo 2 API](#4-veo-2-api)
5. [XState v5 Patterns](#5-xstate-v5-patterns)
6. [Cost Reference](#6-cost-reference)
7. [Error Handling Patterns](#7-error-handling-patterns)

---

## 1. Google ADK (Agent Development Kit) - TypeScript

### Installation

```bash
npm install @google/adk @google/genai zod
```

### Core Imports

```typescript
import {
  LlmAgent,
  SequentialAgent,
  ParallelAgent,
  FunctionTool,
  InMemoryRunner,
  Runner,
  InMemorySessionService,
  InMemoryMemoryService,
  InMemoryArtifactService,
  BasePlugin,
  CallbackContext,
  ToolContext,
  GOOGLE_SEARCH,
} from '@google/adk';
import { Content } from '@google/genai';
import { z } from 'zod';
```

### Agent Types

#### LlmAgent - Basic Configuration

```typescript
import { LlmAgent, GOOGLE_SEARCH } from '@google/adk';

const searchAgent = new LlmAgent({
  name: 'search_assistant',
  description: 'An assistant that can search the web.',
  model: 'gemini-2.5-flash', // Or 'gemini-2.0-pro'
  instruction:
    'You are a helpful assistant. Answer user questions using Google Search when needed.',
  tools: [GOOGLE_SEARCH],
});
```

#### LlmAgent - Full Configuration

```typescript
import { LlmAgent } from '@google/adk';

const configuredAgent = new LlmAgent({
  name: 'configured_agent',
  model: 'gemini-2.5-flash',
  description: 'A configured agent with all options.',

  // Instructions
  globalInstruction: 'You are friendly, professional, and use proper grammar.',
  instruction: 'You are a creative writing assistant.',

  // Generation config
  generateContentConfig: {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
    candidateCount: 1,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },

  // Tools and sub-agents
  tools: [customTool],
  subAgents: [specialistAgent1, specialistAgent2],

  // Output handling
  outputKey: 'agent_output', // Stores in session state
  outputSchema: {
    type: Type.OBJECT,
    properties: {
      result: { type: Type.STRING },
      confidence: { type: Type.NUMBER },
    },
  },

  // Callbacks
  beforeModelCallback: async ({ context, request }) => {
    console.log('About to call model');
    return undefined; // Continue to model
  },
  afterModelCallback: async ({ context, response }) => {
    console.log('Model responded');
    return undefined; // Use original response
  },
  beforeToolCallback: async ({ tool, args, context }) => {
    console.log(`Executing tool: ${tool.name}`);
    return undefined; // Proceed with execution
  },
  afterToolCallback: async ({ tool, args, context, response }) => {
    console.log(`Tool ${tool.name} returned`);
    return undefined; // Use original response
  },
});
```

### Multi-Agent Patterns

#### Sequential Workflow

```typescript
import { SequentialAgent, LlmAgent } from '@google/adk';

const researchAgent = new LlmAgent({
  name: 'researcher',
  model: 'gemini-2.5-flash',
  instruction: 'Research the topic and gather information.',
  tools: [GOOGLE_SEARCH],
});

const summarizerAgent = new LlmAgent({
  name: 'summarizer',
  model: 'gemini-2.5-flash',
  instruction: 'Summarize the research findings concisely.',
});

const workflowAgent = new SequentialAgent({
  name: 'research_workflow',
  description: 'Research and summarize workflow',
  subAgents: [researchAgent, summarizerAgent],
});
```

#### Parallel Workflow

```typescript
import { ParallelAgent, LlmAgent } from '@google/adk';

const optimisticAgent = new LlmAgent({
  name: 'optimist',
  model: 'gemini-2.5-flash',
  instruction: 'Analyze from an optimistic perspective.',
});

const realisticAgent = new LlmAgent({
  name: 'realist',
  model: 'gemini-2.5-flash',
  instruction: 'Analyze from a realistic perspective.',
});

const multiViewAgent = new ParallelAgent({
  name: 'multi_perspective',
  description: 'Generate multiple perspectives simultaneously',
  subAgents: [optimisticAgent, realisticAgent],
});
```

#### Hierarchical Routing (Hub-and-Spoke)

```typescript
import { LlmAgent } from '@google/adk';

// Specialist agents
const technicalAgent = new LlmAgent({
  name: 'technical_support',
  description: 'Handles technical questions about products.',
  model: 'gemini-2.5-flash',
  instruction: 'Provide technical support and troubleshooting help.',
});

const salesAgent = new LlmAgent({
  name: 'sales_support',
  description: 'Handles sales inquiries and pricing.',
  model: 'gemini-2.5-flash',
  instruction: 'Help with sales inquiries and product information.',
});

// Router/Concierge agent
const mainAgent = new LlmAgent({
  name: 'main_agent',
  description: 'Main routing agent that directs users to specialists.',
  model: 'gemini-2.5-flash',
  instruction: 'Greet users and route them to the appropriate specialist.',
  subAgents: [technicalAgent, salesAgent],
  // Agent automatically gets transfer_to_agent tool
});
```

### Custom Tools

#### FunctionTool with Zod Validation

```typescript
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

const getWeather = new FunctionTool({
  name: 'get_weather',
  description: 'Retrieves the current weather for a specified city.',
  parameters: z.object({
    city: z.string().describe('The name of the city'),
    units: z.enum(['celsius', 'fahrenheit']).optional().describe('Temperature units'),
  }),
  execute: async ({ city, units = 'celsius' }) => {
    // Implementation
    return {
      status: 'success',
      city,
      temperature: 25,
      units,
      conditions: 'sunny',
    };
  },
});
```

#### Stateful Tool (Class Instance)

```typescript
class Counter {
  count = 0;

  incrementBy({ amount }: { amount: number }) {
    this.count += amount;
    return { newCount: this.count, incremented: amount };
  }
}

const counter = new Counter();

const incrementTool = new FunctionTool({
  name: 'increment_counter',
  description: 'Increments a counter by the given amount.',
  parameters: z.object({
    amount: z.number().describe('Amount to increment by'),
  }),
  execute: counter.incrementBy.bind(counter),
});
```

#### Long-Running Tool

```typescript
import { LongRunningFunctionTool } from '@google/adk';
import { z } from 'zod';

const dataProcessingTool = new LongRunningFunctionTool({
  name: 'process_large_dataset',
  description: 'Process a large dataset asynchronously.',
  parameters: z.object({
    datasetId: z.string(),
  }),
  execute: async ({ datasetId }) => {
    const result = await processLargeDataset(datasetId);
    return { status: 'completed', recordsProcessed: result.count };
  },
});
```

### Session Management

#### InMemoryRunner (Development)

```typescript
import { InMemoryRunner, createPartFromText } from '@google/adk';

const runner = new InMemoryRunner({
  agent: rootAgent,
  appName: 'MyApp',
});

// Create or get session
const session = await runner.sessionService.getOrCreateSession({
  appName: 'MyApp',
  userId: 'user123',
  sessionId: 'session456',
});

// Run the agent
const userMessage = { parts: [createPartFromText('Hello!')] };

for await (const event of runner.runAsync({
  userId: 'user123',
  sessionId: 'session456',
  newMessage: userMessage,
})) {
  if (event.content) {
    console.log(`${event.author}: ${event.content.parts[0].text}`);
  }
}
```

#### Full Runner Configuration (Production)

```typescript
import {
  Runner,
  LlmAgent,
  InMemorySessionService,
  InMemoryArtifactService,
  InMemoryMemoryService,
  BaseCredentialService,
  LoggingPlugin,
} from '@google/adk';

class MyCredentialService extends BaseCredentialService {
  async getCredential(credentialName: string) {
    return { apiKey: process.env[credentialName] };
  }
}

const runner = new Runner({
  appName: 'ProductionApp',
  agent: mainAgent,
  sessionService: new InMemorySessionService(),
  artifactService: new InMemoryArtifactService(),
  memoryService: new InMemoryMemoryService(),
  credentialService: new MyCredentialService(),
  plugins: [new LoggingPlugin('app_logger')],
});

// Run with full configuration
for await (const event of runner.runAsync({
  userId: 'user123',
  sessionId: 'session456',
  newMessage: userMessage,
  stateDelta: { userPreference: 'detailed' },
  runConfig: {
    streamingMode: 'SSE',
    saveInputBlobsAsArtifacts: true,
  },
})) {
  // Process events
}
```

### Session State Management

```typescript
import { LlmAgent, ToolContext, CallbackContext } from '@google/adk';

// Reading state in instruction templates
const agent = new LlmAgent({
  name: 'state_aware_agent',
  model: 'gemini-2.5-flash',
  instruction: 'Help with topic: {topic}. User preference: {preference}.',
  // {topic} and {preference} are replaced from session.state
});

// Writing state in tool context
const myTool = new FunctionTool({
  name: 'my_tool',
  parameters: z.object({ data: z.string() }),
  execute: async ({ data }, toolContext: ToolContext) => {
    // Read state
    const count = toolContext.state.get('action_count', 0);

    // Update state
    toolContext.state.set('action_count', count + 1);
    toolContext.state.set('temp:last_operation', 'success');

    return { result: 'done' };
  },
});

// Using outputKey to save agent response
const greetingAgent = new LlmAgent({
  name: 'Greeter',
  model: 'gemini-2.5-flash',
  instruction: 'Generate a short greeting.',
  outputKey: 'last_greeting', // Saves to state['last_greeting']
});
```

### Plugins

#### Custom Monitoring Plugin

```typescript
import {
  BasePlugin,
  CallbackContext,
  LlmRequest,
  LlmResponse,
  InvocationContext,
} from '@google/adk';
import { Content } from '@google/genai';

class MonitoringPlugin extends BasePlugin {
  constructor() {
    super('monitoring_plugin');
  }

  async onUserMessageCallback({
    userMessage,
    invocationContext,
  }: {
    userMessage: Content;
    invocationContext: InvocationContext;
  }): Promise<Content | undefined> {
    console.log('User message received:', userMessage);
    return undefined; // Don't modify message
  }

  async beforeModelCallback({
    callbackContext,
    llmRequest,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
  }): Promise<LlmResponse | undefined> {
    console.log('Model call to:', llmRequest.model);
    return undefined;
  }

  async onModelErrorCallback({
    callbackContext,
    llmRequest,
    error,
  }: {
    callbackContext: CallbackContext;
    llmRequest: LlmRequest;
    error: Error;
  }): Promise<LlmResponse | undefined> {
    console.error('Model error:', error);
    return {
      content: { parts: [{ text: 'Service temporarily unavailable.' }] },
    };
  }
}

const runner = new InMemoryRunner({
  agent: myAgent,
  plugins: [new MonitoringPlugin()],
});
```

---

## 2. Vertex AI Sessions & Memory Bank

### TypeScript Types (for custom implementation)

```typescript
// Session Types
interface Session {
  appName: string;
  id: string;
  userId: string;
  events: Event[];
  state: Record<string, unknown>;
  lastUpdateTime: number;
}

interface CreateSessionRequest {
  appName: string;
  userId: string;
  sessionId?: string;
  state?: Record<string, unknown>;
}

interface GetSessionRequest {
  appName: string;
  sessionId: string;
  userId: string;
  config?: GetSessionConfig;
}

interface GetSessionConfig {
  afterTimestamp?: number;
  numRecentEvents?: number;
}

interface ListSessionsRequest {
  appName: string;
  userId: string;
}

interface DeleteSessionRequest {
  appName: string;
  sessionId: string;
  userId: string;
}

// Memory Types
interface SearchMemoryRequest {
  appName: string;
  userId: string;
  query: string;
}

interface SearchMemoryResponse {
  memories: Memory[];
}

interface Memory {
  name: string;
  fact: string;
  timestamp?: string;
}
```

### VertexAiSessionService (Python Reference)

```python
from google.adk.sessions import VertexAiSessionService

# Production session service with persistence
vertex_service = VertexAiSessionService(
    project="your-gcp-project-id",
    location="us-central1",
    storage_bucket="gs://your-session-bucket"  # Optional
)

# Create session
session = await vertex_service.create_session(
    app_name="my_app",
    user_id="user123",
    session_id="session456",
    state={"initial_key": "value"}
)

# Get session with events
session = await vertex_service.get_session(
    app_name="my_app",
    user_id="user123",
    session_id="session456"
)
```

### Memory Bank Configuration

#### Managed Memory Topics

```python
from vertexai.types import ManagedTopicEnum
from vertexai.types import MemoryBankCustomizationConfig as CustomizationConfig
from vertexai.types import MemoryBankCustomizationConfigMemoryTopic as MemoryTopic
from vertexai.types import MemoryBankCustomizationConfigMemoryTopicManagedMemoryTopic as ManagedMemoryTopic

# Available managed topics
# - ManagedTopicEnum.USER_PERSONAL_INFO
# - ManagedTopicEnum.USER_PREFERENCES
# - ManagedTopicEnum.KEY_CONVERSATION_DETAILS
# - ManagedTopicEnum.EXPLICIT_INSTRUCTIONS

customization_config = CustomizationConfig(
    memory_topics=[
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
    ]
)
```

#### Custom Memory Topics

```python
from vertexai.types import MemoryBankCustomizationConfigMemoryTopicCustomMemoryTopic as CustomMemoryTopic

customization_config = CustomizationConfig(
    memory_topics=[
        MemoryTopic(
            managed_memory_topic=ManagedMemoryTopic(
                managed_topic_enum=ManagedTopicEnum.USER_PERSONAL_INFO
            )
        ),
        MemoryTopic(
            custom_memory_topic=CustomMemoryTopic(
                label="business_feedback",
                description="""Specific user feedback about their business experience.
                This includes service reviews, feature requests, and improvement suggestions."""
            )
        )
    ]
)
```

### Memory Bank API Endpoints

#### Generate Memories

```
POST /v1beta/projects/{project}/locations/{location}/agents/{agent}/sessions/{session}:addMemory

Query Parameters:
- user_id (string) - Required
- app_name (string) - Required
```

#### Search Memories

```
POST /v1beta/projects/{project}/locations/{location}/agents/{agent}/sessions/{session}:searchMemory

Query Parameters:
- user_id (string) - Required
- app_name (string) - Required
- query (string) - Required

Response:
[
  {
    "memory": {
      "name": "projects/.../memories/...",
      "fact": "User prefers temperature at 71 degrees."
    },
    "distance": 0.5  // Similarity score
  }
]
```

### Multi-Tenant Isolation Pattern

```typescript
// Session creation with tenant scoping
const session = await sessionService.createSession({
  appName: 'handled_app',
  userId: `tenant:${tenantId}:user:${userId}`, // Composite key
  sessionId: sessionId,
  state: {
    tenantId,
    tenantSlug,
    subscriptionTier,
  },
});

// Memory Bank retrieval with tenant scope
const memories = await memoryService.searchMemory({
  appName: 'handled_app',
  userId: `tenant:${tenantId}`, // Scoped to tenant
  query: currentConversation,
});

// All tool calls include tenantId from session
const toolContext = {
  tenantId: session.state.tenantId,
  sessionId: session.id,
};
```

---

## 3. Imagen 3 API

### Supported Models

| Model ID                       | Use Case                        |
| ------------------------------ | ------------------------------- |
| `imagen-3.0-generate-002`      | Latest generation (recommended) |
| `imagen-3.0-generate-001`      | Previous generation             |
| `imagen-3.0-fast-generate-001` | Faster, lower cost              |
| `imagen-3.0-capability-001`    | Editing capabilities            |
| `imagen-4.0-generate-001`      | Newest version                  |

### REST API - Generate Images

```
POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_ID}:predict
```

#### Request Schema

```typescript
interface ImagenGenerateRequest {
  instances: Array<{
    prompt: string;
  }>;
  parameters: {
    sampleCount: number; // 1-4, required
    addWatermark?: boolean; // default: true (SynthID)
    aspectRatio?: '1:1' | '3:4' | '4:3' | '16:9' | '9:16';
    enhancePrompt?: boolean;
    language?: 'auto' | 'en' | 'zh' | 'zh-CN' | 'zh-TW' | 'hi' | 'ja' | 'ko' | 'pt' | 'es';
    negativePrompt?: string; // NOT supported in imagen-3.0-generate-002+
    outputOptions?: {
      mimeType?: 'image/png' | 'image/jpeg';
      compressionQuality?: number; // 0-100
    };
    personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
    safetySetting?:
      | 'block_low_and_above'
      | 'block_medium_and_above'
      | 'block_only_high'
      | 'block_none';
    seed?: number; // Incompatible with addWatermark: true
    storageUri?: string; // GCS bucket path for output
  };
}
```

#### Response Schema

```typescript
interface ImagenGenerateResponse {
  predictions: Array<{
    bytesBase64Encoded: string;
    mimeType: string;
    prompt?: string; // Enhanced prompt if applicable
    raiFilteredReason?: string;
    safetyAttributes?: {
      categories: string[];
      scores: number[];
    };
  }>;
}
```

### Python SDK

```python
from google import genai
from google.genai.types import GenerateImagesConfig

client = genai.Client()

# Generate images
response = client.models.generate_images(
    model="imagen-3.0-generate-002",
    prompt="A professional headshot of a business owner in a modern office",
    config=GenerateImagesConfig(
        number_of_images=4,
        aspect_ratio="1:1",
        output_mime_type="image/jpeg",
        safety_filter_level="block_medium_and_above",
        person_generation="allow_adult",
    )
)

# Access generated images
for image in response.generated_images:
    image_bytes = image.image.image_bytes
    # Save or process image
```

### TypeScript Implementation (Custom Wrapper)

```typescript
import { GoogleAuth } from 'google-auth-library';

interface ImagenConfig {
  projectId: string;
  location: string;
  model?: string;
}

interface GenerateImageParams {
  prompt: string;
  sampleCount?: number;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
  safetySetting?: string;
}

interface GeneratedImage {
  bytesBase64Encoded: string;
  mimeType: string;
}

class ImagenClient {
  private auth: GoogleAuth;
  private config: ImagenConfig;

  constructor(config: ImagenConfig) {
    this.config = {
      model: 'imagen-3.0-generate-002',
      ...config,
    };
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  async generateImages(params: GenerateImageParams): Promise<GeneratedImage[]> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.model}:predict`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt: params.prompt }],
        parameters: {
          sampleCount: params.sampleCount ?? 1,
          aspectRatio: params.aspectRatio ?? '1:1',
          personGeneration: params.personGeneration ?? 'allow_adult',
          safetySetting: params.safetySetting ?? 'block_medium_and_above',
          addWatermark: true,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Imagen API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.predictions.map((p: any) => ({
      bytesBase64Encoded: p.bytesBase64Encoded,
      mimeType: p.mimeType,
    }));
  }
}

// Usage
const imagenClient = new ImagenClient({
  projectId: 'my-project',
  location: 'us-central1',
});

const images = await imagenClient.generateImages({
  prompt: 'A modern photography studio with natural lighting',
  sampleCount: 2,
  aspectRatio: '16:9',
});
```

### Output Specifications

| Aspect Ratio | Resolution  | Use Case                           |
| ------------ | ----------- | ---------------------------------- |
| 1:1          | 1024 x 1024 | Profile images, thumbnails         |
| 16:9         | 1408 x 768  | Landscapes, presentations, headers |
| 9:16         | 768 x 1408  | Mobile, social stories             |
| 4:3          | 1280 x 896  | Traditional photos                 |
| 3:4          | 896 x 1280  | Portrait orientation               |

### Prompt Engineering Tips

```typescript
// Good prompt structure
const goodPrompt = `
A professional photograph of a ${businessType} workspace,
showing ${specificDetails},
with ${lightingStyle} lighting,
in a ${styleDescriptor} style,
high-quality, photorealistic, 8K resolution
`.trim();

// Quality modifiers to append
const qualityModifiers = [
  'professional',
  'high-quality',
  'photorealistic',
  'detailed',
  'well-lit',
  'sharp focus',
];

// Style references
const styleReferences = {
  modern: 'clean, minimalist, contemporary design',
  warm: 'cozy, inviting, warm color palette',
  professional: 'corporate, polished, business-appropriate',
  creative: 'artistic, unique, eye-catching',
};
```

---

## 4. Veo 2 API

### Supported Models

| Model ID                        | Features                      | Audio Support  |
| ------------------------------- | ----------------------------- | -------------- |
| `veo-2.0-generate-001`          | Text-to-video, image-to-video | No             |
| `veo-2.0-generate-exp`          | Experimental features         | No             |
| `veo-3.0-generate-001`          | Improved quality              | No             |
| `veo-3.1-generate-preview`      | 1080p support                 | Yes (optional) |
| `veo-3.1-fast-generate-preview` | Faster generation             | Yes (optional) |

### REST API - Initiate Video Generation

```
POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_ID}:predictLongRunning
```

#### Request Schema

```typescript
interface VeoGenerateRequest {
  instances: Array<{
    prompt: string;
    image?: {
      bytesBase64Encoded?: string;
      gcsUri?: string;
      mimeType: 'image/jpeg' | 'image/png';
    };
    video?: {
      gcsUri: string;
      mimeType: string;
    };
    lastFrame?: {
      gcsUri: string;
      mimeType: string;
    };
    referenceImages?: Array<{
      image: {
        bytesBase64Encoded: string;
        mimeType: string;
      };
      referenceType: 'asset' | 'style';
    }>;
  }>;
  parameters: {
    storageUri?: string; // GCS bucket for output
    sampleCount?: number; // 1-4
    aspectRatio?: '16:9' | '9:16';
    negativePrompt?: string;
    personGeneration?: 'allow_adult' | 'disallow';
    resolution?: '720p' | '1080p'; // Veo 3 only
    seed?: number; // 0-4294967295
    durationSeconds?: number; // Veo 2: 5-8, Veo 3: 4, 6, or 8
  };
}
```

#### Response Schema (Long-Running Operation)

```typescript
interface VeoOperationResponse {
  name: string; // Operation ID for polling
}

interface VeoCompletedResponse {
  name: string;
  done: boolean;
  response?: {
    raiMediaFilteredCount: number;
    '@type': string;
    videos: Array<{
      gcsUri: string;
      mimeType: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}
```

### REST API - Poll Operation Status

```
POST https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{REGION}/publishers/google/models/{MODEL_ID}:fetchPredictOperation

Body: { "operationName": "projects/.../operations/..." }
```

### TypeScript Implementation (Custom Wrapper)

```typescript
import { GoogleAuth } from 'google-auth-library';

interface VeoConfig {
  projectId: string;
  location: string;
  model?: string;
}

interface GenerateVideoParams {
  prompt: string;
  storageUri: string; // Required: GCS bucket for output
  sampleCount?: number;
  aspectRatio?: '16:9' | '9:16';
  durationSeconds?: number;
  personGeneration?: 'allow_adult' | 'disallow';
  negativePrompt?: string;
}

interface VideoGenerationResult {
  operationId: string;
  videos?: Array<{
    gcsUri: string;
    mimeType: string;
  }>;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

class VeoClient {
  private auth: GoogleAuth;
  private config: VeoConfig;

  constructor(config: VeoConfig) {
    this.config = {
      model: 'veo-2.0-generate-001',
      ...config,
    };
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  async initiateVideoGeneration(params: GenerateVideoParams): Promise<string> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.model}:predictLongRunning`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt: params.prompt }],
        parameters: {
          storageUri: params.storageUri,
          sampleCount: params.sampleCount ?? 1,
          aspectRatio: params.aspectRatio ?? '16:9',
          personGeneration: params.personGeneration ?? 'allow_adult',
          negativePrompt: params.negativePrompt,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Veo API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.name; // Operation ID
  }

  async pollOperation(operationId: string): Promise<VideoGenerationResult> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://${this.config.location}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.model}:fetchPredictOperation`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName: operationId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Veo poll error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    if (data.done) {
      if (data.error) {
        return {
          operationId,
          status: 'failed',
          error: data.error.message,
        };
      }
      return {
        operationId,
        status: 'completed',
        videos: data.response.videos,
      };
    }

    return { operationId, status: 'pending' };
  }

  async generateVideoWithPolling(
    params: GenerateVideoParams,
    options: { pollIntervalMs?: number; maxWaitMs?: number } = {}
  ): Promise<VideoGenerationResult> {
    const { pollIntervalMs = 10000, maxWaitMs = 300000 } = options;

    const operationId = await this.initiateVideoGeneration(params);
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.pollOperation(operationId);

      if (result.status !== 'pending') {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return {
      operationId,
      status: 'pending',
      error: 'Timeout waiting for video generation',
    };
  }
}

// Usage
const veoClient = new VeoClient({
  projectId: 'my-project',
  location: 'us-central1',
});

const result = await veoClient.generateVideoWithPolling({
  prompt: 'A serene mountain landscape at sunset with gentle clouds',
  storageUri: 'gs://my-bucket/videos/',
  durationSeconds: 8,
  aspectRatio: '16:9',
});
```

### Output Specifications

| Parameter     | Veo 2                    | Veo 3              |
| ------------- | ------------------------ | ------------------ |
| Duration      | 5-8 seconds (default: 8) | 4, 6, or 8 seconds |
| Resolution    | 720p                     | 720p, 1080p        |
| Aspect Ratios | 16:9, 9:16               | 16:9, 9:16         |
| Audio         | No                       | Yes (Veo 3.1)      |

---

## 5. XState v5 Patterns

### Core Concepts for Event Sourcing

```typescript
import { createMachine, createActor, fromTransition, fromPromise } from 'xstate';

// Event sourcing via inspection
const events: Event[] = [];

const someActor = createActor(someMachine, {
  inspect: (inspectionEvent) => {
    if (inspectionEvent.type === '@xstate.event') {
      if (inspectionEvent.actorRef === someActor) {
        events.push(inspectionEvent.event);
      }
    }
  },
});

someActor.start();

// Replay events to restore state
const restoredActor = createActor(someMachine);
restoredActor.start();

for (const event of events) {
  restoredActor.send(event);
}
```

### Actor Model Pattern

```typescript
import { createMachine, createActor, assign, sendTo } from 'xstate';

// Child actor machine
const childMachine = createMachine({
  id: 'child',
  initial: 'idle',
  context: ({ input }) => ({
    parentRef: input.parentRef,
  }),
  states: {
    idle: {
      on: {
        WORK: 'working',
      },
    },
    working: {
      entry: sendTo(({ context }) => context.parentRef, {
        type: 'CHILD_STARTED',
      }),
      after: {
        1000: {
          actions: sendTo(({ context }) => context.parentRef, {
            type: 'CHILD_DONE',
          }),
          target: 'done',
        },
      },
    },
    done: { type: 'final' },
  },
});

// Parent machine that spawns children
const parentMachine = createMachine({
  id: 'parent',
  initial: 'idle',
  context: {
    children: [] as any[],
  },
  states: {
    idle: {
      on: {
        SPAWN_CHILD: {
          actions: assign({
            children: ({ spawn, context, self }) => [
              ...context.children,
              spawn(childMachine, {
                input: { parentRef: self },
              }),
            ],
          }),
        },
      },
    },
  },
  on: {
    CHILD_STARTED: {
      actions: () => console.log('Child started working'),
    },
    CHILD_DONE: {
      actions: () => console.log('Child completed'),
    },
  },
});
```

### Async Actions with fromPromise

```typescript
import { createMachine, fromPromise, assign } from 'xstate';

const fetchDataActor = fromPromise(async ({ input }: { input: { url: string } }) => {
  const response = await fetch(input.url);
  return response.json();
});

const dataMachine = createMachine({
  id: 'data',
  initial: 'idle',
  context: {
    data: null as any,
    error: null as string | null,
  },
  states: {
    idle: {
      on: {
        FETCH: 'loading',
      },
    },
    loading: {
      invoke: {
        src: fetchDataActor,
        input: ({ event }) => ({ url: event.url }),
        onDone: {
          target: 'success',
          actions: assign({
            data: ({ event }) => event.output,
          }),
        },
        onError: {
          target: 'failure',
          actions: assign({
            error: ({ event }) => event.error.message,
          }),
        },
      },
    },
    success: {},
    failure: {
      on: {
        RETRY: 'loading',
      },
    },
  },
});
```

### Callback Actors for Side Effects

```typescript
import { fromCallback, createMachine, sendTo } from 'xstate';

const resizeLogic = fromCallback(({ sendBack, receive }) => {
  const resizeHandler = (event: Event) => {
    sendBack({
      type: 'RESIZE',
      dimensions: {
        /* ... */
      },
    });
  };

  window.addEventListener('resize', resizeHandler);

  receive((event) => {
    if (event.type === 'STOP_LISTENING') {
      window.removeEventListener('resize', resizeHandler);
    }
  });

  // Cleanup function
  return () => {
    window.removeEventListener('resize', resizeHandler);
  };
});

const machine = createMachine({
  invoke: {
    id: 'resize',
    src: resizeLogic,
  },
  on: {
    RESIZE: {
      actions: () => console.log('Window resized'),
    },
    STOP: {
      actions: sendTo('resize', { type: 'STOP_LISTENING' }),
    },
  },
});
```

---

## 6. Cost Reference

### Imagen 3 Pricing

| Model            | Price per Image |
| ---------------- | --------------- |
| Imagen 3.0       | $0.04           |
| Imagen 3.0 Fast  | $0.02           |
| Imagen 4.0       | $0.04           |
| Imagen 4.0 Ultra | $0.06           |
| Imagen 4.0 Fast  | $0.02           |

### Veo Pricing

| Model   | Resolution | With Audio | Price per Second                    |
| ------- | ---------- | ---------- | ----------------------------------- |
| Veo 3.1 | 720p/1080p | Yes        | $0.40                               |
| Veo 3.1 | 720p/1080p | No         | $0.20                               |
| Veo 3.1 | 4K         | Yes        | $0.60                               |
| Veo 3.1 | 4K         | No         | $0.30                               |
| Veo 2   | 720p       | No         | $0.50 (Vertex) / $0.35 (Gemini API) |

### Example Costs

| Operation                                  | Cost  |
| ------------------------------------------ | ----- |
| 1 Imagen image                             | $0.04 |
| 4 Imagen images (batch)                    | $0.16 |
| 8-second Veo 2 video                       | $4.00 |
| 8-second Veo 3.1 video (720p, no audio)    | $1.60 |
| 8-second Veo 3.1 video (1080p, with audio) | $3.20 |

### Agent Engine Pricing

| Resource         | Price                      |
| ---------------- | -------------------------- |
| Sessions         | $0.25 per 1,000 events     |
| Memory Bank      | $0.25 per 1,000 memories   |
| Vertex AI Search | Free: 10,000 queries/month |

---

## 7. Error Handling Patterns

### Retry Strategy for Media Generation

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (isNonRetryableError(error)) {
        throw error;
      }

      if (attempt < config.maxRetries) {
        const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

function isNonRetryableError(error: any): boolean {
  const nonRetryableCodes = [
    400, // Bad Request
    401, // Unauthorized
    403, // Forbidden
    404, // Not Found
  ];

  return nonRetryableCodes.includes(error.code);
}
```

### Cost Limit Enforcement

```typescript
interface UsageLimits {
  imagesPerDay: number;
  videosPerMonth: number;
  videoSecondsPerMonth: number;
}

interface TierLimits {
  free: UsageLimits;
  basic: UsageLimits;
  pro: UsageLimits;
}

const TIER_LIMITS: TierLimits = {
  free: {
    imagesPerDay: 5,
    videosPerMonth: 2,
    videoSecondsPerMonth: 16,
  },
  basic: {
    imagesPerDay: 25,
    videosPerMonth: 10,
    videoSecondsPerMonth: 80,
  },
  pro: {
    imagesPerDay: 100,
    videosPerMonth: 50,
    videoSecondsPerMonth: 400,
  },
};

class UsageTracker {
  async checkImageLimit(tenantId: string): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
  }> {
    const tier = await this.getTenantTier(tenantId);
    const usage = await this.getTodayImageUsage(tenantId);
    const limit = TIER_LIMITS[tier].imagesPerDay;

    return {
      allowed: usage < limit,
      remaining: Math.max(0, limit - usage),
      limit,
    };
  }

  async checkVideoLimit(
    tenantId: string,
    durationSeconds: number
  ): Promise<{
    allowed: boolean;
    remainingSeconds: number;
    costEstimate: number;
  }> {
    const tier = await this.getTenantTier(tenantId);
    const usage = await this.getMonthVideoUsage(tenantId);
    const limit = TIER_LIMITS[tier].videoSecondsPerMonth;

    return {
      allowed: usage + durationSeconds <= limit,
      remainingSeconds: Math.max(0, limit - usage),
      costEstimate: durationSeconds * 0.5, // Veo 2 rate
    };
  }
}
```

### Graceful Degradation

```typescript
// Agent tool that handles failures gracefully
const generateImageTool = new FunctionTool({
  name: 'generate_image',
  description: 'Generate an image using Imagen 3',
  parameters: z.object({
    prompt: z.string(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16']).optional(),
  }),
  execute: async ({ prompt, aspectRatio }, toolContext) => {
    const tenantId = toolContext.state.get('tenantId');

    // Check limits first
    const limits = await usageTracker.checkImageLimit(tenantId);
    if (!limits.allowed) {
      return {
        status: 'limit_reached',
        message: `Daily image limit reached (${limits.limit} images). Upgrade your plan for more.`,
        upgradeUrl: '/settings/billing',
      };
    }

    try {
      const images = await withRetry(() => imagenClient.generateImages({ prompt, aspectRatio }));

      await usageTracker.recordImageUsage(tenantId, images.length);

      return {
        status: 'success',
        images: images.map((img) => ({
          base64: img.bytesBase64Encoded,
          mimeType: img.mimeType,
        })),
        remaining: limits.remaining - images.length,
      };
    } catch (error: any) {
      // Log error for monitoring
      logger.error('Image generation failed', { tenantId, prompt, error });

      return {
        status: 'error',
        message: 'Image generation temporarily unavailable. Please try again in a few minutes.',
        errorCode: error.code,
      };
    }
  },
});
```

---

## Appendix: Quick Reference

### ADK Agent Configuration Options

```typescript
interface LlmAgentConfig {
  name: string;
  model: string;
  description?: string;
  instruction?: string;
  globalInstruction?: string;
  tools?: ToolUnion[];
  subAgents?: Agent[];
  outputKey?: string;
  outputSchema?: object;
  generateContentConfig?: GenerateContentConfig;
  beforeModelCallback?: BeforeModelCallback;
  afterModelCallback?: AfterModelCallback;
  beforeToolCallback?: BeforeToolCallback;
  afterToolCallback?: AfterToolCallback;
}
```

### Memory Bank Topics Reference

| Topic                    | Content Type                       |
| ------------------------ | ---------------------------------- |
| USER_PERSONAL_INFO       | Names, relationships, demographics |
| USER_PREFERENCES         | Likes, dislikes, style preferences |
| KEY_CONVERSATION_DETAILS | Milestones, decisions, conclusions |
| EXPLICIT_INSTRUCTIONS    | User-stated rules and requirements |

### Imagen 3 Aspect Ratio Quick Reference

| Ratio | Dimensions | Best For            |
| ----- | ---------- | ------------------- |
| 1:1   | 1024x1024  | Profile, thumbnails |
| 16:9  | 1408x768   | Headers, landscapes |
| 9:16  | 768x1408   | Mobile, stories     |
| 4:3   | 1280x896   | Traditional photos  |
| 3:4   | 896x1280   | Portraits           |

---

_Generated with Claude Code - January 2026_
