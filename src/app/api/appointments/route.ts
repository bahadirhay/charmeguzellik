import { NextResponse } from "next/server";
import { z } from "zod";
import {
  mergeAppointmentDays,
  validatePreferredStartAgainstSchedule,
} from "@/lib/appointment-schedule";
import { resolvePublishedContactFormBlock, type ContactFormContext } from "@/lib/contact-form-resolve";
import { createAppointmentRecord, AppointmentDuplicateError } from "@/lib/create-appointment-record";
import { insertPrimaryCalendarEvent, refreshGoogleAccessToken } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import {
  APPOINTMENT_PHONE_INPUT_MAX_LENGTH,
  appointmentPhoneTurkeyHint,
  isValidTurkeyMobileAppointmentPhone,
} from "@/lib/appointment-phone";

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
  durationMinutes: z.coerce.number().int().min(15).max(240).optional(),
  /** Honeypot — doldurulursa bot */
  website: z.string().max(200).optional(),
  formContext: z.enum(["page", "header", "footer"]).optional(),
  pageSlug: z.string().max(200).optional().nullable(),
  blockId: z.string().max(80).optional(),
});

export async function POST(req: Request) {
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
  if (body.clientEmail?.trim()) notesParts.unshift(`E-posta: ${body.clientEmail.trim()}`);
  if (body.clientPhone?.trim()) notesParts.unshift(`Telefon: ${body.clientPhone.trim()}`);
  const notes = notesParts.length ? notesParts.join("\n") : null;

  let row;
  try {
    row = await prisma.$transaction(async (tx) =>
      createAppointmentRecord(tx, {
        startAt: start,
        endAt: end,
        serviceName,
        clientName: body.clientName,
        clientEmail: body.clientEmail?.trim() || null,
        clientPhone: body.clientPhone?.trim() || null,
        notes,
        status: "pending",
      }),
    );
  } catch (e) {
    if (e instanceof AppointmentDuplicateError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu ad veya telefon numarasıyla aynı hizmet ve saat için zaten bir randevu talebiniz var. Talebinizi kontrol edin veya farklı bir saat seçin.",
        },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "phone_required") {
      return NextResponse.json({ ok: false, error: "Telefon boş bırakılamaz." }, { status: 400 });
    }
    throw e;
  }

  let googleEventId: string | null = null;
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    const cid = settings?.googleCalendarClientId?.trim();
    const sec = settings?.googleCalendarSecret?.trim();
    const rt = settings?.googleRefreshToken?.trim();
    if (cid && sec && rt) {
      const access = await refreshGoogleAccessToken({
        clientId: cid,
        clientSecret: sec,
        refreshToken: rt,
      });
      if (access) {
        const summary = serviceName
          ? `Randevu: ${serviceName} — ${row.clientName}`
          : `Randevu — ${row.clientName}`;
        const description = [notes, `Kayıt id: ${row.id}`].filter(Boolean).join("\n\n");
        googleEventId = await insertPrimaryCalendarEvent(access, {
          summary,
          description: description || undefined,
          start,
          end,
        });
        if (googleEventId) {
          await prisma.appointment.update({
            where: { id: row.id },
            data: { googleEventId },
          });
        }
      }
    }
  } catch (e) {
    console.warn("appointment calendar sync", e);
  }

  return NextResponse.json({
    ok: true,
    calendarSynced: Boolean(googleEventId),
  });
}
