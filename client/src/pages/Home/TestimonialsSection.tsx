import { Container } from "@/ui/Container";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedSection } from "@/components/AnimatedSection";
import { Quote, Star, TrendingUp } from "lucide-react";

const testimonials = [
  {
    quote: "I used to spend Sunday nights texting appointment reminders. Now my calendar fills itself and I actually take weekends off. Oh, and revenue's up 30%.",
    name: "Casey M.",
    title: "Salon Owner",
    location: "Atlanta, GA",
    metric: "Revenue up 30%",
    avatarColor: "bg-orange-500",
  },
  {
    quote: "Three months ago, I was chasing every lead manually. Now I have a waitlist. My strategist didn't just build me a website—she helped me become the obvious choice in my market.",
    name: "Robin T.",
    title: "Consultant",
    location: "Macon, GA",
    metric: "Fully booked in 90 days",
    avatarColor: "bg-teal-500",
  },
  {
    quote: "I'm the last person who should be running a business online—I still can't figure out Instagram. But they made it so simple. Website in 10 days, calendar full in 30.",
    name: "Alex K.",
    title: "Fitness Coach",
    location: "Savannah, GA",
    metric: "Website live in 10 days",
    avatarColor: "bg-purple-500",
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" className="py-16 md:py-24 bg-background">
      <Container>
        <AnimatedSection>
          <div className="text-center mb-12 md:mb-16">
            <h2 id="testimonials-heading" className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-macon-navy via-macon-orange to-macon-teal">
              Don't Take Our Word For It
            </h2>
            <p className="text-xl md:text-2xl text-neutral-700 max-w-2xl mx-auto">
              Here's what happened when they joined
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((testimonial, index) => (
            <AnimatedSection key={index} delay={index * 100}>
              <article>
                <Card className="bg-neutral-50 border-neutral-200/30 hover:shadow-elevation-2 transition-shadow relative h-full">
                <CardContent className="p-8 flex flex-col h-full">
                  {/* Metric Badge */}
                  <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full mb-4">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {testimonial.metric}
                  </div>

                  <Quote className="w-10 h-10 text-macon-orange/30 mb-4" aria-hidden="true" />
                  <div className="flex gap-1 mb-4" aria-label="5 out of 5 stars">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-macon-orange fill-macon-orange"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="text-lg text-neutral-700 mb-6 leading-relaxed italic flex-grow">
                    "{testimonial.quote}"
                  </p>
                  <div className="border-t border-neutral-200/30 pt-4 flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`w-12 h-12 ${testimonial.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-lg`}>
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-semibold text-lg text-neutral-900">{testimonial.name}</div>
                      <div className="text-sm text-neutral-600">{testimonial.title} · {testimonial.location}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </article>
          </AnimatedSection>
          ))}
        </div>
      </Container>
    </section>
  );
}