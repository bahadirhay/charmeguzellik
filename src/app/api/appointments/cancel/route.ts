import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCancelToken } from "@/lib/appointment-cancel-token";
import {
  mergeAppointmentDays,
  naiveLocalToAppointmentIso,
  slotStartLabelsForCalendarDate,
  validatePreferredStartAgainstSchedule,
} from "@/lib/appointment-schedule";
import {
  appointmentConflictExists,
  normalizeClientNameKey,
  normalizePhoneKey,
  pendingSameDaySameServiceExists,
  slotOccupiedExists,
  withinOneHourOtherServiceExists,
} from "@/lib/crm-contact";
import { isStaffOccupiedAt, parseAssignedStaffFromNotes } from "@/lib/appointment-staffing";
import { notifyTelegramAppointmentAction } from "@/lib/appointment-telegram-notify";
import { getFirstPublishedAppointmentSchedule } from "@/lib/published-appointment-schedule";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { resolveWaDigits } from "@/lib/whatsapp-url";

const tokenSchema = z.object({
  token: z.string().min(20).max(200),
});

const cancelSchema = z.object({
  token: z.string().min(20).max(200),
  action: z.literal("cancel"),
});
const confirmSchema = z.object({
  token: z.string().min(20).max(200),
  action: z.literal("confirm"),
});
const rescheduleSchema = z.object({
  token: z.string().min(20).max(200),
  action: z.literal("reschedule"),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeHm: z.string().regex(/^\d{2}:\d{2}$/),
});
const postSchema = z.discriminatedUnion("action", [cancelSchema, confirmSchema, rescheduleSchema]);

const CUSTOMER_UPDATE_LOCK_MS = 60 * 60 * 1000;

async function sendCustomerDecisionEmail(opts: {
  appointment: { clientEmail: string | null; clientName: string; serviceName: string | null; startAt: Date };
  siteName: string;
  kind: "confirmed" | "cancelled";
}) {
  const to = opts.appointment.clientEmail?.trim();
  if (!to) return;
  const when = new Date(opts.appointment.startAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const svc = opts.appointment.serviceName ?? "Randevu";
  const subject =
    opts.kind === "confirmed"
      ? `${opts.siteName} — Randevu teyidiniz alındı`
      : `${opts.siteName} — Randevunuz iptal edildi`;
  const text =
    opts.kind === "confirmed"
      ? [
          `Merhaba ${opts.appointment.clientName},`,
          "",
          `${when} tarihli "${svc}" randevunuz için teyidiniz alınmıştır.`,
          "Görüşmek üzere.",
        ].join("\n")
      : [
          `Merhaba ${opts.appointment.clientName},`,
          "",
          `${when} tarihli "${svc}" randevunuz iptal edilmiştir.`,
          "Yeni randevu için tekrar iletişime geçebilirsiniz.",
        ].join("\n");
  const sent = await sendTransactionalEmail({ to, subject, text });
  if (!sent.ok) console.warn("customer decision email", sent.error);
}

async function findTokenAppointment(token: string) {
  const rows = await prisma.appointment.findMany({
    where: { status: { in: ["approved", "confirmed"] } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return rows.find(
    (r) =>
      verifyCancelToken(token, r.cancelTokenHash) &&
      (!r.cancelTokenExpiresAt || r.cancelTokenExpiresAt.getTime() > Date.now()),
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = tokenSchema.safeParse({ token: searchParams.get("t") ?? searchParams.get("token") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bağlantı geçersiz." }, { status: 400 });
  }

  const appt = await findTokenAppointment(parsed.data.token);
  if (!appt) {
    return NextResponse.json({ ok: false, error: "Bağlantı doğrulanamadı veya süresi dolmuş." }, { status: 400 });
  }

  const cfg = await getFirstPublishedAppointmentSchedule();
  const appointmentDays = mergeAppointmentDays(cfg?.appointmentDays);
  const slotDurationMinutes = cfg?.slotDurationMinutes ?? 60;
  const appointmentTimeZone = cfg?.appointmentTimeZone?.trim() || "Europe/Istanbul";

  return NextResponse.json({
    ok: true,
    appointment: {
      clientName: appt.clientName,
      serviceName: appt.serviceName,
      startAt: appt.startAt.toISOString(),
      canUpdate: appt.startAt.getTime() - Date.now() >= CUSTOMER_UPDATE_LOCK_MS,
    },
    schedule: {
      appointmentDays,
      slotDurationMinutes,
      appointmentTimeZone,
    },
  });
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bağlantı veya işlem geçersiz." }, { status: 400 });
  }

  const appt = await findTokenAppointment(parsed.data.token);

  if (!appt) {
    return NextResponse.json({ ok: false, error: "Bağlantı doğrulanamadı veya süresi dolmuş." }, { status: 400 });
  }

  if (parsed.data.action === "reschedule") {
    if (appt.startAt.getTime() - Date.now() < CUSTOMER_UPDATE_LOCK_MS) {
      return NextResponse.json(
        { ok: false, error: "Randevuya 1 saatten az kaldığı için takvim güncellemesi yapılamaz." },
        { status: 400 },
      );
    }
    const cfg = await getFirstPublishedAppointmentSchedule();
    const scheduleDays = mergeAppointmentDays(cfg?.appointmentDays);
    const slotDur = cfg?.slotDurationMinutes ?? 60;
    const tz = cfg?.appointmentTimeZone?.trim() || "Europe/Istanbul";
    const nextStart = new Date(naiveLocalToAppointmentIso(parsed.data.dateYmd, parsed.data.timeHm, tz));
    if (Number.isNaN(nextStart.getTime())) {
      return NextResponse.json({ ok: false, error: "Geçersiz tarih/saat seçimi." }, { status: 400 });
    }
    if (!validatePreferredStartAgainstSchedule(nextStart, scheduleDays, slotDur, tz)) {
      return NextResponse.json({ ok: false, error: "Seçilen tarih/saat takvimde uygun değil." }, { status: 400 });
    }

    const slots = new Set(slotStartLabelsForCalendarDate(parsed.data.dateYmd, scheduleDays, slotDur, tz));
    if (!slots.has(parsed.data.timeHm)) {
      return NextResponse.json({ ok: false, error: "Bu saat aralığı için uygun slot bulunamadı." }, { status: 400 });
    }

    const nameKey = normalizeClientNameKey(appt.clientName);
    const phoneKey = normalizePhoneKey(appt.clientPhone);
    const sameDayPending = await pendingSameDaySameServiceExists(prisma, {
      tenantId: appt.tenantId,
      startAt: nextStart,
      serviceName: appt.serviceName,
      nameKey,
      phoneKey,
      excludeAppointmentId: appt.id,
    });
    if (sameDayPending) {
      return NextResponse.json(
        { ok: false, error: "Aynı hizmette aynı gün bekleyen talebiniz olduğu için bu saat seçilemez." },
        { status: 409 },
      );
    }
    const tooClose = await withinOneHourOtherServiceExists(prisma, {
      tenantId: appt.tenantId,
      startAt: nextStart,
      serviceName: appt.serviceName,
      nameKey,
      phoneKey,
      excludeAppointmentId: appt.id,
    });
    if (tooClose) {
      return NextResponse.json(
        { ok: false, error: "Başka hizmetteki mevcut randevunuza çok yakın saat seçtiniz (en az 1 saat fark gerekli)." },
        { status: 409 },
      );
    }
    const conflict = await appointmentConflictExists(prisma, {
      tenantId: appt.tenantId,
      startAt: nextStart,
      serviceName: appt.serviceName,
      nameKey,
      phoneKey,
      excludeAppointmentId: appt.id,
    });
    if (conflict) {
      return NextResponse.json(
        { ok: false, error: "Aynı saatte başka randevunuz/talebiniz var. Lütfen farklı saat seçin." },
        { status: 409 },
      );
    }
    const assignedStaff = parseAssignedStaffFromNotes(appt.notes);
    if (assignedStaff) {
      const staffBusy = await isStaffOccupiedAt(prisma, nextStart, assignedStaff, appt.id, appt.tenantId);
      if (staffBusy) {
        return NextResponse.json(
          { ok: false, error: `Secili personel (${assignedStaff}) bu saatte musait degil.` },
          { status: 409 },
        );
      }
    }
    const occupied = await slotOccupiedExists(prisma, {
      tenantId: appt.tenantId,
      startAt: nextStart,
      excludeAppointmentId: appt.id,
    });
    if (occupied) {
      return NextResponse.json({ ok: false, error: "Seçtiğiniz saat dolu. Lütfen başka saat seçin." }, { status: 409 });
    }

    const currentDurationMs = Math.max(
      15 * 60_000,
      (appt.endAt ? appt.endAt.getTime() : appt.startAt.getTime() + 60 * 60_000) - appt.startAt.getTime(),
    );
    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        startAt: nextStart,
        endAt: new Date(nextStart.getTime() + currentDurationMs),
        notes: [
          appt.notes,
          `Müşteri takvim güncelledi (bağlantı): ${new Date().toLocaleString("tr-TR")} -> ${nextStart.toLocaleString("tr-TR")}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
    try {
      const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
      if (settings) {
        const tg = await notifyTelegramAppointmentAction(settings, updated, "customer_rescheduled");
        if (!tg.ok && !tg.skipped) console.warn("appointment telegram notify", tg.error);
      }
    } catch (e) {
      console.warn("appointment telegram notify", e);
    }
    return NextResponse.json({ ok: true, updatedStartAt: updated.startAt.toISOString() });
  }

  if (parsed.data.action === "confirm") {
    const alreadyConfirmed = appt.status === "confirmed";
    const updated = alreadyConfirmed
      ? appt
      : await prisma.appointment.update({
          where: { id: appt.id },
          data: {
            status: "confirmed",
            notes: [appt.notes, `Müşteri teyit verdi (bağlantı): ${new Date().toLocaleString("tr-TR")}`]
              .filter(Boolean)
              .join("\n"),
          },
        });
    try {
      const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
      const siteName = settings?.siteName?.trim() || "Salon";
      if (settings) {
        const tg = await notifyTelegramAppointmentAction(settings, updated, "customer_confirmed", {
          createdBy: "Müşteri (teyit bağlantısı)",
        });
        if (!tg.ok && !tg.skipped) console.warn("appointment telegram notify", tg.error);
      }
      await sendCustomerDecisionEmail({
        appointment: updated,
        siteName,
        kind: "confirmed",
      });
    } catch (e) {
      console.warn("appointment telegram notify", e);
    }
    return NextResponse.json({ ok: true, message: alreadyConfirmed ? "Randevunuz zaten teyitli." : "Randevunuz teyit edildi." });
  }

  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      status: "cancelled",
      notes: [appt.notes, `Müşteri iptal etti (bağlantı): ${new Date().toLocaleString("tr-TR")}`]
        .filter(Boolean)
        .join("\n"),
      cancelTokenHash: null,
      cancelTokenExpiresAt: null,
      cancelCodeHash: null,
    },
  });

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  try {
    const siteName = settings?.siteName?.trim() || "Salon";
    if (settings) {
      const tg = await notifyTelegramAppointmentAction(settings, updated, "appointment_cancelled", {
        createdBy: "Müşteri (iptal bağlantısı)",
      });
      if (!tg.ok && !tg.skipped) console.warn("appointment telegram notify", tg.error);
    }
    await sendCustomerDecisionEmail({
      appointment: updated,
      siteName,
      kind: "cancelled",
    });
  } catch (e) {
    console.warn("appointment telegram notify", e);
  }
  const waDigits = resolveWaDigits(settings?.whatsappNumber ?? null);
  const waText = `Bilgi: ${updated.clientName} - ${new Date(updated.startAt).toLocaleString("tr-TR")} randevusunu iptal etti.`;
  const whatsappUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : null;

  return NextResponse.json({ ok: true, whatsappUrl });
}
