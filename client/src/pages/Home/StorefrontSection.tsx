import { Container } from '@/ui/Container';
import { Check } from 'lucide-react';

/**
 * StorefrontSection - The solution with 3-tier elevation
 *
 * Show the complete booking system.
 * Core tier elevated, others recessed for visual hierarchy.
 */
export function StorefrontSection() {
  return (
    <section id="solution" aria-labelledby="solution-heading" className="py-32 md:py-40 bg-white">
      <Container>
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2
            id="solution-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-8 leading-[1.1] tracking-tight"
          >
            Your website.
            <br />
            Your storefront.
            <br />
            <span className="text-sage">Done for you.</span>
          </h2>
          <div className="text-xl md:text-2xl text-text-muted font-light leading-relaxed space-y-4">
            <p>
              We design, build, and host a professional site with built-in booking and payments.
            </p>
            <p>
              Clients choose a package, pick a date, and pay — all in one flow.
            </p>
            <p>No plugins to manage. No tools to stitch together. No tech headaches.</p>
          </div>
        </div>

        {/* 3-Tier Cards with elevation */}
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 items-center">
            {/* Entry Tier - Recessed */}
            <div className="transform md:scale-[0.92] md:translate-y-6">
              <TierCard
                name="Entry"
                tagline="Get launched"
                features={[
                  'Professional one-page site',
                  'Core booking flow (packages, calendar, payments)',
                  'Guided setup consultation',
                  'Email support',
                ]}
                emphasized={false}
                bestFor="Best for: getting online with confidence"
              />
            </div>

            {/* Core Tier - Elevated */}
            <div className="relative transform md:scale-105 md:-translate-y-2">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-sage/15 blur-2xl -z-10 rounded-3xl scale-110" />

              {/* Badge */}
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 z-10
                              bg-sage text-white text-xs font-semibold
                              px-4 py-1.5 rounded-full shadow-lg
                              tracking-wider uppercase"
              >
                Most Popular
              </div>

              <TierCard
                name="Core"
                tagline="Get booked consistently"
                features={[
                  'Everything in Entry',
                  'Multi-page site tailored to your offers',
                  'Optimized booking + deposit flow',
                  'Automated confirmations & follow-ups',
                  'Priority support',
                ]}
                emphasized={true}
                bestFor="Best for: turning consistent inquiries into paid bookings"
              />
            </div>

            {/* Premium Tier - Recessed */}
            <div className="transform md:scale-[0.92] md:translate-y-6">
              <TierCard
                name="Premium"
                tagline="Get leverage"
                features={[
                  'Everything in Core',
                  'Offer & pricing refinement',
                  'Conversion optimization',
                  'Advanced automations',
                  'Ongoing priority support & revisions',
                ]}
                emphasized={false}
                bestFor="Best for: maximizing revenue per inquiry"
              />
            </div>
          </div>
        </div>

        {/* Bottom line */}
        <p className="text-center text-text-muted mt-16 text-lg">
          Need a new site? We&apos;ll build it. Already have one? We&apos;ll plug right in.
          <span className="block mt-1 text-text-primary font-medium">
            Your brand. Your bookings. Zero tech headaches.
          </span>
        </p>
      </Container>
    </section>
  );
}

interface TierCardProps {
  name: string;
  tagline: string;
  features: string[];
  emphasized: boolean;
  bestFor?: string;
}

function TierCard({ name, tagline, features, emphasized, bestFor }: TierCardProps) {
  return (
    <div
      className={`rounded-3xl p-8 transition-all duration-300 h-full
                  ${
                    emphasized
                      ? 'bg-white shadow-2xl ring-2 ring-sage/20'
                      : 'bg-white shadow-lg border border-neutral-100'
                  }
                  hover:shadow-xl hover:-translate-y-1`}
    >
      {/* Tier name */}
      <h3 className="text-2xl font-bold text-text-primary mb-2">{name}</h3>

      {/* Tagline */}
      <p className={`text-sm mb-6 ${emphasized ? 'text-sage font-medium' : 'text-text-muted'}`}>
        {tagline}
      </p>

      {/* Features */}
      <ul className="space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${emphasized ? 'text-sage' : 'text-neutral-400'}`}
            />
            <span className="text-text-muted leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      {bestFor && (
        <p className="mt-6 text-sm text-text-muted/80 italic">
          {bestFor}
        </p>
      )}
    </div>
  );
}
