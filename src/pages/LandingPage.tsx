import { FaqSection } from '../features/landing/FaqSection';
import { FeaturesSection } from '../features/landing/FeaturesSection';
import { HeroSection } from '../features/landing/HeroSection';
import { LandingFooter } from '../features/landing/LandingFooter';
import { LandingHeader } from '../features/landing/LandingHeader';
import { PricingSection } from '../features/landing/PricingSection';
import { TrustSection } from '../features/landing/TrustSection';

/**
 * The public home page.
 *
 * Assembled from sections rather than written as one file so that the pricing block can also be a
 * page of its own (`/pricing`, which the prerender step needs as a separate address) without the
 * two drifting apart.
 */
export function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <TrustSection />
        <PricingSection />
        <FaqSection />
      </main>
      <LandingFooter />
    </>
  );
}
