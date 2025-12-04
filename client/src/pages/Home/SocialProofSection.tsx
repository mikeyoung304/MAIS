import { Container } from "@/ui/Container";

/**
 * SocialProofSection - Trust indicators
 *
 * Pre-launch: aspirational positioning with placeholder testimonials
 * Post-launch: replace with real quotes
 */

const testimonials = [
  {
    quote: "I went from chasing deposits to fully booked in six weeks.",
    author: "Sarah Chen",
    role: "Wedding Photographer, Portland",
  },
  {
    quote: "My clients love how simple it is. I love that I never think about invoicing anymore.",
    author: "Marcus Rivera",
    role: "Event Planner, Austin",
  },
  {
    quote: "It's like having an assistant who never sleeps.",
    author: "Priya Patel",
    role: "Portrait Photographer, Brooklyn",
  },
];

export function SocialProofSection() {
  return (
    <section
      id="social-proof"
      aria-labelledby="social-proof-heading"
      className="py-32 md:py-40 bg-neutral-50"
    >
      <Container>
        {/* Section header */}
        <h2
          id="social-proof-heading"
          className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary text-center mb-16 leading-[1.1] tracking-tight"
        >
          Built for creative professionals
          <br />
          <span className="text-sage">who are booked.</span>
        </h2>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.author}
              className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100
                         transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              {/* Quote */}
              <blockquote className="text-text-primary text-xl leading-relaxed mb-8 font-serif">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <figcaption className="flex items-center gap-4">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center">
                  <span className="text-sage font-semibold text-lg">
                    {testimonial.author.charAt(0)}
                  </span>
                </div>
                <cite className="not-italic">
                  <div className="font-semibold text-text-primary">
                    {testimonial.author}
                  </div>
                  <div className="text-sm text-text-muted">
                    {testimonial.role}
                  </div>
                </cite>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Early access note */}
        <p className="text-center text-text-muted mt-12 text-sm">
          Early access rolling out Winter 2025.
        </p>
      </Container>
    </section>
  );
}
