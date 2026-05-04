import { blocksArraySchema } from "@/lib/blocks/schema";
import { DEFAULT_APPOINTMENT_TIMEZONE, mergeAppointmentDays } from "@/lib/appointment-schedule";
import type { PublishedAppointmentSchedule } from "@/lib/published-appointment-schedule.types";
import { prisma } from "@/lib/prisma";

export type { PublishedAppointmentSchedule } from "@/lib/published-appointment-schedule.types";

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

/**
 * Yayında sayfa veya site üst/alt bloklarında ilk «randevu» contactForm ayarlarını bulur.
 * Yoksa null — çağıran varsayılan takvimi kullanır.
 */
export async function getFirstPublishedAppointmentSchedule(): Promise<PublishedAppointmentSchedule | null> {
  const [pages, settings] = await Promise.all([
    prisma.page.findMany({
      where: { published: true },
      select: { blocks: true, blocksMobile: true },
    }),
    prisma.siteSettings.findUnique({
      where: { id: 1 },
      select: { headerBlocks: true, footerBlocks: true },
    }),
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
