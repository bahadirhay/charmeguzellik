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
import { notifyTelegramAppointmentAction } from "@/lib/appointment-telegram-notify";
import { getFirstPublishedAppointmentSchedule } from "@/lib/published-appointment-schedule";
import { prisma } from "@/lib/prisma";
import { resolveWaDigits } from "@/lib/whatsapp-url";

const tokenSchema = z.object({
  token: z.string().min(20).max(200),
});

const cancelSchema = z.object({
  token: z.string().min(20).max(200),
  action: z.literal("cancel"),
});
const rescheduleSchema = z.object({
  token: z.string().min(20).max(200),
  action: z.literal("reschedule"),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeHm: z.string().regex(/^\d{2}:\d{2}$/),
});
const postSchema = z.discriminatedUnion("action", [cancelSchema, rescheduleSchema]);

const CUSTOMER_UPDATE_LOCK_MS = 60 * 60 * 1000;

async function findTokenAppointment(token: string) {
  const rows = await prisma.appointment.findMany({
    where: { status: "approved" },
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
    const occupied = await slotOccupiedExists(prisma, {
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

  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      status: "cancel_request",
      notes: [appt.notes, `Müşteri iptal talebi (bağlantı): ${new Date().toLocaleString("tr-TR")}`]
        .filter(Boolean)
        .join("\n"),
      cancelTokenHash: null,
      cancelTokenExpiresAt: null,
      cancelCodeHash: null,
    },
  });

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  try {
    if (settings) {
      const tg = await notifyTelegramAppointmentAction(settings, updated, "customer_cancel_request");
      if (!tg.ok && !tg.skipped) console.warn("appointment telegram notify", tg.error);
    }
  } catch (e) {
    console.warn("appointment telegram notify", e);
  }
  const waDigits = resolveWaDigits(settings?.whatsappNumber ?? null);
  const waText = `İptal onayı talebi: ${updated.clientName} - ${new Date(updated.startAt).toLocaleString("tr-TR")} randevumu iptal etmek istiyorum. Lütfen onaylayın.`;
  const whatsappUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : null;

  return NextResponse.json({ ok: true, whatsappUrl });
}
