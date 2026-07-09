import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshToken, getAthleteActivities } from "@/lib/strava";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST() {
  try {
    // BUG-003 fix: always use session userId, never trust client-supplied userId
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // BUG-033 fix: simple idempotency guard — reject if synced within last 5 seconds
    const recentRun = await prisma.run.findFirst({
      where: { userId, startTime: { gte: new Date(Date.now() - 5000) } },
      orderBy: { startTime: "desc" },
      select: { startTime: true }
    });
    if (recentRun) {
      return NextResponse.json({ success: true, syncedCount: 0, message: "Too soon" });
    }

    // Find user with Strava account
    const account = await prisma.account.findFirst({
      where: {
        userId: userId,
        provider: "strava"
      },
      include: {
        user: true
      }
    });

    if (!account) {
      return NextResponse.json({ error: "Strava not connected" }, { status: 404 });
    }

    let accessToken = account.access_token;
    
    // Check if token is expired
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

    if (!accessToken) {
      return NextResponse.json({ error: "No access token available" }, { status: 401 });
    }

    // Fetch last 10 activities
    const activities = await getAthleteActivities(accessToken, 10);
    let syncedCount = 0;

    for (const activity of activities) {
      // Only process runs (Run, VirtualRun, TrailRun, etc) and exclude manual entries
      if (activity.type.includes("Run") && !activity.manual) {
        const distanceKm = activity.distance / 1000;
        const durationSec = activity.moving_time;
        
        // Calculate pace in minutes per km
        let avgPace = 0;
        if (distanceKm > 0) {
          avgPace = (durationSec / 60) / distanceKm;
        }

        // Anti-cheat: ignore runs faster than 2:00 min/km or longer than 150km
        if (avgPace < 2.0 || distanceKm > 150) {
          console.log("Sync rejected run due to anti-cheat limits:", { avgPace, distanceKm });
          continue;
        }

        const startTime = new Date(activity.start_date);
        const existingRun = await prisma.run.findFirst({
          where: {
            userId: account.userId,
            startTime: startTime
          }
        });

        if (!existingRun) {
          // Create Run
          await prisma.run.create({
            data: {
              userId: account.userId,
              distance: distanceKm,
              durationSec: durationSec,
              avgPace: avgPace,
              status: "COMPLETED",
              startTime: new Date(activity.start_date),
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

          // Update club total distance for active memberships
          const activeMemberships = await prisma.clubMember.findMany({
            where: { userId: account.userId, status: "ACTIVE" }
          });
          
          for (const membership of activeMemberships) {
            // Anti-cheat / Logic fix: only count runs towards the club if they were actually performed AFTER joining the club
            if (startTime >= membership.joinedAt) {
              await prisma.club.update({
                where: { id: membership.clubId },
                data: {
                  totalClubDistance: {
                    increment: distanceKm
                  }
                }
              });
              await prisma.clubMember.update({
                where: { id: membership.id },
                data: {
                  clubDistance: {
                    increment: distanceKm
                  }
                }
              });
            }
          }
          
          syncedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, syncedCount });

  } catch (err: any) {
    console.error("Error manually syncing Strava:", err);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
