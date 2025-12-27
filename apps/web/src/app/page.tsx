import Link from 'next/link';
import { Metadata } from 'next';
import {
  Globe,
  Calendar,
  Sparkles,
  Mail,
  Users,
  Phone,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollingIdentity } from '@/components/home/ScrollingIdentity';

export const metadata: Metadata = {
  title: 'HANDLED - The Rest is Handled',
  description:
    "You're a photographer, so capture moments. You're a coach, so unlock potential. The rest is handled. Done-for-you websites, booking, and AI for service professionals.",
  openGraph: {
    title: 'HANDLED - The Rest is Handled',
    description:
      "Done-for-you websites, booking, and AI. For people with better things to do.",
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
    description:
      'Clients book and pay online. You get a notification. No back-and-forth emails.',
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
  },
  {
    icon: Users,
    title: 'Monthly Zoom Calls',
    description:
      "Real talk with other pros about what's working. No pitch. Just 'here's what we're seeing.'",
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
    description: 'The essentials',
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
    description: 'The full membership',
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
    description: 'White glove',
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
    answer:
      "Nope. That's the point. We handle the tech so you don't have to become a tech person.",
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
      "No. We train it on your voice, your services, your style. It sounds like a helpful version of you — not a generic bot.",
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. No contracts, no cancellation fees, no guilt trips. We earn your business every month.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-bold text-text-primary">
            HANDLED
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-text-muted hover:text-text-primary transition-colors">
              What&apos;s Included
            </Link>
            <Link href="#pricing" className="text-text-muted hover:text-text-primary transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="text-text-muted hover:text-text-primary transition-colors">
              FAQ
            </Link>
            <Link href="/login" className="text-text-muted hover:text-text-primary transition-colors">
              Sign In
            </Link>
            <Button asChild variant="sage" className="rounded-full px-6">
              <Link href="/signup">Get Handled</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        {/* Ambient decorations */}
        <div
          className="absolute top-1/4 right-[15%] w-96 h-96 bg-sage/8 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1/4 left-[10%] w-64 h-64 bg-sage/5 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.1] tracking-tight">
            You&apos;re a <ScrollingIdentity />
          </h1>
          <p className="mt-6 font-serif text-2xl sm:text-3xl md:text-4xl font-semibold text-sage">
            The rest is handled.
          </p>
          <p className="mt-8 text-lg md:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed">
            Websites. Booking. Payments. AI. Plus a monthly filter for what&apos;s
            actually worth knowing. For people with better things to do.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              variant="sage"
              className="rounded-full px-10 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link href="/signup">Get Handled</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full px-10 py-6 text-lg hover:bg-neutral-50 transition-all duration-300"
            >
              <Link href="#features">See What&apos;s Included</Link>
            </Button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-neutral-300 flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-neutral-400 rounded-full" />
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 md:py-32 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary leading-tight">
            You didn&apos;t start your business to debug a website.
          </h2>
          <div className="mt-8 space-y-6 text-lg text-text-muted leading-relaxed">
            <p>
              You became a photographer because you see the world differently. A therapist
              because you help people heal. A coach because you unlock potential.
            </p>
            <p>
              But somewhere between the first DM and the final delivery, you became your own
              IT department. Calendar Tetris. Payment chasing. Tutorial watching. The AI tool
              of the week that promises to &quot;revolutionize&quot; everything.
            </p>
            <p>
              The tech keeps changing. Every week there&apos;s something new you &quot;should&quot; be
              learning. It&apos;s exhausting. And it&apos;s stealing time from the work that actually
              matters.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 px-6 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary">
              What you get. What you skip.
            </h2>
            <p className="mt-4 text-lg text-text-muted">
              One membership. Website, booking, payments, AI assistant. We set it up. You show up for clients.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
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
      <section id="pricing" className="py-20 md:py-32 px-6 bg-neutral-50 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary">
              Pick a plan. Skip the tech anxiety.
            </h2>
            <p className="mt-4 text-lg text-text-muted">
              No contracts. No hidden fees. Cancel anytime.
            </p>
            {/* Trust badges */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-text-muted">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-sage" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-sage" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-sage" />
                <span>Humans answer</span>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`bg-white rounded-3xl p-8 shadow-sm border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
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

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-32 px-6 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-text-primary text-center mb-12">
            Questions? Answers.
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={index}
                className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden"
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
      <section className="py-20 md:py-32 px-6 bg-sage text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold leading-tight">
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
          <div className="text-sm">© {new Date().getFullYear()} HANDLED. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
