import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if it's an edited message with live location
    if (body.edited_message && body.edited_message.location && body.edited_message.location.live_period) {
      const telegramId = body.edited_message.from.id;
      const { latitude, longitude } = body.edited_message.location;

      // Find user by Telegram ID
      const account = await prisma.account.findFirst({
        where: { provider: 'telegram', providerAccountId: String(telegramId) }
      });

      if (account) {
        // Find the active run for this user
        const activeRun = await prisma.run.findFirst({
          where: { userId: account.userId, status: "IN_PROGRESS" },
          orderBy: { startTime: 'desc' }
        });

        if (activeRun) {
          // Append coordinates to routeData
          let currentRoute = [];
          if (activeRun.routeData) {
            try {
              currentRoute = JSON.parse(activeRun.routeData);
            } catch (e) {}
          }
          
          currentRoute.push({ lat: latitude, lng: longitude, timestamp: Date.now() });

          await prisma.run.update({
            where: { id: activeRun.id },
            data: { routeData: JSON.stringify(currentRoute) }
          });
        }
      }
    }

    // Always return 200 OK so Telegram doesn't retry endlessly
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}
