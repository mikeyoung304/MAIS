import { Container } from "@/ui/Container";

/**
 * StorefrontSection - The 3-tier silhouette
 *
 * Show the shape, not the psychology. High-end agency approach.
 */
export function StorefrontSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="storefront-heading"
      className="py-20 sm:py-28 bg-surface"
    >
      <Container>
        <div className="max-w-4xl mx-auto text-center">
          <h2
            id="storefront-heading"
            className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-12"
          >
            Your storefront. Three tiers. One flow.
          </h2>

          {/* 3 Tier Visual - Clean silhouette */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <div className="bg-surface-alt border border-sage-light/20 rounded-xl p-6">
              <div className="text-sage font-semibold text-sm uppercase tracking-wide mb-2">Entry</div>
              <div className="h-16 bg-sage-light/10 rounded-lg" />
            </div>

            <div className="bg-sage text-white rounded-xl p-6 shadow-lg">
              <div className="font-semibold text-sm uppercase tracking-wide mb-2 text-white/80">Core</div>
              <div className="h-16 bg-white/20 rounded-lg" />
            </div>

            <div className="bg-surface-alt border border-sage-light/20 rounded-xl p-6">
              <div className="text-sage font-semibold text-sm uppercase tracking-wide mb-2">Premium</div>
              <div className="h-16 bg-sage-light/10 rounded-lg" />
            </div>
          </div>

          <p className="text-text-muted">
            Clients pick. Book. Pay. Done.
          </p>
        </div>
      </Container>
    </section>
  );
}
