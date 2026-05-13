import type { PrismaClient } from "@prisma/client";
import {
  appointmentStaffLabelsEqual,
  parseAssignedStaffFromNotes,
  parseRawAppointmentStaffByService,
  reassignAssignedStaffInNotes,
} from "@/lib/appointment-staffing";
import { parseThemeTokens, themeTokensToJson } from "@/lib/theme-tokens";

export type StaffTransferImpact = {
  appointmentNotes: number;
  themeServiceEntries: number;
  commissionAccruals: number;
  cashReceipts: number;
  cashDayCloses: number;
};

function staffPrimaryLabel(u: { displayName: string | null; username: string }): string {
  return u.displayName?.trim() || u.username;
}

function replaceStaffTokensInRawMap(
  raw: Record<string, string[]>,
  fromId: string,
  fromLabels: string[],
  toId: string,
): Record<string, string[]> {
  const fromNorm = new Set(
    fromLabels.map((s) => s.trim().toLocaleLowerCase("tr-TR")).filter((s) => s.length > 0),
  );
  const mapOne = (tid: string): string => {
    const t = tid.trim();
    if (!t) return t;
    if (t === fromId) return toId;
    if (fromNorm.has(t.toLocaleLowerCase("tr-TR"))) return toId;
    return t;
  };
  const out: Record<string, string[]> = {};
  for (const [svc, arr] of Object.entries(raw)) {
    if (!svc.trim() || !Array.isArray(arr)) continue;
    const mapped = arr.map(mapOne).map((x) => x.trim()).filter(Boolean);
    const uniq = Array.from(new Set(mapped));
    if (uniq.length) out[svc.trim()] = uniq;
  }
  return out;
}

export async function computeStaffTransferImpact(
  db: Pick<
    PrismaClient,
    "staffUser" | "appointment" | "commerceCommissionAccrual" | "commerceCashReceipt" | "commerceCashDayClose" | "siteSettings"
  >,
  tenantId: string,
  fromUserId: string,
): Promise<{ fromLabel: string; impact: StaffTransferImpact } | null> {
  const from = await db.staffUser.findFirst({
    where: { id: fromUserId, tenantId },
    select: { id: true, username: true, displayName: true },
  });
  if (!from) return null;
  const fromLabel = staffPrimaryLabel(from);
  const fromLabels = [from.displayName?.trim(), from.username].filter(Boolean) as string[];

  const settings = await db.siteSettings.findUnique({ where: { tenantId } });
  const rawMap = parseRawAppointmentStaffByService(settings?.themeTokensJson);
  let themeHits = 0;
  for (const arr of Object.values(rawMap)) {
    for (const t of arr) {
      const tid = t.trim();
      if (!tid) continue;
      if (tid === from.id) {
        themeHits += 1;
        continue;
      }
      if (fromLabels.some((l) => appointmentStaffLabelsEqual(l, tid))) themeHits += 1;
    }
  }

  const apptCandidates = await db.appointment.findMany({
    where: { tenantId, notes: { contains: "[[STAFF:" } },
    select: { id: true, notes: true },
  });
  let appointmentNotes = 0;
  for (const a of apptCandidates) {
    const assigned = parseAssignedStaffFromNotes(a.notes);
    if (assigned && fromLabels.some((l) => appointmentStaffLabelsEqual(l, assigned))) appointmentNotes += 1;
  }

  const [commissionAccruals, cashReceipts, cashDayCloses] = await Promise.all([
    db.commerceCommissionAccrual.count({ where: { tenantId, staffUserId: fromUserId } }),
    db.commerceCashReceipt.count({ where: { tenantId, staffUserId: fromUserId } }),
    db.commerceCashDayClose.count({ where: { tenantId, staffUserId: fromUserId } }),
  ]);

  return {
    fromLabel,
    impact: {
      appointmentNotes,
      themeServiceEntries: themeHits,
      commissionAccruals,
      cashReceipts,
      cashDayCloses,
    },
  };
}

/**
 * `transferToStaffUserId` yalnızca silinecek kullanıcıya bağlı kayıt varsa zorunludur.
 * Referans yoksa doğrudan silinir.
 */
export async function transferStaffReferencesAndDeleteUser(
  db: PrismaClient,
  tenantId: string,
  fromUserId: string,
  transferToStaffUserId: string | null | undefined,
  options: { actorStaffUserId: string | undefined },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (options.actorStaffUserId && options.actorStaffUserId === fromUserId) {
    return { ok: false, error: "Oturumunuzdaki kullanıcıyı bu işlemle silemezsiniz.", status: 400 };
  }

  const from = await db.staffUser.findFirst({
    where: { id: fromUserId, tenantId },
    select: { id: true, username: true, displayName: true },
  });
  if (!from) return { ok: false, error: "Silinecek kullanıcı bulunamadı.", status: 404 };

  const impact = await computeStaffTransferImpact(db, tenantId, fromUserId);
  if (!impact) return { ok: false, error: "Silinecek kullanıcı bulunamadı.", status: 404 };

  const fromLabel = impact.fromLabel;
  const fromLabels = [from.displayName?.trim(), from.username].filter(Boolean) as string[];

  const totalRefs =
    impact.impact.appointmentNotes +
    impact.impact.themeServiceEntries +
    impact.impact.commissionAccruals +
    impact.impact.cashReceipts +
    impact.impact.cashDayCloses;

  if (totalRefs === 0) {
    try {
      await db.$transaction(async (tx) => {
        await tx.staffPushSubscription.deleteMany({ where: { staffId: fromUserId } });
        await tx.staffUser.delete({ where: { id: fromUserId } });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Silinemedi";
      return { ok: false, error: msg, status: 500 };
    }
    return { ok: true };
  }

  const toId = transferToStaffUserId?.trim() ?? "";
  if (!toId) {
    return {
      ok: false,
      error: "Bu kullanıcıya bağlı randevu, personel planlama veya kasa kaydı var. Silmeden önce verileri aktaracağınız hedef personeli seçin.",
      status: 400,
    };
  }
  if (fromUserId === toId) {
    return { ok: false, error: "Kaynak ve hedef aynı kullanıcı olamaz.", status: 400 };
  }

  const to = await db.staffUser.findFirst({
    where: { id: toId, tenantId, active: true },
    select: { id: true, username: true, displayName: true },
  });
  if (!to) return { ok: false, error: "Hedef kullanıcı bulunamadı veya pasif.", status: 400 };

  const toLabel = to.displayName?.trim();
  if (!toLabel) {
    return {
      ok: false,
      error: "Hedef personelde «Görünen ad» zorunludur (randevu atamaları bu adla güncellenir).",
      status: 400,
    };
  }

  try {
    await db.$transaction(async (tx) => {
      const settings = await tx.siteSettings.findUnique({ where: { tenantId } });
      if (settings?.themeTokensJson) {
        const raw = parseRawAppointmentStaffByService(settings.themeTokensJson);
        const nextRaw = replaceStaffTokensInRawMap(raw, from.id, fromLabels, to.id);
        const tokens = parseThemeTokens(settings.themeTokensJson);
        const nextJson = themeTokensToJson({ ...tokens, appointmentStaffByService: nextRaw });
        if (nextJson !== settings.themeTokensJson) {
          await tx.siteSettings.update({
            where: { id: settings.id },
            data: { themeTokensJson: nextJson },
          });
        }
      }

      const apptCandidates = await tx.appointment.findMany({
        where: { tenantId, notes: { contains: "[[STAFF:" } },
        select: { id: true, notes: true },
      });
      for (const a of apptCandidates) {
        const assigned = parseAssignedStaffFromNotes(a.notes);
        if (!assigned || !fromLabels.some((l) => appointmentStaffLabelsEqual(l, assigned))) continue;
        const nextNotes = reassignAssignedStaffInNotes(a.notes, fromLabel, toLabel);
        if (nextNotes !== a.notes) {
          await tx.appointment.update({ where: { id: a.id }, data: { notes: nextNotes } });
        }
      }

      await tx.commerceCommissionAccrual.updateMany({
        where: { tenantId, staffUserId: fromUserId },
        data: { staffUserId: toId },
      });
      await tx.commerceCashReceipt.updateMany({
        where: { tenantId, staffUserId: fromUserId },
        data: { staffUserId: toId },
      });
      await tx.commerceCashDayClose.updateMany({
        where: { tenantId, staffUserId: fromUserId },
        data: { staffUserId: toId },
      });

      await tx.staffPushSubscription.deleteMany({ where: { staffId: fromUserId } });
      await tx.staffUser.delete({ where: { id: fromUserId } });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "İşlem başarısız";
    return { ok: false, error: msg, status: 500 };
  }

  return { ok: true };
}
