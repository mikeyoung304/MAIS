import { PrismaClient } from './src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating packages for tenants...\n');

  // Get tenant IDs
  const littleBitFarm = await prisma.tenant.findUnique({
    where: { slug: 'little-bit-farm' },
  });

  const laPetitMariage = await prisma.tenant.findUnique({
    where: { slug: 'la-petit-mariage' },
  });

  if (!littleBitFarm || !laPetitMariage) {
    throw new Error('Tenants not found');
  }

  // === Little Bit Farm Packages (Farm/Rustic Wedding Venue) ===
  console.log('Creating packages for Little Bit Farm...');

  const lbfPackages = await Promise.all([
    prisma.package.create({
      data: {
        tenantId: littleBitFarm.id,
        slug: 'barn-ceremony',
        name: 'Barn Ceremony',
        description: 'Intimate ceremony in our historic barn with string lights and rustic charm',
        basePrice: 150000, // $1,500
        photos: JSON.stringify([
          {
            url: 'https://images.unsplash.com/photo-1519167758481-83f29da8c865',
            filename: 'barn.jpg',
            size: 0,
            order: 0,
          },
        ]),
      },
    }),
    prisma.package.create({
      data: {
        tenantId: littleBitFarm.id,
        slug: 'garden-gathering',
        name: 'Garden Gathering',
        description: 'Outdoor ceremony in our flower garden with seating for up to 50 guests',
        basePrice: 250000, // $2,500
        photos: JSON.stringify([
          {
            url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3',
            filename: 'garden.jpg',
            size: 0,
            order: 0,
          },
        ]),
      },
    }),
    prisma.package.create({
      data: {
        tenantId: littleBitFarm.id,
        slug: 'farmhouse-reception',
        name: 'Farmhouse Reception',
        description:
          'Full day rental with ceremony, cocktail hour, and reception in our restored farmhouse',
        basePrice: 450000, // $4,500
        photos: JSON.stringify([
          {
            url: 'https://images.unsplash.com/photo-1519741497674-611481863552',
            filename: 'farmhouse.jpg',
            size: 0,
            order: 0,
          },
        ]),
      },
    }),
  ]);

  console.log(`✅ Created ${lbfPackages.length} packages for Little Bit Farm\n`);

  // === La Petit Mariage Packages (French-Inspired Elegant Weddings) ===
  console.log('Creating packages for La Petit Mariage...');

  const lpmPackages = await Promise.all([
    prisma.package.create({
      data: {
        tenantId: laPetitMariage.id,
        slug: 'petit-elopement',
        name: 'Petit Elopement',
        description:
          'Intimate French-inspired ceremony with champagne toast and professional photography',
        basePrice: 180000, // $1,800
        photos: JSON.stringify([
          {
            url: 'https://images.unsplash.com/photo-1519741497674-611481863552',
            filename: 'petit.jpg',
            size: 0,
            order: 0,
          },
        ]),
      },
    }),
    prisma.package.create({
      data: {
        tenantId: laPetitMariage.id,
        slug: 'chateau-ceremony',
        name: 'Château Ceremony',
        description:
          'Elegant ceremony in our French château-style venue with reception for 30 guests',
        basePrice: 350000, // $3,500
        photos: JSON.stringify([
          {
            url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc',
            filename: 'chateau.jpg',
            size: 0,
            order: 0,
          },
        ]),
      },
    }),
    prisma.package.create({
      data: {
        tenantId: laPetitMariage.id,
        slug: 'grand-celebration',
        name: 'Grand Celebration',
        description:
          'Luxury all-inclusive wedding with gourmet catering, photography, videography, and floral design',
        basePrice: 650000, // $6,500
        photos: JSON.stringify([
          {
            url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6',
            filename: 'grand.jpg',
            size: 0,
            order: 0,
          },
        ]),
      },
    }),
  ]);

  console.log(`✅ Created ${lpmPackages.length} packages for La Petit Mariage\n`);

  // Create some add-ons for each tenant
  console.log('Creating add-ons...');

  // Little Bit Farm add-ons
  const lbfPhotography = await prisma.addOn.create({
    data: {
      tenantId: littleBitFarm.id,
      slug: 'farm-photography',
      name: 'Farm Photography (4 hrs)',
      description: 'Professional photography capturing your special day',
      price: 80000, // $800
    },
  });

  const lbfCatering = await prisma.addOn.create({
    data: {
      tenantId: littleBitFarm.id,
      slug: 'farm-to-table',
      name: 'Farm-to-Table Catering',
      description: 'Locally sourced seasonal menu for your guests',
      price: 5000, // $50 per person
    },
  });

  // La Petit Mariage add-ons
  const lpmPhotography = await prisma.addOn.create({
    data: {
      tenantId: laPetitMariage.id,
      slug: 'french-photography',
      name: 'French-Style Photography',
      description: 'Artistic photography in the French tradition',
      price: 120000, // $1,200
    },
  });

  const lpmFlorist = await prisma.addOn.create({
    data: {
      tenantId: laPetitMariage.id,
      slug: 'french-florals',
      name: 'French Floral Design',
      description: 'Elegant floral arrangements with imported French blooms',
      price: 75000, // $750
    },
  });

  // Link add-ons to packages
  await Promise.all([
    // Little Bit Farm
    prisma.packageAddOn.create({
      data: { packageId: lbfPackages[0].id, addOnId: lbfPhotography.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lbfPackages[1].id, addOnId: lbfPhotography.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lbfPackages[1].id, addOnId: lbfCatering.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lbfPackages[2].id, addOnId: lbfPhotography.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lbfPackages[2].id, addOnId: lbfCatering.id },
    }),

    // La Petit Mariage
    prisma.packageAddOn.create({
      data: { packageId: lpmPackages[0].id, addOnId: lpmPhotography.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lpmPackages[1].id, addOnId: lpmPhotography.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lpmPackages[1].id, addOnId: lpmFlorist.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lpmPackages[2].id, addOnId: lpmPhotography.id },
    }),
    prisma.packageAddOn.create({
      data: { packageId: lpmPackages[2].id, addOnId: lpmFlorist.id },
    }),
  ]);

  console.log('✅ Add-ons created and linked to packages\n');
  console.log('✅ All packages created successfully!');
}

main()
  .catch((e) => {
    console.error('Error creating packages:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
