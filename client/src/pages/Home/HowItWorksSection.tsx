import { Container } from '@/ui/Container';
import { AnimatedSection } from '@/components/AnimatedSection';

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-32 md:py-40 bg-neutral-50"
    >
      <Container>
        {/* Header - tight and confident */}
        <div className="max-w-2xl mx-auto text-center mb-16 md:mb-20">
          <span className="inline-block bg-sage/10 text-sage text-sm font-semibold px-4 py-2 rounded-full mb-6">
            The Platform
          </span>
          <h2
            id="how-it-works-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-[1.1] tracking-tight"
          >
            One link.
            <br />
            Two experiences.
          </h2>
        </div>

        {/* Device mockup showcase */}
        <AnimatedSection animation="fade-in-up">
          <div className="max-w-5xl mx-auto relative">
            <img
              src="/images/product/dual-device-mockup.svg"
              alt="MaconAI dashboard on laptop showing revenue analytics and upcoming bookings, alongside mobile storefront with package selection"
              className="w-full h-auto"
            />

            {/* Subtle floating labels */}
            <div className="hidden md:flex absolute bottom-4 left-0 right-0 justify-between px-[8%]">
              <span className="text-sm text-text-muted font-medium">
                Your dashboard.
              </span>
              <span className="text-sm text-text-muted font-medium">
                Their storefront.
              </span>
            </div>
          </div>

          {/* Mobile-only labels */}
          <div className="flex md:hidden justify-center gap-8 mt-6">
            <span className="text-sm text-text-muted font-medium">
              Your dashboard.
            </span>
            <span className="text-sm text-text-muted font-medium">
              Their storefront.
            </span>
          </div>
        </AnimatedSection>
      </Container>
    </section>
  );
}
