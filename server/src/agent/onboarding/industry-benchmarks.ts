/**
 * Industry Benchmarks for Onboarding Agent
 *
 * Provides pricing benchmarks and tier recommendations for different business types.
 * Uses static fallback data that is always available - web search can enhance but
 * never blocks the onboarding flow.
 *
 * Architecture:
 * - Fallback-first: Static benchmarks always work
 * - Web search enhancement: Can augment with real-time data when available
 * - No isFallback boolean (Fix #6): Uses source enum to track data provenance
 *
 * Data Sources:
 * - Industry reports (Wedding Wire, The Knot, etc.)
 * - Professional association pricing surveys
 * - Market research from 2023-2024
 */

import type {
  BusinessType,
  MarketResearchSource,
  PricingBenchmarks,
  PricingTierRecommendation,
} from '@macon/contracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Industry benchmarks data structure
 */
export interface IndustryBenchmarks {
  businessType: BusinessType;
  source: MarketResearchSource;
  marketLowCents: number;
  marketMedianCents: number;
  marketHighCents: number;
  recommendedTiers: PricingTierRecommendation[];
  insights: string[];
  dataYear: number;
}

// ============================================================================
// Static Benchmark Data
// ============================================================================

/**
 * Static benchmark data for all supported business types.
 * Prices in cents. Based on US national averages from 2023-2024.
 */
const BENCHMARK_DATA: Record<BusinessType, IndustryBenchmarks> = {
  photographer: {
    businessType: 'photographer',
    source: 'industry_benchmark',
    marketLowCents: 150000, // $1,500
    marketMedianCents: 350000, // $3,500
    marketHighCents: 800000, // $8,000
    recommendedTiers: [
      {
        name: 'Essential Coverage',
        description: '4-6 hours of coverage, perfect for elopements or intimate gatherings',
        suggestedPriceCents: 200000,
        priceRangeLowCents: 150000,
        priceRangeHighCents: 300000,
        includedServices: [
          '4-6 hours coverage',
          '200-300 edited photos',
          'Online gallery',
          'Print release',
        ],
      },
      {
        name: 'Full Day Collection',
        description: '8-10 hours of coverage with engagement session included',
        suggestedPriceCents: 400000,
        priceRangeLowCents: 300000,
        priceRangeHighCents: 500000,
        includedServices: [
          '8-10 hours coverage',
          '500-700 edited photos',
          'Engagement session',
          'Online gallery',
          'Print release',
          'Second shooter',
        ],
      },
      {
        name: 'Luxury Experience',
        description: 'Comprehensive coverage with albums and premium deliverables',
        suggestedPriceCents: 700000,
        priceRangeLowCents: 550000,
        priceRangeHighCents: 1000000,
        includedServices: [
          'Full day coverage',
          '800+ edited photos',
          'Engagement session',
          'Premium album',
          'Fine art prints',
          'Second shooter',
          'Same-day edit preview',
        ],
      },
    ],
    insights: [
      'Most couples book 6-9 months before their wedding',
      'Engagement sessions increase final package value by 15-20%',
      'Albums have high profit margins (60-70%) and increase client satisfaction',
      'Second shooter adds perceived value and is expected at mid-tier and above',
    ],
    dataYear: 2024,
  },

  videographer: {
    businessType: 'videographer',
    source: 'industry_benchmark',
    marketLowCents: 200000,
    marketMedianCents: 400000,
    marketHighCents: 1000000,
    recommendedTiers: [
      {
        name: 'Highlight Film',
        description: '3-5 minute cinematic highlight of your day',
        suggestedPriceCents: 250000,
        priceRangeLowCents: 180000,
        priceRangeHighCents: 350000,
        includedServices: ['6 hours coverage', '3-5 min highlight film', 'Licensed music', 'Digital delivery'],
      },
      {
        name: 'Documentary Package',
        description: 'Full ceremony, speeches, and extended highlight film',
        suggestedPriceCents: 450000,
        priceRangeLowCents: 350000,
        priceRangeHighCents: 600000,
        includedServices: [
          '8-10 hours coverage',
          '5-8 min highlight film',
          'Full ceremony edit',
          'Reception speeches',
          'Second videographer',
        ],
      },
      {
        name: 'Cinematic Feature',
        description: 'Premium film production with drone footage and same-day edit',
        suggestedPriceCents: 800000,
        priceRangeLowCents: 600000,
        priceRangeHighCents: 1200000,
        includedServices: [
          'Full day coverage',
          '10-15 min feature film',
          'Drone footage',
          'Same-day edit',
          'Raw footage archive',
          'Premium audio capture',
        ],
      },
    ],
    insights: [
      'Drone footage commands premium pricing (typically +$500-1000)',
      'Same-day edits are becoming expected at higher tiers',
      'Raw footage delivery adds minimal cost but high perceived value',
    ],
    dataYear: 2024,
  },

  wedding_planner: {
    businessType: 'wedding_planner',
    source: 'industry_benchmark',
    marketLowCents: 200000,
    marketMedianCents: 500000,
    marketHighCents: 1500000,
    recommendedTiers: [
      {
        name: 'Day-Of Coordination',
        description: 'Expert management of your wedding day timeline and vendors',
        suggestedPriceCents: 200000,
        priceRangeLowCents: 150000,
        priceRangeHighCents: 300000,
        includedServices: [
          'Timeline creation',
          'Vendor coordination',
          'Rehearsal management',
          '10+ hours day-of coverage',
          'Emergency kit',
        ],
      },
      {
        name: 'Partial Planning',
        description: 'Design assistance plus full day-of coordination',
        suggestedPriceCents: 450000,
        priceRangeLowCents: 350000,
        priceRangeHighCents: 600000,
        includedServices: [
          'Vendor recommendations',
          'Budget management',
          'Design consultations',
          'Full day-of coordination',
          'Timeline creation',
          'Guest management tools',
        ],
      },
      {
        name: 'Full Planning',
        description: 'Complete wedding planning from engagement to honeymoon',
        suggestedPriceCents: 800000,
        priceRangeLowCents: 600000,
        priceRangeHighCents: 2000000,
        includedServices: [
          'Unlimited consultations',
          'Complete vendor sourcing',
          'Contract negotiation',
          'Design and styling',
          'Full coordination',
          'Guest experience design',
        ],
      },
    ],
    insights: [
      'Destination weddings command 20-50% premium',
      'Month-of packages are increasingly replacing day-of',
      'Percentage-based pricing (10-15% of budget) common for full planning',
    ],
    dataYear: 2024,
  },

  florist: {
    businessType: 'florist',
    source: 'industry_benchmark',
    marketLowCents: 150000,
    marketMedianCents: 400000,
    marketHighCents: 1000000,
    recommendedTiers: [
      {
        name: 'Essential Blooms',
        description: 'Bridal bouquet, groom boutonniere, and ceremony arrangements',
        suggestedPriceCents: 180000,
        priceRangeLowCents: 120000,
        priceRangeHighCents: 250000,
        includedServices: [
          'Bridal bouquet',
          'Groom boutonniere',
          '2 ceremony arrangements',
          'Toss bouquet',
          'Delivery and setup',
        ],
      },
      {
        name: 'Garden Collection',
        description: 'Full wedding party florals plus reception centerpieces',
        suggestedPriceCents: 400000,
        priceRangeLowCents: 300000,
        priceRangeHighCents: 550000,
        includedServices: [
          'Bridal bouquet',
          'Bridesmaids bouquets',
          'All boutonnieres and corsages',
          '10-15 centerpieces',
          'Ceremony arch florals',
          'Setup and breakdown',
        ],
      },
      {
        name: 'Luxe Floral Design',
        description: 'Complete floral transformation with installations and premium blooms',
        suggestedPriceCents: 750000,
        priceRangeLowCents: 550000,
        priceRangeHighCents: 1500000,
        includedServices: [
          'Custom design consultation',
          'Premium/imported blooms',
          'All personal flowers',
          'Reception centerpieces',
          'Installation pieces',
          'Venue transformation',
        ],
      },
    ],
    insights: [
      'Seasonal flower selection can reduce costs 20-30%',
      'Installation pieces (arches, walls) have highest profit margins',
      'Repurposing ceremony flowers to reception reduces client cost',
    ],
    dataYear: 2024,
  },

  caterer: {
    businessType: 'caterer',
    source: 'industry_benchmark',
    marketLowCents: 5000, // Per person
    marketMedianCents: 15000,
    marketHighCents: 35000,
    recommendedTiers: [
      {
        name: 'Classic Buffet',
        description: 'Elegant buffet service with quality ingredients',
        suggestedPriceCents: 7500,
        priceRangeLowCents: 5000,
        priceRangeHighCents: 10000,
        includedServices: [
          'Appetizer hour',
          '2 proteins, 3 sides',
          'Salad course',
          'Linens and tableware',
          'Service staff',
        ],
      },
      {
        name: 'Plated Dinner',
        description: 'Multi-course plated dinner with tableside service',
        suggestedPriceCents: 15000,
        priceRangeLowCents: 11000,
        priceRangeHighCents: 20000,
        includedServices: [
          'Passed appetizers',
          'Plated salad',
          'Choice of entrée',
          'Dessert course',
          'Full service team',
          'Premium tableware',
        ],
      },
      {
        name: 'Gourmet Experience',
        description: 'Chef-curated menu with premium ingredients and presentation',
        suggestedPriceCents: 25000,
        priceRangeLowCents: 20000,
        priceRangeHighCents: 40000,
        includedServices: [
          'Custom menu design',
          'Premium proteins',
          'Wine pairing',
          'Interactive stations',
          'Late night snacks',
          'Dedicated event captain',
        ],
      },
    ],
    insights: [
      'Prices are per person - multiply by guest count for package total',
      'Alcohol service typically adds 30-50% to food costs',
      'Family-style service is trending and costs between buffet and plated',
    ],
    dataYear: 2024,
  },

  dj: {
    businessType: 'dj',
    source: 'industry_benchmark',
    marketLowCents: 80000,
    marketMedianCents: 150000,
    marketHighCents: 350000,
    recommendedTiers: [
      {
        name: 'Reception Essentials',
        description: '4 hours of DJ services with professional sound system',
        suggestedPriceCents: 100000,
        priceRangeLowCents: 75000,
        priceRangeHighCents: 150000,
        includedServices: [
          '4 hours coverage',
          'Professional sound system',
          'Wireless microphones',
          'Basic lighting',
          'Music consultation',
        ],
      },
      {
        name: 'Full Celebration',
        description: 'Complete event coverage with MC services and dance floor lighting',
        suggestedPriceCents: 175000,
        priceRangeLowCents: 130000,
        priceRangeHighCents: 225000,
        includedServices: [
          '6 hours coverage',
          'Ceremony music',
          'Cocktail hour',
          'MC services',
          'Dance floor lighting',
          'Backup equipment',
        ],
      },
      {
        name: 'Ultimate Entertainment',
        description: 'Premium entertainment with uplighting, photo booth, and production',
        suggestedPriceCents: 300000,
        priceRangeLowCents: 225000,
        priceRangeHighCents: 400000,
        includedServices: [
          'Full day coverage',
          'Intelligent lighting design',
          'Uplighting package',
          'Photo booth',
          'Live mixing',
          'Premium sound system',
        ],
      },
    ],
    insights: [
      'Uplighting adds $500-1500 but significantly transforms venues',
      'MC services are expected - charge separately if needed',
      'Photo booth add-on has 50%+ profit margin',
    ],
    dataYear: 2024,
  },

  officiant: {
    businessType: 'officiant',
    source: 'industry_benchmark',
    marketLowCents: 30000,
    marketMedianCents: 60000,
    marketHighCents: 150000,
    recommendedTiers: [
      {
        name: 'Simple Ceremony',
        description: 'Traditional or civil ceremony with standard vows',
        suggestedPriceCents: 40000,
        priceRangeLowCents: 25000,
        priceRangeHighCents: 60000,
        includedServices: [
          'Phone consultation',
          'Standard ceremony script',
          'Marriage license filing',
          'Rehearsal coordination',
        ],
      },
      {
        name: 'Personalized Ceremony',
        description: 'Custom ceremony crafted to reflect your unique story',
        suggestedPriceCents: 75000,
        priceRangeLowCents: 50000,
        priceRangeHighCents: 100000,
        includedServices: [
          'Multiple consultations',
          'Custom ceremony script',
          'Vow coaching',
          'Rehearsal attendance',
          'Unity ceremony guidance',
        ],
      },
      {
        name: 'Signature Experience',
        description: 'Bespoke ceremony with cultural traditions and family involvement',
        suggestedPriceCents: 125000,
        priceRangeLowCents: 100000,
        priceRangeHighCents: 200000,
        includedServices: [
          'In-depth interviews',
          'Family involvement coordination',
          'Cultural traditions',
          'Keepsake ceremony booklet',
          'Post-ceremony filing',
        ],
      },
    ],
    insights: [
      'Elopement packages can be priced 50% higher per hour than traditional',
      'Religious ceremonies may require additional training/certification',
      'Bilingual services command 25-50% premium',
    ],
    dataYear: 2024,
  },

  makeup_artist: {
    businessType: 'makeup_artist',
    source: 'industry_benchmark',
    marketLowCents: 15000,
    marketMedianCents: 30000,
    marketHighCents: 60000,
    recommendedTiers: [
      {
        name: 'Bridal Beauty',
        description: 'Flawless bridal makeup that photographs beautifully',
        suggestedPriceCents: 20000,
        priceRangeLowCents: 12500,
        priceRangeHighCents: 30000,
        includedServices: [
          'Bridal makeup application',
          'HD/airbrush foundation',
          'Lash application',
          'Touch-up kit',
        ],
      },
      {
        name: 'Bridal Party Package',
        description: 'Bride plus bridesmaids and mothers of the couple',
        suggestedPriceCents: 40000,
        priceRangeLowCents: 30000,
        priceRangeHighCents: 55000,
        includedServices: [
          'Bridal makeup',
          'Trial session',
          '4 bridesmaids',
          '2 mothers',
          'Touch-up kit',
          'On-call for touch-ups',
        ],
      },
      {
        name: 'Luxury Glam',
        description: 'Premium bridal beauty with multiple looks and extensive party service',
        suggestedPriceCents: 65000,
        priceRangeLowCents: 50000,
        priceRangeHighCents: 85000,
        includedServices: [
          'Bridal makeup (multiple looks)',
          'Full trial experience',
          'Unlimited party members',
          'On-site all day',
          'Premium product upgrade',
        ],
      },
    ],
    insights: [
      'Trial sessions convert 80%+ when included in packages',
      'Early morning calls (before 7am) can command premium rates',
      'Travel fees typically start at 30+ miles from base location',
    ],
    dataYear: 2024,
  },

  hair_stylist: {
    businessType: 'hair_stylist',
    source: 'industry_benchmark',
    marketLowCents: 15000,
    marketMedianCents: 25000,
    marketHighCents: 50000,
    recommendedTiers: [
      {
        name: 'Bridal Styling',
        description: 'Beautiful bridal hairstyle with finishing touches',
        suggestedPriceCents: 18000,
        priceRangeLowCents: 12500,
        priceRangeHighCents: 25000,
        includedServices: [
          'Bridal hairstyle',
          'Accessory placement',
          'Hair prep products',
          'Touch-up pins',
        ],
      },
      {
        name: 'Full Party Service',
        description: 'Bride and bridal party styling with trial included',
        suggestedPriceCents: 35000,
        priceRangeLowCents: 25000,
        priceRangeHighCents: 50000,
        includedServices: [
          'Bridal trial',
          'Bridal hairstyle',
          '4 bridesmaids',
          '2 mothers',
          'Accessory styling',
          'On-call coverage',
        ],
      },
      {
        name: 'VIP Hair Experience',
        description: 'Premium styling with extensions and multiple looks',
        suggestedPriceCents: 55000,
        priceRangeLowCents: 45000,
        priceRangeHighCents: 75000,
        includedServices: [
          'Consultation and trial',
          'Extensions (if needed)',
          'Multiple looks',
          'Full party service',
          'Premium products',
          'Full day coverage',
        ],
      },
    ],
    insights: [
      'Extensions service adds $100-300 in high-margin revenue',
      'Hair + Makeup bundles increase booking rate significantly',
      'Trials are essential for building trust and upselling',
    ],
    dataYear: 2024,
  },

  event_designer: {
    businessType: 'event_designer',
    source: 'industry_benchmark',
    marketLowCents: 300000,
    marketMedianCents: 750000,
    marketHighCents: 2000000,
    recommendedTiers: [
      {
        name: 'Design Consultation',
        description: 'Expert guidance on cohesive event aesthetic',
        suggestedPriceCents: 350000,
        priceRangeLowCents: 200000,
        priceRangeHighCents: 500000,
        includedServices: [
          'Design consultation',
          'Mood boards',
          'Vendor recommendations',
          'Color palette development',
          'Layout suggestions',
        ],
      },
      {
        name: 'Full Design Package',
        description: 'Complete design concept with vendor coordination',
        suggestedPriceCents: 750000,
        priceRangeLowCents: 500000,
        priceRangeHighCents: 1000000,
        includedServices: [
          'Complete design concept',
          'Detailed floor plans',
          'Vendor sourcing',
          'Rental coordination',
          'Day-of styling',
          'Setup oversight',
        ],
      },
      {
        name: 'Bespoke Experience',
        description: 'Luxury design with custom fabrication and full execution',
        suggestedPriceCents: 1500000,
        priceRangeLowCents: 1000000,
        priceRangeHighCents: 3000000,
        includedServices: [
          'Custom design creation',
          'Fabrication coordination',
          'Full vendor management',
          'Multi-day installation',
          'Complete styling',
          'Guest experience design',
        ],
      },
    ],
    insights: [
      'Markup on rentals (20-40%) is a significant revenue stream',
      'Custom fabrication has highest margins but requires more lead time',
      'Design fees often percentage-based (10-20%) for luxury events',
    ],
    dataYear: 2024,
  },

  venue: {
    businessType: 'venue',
    source: 'industry_benchmark',
    marketLowCents: 500000,
    marketMedianCents: 1500000,
    marketHighCents: 5000000,
    recommendedTiers: [
      {
        name: 'Intimate Gathering',
        description: 'Perfect for smaller celebrations up to 50 guests',
        suggestedPriceCents: 600000,
        priceRangeLowCents: 400000,
        priceRangeHighCents: 900000,
        includedServices: [
          '6-hour rental',
          'Ceremony space',
          'Reception area',
          'Tables and chairs',
          'On-site coordinator',
        ],
      },
      {
        name: 'Grand Celebration',
        description: 'Full venue access for up to 150 guests',
        suggestedPriceCents: 1500000,
        priceRangeLowCents: 1000000,
        priceRangeHighCents: 2500000,
        includedServices: [
          '10-hour rental',
          'Full venue access',
          'Bridal suite',
          'All furniture',
          'Parking coordination',
          'Setup and cleanup',
        ],
      },
      {
        name: 'Exclusive Buyout',
        description: 'Complete property access with premium amenities',
        suggestedPriceCents: 3500000,
        priceRangeLowCents: 2500000,
        priceRangeHighCents: 7500000,
        includedServices: [
          'Full weekend access',
          'Exclusive property use',
          'On-site accommodations',
          'Catering kitchen',
          'Premium amenities',
          'Dedicated staff',
        ],
      },
    ],
    insights: [
      'Off-peak pricing (weekdays, off-season) can drive volume',
      'Preferred vendor lists provide referral revenue',
      'Ceremony fee add-on is common ($500-2000)',
    ],
    dataYear: 2024,
  },

  coach: {
    businessType: 'coach',
    source: 'industry_benchmark',
    marketLowCents: 15000, // Per session
    marketMedianCents: 35000,
    marketHighCents: 75000,
    recommendedTiers: [
      {
        name: 'Single Session',
        description: '60-minute focused coaching session',
        suggestedPriceCents: 20000,
        priceRangeLowCents: 15000,
        priceRangeHighCents: 30000,
        includedServices: [
          '60-minute session',
          'Session recording',
          'Action items summary',
          'Email follow-up',
        ],
      },
      {
        name: 'Growth Package',
        description: '6-week coaching program with weekly sessions',
        suggestedPriceCents: 150000,
        priceRangeLowCents: 100000,
        priceRangeHighCents: 200000,
        includedServices: [
          '6 weekly sessions',
          'Unlimited email support',
          'Workbook materials',
          'Progress tracking',
          'Resource library access',
        ],
      },
      {
        name: 'Transformation Program',
        description: '12-week intensive with additional support',
        suggestedPriceCents: 350000,
        priceRangeLowCents: 250000,
        priceRangeHighCents: 500000,
        includedServices: [
          '12 weekly sessions',
          'Voxer/text support',
          'Custom workbook',
          'Mid-program review',
          'Accountability check-ins',
          '90-day post-program support',
        ],
      },
    ],
    insights: [
      'Package pricing (vs hourly) increases commitment and completion',
      'Group programs can 3-5x revenue per hour',
      'Niche specialization commands premium pricing',
    ],
    dataYear: 2024,
  },

  therapist: {
    businessType: 'therapist',
    source: 'industry_benchmark',
    marketLowCents: 10000, // Per session
    marketMedianCents: 17500,
    marketHighCents: 30000,
    recommendedTiers: [
      {
        name: 'Individual Session',
        description: '50-minute individual therapy session',
        suggestedPriceCents: 15000,
        priceRangeLowCents: 10000,
        priceRangeHighCents: 20000,
        includedServices: ['50-minute session', 'Session notes', 'Homework exercises'],
      },
      {
        name: 'Couples/Family Session',
        description: '75-90 minute couples or family therapy session',
        suggestedPriceCents: 22500,
        priceRangeLowCents: 17500,
        priceRangeHighCents: 30000,
        includedServices: [
          '75-90 minute session',
          'Relationship assessment',
          'Joint homework',
          'Between-session check-ins',
        ],
      },
      {
        name: 'Intensive Program',
        description: 'Half-day intensive therapy for accelerated progress',
        suggestedPriceCents: 75000,
        priceRangeLowCents: 50000,
        priceRangeHighCents: 120000,
        includedServices: [
          '3-4 hour session',
          'Comprehensive assessment',
          'Lunch included',
          'Action plan development',
          'Follow-up session included',
        ],
      },
    ],
    insights: [
      'Intensive formats are growing in popularity and command premiums',
      'Sliding scale policies can be offered without hurting practice revenue',
      'Online sessions can expand geographic reach',
    ],
    dataYear: 2024,
  },

  consultant: {
    businessType: 'consultant',
    source: 'industry_benchmark',
    marketLowCents: 20000, // Per hour
    marketMedianCents: 50000,
    marketHighCents: 150000,
    recommendedTiers: [
      {
        name: 'Strategy Session',
        description: '90-minute focused consulting session',
        suggestedPriceCents: 45000,
        priceRangeLowCents: 30000,
        priceRangeHighCents: 75000,
        includedServices: [
          '90-minute session',
          'Pre-session questionnaire',
          'Action plan document',
          '7-day email follow-up',
        ],
      },
      {
        name: 'Monthly Retainer',
        description: 'Ongoing consulting support and availability',
        suggestedPriceCents: 300000,
        priceRangeLowCents: 200000,
        priceRangeHighCents: 500000,
        includedServices: [
          '4 sessions per month',
          'Unlimited email support',
          'Document review',
          'Priority scheduling',
          'Monthly strategy call',
        ],
      },
      {
        name: 'Project Engagement',
        description: 'Full project consulting from discovery to implementation',
        suggestedPriceCents: 1000000,
        priceRangeLowCents: 500000,
        priceRangeHighCents: 2500000,
        includedServices: [
          'Discovery and assessment',
          'Strategy development',
          'Implementation support',
          'Team training',
          'Documentation',
          '90-day support',
        ],
      },
    ],
    insights: [
      'Value-based pricing often yields 2-3x hourly equivalent',
      'Retainers provide predictable revenue and deeper client relationships',
      'Productized services (fixed scope, fixed price) scale better',
    ],
    dataYear: 2024,
  },

  wellness_practitioner: {
    businessType: 'wellness_practitioner',
    source: 'industry_benchmark',
    marketLowCents: 8000, // Per session
    marketMedianCents: 15000,
    marketHighCents: 30000,
    recommendedTiers: [
      {
        name: 'Single Session',
        description: '60-minute individual wellness session',
        suggestedPriceCents: 12000,
        priceRangeLowCents: 8000,
        priceRangeHighCents: 18000,
        includedServices: ['60-minute session', 'Personalized guidance', 'Home practice tips'],
      },
      {
        name: 'Wellness Journey',
        description: '6-session package with personalized plan',
        suggestedPriceCents: 60000,
        priceRangeLowCents: 40000,
        priceRangeHighCents: 90000,
        includedServices: [
          '6 sessions',
          'Initial assessment',
          'Customized plan',
          'Progress tracking',
          'Resource materials',
        ],
      },
      {
        name: 'Retreat Experience',
        description: 'Half-day or full-day immersive wellness retreat',
        suggestedPriceCents: 30000,
        priceRangeLowCents: 20000,
        priceRangeHighCents: 50000,
        includedServices: [
          'Half-day experience',
          'Multiple modalities',
          'Healthy refreshments',
          'Take-home materials',
          'Follow-up session',
        ],
      },
    ],
    insights: [
      'Package pricing increases client commitment and results',
      'Retreats have high profit potential for one-time effort',
      'Corporate wellness programs can provide stable recurring revenue',
    ],
    dataYear: 2024,
  },

  personal_trainer: {
    businessType: 'personal_trainer',
    source: 'industry_benchmark',
    marketLowCents: 5000, // Per session
    marketMedianCents: 10000,
    marketHighCents: 25000,
    recommendedTiers: [
      {
        name: 'Single Session',
        description: '60-minute personal training session',
        suggestedPriceCents: 8500,
        priceRangeLowCents: 5000,
        priceRangeHighCents: 15000,
        includedServices: ['60-minute session', 'Workout programming', 'Form coaching'],
      },
      {
        name: '8-Week Program',
        description: 'Structured training program with 2x weekly sessions',
        suggestedPriceCents: 120000,
        priceRangeLowCents: 80000,
        priceRangeHighCents: 180000,
        includedServices: [
          '16 training sessions',
          'Initial assessment',
          'Nutrition guidance',
          'Progress tracking',
          'App access',
        ],
      },
      {
        name: 'VIP Transformation',
        description: '12-week comprehensive transformation program',
        suggestedPriceCents: 250000,
        priceRangeLowCents: 180000,
        priceRangeHighCents: 400000,
        includedServices: [
          '36 training sessions',
          'Custom meal plan',
          'Weekly check-ins',
          'Body composition tracking',
          'Supplement guidance',
          'Unlimited support',
        ],
      },
    ],
    insights: [
      'Small group training (2-4 people) can increase hourly revenue 50-100%',
      'Online programming scales infinitely with minimal additional effort',
      'Corporate wellness contracts provide recurring revenue',
    ],
    dataYear: 2024,
  },

  tutor: {
    businessType: 'tutor',
    source: 'industry_benchmark',
    marketLowCents: 4000, // Per hour
    marketMedianCents: 8000,
    marketHighCents: 20000,
    recommendedTiers: [
      {
        name: 'Single Session',
        description: '60-minute tutoring session',
        suggestedPriceCents: 7500,
        priceRangeLowCents: 4000,
        priceRangeHighCents: 12000,
        includedServices: ['60-minute session', 'Homework help', 'Study strategies'],
      },
      {
        name: 'Academic Package',
        description: '10-session package with progress tracking',
        suggestedPriceCents: 65000,
        priceRangeLowCents: 35000,
        priceRangeHighCents: 100000,
        includedServices: [
          '10 sessions',
          'Learning assessment',
          'Progress reports',
          'Parent updates',
          'Study materials',
        ],
      },
      {
        name: 'Test Prep Intensive',
        description: 'Comprehensive SAT/ACT or professional exam preparation',
        suggestedPriceCents: 200000,
        priceRangeLowCents: 120000,
        priceRangeHighCents: 350000,
        includedServices: [
          '20 sessions',
          'Diagnostic assessment',
          'Practice tests',
          'Score guarantee',
          'All materials included',
        ],
      },
    ],
    insights: [
      'Test prep commands highest rates and has defined outcomes',
      'Package pricing improves student commitment and results',
      'Online tutoring expands market beyond local area',
    ],
    dataYear: 2024,
  },

  music_instructor: {
    businessType: 'music_instructor',
    source: 'industry_benchmark',
    marketLowCents: 4000, // Per lesson
    marketMedianCents: 7500,
    marketHighCents: 15000,
    recommendedTiers: [
      {
        name: 'Single Lesson',
        description: '30 or 60-minute private music lesson',
        suggestedPriceCents: 6500,
        priceRangeLowCents: 4000,
        priceRangeHighCents: 10000,
        includedServices: ['Private lesson', 'Practice assignments', 'Technique coaching'],
      },
      {
        name: 'Monthly Package',
        description: '4 lessons per month with additional support',
        suggestedPriceCents: 22000,
        priceRangeLowCents: 14000,
        priceRangeHighCents: 35000,
        includedServices: [
          '4 weekly lessons',
          'Practice guidance',
          'Recital preparation',
          'Progress tracking',
        ],
      },
      {
        name: 'Intensive Program',
        description: 'Semester-long program with recital preparation',
        suggestedPriceCents: 100000,
        priceRangeLowCents: 60000,
        priceRangeHighCents: 150000,
        includedServices: [
          '16+ lessons',
          'Theory instruction',
          'Recital opportunity',
          'Recording session',
          'Repertoire development',
        ],
      },
    ],
    insights: [
      'Group lessons (2-4 students) increase hourly rate while reducing per-student cost',
      'Recital fees can provide additional revenue stream',
      'Summer intensives attract students who want accelerated progress',
    ],
    dataYear: 2024,
  },

  other: {
    businessType: 'other',
    source: 'industry_benchmark',
    marketLowCents: 10000,
    marketMedianCents: 25000,
    marketHighCents: 75000,
    recommendedTiers: [
      {
        name: 'Starter',
        description: 'Entry-level package for clients testing the waters',
        suggestedPriceCents: 15000,
        priceRangeLowCents: 10000,
        priceRangeHighCents: 25000,
        includedServices: [
          'Core service delivery',
          'Basic support',
          'Standard deliverables',
        ],
      },
      {
        name: 'Standard',
        description: 'Most popular option with comprehensive service',
        suggestedPriceCents: 35000,
        priceRangeLowCents: 25000,
        priceRangeHighCents: 50000,
        includedServices: [
          'Full service delivery',
          'Extended support',
          'Premium deliverables',
          'Follow-up included',
        ],
      },
      {
        name: 'Premium',
        description: 'High-touch experience with maximum value',
        suggestedPriceCents: 75000,
        priceRangeLowCents: 50000,
        priceRangeHighCents: 125000,
        includedServices: [
          'VIP service delivery',
          'Priority support',
          'Custom deliverables',
          'Extended engagement',
          'Bonus features',
        ],
      },
    ],
    insights: [
      'Three-tier pricing works for most service businesses',
      'The middle tier typically captures 60-70% of clients',
      'Premium tier sets anchor point and makes standard look reasonable',
    ],
    dataYear: 2024,
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Get industry benchmarks for a business type.
 * Always returns data - uses static fallback if type not found.
 *
 * @param businessType - The type of business
 * @returns Industry benchmarks with pricing recommendations
 *
 * @example
 * ```typescript
 * const benchmarks = await getIndustryBenchmarks('photographer');
 * console.log(benchmarks.recommendedTiers[0].suggestedPriceCents);
 * // 200000 ($2,000)
 * ```
 */
export async function getIndustryBenchmarks(
  businessType: string
): Promise<IndustryBenchmarks> {
  // Validate business type
  const validType = businessType as BusinessType;
  const benchmarks = BENCHMARK_DATA[validType] || BENCHMARK_DATA.other;

  // Future enhancement: Could augment with web search here
  // For now, always return static benchmarks

  return {
    ...benchmarks,
    source: 'industry_benchmark', // Static data source
  };
}

/**
 * Convert benchmarks to PricingBenchmarks schema format
 */
export function toPricingBenchmarks(benchmarks: IndustryBenchmarks): PricingBenchmarks {
  return {
    source: benchmarks.source,
    marketLowCents: benchmarks.marketLowCents,
    marketMedianCents: benchmarks.marketMedianCents,
    marketHighCents: benchmarks.marketHighCents,
    recommendedTiers: benchmarks.recommendedTiers,
    competitorCount: 0, // Static data doesn't have competitor count
    dataFreshness: 'fallback', // Static data is always "fallback"
  };
}

/**
 * Get all supported business types
 */
export function getSupportedBusinessTypes(): BusinessType[] {
  return Object.keys(BENCHMARK_DATA) as BusinessType[];
}
