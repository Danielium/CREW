import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeToken } from "@/lib/strava";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    // Redirect back to settings with error
    return NextResponse.redirect(new URL("/profile/settings?error=strava_auth_failed", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/profile/settings?error=no_code", request.url));
  }

  try {
    const data = await exchangeToken(code);
    
    // Check if user already has an account linked
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "strava",
          providerAccountId: data.athlete.id.toString(),
        }
      }
    });

    if (existingAccount && existingAccount.userId !== session.user.id) {
      // Another user is already using this Strava account
      return NextResponse.redirect(new URL("/profile/settings?error=strava_already_linked", request.url));
    }

    // Upsert the Strava account
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "strava",
          providerAccountId: data.athlete.id.toString(),
        }
      },
      update: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        token_type: data.token_type,
        userId: session.user.id,
      },
      create: {
        userId: session.user.id,
        type: "oauth",
        provider: "strava",
        providerAccountId: data.athlete.id.toString(),
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        token_type: data.token_type,
      }
    });

    return NextResponse.redirect(new URL("/profile/settings?success=strava_connected", request.url));

  } catch (err: any) {
    console.error("Error exchanging Strava token:", err);
    return NextResponse.redirect(new URL("/profile/settings?error=token_exchange_failed", request.url));
  }
}
