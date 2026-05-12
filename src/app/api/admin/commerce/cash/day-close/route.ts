import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { commerceApiJsonError, mapPrismaCommerceError } from "@/lib/commerce/prisma-commerce-error";
import { formatTryFromMinor } from "@/lib/commerce/format-money";
import { istanbulDayBoundsUtc } from "@/lib/commerce/istanbul-day-bounds";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

function ymdToUtcDateOnly(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) throw new Error("Tarih YYYY-MM-DD olmalı");
  return new Date(Date.UTC(y, m - 1, d));
}

const postSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  countedTotalMinor: z.number().int().min(0).max(100_000_000_000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const url = new URL(req.url);
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  if (!from || !to) {
    return NextResponse.json({ error: "from ve to (YYYY-MM-DD) gerekli" }, { status: 400 });
  }
  try {
    const items = await prisma.commerceCashDayClose.findMany({
      where: {
        tenantId,
        businessDate: {
          gte: ymdToUtcDateOnly(from),
          lte: ymdToUtcDateOnly(to),
        },
      },
      orderBy: { businessDate: "desc" },
      include: { staffUser: { select: { displayName: true } } },
    });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const m = mapPrismaCommerceError(e);
    console.error("[cash/day-close GET]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz" }, { status: 400 });
  }
  const ymd = parsed.data.businessDate;
  try {
    const { start, end } = istanbulDayBoundsUtc(ymd);
    const expected = await prisma.commerceCashReceipt.aggregate({
      where: { tenantId, occurredAt: { gte: start, lte: end } },
      _sum: { amountMinor: true },
    });
    const expectedTotalMinor = expected._sum.amountMinor ?? 0;
    const staffUserId = auth.staffUserId ?? null;

    const item = await prisma.commerceCashDayClose.upsert({
      where: {
        tenantId_businessDate: {
          tenantId,
          businessDate: ymdToUtcDateOnly(ymd),
        },
      },
      create: {
        tenantId,
        businessDate: ymdToUtcDateOnly(ymd),
        expectedTotalMinor,
        countedTotalMinor: parsed.data.countedTotalMinor ?? null,
        notes: parsed.data.notes?.trim() || null,
        staffUserId,
      },
      update: {
        closedAt: new Date(),
        expectedTotalMinor,
        countedTotalMinor:
          parsed.data.countedTotalMinor === undefined ? undefined : parsed.data.countedTotalMinor,
        notes: parsed.data.notes === undefined ? undefined : parsed.data.notes?.trim() || null,
        staffUserId,
      },
      include: { staffUser: { select: { displayName: true } } },
    });

    return NextResponse.json({
      ok: true,
      item: {
        ...item,
        businessDate: item.businessDate.toISOString().slice(0, 10),
        expectedTotalFormatted: formatTryFromMinor(item.expectedTotalMinor ?? 0),
        countedTotalFormatted:
          item.countedTotalMinor != null ? formatTryFromMinor(item.countedTotalMinor) : null,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("YYYY-MM-DD")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const m = mapPrismaCommerceError(e);
    console.error("[cash/day-close POST]", e);
    return commerceApiJsonError(m.status, m.message, m.code);
  }
}
