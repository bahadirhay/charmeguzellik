import { NextResponse } from "next/server";
import { z } from "zod";
import {
  mergeAppointmentDays,
  validatePreferredStartAgainstSchedule,
} from "@/lib/appointment-schedule";
import {
  eligibleStaffForService,
  isStaffOccupiedAt,
  pickAvailableStaff,
  resolveServiceStaffMap,
  withAssignedStaffInNotes,
} from "@/lib/appointment-staffing";
import { resolvePublishedContactFormBlock, type ContactFormContext } from "@/lib/contact-form-resolve";
import {
  createAppointmentRecord,
  AppointmentDuplicateError,
  AppointmentPendingSameDayServiceError,
  AppointmentSlotOccupiedError,
  AppointmentTooCloseOtherServiceError,
} from "@/lib/create-appointment-record";
import { appointmentInboundNotifyRecipients } from "@/lib/appointment-inbound-notify";
import { notifyStaffPushNewAppointment } from "@/lib/appointment-push-notify";
import { notifyTelegramNewAppointment } from "@/lib/appointment-telegram-notify";
import { getSiteSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import {
  APPOINTMENT_PHONE_INPUT_MAX_LENGTH,
  appointmentPhoneTurkeyHint,
  isValidTurkeyMobileAppointmentPhone,
} from "@/lib/appointment-phone";
import { getTenantIdForRequest } from "@/lib/tenant-db";

const postSchema = z.object({
  clientName: z.string().min(1).max(120),
  clientEmail: z.string().max(200).optional().nullable(),
  clientPhone: z
    .string()
    .trim()
    .min(1, appointmentPhoneTurkeyHint())
    .max(APPOINTMENT_PHONE_INPUT_MAX_LENGTH)
    .refine(isValidTurkeyMobileAppointmentPhone, appointmentPhoneTurkeyHint()),
  serviceId: z.string().max(64).optional().nullable(),
  serviceLabel: z.string().max(160).optional().nullable(),
  preferredStart: z.string().min(4).max(120),
  message: z.string().max(4000).optional().nullable(),
  consentAccepted: z.array(z.string().max(500)).max(8).optional(),
  durationMinutes: z.coerce.number().int().min(15).max(240).optional(),
  /** Honeypot — doldurulursa bot */
  website: z.string().max(200).optional(),
  formContext: z.enum(["page", "header", "footer"]).optional(),
  pageSlug: z.string().max(200).optional().nullable(),
  blockId: z.string().max(80).optional(),
  staffName: z.string().max(120).optional().nullable(),
});

export async function POST(req: Request) {
  const tenantId = await getTenantIdForRequest(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const phoneIssue = issues.find((i) => i.path[0] === "clientPhone");
    const msg =
      phoneIssue?.message ??
      issues[0]?.message ??
      "Eksik veya geçersiz alanlar.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  const body = parsed.data;
  if (body.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const start = new Date(body.preferredStart);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ ok: false, error: "Geçersiz tarih/saat" }, { status: 400 });
  }

  const ctx = (body.formContext ?? "page") as ContactFormContext;
  const slug = body.pageSlug?.trim() || null;
  const blockId = body.blockId?.trim() ?? "";
  const formBlock = await resolvePublishedContactFormBlock(ctx, slug, blockId);
  if (!formBlock || formBlock.props.mode !== "appointment") {
    return NextResponse.json(
      { ok: false, error: "Geçersiz form bağlamı — sayfayı yenileyip tekrar deneyin." },
      { status: 400 },
    );
  }
  const scheduleDays = mergeAppointmentDays(formBlock.props.appointmentDays);
  const slotDur = formBlock.props.slotDurationMinutes ?? 60;
  const tz = formBlock.props.appointmentTimeZone?.trim() || "Europe/Istanbul";
  if (!validatePreferredStartAgainstSchedule(start, scheduleDays, slotDur, tz)) {
    return NextResponse.json(
      { ok: false, error: "Seçilen saat çalışma saatleri veya randevu aralığına uymuyor." },
      { status: 400 },
    );
  }

  const duration = slotDur;
  const end = new Date(start.getTime() + duration * 60_000);

  const serviceName = body.serviceLabel?.trim() || body.serviceId?.trim() || null;

  const notesParts = [body.message?.trim()].filter(Boolean) as string[];
  if (body.consentAccepted?.length) {
    notesParts.push(`Onaylar: ${body.consentAccepted.join(" | ")}`);
  }
  if (body.clientEmail?.trim()) notesParts.unshift(`E-posta: ${body.clientEmail.trim()}`);
  if (body.clientPhone?.trim()) notesParts.unshift(`Telefon: ${body.clientPhone.trim()}`);
  const notes = notesParts.length ? notesParts.join("\n") : null;
  const settings = await getSiteSettings();
  const staffMap = await resolveServiceStaffMap(prisma, settings.themeTokensJson, tenantId);
  const staffCandidates = eligibleStaffForService(serviceName, staffMap);
  const requestedStaff = body.staffName?.trim() || "";
  let assignedStaff: string | null = null;
  if (staffCandidates.length > 0) {
    if (requestedStaff) {
      if (!staffCandidates.some((s) => s.toLocaleLowerCase("tr-TR") === requestedStaff.toLocaleLowerCase("tr-TR"))) {
        return NextResponse.json({ ok: false, error: "Secilen personel bu hizmet icin uygun degil." }, { status: 400 });
      }
      const occupied = await isStaffOccupiedAt(prisma, start, requestedStaff, tenantId);
      if (occupied) {
        return NextResponse.json({ ok: false, error: "Secilen personelin bu saatte baska randevusu var." }, { status: 409 });
      }
      assignedStaff = requestedStaff;
    } else {
      assignedStaff = await pickAvailableStaff(prisma, start, staffCandidates, tenantId);
      if (!assignedStaff) {
        return NextResponse.json({ ok: false, error: "Bu hizmet icin uygun personel bu saatte musait degil." }, { status: 409 });
      }
    }
  }
  const notesWithStaff = withAssignedStaffInNotes(notes, assignedStaff);

  let created: Awaited<ReturnType<typeof createAppointmentRecord>> | null = null;
  try {
    created = await prisma.$transaction(async (tx) =>
      createAppointmentRecord(tx, {
        tenantId,
        startAt: start,
        endAt: end,
        serviceName,
        clientName: body.clientName,
        clientEmail: body.clientEmail?.trim() || null,
        clientPhone: body.clientPhone?.trim() || null,
        notes: notesWithStaff,
        status: "pending",
      }),
    );
  } catch (e) {
    if (e instanceof AppointmentDuplicateError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu kişi için aynı saatte başka bir randevu/talep var. Farklı saat seçebilir veya mevcut randevunuzu güncelleyebilirsiniz.",
        },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentPendingSameDayServiceError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu kişi için aynı hizmette aynı gün zaten bekleyen bir randevu talebi var. Önce mevcut talebi güncelleyin veya sonuçlanmasını bekleyin.",
        },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentTooCloseOtherServiceError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu kişinin başka hizmette bekleyen/onaylı randevusu var. Yeni saat, mevcut randevudan en az 1 saat önce veya sonra olmalıdır.",
        },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentSlotOccupiedError) {
      return NextResponse.json(
        { ok: false, error: "Seçilen saat dolu. Lütfen takvimden başka saat seçin." },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "phone_required") {
      return NextResponse.json({ ok: false, error: "Telefon boş bırakılamaz." }, { status: 400 });
    }
    throw e;
  }

  if (!created) {
    return NextResponse.json({ ok: false, error: "Kayıt oluşturulamadı." }, { status: 500 });
  }

  // Operatör + admin bilgilendirmesi — ENV ve/veya Ayarlar’daki liste (MAIL_FROM gönderici; alıcı değildir).
  try {
    const settings = await getSiteSettings();
    const toList = appointmentInboundNotifyRecipients(settings);
    if (toList.length) {
      const when = created.startAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
      const subject = `Yeni randevu talebi — ${created.clientName}`;
      const notesLine = created.notes?.trim() ? [`Notlar:`, created.notes.trim(), ""].join("\n") : "";
      const text = [
        "Yeni randevu talebi alındı — panelden onaylamanız gerekiyor.",
        "",
        `Tarih/Saat: ${when}`,
        `Müşteri: ${created.clientName}`,
        `Telefon: ${created.clientPhone ?? "-"}`,
        `E-posta: ${created.clientEmail ?? "-"}`,
        `Hizmet: ${created.serviceName ?? "-"}`,
        "",
        notesLine,
        "Yönetim: /admin/appointments",
      ]
        .filter(Boolean)
        .join("\n");
      const results = await Promise.all(
        toList.map((to) =>
          sendTransactionalEmail({ to, subject, text, tenantId: created.tenantId }).then((r) => ({ to, r })),
        ),
      );
      const failed = results.filter((x) => !x.r.ok);
      if (failed.length) {
        console.warn(
          "appointment inbound notify failures",
          failed.map((x) => ({ to: x.to, error: x.r.ok ? null : x.r.error })),
        );
      }
    } else {
      console.warn(
        "Yeni randevu bildirimi atlandı: alıcı yok. ENV APPOINTMENT_NOTIFY_TO / APPOINTMENT_OPERATOR_NOTIFY_TO veya Ayarlar → Randevu bildirim e-postaları doldurun.",
      );
    }
  } catch (e) {
    console.warn("appointment inbound notify", e);
  }

  try {
    await notifyStaffPushNewAppointment(created);
  } catch (e) {
    console.warn("appointment push notify", e);
  }

  try {
    const settings = await getSiteSettings();
    const tg = await notifyTelegramNewAppointment(settings, created);
    if (!tg.ok && !tg.skipped) {
      console.warn("appointment telegram notify", tg.error);
    }
  } catch (e) {
    console.warn("appointment telegram notify", e);
  }

  return NextResponse.json({ ok: true });
}
