'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

// Conversational FAQ copy (Frontend Design reviewer)
const faqs = [
  {
    question: 'I already have a website. What happens to it?',
    answer:
      "Keep it, or let us replace it. Most members find the HANDLED site converts better — it's built for booking, not just looking pretty. Your call.",
  },
  {
    question: 'What if I want to leave?',
    answer:
      "Leave. No contracts, no fees, no guilt trip. We earn your business every month. If we're not worth it, you shouldn't pay for it.",
  },
  {
    question: 'How fast can I get set up?',
    answer:
      'Working storefront in under an hour. Enter your services, pricing, availability — we handle the rest. Really.',
  },
  {
    question: "What's this AI chatbot thing?",
    answer:
      'A 24/7 assistant trained on YOUR business. Answers questions, checks your calendar, helps clients book. Works while you sleep. Wakes you up to money.',
  },
  {
    question: 'Do I need to be technical?',
    answer:
      "Can you fill out a form? Then you're qualified. No code, no installs, no 'just watch this 45-minute tutorial.'",
  },
  {
    question: 'How do payments work?',
    answer:
      'Stripe handles everything — credit cards, Apple Pay, Google Pay. Funds go straight to your account. We never touch your money.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // Arrow key navigation between questions (Kieran)
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % faqs.length;
      document.getElementById(`faq-trigger-${next}`)?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + faqs.length) % faqs.length;
      document.getElementById(`faq-trigger-${prev}`)?.focus();
    }
    if (e.key === 'Home') {
      e.preventDefault();
      document.getElementById('faq-trigger-0')?.focus();
    }
    if (e.key === 'End') {
      e.preventDefault();
      document.getElementById(`faq-trigger-${faqs.length - 1}`)?.focus();
    }
  };

  return (
    <section className="py-20 md:py-28 px-6 bg-surface-alt" id="faq">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary text-center mb-12">
          Questions? Answers.
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-neutral-800 overflow-hidden"
            >
              <button
                id={`faq-trigger-${i}`}
                aria-expanded={openIndex === i}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className="w-full text-left py-5 px-6 flex justify-between items-center gap-4
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-inset
                           hover:bg-neutral-800/30 transition-colors"
              >
                <span className="font-medium text-text-primary">{faq.question}</span>
                <motion.span
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-5 h-5 text-text-muted" />
                </motion.span>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-text-muted leading-relaxed">{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
