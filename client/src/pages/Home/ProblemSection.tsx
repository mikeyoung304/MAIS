import { Container } from '@/ui/Container';

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
            You need a professional online presence — not a second job.
          </h2>

          {/* Body - the DIY trap */}
          <div className="text-xl md:text-2xl text-text-muted leading-relaxed space-y-6 font-light">
            <p>
              Most creators end up duct-taping together booking tools, payments, websites, and follow-up.
              <br />
              It works… until it doesn&apos;t.
            </p>
            <p>
              Mais replaces the stack with one clean system — built and managed for you.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
