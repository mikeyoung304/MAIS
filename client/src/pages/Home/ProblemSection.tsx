import { Container } from "@/ui/Container";

/**
 * ProblemSection - Empathy and recognition
 *
 * Speak to their identity. Acknowledge their struggle.
 * Specific details prove we understand their world.
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
          {/* Headline - speaks to identity */}
          <h2
            id="problem-heading"
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary mb-10 leading-[1.1] tracking-tight"
          >
            You're a photographer,
            <br />
            not a bookkeeper.
          </h2>

          {/* Body - specific, relatable details */}
          <div className="text-xl md:text-2xl text-text-muted leading-relaxed space-y-6 font-light">
            <p>
              But somewhere between the Instagram DM and the final gallery delivery,
              you became both.
            </p>
            <p className="text-lg md:text-xl text-text-muted/80">
              Client emails. Invoice reminders. Calendar Tetris. Deposit tracking.
              <br />
              Every hour spent on admin is an hour you're not behind the lens.
            </p>
          </div>

          {/* Closing line */}
          <p className="mt-12 text-xl md:text-2xl text-text-primary font-medium">
            It shouldn't be this hard to run a creative business.
          </p>
        </div>
      </Container>
    </section>
  );
}
