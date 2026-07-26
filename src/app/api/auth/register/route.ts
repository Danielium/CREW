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
    let user = await prisma.user.create({
      data: {
        telegramUsername,
        name,
        password: hashedPassword,
        image: avatarStyle && !avatarStyle.startsWith('data:image/') ? avatarStyle : null,
        telegramPhotoUrl: avatarStyle && !avatarStyle.startsWith('data:image/') ? avatarStyle : null,
      },
    });

    if (avatarStyle && avatarStyle.startsWith('data:image/')) {
      try {
        const base64Data = avatarStyle.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = avatarStyle.substring("data:image/".length, avatarStyle.indexOf(";base64"));
        
        const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
        const s3Client = new S3Client({
          region: process.env.YANDEX_S3_REGION || "ru-central1",
          endpoint: "https://storage.yandexcloud.net",
          credentials: {
            accessKeyId: process.env.YANDEX_S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.YANDEX_S3_SECRET_ACCESS_KEY!,
          },
        });
        
        const filename = `avatars/custom_${user.id}.${ext}`;
        
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.YANDEX_S3_BUCKET_NAME,
          Key: filename,
          Body: buffer,
          ContentType: `image/${ext}`,
        }));
        
        const finalImageUrl = `https://storage.yandexcloud.net/${process.env.YANDEX_S3_BUCKET_NAME}/${filename}?v=${Date.now()}`;
        
        user = await prisma.user.update({
          where: { id: user.id },
          data: { image: finalImageUrl }
        });
      } catch (e) {
        console.error("Failed to upload custom avatar to S3 during registration", e);
      }
    }

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
