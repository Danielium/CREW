import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
            let user = await prisma.user.findUnique({
              where: { telegramUsername: tUsername }
            });

            if (!user) {
              const dummyPassword = await bcrypt.hash(require("crypto").randomBytes(5).toString('hex'), 10);
              user = await prisma.user.create({
                data: {
                  telegramUsername: tUsername,
                  name: credentials.name || tUsername,
                  image: credentials.image || null,
                  password: dummyPassword,
                }
              });
            } else {
              // Update name and image if provided by TG this time
              const updateData: any = {};
              if (credentials.name && credentials.name !== user.name) updateData.name = credentials.name;
              if (credentials.image && credentials.image !== user.image) updateData.image = credentials.image;
              
              if (Object.keys(updateData).length > 0) {
                user = await prisma.user.update({
                  where: { id: user.id },
                  data: updateData
                });
              }
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
