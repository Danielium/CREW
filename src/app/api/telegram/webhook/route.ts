import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Handle /start command
    if (body.message && body.message.text === '/start') {
      const chatId = body.message.chat.id;
      const firstName = body.message.from.first_name || "Бегун";
      
      const welcomeText = `Привет, ${firstName}! 👋\n\nДобро пожаловать в CREW — приложение для бегунов и беговых клубов!\nЗдесь ты можешь находить компанию для пробежек, вступать в клубы и соревноваться с другими.\n\nЖми кнопку ниже, чтобы открыть приложение!`;
      
      if (process.env.TELEGRAM_BOT_TOKEN) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            reply_markup: {
              inline_keyboard: [
                [{ text: "🏃 Открыть CREW", web_app: { url: "https://crew-gamma.vercel.app" } }]
              ]
            }
          })
        });
      }
    }

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
