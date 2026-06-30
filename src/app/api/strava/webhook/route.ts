import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STRAVA_WEBHOOK_VERIFY_TOKEN, refreshToken, getActivityInfo } from "@/lib/strava";

/**
 * Strava Webhook Verification Endpoint
 * Strava sends a GET request to verify the subscription.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode && token) {
    if (mode === "subscribe" && token === STRAVA_WEBHOOK_VERIFY_TOKEN) {
      console.log("Strava Webhook Verified!");
      return NextResponse.json({ "hub.challenge": challenge });
    } else {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return new NextResponse("Bad Request", { status: 400 });
}

/**
 * Strava Webhook Event Receiver
 * Strava sends POST requests when an activity is created, updated, or deleted.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Strava Webhook Received:", body);

    // We only care about new activities
    if (body.object_type === "activity" && body.aspect_type === "create") {
      const athleteId = body.owner_id.toString();
      const activityId = body.object_id;

      // Find user with this Strava account
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "strava",
            providerAccountId: athleteId,
          }
        },
        include: {
          user: true
        }
      });

      if (account && account.user) {
        let accessToken = account.access_token;
        
        // Check if token is expired (giving a 5 minute buffer)
        const now = Math.floor(Date.now() / 1000);
        if (account.expires_at && account.expires_at < (now + 300)) {
          if (account.refresh_token) {
            console.log("Refreshing Strava token for user:", account.userId);
            const newTokenData = await refreshToken(account.refresh_token);
            
            await prisma.account.update({
              where: { id: account.id },
              data: {
                access_token: newTokenData.access_token,
                refresh_token: newTokenData.refresh_token,
                expires_at: newTokenData.expires_at,
              }
            });
            accessToken = newTokenData.access_token;
          }
        }

        if (accessToken) {
          // Fetch activity details
          const activity = await getActivityInfo(accessToken, activityId);
          console.log("Fetched Activity Details:", activity.name);

          // Only process runs (Run, VirtualRun, TrailRun, etc)
          if (activity.type.includes("Run")) {
            const distanceKm = activity.distance / 1000;
            const durationSec = activity.moving_time;
            
            // Calculate pace in minutes per km
            let avgPace = 0;
            if (distanceKm > 0) {
              avgPace = (durationSec / 60) / distanceKm;
            }

            // Create Run
            const newRun = await prisma.run.create({
              data: {
                userId: account.userId,
                distance: distanceKm,
                durationSec: durationSec,
                avgPace: avgPace,
                status: "COMPLETED",
                startTime: new Date(activity.start_date),
                // Optional: add routeData if activity.map.summary_polyline exists
                routeData: activity.map?.summary_polyline ? JSON.stringify({ polyline: activity.map.summary_polyline }) : null
              }
            });

            // Update user total distance
            await prisma.user.update({
              where: { id: account.userId },
              data: {
                totalDistance: {
                  increment: distanceKm
                }
              }
            });

            // Generate a Feed Post for this Run
            await prisma.post.create({
              data: {
                userId: account.userId,
                type: "RUN",
                runId: newRun.id,
                content: `Тренировка из Strava: ${activity.name}`
              }
            });

            console.log("Successfully synced Strava run for user:", account.userId);
          }
        }
      }
    }

    // Always return 200 OK to Strava so they don't retry and block webhooks
    return new NextResponse("OK", { status: 200 });

  } catch (err: any) {
    console.error("Error processing Strava webhook:", err);
    // Still return 200 to prevent retry storms
    return new NextResponse("OK", { status: 200 });
  }
}
