import { Container } from "@/ui/Container";

/**
 * ProblemSection - The hero's struggle
 *
 * Artist/specialist drowning in admin. Quick recognition, no dwelling.
 */
export function ProblemSection() {
  return (
    <section
      id="problem"
      aria-labelledby="problem-heading"
      className="py-20 sm:py-28 bg-surface-alt"
    >
      <Container>
        <div className="max-w-3xl mx-auto text-center">
          <h2
            id="problem-heading"
            className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-6"
          >
            You didn't start your business to chase invoices.
          </h2>
          <p className="text-xl text-text-muted leading-relaxed">
            Yet here you are—buried in emails, juggling DMs, sending payment reminders.
            Every hour on admin is an hour away from your craft.
          </p>
        </div>
      </Container>
    </section>
  );
}
