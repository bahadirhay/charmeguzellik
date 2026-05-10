import { NextResponse } from "next/server";
import type { ContactFormContext } from "@/lib/contact-form-resolve";
import { resolvePublishedContactFormBlock } from "@/lib/contact-form-resolve";
import {
  mergeAppointmentDays,
  naiveLocalToAppointmentIso,
  slotStartLabelsForCalendarDate,
} from "@/lib/appointment-schedule";
import { isStaffOccupiedAt } from "@/lib/appointment-staffing";
import { prisma } from "@/lib/prisma";
import { denyIfAppointmentsDisabled } from "@/lib/appointments-module-guard";
import { getTenantIdForRequest } from "@/lib/tenant-db";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Müşteri formu: seçilen personel için o gün müsait saat etiketleri (HH:mm). */
export async function GET(req: Request) {
  const apptForbidden = await denyIfAppointmentsDisabled(req);
  if (apptForbidden) return apptForbidden;
  const tenantId = await getTenantIdForRequest(req);
  const { searchParams } = new URL(req.url);
  const dateYmd = searchParams.get("date") ?? "";
  const staffName = searchParams.get("staff")?.trim() ?? "";
  const blockId = searchParams.get("blockId") ?? "";
  const pageSlug = searchParams.get("pageSlug")?.trim() || null;
  const formContextRaw = searchParams.get("formContext") ?? "page";
  const formContext = (
    formContextRaw === "header" || formContextRaw === "footer" || formContextRaw === "page"
      ? formContextRaw
      : "page"
  ) as ContactFormContext;

  if (!DATE_RE.test(dateYmd)) {
    return NextResponse.json({ ok: false, error: "Geçersiz tarih." }, { status: 400 });
  }
  if (!blockId.trim()) {
    return NextResponse.json({ ok: false, error: "blockId gerekli." }, { status: 400 });
  }
  if (formContext === "page" && !pageSlug?.trim()) {
    return NextResponse.json({ ok: false, error: "pageSlug gerekli." }, { status: 400 });
  }

  const formBlock = await resolvePublishedContactFormBlock(formContext, pageSlug, blockId);
  if (!formBlock || formBlock.props.mode !== "appointment") {
    return NextResponse.json({ ok: false, error: "Randevu formu bulunamadı." }, { status: 400 });
  }

  const scheduleDays = mergeAppointmentDays(formBlock.props.appointmentDays);
  const slotDur = formBlock.props.slotDurationMinutes ?? 60;
  const tz = formBlock.props.appointmentTimeZone?.trim() || "Europe/Istanbul";

  const labels = slotStartLabelsForCalendarDate(dateYmd, scheduleDays, slotDur, tz);
  if (!staffName) {
    return NextResponse.json({ ok: true, slots: labels });
  }

  const free: string[] = [];
  for (const hm of labels) {
    const start = new Date(naiveLocalToAppointmentIso(dateYmd, hm, tz));
    if (Number.isNaN(start.getTime())) continue;
    const occupied = await isStaffOccupiedAt(prisma, start, staffName, tenantId);
    if (!occupied) free.push(hm);
  }

  return NextResponse.json({ ok: true, slots: free });
}
