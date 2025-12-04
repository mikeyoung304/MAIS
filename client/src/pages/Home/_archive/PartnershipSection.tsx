import { Container } from '@/ui/Container';
import { DollarSign, Percent } from 'lucide-react';

/**
 * PartnershipSection - Revenue-Share Partnership Model
 *
 * Explains the business model: monthly fee + percentage of sales.
 * Frames it as aligned incentives, not pricing complexity.
 */
export function PartnershipSection() {
  return (
    <section
      id="partnership"
      aria-labelledby="partnership-heading"
      className="py-24 sm:py-32 bg-surface-alt"
    >
      <Container>
        <div className="max-w-4xl mx-auto">
          {/* Section headline */}
          <h2
            id="partnership-heading"
            className="font-serif text-4xl sm:text-5xl font-bold text-text-primary text-center mb-6"
          >
            A simple partnership that scales with your bookings
          </h2>

          {/* Body */}
          <p className="text-xl text-text-muted text-center mb-12 max-w-3xl mx-auto">
            MaconAI works like a growth partner, not just another SaaS tool.
          </p>

          {/* Model breakdown */}
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <div className="bg-surface rounded-2xl p-8 flex items-start gap-4">
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6 text-sage" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary text-lg mb-2">
                  Predictable monthly fee
                </h3>
                <p className="text-text-muted">
                  For hosting, maintenance, and ongoing optimization
                </p>
              </div>
            </div>

            <div className="bg-surface rounded-2xl p-8 flex items-start gap-4">
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Percent className="w-6 h-6 text-sage" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary text-lg mb-2">
                  Percentage of sales
                </h3>
                <p className="text-text-muted">That go through your storefront</p>
              </div>
            </div>
          </div>

          {/* Close */}
          <div className="bg-sage/10 border border-sage/20 rounded-2xl p-8 text-center">
            <p className="text-lg text-text-primary font-medium">
              If your storefront isn't producing, we feel it too. Our incentives are aligned with
              your growth.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
