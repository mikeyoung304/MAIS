import Link from 'next/link';
import { Metadata } from 'next';
import {
  Calendar,
  Mail,
  Users,
  Phone,
  Check,
  ChevronDown,
  Bot,
  Clock,
  MessageSquare,
  FileText,
  Sparkles,
  Heart,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollingIdentity } from '@/components/home/ScrollingIdentity';

export const metadata: Metadata = {
  title: 'HANDLED - AI That Runs Your Business',
  description:
    'An AI assistant that books clients, answers questions, and handles scheduling — while you do the work you love. Plus the tech foundation to make it all work.',
  openGraph: {
    title: 'HANDLED - AI That Runs Your Business',
    description:
      'Your AI assistant handles client inquiries, booking, and scheduling 24/7. For service professionals with better things to do.',
    type: 'website',
  },
};

// Done-with-you education - the competitive moat (ongoing value)
const educationFeatures = [
  {
    icon: Mail,
    title: 'Monthly Newsletter',
    description: "What's actually worth knowing in AI this month. Curated. No fluff. No homework.",
  },
  {
    icon: Users,
    title: 'Monthly Zoom Calls',
    description:
      "Real talk with other pros about what's working. No pitch. Just 'here's what we're seeing.'",
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
        <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-md border-b border-neutral-800">
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
              <div className="mt-10">
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Link href="/signup">Get Handled</Link>
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
          <section className="py-32 md:py-40 px-6 bg-surface-alt relative overflow-hidden">
            {/* Ambient decorations */}
            <div
              className="absolute top-20 left-[10%] w-64 h-64 bg-sage/5 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-20 right-[10%] w-48 h-48 bg-sage/4 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            <div className="relative max-w-5xl mx-auto">
              {/* Headline - time is the emotional hook */}
              <div className="text-center mb-12">
                <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-tight">
                  10 hours a week. <span className="text-sage">Gone.</span>
                </h2>
              </div>

              {/* Visual contrast grid */}
              <div className="grid md:grid-cols-2 gap-8 mb-16">
                {/* What you're doing */}
                <div className="bg-neutral-800/50 rounded-3xl p-8 border border-neutral-700">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-neutral-400" />
                    </div>
                    <span className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
                      Where it goes
                    </span>
                  </div>
                  <ul className="space-y-4">
                    {[
                      { icon: MessageSquare, text: 'Responding to DMs at 11pm' },
                      { icon: FileText, text: 'Chasing unpaid invoices' },
                      { icon: Calendar, text: 'Back-and-forth on scheduling' },
                      { icon: Mail, text: 'Explaining pricing' },
                    ].map((item) => (
                      <li key={item.text} className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-neutral-500 flex-shrink-0" />
                        <span className="text-text-muted">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What you get back */}
                <div className="bg-sage/10 rounded-3xl p-8 border border-sage/30 relative overflow-hidden">
                  <div
                    className="absolute -top-10 -right-10 w-32 h-32 bg-sage/10 rounded-full blur-2xl pointer-events-none"
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-sage/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-sage" />
                      </div>
                      <span className="text-sm font-medium text-sage uppercase tracking-wide">
                        What you get back
                      </span>
                    </div>
                    <ul className="space-y-4">
                      {[
                        { icon: Calendar, text: 'Weekends without the laptop' },
                        { icon: Users, text: 'Dinner with your family, not your inbox' },
                        { icon: Sparkles, text: 'Energy for the work you actually love' },
                        { icon: Heart, text: "Rest that doesn't feel like falling behind" },
                      ].map((item) => (
                        <li key={item.text} className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 text-sage flex-shrink-0" />
                          <span className="text-text-primary">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Transition statement + CTA */}
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-serif font-medium text-text-primary mb-8">
                  Get your time back.
                </p>
                <Button
                  asChild
                  variant="sage"
                  className="rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <Link href="#features" className="flex items-center gap-2">
                    See how it works
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* AI Assistant Section - The core product (includes foundation) */}
          <section
            id="features"
            aria-labelledby="ai-heading"
            className="py-24 md:py-32 px-6 bg-gradient-to-b from-surface to-surface-alt scroll-mt-20"
          >
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Left: Copy */}
                <div>
                  <span className="inline-block bg-sage/15 text-sage text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
                    Your AI Assistant
                  </span>
                  <h2
                    id="ai-heading"
                    className="font-serif text-4xl md:text-5xl font-bold text-text-primary leading-tight"
                  >
                    An AI that works for you. 24/7.
                  </h2>
                  <p className="mt-6 text-lg text-text-muted leading-relaxed">
                    Your clients interact with an AI trained on your business. It answers questions,
                    handles scheduling, and books sessions — while you sleep, travel, or do the work
                    you love.
                  </p>
                  <ul className="mt-8 space-y-3">
                    {[
                      'Lives on your storefront, ready to help',
                      'Knows your services, pricing, and availability',
                      'Books appointments and collects payments',
                      'Learns and improves over time',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-sage flex-shrink-0 mt-0.5" />
                        <span className="text-text-primary">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-8 text-sm text-text-muted">
                    Plus the foundation: website, booking, and payments — built and maintained for
                    you.
                  </p>
                </div>
                {/* Right: Visual */}
                <div className="relative">
                  <div className="bg-surface-alt rounded-3xl p-8 border border-sage/30 shadow-2xl relative overflow-hidden">
                    {/* Glow effect */}
                    <div
                      className="absolute -top-20 -right-20 w-40 h-40 bg-sage/15 rounded-full blur-3xl pointer-events-none"
                      aria-hidden="true"
                    />
                    <div
                      className="absolute -bottom-20 -left-20 w-40 h-40 bg-sage/10 rounded-full blur-3xl pointer-events-none"
                      aria-hidden="true"
                    />
                    <div className="relative space-y-4">
                      {/* Chat bubble - client */}
                      <div className="flex justify-end">
                        <div className="bg-neutral-700 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                          <p className="text-sm text-text-primary">
                            Do you have availability this Saturday for a portrait session?
                          </p>
                        </div>
                      </div>
                      {/* Chat bubble - AI */}
                      <div className="flex justify-start">
                        <div className="bg-sage/20 border border-sage/30 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                          <p className="text-sm text-text-primary">
                            Yes! I have openings at 10am and 2pm. The 2-hour portrait session is
                            $350. Would you like me to book one of those times?
                          </p>
                        </div>
                      </div>
                      {/* Chat bubble - client */}
                      <div className="flex justify-end">
                        <div className="bg-neutral-700 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                          <p className="text-sm text-text-primary">2pm works. Book it!</p>
                        </div>
                      </div>
                      {/* Chat bubble - AI */}
                      <div className="flex justify-start">
                        <div className="bg-sage/20 border border-sage/30 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                          <p className="text-sm text-text-primary">
                            Done! I&apos;ve sent you a confirmation email with all the details. See
                            you Saturday at 2pm!
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* AI indicator */}
                    <div className="mt-6 pt-4 border-t border-neutral-700 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-sage" />
                      <span className="text-xs text-text-muted">
                        AI Assistant · Trained on your business
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Trust Element - Humans Who Answer */}
          <div className="py-8 px-6 bg-surface-alt border-y border-neutral-800">
            <div className="max-w-3xl mx-auto flex items-center justify-center gap-4">
              <Phone className="w-5 h-5 text-sage flex-shrink-0" />
              <p className="text-text-muted text-center">
                <span className="text-text-primary font-medium">Questions?</span> Humans who answer.
                No bots. No tickets. Just help from people who give a shit.
              </p>
            </div>
          </div>

          {/* The Shortcut Section - Done-with-you education (competitive moat) */}
          <section
            aria-labelledby="shortcut-heading"
            className="py-24 md:py-32 px-6 bg-sage/5 border-y border-sage/20"
          >
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <span className="inline-block bg-sage/15 text-sage text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
                  The Shortcut
                </span>
                <h2
                  id="shortcut-heading"
                  className="font-serif text-4xl md:text-5xl font-bold text-text-primary"
                >
                  Stay ahead. Skip the homework.
                </h2>
                <p className="mt-4 text-xl text-text-muted font-light max-w-2xl mx-auto">
                  AI moves fast. We watch it so you don&apos;t have to. Monthly updates on
                  what&apos;s actually worth knowing.
                </p>
              </div>
              {/* 2-column layout with featured cards */}
              <div className="grid md:grid-cols-2 gap-8">
                {educationFeatures.map((feature) => (
                  <div
                    key={feature.title}
                    className="bg-surface-alt rounded-3xl p-10 border border-sage/30 shadow-xl relative overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                  >
                    {/* Subtle sage glow effect */}
                    <div
                      className="absolute -top-20 -right-20 w-40 h-40 bg-sage/10 rounded-full blur-3xl pointer-events-none"
                      aria-hidden="true"
                    />
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-sage/15 flex items-center justify-center mb-6">
                        <feature.icon className="w-7 h-7 text-sage" />
                      </div>
                      <h3 className="font-serif text-2xl font-semibold text-text-primary mb-3">
                        {feature.title}
                      </h3>
                      <p className="text-text-muted leading-relaxed text-lg">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section
            id="pricing"
            aria-labelledby="pricing-heading"
            className="py-32 md:py-40 px-6 bg-surface scroll-mt-20"
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
                    className={`bg-surface-alt rounded-3xl p-8 shadow-lg border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                      tier.isPopular ? 'border-sage ring-2 ring-sage' : 'border-neutral-700'
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

          {/* Founder Story Section */}
          <section className="py-32 md:py-40 px-6 bg-surface">
            <div className="max-w-2xl mx-auto text-center">
              {/* Photo */}
              <img
                src="/mike-young.jpg"
                alt="Mike Young, Founder"
                className="w-40 h-40 md:w-48 md:h-48 rounded-full object-cover mx-auto mb-10 shadow-2xl ring-4 ring-sage/20"
              />
              {/* Story */}
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-8 leading-tight">
                I built this because I needed it.
              </h2>
              <div className="space-y-6 text-lg text-text-muted leading-relaxed">
                <p>
                  I&apos;m a private chef, photographer, drone pilot, restaurant consultant —
                  basically, I can&apos;t sit still. ADHD brain. I love the work. I hate the admin.
                </p>
                <p>
                  When AI tools started getting good, I went deep. Built systems for my own
                  business. Then realized: every photographer, coach, and consultant I know is
                  drowning in the same stuff.
                </p>
                <p className="text-text-primary font-medium">
                  HANDLED is what I wish existed when I started. Professional presence. Smart tools.
                  None of the homework.
                </p>
              </div>
              <div className="mt-10">
                <p className="font-semibold text-text-primary text-lg">Mike Young</p>
                <p className="text-sage">Founder</p>
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
                    className="group bg-surface-alt rounded-3xl border border-neutral-700 overflow-hidden"
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
          <section className="py-32 md:py-48 px-6 bg-gradient-to-br from-neutral-800 to-neutral-900 border-t border-sage/20">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-tight text-text-primary">
                Do what you love.
              </h2>
              <p className="mt-4 text-xl text-sage">The rest?</p>
              <Button
                asChild
                variant="sage"
                className="mt-8 rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="#pricing">Get Handled</Link>
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
