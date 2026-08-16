import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeToken } from "@/lib/strava";
import { activateChallenge } from "@/lib/challenges";

function parseState(raw: string | null): { returnTo?: string; challengeId?: string } {
  if (!raw) return {};
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const { returnTo, challengeId } = parseState(url.searchParams.get("state"));
  const fallbackPath = returnTo || "/profile/settings";

  if (error) {
    return NextResponse.redirect(new URL(`${fallbackPath}?error=strava_auth_failed`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`${fallbackPath}?error=no_code`, request.url));
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
      return NextResponse.redirect(new URL(`${fallbackPath}?error=strava_already_linked`, request.url));
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

    // Тот самый момент воронки: пришёл за наградой, подключил Strava — и
    // должен вернуться в цель, уже активированную, а не в список настроек.
    if (challengeId) {
      try {
        await activateChallenge(session.user.id, challengeId);
        return NextResponse.redirect(new URL(`${fallbackPath}?success=goal_activated`, request.url));
      } catch (activationErr) {
        console.error("Failed to activate challenge after Strava connect:", activationErr);
        return NextResponse.redirect(new URL(`${fallbackPath}?success=strava_connected&error=activation_failed`, request.url));
      }
    }

    return NextResponse.redirect(new URL(`${fallbackPath}?success=strava_connected`, request.url));

  } catch (err: any) {
    console.error("Error exchanging Strava token:", err);
    return NextResponse.redirect(new URL(`${fallbackPath}?error=token_exchange_failed`, request.url));
  }
}
