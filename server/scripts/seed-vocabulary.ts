/**
 * Seed Canonical Vocabulary Script
 *
 * Seeds the VocabularyEmbedding table with canonical phrases for each BlockType.
 * These phrases are used as the foundation for semantic section resolution.
 *
 * Run with: npx tsx scripts/seed-vocabulary.ts
 *
 * @see server/src/services/vocabulary-embedding.service.ts
 * @see docs/plans/2026-01-30-feat-semantic-storefront-architecture-plan.md
 */

import 'dotenv/config';
import { PrismaClient, BlockType } from '../src/generated/prisma';
import {
  VocabularyEmbeddingService,
  VocabularyEmbeddingInput,
} from '../src/services/vocabulary-embedding.service';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical vocabulary phrases organized by BlockType.
 *
 * Design principles:
 * - Include common user phrasings (informal, natural language)
 * - Include technical terms (for power users)
 * - Cover synonyms and related concepts
 * - Focus on phrases users actually say, not just labels
 */
const CANONICAL_VOCABULARY: VocabularyEmbeddingInput[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // HERO - Main banner/header section
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'hero', blockType: 'HERO', isCanonical: true },
  { phrase: 'hero section', blockType: 'HERO', isCanonical: true },
  { phrase: 'banner', blockType: 'HERO', isCanonical: true },
  { phrase: 'main banner', blockType: 'HERO', isCanonical: true },
  { phrase: 'headline', blockType: 'HERO', isCanonical: true },
  { phrase: 'main headline', blockType: 'HERO', isCanonical: true },
  { phrase: 'main header', blockType: 'HERO', isCanonical: true },
  { phrase: 'top of the page', blockType: 'HERO', isCanonical: true },
  { phrase: 'header section', blockType: 'HERO', isCanonical: true },
  { phrase: 'welcome message', blockType: 'HERO', isCanonical: true },
  { phrase: 'first impression', blockType: 'HERO', isCanonical: true },
  { phrase: 'landing section', blockType: 'HERO', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // ABOUT - Personal/business introduction
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'about', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'about me', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'about us', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'about section', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'bio', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'my bio', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'biography', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'my story', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'our story', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'who i am', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'who we are', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'background', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'introduction', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'meet the team', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'life story', blockType: 'ABOUT', isCanonical: true },
  { phrase: 'personal info', blockType: 'ABOUT', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // SERVICES - What the business offers
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'services', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'my services', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'our services', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'services section', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'what i offer', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'what we offer', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'offerings', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'what i do', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'what we do', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'service list', blockType: 'SERVICES', isCanonical: true },
  { phrase: 'types of work', blockType: 'SERVICES', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // PRICING - Pricing tiers and packages
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'pricing', blockType: 'PRICING', isCanonical: true },
  { phrase: 'pricing section', blockType: 'PRICING', isCanonical: true },
  { phrase: 'prices', blockType: 'PRICING', isCanonical: true },
  { phrase: 'packages', blockType: 'PRICING', isCanonical: true },
  { phrase: 'pricing packages', blockType: 'PRICING', isCanonical: true },
  { phrase: 'rates', blockType: 'PRICING', isCanonical: true },
  { phrase: 'my rates', blockType: 'PRICING', isCanonical: true },
  { phrase: 'investment', blockType: 'PRICING', isCanonical: true },
  { phrase: 'tiers', blockType: 'PRICING', isCanonical: true },
  { phrase: 'pricing tiers', blockType: 'PRICING', isCanonical: true },
  { phrase: 'cost', blockType: 'PRICING', isCanonical: true },
  { phrase: 'how much', blockType: 'PRICING', isCanonical: true },
  { phrase: 'fee structure', blockType: 'PRICING', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // TESTIMONIALS - Client reviews and social proof
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'testimonials', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'testimonials section', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'reviews', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'client reviews', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'customer reviews', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'client feedback', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'what clients say', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'what customers say', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'social proof', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'success stories', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'happy clients', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'feedback', blockType: 'TESTIMONIALS', isCanonical: true },
  { phrase: 'praise', blockType: 'TESTIMONIALS', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // FAQ - Frequently asked questions
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'faq', blockType: 'FAQ', isCanonical: true },
  { phrase: 'faqs', blockType: 'FAQ', isCanonical: true },
  { phrase: 'faq section', blockType: 'FAQ', isCanonical: true },
  { phrase: 'frequently asked questions', blockType: 'FAQ', isCanonical: true },
  { phrase: 'questions', blockType: 'FAQ', isCanonical: true },
  { phrase: 'common questions', blockType: 'FAQ', isCanonical: true },
  { phrase: 'answers', blockType: 'FAQ', isCanonical: true },
  { phrase: 'q and a', blockType: 'FAQ', isCanonical: true },
  { phrase: 'qa section', blockType: 'FAQ', isCanonical: true },
  { phrase: 'help section', blockType: 'FAQ', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTACT - Contact information and form
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'contact', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'contact section', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'contact info', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'contact information', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'get in touch', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'reach out', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'reach me', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'contact me', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'contact us', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'email address', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'phone number', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'location', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'address', blockType: 'CONTACT', isCanonical: true },
  { phrase: 'contact form', blockType: 'CONTACT', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // CTA - Call to action sections
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'cta', blockType: 'CTA', isCanonical: true },
  { phrase: 'call to action', blockType: 'CTA', isCanonical: true },
  { phrase: 'cta section', blockType: 'CTA', isCanonical: true },
  { phrase: 'book now', blockType: 'CTA', isCanonical: true },
  { phrase: 'book button', blockType: 'CTA', isCanonical: true },
  { phrase: 'get started', blockType: 'CTA', isCanonical: true },
  { phrase: 'sign up', blockType: 'CTA', isCanonical: true },
  { phrase: 'take action', blockType: 'CTA', isCanonical: true },
  { phrase: 'schedule now', blockType: 'CTA', isCanonical: true },
  { phrase: 'lets work together', blockType: 'CTA', isCanonical: true },
  { phrase: 'ready to start', blockType: 'CTA', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // GALLERY - Portfolio and image galleries
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'gallery', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'gallery section', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'portfolio', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'my portfolio', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'my work', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'work samples', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'photos', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'images', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'pictures', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'showcase', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'examples', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'past work', blockType: 'GALLERY', isCanonical: true },
  { phrase: 'recent work', blockType: 'GALLERY', isCanonical: true },

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOM - Catch-all for custom sections
  // ─────────────────────────────────────────────────────────────────────────────
  { phrase: 'custom', blockType: 'CUSTOM', isCanonical: true },
  { phrase: 'custom section', blockType: 'CUSTOM', isCanonical: true },
  { phrase: 'other section', blockType: 'CUSTOM', isCanonical: true },
  { phrase: 'new section', blockType: 'CUSTOM', isCanonical: true },
  { phrase: 'additional section', blockType: 'CUSTOM', isCanonical: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Script
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Vocabulary Seeding Script');
  console.log('============================\n');

  // Check for required environment variables
  if (!process.env.GOOGLE_VERTEX_PROJECT) {
    console.error('❌ Error: GOOGLE_VERTEX_PROJECT environment variable is required');
    console.log('   Run: export GOOGLE_VERTEX_PROJECT=your-project-id');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const service = new VocabularyEmbeddingService(prisma);

  try {
    // Get current stats
    const beforeStats = await service.getVocabularyStats();
    console.log(`📊 Current vocabulary stats:`);
    console.log(`   Total phrases: ${beforeStats.totalPhrases}`);
    console.log(`   Canonical phrases: ${beforeStats.canonicalPhrases}\n`);

    // Seed vocabulary
    console.log(`🚀 Seeding ${CANONICAL_VOCABULARY.length} canonical phrases...\n`);

    const added = await service.seedVocabulary(CANONICAL_VOCABULARY);

    // Get updated stats
    const afterStats = await service.getVocabularyStats();
    console.log(`\n📊 Updated vocabulary stats:`);
    console.log(`   Total phrases: ${afterStats.totalPhrases}`);
    console.log(`   Canonical phrases: ${afterStats.canonicalPhrases}`);
    console.log(`   New phrases added: ${added}`);

    console.log(`\n📈 Phrases by BlockType:`);
    for (const [blockType, count] of Object.entries(afterStats.phrasesByBlockType).sort()) {
      console.log(`   ${blockType}: ${count}`);
    }

    console.log('\n✅ Vocabulary seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
