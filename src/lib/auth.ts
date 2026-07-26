import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Verify Telegram WebApp initData HMAC signature
function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    return expectedHash === hash;
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  // No adapter — pure JWT mode, no DB sessions needed
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        telegramUsername: { label: "Telegram Username", type: "text" },
        password: { label: "Пароль", type: "password" },
        isTgWebApp: { label: "isTgWebApp", type: "text" },
        initData: { label: "InitData", type: "text" },
        name: { label: "Name", type: "text" },
        image: { label: "Image", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.telegramUsername) {
          return null;
        }

        try {
          let tUsername = credentials.telegramUsername.toLowerCase();
          if (!tUsername.startsWith('@')) {
            tUsername = '@' + tUsername;
          }

          if (credentials.isTgWebApp === "true") {
            // Verify Telegram initData signature
            const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
            const initData = credentials.initData || "";
            
            // In development without a real bot token, skip verification
            if (botToken && initData && !verifyTelegramInitData(initData, botToken)) {
              console.warn("Invalid Telegram initData signature for:", tUsername);
              return null;
            }

            let user = await prisma.user.findUnique({
              where: { telegramUsername: tUsername }
            });

            if (!user) {
              const dummyPassword = await bcrypt.hash(crypto.randomBytes(5).toString('hex'), 10);
              const incomingImage = credentials.image ? credentials.image.replace('t.me', 'telegram.me') : null;
              
              user = await prisma.user.create({
                data: {
                  telegramUsername: tUsername,
                  name: credentials.name || tUsername,
                  image: null, 
                  telegramPhotoUrl: incomingImage,
                  password: dummyPassword,
                }
              });

              if (incomingImage) {
                try {
                  const res = await fetch(incomingImage);
                  if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
                    const s3Client = new S3Client({
                      region: process.env.YANDEX_S3_REGION || "ru-central1",
                      endpoint: "https://storage.yandexcloud.net",
                      credentials: {
                        accessKeyId: process.env.YANDEX_S3_ACCESS_KEY_ID!,
                        secretAccessKey: process.env.YANDEX_S3_SECRET_ACCESS_KEY!,
                      },
                    });
                    
                    const filename = `avatars/${user.id}.jpg`;
                    
                    await s3Client.send(new PutObjectCommand({
                      Bucket: process.env.YANDEX_S3_BUCKET_NAME,
                      Key: filename,
                      Body: buffer,
                      ContentType: "image/jpeg",
                    }));
                    
                    const finalImageUrl = `https://storage.yandexcloud.net/${process.env.YANDEX_S3_BUCKET_NAME}/${filename}?v=${Date.now()}`;
                    
                    user = await prisma.user.update({
                      where: { id: user.id },
                      data: { image: finalImageUrl }
                    });
                  }
                } catch (e) {
                  console.error("Failed to sync avatar to S3:", e);
                }
              }
            } else {
              // Update name and image if provided by TG this time
              const updateData: any = {};
              if (credentials.name && credentials.name !== user.name) updateData.name = credentials.name;
              
              const incomingImage = credentials.image ? credentials.image.replace('t.me', 'telegram.me') : null;
              
              // Only download and re-upload if the Telegram temporary URL has changed
              if (incomingImage && incomingImage !== user.telegramPhotoUrl) {
                try {
                  const res = await fetch(incomingImage);
                  if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
                    const s3Client = new S3Client({
                      region: process.env.YANDEX_S3_REGION || "ru-central1",
                      endpoint: "https://storage.yandexcloud.net",
                      credentials: {
                        accessKeyId: process.env.YANDEX_S3_ACCESS_KEY_ID!,
                        secretAccessKey: process.env.YANDEX_S3_SECRET_ACCESS_KEY!,
                      },
                    });
                    
                    const filename = `avatars/${user.id}.jpg`;
                    
                    await s3Client.send(new PutObjectCommand({
                      Bucket: process.env.YANDEX_S3_BUCKET_NAME,
                      Key: filename,
                      Body: buffer,
                      ContentType: "image/jpeg",
                    }));
                    
                    updateData.telegramPhotoUrl = incomingImage;
                    updateData.image = `https://storage.yandexcloud.net/${process.env.YANDEX_S3_BUCKET_NAME}/${filename}?v=${Date.now()}`;
                  }
                } catch (e) {
                  console.error("Failed to sync avatar to S3:", e);
                }
              }
              
              if (Object.keys(updateData).length > 0) {
                user = await prisma.user.update({
                  where: { id: user.id },
                  data: updateData
                });
              }
            }

            // Extract numeric Telegram ID from initData and save to Account
            try {
              const params = new URLSearchParams(initData);
              const userParam = params.get("user");
              if (userParam) {
                const tgUser = JSON.parse(userParam);
                if (tgUser && tgUser.id) {
                  // Upsert Account record
                  const accountExists = await prisma.account.findFirst({
                    where: { provider: 'telegram', providerAccountId: String(tgUser.id) }
                  });
                  if (!accountExists) {
                    await prisma.account.create({
                      data: {
                        userId: user.id,
                        type: "oauth",
                        provider: "telegram",
                        providerAccountId: String(tgUser.id),
                      }
                    });
                  }
                }
              }
            } catch (e) {
              console.error("Failed to parse initData user:", e);
            }

            return {
              id: user.id,
              email: user.telegramUsername,
              name: user.name,
            };
          }

          // Fallback to standard password check
          if (!credentials.password) return null;

          const user = await prisma.user.findUnique({
            where: { telegramUsername: tUsername }
          });

          if (!user || !user.password) {
            return null;
          }
          
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;

          return {
            id: user.id,
            telegramUsername: user.telegramUsername,
            name: user.name,
          } as any;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.telegramUsername = (user as any).telegramUsername;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).telegramUsername = token.telegramUsername;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};
