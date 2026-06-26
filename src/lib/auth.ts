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
              const dummyPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), 10);
              user = await prisma.user.create({
                data: {
                  telegramUsername: tUsername,
                  name: credentials.name || tUsername,
                  image: credentials.image || null,
                  password: dummyPassword,
                }
              });
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
            email: user.telegramUsername, // Map telegramUsername to email field in NextAuth JWT to avoid ts errors without extending types deeply
            name: user.name,
            // image: user.image, // Removed: Storing large Base64 strings in JWT causes 494 Header Too Large errors
          };
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
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};
