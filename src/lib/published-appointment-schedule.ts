import { blocksArraySchema } from "@/lib/blocks/schema";
import type { ContactFormContext } from "@/lib/contact-form-resolve";
import { DEFAULT_APPOINTMENT_TIMEZONE, mergeAppointmentDays } from "@/lib/appointment-schedule";
import type { PublishedAppointmentSchedule } from "@/lib/published-appointment-schedule.types";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsForTenant } from "@/lib/site-settings";
import { getTenantIdForRequest } from "@/lib/tenant-db";

export type { PublishedAppointmentSchedule } from "@/lib/published-appointment-schedule.types";

/** Müşteri / panel randevu formunun public `resolvePublishedContactFormBlock` çağrısı için konum */
export type PublishedAppointmentFormRef = {
  blockId: string;
  formContext: ContactFormContext;
  pageSlug: string | null;
};

function parseBlocksJson(raw: string | null | undefined): unknown {
  if (!raw?.trim()) return [];
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
}

function extractFromBlocksArray(raw: unknown): PublishedAppointmentSchedule | null {
  const parsed = blocksArraySchema.safeParse(raw);
  if (!parsed.success) return null;
  for (const block of parsed.data) {
    if (block.type !== "contactForm") continue;
    if (block.props.mode !== "appointment") continue;
    const p = block.props;
    return {
      appointmentDays: mergeAppointmentDays(p.appointmentDays),
      slotDurationMinutes: p.slotDurationMinutes ?? 60,
      appointmentTimeZone: p.appointmentTimeZone?.trim() || DEFAULT_APPOINTMENT_TIMEZONE,
    };
  }
  return null;
}

function findAppointmentFormBlockIdInArray(raw: unknown): string | null {
  const parsed = blocksArraySchema.safeParse(raw);
  if (!parsed.success) return null;
  for (const block of parsed.data) {
    if (block.type === "contactForm" && block.props.mode === "appointment") {
      return block.id;
    }
  }
  return null;
}

/**
 * İlk yayın randevu formu bloğunun id + bağlamı (müsait saat API’si ile aynı takvim).
 * Sıra: üst blok → alt blok → yayın sayfaları.
 */
export async function getFirstPublishedAppointmentFormRef(forTenantId?: string): Promise<PublishedAppointmentFormRef | null> {
  const tenantId = forTenantId ?? (await getTenantIdForRequest());
  const [pages, settings] = await Promise.all([
    prisma.page.findMany({
      where: { tenantId, published: true },
      select: { slug: true, blocks: true, blocksMobile: true },
    }),
    getSiteSettingsForTenant(tenantId).then((s) => ({
      headerBlocks: s.headerBlocks,
      footerBlocks: s.footerBlocks,
    })),
  ]);

  if (settings?.headerBlocks?.trim()) {
    const id = findAppointmentFormBlockIdInArray(parseBlocksJson(settings.headerBlocks));
    if (id) return { blockId: id, formContext: "header", pageSlug: null };
  }
  if (settings?.footerBlocks?.trim()) {
    const id = findAppointmentFormBlockIdInArray(parseBlocksJson(settings.footerBlocks));
    if (id) return { blockId: id, formContext: "footer", pageSlug: null };
  }

  for (const p of pages) {
    for (const key of ["blocks", "blocksMobile"] as const) {
      const raw = key === "blocksMobile" ? p.blocksMobile : p.blocks;
      const id = findAppointmentFormBlockIdInArray(parseBlocksJson(raw ?? undefined));
      if (id) return { blockId: id, formContext: "page", pageSlug: p.slug };
    }
  }

  return null;
}

/**
 * Yayında sayfa veya site üst/alt bloklarında ilk «randevu» contactForm ayarlarını bulur.
 * Yoksa null — çağıran varsayılan takvimi kullanır.
 */
export async function getFirstPublishedAppointmentSchedule(forTenantId?: string): Promise<PublishedAppointmentSchedule | null> {
  const tenantId = forTenantId ?? (await getTenantIdForRequest());
  const [pages, settings] = await Promise.all([
    prisma.page.findMany({
      where: { tenantId, published: true },
      select: { blocks: true, blocksMobile: true },
    }),
    getSiteSettingsForTenant(tenantId).then((s) => ({
      headerBlocks: s.headerBlocks,
      footerBlocks: s.footerBlocks,
    })),
  ]);

  for (const region of [settings?.headerBlocks, settings?.footerBlocks]) {
    const hit = extractFromBlocksArray(parseBlocksJson(region ?? undefined));
    if (hit) return hit;
  }

  for (const p of pages) {
    for (const key of ["blocks", "blocksMobile"] as const) {
      const raw = key === "blocksMobile" ? p.blocksMobile : p.blocks;
      const hit = extractFromBlocksArray(parseBlocksJson(raw ?? undefined));
      if (hit) return hit;
    }
  }

  return null;
}
