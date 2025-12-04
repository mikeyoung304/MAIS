import { Container } from "@/ui/Container";
import { Sparkles } from "lucide-react";

/**
 * StorefrontSection - 3-Tier Storefront Explanation
 *
 * Inline tier cards showcasing Entry, Core, and Premium offerings.
 * Core tier visually emphasized as the primary revenue driver.
 */
export function StorefrontSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="storefront-heading"
      className="py-24 sm:py-32 bg-surface"
    >
      <Container>
        <div className="max-w-5xl mx-auto">
          {/* Section headline */}
          <h2
            id="storefront-heading"
            className="font-serif text-4xl sm:text-5xl font-bold text-text-primary text-center mb-6"
          >
            A 3-tier storefront built for how people buy
          </h2>

          {/* Intro */}
          <p className="text-xl text-text-muted text-center mb-16 max-w-3xl mx-auto">
            Clients choose, book, and pay in one place. No chasing.
          </p>

          {/* 3 Tier Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Tier 1 - Entry Offer */}
            <div className="bg-surface-alt border border-sage-light/30 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-sage font-bold text-lg">1</span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-text-primary mb-3">
                Entry Offer
              </h3>
              <p className="text-text-muted leading-relaxed">
                Low-friction way to start. No big commitment.
              </p>
            </div>

            {/* Tier 2 - Core Package (Emphasized) */}
            <div className="bg-sage text-white rounded-2xl p-8 text-center shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sage-hover px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
                Most Popular
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-3">
                Core Package
              </h3>
              <p className="text-white/90 leading-relaxed">
                Your primary revenue driver. Clear value. Obvious choice.
              </p>
            </div>

            {/* Tier 3 - Premium Experience */}
            <div className="bg-surface-alt border border-sage-light/30 rounded-2xl p-8 text-center">
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-sage font-bold text-lg">3</span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-text-primary mb-3">
                Premium Experience
              </h3>
              <p className="text-text-muted leading-relaxed">
                High-touch, high-ticket. The full experience.
              </p>
            </div>
          </div>

          {/* Supporting line */}
          <p className="text-lg text-text-muted text-center max-w-3xl mx-auto">
            Clear copy. Smart intake. Automated follow-ups. Fewer cracks to fall through.
          </p>
        </div>
      </Container>
    </section>
  );
}
