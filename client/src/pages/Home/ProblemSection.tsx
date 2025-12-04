import { Container } from "@/ui/Container";

/**
 * ProblemSection - Hero's journey: empowerment over struggle
 *
 * Position us as the bridge - skip the complexity, get straight to bookings.
 * Acknowledge the real costs and hassle of DIY.
 */
export function ProblemSection() {
  return (
    <section
      id="problem"
      aria-labelledby="problem-heading"
      className="py-32 md:py-40 bg-neutral-50"
    >
      <Container>
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline - the real problem */}
          <h2
            id="problem-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-10 leading-[1.1] tracking-tight"
          >
            You didn't start this
            <br />
            <span className="text-sage">to become a tech expert.</span>
          </h2>

          {/* Body - the DIY trap */}
          <div className="text-xl md:text-2xl text-text-muted leading-relaxed space-y-6 font-light">
            <p>
              Squarespace. Acuity. Stripe. Analytics. SEO.
              <br />
              The subscriptions add up. The learning curve never ends.
            </p>
            <p>
              Whether it's your full-time business or a growing side hustle—
              <br />
              you need a professional online presence, not a second job.
            </p>
          </div>

          {/* Closing line - we're the bridge */}
          <p className="mt-12 text-xl md:text-2xl text-text-primary font-medium">
            One monthly fee. Everything handled. You focus on your craft.
          </p>
        </div>
      </Container>
    </section>
  );
}
