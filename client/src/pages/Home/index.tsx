import { HeroSection } from './HeroSection';
import { ProblemSection } from './ProblemSection';
import { StorefrontSection } from './StorefrontSection';
import { HowItWorksSection } from './HowItWorksSection';
import { WaitlistCTASection } from './WaitlistCTASection';
import { WhoItsForSection } from './WhoItsForSection';

/**
 * Home page - Apple-quality landing page
 *
 * Hero's journey for creative professionals:
 * 1. Hero - Transformation promise: Book more clients. Build your business.
 * 2. Problem - Identity recognition: You're a photographer, not a bookkeeper.
 * 3. Solution - The product: One link. Complete booking system.
 * 4. How It Works - Dual-panel: Your dashboard vs client storefront.
 * 5. CTA - Action: Ready to get back to your craft?
 *
 * Design principles:
 * - Generous whitespace (py-32 md:py-40)
 * - Serif headlines for warmth
 * - Subtle ambient animations
 * - Elevated 3-tier visual hierarchy
 *
 * Note: SocialProofSection available when we have real testimonials.
 */
export function Home() {
  return (
    <main>
      <HeroSection />
      <WhoItsForSection />
      <ProblemSection />
      <StorefrontSection />
      <HowItWorksSection />
      <WaitlistCTASection />
    </main>
  );
}
