/**
 * Seed data initialization for mock adapters
 *
 * Seeds default tenant, tiers, add-ons, and admin user into shared state.
 * Called once on module load via the barrel index.ts.
 */

import bcrypt from 'bcryptjs';
import { logger } from '../../lib/core/logger';
import { DEFAULT_TENANT, tiers, addOns, users, tenants } from './state';

// Seed default tenant for mock mode
function seedTenants(): void {
  if (tenants.size > 0) return; // Already seeded

  // Default test tenant for mock mode
  tenants.set(DEFAULT_TENANT, {
    id: DEFAULT_TENANT,
    slug: 'test-studio',
    name: 'Test Photography Studio',
    email: 'test@example.com',
    apiKeyPublic: `pk_live_test-studio_mock123`,
    apiKeySecret: `sk_live_test-studio_mock456`,
    commissionPercent: 10,
    branding: {
      businessType: 'photography',
      industry: 'creative services',
      tagline: 'Capturing moments that last forever',
      discoveryFacts: {
        businessName: 'Test Photography Studio',
        targetAudience: 'couples and families',
        uniqueSellingPoint: 'personalized service',
      },
    },
    stripeAccountId: null,
    stripeOnboarded: false,
    isActive: true,
    isTestTenant: false,
    tier: 'PRO',
    onboardingStatus: 'COMPLETE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  logger.debug('Mock tenant seeded: test-studio');
}

// Seed data on module load
// NOTE: Tier slugs MUST match demo.ts seed slugs (starter, growth, enterprise)
// to ensure booking links work correctly across mock and real modes.
export function seedData(): void {
  if (tiers.size > 0) return; // Already seeded

  // Seed tenants first (for tenant isolation in mock mode)
  seedTenants();

  // Tiers - aligned with demo.ts seed slugs for consistency
  tiers.set('tier_starter', {
    id: 'tier_starter',
    tenantId: DEFAULT_TENANT,
    slug: 'starter',
    title: 'Starter Tier',
    description:
      'Essential business services to get you started. Perfect for solopreneurs ready to focus on their craft.',
    priceCents: 25000, // $250
    photoUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
    bookingType: 'DATE',
  });

  tiers.set('tier_growth', {
    id: 'tier_growth',
    tenantId: DEFAULT_TENANT,
    slug: 'growth',
    title: 'Growth Tier',
    description: 'Full-service support for growing businesses. Scale with confidence.',
    priceCents: 50000, // $500
    photoUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
    bookingType: 'DATE',
  });

  tiers.set('tier_enterprise', {
    id: 'tier_enterprise',
    tenantId: DEFAULT_TENANT,
    slug: 'enterprise',
    title: 'Enterprise Tier',
    description: 'Comprehensive solutions for established businesses. Your complete back office.',
    priceCents: 100000, // $1,000
    photoUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=600&fit=crop',
    photos: [],
    active: true,
    segmentId: null,
    grouping: null,
    groupingOrder: null,
    bookingType: 'DATE',
  });

  // Add-ons - aligned with demo.ts seed add-ons for consistency
  addOns.set('addon_social_media', {
    id: 'addon_social_media',
    tierId: 'tier_starter',
    title: 'Social Media Management',
    description: 'Monthly social media content and posting',
    priceCents: 15000, // $150
    photoUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
  });

  addOns.set('addon_email_marketing', {
    id: 'addon_email_marketing',
    tierId: 'tier_starter',
    title: 'Email Marketing',
    description: 'Automated email sequences and campaigns',
    priceCents: 10000, // $100
    photoUrl: 'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=400&h=300&fit=crop',
  });

  addOns.set('addon_crm_setup', {
    id: 'addon_crm_setup',
    tierId: 'tier_growth',
    title: 'CRM Setup & Training',
    description: 'Custom CRM configuration and onboarding',
    priceCents: 25000, // $250
    photoUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
  });

  addOns.set('addon_dedicated_manager', {
    id: 'addon_dedicated_manager',
    tierId: 'tier_enterprise',
    title: 'Dedicated Account Manager',
    description: 'Personal point of contact for all your needs',
    priceCents: 50000, // $500
    photoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop',
  });

  // Admin user
  // OWASP 2023 recommendation for bcrypt rounds
  const passwordHash = bcrypt.hashSync('admin123', 12);
  users.set('admin@macon.com', {
    id: 'user_admin',
    email: 'admin@macon.com',
    passwordHash,
    role: 'admin',
  });

  logger.debug('Mock data seeded: 3 tiers, 4 add-ons, 1 admin user');
}
