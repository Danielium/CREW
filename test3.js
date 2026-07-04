const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.event.findUnique({ where: { id: 'cmr6o13ey000114i9x2dj3h12' }, include: { club: true } })
  .then(console.log)
  .finally(() => prisma.$disconnect());
