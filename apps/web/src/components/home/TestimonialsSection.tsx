import { cn } from '@/lib/utils';

// Real testimonials - add here when available
// Format: { quote: string, name: string, role: string, initials: string, featured?: boolean }
const testimonials: Array<{
  quote: string;
  name: string;
  role: string;
  initials: string;
  featured?: boolean;
}> = [];

function TestimonialCard({
  quote,
  name,
  role,
  initials,
  featured = false,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-surface-alt rounded-2xl p-6 border border-neutral-800 transition-all duration-300',
        featured ? 'p-8' : 'hover:shadow-lg hover:-translate-y-1'
      )}
    >
      <p
        className={cn(
          'text-text-primary leading-relaxed mb-4',
          featured ? 'text-lg md:text-xl italic font-serif' : 'text-sm'
        )}
      >
        "{quote}"
      </p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
          <span className="text-sage font-semibold text-sm">{initials}</span>
        </div>
        <div>
          <p className="font-medium text-text-primary text-sm">{name}</p>
          <p className="text-xs text-text-muted">{role}</p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  // Founding member fallback when no testimonials available (DHH)
  if (testimonials.length === 0) {
    return (
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-serif text-xl md:text-2xl text-text-primary italic leading-relaxed">
            "HANDLED members are photographers, therapists, coaches, and wedding planners who chose
            to focus on their craft—not their tech stack."
          </p>
          <p className="mt-6 text-sm text-text-muted">
            Join the founding member cohort and help shape what comes next.
          </p>
        </div>
      </section>
    );
  }

  // Real testimonials with offset grid layout (Frontend Design)
  return (
    <section className="py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-serif text-3xl md:text-4xl text-text-primary text-center mb-16">
          Trusted by service pros.
        </h2>

        <div className="grid md:grid-cols-12 gap-6">
          {/* Featured testimonial - spans 7 columns, offset top */}
          {testimonials[0] && (
            <div className="md:col-span-7 md:-mt-4">
              <TestimonialCard featured {...testimonials[0]} />
            </div>
          )}

          {/* Secondary testimonials - stacked in remaining 5 columns */}
          <div className="md:col-span-5 space-y-6">
            {testimonials.slice(1, 3).map((testimonial, i) => (
              <TestimonialCard key={i} {...testimonial} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
