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
        password: { label: "Пароль", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.telegramUsername || !credentials?.password) {
          return null;
        }

        try {
          let tUsername = credentials.telegramUsername.toLowerCase();
          if (!tUsername.startsWith('@')) {
            tUsername = '@' + tUsername;
          }

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
