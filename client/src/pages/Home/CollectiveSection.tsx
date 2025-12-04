import { Container } from "@/ui/Container";
import { UserCheck, MessageSquare, Bell } from "lucide-react";

/**
 * CollectiveSection - AI + Skills of the Collective
 *
 * Positions MaconAI as a team/collective, not just software.
 * Highlights concrete AI outcomes, not abstract capabilities.
 */
export function CollectiveSection() {
  return (
    <section
      id="collective"
      aria-labelledby="collective-heading"
      className="py-24 sm:py-32 bg-surface"
    >
      <Container>
        <div className="max-w-5xl mx-auto">
          {/* Section headline */}
          <h2
            id="collective-heading"
            className="font-serif text-4xl sm:text-5xl font-bold text-text-primary text-center mb-6"
          >
            You're not buying software. You're gaining a collective.
          </h2>

          {/* Body */}
          <p className="text-xl text-text-muted text-center mb-16 max-w-3xl mx-auto">
            Product, UX, and AI specialists who treat your booking flow like a revenue engine.
          </p>

          {/* AI capabilities */}
          <div className="bg-surface-alt rounded-2xl p-8 sm:p-12 mb-12">
            <h3 className="text-lg font-semibold text-text-primary mb-8 text-center">
              Behind the scenes, AI handles:
            </h3>
            <div className="grid sm:grid-cols-3 gap-8">
              {/* Capability 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-sage-light/20 rounded-full flex items-center justify-center mb-4">
                  <UserCheck className="w-7 h-7 text-sage" />
                </div>
                <p className="text-text-primary font-medium">
                  Qualifying inquiries before you get on a call
                </p>
              </div>

              {/* Capability 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-sage-light/20 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-7 h-7 text-sage" />
                </div>
                <p className="text-text-primary font-medium">
                  Answering common questions automatically
                </p>
              </div>

              {/* Capability 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-sage-light/20 rounded-full flex items-center justify-center mb-4">
                  <Bell className="w-7 h-7 text-sage" />
                </div>
                <p className="text-text-primary font-medium">
                  Sending reminders so clients don't drift
                </p>
              </div>
            </div>
          </div>

          {/* Close */}
          <p className="text-xl text-text-primary text-center font-medium max-w-3xl mx-auto">
            You deliver experiences. We handle the infrastructure.
          </p>
        </div>
      </Container>
    </section>
  );
}
