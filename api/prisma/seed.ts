import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const categoryNames = [
  'Hiking Trail',
  'Viewpoint',
  'Plant Sighting',
  'Historic Site',
];

// Coordinates are approximate. Verify them in QGIS or Google Earth.
const spots = [
  { name: 'Mount Longonot Crater Rim', category: 'Hiking Trail', latitude: -0.9167, longitude: 36.4500, description: 'Full circuit around the crater rim.' },
  { name: "Hell's Gate Gorge", category: 'Hiking Trail', latitude: -0.9167, longitude: 36.3167, description: 'Walk through the gorge between red cliffs.' },
  { name: 'Ngong Hills Ridge Walk', category: 'Hiking Trail', latitude: -1.4500, longitude: 36.6500, description: 'Ridge walk over several peaks.' },
  { name: 'Karura Forest Loop', category: 'Hiking Trail', latitude: -1.2400, longitude: 36.8300, description: 'Forest trails inside Nairobi.' },
  { name: 'Ol Donyo Sabuk Summit', category: 'Hiking Trail', latitude: -1.1333, longitude: 37.2500, description: 'Summit hike with plains views.' },
  { name: 'Great Rift Valley Viewpoint, Limuru', category: 'Viewpoint', latitude: -1.0700, longitude: 36.6400, description: 'Roadside view over the Rift Valley floor.' },
  { name: 'Baboon Cliff, Lake Nakuru', category: 'Viewpoint', latitude: -0.3667, longitude: 36.0833, description: 'Cliff overlooking Lake Nakuru.' },
  { name: 'Fourteen Falls Lookout', category: 'Viewpoint', latitude: -1.0400, longitude: 37.2800, description: 'Wide waterfall on the Athi River.' },
  { name: 'Impala Observation Point, Nairobi National Park', category: 'Viewpoint', latitude: -1.3600, longitude: 36.8200, description: 'Open view of the park with the city skyline behind.' },
  { name: 'Nairobi Arboretum', category: 'Plant Sighting', latitude: -1.2858, longitude: 36.8049, description: 'Collection of indigenous and exotic trees.' },
  { name: 'Ngong Road Forest Sanctuary', category: 'Plant Sighting', latitude: -1.3000, longitude: 36.7800, description: 'Urban forest remnant.' },
  { name: 'Kakamega Forest', category: 'Plant Sighting', latitude: 0.2833, longitude: 34.8667, description: 'Rainforest with many rare plant species.' },
  { name: 'Brackenhurst Botanic Gardens, Limuru', category: 'Plant Sighting', latitude: -1.1050, longitude: 36.6500, description: 'Landscaped botanical gardens.' },
  { name: 'Fort Jesus, Mombasa', category: 'Historic Site', latitude: -4.0627, longitude: 39.6792, description: '16th-century Portuguese fort.' },
  { name: 'Gede Ruins', category: 'Historic Site', latitude: -3.3098, longitude: 40.0156, description: 'Ruins of a medieval Swahili town.' },
  { name: 'Karen Blixen Museum', category: 'Historic Site', latitude: -1.3524, longitude: 36.7142, description: 'Colonial-era farmhouse museum.' },
];

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error('SEED_PASSWORD is not set');
  }
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  // 1. Clear children first so re-running does not duplicate data
  await prisma.visit.deleteMany();
  await prisma.spot.deleteMany();

  // 2. Parents: upsert so re-running is safe
  const admin = await prisma.user.upsert({
    where: { email: 'admin@spotlogger.test' },
    update: {},
    create: { email: 'admin@spotlogger.test', name: 'Admin', password: passwordHash, role: Role.ADMIN },
  });
  const explorer = await prisma.user.upsert({
    where: { email: 'explorer@spotlogger.test' },
    update: {},
    create: { email: 'explorer@spotlogger.test', name: 'Explorer', password: passwordHash, role: Role.EXPLORER },
  });

  const categoryIds = new Map<string, number>();
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryIds.set(name, category.id);
  }

  // 3. Children: use the ids returned above
  const createdSpots = [];
  for (const s of spots) {
    const spot = await prisma.spot.create({
      data: {
        name: s.name,
        description: s.description,
        latitude: s.latitude,
        longitude: s.longitude,
        categoryId: categoryIds.get(s.category)!,
        createdById: admin.id,
      },
    });
    createdSpots.push(spot);
  }

  await prisma.visit.createMany({
    data: [
      { spotId: createdSpots[0].id, userId: explorer.id, rating: 5, note: 'Windy but worth it.' },
      { spotId: createdSpots[3].id, userId: explorer.id, rating: 4, note: 'Great for a morning walk.' },
      { spotId: createdSpots[13].id, userId: admin.id, rating: 5 },
    ],
  });

  console.log(`Seeded ${categoryNames.length} categories, ${createdSpots.length} spots, 2 users, 3 visits.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());