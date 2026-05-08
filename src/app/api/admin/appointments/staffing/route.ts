import { NextResponse } from "next/server";
import { requireStaffApiAppointmentsFull } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { coerceAppointmentStaffMapToIds, isLikelyStaffUserId } from "@/lib/appointment-staffing";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";
import { parseThemeTokens, themeTokensToJson } from "@/lib/theme-tokens";

export async function GET() {
  const auth = await requireStaffApiAppointmentsFull();
  if (auth instanceof NextResponse) return auth;
  const row = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { themeTokensJson: true },
  });
  const idMap = await coerceAppointmentStaffMapToIds(prisma, row?.themeTokensJson);
  return NextResponse.json({ ok: true, idMap });
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
    const arr: string[] = [];
    for (const item of v) {
      if (typeof item !== "string") {
        return NextResponse.json({ ok: false, error: "Geçersiz personel listesi." }, { status: 400 });
      }
      const id = item.trim();
      if (!id) continue;
      if (!isLikelyStaffUserId(id)) {
        return NextResponse.json(
          { ok: false, error: "Personel yalnızca Personel & roller kayıtlarından seçilir (geçersiz id)." },
          { status: 400 },
        );
      }
      arr.push(id);
    }
    if (arr.length) normalized[k.trim()] = Array.from(new Set(arr));
  }

  const allIds = [...new Set(Object.values(normalized).flat())];
  if (allIds.length) {
    const users = await prisma.staffUser.findMany({
      where: { id: { in: allIds }, active: true, tenantId: BOOTSTRAP_TENANT_ID },
      select: { id: true, displayName: true },
    });
    if (users.length !== allIds.length) {
      return NextResponse.json({ ok: false, error: "Geçersiz veya pasif personel id'si." }, { status: 400 });
    }
    if (users.some((u) => !u.displayName?.trim())) {
      return NextResponse.json(
        { ok: false, error: "Tüm atanmış personellerde «Görünen ad» tanımlı olmalıdır." },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const tokens = parseThemeTokens(existing?.themeTokensJson);
  const nextJson = themeTokensToJson({ ...tokens, appointmentStaffByService: normalized });
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, themeTokensJson: nextJson },
    update: { themeTokensJson: nextJson },
  });
  return NextResponse.json({ ok: true, idMap: normalized });
}

