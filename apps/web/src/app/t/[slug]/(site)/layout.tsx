import { notFound } from 'next/navigation';
import { getTenantStorefrontData, TenantNotFoundError } from '@/lib/tenant';
import { TenantNav } from '@/components/tenant/TenantNav';
import { TenantFooter } from '@/components/tenant/TenantFooter';
import { TenantChatWidget } from '@/components/chat/TenantChatWidget';
import { StickyMobileCTA } from '@/components/tenant/StickyMobileCTA';

interface TenantSiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Shared layout for tenant site pages
 *
 * This layout wraps all pages in the (site) route group with:
 * - TenantNav (sticky header with navigation)
 * - TenantFooter (copyright and attribution)
 *
 * The booking flow (/book/*) does NOT use this layout,
 * keeping its focused checkout experience.
 */
export default async function TenantSiteLayout({ children, params }: TenantSiteLayoutProps) {
  const { slug } = await params;

  try {
    const { tenant } = await getTenantStorefrontData(slug);

    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <TenantNav tenant={tenant} />
        <div className="flex-1">{children}</div>
        <TenantFooter tenant={tenant} />

        {/* Customer Chat Widget - floating chatbot for booking assistance */}
        <TenantChatWidget
          tenantApiKey={tenant.apiKeyPublic}
          businessName={tenant.name}
          primaryColor={tenant.primaryColor}
          chatEnabled={tenant.chatEnabled}
        />

        {/* Sticky Mobile CTA - appears on scroll for easy booking access */}
        <StickyMobileCTA
          ctaText={tenant.branding?.landingPage?.hero?.ctaText || 'View Packages'}
          href="#packages"
          observeElementId="main-content"
        />
      </div>
    );
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      notFound();
    }
    throw error;
  }
}
