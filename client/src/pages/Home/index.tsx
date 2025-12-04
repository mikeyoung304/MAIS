import { HeroSection } from "./HeroSection";
import { ProblemSection } from "./ProblemSection";
import { StorefrontSection } from "./StorefrontSection";
import { WaitlistCTASection } from "./WaitlistCTASection";

/**
 * Home page - Pre-Launch Waitlist Landing
 *
 * Minimal, high-end agency approach.
 * Hero's journey: artist drowning in admin → we free them to do their craft.
 *
 * Section flow:
 * 1. Hero - Get more bookings. Clear value prop.
 * 2. Problem - Quick recognition of the admin burden
 * 3. Storefront - The 3-tier silhouette (show, don't explain)
 * 4. WaitlistCTA - Simple ask
 */
export function Home() {
  return (
    <main>
      <HeroSection />
      <ProblemSection />
      <StorefrontSection />
      <WaitlistCTASection />
    </main>
  );
}
