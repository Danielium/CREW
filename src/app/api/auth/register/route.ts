import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { telegramUsername, password, name, avatarStyle } = body;

    if (!telegramUsername || !password || !name) {
      return NextResponse.json(
        { error: "Username, password, and name are required" },
        { status: 400 }
      );
    }

    if (telegramUsername) {
      telegramUsername = telegramUsername.toLowerCase();
      if (!telegramUsername.startsWith('@')) {
        telegramUsername = '@' + telegramUsername;
      }
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramUsername },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким юзернеймом уже существует" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        telegramUsername,
        name,
        password: hashedPassword,
        image: avatarStyle || null,
      },
    });

    return NextResponse.json(
      { success: true, user: { id: user.id, telegramUsername: user.telegramUsername, name: user.name } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to register user" },
      { status: 500 }
    );
  }
}
