'use client';

import type { TenantPublicDto } from '@macon/contracts';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface HowItWorksSectionProps {
  tenant: TenantPublicDto;
}

const STEPS = [
  {
    number: '1',
    title: 'Choose Your Experience',
    description: 'Browse services and pick what fits.',
  },
  {
    number: '2',
    title: 'Book Your Date',
    description: 'Reserve your preferred date and time.',
  },
  {
    number: '3',
    title: 'Show Up & Enjoy',
    description: 'We handle everything on-site.',
  },
] as const;

/**
 * HowItWorksSection - Static numbered steps component
 *
 * Always renders as slot 2 between Hero and Services.
 * Not a SectionRenderer type — inserted directly in TenantLandingPage.
 * Not editable via Build Mode (no data-section-index).
 */
export function HowItWorksSection({ tenant: _tenant }: HowItWorksSectionProps) {
  const revealRef = useScrollReveal();

  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center font-heading text-3xl font-bold text-primary sm:text-4xl">
          How It Works
        </h2>
        <div ref={revealRef} className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.number}
              className={`text-center${index > 0 ? ` reveal-delay-${index}` : ''}`}
            >
              <div className="text-4xl font-bold text-accent">{step.number}</div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-primary">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
