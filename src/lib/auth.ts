import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { verifyTelegramInitData, parseTelegramUser } from "@/lib/telegramInitData";
import { linkTelegramAccount } from "@/lib/telegram";

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
              // OR if the user's current image is not yet on our S3 (legacy user migration)
              const isAlreadyOnS3 = user.image && user.image.includes("storage.yandexcloud.net");
              
              if (incomingImage && (incomingImage !== user.telegramPhotoUrl || !isAlreadyOnS3)) {
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
              const tgUser = parseTelegramUser(initData);
              if (tgUser) {
                await linkTelegramAccount(user.id, tgUser.id);
              }
            } catch (e) {
              console.error("Failed to link Telegram account on sign-in:", e);
            }

            return {
              id: user.id,
              email: user.telegramUsername,
              name: user.name,
              image: user.image,
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
            image: user.image,
          } as any;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.telegramUsername = (user as any).telegramUsername;
        if (user.image && typeof user.image === 'string' && user.image.length < 500 && !user.image.startsWith('data:image')) {
          token.image = user.image;
        }
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image !== undefined && typeof session.image === 'string' && session.image.length < 500 && !session.image.startsWith('data:image')) {
          token.image = session.image;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).telegramUsername = token.telegramUsername;
        session.user.image = token.image as string | null | undefined;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};
