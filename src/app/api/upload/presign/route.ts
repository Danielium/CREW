import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.YANDEX_S3_REGION || "ru-central1",
  endpoint: "https://storage.yandexcloud.net",
  credentials: {
    accessKeyId: process.env.YANDEX_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.YANDEX_S3_SECRET_ACCESS_KEY!,
  },
});

const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

// Videos are too large to pass through a serverless function (Vercel caps request
// bodies at ~4.5MB), so the client uploads straight to S3 with a short-lived
// presigned PUT and only tells us the resulting URL afterwards.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contentType, size } = await req.json();

    if (!ALLOWED_VIDEO.includes(contentType)) {
      return NextResponse.json({ error: "Поддерживаются только видео MP4, WEBM и MOV" }, { status: 400 });
    }

    if (typeof size !== 'number' || size <= 0 || size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Видео не должно превышать 100 МБ" }, { status: 400 });
    }

    const extMap: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };
    const filename = `${uuidv4()}.${extMap[contentType]}`;

    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: process.env.YANDEX_S3_BUCKET_NAME,
        Key: filename,
        ContentType: contentType,
      }),
      { expiresIn: 600 }
    );

    return NextResponse.json({
      uploadUrl,
      url: `https://storage.yandexcloud.net/${process.env.YANDEX_S3_BUCKET_NAME}/${filename}`,
    });
  } catch (error) {
    console.error("Presign Error:", error);
    return NextResponse.json({ error: "Не удалось подготовить загрузку" }, { status: 500 });
  }
}
