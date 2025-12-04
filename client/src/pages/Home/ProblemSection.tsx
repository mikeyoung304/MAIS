import { Container } from "@/ui/Container";

/**
 * ProblemSection - Hero's journey: empowerment over struggle
 *
 * Affirm their identity and expertise. Position admin as beneath them.
 * They're not struggling - they're just ready for the next level.
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
          {/* Headline - affirms identity */}
          <h2
            id="problem-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-10 leading-[1.1] tracking-tight"
          >
            You didn't master your craft
            <br />
            <span className="text-sage">to spend it on spreadsheets.</span>
          </h2>

          {/* Body - empowering framing */}
          <div className="text-xl md:text-2xl text-text-muted leading-relaxed space-y-6 font-light">
            <p>
              You've built something real. Clients find you. They want to book.
            </p>
            <p>
              Now it's time for your systems to match your talent.
            </p>
          </div>

          {/* Closing line - forward momentum */}
          <p className="mt-12 text-xl md:text-2xl text-text-primary font-medium">
            Let's get you back behind the lens.
          </p>
        </div>
      </Container>
    </section>
  );
}
