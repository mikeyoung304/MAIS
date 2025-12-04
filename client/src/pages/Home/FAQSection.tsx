import { useState } from 'react';
import { Container } from '@/ui/Container';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    question: 'How does the revenue-sharing model work?',
    answer:
      "We take a small percentage (typically 10-15%) of the new revenue we help you generate. No monthly fees, no upfront costs. We only profit when you do—so we're 100% aligned with your success.",
  },
  {
    question: 'What if I already have a website?',
    answer:
      "Great! We can work with your existing site or help you upgrade it. Our systems integrate with most platforms, and we'll customize everything to match your brand.",
  },
  {
    question: 'How long until I see results?',
    answer:
      'Most members see their booking system live within 2 weeks. Measurable revenue impact typically shows within 60-90 days, though some members fill their calendar in the first month.',
  },
  {
    question: "What's included in the AI strategist support?",
    answer:
      'You get a dedicated strategist who handles your marketing campaigns, booking setup, website updates, and growth strategy. Think of them as your part-time marketing department—without the salary.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      "Yes. There are no long-term contracts. If you're not seeing results, you can leave. We're confident enough in our partnership model that we don't need to lock you in.",
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-neutral-200">
      <button
        onClick={onToggle}
        className="w-full py-6 flex items-center justify-between text-left hover:text-macon-orange transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-xl font-semibold text-neutral-900 pr-4">{question}</span>
        <ChevronDown
          className={cn(
            'w-6 h-6 text-neutral-500 flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 pb-6' : 'max-h-0'
        )}
      >
        <p className="text-lg text-neutral-600 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-16 md:py-24 bg-neutral-50">
      <Container>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2
              id="faq-heading"
              className="font-heading text-4xl md:text-5xl font-bold mb-4 text-neutral-900"
            >
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-neutral-600">
              Everything you need to know about the Growth Partnership
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 px-8">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
