/**
 * Admin Agent Capability Map
 *
 * Defines what the tenant admin (business assistant) can do.
 * This is the most comprehensive agent with full read/write capabilities.
 *
 * Admin Agent Purpose:
 * Help tenant owners manage their business - packages, bookings, customers,
 * storefront, and payments. Uses HANDLED brand voice.
 */

import type { AgentCapabilityMap } from './capability-map';

/**
 * Admin Agent Capabilities
 *
 * Full business management toolset organized by category:
 * - Read: Business data, analytics, status checks
 * - Catalog: Packages, segments, add-ons
 * - Booking: Create, update, cancel bookings
 * - Payment: Refunds, deposit settings, Stripe
 * - Marketing: Storefront, branding, landing page
 */
export const ADMIN_AGENT_CAPABILITIES: AgentCapabilityMap = {
  agentType: 'admin',
  description:
    'Business assistant for tenant admins. Full read/write access to manage packages, bookings, customers, storefront, and payments.',
  capabilities: [
    // ═══════════════════════════════════════════════════════════════════════════
    // READ CAPABILITIES
    // ═══════════════════════════════════════════════════════════════════════════

    {
      id: 'view-business-profile',
      description: 'Get business profile including name, branding, and setup status',
      requiredTool: 'get_tenant',
      trustTier: 'T1',
      promptKeywords: ['business', 'profile', 'account', 'settings'],
      category: 'read',
    },
    {
      id: 'view-dashboard',
      description: 'Get dashboard with package count, booking stats, and revenue',
      requiredTool: 'get_dashboard',
      trustTier: 'T1',
      promptKeywords: ['dashboard', 'stats', 'revenue', 'overview', 'metrics'],
      category: 'read',
    },
    {
      id: 'view-packages',
      description: 'View all packages with pricing and details',
      requiredTool: 'get_packages',
      trustTier: 'T1',
      promptKeywords: ['packages', 'services', 'offerings', 'pricing'],
      category: 'read',
    },
    {
      id: 'view-addons',
      description: 'View all add-ons with pricing',
      requiredTool: 'get_addons',
      trustTier: 'T1',
      promptKeywords: ['add-ons', 'extras', 'upsells'],
      category: 'read',
    },
    {
      id: 'view-bookings-list',
      description: 'View bookings with filters for status, date range, search',
      requiredTool: 'get_bookings',
      trustTier: 'T1',
      promptKeywords: ['bookings', 'appointments', 'schedule', 'calendar'],
      category: 'read',
    },
    {
      id: 'view-booking-detail',
      description: 'Get full details of a single booking including customer info',
      requiredTool: 'get_booking',
      trustTier: 'T1',
      promptKeywords: ['booking', 'appointment', 'details'],
      category: 'read',
    },
    {
      id: 'check-availability',
      description: 'Check if a specific date is available for booking',
      requiredTool: 'check_availability',
      trustTier: 'T1',
      promptKeywords: ['available', 'open', 'free', 'date'],
      category: 'read',
    },
    {
      id: 'view-blackout-dates',
      description: 'View all blocked/blackout dates',
      requiredTool: 'get_blackout_dates',
      trustTier: 'T1',
      promptKeywords: ['blocked', 'blackout', 'unavailable', 'vacation'],
      category: 'read',
    },
    {
      id: 'view-availability-rules',
      description: 'View working hours and availability rules',
      requiredTool: 'get_availability_rules',
      trustTier: 'T1',
      promptKeywords: ['working hours', 'availability', 'schedule', 'hours'],
      category: 'read',
    },
    {
      id: 'view-landing-page',
      description: 'Get storefront landing page configuration',
      requiredTool: 'get_landing_page',
      trustTier: 'T1',
      promptKeywords: ['storefront', 'landing page', 'website', 'homepage'],
      category: 'read',
    },
    {
      id: 'view-stripe-status',
      description: 'Check Stripe Connect payment setup status',
      requiredTool: 'get_stripe_status',
      trustTier: 'T1',
      promptKeywords: ['stripe', 'payments', 'connected', 'setup'],
      category: 'read',
    },
    {
      id: 'view-customers',
      description: 'View customers with booking counts and total spent',
      requiredTool: 'get_customers',
      trustTier: 'T1',
      promptKeywords: ['customers', 'clients', 'contacts'],
      category: 'read',
    },
    {
      id: 'view-segments',
      description: 'View service segments that organize packages',
      requiredTool: 'get_segments',
      trustTier: 'T1',
      promptKeywords: ['segments', 'categories', 'groups'],
      category: 'read',
    },
    {
      id: 'view-trial-status',
      description: 'Check trial and subscription status',
      requiredTool: 'get_trial_status',
      trustTier: 'T1',
      promptKeywords: ['trial', 'subscription', 'billing', 'plan'],
      category: 'read',
    },
    {
      id: 'get-booking-link',
      description: 'Get storefront URL and package-specific booking links',
      requiredTool: 'get_booking_link',
      trustTier: 'T1',
      promptKeywords: ['link', 'url', 'share', 'booking link'],
      category: 'read',
    },
    {
      id: 'refresh-context',
      description: 'Refresh business context data during long sessions',
      requiredTool: 'refresh_context',
      trustTier: 'T1',
      promptKeywords: ['refresh', 'update', 'current', 'latest'],
      category: 'read',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // CATALOG MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    {
      id: 'create-update-package',
      description: 'Create or update a service package with pricing',
      requiredTool: 'upsert_package',
      trustTier: 'T2', // Escalates to T3 for significant price changes
      promptKeywords: ['create package', 'update package', 'pricing', 'add service'],
      category: 'catalog',
    },
    {
      id: 'delete-package',
      description: 'Delete a package (marks as inactive)',
      requiredTool: 'delete_package',
      trustTier: 'T2', // Escalates to T3 if has bookings
      promptKeywords: ['delete package', 'remove service', 'deactivate', 'deletes'],
      category: 'catalog',
    },
    {
      id: 'delete-package-photo',
      description: 'Delete a photo from a package (can be re-uploaded)',
      requiredTool: 'delete_package_photo',
      trustTier: 'T2',
      // Matches "Package changes" in admin prompt (T2 operations section)
      promptKeywords: ['package changes', 'delete photo', 'remove photo', 'package photo'],
      category: 'catalog',
    },
    {
      id: 'create-update-addon',
      description: 'Create or update an add-on',
      requiredTool: 'upsert_addon',
      trustTier: 'T2',
      promptKeywords: ['add-on', 'extra', 'upsell', 'create add-on', 'package changes'],
      category: 'catalog',
    },
    {
      id: 'delete-addon',
      description: 'Delete an add-on',
      requiredTool: 'delete_addon',
      trustTier: 'T2', // Escalates to T3 if has bookings
      promptKeywords: ['delete add-on', 'remove extra', 'deletes'],
      category: 'catalog',
    },
    {
      id: 'create-update-segment',
      description: 'Create or update a service segment',
      requiredTool: 'upsert_segment',
      trustTier: 'T2',
      promptKeywords: ['segment', 'category', 'organize', 'package changes'],
      category: 'catalog',
    },
    {
      id: 'delete-segment',
      description: 'Delete a segment',
      requiredTool: 'delete_segment',
      trustTier: 'T2', // Escalates to T3 if has packages
      promptKeywords: ['delete segment', 'remove category', 'deletes'],
      category: 'catalog',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // BOOKING MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    {
      id: 'create-manual-booking',
      description: 'Create a manual booking (phone orders, walk-ins)',
      requiredTool: 'create_booking',
      trustTier: 'T3',
      promptKeywords: [
        'manual booking',
        'phone order',
        'walk-in',
        'add booking',
        'getting bookings',
      ],
      category: 'booking',
    },
    {
      id: 'update-booking',
      description: 'Reschedule or update booking details',
      requiredTool: 'update_booking',
      trustTier: 'T2',
      promptKeywords: [
        'reschedule',
        'move booking',
        'change date',
        'update notes',
        'getting bookings',
      ],
      category: 'booking',
    },
    {
      id: 'cancel-booking',
      description: 'Cancel a booking and process refund',
      requiredTool: 'cancel_booking',
      trustTier: 'T3',
      promptKeywords: ['cancel', 'cancellation', 'refund'],
      category: 'booking',
    },
    {
      id: 'add-blackout-date',
      description: 'Block a date or date range for bookings',
      requiredTool: 'add_blackout_date',
      trustTier: 'T1',
      promptKeywords: ['block', 'vacation', 'holiday', 'day off', 'unavailable', 'blackouts'],
      category: 'booking',
    },
    {
      id: 'remove-blackout-date',
      description: 'Unblock a date to allow bookings again',
      requiredTool: 'remove_blackout_date',
      trustTier: 'T2',
      promptKeywords: ['unblock', 'open up', 'remove blackout', 'blackouts'],
      category: 'booking',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PAYMENT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    {
      id: 'process-refund',
      description: 'Process full or partial refund for a booking',
      requiredTool: 'process_refund',
      trustTier: 'T3',
      promptKeywords: ['refund', 'money back', 'partial refund'],
      category: 'payment',
    },
    {
      id: 'update-deposit-settings',
      description: 'Configure deposit percentage and balance due timing',
      requiredTool: 'update_deposit_settings',
      trustTier: 'T3',
      promptKeywords: ['deposit', 'down payment', 'balance due', 'payment settings', 'refunds'],
      category: 'payment',
    },
    {
      id: 'start-trial',
      description: 'Start a 14-day trial for the business',
      requiredTool: 'start_trial',
      trustTier: 'T2',
      promptKeywords: ['trial', 'free trial', 'start trial', 'billing', 'subscription'],
      category: 'payment',
    },
    {
      id: 'setup-stripe',
      description: 'Initiate Stripe Connect payment setup',
      requiredTool: 'initiate_stripe_onboarding',
      trustTier: 'T2',
      promptKeywords: ['stripe', 'payments', 'connect payments', 'accept payments'],
      category: 'payment',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MARKETING & BRANDING
    // ═══════════════════════════════════════════════════════════════════════════

    {
      id: 'update-branding',
      description: 'Update business branding (colors, logo)',
      requiredTool: 'update_branding',
      trustTier: 'T1',
      promptKeywords: ['branding', 'colors', 'logo', 'theme'],
      category: 'marketing',
    },
    {
      id: 'update-landing-page',
      description: 'Update storefront landing page sections',
      requiredTool: 'update_landing_page',
      trustTier: 'T2',
      promptKeywords: ['landing page', 'hero', 'about', 'testimonials', 'faq'],
      category: 'marketing',
    },
    {
      id: 'request-file-upload',
      description: 'Get instructions for uploading files (logo, photos)',
      requiredTool: 'request_file_upload',
      trustTier: 'T1',
      promptKeywords: ['upload', 'photo', 'image', 'logo', 'file'],
      category: 'marketing',
    },
  ],
};

/**
 * Admin capability categories
 *
 * Organized by business function for easier navigation.
 */
export const ADMIN_CAPABILITY_CATEGORIES = {
  read: 'Business Data & Analytics',
  catalog: 'Package & Service Management',
  booking: 'Booking & Availability',
  payment: 'Payments & Billing',
  marketing: 'Storefront & Branding',
} as const;

/**
 * Critical paths that must work for admin functionality
 *
 * These are tested with higher priority in CI.
 */
export const CRITICAL_ADMIN_PATHS = [
  {
    name: 'view-business-overview',
    description: 'Admin can view dashboard and key metrics',
    capabilities: [
      'view-dashboard',
      'view-business-profile',
      'view-packages',
      'view-bookings-list',
    ],
  },
  {
    name: 'manage-services',
    description: 'Admin can create and manage service packages',
    capabilities: ['view-packages', 'create-update-package', 'delete-package', 'view-segments'],
  },
  {
    name: 'manage-bookings',
    description: 'Admin can create, update, and cancel bookings',
    capabilities: [
      'view-bookings-list',
      'check-availability',
      'create-manual-booking',
      'update-booking',
      'cancel-booking',
    ],
  },
  {
    name: 'manage-availability',
    description: 'Admin can block and unblock dates',
    capabilities: [
      'check-availability',
      'view-blackout-dates',
      'add-blackout-date',
      'remove-blackout-date',
    ],
  },
  {
    name: 'setup-payments',
    description: 'Admin can set up Stripe and configure deposit settings',
    capabilities: ['view-stripe-status', 'setup-stripe', 'update-deposit-settings'],
  },
  {
    name: 'customize-storefront',
    description: 'Admin can update branding and landing page',
    capabilities: [
      'view-landing-page',
      'update-branding',
      'update-landing-page',
      'request-file-upload',
    ],
  },
] as const;

/**
 * High-risk capabilities requiring T3 confirmation
 *
 * These always require explicit user confirmation.
 */
export const HIGH_RISK_ADMIN_CAPABILITIES = [
  'create-manual-booking',
  'cancel-booking',
  'process-refund',
  'update-deposit-settings',
] as const;

/**
 * Capabilities that may escalate from T2 to T3
 *
 * These escalate based on context (e.g., significant price change, has bookings).
 */
export const ESCALATING_ADMIN_CAPABILITIES = [
  { id: 'create-update-package', condition: 'Significant price change (>20% or >$100)' },
  { id: 'delete-package', condition: 'Package has existing bookings' },
  { id: 'delete-addon', condition: 'Add-on has existing bookings' },
  { id: 'delete-segment', condition: 'Segment has packages' },
] as const;
