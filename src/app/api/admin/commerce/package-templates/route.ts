import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { normalizeServiceKey } from "@/lib/commerce/service-key";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const items = await prisma.commercePackageTemplate.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: { lines: true },
  });
  return NextResponse.json({ ok: true, items });
}

const lineSchema = z.object({
  serviceLabel: z.string().min(1).max(200),
  sessions: z.number().int().min(1).max(999),
});

const postSchema = z.object({
  name: z.string().min(1).max(200),
  listPriceMinor: z.number().int().min(0).max(100_000_000),
  validityDays: z.number().int().min(1).max(3650).optional().nullable(),
  active: z.boolean().optional(),
  lines: z.array(lineSchema).min(1).max(40),
});

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
  const nameTrim = parsed.data.name.trim();
  const nameClash = await prisma.commercePackageTemplate.findFirst({
    where: { tenantId, name: nameTrim },
    select: { id: true },
  });
  if (nameClash) {
    return NextResponse.json(
      { ok: false, error: "Bu paket adı bu işletmede zaten kullanılıyor" },
      { status: 409 },
    );
  }
  const tpl = await prisma.commercePackageTemplate.create({
    data: {
      tenantId,
      name: nameTrim,
      listPriceMinor: parsed.data.listPriceMinor,
      validityDays: parsed.data.validityDays ?? null,
      active: parsed.data.active !== false,
      lines: {
        create: parsed.data.lines.map((l) => ({
          serviceKey: normalizeServiceKey(l.serviceLabel),
          sessions: l.sessions,
        })),
      },
    },
    include: { lines: true },
  });
  return NextResponse.json({ ok: true, item: tpl });
}
