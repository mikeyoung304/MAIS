/**
 * Stock photos for segment cards when no custom hero image is set.
 * Using Unsplash for high-quality, royalty-free images.
 */
export const SEGMENT_STOCK_PHOTOS: Record<string, string> = {
  // Corporate & Business
  corporate: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
  business: 'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800&q=80',
  consulting: 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=800&q=80',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',

  // Wellness & Health
  wellness: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
  yoga: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80',
  meditation: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80',
  health: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80',
  spa: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  therapy: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80',
  massage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  retreat: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80',

  // Photography
  photography: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80',
  photo: 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800&q=80',
  portrait: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80',
  wedding: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80',
  elopement: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  event: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
  family: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&q=80',
  couple: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80',

  // Creative & Design
  creative: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&q=80',
  design: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&q=80',
  art: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&q=80',

  // Education & Coaching
  education: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80',
  coaching: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80',
  tutoring: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80',
  training: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80',

  // Weekend / Getaway / Experience
  weekend: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80',
  getaway: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
  farm: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80',
  horse: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80',

  // Default fallback
  default: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
};

/**
 * Get a stock photo URL for a segment based on name, slug, or description.
 * Tries to match keywords to find the most appropriate image.
 */
export function getSegmentStockPhoto(segment: {
  name: string;
  slug: string;
  description?: string | null;
}): string {
  const searchText = `${segment.name} ${segment.slug} ${segment.description || ''}`.toLowerCase();

  // Check each category for keyword matches
  for (const [keyword, url] of Object.entries(SEGMENT_STOCK_PHOTOS)) {
    if (keyword !== 'default' && searchText.includes(keyword)) {
      return url;
    }
  }

  return SEGMENT_STOCK_PHOTOS.default;
}
