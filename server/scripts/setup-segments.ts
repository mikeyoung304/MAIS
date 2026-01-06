/**
 * Setup Segments for Demo Tenant
 *
 * Creates 3 customer segments and assigns existing packages to them.
 * Uses business-agnostic categories suitable for the MAIS platform homepage.
 *
 * Run with: npx tsx scripts/setup-segments.ts
 */

import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

const TENANT_SLUG = 'little-bit-farm';

// Business-agnostic segment definitions for multi-sector platform
const SEGMENTS = [
  {
    slug: 'starter',
    name: 'Starter',
    heroTitle: 'Get Started Fast',
    heroSubtitle: 'Essential services for solopreneurs',
    heroImage: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1600&q=80',
    description:
      'Perfect for solo business owners ready to offload admin work. Our Starter packages include scheduling, basic marketing automation, and a professional web presence to help you focus on your craft.',
    metaTitle: 'Starter Packages | Macon AI Solutions',
    metaDescription:
      'Essential business services for solopreneurs. AI-powered scheduling, marketing, and web presence.',
    sortOrder: 0,
  },
  {
    slug: 'growth',
    name: 'Growth',
    heroTitle: 'Scale With Confidence',
    heroSubtitle: 'Full-service support for growing businesses',
    heroImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&q=80',
    description:
      'Ready to scale? Our Growth packages include advanced marketing automation, CRM integration, client onboarding systems, and data-driven insights to help you grow sustainably.',
    metaTitle: 'Growth Packages | Macon AI Solutions',
    metaDescription:
      'Full-service business support for growing companies. Marketing automation, CRM, and data-driven growth.',
    sortOrder: 1,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    heroTitle: 'Your Complete Back Office',
    heroSubtitle: 'Comprehensive solutions for established businesses',
    heroImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80',
    description:
      'Go all out with enterprise-level support. Our comprehensive packages include dedicated account management, custom integrations, multi-location support, and white-glove service.',
    metaTitle: 'Enterprise Solutions | Macon AI Solutions',
    metaDescription:
      'Enterprise business solutions with dedicated support, custom integrations, and white-glove service.',
    sortOrder: 2,
  },
];

// Map existing packages to segments
const PACKAGE_SEGMENT_MAP: Record<string, string> = {
  'garden-gathering': 'growth',
  'farmhouse-reception': 'enterprise',
  'barn-ceremony': 'starter',
};

async function main() {
  console.log('🚀 Setting up segments for Little Bit Farm');
  console.log('='.repeat(60));

  try {
    // Find the tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
    });

    if (!tenant) {
      throw new Error(`Tenant "${TENANT_SLUG}" not found. Run create-real-tenants.ts first.`);
    }

    console.log(`\n✅ Found tenant: ${tenant.name} (${tenant.id})`);

    // Step 1: Create segments
    console.log('\n📝 Creating segments...');

    for (const segmentData of SEGMENTS) {
      const segment = await prisma.segment.upsert({
        where: {
          tenantId_slug: {
            tenantId: tenant.id,
            slug: segmentData.slug,
          },
        },
        update: {
          name: segmentData.name,
          heroTitle: segmentData.heroTitle,
          heroSubtitle: segmentData.heroSubtitle,
          heroImage: segmentData.heroImage,
          description: segmentData.description,
          metaTitle: segmentData.metaTitle,
          metaDescription: segmentData.metaDescription,
          sortOrder: segmentData.sortOrder,
          active: true,
        },
        create: {
          tenantId: tenant.id,
          slug: segmentData.slug,
          name: segmentData.name,
          heroTitle: segmentData.heroTitle,
          heroSubtitle: segmentData.heroSubtitle,
          heroImage: segmentData.heroImage,
          description: segmentData.description,
          metaTitle: segmentData.metaTitle,
          metaDescription: segmentData.metaDescription,
          sortOrder: segmentData.sortOrder,
          active: true,
        },
      });
      console.log(`   ✅ ${segment.name} (${segment.slug})`);
    }

    // Step 2: Fix Barn Ceremony price
    console.log('\n💰 Fixing Barn Ceremony price...');

    const barnPackage = await prisma.package.findFirst({
      where: {
        tenantId: tenant.id,
        slug: 'barn-ceremony',
      },
    });

    if (barnPackage) {
      // Price stored as 150000000 cents = $1,500,000 (bug)
      // Should be 150000 cents = $1,500
      if (barnPackage.basePrice > 10000000) {
        await prisma.package.update({
          where: { id: barnPackage.id },
          data: { basePrice: 150000 }, // $1,500 in cents
        });
        console.log(`   ✅ Fixed: $${barnPackage.basePrice / 100} → $1,500`);
      } else {
        console.log(`   ℹ️  Price already correct: $${barnPackage.basePrice / 100}`);
      }
    } else {
      console.log('   ⚠️  Barn Ceremony package not found');
    }

    // Step 3: Assign packages to segments
    console.log('\n🔗 Assigning packages to segments...');

    const segments = await prisma.segment.findMany({
      where: { tenantId: tenant.id },
    });

    const segmentMap = new Map(segments.map((s) => [s.slug, s.id]));

    for (const [packageSlug, segmentSlug] of Object.entries(PACKAGE_SEGMENT_MAP)) {
      const segmentId = segmentMap.get(segmentSlug);
      if (!segmentId) {
        console.log(`   ⚠️  Segment "${segmentSlug}" not found`);
        continue;
      }

      const pkg = await prisma.package.findFirst({
        where: {
          tenantId: tenant.id,
          slug: packageSlug,
        },
      });

      if (!pkg) {
        console.log(`   ⚠️  Package "${packageSlug}" not found`);
        continue;
      }

      await prisma.package.update({
        where: { id: pkg.id },
        data: { segmentId },
      });
      console.log(`   ✅ ${pkg.name} → ${segmentSlug}`);
    }

    // Step 4: Add stock photos to packages if missing
    console.log('\n📸 Adding stock photos to packages...');

    const packagePhotos: Record<string, string> = {
      'garden-gathering': 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80',
      'farmhouse-reception':
        'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80',
      'barn-ceremony': 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
    };

    for (const [packageSlug, photoUrl] of Object.entries(packagePhotos)) {
      const pkg = await prisma.package.findFirst({
        where: {
          tenantId: tenant.id,
          slug: packageSlug,
        },
      });

      if (!pkg) continue;

      // Check if photos already exist
      const existingPhotos = pkg.photos ? JSON.parse(pkg.photos as string) : [];
      if (existingPhotos.length === 0) {
        const photos = JSON.stringify([
          {
            url: photoUrl,
            filename: `${packageSlug}.jpg`,
            size: 0,
            order: 0,
          },
        ]);

        await prisma.package.update({
          where: { id: pkg.id },
          data: { photos },
        });
        console.log(`   ✅ Added photo to ${pkg.name}`);
      } else {
        console.log(`   ℹ️  ${pkg.name} already has photos`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SETUP COMPLETE');
    console.log('='.repeat(60));

    const finalSegments = await prisma.segment.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        packages: {
          select: { name: true, slug: true },
        },
      },
    });

    console.log('\n📋 Final Configuration:\n');
    for (const segment of finalSegments) {
      console.log(`${segment.name} (${segment.slug})`);
      console.log(`   Hero: ${segment.heroTitle}`);
      console.log(`   Packages: ${segment.packages.map((p) => p.name).join(', ') || 'None'}`);
      console.log('');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
