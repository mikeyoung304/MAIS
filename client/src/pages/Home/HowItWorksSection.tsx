import { Link } from 'react-router-dom';
import { Container } from '@/ui/Container';
import { Button } from '@/components/ui/button';

const steps = [
  {
    number: 1,
    title: 'Discovery Call',
    description:
      '30 minutes to understand your business, identify revenue leaks, and see exactly how we can help. No pressure, just clarity.',
    timeline: 'Day 1',
    highlight: 'orange',
    badge: 'Free, no obligation',
  },
  {
    number: 2,
    title: 'Custom Blueprint',
    description:
      'Your strategist builds your personalized system: booking, payments, website, and marketing—all designed around YOUR business.',
    timeline: 'Week 1-2',
    highlight: 'orange',
    badge: "You'll see your plan before we start",
  },
  {
    number: 3,
    title: 'Launch & Partner',
    description:
      'We implement everything. You focus on clients. We take a small percentage of new revenue—so we only profit when you do.',
    timeline: 'Week 2+',
    highlight: 'teal',
    badge: 'No upfront costs. No monthly fees.',
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-16 md:py-24 bg-background"
    >
      <Container>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2
              id="how-it-works-heading"
              className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-macon-navy via-macon-orange to-macon-teal"
            >
              The Growth Partnership Method
            </h2>
            <p className="text-xl md:text-2xl text-neutral-700 leading-relaxed">
              From overwhelmed to automated in 3 steps
            </p>
          </div>

          <div className="space-y-8 relative">
            {/* Connecting line */}
            <div className="absolute left-8 top-8 bottom-8 w-1 bg-gradient-to-b from-macon-orange via-macon-orange to-macon-teal hidden md:block"></div>

            {steps.map((step) => (
              <div
                key={step.number}
                className={`flex items-start gap-6 p-8 bg-white rounded-xl border-l-4 ${
                  step.highlight === 'teal' ? 'border-l-macon-teal' : 'border-l-macon-orange'
                } border-t border-r border-b border-neutral-200 hover:shadow-elevation-3 transition-all relative`}
              >
                <div
                  className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${
                    step.highlight === 'teal'
                      ? 'from-macon-teal to-macon-teal-dark'
                      : 'from-macon-orange to-macon-orange-dark'
                  } flex items-center justify-center text-white font-extrabold text-3xl shadow-lg relative z-10`}
                >
                  {step.number}
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-neutral-900 mb-3">{step.title}</h3>
                  <p className="text-xl text-neutral-700 leading-relaxed">{step.description}</p>
                  <div
                    className={`inline-block mt-3 px-4 py-2 ${
                      step.highlight === 'teal' ? 'bg-macon-teal/10' : 'bg-macon-orange/10'
                    } rounded-lg`}
                  >
                    <p
                      className={`text-base ${
                        step.highlight === 'teal' ? 'text-macon-teal' : 'text-macon-orange'
                      } font-bold`}
                    >
                      {step.timeline}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button variant="secondary" size="lg" className="text-xl" asChild>
              <Link to="/packages">Start My Free Growth Audit</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
