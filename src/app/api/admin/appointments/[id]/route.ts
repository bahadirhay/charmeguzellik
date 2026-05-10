import { NextResponse } from "next/server";
import type { Appointment } from "@prisma/client";
import {
  appointmentRowForbiddenForStaff,
  requireStaffApiAppointments,
} from "@/lib/admin-api-auth";
import { buildAppointmentNotifyCopy, buildNotifyLinks } from "@/lib/appointment-status-notify";
import {
  AppointmentDuplicateError,
  AppointmentPendingSameDayServiceError,
  AppointmentTooCloseOtherServiceError,
  AppointmentSlotOccupiedError,
} from "@/lib/create-appointment-record";
import {
  APPOINTMENT_PHONE_INPUT_MAX_LENGTH,
  appointmentPhoneTurkeyHint,
  isValidTurkeyMobileAppointmentPhone,
} from "@/lib/appointment-phone";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { getSiteSettings } from "@/lib/site-settings";
import { type UpdateAppointmentRecordInput, updateAppointmentRecord } from "@/lib/update-appointment-record";
import { generateAppointmentCancelSecret } from "@/lib/appointment-cancel-token";
import { withAssignedStaffInNotes } from "@/lib/appointment-staffing";
import { buildAppointmentCancelUrl } from "@/lib/site-public-url";
import { notifyTelegramAppointmentAction } from "@/lib/appointment-telegram-notify";
import { denyIfAppointmentsDisabled } from "@/lib/appointments-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

const DECISIONS = new Set(["approved", "rejected", "cancelled", "cancel_request", "checked_in", "no_show"]);

const DETAIL_KEYS = [
  "startAt",
  "endAt",
  "serviceName",
  "clientName",
  "clientEmail",
  "clientPhone",
  "notes",
] as const;
const APPOINTMENT_UPDATE_LOCK_MS = 60 * 60 * 1000;
const PANEL_CANCEL_NOTE_PREFIX = "Panel iptal onayı:";
const PANEL_CANCEL_UNDO_NOTE_PREFIX = "Panel iptal geri alındı:";

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return Object.is(a, b);
}

/** Yalnızca dahili not değişiyorsa; randuvuya çok yakınsa tarih müşteri vb. kitli kalır, not yazılabilsin diye ayırım. */
function isOnlyNotesDetailChange(existing: Appointment, input: UpdateAppointmentRecordInput): boolean {
  if (input.notes === undefined) return false;
  const keys = Object.keys(input) as (keyof UpdateAppointmentRecordInput)[];
  for (const k of keys) {
    if (k === "notes") continue;
    const nv = input[k];
    if (nv === undefined) continue;
    const ev = existing[k as keyof Appointment];
    if (!valuesEqual(nv, ev)) return false;
  }
  return true;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireStaffApiAppointments();
  if (auth instanceof NextResponse) return auth;
  const apptForbidden = await denyIfAppointmentsDisabled(req);
  if (apptForbidden) return apptForbidden;

  const tenantId = await getTenantIdForRequest(req);
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
      return NextResponse.json(
        { error: "status: approved | rejected | cancelled | cancel_request | checked_in | no_show olmalı" },
        { status: 400 },
      );
    }
    const mixed = DETAIL_KEYS.some((k) => k in body && body[k] !== undefined);
    if (mixed) {
      return NextResponse.json(
        { error: "Durum güncelleme ile randevu alanlarını aynı istekte göndermeyin." },
        { status: 400 },
      );
    }

    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } });
    const rowForbidden = appointmentRowForbiddenForStaff(auth, existing);
    if (rowForbidden) return rowForbidden;
    if (!existing) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    }
    const appStatus = existing.status;
    if (statusRaw === "cancelled") {
      if (existing.status === "cancelled" || existing.status === "rejected") {
        return NextResponse.json({ error: "Bu kayıt zaten kapatılmış (iptal/red)." }, { status: 400 });
      }
      if (existing.status === "no_show" || existing.status === "checked_in") {
        return NextResponse.json({ error: "Tamamlanmış kaydı iptal edemezsiniz." }, { status: 400 });
      }
    } else if (statusRaw === "cancel_request") {
      if (appStatus !== "approved" && appStatus !== "confirmed") {
        return NextResponse.json(
          { error: "İptal talebi yalnızca onaylı randevu için başlatılır." },
          { status: 400 },
        );
      }
    } else if (statusRaw === "approved") {
      if (appStatus !== "pending" && appStatus !== "cancelled") {
        return NextResponse.json(
          { error: "Onay işlemi yalnızca bekleyen veya iptal edilen kayıtta kullanılabilir." },
          { status: 400 },
        );
      }
    } else if (statusRaw === "rejected") {
      if (appStatus !== "pending") {
        return NextResponse.json({ error: "Reddetme yalnızca bekleyen kayıtta kullanılabilir." }, { status: 400 });
      }
    } else if (statusRaw === "checked_in" || statusRaw === "no_show") {
      if (appStatus !== "confirmed") {
        return NextResponse.json(
          { error: "Check-in / no-show yalnızca teyitli randevuda işaretlenebilir." },
          { status: 400 },
        );
      }
    }

    let updated = await prisma.appointment.update({
      where: { id },
      data:
        statusRaw === "cancelled"
          ? {
              status: statusRaw,
              notes: [existing.notes, `${PANEL_CANCEL_NOTE_PREFIX} ${auth.username} (${new Date().toLocaleString("tr-TR")})`]
                .filter(Boolean)
                .join("\n"),
            }
          : statusRaw === "approved" && appStatus === "cancelled"
            ? {
                status: statusRaw,
                notes: [existing.notes, `${PANEL_CANCEL_UNDO_NOTE_PREFIX} ${auth.username} (${new Date().toLocaleString("tr-TR")})`]
                  .filter(Boolean)
                  .join("\n"),
              }
          : { status: statusRaw },
    });

    if (statusRaw === "cancelled") {
      try {
        const settings = await getSiteSettings(req);
        const tg = await notifyTelegramAppointmentAction(settings, updated, "appointment_cancelled", {
          createdBy: auth.username,
        });
        if (!tg.ok && !tg.skipped) {
          console.warn("appointment telegram notify", tg.error);
        }
      } catch (e) {
        console.warn("appointment telegram notify", e);
      }
      return NextResponse.json({
        ok: true,
        appointment: updated,
        notifications: null,
      });
    }
    if (statusRaw === "checked_in" || statusRaw === "no_show") {
      return NextResponse.json({
        ok: true,
        appointment: updated,
        notifications: null,
      });
    }
    if (statusRaw === "cancel_request") {
      return NextResponse.json({
        ok: true,
        appointment: updated,
        notifications: null,
      });
    }

    const settings = await getSiteSettings(req);
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
        tenantId: updated.tenantId,
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

  const existing = await prisma.appointment.findFirst({ where: { id, tenantId } });
  const rowForbidden2 = appointmentRowForbiddenForStaff(auth, existing);
  if (rowForbidden2) return rowForbidden2;
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  const input: UpdateAppointmentRecordInput = {};

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

  if (auth.appointmentScope === "self" && auth.selfStaffLabel && input.notes !== undefined) {
    input.notes = withAssignedStaffInNotes(input.notes, auth.selfStaffLabel);
  }

  if (
    !isOnlyNotesDetailChange(existing, input) &&
    existing.startAt.getTime() - Date.now() < APPOINTMENT_UPDATE_LOCK_MS
  ) {
    return NextResponse.json(
      { error: "Randevu başlangıcına 1 saatten az kala müşteri/tarih/saat değiştirilemez. Yalnızca not ekleyebilirsiniz." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => updateAppointmentRecord(tx, id, input));
    return NextResponse.json({ ok: true, appointment: updated });
  } catch (e) {
    if (e instanceof AppointmentDuplicateError) {
      return NextResponse.json(
        { error: "Aynı kişi için aynı saatte başka aktif kayıt var." },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentPendingSameDayServiceError) {
      return NextResponse.json(
        { error: "Aynı kişi için aynı hizmette aynı gün bekleyen talep var." },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentTooCloseOtherServiceError) {
      return NextResponse.json(
        { error: "Başka hizmetteki mevcut randevuya çok yakın saat seçildi (min. 1 saat fark gerekli)." },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentSlotOccupiedError) {
      return NextResponse.json({ error: "Seçilen saat dolu." }, { status: 409 });
    }
    if (e instanceof Error && e.message === "phone_required") {
      return NextResponse.json({ error: "Telefon boş bırakılamaz." }, { status: 400 });
    }
    throw e;
  }
}
