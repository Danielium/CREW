import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    let { telegramUsername } = await req.json();
    if (telegramUsername) {
      telegramUsername = telegramUsername.toLowerCase();
      if (!telegramUsername.startsWith('@')) {
        telegramUsername = '@' + telegramUsername;
      }
    }

    if (!telegramUsername) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramUsername }
    });

    if (user) {
      return NextResponse.json({ exists: true });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error("Check username error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
