import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();

    // Handle /start command
    if (body.message && typeof body.message.text === 'string' && body.message.text.startsWith('/start')) {
      const chatId = body.message.chat.id;
      const telegramId = body.message.from.id;
      const firstName = body.message.from?.first_name || "Бегун";
      let username = body.message.from?.username;
      
      console.log(`Received /start from ${firstName} (chatId: ${chatId})`);
      
      // Auto-link account if username exists
      if (username) {
        username = '@' + username.toLowerCase();
        const user = await prisma.user.findUnique({ where: { telegramUsername: username } });
        if (user) {
          const accountExists = await prisma.account.findFirst({
            where: { provider: 'telegram', providerAccountId: String(telegramId) }
          });
          if (!accountExists) {
            await prisma.account.create({
              data: {
                userId: user.id,
                type: "oauth",
                provider: "telegram",
                providerAccountId: String(telegramId),
              }
            });
            console.log(`Linked Telegram ID ${telegramId} to user ${user.id} via /start`);
          }
        }
      }
      
      const welcomeText = `Привет, ${firstName}! 👋\n\nДобро пожаловать в CREW — приложение для бегунов и беговых клубов!\nЗдесь ты можешь находить компанию для пробежек, вступать в клубы и соревноваться с другими.\n\nЖми кнопку ниже, чтобы открыть приложение!`;
      
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error("TELEGRAM_BOT_TOKEN is not defined in environment variables!");
      } else {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
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
          
          if (!tgRes.ok) {
            console.error("Failed to send welcome message:", await tgRes.text());
          } else {
            console.log("Welcome message sent successfully!");
          }
        } catch (err) {
          console.error("Error sending welcome message:", err);
        }
      }
    }

    // Handle inline button callbacks
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackData = callbackQuery.data; // e.g. "accept_req_123"
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;
      const telegramId = callbackQuery.from.id;

      if (callbackData && (callbackData.startsWith('accept_req_') || callbackData.startsWith('reject_req_'))) {
        const isAccept = callbackData.startsWith('accept_req_');
        const requestId = callbackData.split('_')[2];

        try {
          // Find the creator by their Telegram ID
          const account = await prisma.account.findFirst({
            where: { provider: 'telegram', providerAccountId: String(telegramId) }
          });

          if (account) {
            // Check if the request exists and belongs to a proposal created by this user
            const request = await prisma.runJoinRequest.findUnique({
              where: { id: requestId },
              include: { proposal: true, user: true }
            });

            if (request && request.proposal.creatorId === account.userId) {
              const newStatus = isAccept ? "ACCEPTED" : "REJECTED";
              
              await prisma.runJoinRequest.update({
                where: { id: requestId },
                data: { status: newStatus }
              });

              // Answer callback query so the button stops loading
              await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQuery.id })
              });

              // Edit the original message to remove buttons and show the result
              const runDate = new Date(request.proposal.startTime).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' (мск)';
              
              let newText = `🏃 <b>Заявка на пробежку (${runDate})</b>\n\n`;
              if (isAccept) {
                newText += `✅ Вы приняли заявку от <b>${request.user.name || "Аноним"}</b>.`;
                if (request.user.telegramUsername) {
                  newText += ` Вы можете связаться с ним: ${request.user.telegramUsername}`;
                }
              } else {
                newText += `❌ Вы отклонили заявку от <b>${request.user.name || "Аноним"}</b>.`;
              }

              await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  text: newText,
                  parse_mode: 'HTML',
                  reply_markup: { inline_keyboard: [] }
                })
              });

              // Notify the requester if they have TG linked
              const { sendTelegramMessageToUser } = await import('@/lib/telegram');
              const creator = await prisma.user.findUnique({ where: { id: request.proposal.creatorId } });
              
              if (isAccept) {
                let notifyText = `🏃 <b>Заявка одобрена!</b>\n\nСоздатель пробежки <b>${creator?.name || "Аноним"}</b> принял вашу заявку на ${runDate}! Ждем на старте!`;
                if (creator?.telegramUsername) {
                  notifyText += ` Связаться с организатором: ${creator.telegramUsername}`;
                }
                await sendTelegramMessageToUser(request.userId, notifyText);
              } else {
                const notifyText = `🏃 <b>Заявка отклонена</b>\n\nК сожалению, вашу заявку на пробежку (${runDate}) отклонили.`;
                await sendTelegramMessageToUser(request.userId, notifyText);
              }

            }
          }
        } catch (err) {
          console.error("Callback processing error:", err);
        }
      }

      return NextResponse.json({ ok: true });
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
