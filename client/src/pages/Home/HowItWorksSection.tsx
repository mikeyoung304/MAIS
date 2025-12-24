import { Container } from '@/ui/Container';
import { AnimatedSection } from '@/components/AnimatedSection';

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-32 md:py-48 bg-neutral-50 overflow-hidden"
    >
      <Container>
        {/* Header - tight and confident */}
        <AnimatedSection animation="fade-in-up">
          <div className="max-w-2xl mx-auto text-center mb-16 md:mb-20">
            <span className="inline-block bg-sage/10 text-sage text-sm font-semibold px-5 py-2 rounded-full mb-8 tracking-wide">
              The Platform
            </span>
            <h2
              id="how-it-works-heading"
              className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-text-primary leading-tight"
            >
              One link.
              <br />
              Two experiences.
            </h2>
            <div className="text-lg md:text-xl text-text-muted font-light space-y-2 mt-8">
              <p>Your dashboard.</p>
              <p>Their storefront.</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Device mockup showcase with premium presentation */}
        <AnimatedSection animation="fade-in-up" delay={150}>
          <div className="max-w-6xl mx-auto relative">
            {/* Ambient glow behind devices */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-sage/5 rounded-full blur-3xl"
              aria-hidden="true"
            />

            {/* Device mockup */}
            <div className="relative z-10">
              <img
                src="/images/product/dual-device-mockup.svg"
                alt="MaconAI dashboard on laptop showing revenue analytics and upcoming bookings, alongside mobile storefront with package selection"
                className="w-full h-auto"
              />
            </div>

            {/* Desktop labels - positioned with more breathing room */}
            <div className="hidden md:flex absolute -bottom-12 left-0 right-0 justify-between px-[5%]">
              <div className="flex items-center gap-3">
                <span className="w-8 h-[1px] bg-neutral-300" aria-hidden="true" />
                <span className="text-sm text-text-muted font-medium tracking-wide">
                  Your dashboard
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-muted font-medium tracking-wide">
                  Their storefront
                </span>
                <span className="w-8 h-[1px] bg-neutral-300" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Mobile labels */}
          <div className="flex md:hidden justify-center gap-12 mt-8">
            <span className="text-sm text-text-muted font-medium">Your dashboard</span>
            <span className="text-sm text-text-muted font-medium">Their storefront</span>
          </div>
        </AnimatedSection>

        {/* Supporting copy - adds context */}
        <AnimatedSection animation="fade-in-up" delay={300}>
          <p className="text-center text-base md:text-lg text-text-muted font-light max-w-xl mx-auto mt-16 md:mt-24 leading-relaxed">
            Everything you need to manage your business.
            <br />
            Nothing your clients don&apos;t.
          </p>
        </AnimatedSection>
      </Container>
    </section>
  );
}
