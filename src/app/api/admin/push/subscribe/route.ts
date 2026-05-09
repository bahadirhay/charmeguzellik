import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiAny } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { getTenantIdForRequest } from "@/lib/tenant-db";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

async function resolveStaffId(
  tenantId: string,
  staffUserId: string | undefined,
  username: string,
): Promise<string | null> {
  if (staffUserId?.trim()) return staffUserId;
  const u = await prisma.staffUser.findFirst({
    where: { tenantId, username: username.trim() },
    select: { id: true },
  });
  return u?.id ?? null;
}

/** PushSubscription kaydı (aynı endpoint güncellenir) */
export async function POST(req: Request) {
  const auth = await requireStaffApiAny(["crm.appointments", "crm.appointments.self"]);
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz push aboneliği" }, { status: 400 });
  }
  const sub = parsed.data;
  const staffId = await resolveStaffId(tenantId, auth.staffUserId, auth.username);
  if (!staffId) {
    return NextResponse.json(
      { error: "Personel hesabı ile eşleşme yok — Web Push yalnızca personel oturumu için kullanılabilir." },
      { status: 400 },
    );
  }

  const subscriptionJson = JSON.stringify(sub);
  const userAgent = req.headers.get("user-agent");

  await prisma.staffPushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      staffId,
      endpoint: sub.endpoint,
      subscriptionJson,
      userAgent,
    },
    update: {
      staffId,
      subscriptionJson,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireStaffApiAny(["crm.appointments", "crm.appointments.self"]);
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  let endpoint: string | null = null;
  try {
    const u = new URL(req.url);
    endpoint = u.searchParams.get("endpoint");
  } catch {
    /* ignore */
  }
  if (!endpoint?.trim()) {
    try {
      const j = (await req.json()) as { endpoint?: string };
      endpoint = typeof j.endpoint === "string" ? j.endpoint : null;
    } catch {
      /* ignore */
    }
  }
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint gerekli" }, { status: 400 });
  }

  const staffId = await resolveStaffId(tenantId, auth.staffUserId, auth.username);
  if (!staffId) {
    return NextResponse.json({ error: "Personel bulunamadı" }, { status: 400 });
  }

  await prisma.staffPushSubscription.deleteMany({
    where: { endpoint: endpoint.trim(), staffId },
  });

  return NextResponse.json({ ok: true });
}
