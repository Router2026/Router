/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/notifications/push-service.ts
// Thin wrapper around Firebase Cloud Messaging (FCM) HTTP v1 API.
// For APNS tokens, route through FCM as well (Firebase handles the bridge).

import { rawDb } from "@/lib/db/raw-client";

/** FCM HTTP v1 send endpoint */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FCM_URL = "https://fcm.googleapis.com/v1/projects/{projectId}/messages:send";

/** Retrieve all push tokens for a given user */
export async function getPushTokensForUser(userId: number): Promise<string[]> {
  const { rows } = await rawDb.query(
    `SELECT token FROM push_tokens WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.token as string);
}

/** Register or update a device push token for a user */
export async function upsertPushToken(
  userId: number,
  token: string,
  platform: "fcm" | "apns" = "fcm"
): Promise<void> {
  await rawDb.query(
    `INSERT INTO push_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, token) DO NOTHING`,
    [userId, token, platform]
  );
}

/** Remove a stale push token (e.g. after FCM returns UNREGISTERED) */
export async function removePushToken(userId: number, token: string): Promise<void> {
  await rawDb.query(
    `DELETE FROM push_tokens WHERE user_id = $1 AND token = $2`,
    [userId, token]
  );
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to all registered devices of a user.
 * Requires FIREBASE_SERVER_KEY env var to be set (FCM legacy key)
 * OR use the v1 API with a service account token.
 *
 * For simplicity we use the FCM legacy HTTP API here.
 * Swap to v1 API + service account for production.
 */
export async function sendPushToUser(
  userId: number,
  payload: PushPayload
): Promise<void> {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) {
    // Log the notification without failing — allows local dev without FCM
    console.info(
      `[push-service] FIREBASE_SERVER_KEY not set — skipping push for user ${userId}:`,
      payload.title
    );
    return;
  }

  const tokens = await getPushTokensForUser(userId);
  if (tokens.length === 0) return;

  // Send to all tokens in parallel; remove any that are no longer valid
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${serverKey}`,
          },
          body: JSON.stringify({
            to: token,
            notification: { title: payload.title, body: payload.body },
            data: payload.data ?? {},
          }),
        });

        if (!res.ok) {
          console.error(`[push-service] FCM error for token ${token.slice(0, 10)}…:`, res.status);
          return;
        }

        const json: any = await res.json();
        // Remove tokens that FCM reports as unregistered/invalid
        if (json?.results?.[0]?.error === "NotRegistered") {
          await removePushToken(userId, token);
        }
      } catch (err) {
        console.error("[push-service] Failed to send push notification:", err);
      }
    })
  );
}
