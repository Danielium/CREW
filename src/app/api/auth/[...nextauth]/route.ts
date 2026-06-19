import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

const handler = async (req: NextRequest, ctx: any) => {
  if (!process.env.NEXTAUTH_URL) {
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (host) {
      process.env.NEXTAUTH_URL = `${proto}://${host}`;
    }
  }
  const authHandler = NextAuth(authOptions);
  return await authHandler(req, ctx);
};

export { handler as GET, handler as POST };
