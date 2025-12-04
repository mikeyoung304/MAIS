import { Container } from "@/ui/Container";
import { Store, Brain, Users } from "lucide-react";

/**
 * ServicesSection - Overview of MaconAI's three core offerings
 *
 * 1. 3-Tier Custom Storefront - The booking/payment system
 * 2. AI Consulting - Strategy and implementation
 * 3. The Collective - Ongoing partnership and team support
 */
export function ServicesSection() {
  const services = [
    {
      icon: Store,
      title: "Custom Storefront",
      subtitle: "3-tier booking system",
      description:
        "Done-for-you storefront with entry, core, and premium tiers. Clients choose, book, pay—no back-and-forth.",
      features: ["Tiered pricing", "Automated booking", "Integrated payments"],
    },
    {
      icon: Brain,
      title: "AI Consulting",
      subtitle: "Strategy + implementation",
      description:
        "We audit your systems, find automation opportunities, and implement AI workflows that save time.",
      features: ["Process automation", "AI follow-ups", "Custom integrations"],
    },
    {
      icon: Users,
      title: "The Collective",
      subtitle: "Growth partnership",
      description:
        "Not just software—a team. Product, UX, and AI specialists working on your business.",
      features: ["Dedicated strategist", "Ongoing optimization", "Revenue-aligned"],
    },
  ];

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="py-24 sm:py-32 bg-surface"
    >
      <Container>
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2
            id="services-heading"
            className="font-serif text-4xl sm:text-5xl font-bold text-text-primary mb-6"
          >
            What we build for you
          </h2>
          <p className="text-xl text-text-muted">
            Three services. More clients. Less friction.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="bg-surface-alt rounded-2xl p-8 border border-sage-light/20 hover:border-sage-light/40 transition-colors"
            >
              <div className="w-14 h-14 bg-sage/10 rounded-xl flex items-center justify-center mb-6">
                <service.icon className="w-7 h-7 text-sage" />
              </div>

              <h3 className="text-xl font-bold text-text-primary mb-1">
                {service.title}
              </h3>
              <p className="text-sm text-sage font-medium mb-4">
                {service.subtitle}
              </p>

              <p className="text-text-muted mb-6 leading-relaxed">
                {service.description}
              </p>

              <ul className="space-y-2">
                {service.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-text-muted"
                  >
                    <span className="w-1.5 h-1.5 bg-sage rounded-full" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-lg text-text-muted italic">
            "You're not buying software. You're gaining a collective."
          </p>
        </div>
      </Container>
    </section>
  );
}
