'use client';

import { AgentChat } from '@/components/agent';

/**
 * Business Growth Assistant Page
 *
 * AI-powered chat interface for tenant admins to manage their business.
 * Uses the MAIS Business Growth Agent to help with:
 * - Package management
 * - Pricing strategy
 * - Booking management
 * - Storefront configuration
 * - Marketing guidance
 */
export default function AssistantPage() {
  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-text-primary">
          Business Growth Assistant
        </h1>
        <p className="mt-2 text-text-muted">
          Your AI partner for growing your business. Ask anything about packages, pricing, bookings, or marketing.
        </p>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 min-h-0">
        <AgentChat
          className="h-full"
          onSessionStart={(sessionId) => {
            // Could track analytics here
            console.log('Agent session started:', sessionId);
          }}
          onProposalConfirmed={(proposalId, result) => {
            // Could show toast notification here
            console.log('Proposal confirmed:', proposalId, result);
          }}
        />
      </div>
    </div>
  );
}
