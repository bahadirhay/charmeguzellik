import { NextResponse } from "next/server";
import { requireStaffApiAppointmentsFull } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { getServiceStaffMap } from "@/lib/appointment-staffing";
import { parseThemeTokens, themeTokensToJson } from "@/lib/theme-tokens";

export async function GET() {
  const auth = await requireStaffApiAppointmentsFull();
  if (auth instanceof NextResponse) return auth;
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { themeTokensJson: true },
  });
  return NextResponse.json({ ok: true, map: getServiceStaffMap(row?.themeTokensJson) });
}

export async function PUT(req: Request) {
  const auth = await requireStaffApiAppointmentsFull();
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { map?: unknown };
  const src = body.map;
  if (!src || typeof src !== "object" || Array.isArray(src)) {
    return NextResponse.json({ ok: false, error: "Geçersiz map verisi." }, { status: 400 });
  }
  const normalized: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
    if (!k.trim() || !Array.isArray(v)) continue;
    const arr = v
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    if (arr.length) normalized[k.trim()] = Array.from(new Set(arr));
  }

  const existing = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const tokens = parseThemeTokens(existing?.themeTokensJson);
  const nextJson = themeTokensToJson({ ...tokens, appointmentStaffByService: normalized });
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, themeTokensJson: nextJson },
    update: { themeTokensJson: nextJson },
  });
  return NextResponse.json({ ok: true, map: normalized });
}

