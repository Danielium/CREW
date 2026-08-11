import crypto from "crypto";

/**
 * Verify the HMAC signature of a Telegram WebApp initData string.
 * Shared by the auth provider and the account-linking endpoint.
 */
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    return expectedHash === hash;
  } catch {
    return false;
  }
}

/** Numeric Telegram id + username extracted from a verified initData string. */
export function parseTelegramUser(initData: string): { id: string; username: string | null } | null {
  try {
    const userParam = new URLSearchParams(initData).get("user");
    if (!userParam) return null;

    const tgUser = JSON.parse(userParam);
    if (!tgUser?.id) return null;

    return {
      id: String(tgUser.id),
      username: tgUser.username ? "@" + String(tgUser.username).toLowerCase() : null,
    };
  } catch {
    return null;
  }
}
