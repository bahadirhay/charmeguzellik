/**
 * Google Calendar API v3 — OAuth refresh token ile.
 * Ayarlar: googleCalendarClientId, googleCalendarSecret, googleRefreshToken
 */

export async function refreshGoogleAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn("google oauth token", res.status, t.slice(0, 200));
    return null;
  }
  const j = (await res.json()) as { access_token?: string };
  return j.access_token ?? null;
}

export async function insertPrimaryCalendarEvent(
  accessToken: string,
  event: { summary: string; description?: string; start: Date; end: Date },
): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn("google calendar insert", res.status, t.slice(0, 300));
    return null;
  }
  const j = (await res.json()) as { id?: string };
  return j.id ?? null;
}
