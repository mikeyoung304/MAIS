'use client';

/**
 * TenantChatWidget - Client component wrapper for customer chat
 *
 * This is a thin wrapper that receives tenant data from the server component
 * and renders the CustomerChatWidget with proper props.
 */

import { CustomerChatWidget } from './CustomerChatWidget';

interface TenantChatWidgetProps {
  tenantSlug: string;
  tenantApiKey: string;
  businessName: string;
  primaryColor?: string;
  chatEnabled?: boolean;
}

export function TenantChatWidget({
  tenantSlug,
  tenantApiKey,
  businessName,
  primaryColor,
  chatEnabled = true,
}: TenantChatWidgetProps) {
  // Don't render if chat is disabled for this tenant
  if (!chatEnabled) {
    return null;
  }

  return (
    <CustomerChatWidget
      tenantSlug={tenantSlug}
      tenantApiKey={tenantApiKey}
      businessName={businessName}
      primaryColor={primaryColor}
    />
  );
}

export default TenantChatWidget;
