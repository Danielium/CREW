const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.event.deleteMany({ where: { clubId: null } })
  .then(console.log)
  .finally(() => prisma.$disconnect());
