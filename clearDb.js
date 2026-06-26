const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.runJoinRequest.deleteMany();
  await prisma.runProposal.deleteMany();
  await prisma.event.deleteMany();
  await prisma.run.deleteMany();
  await prisma.clubMember.deleteMany();
  await prisma.club.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  console.log('DB Cleared');
}
main();
