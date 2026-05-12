import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyIfCommerceModuleDisabled } from "@/lib/commerce-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireStaffApiPerm("commerce.manage");
  if (auth instanceof NextResponse) return auth;
  const commerceForbidden = await denyIfCommerceModuleDisabled(req);
  if (commerceForbidden) return commerceForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const crmContactId = new URL(req.url).searchParams.get("crmContactId")?.trim();
  if (!crmContactId) return NextResponse.json({ error: "crmContactId gerekli" }, { status: 400 });
  const contact = await prisma.crmContact.findFirst({
    where: { id: crmContactId, tenantId },
    select: { id: true, name: true, phoneKey: true },
  });
  if (!contact) return NextResponse.json({ error: "Müşteri yok" }, { status: 404 });
  const entries = await prisma.commerceLedgerEntry.findMany({
    where: { tenantId, crmContactId },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
  const balance = entries.reduce((s, e) => s + e.amountMinor, 0);
  return NextResponse.json({ ok: true, contact, entries, balanceMinor: balance });
}

const postSchema = z.object({
  crmContactId: z.string().min(1),
  kind: z.enum(["charge", "payment", "adjustment", "refund"]),
  amountMinor: z.number().int().min(-100_000_000).max(100_000_000),
  /** Borçlandırma satırında menü etiketi (kayıtta açıklamaya eklenir). */
  serviceLabel: z.string().max(300).optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
  occurredAt: z.string().datetime().optional(),
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
  const c = await prisma.crmContact.findFirst({
    where: { id: parsed.data.crmContactId, tenantId },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Müşteri yok" }, { status: 404 });
  const svc = parsed.data.serviceLabel?.trim();
  const memoRest = parsed.data.memo?.trim() || null;
  let memoOut: string | null = memoRest;
  if (svc) {
    const tag = `Hizmet: ${svc}`;
    memoOut = memoRest ? `${tag} — ${memoRest}` : tag;
  }
  const row = await prisma.commerceLedgerEntry.create({
    data: {
      tenantId,
      crmContactId: parsed.data.crmContactId,
      kind: parsed.data.kind,
      amountMinor: parsed.data.amountMinor,
      memo: memoOut,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
    },
  });
  return NextResponse.json({ ok: true, item: row });
}
