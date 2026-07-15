import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { 
      OR: [
        { telegramUsername: "nenastyaa" },
        { telegramUsername: "@nenastyaa" }
      ]
    },
    include: {
      clubMembers: { include: { club: true } },
      eventsCreated: true,
      eventsAttended: true,
      runProposals: true,
      joinRequests: { include: { proposal: true } }
    }
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log(JSON.stringify(user, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
