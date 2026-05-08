import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

const schema = z.object({
  consentKey: z.string().min(8).max(120),
  decision: z.enum(["accepted", "rejected", "custom"]),
  preferences: z.record(z.string(), z.boolean()).optional(),
});

function readIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  if (xf?.trim()) return xf.split(",")[0]?.trim() || null;
  return null;
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Geçersiz çerez verisi." }, { status: 400 });
  }

  const body = parsed.data;
  await prisma.cookieConsentLog.create({
    data: {
      tenantId: BOOTSTRAP_TENANT_ID,
      consentKey: body.consentKey,
      decision: body.decision,
      preferencesJson: body.preferences ? JSON.stringify(body.preferences) : null,
      ipAddress: readIp(req),
      userAgent: req.headers.get("user-agent"),
    },
  });

  return NextResponse.json({ ok: true });
}
