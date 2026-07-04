const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.club.findMany()
  .then(console.log)
  .finally(() => prisma.$disconnect());
