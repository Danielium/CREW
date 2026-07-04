const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.event.findMany({ select: { id: true, title: true, routeData: true } })
  .then(console.log)
  .finally(() => prisma.$disconnect());
