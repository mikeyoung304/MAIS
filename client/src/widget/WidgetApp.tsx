import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WidgetMessenger } from './WidgetMessenger';
import { WidgetCatalogGrid } from './WidgetCatalogGrid';
import { WidgetPackagePage } from './WidgetPackagePage';
import { api } from '../lib/api';
import { useTenantBranding } from '../hooks/useTenantBranding';
import type { TenantBrandingDto } from '@macon/contracts';

interface WidgetConfig {
  tenant: string;
  apiKey: string;
  mode: 'embedded' | 'modal';
  parentOrigin: string | null;
}

interface Props {
  config: WidgetConfig;
}

/**
 * Main widget application
 *
 * Responsibilities:
 * 1. Fetch tenant branding and apply CSS variables
 * 2. Fetch catalog packages (via child components)
 * 3. Handle navigation (catalog → package → booking)
 * 4. Auto-resize iframe via postMessage
 * 5. Send booking events to parent window
 */
export function WidgetApp({ config }: Props): JSX.Element {
  const [currentView, setCurrentView] = useState<'catalog' | 'package'>('catalog');
  const [selectedPackageSlug, setSelectedPackageSlug] = useState<string | null>(null);
  const messenger = WidgetMessenger.getInstance(config.parentOrigin ?? '*');
  const containerRef = useRef<HTMLDivElement>(null);

  // Configure API client with tenant context
  useEffect(() => {
    (api as unknown as { setTenantKey: (key: string) => void }).setTenantKey(config.apiKey);
  }, [config.apiKey]);

  // Fetch tenant branding
  const { data: branding, isLoading: brandingLoading } = useQuery<TenantBrandingDto>({
    queryKey: ['tenant', 'branding', config.tenant],
    queryFn: async () => {
      const result = await (api as unknown as { getTenantBranding: () => Promise<{ status: number; body: TenantBrandingDto }> }).getTenantBranding();
      if (result.status === 200 && result.body) {
        return result.body;
      }
      // Fallback to defaults if branding not configured
      return {
        primaryColor: '#7C3AED',
        secondaryColor: '#DDD6FE',
        fontFamily: 'Inter, system-ui, sans-serif',
      };
    },
  });

  // Apply branding CSS variables via shared hook
  useTenantBranding(branding);

  // Notify parent that widget is ready
  useEffect(() => {
    messenger.sendReady();
  }, [messenger]);

  // Auto-resize iframe when content changes
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        const height = containerRef.current.scrollHeight;
        messenger.sendResize(height);
      }
    });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [messenger]);

  // Listen for messages from parent
  useEffect(() => {
    const handleParentMessage = (event: MessageEvent) => {
      // Basic validation - check if message is from parent
      const eventData: unknown = event.data;
      const checkRecord = (v: unknown): v is Record<string, unknown> =>
        typeof v === 'object' && v !== null && !Array.isArray(v);

      if (!checkRecord(eventData) || eventData.source !== 'elope-parent') return;

      const msgType = typeof eventData.type === 'string' ? eventData.type : '';

      switch (msgType) {
        case 'OPEN_BOOKING':
          if (typeof eventData.packageSlug === 'string') {
            setSelectedPackageSlug(eventData.packageSlug);
            setCurrentView('package');
          }
          break;
        case 'CLOSE':
          setCurrentView('catalog');
          setSelectedPackageSlug(null);
          break;
        case 'NAVIGATE_BACK':
          setCurrentView('catalog');
          setSelectedPackageSlug(null);
          break;
      }
    };

    window.addEventListener('message', handleParentMessage);
    return () => {
      window.removeEventListener('message', handleParentMessage);
    };
  }, []);

  // Handle package selection
  const handlePackageClick = (slug: string) => {
    setSelectedPackageSlug(slug);
    setCurrentView('package');
    messenger.sendNavigation('package', { slug });
  };

  // Handle back to catalog
  const handleBack = () => {
    setCurrentView('catalog');
    setSelectedPackageSlug(null);
    messenger.sendNavigation('catalog');
  };

  // Handle booking completion (after successful payment)
  const handleBookingComplete = (bookingId: string) => {
    messenger.sendBookingCompleted(bookingId);
    // Optionally navigate back to catalog
    // setCurrentView('catalog');
    // setSelectedPackageSlug(null);
  };

  if (brandingLoading) {
    return (
      <div ref={containerRef} className="min-h-screen bg-gray-50 p-4">
        <div className="text-center py-12 text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="elope-widget min-h-screen bg-macon-navy-900 p-4">
      {currentView === 'catalog' && <WidgetCatalogGrid onPackageClick={handlePackageClick} />}

      {currentView === 'package' && selectedPackageSlug && (
        <WidgetPackagePage
          packageSlug={selectedPackageSlug}
          onBack={handleBack}
          onBookingComplete={handleBookingComplete}
        />
      )}
    </div>
  );
}
