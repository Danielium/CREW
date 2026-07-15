import { prisma } from './src/lib/prisma';
prisma.user.findMany({ select: { id: true, name: true, telegramUsername: true } }).then(a => console.log(a)).catch(console.error);
