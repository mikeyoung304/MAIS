# Google Vertex AI Studio Research - 2026 Edition

**Research Date:** January 2026
**Purpose:** Comprehensive analysis of Vertex AI capabilities, best practices, and comparison with Anthropic API

---

## Table of Contents

1. [Vertex AI Studio Fundamentals](#vertex-ai-studio-fundamentals)
2. [Latest Gemini Models](#latest-gemini-models)
3. [Agent Building Capabilities](#agent-building-capabilities)
4. [Node.js/TypeScript SDK](#nodejs-typescript-sdk)
5. [Advanced Features](#advanced-features)
6. [Claude Models on Vertex AI](#claude-models-on-vertex-ai)
7. [Universal Commerce Protocol (UCP)](#universal-commerce-protocol-ucp)
8. [Anthropic API vs Vertex AI Comparison](#anthropic-api-vs-vertex-ai-comparison)
9. [Enterprise Considerations](#enterprise-considerations)
10. [Migration & Best Practices](#migration--best-practices)

---

## Vertex AI Studio Fundamentals

### Overview

Vertex AI Studio is Google Cloud's comprehensive platform for building, deploying, and managing AI applications. As of 2026, it provides:

- **200+ foundation models** in Model Garden (Google, third-party, and open-source)
- Fully managed, serverless APIs
- Integrated environment for evaluation, deployment, and management
- Support for multimodal models (text, image, video, audio)
- Native integration with Google Cloud services

### Key Capabilities

- **Prompt Design & Testing:** Design, test, and manage prompts using natural language, code, images, or video
- **Model Garden:** Curated selection of foundation models including Gemini, Claude, Llama, and open models
- **Agent Builder:** Suite of tools for building, scaling, and governing AI agents
- **Multimodal Generation:** Text (Gemini), images (Imagen), video (Veo), audio (Lyria)

### Documentation Hub

- **Main Documentation:** https://docs.cloud.google.com/vertex-ai
- **Generative AI Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs
- **Release Notes:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes (Updated 2026-01-12)

---

## Latest Gemini Models

### Gemini 3 Family (Latest - Public Preview)

#### **Gemini 3 Pro**

- **Status:** Public preview (as of January 2026)
- **Optimized For:** Complex agentic workflows and coding
- **Key Features:**
  - Adaptive thinking capabilities
  - 1M token context window
  - Integrated grounding with Google Search
  - State-of-the-art reasoning
- **Best For:** Production-ready agentic systems requiring advanced reasoning

#### **Gemini 3 Flash**

- **Status:** Generally available
- **Optimized For:** Complex multimodal understanding with speed
- **Key Features:**
  - Strong coding and reasoning
  - Challenging agentic problems
  - Multimodal input support
  - Lower latency than Pro
- **Blog Announcement:** https://blog.google/products/gemini/gemini-3-flash/

### Gemini 2.5 Family

#### **Gemini 2.5 Pro**

- High-capability model for complex reasoning and coding
- Adaptive thinking with 1M token context
- **Pricing Calculator:** https://livechatai.com/gemini-2-5-pro-pricing-calculator

#### **Gemini 2.5 Flash**

- Balance of intelligence and latency
- Controllable thinking budgets
- **Simplified Pricing:** Single price per input type (no short/long context distinction)

#### **Gemini 2.5 Flash-Lite**

- Most cost-efficient model
- Built for massive scale and high-throughput tasks

#### **Gemini 2.5 Flash Image**

- Production-ready asset generation
- Conversational editing, multi-image fusion, character consistency

### Gemini 2.0 Family (Being Phased Out)

> **⚠️ IMPORTANT DEPRECATION NOTICE:**
> Gemini 2.0 Flash and Flash-Lite models will be retired on **March 3, 2026**.
> Update to Gemini 2.5+ or Gemini 3 models.

- **Gemini 2.0 Flash:** Now generally available with higher rate limits
- **Gemini 2.0 Flash-Lite:** Public preview
- **Gemini 2.0 Pro:** Experimental

### Special-Purpose Models

#### **Gemini Live API**

- Real-time, bidirectional streaming
- Low-latency built-in audio
- Affective dialogue capabilities
- **Pricing:** 25 tokens/second of audio (input/output), 258 tokens/second of video
- **Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api

### Context Windows & Token Limits

- **Standard Context:** 1M tokens (Gemini 2.5+, Gemini 3)
- **Image Token Cost:** ~1290 tokens for 1024x1024 image
- **Token Estimation:** ~4 characters = 1 text token (including whitespace)

### Pricing Structure (2026)

#### **Simplified Pricing Model**

- **Single Price Per Input Type:** No distinction between short/long context (simplified from Gemini 1.5)
- **Free Tier:** Up to 1,000 daily requests across all models
- **Token-Based Billing:** Pay per million tokens

#### **Official Pricing Resources**

- **Gemini Developer API:** https://ai.google.dev/gemini-api/docs/pricing
- **Vertex AI Pricing:** https://cloud.google.com/vertex-ai/generative-ai/pricing
- **Last Updated:** 2025-12-18 UTC

#### **Grounding Pricing Update**

- Gemini 3 billing for Grounding with Google Search started **January 5, 2026**
- Limit: 1 million queries per day

---

## Agent Building Capabilities

### Vertex AI Agent Builder Overview

Vertex AI Agent Builder is a suite of products for discovering, building, and deploying AI agents in production at scale.

**Main Documentation:** https://docs.cloud.google.com/agent-builder

### Key Components

#### 1. **Agent Development Kit (ADK)**

- Open-source framework
- Simplifies multi-agent system development
- Maintains precise control over agent behavior
- **Docs:** https://google.github.io/adk-docs/

#### 2. **Agent Engine**

- Sessions, Memory Bank, and Code Execution capabilities
- **Billing Started:** January 28, 2026 (usage-based charges)
- **Docs:** https://docs.cloud.google.com/agent-builder/agent-engine/overview

#### 3. **Agent Designer (Preview)**

- Low-code visual designer
- Design and test agents in Google Cloud console
- **Docs:** https://docs.cloud.google.com/agent-builder/agent-designer

#### 4. **Agent Garden (Preview)**

- Library of sample agents and tools
- Accelerates development with pre-built templates

### Agent Features

#### **Conversation Management**

- Stateful sessions with Memory Bank
- Multi-turn context preservation
- Session history and retrieval

#### **Function Calling / Tool Use**

- Native tool integration
- Streaming function call arguments
- Manual and automatic tool execution modes

#### **Grounding Options**

- **Google Search:** Real-time web data access
- **Google Maps:** Geospatial data
- **Vertex AI Search:** Private data stores
- **Custom Search API:** Any external search service

#### **Safety & Security**

- Enhanced Tool Governance (2026 feature)
- Role-based access controls
- Audit logging
- **Blog:** https://cloud.google.com/blog/products/ai-machine-learning/new-enhanced-tool-governance-in-vertex-ai-agent-builder

### System Instructions

- Direct guidance to models on behavior
- Proactively steer away from undesirable content
- Organization-specific safety rules
- **Best Practice:** Use both content filters AND system instructions

---

## Node.js/TypeScript SDK

### Current SDK Status (2026)

#### **⚠️ MIGRATION REQUIRED**

The legacy `@google-cloud/vertexai` SDK is **deprecated** as of June 24, 2025 and will be **removed on June 24, 2026**.

**Migrate to:** `@google/genai` (Google Gen AI SDK)

### Recommended SDK: `@google/genai`

#### **Installation**

```bash
npm install @google/genai
```

#### **Package Info**

- **Latest Version:** 1.35.0 (as of January 2026)
- **Status:** General Availability (GA) - stable for production
- **Support:** TypeScript and JavaScript
- **Features:** Gemini 2.0+ features, Vertex AI and Developer API support
- **npm:** https://www.npmjs.com/package/@google/genai
- **GitHub:** https://github.com/googleapis/js-genai
- **Docs:** https://googleapis.github.io/js-genai/

### Authentication Patterns

#### **Application Default Credentials (ADC)**

**Method 1: Environment Variable**

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
```

```typescript
import { GoogleGenAI } from '@google/genai';

// Automatically uses environment variables
const ai = new GoogleGenAI();
```

**Method 2: Direct Configuration**

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1',
});
```

**Method 3: Local Development with gcloud CLI**

```bash
gcloud auth application-default login
```

#### **Service Account Best Practices**

- **ADC Search Order:**
  1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable
  2. Workforce Identity Federation config
  3. Workload Identity Federation config
  4. Service account key JSON

- **⚠️ Security Warning:** Service account keys pose significant security risks if compromised. Strongly discouraged for production. Never commit to version control.

- **Service Account Impersonation:** Supported for Go, Java, Node.js, and Python client libraries

### TypeScript Code Examples

#### **Basic Content Generation**

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1',
});

async function generateText() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Why is the sky blue?',
  });

  console.log(response.text);
}
```

#### **Streaming Responses**

```typescript
async function streamText() {
  const response = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: 'Write a creative poem about technology.',
  });

  for await (const chunk of response) {
    process.stdout.write(chunk.text);
  }
}
```

#### **Function Calling**

```typescript
import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';

const weatherTool = {
  name: 'get_weather',
  description: 'Retrieves current weather for a location',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
};

async function useFunctionCalling() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'What is the weather in San Francisco?',
    config: {
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ['get_weather'],
        },
      },
      tools: [{ functionDeclarations: [weatherTool] }],
    },
  });

  // Handle function call
  if (response.functionCalls) {
    const call = response.functionCalls[0];
    console.log('Function:', call.name);
    console.log('Args:', call.args);

    // Execute function and send result back
    const result = await executeWeatherAPI(call.args.location);

    const finalResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        'What is the weather in San Francisco?',
        response,
        { functionResponse: { name: 'get_weather', response: result } },
      ],
    });

    console.log(finalResponse.text);
  }
}
```

#### **Streaming Function Calls (2026 Feature)**

```typescript
// For Gemini 3 Pro and later models
const response = await ai.models.generateContentStream({
  model: 'gemini-3-pro',
  contents: 'Find me a restaurant in NYC',
  config: {
    streamFunctionCallArguments: true, // Stream function args as generated
    tools: [{ functionDeclarations: [searchRestaurantTool] }],
  },
});

for await (const chunk of response) {
  if (chunk.functionCalls) {
    // Process partial function call arguments
    console.log('Partial args:', chunk.functionCalls[0].args);
  }
}
```

#### **Multimodal Input (Image Analysis)**

```typescript
import * as fs from 'fs';

async function analyzeImage() {
  const imageBuffer = fs.readFileSync('./image.png');
  const base64Image = imageBuffer.toString('base64');

  const response = await ai.interactions.create({
    model: 'gemini-2.5-flash',
    input: [
      { type: 'text', text: 'Describe this image in detail.' },
      {
        type: 'image',
        data: base64Image,
        mime_type: 'image/png',
      },
    ],
  });

  console.log(response.text);
}
```

#### **Stateful Conversations (Interactions API - Preview)**

```typescript
async function multiTurnConversation() {
  // First turn
  const interaction1 = await ai.interactions.create({
    model: 'gemini-2.5-flash',
    input: 'My name is Alex and I love photography.',
  });

  console.log(interaction1.text);

  // Second turn - maintains context
  const interaction2 = await ai.interactions.create({
    model: 'gemini-2.5-flash',
    input: 'What hobby did I mention?',
    previous_interaction_id: interaction1.id,
  });

  console.log(interaction2.text); // Will reference photography
}
```

#### **Error Handling**

```typescript
import { ApiError } from '@google/genai';

async function handleErrors() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Test prompt',
    });

    console.log(response.text);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('API Error:', {
        name: error.name,
        message: error.message,
        status: error.status,
        // Additional error details
      });
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
```

#### **Retry Logic Pattern**

```typescript
async function generateWithRetry(prompt: string, maxRetries: number = 3): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (error instanceof ApiError && error.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable error
      throw error;
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
```

#### **Deep Research Agent (2026 Feature)**

```typescript
async function deepResearch() {
  const interaction = await ai.interactions.create({
    input: 'Research the history of Google TPUs focusing on 2025 and 2026.',
    agent: 'deep-research-pro-preview-12-2025',
    background: true, // Run in background
  });

  // Poll for completion
  let status = await ai.interactions.get(interaction.id);
  while (status.state !== 'completed') {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    status = await ai.interactions.get(interaction.id);
  }

  console.log(status.output);
}
```

#### **API Version Selection**

```typescript
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project',
  location: 'us-central1',
  apiVersion: 'v1', // Use 'v1beta' for preview features
});
```

### Key SDK Modules

- **`ai.models`**: Content generation and image creation
- **`ai.caches`**: Prompt caching for cost reduction
- **`ai.chats`**: Multi-turn conversation management
- **`ai.files`**: File upload and referencing
- **`ai.live`**: Real-time multimodal sessions (Live API)
- **`ai.interactions`**: Stateful conversations with server-side state (Preview)

### Type Safety

The SDK provides full TypeScript support with:

- Strongly-typed request/response objects
- Enum types for configuration options
- Generic interfaces for custom types
- Proper error typing with `ApiError`

---

## Advanced Features

### Grounding with Google Search

Grounding connects Gemini models to real-time web data, ensuring up-to-date and factually accurate responses.

**Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview

#### **Grounding Options**

1. **Google Search** - Publicly-available web data
   - **Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search
   - **Limit:** 1 million queries per day
   - **Billing:** Started January 5, 2026 for Gemini 3

2. **Google Maps** - Geospatial data

3. **Vertex AI Search** - Private enterprise data stores
   - **Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-vertex-ai-search
   - **Use Case:** Customer support, internal knowledge bases

4. **Custom Search API** - Any external search service
   - **Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-your-search-api

#### **Implementation**

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'What are the latest developments in quantum computing in 2026?',
  config: {
    tools: [
      {
        googleSearch: {}, // Enable Google Search grounding
      },
    ],
  },
});

// Response includes grounding metadata
console.log(response.groundingMetadata);
```

#### **Response Format**

- Compliant HTML and CSS styling in `renderedContent` field
- Source citations and links
- Confidence scores

### Safety Filters & Content Moderation

**Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/safety-overview

#### **Two Types of Filters**

1. **Non-Configurable Safety Filters** (Automatic)
   - Child sexual abuse material (CSAM)
   - Personally identifiable information (PII)
   - Always active, cannot be disabled

2. **Configurable Content Filters**
   - **Harm Categories:** Violence, hate speech, sexual content, dangerous content
   - **Scoring:** Probability and severity scores
   - **Harm Block Methods:**
     - `SEVERITY` (default) - Uses both probability and severity
     - `PROBABILITY` - Uses probability score only

#### **Threshold Options**

- `BLOCK_LOW_AND_ABOVE` - Highest safety (most filtering)
- `BLOCK_MEDIUM_AND_ABOVE` - Balanced
- `BLOCK_ONLY_HIGH` - Minimal filtering

#### **Configuration Example**

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  },
});
```

#### **Imagen Safety Attributes**

For image generation models (Imagen 3, Imagen 4):

**Safety Categories:**

- Death, Harm & Tragedy
- Firearms & Weapons
- Hate
- Health
- Illicit Drugs
- Politics
- Porn
- Religion & Belief
- Toxic
- Violence
- Vulgarity
- War & Conflict

**Threshold:** `block_low_and_above` - Highest safety, largest filtering

**Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/configure-responsible-ai-safety-settings

#### **Gemini for Content Moderation**

Use Gemini itself as a content moderation tool:

**Capabilities:**

- Analyze text, images, videos, and audio
- Identify subtle toxicity (sarcasm, disguised hate speech, stereotypes)
- Context-aware moderation (understands satire and exceptions)
- More nuanced than text-only models

**Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-for-filtering-and-moderation

### Model Garden: Third-Party Models

Vertex AI Model Garden provides access to 200+ foundation models beyond Gemini.

**Main Page:** https://cloud.google.com/model-garden

#### **Available Third-Party Models (2026)**

- **Anthropic Claude** (Opus 4.5, Sonnet 4.5, Haiku 4.5) - See dedicated section below
- **Meta Llama** (various versions)
- **Mistral AI**
- **Open-source models** (Stable Diffusion, BLOOM, etc.)

#### **Key Features**

- Fully managed APIs
- Consistent authentication and billing
- Unified monitoring and logging
- No separate vendor accounts needed (for most models)

### Multimodal Generation

#### **Imagen 3 & Imagen 4 (Text-to-Image)**

**Capabilities:**

- Most realistic and highest quality images from text prompts
- Superior detail, lighting, artifact reduction vs. previous versions
- **Imagen 4:** Public preview as of January 2026

**Use Cases:**

- Marketing assets
- Product visualization
- Creative design

**Docs:**

- Imagen 3: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/overview
- Imagen 4: https://cloud.google.com/blog/products/ai-machine-learning/announcing-veo-3-imagen-4-and-lyria-2-on-vertex-ai

#### **Veo (Text-to-Video & Image-to-Video)**

**Latest Models:**

- **Veo 3.1** and **Veo 3.1 Fast** - Paid preview (January 2026)
- **Veo 3** - Private preview
- **Veo 2** - Customer use

**Capabilities:**

- Generate realistic, high-quality videos from text and image prompts
- **First hyperscaler** to offer image-to-video
- Video generation from images of people of all ages
- Scene extension (longer videos by connecting clips)
- Reference images support (Veo 2.0+ and 3.1+)
- **Rich native audio** (natural conversations, synchronized sound effects)
- Cinematic style understanding

**Key Features (Veo 3.1):**

- Enhanced narrative control
- Improved audio quality
- Greater understanding of cinematic styles

**Use Cases:**

- Content creation efficiency (Klarna: transforming time-intensive production to quick tasks)
- Cost reduction (Jellyfish: 50% average cost reduction and faster time-to-market)

**Docs:**

- Overview: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/overview
- API Reference: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
- Veo 3: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-0-generate
- Veo 3.1: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate

**Example Use Cases:**

```typescript
// Text-to-video
const video = await ai.models.generateVideo({
  model: 'veo-3-1',
  prompt: 'A cinematic shot of a sunset over the ocean, with waves gently crashing',
});

// Image-to-video
const videoFromImage = await ai.models.generateVideo({
  model: 'veo-3-1',
  prompt: 'The person in this image walking through a forest',
  referenceImage: base64Image,
});
```

#### **Lyria 2 (Audio Generation)**

- Announced alongside Veo 3 and Imagen 4 in January 2026
- **Docs:** https://cloud.google.com/blog/products/ai-machine-learning/announcing-veo-3-imagen-4-and-lyria-2-on-vertex-ai

### Data Retention & Privacy

**Zero Data Retention:**

- Google's published Gemini models cache customer data **in-memory only** (not at-rest)
- **Project-level isolation**
- **24-hour TTL** for cached data
- Adheres to all data residency requirements
- **Google will not use your data** to train or fine-tune AI/ML models without prior permission

**Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention

---

## Claude Models on Vertex AI

Google's Model Garden provides fully managed access to Anthropic's Claude models through Vertex AI.

**Main Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude
**Claude Official Docs:** https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai
**Product Page:** https://cloud.google.com/products/model-garden/claude

### Available Models (2026)

#### **Latest Models**

- **Claude Opus 4.5** (Flagship)
  - Next generation of Anthropic's most intelligent model
  - Industry leader in coding, agents, computer use, enterprise workflows
  - Outperforms Sonnet 4.5 and Opus 4.1
  - **One-third the cost** of previous Opus models
  - Sets new standard across office tasks and spreadsheets

- **Claude Sonnet 4.5**
  - Latest Sonnet-class model for real-world agents
  - Leading capabilities: coding, computer use, cybersecurity, office files

- **Claude Haiku 4.5**
  - Best combination of performance, price, and speed
  - Ideal for high-throughput applications

**Blog Announcement:** https://cloud.google.com/blog/products/ai-machine-learning/anthropics-claude-opus-4-and-claude-sonnet-4-on-vertex-ai

#### **Previous Generations**

- Claude Opus 4.1
- Claude Opus 4
- Claude Sonnet 4
- Claude 3 Haiku

### Key Features Supported

- ✅ Streaming responses (server-sent events)
- ✅ Function calling and tool use
- ✅ Computer use capabilities
- ✅ Request-response logging (30-day retention)
- ✅ FedRAMP High compliance

### Pricing

**Pay-as-You-Go:**

- Consumption-based pricing
- Opus 4: $15/$75 per million tokens (input/output)
- Sonnet 4: $3/$15 per million tokens (input/output)
- See: https://cloud.google.com/vertex-ai/generative-ai/pricing (Partner Models section)

**Provisioned Throughput:**

- Fixed-fee alternative for committed usage
- Available for predictable workloads

### Compliance & Security

- **FedRAMP High:** Accessing Claude through Vertex AI meets FedRAMP High requirements
- **Authorization Boundary:** Operates within Google Cloud FedRAMP High authorization boundary
- **GCP-Native Governance:** Leverage Google Cloud IAM, VPC, audit logging

### Adoption

- **4,000+ customers** have started using Claude models on Vertex AI (as of 2026)
- **Training Available:** https://anthropic.skilljar.com/claude-with-google-vertex

### Integration Example

```typescript
// Using Claude on Vertex AI via @google/genai
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project-id',
  location: 'us-central1',
});

const response = await ai.models.generateContent({
  model: 'claude-opus-4-5@001', // Vertex AI Claude model
  contents: 'Explain quantum entanglement in simple terms.',
});

console.log(response.text);
```

---

## Universal Commerce Protocol (UCP)

Google's Universal Commerce Protocol (UCP) is an **open-source standard** designed to power the next generation of agentic commerce, enabling AI agents to complete transactions on behalf of users.

**Announcement Date:** January 11, 2026 (National Retail Federation conference)

**Official Docs:** https://developers.google.com/merchant/ucp
**Blog Post:** https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/
**Technical Deep Dive:** https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/

### Core Purpose

Turn AI interactions into instant sales by enabling direct purchasing within AI surfaces like:

- Google's AI Mode in Search
- Gemini applications
- Any AI agent implementing UCP

### Architecture

#### **Integration Paths**

UCP offers **multiple integration approaches**:

1. **Native Checkout (Default, Recommended)**
   - Direct integration of checkout logic with Google AI systems
   - Unlocks full agentic potential as UCP product offering expands
   - Best for most merchants

2. **Embedded Checkout (Optional)**
   - iframe-based solution
   - For merchants requiring specialized branding or complex transaction flows

#### **Protocol Compatibility**

UCP supports interoperability with major industry standards:

- **REST API** - Standard HTTP interface
- **Model Context Protocol (MCP)** - For LLM tool integration
- **Agent2Agent (A2A)** - Agent-to-agent communication
- **Agent Payments Protocol (AP2)** - Secure agentic payments
- **Native SDKs** - Language-specific implementations for faster integration

### Key Features

- **Full Merchant of Record Status:** Merchants retain customer data ownership
- **High-Intent Shoppers:** Access to users actively researching on Google AI surfaces
- **Reduced Friction:** Complete checkout within AI conversations
- **Modular & Extensible:** Future-proof design supporting upcoming capabilities
- **Open Standard:** No vendor lock-in, works across AI platforms

### Industry Support

**Developed by Google in collaboration with:**

- Shopify (primary partner)
- Etsy
- Wayfair
- Target
- Walmart

**Endorsed by 20+ global partners:**

- Payment Processors: Adyen, American Express, Mastercard, Stripe, Visa
- Retailers: Best Buy, Flipkart, Macy's Inc, The Home Depot, Zalando

### Initial Deployment

UCP will power a new checkout feature on:

- Eligible Google product listings in **AI Mode in Search**
- **Gemini app**
- Eligible U.S. retailers (initial rollout)

### Implementation Resources

**Technical Guides:**

- Google Developer Docs: https://developers.google.com/merchant/ucp
- Shopify Engineering Blog: https://shopify.engineering/UCP
- Analytics Vidhya Guide: https://www.analyticsvidhya.com/blog/2026/01/universal-commerce-protocol-by-google/

**Complete 2026 Guide:**

- https://almcorp.com/blog/universal-commerce-protocol-agentic-commerce-guide-2026/

### Agent Integration Example (Conceptual)

```typescript
// Conceptual UCP integration for AI agent
import { UCPClient } from '@google/ucp-sdk'; // Hypothetical

const ucpClient = new UCPClient({
  merchantId: 'your-merchant-id',
  apiKey: process.env.UCP_API_KEY,
});

// Agent tool for product search
async function searchProducts(query: string) {
  return await ucpClient.products.search({ query });
}

// Agent tool for checkout
async function initiateCheckout(productId: string, customerId: string) {
  return await ucpClient.checkout.create({
    productId,
    customerId,
    protocol: 'native', // or 'embedded'
  });
}

// Integrate with Gemini agent
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Find me wireless headphones under $100',
  config: {
    tools: [
      {
        functionDeclarations: [
          {
            name: 'search_products',
            description: 'Search for products via UCP',
            parametersJsonSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
            },
          },
        ],
      },
    ],
  },
});
```

### Strategic Implications

- **Standardization:** Eliminates need for custom integrations between every AI agent and merchant
- **Multi-Cloud Support:** Works across Google Cloud, AWS, Azure-hosted agents
- **Commerce Evolution:** Shifts commerce from "search and browse" to "ask and buy"

---

## Anthropic API vs Vertex AI Comparison

### Comparison Matrix

| **Aspect**              | **Anthropic Direct API**                                                      | **Vertex AI (Claude Models)**                                                              |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Access**              | API key only, no infrastructure setup                                         | Requires GCP project, service accounts, regional endpoints                                 |
| **New Features**        | Immediate access when Anthropic announces                                     | Days to weeks delay for Google Cloud integration                                           |
| **Pricing**             | Base Anthropic pricing                                                        | Google Cloud markup on regional endpoints                                                  |
| **Billing**             | Direct Anthropic invoice                                                      | GCP invoice (unified cloud billing)                                                        |
| **Batch Processing**    | Significantly reduced costs                                                   | Standard pricing                                                                           |
| **Prompt Caching**      | Dramatic cost reduction for repeated context                                  | Same feature, may have pricing differences                                                 |
| **Compliance**          | Standard Anthropic compliance                                                 | FedRAMP High, operates within GCP authorization boundary                                   |
| **Governance**          | Anthropic's native controls                                                   | GCP-native IAM, VPC, audit logging, centralized controls                                   |
| **Network Integration** | Public internet endpoints                                                     | Private connectivity via VPC, Private Service Connect                                      |
| **Multi-Cloud**         | Consistent endpoints across providers                                         | GCP-specific endpoints                                                                     |
| **Cloud Lock-In**       | Avoids cloud vendor lock-in                                                   | Deeper GCP integration                                                                     |
| **Global Endpoints**    | Standard Anthropic global routing                                             | New global endpoints (public preview) - dynamic regional routing                           |
| **Adoption**            | Direct Anthropic customer base                                                | 4,000+ customers on Vertex AI                                                              |
| **Best For**            | Multi-cloud, faster feature access, simpler implementation, cost optimization | Fully GCP workloads, private connectivity, compliance requirements, centralized governance |

### Feature Availability Comparison

| **Feature**        | **Anthropic API** | **Vertex AI** | **Notes**                             |
| ------------------ | ----------------- | ------------- | ------------------------------------- |
| Claude Opus 4.5    | ✅                | ✅            | Generally available on both           |
| Claude Sonnet 4.5  | ✅                | ✅            | Generally available on both           |
| Streaming          | ✅                | ✅            | SSE support                           |
| Function Calling   | ✅                | ✅            | Full support                          |
| Computer Use       | ✅                | ✅            | Available on both                     |
| Prompt Caching     | ✅                | ⚠️            | May launch on Anthropic API first     |
| New Model Variants | ✅ First          | ⏱️ Delayed    | Anthropic API gets new models first   |
| Batch API          | ✅                | ❓            | Check Vertex AI docs for availability |

### When to Choose Anthropic Direct API

1. **Multi-cloud or hybrid** infrastructure
2. **Faster access** to new Claude features and models
3. **Simpler implementation** without GCP overhead
4. **Cost optimization** via batch processing and prompt caching
5. **Avoiding cloud lock-in**
6. **Consistent endpoints** across providers

### When to Choose Vertex AI

1. **Fully GCP workloads** (already on Google Cloud)
2. **Private connectivity** requirements (VPC, Private Service Connect)
3. **FedRAMP High compliance** needed
4. **Centralized GCP governance** (IAM, Cloud Logging, unified billing)
5. **Path of least resistance** for existing GCP customers
6. **Global availability** needs (dynamic regional routing)

### Cost Considerations

**Anthropic API Advantages:**

- Base pricing without cloud markup
- Batch processing discounts
- Prompt caching economics (available first)

**Vertex AI Advantages:**

- Unified GCP billing (easier accounting for GCP-heavy orgs)
- Committed use discounts (if using provisioned throughput)
- No separate vendor relationship

**Hidden Costs:**

- Vertex AI charges **GCP markup** on regional endpoints
- Different endpoint types (regional vs. global) have different rates

### Performance Considerations

**Anthropic API:**

- Direct routing to Anthropic infrastructure
- Optimized for Anthropic's global network

**Vertex AI:**

- New global endpoints (public preview) enhance availability
- Dynamic regional routing improves latency
- Closer integration with other GCP services (e.g., Vertex AI Search for grounding)

### Recommendation Framework

```
IF workload is 100% on GCP AND compliance needs FedRAMP High
  → Use Vertex AI

ELSE IF need fastest access to new Claude features
  → Use Anthropic Direct API

ELSE IF multi-cloud or planning to be cloud-agnostic
  → Use Anthropic Direct API

ELSE IF need private VPC connectivity and GCP-native governance
  → Use Vertex AI

ELSE IF optimizing for cost (batch processing, prompt caching)
  → Use Anthropic Direct API (initially, verify Vertex AI pricing)

ELSE
  → Default to Anthropic Direct API for simplicity
```

---

## Enterprise Considerations

### Multi-Tenant Isolation

While Vertex AI doesn't provide explicit multi-tenant features, Google Cloud's native isolation boundaries apply:

**Docs:** https://docs.cloud.google.com/vertex-ai/docs/general/netsec-overview

#### **Isolation Strategies**

1. **Project-Based Isolation** (Recommended for most SaaS)
   - Projects are GCP's original isolation boundary
   - Separate Vertex AI resources per tenant
   - Dedicated quotas and billing per tenant
   - Same boundary Google uses for non-organization customers

2. **Domain-Based Isolation** (Enterprise)
   - Very powerful isolation boundary
   - Same boundary Google uses for enterprise customers
   - Familiar to enterprise users

3. **Tenancy Units**
   - Per-service, per-consumer isolated environments
   - Single tenancy unit for all tenant-specific resources

#### **Data Isolation Guarantees**

- **Gemini Models:** Cached data is isolated at the **project level**
- **In-Memory Only:** Customer data cached in-memory (not at-rest)
- **24-Hour TTL:** Cached data automatically purged
- **No Training Use:** Google won't use your data without permission

**Source:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention

#### **Network Isolation**

**Private Service Access (PSA):**

- Private connection between your VPC and Vertex AI's VPC
- Built on VPC peering
- No public internet exposure

**Private Service Connect (PSC):**

- Vertex AI Pipelines can leverage PSC Network Attachment
- Multi-NIC instance between producer and consumer networks
- **Codelabs:** https://codelabs.developers.google.com/psc-interface-pipelines

#### **Multi-Tenant Best Practices**

1. **Resource Naming:** Include tenant identifier in all resource names
2. **Tagging:** Use GCP labels to tag resources by tenant
3. **Quotas:** Set per-project quotas to prevent tenant resource exhaustion
4. **Monitoring:** Separate Cloud Monitoring workspaces per tenant
5. **Billing:** Use separate billing accounts or sub-accounts per tenant
6. **Audit Logging:** Enable Cloud Audit Logs for all tenant operations

**GenAI Security Blog:** https://www.wiz.io/blog/genai-tenant-isolation

### Data Residency & Compliance

#### **Regional Deployment**

Vertex AI supports regional endpoints:

- `us-central1` (Iowa)
- `us-east4` (Virginia)
- `europe-west1` (Belgium)
- Many more regions

**Location Specification:**

```typescript
const ai = new GoogleGenAI({
  vertexai: true,
  project: 'your-project',
  location: 'europe-west1', // EU data residency
});
```

#### **Compliance Certifications**

- **FedRAMP High** (Claude on Vertex AI)
- **GDPR** compliant (EU regions)
- **HIPAA** support available
- **ISO 27001, SOC 2, SOC 3**
- See: https://cloud.google.com/security/compliance

#### **Data Retention**

- **Zero Data Retention:** Gemini models don't store customer data at-rest
- **24-Hour TTL:** In-memory cache only
- **Opt-In Logging:** Request-response logging (30-day retention) is optional

### Cost Monitoring & Quotas

#### **Quotas**

Vertex AI enforces quotas to prevent runaway costs and ensure fair resource allocation.

**Types of Quotas:**

- **Rate Quotas:** Requests per minute (RPM)
- **Usage Quotas:** Tokens per day/month
- **Concurrent Requests:** Simultaneous requests

**Monitoring Quotas:**

```bash
gcloud compute project-info describe --project=your-project
```

**Adjusting Quotas:**

- Request quota increases via Google Cloud Console
- Quotas page: IAM & Admin → Quotas

#### **Cost Monitoring**

**Cloud Billing Reports:**

- Real-time cost dashboards
- Per-project cost breakdown
- Cost forecasting

**Budget Alerts:**

```bash
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Vertex AI Budget" \
  --budget-amount=10000 \
  --threshold-rule=percent=50,percent=90
```

**Cost Optimization Tips:**

1. **Use Free Tier:** 1,000 requests/day for Gemini models
2. **Model Selection:** Flash models cost less than Pro
3. **Prompt Caching:** Cache repeated context (reduces tokens)
4. **Batch Processing:** Async batch jobs for non-real-time workloads
5. **Streaming:** Only use when needed (not cheaper, but better UX)

**Pricing Calculator:**

- https://cloud.google.com/vertex-ai/generative-ai/pricing

### Performance Benchmarks

#### **Latency Considerations**

- **Model Size vs. Speed:**
  - Flash models: Lower latency
  - Pro models: Higher latency, better quality

- **Regional Endpoints:** Choose region closest to users

- **Global Endpoints (Preview):** Dynamic routing to nearest available region

#### **Throughput**

- **Requests per Minute (RPM):** Varies by model and quota
- **Provisioned Throughput:** Available for guaranteed capacity (Claude models)

#### **Token Limits**

- **1M Token Context:** Gemini 2.5+, Gemini 3
- **Large Context Use Cases:** Document analysis, codebase understanding

---

## Migration & Best Practices

### Migration from Legacy SDK

#### **From @google-cloud/vertexai to @google/genai**

**Deprecated:** `@google-cloud/vertexai` (removed June 24, 2026)
**New:** `@google/genai` (recommended for all new projects)

**Migration Steps:**

1. **Install New SDK**

   ```bash
   npm uninstall @google-cloud/vertexai
   npm install @google/genai
   ```

2. **Update Imports**

   ```typescript
   // OLD
   import { VertexAI } from '@google-cloud/vertexai';

   // NEW
   import { GoogleGenAI } from '@google/genai';
   ```

3. **Update Initialization**

   ```typescript
   // OLD
   const vertexAI = new VertexAI({
     project: 'your-project',
     location: 'us-central1',
   });
   const model = vertexAI.preview.getGenerativeModel({ model: 'gemini-pro' });

   // NEW
   const ai = new GoogleGenAI({
     vertexai: true,
     project: 'your-project',
     location: 'us-central1',
   });
   ```

4. **Update API Calls**

   ```typescript
   // OLD
   const result = await model.generateContent({
     contents: [{ role: 'user', parts: [{ text: prompt }] }],
   });

   // NEW
   const response = await ai.models.generateContent({
     model: 'gemini-2.5-flash',
     contents: prompt,
   });
   ```

5. **Test Thoroughly**
   - Response structure may differ slightly
   - Error handling types have changed (`ApiError`)
   - Streaming API is similar but verify behavior

### Alternative SDK: @ai-sdk/google-vertex

If you're using Vercel AI SDK framework:

```bash
npm install @ai-sdk/google-vertex
```

**Features:**

- Node.js and Edge runtime support
- Edge runtime: `@ai-sdk/google-vertex/edge` sub-module
- Compatible with AI SDK patterns

**npm:** https://www.npmjs.com/package/@ai-sdk/google-vertex
**Docs:** https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex

### Best Practices for 2026

#### **1. Use Latest Models**

- **Migrate to Gemini 2.5+ or Gemini 3** before March 3, 2026 (Gemini 2.0 retirement)
- Prefer `gemini-2.5-flash` for most use cases (cost-effective, fast)
- Use `gemini-3-pro` for complex reasoning and agentic workflows

#### **2. Implement Robust Error Handling**

```typescript
import { ApiError } from '@google/genai';

async function safeGenerate(prompt: string) {
  try {
    return await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      // Handle specific API errors
      if (error.status === 429) {
        // Rate limited - implement exponential backoff
      } else if (error.status === 500) {
        // Server error - retry with different parameters
      }
    }
    throw error;
  }
}
```

#### **3. Optimize Token Usage**

- **Prompt Caching:** Cache system instructions and large contexts
- **Streaming:** Only use when UI requires real-time feedback
- **Model Selection:** Flash models for speed, Pro for accuracy

#### **4. Security Best Practices**

- **Never commit API keys:** Use environment variables
- **Service Account Keys:** Avoid in production, use Workload Identity
- **ADC:** Use Application Default Credentials for GCP environments
- **Least Privilege IAM:** Grant minimum necessary permissions

#### **5. Multi-Tenant Isolation Checklist**

- [ ] Separate GCP projects per tenant (or shared with strong tagging)
- [ ] Include `tenantId` in all resource names and tags
- [ ] Cache keys include tenant identifier: `tenant:${tenantId}:resource:${id}`
- [ ] Implement per-tenant quotas
- [ ] Enable audit logging for all tenant operations
- [ ] Use private VPC networking for sensitive workloads

#### **6. Monitoring & Observability**

```typescript
// Example: Log all Vertex AI requests with tenant context
async function generateWithLogging(tenantId: string, prompt: string) {
  const startTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    console.log({
      event: 'vertex_ai_request',
      tenantId,
      model: 'gemini-2.5-flash',
      promptTokens: response.usageMetadata?.promptTokenCount,
      responseTokens: response.usageMetadata?.candidatesTokenCount,
      latencyMs: Date.now() - startTime,
      success: true,
    });

    return response;
  } catch (error) {
    console.error({
      event: 'vertex_ai_error',
      tenantId,
      model: 'gemini-2.5-flash',
      error: error.message,
      latencyMs: Date.now() - startTime,
      success: false,
    });

    throw error;
  }
}
```

#### **7. Cost Optimization**

- **Free Tier:** Utilize 1,000 daily requests
- **Model Selection:** Start with Flash models
- **Batch Processing:** For non-real-time workloads
- **Regional Endpoints:** Avoid unnecessary global routing (if not needed)
- **Prompt Engineering:** Shorter prompts reduce costs

#### **8. Testing Strategy**

- **Unit Tests:** Mock Vertex AI SDK responses
- **Integration Tests:** Use test GCP project with low quotas
- **Load Tests:** Verify rate limits and error handling
- **Cost Tests:** Monitor token usage in staging

---

## Additional Resources

### Official Documentation

- **Vertex AI Main Docs:** https://docs.cloud.google.com/vertex-ai
- **Generative AI Docs:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs
- **Agent Builder Docs:** https://docs.cloud.google.com/agent-builder
- **Model Garden:** https://cloud.google.com/model-garden
- **Pricing:** https://cloud.google.com/vertex-ai/generative-ai/pricing
- **Release Notes:** https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes

### SDK Resources

- **@google/genai npm:** https://www.npmjs.com/package/@google/genai
- **GitHub:** https://github.com/googleapis/js-genai
- **API Reference:** https://googleapis.github.io/js-genai/
- **Gemini API Docs:** https://ai.google.dev/gemini-api/docs

### Blogs & Announcements

- **Gemini 3 Flash Launch:** https://blog.google/products/gemini/gemini-3-flash/
- **Veo, Imagen, Lyria Updates:** https://cloud.google.com/blog/products/ai-machine-learning/announcing-veo-3-imagen-4-and-lyria-2-on-vertex-ai
- **Claude on Vertex AI:** https://cloud.google.com/blog/products/ai-machine-learning/anthropics-claude-opus-4-and-claude-sonnet-4-on-vertex-ai
- **UCP Announcement:** https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/

### Training & Courses

- **Claude on Vertex AI Course:** https://anthropic.skilljar.com/claude-with-google-vertex
- **Google Cloud Skills Boost:** https://www.cloudskillsboost.google/
- **Agent Development Kit Docs:** https://google.github.io/adk-docs/

### Community Resources

- **Google Developers Blog:** https://developers.googleblog.com/
- **Stack Overflow:** [google-vertex-ai] tag
- **Google Cloud Community:** https://www.googlecloudcommunity.com/

---

## Key Takeaways for MAIS Project

### 1. **SDK Migration Required**

- Migrate from `@google-cloud/vertexai` to `@google/genai` before June 24, 2026
- Test thoroughly as API surface has changed

### 2. **Model Selection**

- **Primary:** `gemini-2.5-flash` for customer chatbot (fast, cost-effective)
- **Fallback:** `gemini-3-pro` for complex reasoning (onboarding advisor)
- **Avoid:** Gemini 2.0 models (retiring March 3, 2026)

### 3. **Multi-Tenant Isolation**

- Use GCP project-level isolation for enterprise customers
- Include `tenantId` in all cache keys and resource tags
- Enable private VPC networking for sensitive tenants

### 4. **Cost Management**

- Start with free tier (1,000 requests/day)
- Implement prompt caching for repeated system instructions
- Monitor token usage per tenant
- Set up billing alerts

### 5. **Feature Opportunities**

- **Grounding:** Integrate Google Search for real-time information in chatbot
- **Multimodal:** Consider Imagen 3 for marketing asset generation
- **UCP:** Future integration for agent-powered purchasing (if applicable)

### 6. **Comparison with Anthropic**

- **Stick with Anthropic Direct API for:**
  - Faster access to new Claude features
  - Lower costs (no GCP markup)
  - Simpler implementation
- **Consider Vertex AI Claude if:**
  - FedRAMP High compliance required
  - Fully GCP infrastructure
  - Need private VPC connectivity

### 7. **Agent Development**

- **Vertex AI Agent Builder** may be overkill for MAIS use case
- **Custom implementation** with `@google/genai` SDK provides more control
- **Function calling** patterns are similar to Anthropic's tool use

### 8. **Security Checklist**

- [ ] Never commit service account keys
- [ ] Use ADC in production
- [ ] Implement rate limiting per tenant
- [ ] Enable safety filters (BLOCK_MEDIUM_AND_ABOVE)
- [ ] Log all requests with tenant context
- [ ] Cache keys include tenant ID

---

**Research Completed:** January 13, 2026
**Last Updated:** January 13, 2026
**Next Review:** June 2026 (SDK deprecation deadline)

---

## Sources

### Vertex AI & Gemini Models

- [Google models | Generative AI on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models)
- [Vertex AI Platform](https://cloud.google.com/vertex-ai)
- [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes)
- [Google AI Studio Review 2026](https://aitoolanalysis.com/google-ai-studio-review/)
- [Introducing Gemini 3 Flash](https://blog.google/products/gemini/gemini-3-flash/)
- [Vertex AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
- [Gemini 3 Pro Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro)
- [Gemini Live API on Vertex AI](https://cloud.google.com/blog/products/ai-machine-learning/gemini-live-api-available-on-vertex-ai)

### Agent Builder

- [Vertex AI Agent Builder overview](https://docs.cloud.google.com/agent-builder/overview)
- [Vertex AI Agent Builder release notes](https://docs.cloud.google.com/agent-builder/release-notes)
- [Vertex AI Agent Engine overview](https://docs.cloud.google.com/agent-builder/agent-engine/overview)
- [Agent Designer overview](https://docs.cloud.google.com/agent-builder/agent-designer)
- [Build and scale AI agents with Vertex AI Agent Builder](https://cloud.google.com/blog/products/ai-machine-learning/more-ways-to-build-and-scale-ai-agents-with-vertex-ai-agent-builder)
- [Enhanced Tool Governance](https://cloud.google.com/blog/products/ai-machine-learning/new-enhanced-tool-governance-in-vertex-ai-agent-builder)

### Node.js SDK

- [GitHub - googleapis/js-genai](https://github.com/googleapis/js-genai)
- [@google/genai - npm](https://www.npmjs.com/package/@google/genai)
- [Google Gen AI SDK Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview)
- [Vertex AI Node.js SDK](https://googleapis.dev/nodejs/vertexai/latest/index.html)
- [@ai-sdk/google-vertex](https://www.npmjs.com/package/@ai-sdk/google-vertex)
- [AI SDK Providers: Google Vertex AI](https://ai-sdk.dev/providers/ai-sdk-providers/google-vertex)

### Advanced Features

- [Grounding with Google Search](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search)
- [Grounding overview](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview)
- [Safety and content filters](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/configure-safety-filters)
- [Gemini for safety filtering and content moderation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-for-filtering-and-moderation)
- [Safety in Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/safety-overview)
- [Function calling introduction](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling)
- [Tool use with Live API](https://ai.google.dev/gemini-api/docs/live-tools)

### Claude on Vertex AI

- [Anthropic's Claude models on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude)
- [Claude on Vertex AI - Official Docs](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai)
- [Claude Opus 4 and Sonnet 4 on Vertex AI](https://cloud.google.com/blog/products/ai-machine-learning/anthropics-claude-opus-4-and-claude-sonnet-4-on-vertex-ai)
- [Model Garden - Claude](https://cloud.google.com/products/model-garden/claude)
- [Claude on Vertex AI vs native API](https://amitkoth.com/claude-vertex-ai-vs-native-api/)

### Multimodal Generation

- [Veo on Vertex AI video generation API](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
- [Veo 3 Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-0-generate)
- [Veo 3.1 Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate)
- [Announcing Veo 3, Imagen 4, and Lyria 2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-veo-3-imagen-4-and-lyria-2-on-vertex-ai)
- [Introducing Veo and Imagen 3 on Vertex AI](https://cloud.google.com/blog/products/ai-machine-learning/introducing-veo-and-imagen-3-on-vertex-ai)

### Universal Commerce Protocol

- [Google Universal Commerce Protocol Guide](https://developers.google.com/merchant/ucp)
- [Under the Hood: UCP](https://developers.googleblog.com/under-the-hood-universal-commerce-protocol-ucp/)
- [New tech and tools for agentic shopping era](https://blog.google/products/ads-commerce/agentic-commerce-ai-tools-protocol-retailers-platforms/)
- [Google announces UCP](https://techcrunch.com/2026/01/11/google-announces-a-new-protocol-to-facilitate-commerce-using-ai-agents/)
- [Building the Universal Commerce Protocol - Shopify](https://shopify.engineering/UCP)

### Enterprise & Security

- [Authenticate to Vertex AI](https://docs.cloud.google.com/vertex-ai/docs/authentication)
- [Vertex AI networking access overview](https://docs.cloud.google.com/vertex-ai/docs/general/netsec-overview)
- [Vertex AI and zero data retention](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention)
- [Leveraging GenAI in Cloud Apps Without Risking User Data](https://www.wiz.io/blog/genai-tenant-isolation)
- [Private Service Connect Interface Vertex AI Pipelines](https://codelabs.developers.google.com/psc-interface-pipelines)
