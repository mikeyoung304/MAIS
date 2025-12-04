import { Container } from '@/ui/Container';
import { Grid, Layers, Shield } from 'lucide-react';

/**
 * PsychologySection - Why 3 Tiers Work
 *
 * Explains the psychology behind the 3-tier model.
 * Positions MaconAI as the expert who has done the research.
 */
export function PsychologySection() {
  return (
    <section
      id="psychology"
      aria-labelledby="psychology-heading"
      className="py-24 sm:py-32 bg-surface-alt"
    >
      <Container>
        <div className="max-w-5xl mx-auto">
          {/* Section headline */}
          <h2
            id="psychology-heading"
            className="font-serif text-4xl sm:text-5xl font-bold text-text-primary text-center mb-6"
          >
            Why three tiers work better than "DM me for pricing"
          </h2>

          {/* Intro */}
          <p className="text-xl text-text-muted text-center mb-16 max-w-3xl mx-auto">
            People don't like guessing. They want to feel in control, informed, and confident
            they're choosing the right level of service. A 3-tier storefront taps into that:
          </p>

          {/* 3 Principles */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Principle 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-sage-light/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Grid className="w-8 h-8 text-sage" />
              </div>
              <h3 className="font-serif text-xl font-bold text-text-primary mb-3">
                Clear choices reduce decision friction
              </h3>
              <p className="text-text-muted leading-relaxed">
                With three well-defined options, clients can quickly see "which one is me" instead
                of feeling overwhelmed or confused.
              </p>
            </div>

            {/* Principle 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-sage-light/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Layers className="w-8 h-8 text-sage" />
              </div>
              <h3 className="font-serif text-xl font-bold text-text-primary mb-3">
                A "middle" option anchors value
              </h3>
              <p className="text-text-muted leading-relaxed">
                Most clients gravitate to the clearly positioned core package. The entry tier lowers
                the barrier to start; the premium tier signals what "top-shelf" looks like and makes
                your core offer feel like a smart, safe decision.
              </p>
            </div>

            {/* Principle 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-sage-light/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-sage" />
              </div>
              <h3 className="font-serif text-xl font-bold text-text-primary mb-3">
                Transparency builds trust
              </h3>
              <p className="text-text-muted leading-relaxed">
                Clear pricing, inclusions, and next steps reduce the anxiety that often stalls
                bookings—especially for high-emotion events like weddings or once-in-a-lifetime
                experiences.
              </p>
            </div>
          </div>

          {/* Authority close */}
          <div className="bg-surface rounded-2xl p-8 text-center">
            <p className="text-lg text-text-primary leading-relaxed max-w-3xl mx-auto">
              At MaconAI, we've done the research, tested the flows, and refined the wording. You're
              not starting from a blank page or guessing at what might work. You're plugging into a
              proven storefront pattern tuned for service businesses that sell trust, timing, and
              experience.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
