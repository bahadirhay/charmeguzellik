import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

/** DB `Tenant.moduleUnlockHashes` — yalnızca bcrypt hash saklanır; düz metin asla yazılmaz. */
export type TenantModuleUnlockHashes = {
  commerce?: string;
  appointments?: string;
};

export function parseModuleUnlockHashes(v: Prisma.JsonValue | null | undefined): TenantModuleUnlockHashes {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const out: TenantModuleUnlockHashes = {};
  if (typeof o.commerce === "string" && o.commerce.length > 10) out.commerce = o.commerce;
  if (typeof o.appointments === "string" && o.appointments.length > 10) out.appointments = o.appointments;
  return out;
}

export function moduleUnlockConfigured(h: TenantModuleUnlockHashes, key: keyof TenantModuleUnlockHashes): boolean {
  return Boolean(h[key]);
}

export function generateModuleUnlockPlain(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashModuleUnlockPlain(plain: string): Promise<string> {
  return bcrypt.hash(plain.trim(), 12);
}

export async function verifyModuleUnlockPlain(plain: string | undefined, hash: string | undefined): Promise<boolean> {
  if (!plain?.trim() || !hash) return false;
  return bcrypt.compare(plain.trim(), hash);
}

/** Eksik modül hash’lerini üretir; yalnız yeni oluşturulan düz anahtarları döner (bir kez kopyalanmalı). */
export async function ensureTenantModuleUnlockKeys(
  prisma: Pick<PrismaClient, "tenant">,
  tenantId: string,
): Promise<Partial<Record<keyof TenantModuleUnlockHashes, string>>> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { moduleUnlockHashes: true },
  });
  const existing = parseModuleUnlockHashes(row?.moduleUnlockHashes);
  const plainOut: Partial<Record<keyof TenantModuleUnlockHashes, string>> = {};
  const next: TenantModuleUnlockHashes = { ...existing };

  if (!existing.commerce) {
    const p = generateModuleUnlockPlain();
    next.commerce = await hashModuleUnlockPlain(p);
    plainOut.commerce = p;
  }
  if (!existing.appointments) {
    const p = generateModuleUnlockPlain();
    next.appointments = await hashModuleUnlockPlain(p);
    plainOut.appointments = p;
  }

  if (Object.keys(plainOut).length === 0) return {};
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { moduleUnlockHashes: next as Prisma.InputJsonValue },
  });
  return plainOut;
}
