export const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || "";
export const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || "";
export const STRAVA_WEBHOOK_VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || "crew_strava_webhook_123";

/**
 * Exchanges an authorization code for an access token.
 */
export async function exchangeToken(code: string) {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Failed to exchange Strava token: ${await res.text()}`);
  }

  return res.json(); // { token_type, expires_at, expires_in, refresh_token, access_token, athlete }
}

/**
 * Refreshes an expired access token.
 */
export async function refreshToken(refresh_token: string) {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token,
  });

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Strava token: ${await res.text()}`);
  }

  return res.json(); // { token_type, access_token, expires_at, expires_in, refresh_token }
}

/**
 * Fetches detailed information about a specific activity.
 */
export async function getActivityInfo(access_token: string, activityId: string | number) {
  const res = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Strava activity: ${await res.text()}`);
  }

  return res.json();
}
