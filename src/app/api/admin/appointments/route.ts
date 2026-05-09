import { NextResponse } from "next/server";
import {
  createAppointmentRecord,
  AppointmentDuplicateError,
  AppointmentPendingSameDayServiceError,
  AppointmentSlotOccupiedError,
  AppointmentTooCloseOtherServiceError,
} from "@/lib/create-appointment-record";
import { prisma } from "@/lib/prisma";
import { filterAppointmentsForSelfScope } from "@/lib/appointment-panel-access";
import { requireStaffApiAppointments } from "@/lib/admin-api-auth";
import { appointmentPhoneTurkeyHint, isValidTurkeyMobileAppointmentPhone } from "@/lib/appointment-phone";
import { notifyTelegramNewAppointment } from "@/lib/appointment-telegram-notify";
import {
  eligibleStaffForService,
  isStaffOccupiedAt,
  parseAssignedStaffFromNotes,
  pickAvailableStaff,
  resolveServiceStaffMap,
  withAssignedStaffInNotes,
} from "@/lib/appointment-staffing";
import { getSiteSettingsForTenant } from "@/lib/site-settings";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export async function GET() {
  const auth = await requireStaffApiAppointments();
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest();
  const list = await prisma.appointment.findMany({
    where: { tenantId },
    orderBy: { startAt: "desc" },
  });
  if (auth.appointmentScope === "self") {
    return NextResponse.json(filterAppointmentsForSelfScope(list, auth.selfStaffLabel));
  }
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const auth = await requireStaffApiAppointments();
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantIdForRequest(req);
  const body = (await req.json()) as {
    startAt: string;
    endAt?: string | null;
    serviceName?: string | null;
    clientName: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    notes?: string | null;
    staffName?: string | null;
  };
  if (!body.clientName?.trim() || !body.startAt) {
    return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
  }
  const phone = body.clientPhone?.trim() ?? "";
  if (!phone) {
    return NextResponse.json({ error: "Telefon boş bırakılamaz." }, { status: 400 });
  }
  if (!isValidTurkeyMobileAppointmentPhone(phone)) {
    return NextResponse.json({ error: appointmentPhoneTurkeyHint() }, { status: 400 });
  }
  let row;
  try {
    const startAt = new Date(body.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Geçersiz başlangıç tarihi" }, { status: 400 });
    }
    const serviceName = body.serviceName?.trim() || null;
    const settings = await getSiteSettingsForTenant(tenantId);
    const staffMap = await resolveServiceStaffMap(prisma, settings.themeTokensJson, tenantId);
    const staffCandidates = eligibleStaffForService(serviceName, staffMap);
    const requestedStaff = body.staffName?.trim() || "";
    const selfLabel = auth.appointmentScope === "self" ? auth.selfStaffLabel?.trim() ?? "" : "";
    if (auth.appointmentScope === "self" && !selfLabel) {
      return NextResponse.json(
        { error: "Hesabınızda görünen ad tanımlı değil. Yönetici: Personel → Görünen ad." },
        { status: 403 },
      );
    }

    let assignedStaff: string | null = null;
    if (auth.appointmentScope === "self") {
      if (requestedStaff && requestedStaff.toLocaleLowerCase("tr-TR") !== selfLabel.toLocaleLowerCase("tr-TR")) {
        return NextResponse.json({ error: "Yalnızca kendi adınıza randevu ekleyebilirsiniz." }, { status: 403 });
      }
      const selfMatch = staffCandidates.find((s) => s.toLocaleLowerCase("tr-TR") === selfLabel.toLocaleLowerCase("tr-TR"));
      if (!selfMatch) {
        return NextResponse.json({ error: "Bu hizmet için hesabınızın personel yetkisi yok." }, { status: 403 });
      }
      const occupied = await isStaffOccupiedAt(prisma, startAt, selfLabel, tenantId);
      if (occupied) return NextResponse.json({ error: "Secilen personel bu saatte musait degil." }, { status: 409 });
      assignedStaff = selfMatch;
    } else if (staffCandidates.length > 0) {
      if (requestedStaff) {
        if (!staffCandidates.some((s) => s.toLocaleLowerCase("tr-TR") === requestedStaff.toLocaleLowerCase("tr-TR"))) {
          return NextResponse.json({ error: "Secilen personel bu hizmet icin uygun degil." }, { status: 400 });
        }
        const occupied = await isStaffOccupiedAt(prisma, startAt, requestedStaff, tenantId);
        if (occupied) return NextResponse.json({ error: "Secilen personel bu saatte musait degil." }, { status: 409 });
        assignedStaff = requestedStaff;
      } else {
        assignedStaff = await pickAvailableStaff(prisma, startAt, staffCandidates, tenantId);
        if (!assignedStaff) return NextResponse.json({ error: "Bu hizmet icin musait personel yok." }, { status: 409 });
      }
    }
    const notesWithStaff = withAssignedStaffInNotes(body.notes?.trim() || null, assignedStaff);
    row = await prisma.$transaction(async (tx) =>
      createAppointmentRecord(tx, {
        tenantId,
        startAt,
        endAt: body.endAt ? new Date(body.endAt) : null,
        serviceName,
        clientName: body.clientName,
        clientEmail: body.clientEmail?.trim() || null,
        clientPhone: phone,
        notes: notesWithStaff,
        status: "pending",
      }),
    );
  } catch (e) {
    if (e instanceof AppointmentDuplicateError) {
      return NextResponse.json(
        {
          error:
            "Aynı kişi için aynı saatte başka aktif kayıt var.",
        },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentPendingSameDayServiceError) {
      return NextResponse.json(
        {
          error:
            "Aynı kişi için aynı hizmette aynı gün zaten bekleyen talep var.",
        },
        { status: 409 },
      );
    }
    if (e instanceof AppointmentTooCloseOtherServiceError) {
      return NextResponse.json(
        {
          error:
            "Aynı kişide başka hizmette bekleyen/onaylı randevu var. Yeni saat mevcut randevudan en az 1 saat önce veya sonra olmalı.",
        },
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
  try {
    const settings = await getSiteSettingsForTenant(tenantId);
    const tg = await notifyTelegramNewAppointment(settings, row, {
      source: "admin",
      createdBy: auth.username,
      assignedStaff: parseAssignedStaffFromNotes(row.notes),
    });
    if (!tg.ok && !tg.skipped) {
      console.warn("admin appointment telegram notify", tg.error);
    }
  } catch (e) {
    console.warn("admin appointment telegram notify", e);
  }
  return NextResponse.json(row);
}
