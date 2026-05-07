import type { Prisma, PrismaClient } from "@prisma/client";

/** Türkiye odaklı: rakamlar; 0 ile veya 5 ile başlayan 10 hane → 90… */
export function normalizePhoneKey(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.startsWith("90") && d.length >= 12) return d.slice(0, 12);
  if (d.length === 11 && d.startsWith("0") && d[1] === "5") d = `90${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith("5")) d = `90${d}`;
  if (d.startsWith("90") && d.length >= 12) return d.slice(0, 12);
  return d.length >= 10 ? d : null;
}

export function normalizeClientNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("tr-TR");
}

export async function appointmentDuplicateExists(
  db: Pick<PrismaClient | Prisma.TransactionClient, "appointment">,
  params: {
    startAt: Date;
    serviceName: string | null;
    nameKey: string;
    phoneKey: string | null;
    /** Güncellemede aynı kaydı hariç tut */
    excludeAppointmentId?: string;
  },
): Promise<boolean> {
  const rows = await db.appointment.findMany({
    where: {
      startAt: params.startAt,
      serviceName: params.serviceName,
      status: { in: ["pending", "approved"] },
      ...(params.excludeAppointmentId
        ? { NOT: { id: params.excludeAppointmentId } }
        : {}),
    },
    select: {
      clientName: true,
      clientPhone: true,
      clientNameKey: true,
      clientPhoneKey: true,
    },
  });
  return rows.some((a) => {
    const nk = a.clientNameKey ?? normalizeClientNameKey(a.clientName);
    const pk = a.clientPhoneKey ?? normalizePhoneKey(a.clientPhone);
    if (nk === params.nameKey) return true;
    if (params.phoneKey && pk && pk === params.phoneKey) return true;
    return false;
  });
}

function istanbulYmd(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Aynı kişi için çakışma kuralları:
 * 1) Aynı saat (hizmetten bağımsız) -> engel
 * Not: yalnızca aktif/işlemdeki kayıtlar (pending/approved/cancel_request) dikkate alınır.
 */
export async function appointmentConflictExists(
  db: Pick<PrismaClient | Prisma.TransactionClient, "appointment">,
  params: {
    startAt: Date;
    serviceName: string | null;
    nameKey: string;
    phoneKey: string | null;
    excludeAppointmentId?: string;
  },
): Promise<boolean> {
  const rows = await db.appointment.findMany({
    where: {
      status: { in: ["pending", "approved", "cancel_request"] },
      ...(params.excludeAppointmentId ? { NOT: { id: params.excludeAppointmentId } } : {}),
      OR: [
        { clientNameKey: params.nameKey },
        ...(params.phoneKey ? [{ clientPhoneKey: params.phoneKey }] : []),
      ],
    },
    select: {
      startAt: true,
      serviceName: true,
      clientName: true,
      clientPhone: true,
      clientNameKey: true,
      clientPhoneKey: true,
    },
  });

  const targetStartMs = params.startAt.getTime();

  return rows.some((a) => {
    const nk = a.clientNameKey ?? normalizeClientNameKey(a.clientName);
    const pk = a.clientPhoneKey ?? normalizePhoneKey(a.clientPhone);
    const samePerson = nk === params.nameKey || (params.phoneKey && pk && pk === params.phoneKey);
    if (!samePerson) return false;

    const sameTime = a.startAt.getTime() === targetStartMs;
    return sameTime;
  });
}

/**
 * Aynı kişi + aynı hizmet + aynı gün için bekleyen talep var mı?
 * Yalnızca status=pending satırları dikkate alınır.
 */
export async function pendingSameDaySameServiceExists(
  db: Pick<PrismaClient | Prisma.TransactionClient, "appointment">,
  params: {
    startAt: Date;
    serviceName: string | null;
    nameKey: string;
    phoneKey: string | null;
    excludeAppointmentId?: string;
  },
): Promise<boolean> {
  const svc = params.serviceName?.trim().toLocaleLowerCase("tr-TR") || null;
  if (!svc) return false;

  const rows = await db.appointment.findMany({
    where: {
      status: "pending",
      ...(params.excludeAppointmentId ? { NOT: { id: params.excludeAppointmentId } } : {}),
      OR: [{ clientNameKey: params.nameKey }, ...(params.phoneKey ? [{ clientPhoneKey: params.phoneKey }] : [])],
    },
    select: {
      startAt: true,
      serviceName: true,
      clientName: true,
      clientPhone: true,
      clientNameKey: true,
      clientPhoneKey: true,
    },
  });

  const targetDay = istanbulYmd(params.startAt);
  return rows.some((a) => {
    const nk = a.clientNameKey ?? normalizeClientNameKey(a.clientName);
    const pk = a.clientPhoneKey ?? normalizePhoneKey(a.clientPhone);
    const samePerson = nk === params.nameKey || (params.phoneKey && pk && pk === params.phoneKey);
    if (!samePerson) return false;
    const service = a.serviceName?.trim().toLocaleLowerCase("tr-TR") || null;
    if (service !== svc) return false;
    return istanbulYmd(a.startAt) === targetDay;
  });
}

/**
 * Aynı kişi için farklı hizmette aktif (pending/approved) bir kayda 1 saatten yakınsa engeller.
 * Kural: en az 60 dk önce/sonra seçilirse izin verilir.
 */
export async function withinOneHourOtherServiceExists(
  db: Pick<PrismaClient | Prisma.TransactionClient, "appointment">,
  params: {
    startAt: Date;
    serviceName: string | null;
    nameKey: string;
    phoneKey: string | null;
    excludeAppointmentId?: string;
  },
): Promise<boolean> {
  const targetService = params.serviceName?.trim().toLocaleLowerCase("tr-TR") || null;
  const rows = await db.appointment.findMany({
    where: {
      status: { in: ["pending", "approved"] },
      ...(params.excludeAppointmentId ? { NOT: { id: params.excludeAppointmentId } } : {}),
      OR: [{ clientNameKey: params.nameKey }, ...(params.phoneKey ? [{ clientPhoneKey: params.phoneKey }] : [])],
    },
    select: {
      startAt: true,
      serviceName: true,
      clientName: true,
      clientPhone: true,
      clientNameKey: true,
      clientPhoneKey: true,
    },
  });

  const targetMs = params.startAt.getTime();
  return rows.some((a) => {
    const nk = a.clientNameKey ?? normalizeClientNameKey(a.clientName);
    const pk = a.clientPhoneKey ?? normalizePhoneKey(a.clientPhone);
    const samePerson = nk === params.nameKey || (params.phoneKey && pk && pk === params.phoneKey);
    if (!samePerson) return false;
    const existingService = a.serviceName?.trim().toLocaleLowerCase("tr-TR") || null;
    if (!targetService || !existingService || targetService === existingService) return false;
    const diffMs = Math.abs(a.startAt.getTime() - targetMs);
    return diffMs < 60 * 60 * 1000;
  });
}

/**
 * Slot doluluk kontrolü: aynı başlangıç saatinde aktif başka randevu var mı?
 */
export async function slotOccupiedExists(
  db: Pick<PrismaClient | Prisma.TransactionClient, "appointment">,
  params: { startAt: Date; excludeAppointmentId?: string },
): Promise<boolean> {
  const count = await db.appointment.count({
    where: {
      startAt: params.startAt,
      status: { in: ["pending", "approved", "cancel_request"] },
      ...(params.excludeAppointmentId ? { NOT: { id: params.excludeAppointmentId } } : {}),
    },
  });
  return count > 0;
}

export async function upsertCrmContactForAppointment(
  db: Pick<PrismaClient | Prisma.TransactionClient, "crmContact">,
  opts: { phoneKey: string; name: string; email: string | null },
) {
  return db.crmContact.upsert({
    where: { phoneKey: opts.phoneKey },
    create: {
      phoneKey: opts.phoneKey,
      name: opts.name,
      email: opts.email,
    },
    update: {
      name: opts.name,
      ...(opts.email ? { email: opts.email } : {}),
    },
  });
}
