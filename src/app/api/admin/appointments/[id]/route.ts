import { NextResponse } from "next/server";
import type { Appointment } from "@prisma/client";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { buildAppointmentNotifyCopy, buildNotifyLinks } from "@/lib/appointment-status-notify";
import { AppointmentDuplicateError } from "@/lib/create-appointment-record";
import {
  APPOINTMENT_PHONE_INPUT_MAX_LENGTH,
  appointmentPhoneTurkeyHint,
  isValidTurkeyMobileAppointmentPhone,
} from "@/lib/appointment-phone";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { getSiteSettings } from "@/lib/site-settings";
import { updateAppointmentRecord } from "@/lib/update-appointment-record";
import { generateAppointmentCancelSecret } from "@/lib/appointment-cancel-token";
import { buildAppointmentCancelUrl } from "@/lib/site-public-url";

type Ctx = { params: Promise<{ id: string }> };

const DECISIONS = new Set(["approved", "rejected", "cancelled", "cancel_request"]);

const DETAIL_KEYS = [
  "startAt",
  "endAt",
  "serviceName",
  "clientName",
  "clientEmail",
  "clientPhone",
  "notes",
] as const;

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiPerm("crm.appointments");
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

  if (statusRaw) {
    if (!DECISIONS.has(statusRaw)) {
      return NextResponse.json({ error: "status: approved | rejected | cancelled | cancel_request olmalı" }, { status: 400 });
    }
    const mixed = DETAIL_KEYS.some((k) => k in body && body[k] !== undefined);
    if (mixed) {
      return NextResponse.json(
        { error: "Durum güncelleme ile randevu alanlarını aynı istekte göndermeyin." },
        { status: 400 },
      );
    }

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }
    if (statusRaw === "cancelled") {
      if (existing.status === "cancelled" || existing.status === "rejected") {
        return NextResponse.json({ error: "Bu kayıt zaten kapatılmış (iptal/red)." }, { status: 400 });
      }
      if (existing.status !== "cancel_request") {
        return NextResponse.json(
          { error: "Doğrudan iptal için önce müşteri iptal talebi (cancel_request) olmalı." },
          { status: 400 },
        );
      }
    } else if (statusRaw === "cancel_request") {
      if (existing.status !== "approved") {
        return NextResponse.json(
          { error: "İptal talebi yalnızca onaylı randevu için başlatılır." },
          { status: 400 },
        );
      }
    } else if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "Yalnızca «bekleyen» (pending) talepler onaylanır veya reddedilir." },
        { status: 400 },
      );
    }

    let updated = await prisma.appointment.update({
      where: { id },
      data: { status: statusRaw },
    });

    if (statusRaw === "cancelled" || statusRaw === "cancel_request") {
      return NextResponse.json({
        ok: true,
        appointment: updated,
        notifications: null,
      });
    }

    const settings = await getSiteSettings();
    const siteName = settings.siteName?.trim() || "Salon";
    let cancelInfo:
      | {
          cancelCode: string;
          cancelUrl: string;
        }
      | undefined;

    if (statusRaw === "approved") {
      const sec = generateAppointmentCancelSecret();
      cancelInfo = {
        cancelCode: sec.code,
        cancelUrl: buildAppointmentCancelUrl(sec.token, req),
      };
      updated = await prisma.appointment.update({
        where: { id: updated.id },
        data: {
          cancelCodeHash: sec.codeHash,
          cancelCodeLast4: sec.codeLast4,
          cancelTokenHash: sec.tokenHash,
          cancelTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      });
    }

    const rowPick: Pick<Appointment, "clientName" | "clientPhone" | "clientEmail" | "serviceName" | "startAt"> =
      updated;
    const decision = statusRaw as "approved" | "rejected";
    const { emailSubject, emailText } = buildAppointmentNotifyCopy(rowPick, decision, siteName, cancelInfo);
    const links = buildNotifyLinks(rowPick, decision, siteName, cancelInfo);

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

  if (!DETAIL_KEYS.some((k) => k in body)) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const input: Parameters<typeof updateAppointmentRecord>[2] = {};

  if (typeof body.startAt === "string") {
    const d = new Date(body.startAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Geçersiz başlangıç tarihi" }, { status: 400 });
    }
    input.startAt = d;
  }

  if (body.endAt !== undefined) {
    if (body.endAt === null || body.endAt === "") {
      input.endAt = null;
    } else if (typeof body.endAt === "string") {
      const d = new Date(body.endAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Geçersiz bitiş tarihi" }, { status: 400 });
      }
      input.endAt = d;
    } else {
      return NextResponse.json({ error: "endAt metin veya null olmalı" }, { status: 400 });
    }
  }

  if (typeof body.serviceName === "string") {
    input.serviceName = body.serviceName.trim() || null;
  } else if (body.serviceName === null) {
    input.serviceName = null;
  }

  if (typeof body.clientName === "string") {
    const s = body.clientName.trim();
    if (!s) {
      return NextResponse.json({ error: "Müşteri adı boş olamaz" }, { status: 400 });
    }
    input.clientName = s;
  }

  if (typeof body.clientEmail === "string") {
    input.clientEmail = body.clientEmail.trim() || null;
  } else if (body.clientEmail === null) {
    input.clientEmail = null;
  }

  if (typeof body.clientPhone === "string") {
    const p = body.clientPhone.trim();
    if (p.length > APPOINTMENT_PHONE_INPUT_MAX_LENGTH) {
      return NextResponse.json({ error: appointmentPhoneTurkeyHint() }, { status: 400 });
    }
    if (!isValidTurkeyMobileAppointmentPhone(p)) {
      return NextResponse.json({ error: appointmentPhoneTurkeyHint() }, { status: 400 });
    }
    input.clientPhone = p;
  }

  if (typeof body.notes === "string") {
    input.notes = body.notes.trim() || null;
  } else if (body.notes === null) {
    input.notes = null;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => updateAppointmentRecord(tx, id, input));
    return NextResponse.json({ ok: true, appointment: updated });
  } catch (e) {
    if (e instanceof AppointmentDuplicateError) {
      return NextResponse.json(
        { error: "Bu bilgilerle aynı hizmet ve saatte başka kayıt var." },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "phone_required") {
      return NextResponse.json({ error: "Telefon boş bırakılamaz." }, { status: 400 });
    }
    throw e;
  }
}
