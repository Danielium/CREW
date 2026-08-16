import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { claimReward } from "@/lib/challenges";

export async function POST(request: Request, context: any) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any).id as string;

    const params = await context.params;
    await claimReward(userId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const known: Record<string, { status: number; error: string }> = {
      NOT_COMPLETED: { status: 409, error: "Цель ещё не выполнена" },
      ALREADY_CLAIMED: { status: 409, error: "Награда уже отправлена в Telegram" },
      PROMO_EXHAUSTED: {
        status: 409,
        error: "Промокоды закончились. Напиши @Danielium с сообщением «Промокод Дринкит» — код пришлют вручную.",
      },
      TELEGRAM_FAILED: {
        status: 409,
        error: "Не удалось отправить код в Telegram. Открой бота, нажми «Старт» и попробуй ещё раз.",
      },
    };
    const hit = known[error?.message];
    if (hit) return NextResponse.json({ error: hit.error }, { status: hit.status });

    console.error("POST /api/challenges/[id]/claim error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
