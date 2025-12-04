import { Container } from "@/ui/Container";
import { Mail, Clock, HelpCircle } from "lucide-react";

/**
 * ProblemSection - Empathy section showing pain points
 *
 * Uses earth tone palette with alternating surface background.
 * Pain bullets with icons for visual scanning.
 */
export function ProblemSection() {
  return (
    <section
      id="problem"
      aria-labelledby="problem-heading"
      className="py-24 sm:py-32 bg-surface-alt"
    >
      <Container>
        <div className="max-w-4xl mx-auto">
          {/* Section headline */}
          <h2
            id="problem-heading"
            className="font-serif text-4xl sm:text-5xl font-bold text-text-primary text-center mb-8"
          >
            Your services are premium. Your systems shouldn't feel homemade.
          </h2>

          {/* Body text */}
          <div className="text-xl text-text-muted leading-relaxed mb-12 text-center max-w-3xl mx-auto space-y-4">
            <p>
              Your clients are ready to buy—then things slow down. Emails, DMs, invoices, contracts.
            </p>
            <p>
              You know automation could fix this, but you're not building a tech team. Meanwhile, opportunities slip away every week.
            </p>
          </div>

          {/* Pain bullets */}
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            <div className="flex items-start gap-4 p-6 bg-surface rounded-xl">
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-sage" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-1">Bookings scattered</h3>
                <p className="text-text-muted text-sm">Across email, Instagram, and text</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-surface rounded-xl">
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-sage" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-1">Payments delayed</h3>
                <p className="text-text-muted text-sm">By manual back-and-forth</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-surface rounded-xl">
              <div className="w-12 h-12 bg-sage-light/20 rounded-full flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-6 h-6 text-sage" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary mb-1">Clients unsure</h3>
                <p className="text-text-muted text-sm">What to choose, what happens next</p>
              </div>
            </div>
          </div>

          {/* Close */}
          <p className="text-xl text-text-primary text-center font-medium">
            MaconAI turns that chaos into a storefront clients can actually buy from.
          </p>
        </div>
      </Container>
    </section>
  );
}
