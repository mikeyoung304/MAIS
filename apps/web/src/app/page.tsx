import Link from 'next/link';
import { Metadata } from 'next';
import { Globe, Calendar, Sparkles, Mail, Users, Phone, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollingIdentity } from '@/components/home/ScrollingIdentity';

export const metadata: Metadata = {
  title: 'HANDLED - The Rest is Handled',
  description:
    "You're a photographer, so capture moments. You're a coach, so unlock potential. The rest is handled. Done-for-you websites, booking, and AI for service professionals.",
  openGraph: {
    title: 'HANDLED - The Rest is Handled',
    description: 'Done-for-you websites, booking, and AI. For people with better things to do.',
    type: 'website',
  },
};

const features = [
  {
    icon: Globe,
    title: 'Website That Works',
    description:
      'We build it. We maintain it. You never touch it. Just show up and look professional.',
  },
  {
    icon: Calendar,
    title: 'Booking & Payments',
    description: 'Clients book and pay online. You get a notification. No back-and-forth emails.',
  },
  {
    icon: Sparkles,
    title: 'AI That Actually Helps',
    description:
      'A chatbot trained on your business. Answers questions, handles scheduling, works while you sleep.',
  },
  {
    icon: Mail,
    title: 'Monthly Newsletter',
    description:
      "What's worth knowing in AI and tech this month. Curated. No fluff. Actually useful.",
    highlight: true, // Education component - competitive moat
  },
  {
    icon: Users,
    title: 'Monthly Zoom Calls',
    description:
      "Real talk with other pros about what's working. No pitch. Just 'here's what we're seeing.'",
    highlight: true, // Education component - competitive moat
  },
  {
    icon: Phone,
    title: 'Humans Who Answer',
    description:
      'Questions? We answer them. No chatbots, no tickets. Just help from people who give a shit.',
  },
];

const tiers = [
  {
    name: 'Handled',
    price: '$49',
    priceSubtext: '/month',
    description: 'Tech sorted. Do what you do.',
    features: [
      'Professional website',
      'Online booking',
      'Payment processing',
      'Email notifications',
    ],
    ctaText: 'Get Started',
    ctaHref: '/signup?tier=handled',
  },
  {
    name: 'Fully Handled',
    price: '$149',
    priceSubtext: '/month',
    description: 'Tech + AI growth club + chatbot.',
    features: [
      'Everything in Handled',
      'AI chatbot for your business',
      'Monthly newsletter',
      'Monthly Zoom calls',
      'Priority support',
    ],
    ctaText: 'Join Now',
    ctaHref: '/signup?tier=fully-handled',
    isPopular: true,
  },
  {
    name: 'Completely Handled',
    price: 'Custom',
    priceSubtext: '',
    description: 'Personalized consulting.',
    features: [
      'Everything in Fully Handled',
      '1-on-1 strategy sessions',
      'Custom integrations',
      'Dedicated account manager',
    ],
    ctaText: 'Book a Call',
    ctaHref: '/contact',
  },
];

const faqs = [
  {
    question: 'What kind of businesses is this for?',
    answer:
      "Photographers, coaches, therapists, consultants, trainers, wedding planners — anyone who sells their time and expertise. If you're great at what you do but tired of managing tech, we're for you.",
  },
  {
    question: 'Do I need to know anything about tech?',
    answer: "Nope. That's the point. We handle the tech so you don't have to become a tech person.",
  },
  {
    question: 'What if I already have a website?',
    answer:
      "We can work with it or help you migrate. Most members find our sites convert better, but we'll figure out what makes sense for you.",
  },
  {
    question: 'What happens on the monthly Zoom calls?',
    answer:
      "We share what's new in AI and tech that's actually worth knowing. Members share what's working for them. No sales pitch. Just useful conversation with people in the same boat.",
  },
  {
    question: 'Is the AI chatbot going to sound like a robot?',
    answer:
      'No. We train it on your voice, your services, your style. It sounds like a helpful version of you — not a generic bot.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. No contracts, no cancellation fees, no guilt trips. We earn your business every month.',
  },
];

// Mock testimonials - replace with real ones when available
const testimonials = [
  {
    quote:
      "Back in '82, I could throw a football over them mountains. Now HANDLED throws my invoices over the internet. Same energy.",
    name: 'Rico Dynamite',
    title: 'Former Football Star, Current Life Coach',
    // Placeholder: older guy with mustache, aviator glasses
    image:
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Rico&accessories=prescription02&facialHair=beardMajestic&top=shortFlat',
  },
  {
    quote:
      "I don't always understand technology. But when I do, it's because someone else is handling it. Stay booked, my friends.",
    name: 'Fernando Interessante',
    title: "World's Most Interesting Therapist",
    // Placeholder: distinguished gentleman
    image:
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Fernando&facialHair=beardLight&top=shortCurly&accessories=round',
  },
  {
    quote:
      'I tried to set up my own website once. I woke up three days later in a Best Buy parking lot. Never again. HANDLED saved my life.',
    name: 'Brenda Chaos',
    title: 'Feng Shui Consultant & Alpaca Whisperer',
    // Placeholder: quirky woman
    image:
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Brenda&top=longHairCurvy&accessories=sunglasses&clotheColor=pink',
  },
];

export default function HomePage() {
  // JSON-LD structured data for SEO and agent accessibility
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HANDLED',
    url: 'https://gethandled.ai',
    description:
      "Done-for-you websites, booking, payments, and AI for service professionals. Plus monthly education on what's worth knowing in tech.",
    sameAs: [],
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'HANDLED',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Membership platform for service professionals with done-for-you tech and done-with-you education.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Handled',
        description:
          'Professional website, online booking, payment processing, email notifications',
        price: '49',
        priceCurrency: 'USD',
        priceValidUntil: '2025-12-31',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Fully Handled',
        description:
          'Everything in Handled plus AI chatbot, monthly newsletter, monthly Zoom calls, priority support',
        price: '149',
        priceCurrency: 'USD',
        priceValidUntil: '2025-12-31',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: 'Completely Handled',
        description:
          'White glove service with 1-on-1 strategy sessions, custom integrations, dedicated account manager',
        priceSpecification: {
          '@type': 'PriceSpecification',
          priceCurrency: 'USD',
        },
        availability: 'https://schema.org/InStock',
      },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="min-h-screen bg-surface">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-serif text-2xl font-bold text-text-primary">
              HANDLED
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#features"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                What&apos;s Included
              </Link>
              <Link
                href="#pricing"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                FAQ
              </Link>
              <Link
                href="/login"
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                Sign In
              </Link>
              <Button asChild variant="sage" className="rounded-full px-6">
                <Link href="/signup">Get Handled</Link>
              </Button>
            </div>
          </div>
        </nav>

        <main>
          {/* Hero Section */}
          <section className="relative pt-32 pb-24 md:pt-44 md:pb-36 px-6 overflow-hidden min-h-[70vh] flex flex-col justify-center">
            {/* Ambient decorations */}
            <div
              className="absolute top-1/4 right-[15%] w-72 h-72 bg-sage/6 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-1/4 left-[10%] w-48 h-48 bg-sage/4 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative max-w-3xl mx-auto text-center">
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary leading-[1.15] tracking-tight">
                You&apos;re a <ScrollingIdentity />
              </h1>
              <p className="mt-5 font-serif text-xl sm:text-2xl md:text-3xl font-semibold text-sage">
                The rest is handled.
              </p>
              <p className="mt-6 text-base md:text-lg text-text-muted font-light max-w-xl mx-auto leading-relaxed">
                Websites. Booking. Payments. AI. Plus a monthly filter for what&apos;s actually
                worth knowing. For people with better things to do.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-8 py-5 text-base shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">Get Handled</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full px-8 py-5 text-base hover:bg-neutral-50 transition-all duration-300"
                >
                  <Link href="#features">See What&apos;s Included</Link>
                </Button>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
              <div className="w-5 h-8 rounded-full border-2 border-neutral-300 flex items-start justify-center p-1.5">
                <div className="w-1 h-2 bg-neutral-400 rounded-full" />
              </div>
            </div>
          </section>

          {/* Problem Section */}
          <section className="py-32 md:py-40 px-6 bg-white">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight">
                You didn&apos;t start this to become a tech expert.
              </h2>
              <div className="mt-8 space-y-6 text-xl text-text-muted leading-relaxed">
                <p>Somewhere along the way, you became an IT department.</p>
                <p>
                  Every day you hear about a new AI tool that&apos;s going to
                  &quot;revolutionize&quot; your industry.
                </p>
                <p className="text-2xl font-medium text-text-primary">Are you exhausted?</p>
              </div>
              <Button
                asChild
                variant="sage"
                className="mt-10 rounded-full px-12 py-6 text-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="#pricing">Join the club.</Link>
              </Button>
            </div>
          </section>

          {/* Features Section */}
          <section
            id="features"
            aria-labelledby="features-heading"
            className="py-32 md:py-40 px-6 scroll-mt-20"
          >
            <div className="max-w-7xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2
                  id="features-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary"
                >
                  What you get.
                </h2>
                <p className="mt-4 text-xl md:text-2xl text-text-muted font-light">
                  One membership. The rest? Handled.
                </p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className={`rounded-3xl p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${
                      feature.highlight
                        ? 'bg-sage/5 border-2 border-sage/30 ring-1 ring-sage/10'
                        : 'bg-white border border-neutral-100'
                    }`}
                  >
                    {feature.highlight && (
                      <span className="inline-block bg-sage/15 text-sage text-xs font-medium px-2.5 py-1 rounded-full mb-4">
                        The Shortcut
                      </span>
                    )}
                    <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
                      <feature.icon className="w-6 h-6 text-sage" />
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-text-primary mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-text-muted leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section
            id="pricing"
            aria-labelledby="pricing-heading"
            className="py-32 md:py-40 px-6 bg-neutral-50 scroll-mt-20"
          >
            <div className="max-w-7xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2
                  id="pricing-heading"
                  className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary"
                >
                  Pick a plan.
                </h2>
                <p className="mt-4 text-xl md:text-2xl text-text-muted font-light">
                  No contracts. No surprises. Cancel anytime.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {tiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`bg-white rounded-3xl p-8 shadow-lg border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      tier.isPopular ? 'border-sage ring-2 ring-sage' : 'border-neutral-100'
                    }`}
                  >
                    {tier.isPopular && (
                      <span className="inline-block bg-sage text-white text-sm font-medium px-3 py-1 rounded-full mb-4">
                        Most Popular
                      </span>
                    )}
                    <h3 className="font-serif text-2xl font-bold text-text-primary">{tier.name}</h3>
                    <p className="mt-1 text-text-muted">{tier.description}</p>
                    <div className="mt-6">
                      <span className="text-4xl font-bold text-text-primary">{tier.price}</span>
                      {tier.priceSubtext && (
                        <span className="text-text-muted">{tier.priceSubtext}</span>
                      )}
                    </div>
                    <ul className="mt-6 space-y-3">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                          <span className="text-text-primary">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      variant={tier.isPopular ? 'sage' : 'outline'}
                      className="w-full mt-8 rounded-full py-5"
                    >
                      <Link href={tier.ctaHref}>{tier.ctaText}</Link>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section className="py-32 md:py-40 px-6 bg-surface">
            <div className="max-w-7xl mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary">
                  Real talk from real pros.
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {testimonials.map((testimonial) => (
                  <div
                    key={testimonial.name}
                    className="bg-white rounded-3xl p-8 shadow-lg border border-neutral-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <img
                        src={testimonial.image}
                        alt={testimonial.name}
                        className="w-14 h-14 rounded-full bg-sage/10"
                      />
                      <div>
                        <p className="font-semibold text-text-primary">{testimonial.name}</p>
                        <p className="text-sm text-text-muted">{testimonial.title}</p>
                      </div>
                    </div>
                    <blockquote className="text-text-muted leading-relaxed italic">
                      &ldquo;{testimonial.quote}&rdquo;
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section
            id="faq"
            aria-labelledby="faq-heading"
            className="py-32 md:py-40 px-6 scroll-mt-20"
          >
            <div className="max-w-3xl mx-auto">
              <h2
                id="faq-heading"
                className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary text-center mb-12"
              >
                Questions? Answers.
              </h2>
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <details
                    key={index}
                    className="group bg-white rounded-3xl border border-neutral-100 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between cursor-pointer p-6 list-none">
                      <span className="font-medium text-text-primary pr-4">{faq.question}</span>
                      <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
                    </summary>
                    <div className="px-6 pb-6 text-text-muted leading-relaxed">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="py-32 md:py-48 px-6 bg-sage text-white">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
                Your clients hired you for your expertise.
              </h2>
              <p className="mt-4 text-lg text-white/80">
                Not your ability to configure a payment processor.
              </p>
              <Button
                asChild
                className="mt-8 bg-white text-sage hover:bg-neutral-100 rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/signup">Get Handled</Link>
              </Button>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="py-12 px-6 bg-text-primary text-white/60">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="font-serif text-xl font-bold text-white">HANDLED</div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </div>
            <div className="text-sm">
              © {new Date().getFullYear()} HANDLED. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
