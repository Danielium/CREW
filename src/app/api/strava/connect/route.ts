import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { STRAVA_CLIENT_ID } from "@/lib/strava";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Determine the base URL for the callback
  const url = new URL(request.url);
  const redirectUri = `${url.protocol}//${url.host}/api/strava/callback`;
  
  const scope = "activity:read_all";

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=force&scope=${scope}`;

  return NextResponse.redirect(stravaAuthUrl);
}
