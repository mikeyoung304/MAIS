import { Container } from '@/ui/Container';
import { Calendar, TrendingUp, Clock } from 'lucide-react';

/**
 * ValueSection - Stories That Stick "Value Story" Pattern
 *
 * Three benefits framed as transformations, not features.
 * Each answers: "What changes in my life?"
 */
export function ValueSection() {
  const values = [
    {
      icon: Clock,
      before: '15+ hours/week on admin',
      after: 'Your weekends back',
      description:
        'AI handles scheduling, invoicing, and follow-ups automatically. You show up and do your work.',
    },
    {
      icon: Calendar,
      before: 'Feast or famine bookings',
      after: 'Consistent pipeline',
      description:
        'AI-driven marketing that learns and improves while you sleep. No more scrambling for clients.',
    },
    {
      icon: TrendingUp,
      before: 'Guessing what works',
      after: 'Data-driven growth',
      description:
        "Our AI tracks what's working and doubles down—automatically. Average partner sees 30% revenue increase.",
    },
  ];

  return (
    <section id="value" aria-labelledby="value-heading" className="py-24 sm:py-32 bg-white">
      <Container>
        <div className="max-w-5xl mx-auto">
          <h2
            id="value-heading"
            className="font-heading text-3xl sm:text-4xl font-bold text-macon-navy mb-4 text-center"
          >
            From surviving to thriving
          </h2>
          <p className="text-xl text-neutral-600 text-center mb-16 max-w-2xl mx-auto">
            Here's what changes when you have a growth partner in your corner.
          </p>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-macon-orange/10 text-macon-orange mb-6">
                  <value.icon className="w-7 h-7" />
                </div>

                {/* Before/After transformation */}
                <div className="mb-4">
                  <p className="text-sm text-neutral-400 line-through mb-1">{value.before}</p>
                  <p className="text-xl font-semibold text-macon-navy">{value.after}</p>
                </div>

                <p className="text-neutral-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
