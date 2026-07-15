import { prisma } from './src/lib/prisma';
prisma.account.findMany({ where: { provider: 'telegram' } }).then(a => console.log(a)).catch(console.error);
