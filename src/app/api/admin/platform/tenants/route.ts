import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import { denyUnlessPlatformProvisioner } from "@/lib/platform-provision-auth";
import { platformControlTenantId } from "@/lib/platform-control-tenant";
import { ProvisionConflictError, provisionTenant } from "@/lib/provision-tenant";
import { isAppointmentsModuleEnabled, isCommerceModuleEnabled } from "@/lib/tenant-features";
import { moduleUnlockConfigured, parseModuleUnlockHashes } from "@/lib/tenant-module-unlock";

const postSchema = z.object({
  slug: z.string().min(2).max(64),
  name: z.string().min(1).max(120),
  host: z.string().min(3).max(253),
  cloneContent: z.boolean().optional().default(true),
  /** Varsayılan true; false ise randevu modülü kapalı kiracı */
  appointmentsEnabled: z.boolean().optional().default(true),
  /** Varsayılan true; false ise ticaret modülü kapalı kiracı */
  commerceEnabled: z.boolean().optional().default(true),
  adminUsername: z.string().max(64).optional(),
  /** Boş ise panel kullanıcısı oluşturulmaz. En az 8 karakter. */
  adminPassword: z.string().min(8).optional(),
});

export async function GET(_req: Request) {
  const denied = await denyUnlessPlatformProvisioner(_req);
  if (denied) return denied;
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      domains: { select: { host: true, isPrimary: true } },
      _count: { select: { pages: true } },
    },
  });

  const platformId = platformControlTenantId();
  return NextResponse.json({
    tenants: tenants.map((t) => {
      const hashes = parseModuleUnlockHashes(t.moduleUnlockHashes);
      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        isPlatformTenant: platformId !== null && t.id === platformId,
        appointmentsEnabled: isAppointmentsModuleEnabled(t.featuresJson),
        commerceEnabled: isCommerceModuleEnabled(t.featuresJson),
        appointmentsKeyProvisioned: moduleUnlockConfigured(hashes, "appointments"),
        commerceKeyProvisioned: moduleUnlockConfigured(hashes, "commerce"),
        pageCount: t._count.pages,
        hosts: t.domains.map((d) => ({ host: d.host, primary: d.isPrimary })),
      };
    }),
    platformTenantId: platformId,
  });
}

export async function POST(req: Request) {
  const denied = await denyUnlessPlatformProvisioner(req);
  if (denied) return denied;
  const auth = await requireStaffApiPerm("users.manage");
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek", details: parsed.error.flatten() }, { status: 400 });
  }

  const platformId = platformControlTenantId();
  const plat = platformId
    ? await prisma.tenant.findUnique({ where: { id: platformId }, select: { slug: true } })
    : null;

  const d = parsed.data;
  const bootstrap =
    d.adminPassword && d.adminPassword.length >= 8
      ? { username: d.adminUsername?.trim() || "admin", passwordPlain: d.adminPassword }
      : undefined;

  try {
    const r = await provisionTenant(
      prisma,
      {
        slug: d.slug,
        name: d.name,
        host: d.host,
        cloneContent: d.cloneContent ?? true,
        appointmentsEnabled: d.appointmentsEnabled,
        commerceEnabled: d.commerceEnabled,
        bootstrapAdmin: bootstrap,
      },
      { forbidSlugs: plat?.slug ? [plat.slug] : [] },
    );

    const adminBootstrapNote = bootstrap
      ? `Panel giriş: kullanıcı adı="${bootstrap.username}" (aynı kiracının alan adından giriş).`
      : undefined;

    return NextResponse.json({
      ok: true,
      tenantId: r.tenantId,
      slug: r.slug,
      host: r.host,
      adminBootstrapNote,
      ...(r.moduleUnlockTokens && Object.keys(r.moduleUnlockTokens).length > 0
        ? {
            moduleUnlockTokens: r.moduleUnlockTokens,
            moduleUnlockNote:
              "Modül güvenlik anahtarları yalnızca bu yanıtta görünür. GitHub repository / Actions secret olarak saklayın (ör. TENANT_<SLUG>_COMMERCE_UNLOCK).",
          }
        : {}),
    });
  } catch (e) {
    if (e instanceof ProvisionConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("provision tenant POST", e);
    const msg = e instanceof Error ? e.message : "Sunucu hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
