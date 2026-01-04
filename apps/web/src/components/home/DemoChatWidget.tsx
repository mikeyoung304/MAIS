'use client';

import { Bot, User, Send, CheckCircle } from 'lucide-react';

/**
 * DemoChatWidget - Static mockup of the customer chatbot for marketing
 *
 * Shows a scripted conversation demonstrating the AI booking assistant.
 * This is purely presentational - no API calls.
 */

// Demo conversation showing the booking flow
const demoMessages = [
  {
    id: '1',
    role: 'assistant' as const,
    content: "Hi! I'm here to help you book a session. What can I help you with today?",
  },
  {
    id: '2',
    role: 'user' as const,
    content: "I'd like to book a consultation for next week",
  },
  {
    id: '3',
    role: 'assistant' as const,
    content:
      'I have Tuesday at 2pm or Thursday at 10am available. The Essential package ($275) includes 4 sessions with priority booking. Which works better for you?',
  },
  {
    id: '4',
    role: 'user' as const,
    content: 'Thursday at 10am please',
  },
];

// Booking confirmation preview
const bookingPreview = {
  service: 'Essential Package',
  date: 'Thursday, Jan 9 at 10:00 AM',
  price: '$275',
};

export function DemoChatWidget() {
  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden w-full max-w-[380px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-sage/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-sage" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900">Your Business</h3>
            <p className="text-xs text-neutral-500">Booking Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-neutral-500">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="px-4 py-4 space-y-3 bg-neutral-50/50 h-[280px] overflow-hidden">
        {demoMessages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div key={message.id} className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  isUser ? 'bg-neutral-200' : 'bg-sage/15'
                }`}
              >
                {isUser ? (
                  <User className="w-3.5 h-3.5 text-neutral-500" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-sage" />
                )}
              </div>

              {/* Content */}
              <div className={`max-w-[75%] ${isUser ? 'text-right' : ''}`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    isUser
                      ? 'bg-sage text-white rounded-br-sm'
                      : 'bg-white text-neutral-900 border border-neutral-100 rounded-bl-sm'
                  }`}
                >
                  <p className="leading-relaxed">{message.content}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Booking Confirmation Card */}
      <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
        <p className="font-medium text-amber-900 text-sm mb-2">Confirm your booking</p>
        <div className="text-xs text-amber-800 space-y-0.5 mb-3">
          <p>
            <span className="font-medium">Service:</span> {bookingPreview.service}
          </p>
          <p>
            <span className="font-medium">Date:</span> {bookingPreview.date}
          </p>
          <p>
            <span className="font-medium">Price:</span> {bookingPreview.price}
          </p>
        </div>
        <button className="w-full bg-sage hover:bg-sage-hover text-white rounded-full py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
          <CheckCircle className="w-4 h-4" />
          Confirm Booking
        </button>
      </div>

      {/* Input (disabled, for visual only) */}
      <div className="px-4 py-3 border-t border-neutral-100 bg-white">
        <div className="flex gap-2">
          <div className="flex-1 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-400 bg-neutral-50">
            Ask about services or booking...
          </div>
          <button className="h-10 w-10 shrink-0 rounded-full bg-sage flex items-center justify-center">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * DemoChatFrame - Wraps the chat demo in a browser-style frame
 * Similar to DemoStorefrontFrame but for the chatbot
 */
export function DemoChatFrame() {
  return (
    <div className="relative">
      {/* Subtle glow effect behind widget */}
      <div className="absolute inset-0 bg-sage/10 blur-3xl rounded-full scale-75" />

      {/* The widget */}
      <div className="relative">
        <DemoChatWidget />
      </div>

      {/* Floating chat bubble indicator */}
      <div className="absolute -bottom-4 -right-4 w-14 h-14 rounded-full bg-sage shadow-lg flex items-center justify-center animate-bounce">
        <Bot className="w-6 h-6 text-white" />
      </div>
    </div>
  );
}

export default DemoChatWidget;
