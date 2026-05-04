import { NextResponse } from "next/server";
import type { Appointment } from "@prisma/client";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { buildAppointmentNotifyCopy, buildNotifyLinks } from "@/lib/appointment-status-notify";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { getSiteSettings } from "@/lib/site-settings";

type Ctx = { params: Promise<{ id: string }> };

const DECISIONS = new Set(["approved", "rejected"]);

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("crm.appointments");
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const next = body.status?.trim().toLowerCase();
  if (!next || !DECISIONS.has(next)) {
    return NextResponse.json({ error: "status: approved veya rejected olmalı" }, { status: 400 });
  }

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (existing.status !== "pending") {
    return NextResponse.json(
      { error: "Yalnızca «bekleyen» (pending) talepler onaylanır veya reddedilir." },
      { status: 400 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: next },
  });

  const settings = await getSiteSettings();
  const siteName = settings.siteName?.trim() || "Salon";

  const rowPick: Pick<Appointment, "clientName" | "clientPhone" | "clientEmail" | "serviceName" | "startAt"> =
    updated;
  const decision = next as "approved" | "rejected";
  const { emailSubject, emailText } = buildAppointmentNotifyCopy(rowPick, decision, siteName);
  const links = buildNotifyLinks(rowPick, decision, siteName);

  let emailSent = false;
  let emailError: string | null = null;
  const emailTo = updated.clientEmail?.trim();
  if (emailTo) {
    const sent = await sendTransactionalEmail({
      to: emailTo,
      subject: emailSubject,
      text: emailText,
    });
    if (sent.ok) {
      emailSent = true;
    } else {
      emailError = sent.error;
    }
  }

  return NextResponse.json({
    ok: true,
    appointment: updated,
    notifications: {
      emailSent,
      emailError,
      emailSkipped: !emailTo,
      whatsappUrl: links.whatsappUrl,
      mailtoUrl: links.mailtoUrl,
    },
  });
}
