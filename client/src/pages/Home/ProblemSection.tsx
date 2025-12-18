import { Container } from '@/ui/Container';

/**
 * ProblemSection - Hero's journey: empowerment over struggle
 *
 * Position us as the bridge - skip the complexity, get straight to bookings.
 * Acknowledge the real costs and hassle of DIY.
 */
export function ProblemSection() {
  return (
    <section id="problem" aria-labelledby="problem-heading" className="py-28 md:py-36 bg-neutral-50">
      <Container>
        <div className="max-w-3xl mx-auto text-center">
          {/* Headline - the real problem */}
          <h2
            id="problem-heading"
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-semibold text-text-primary mb-8 leading-tight"
          >
            A professional presence — without the overhead.
          </h2>

          {/* Body - the DIY trap */}
          <p className="text-lg md:text-xl text-text-muted leading-relaxed font-light">
            Disconnected tools turn simple bookings into ongoing work. Mais replaces the stack with one
            clean system, built and managed for you.
          </p>
        </div>
      </Container>
    </section>
  );
}
