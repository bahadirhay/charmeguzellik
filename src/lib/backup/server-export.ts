import { prisma, withPrismaEngine } from "@/lib/prisma";
import { BOOTSTRAP_TENANT_ID } from "@/lib/tenant-db";

function tenantSiteSettingsWhere() {
  return {
    OR: [{ tenantId: null }, { tenantId: BOOTSTRAP_TENANT_ID }],
  };
}

export type BackupMode = "all" | "pages" | "contents" | "database" | "files";

const ALL_MODELS = [
  "Page",
  "SiteSettings",
  "SiteInstagramPost",
  "SiteYoutubeVideo",
  "SiteTiktokVideo",
  "Lead",
  "CrmContact",
  "Appointment",
  "NavItem",
  "StaffRole",
  "StaffUser",
] as const;

const PAGES_MODELS = ["Page", "NavItem"] as const satisfies readonly (typeof ALL_MODELS)[number][];
const CONTENT_MODELS = ["SiteSettings", "SiteInstagramPost", "SiteYoutubeVideo", "SiteTiktokVideo"] as const;

const MODEL_READERS: Record<(typeof ALL_MODELS)[number], () => Promise<unknown>> = {
  Page: () => prisma.page.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  SiteSettings: () => prisma.siteSettings.findMany({ where: tenantSiteSettingsWhere() }),
  SiteInstagramPost: () => prisma.siteInstagramPost.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  SiteYoutubeVideo: () => prisma.siteYoutubeVideo.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  SiteTiktokVideo: () => prisma.siteTiktokVideo.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  Lead: () => prisma.lead.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  CrmContact: () => prisma.crmContact.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  Appointment: () => prisma.appointment.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  NavItem: () => prisma.navItem.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  StaffRole: () => prisma.staffRole.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
  StaffUser: () => prisma.staffUser.findMany({ where: { tenantId: BOOTSTRAP_TENANT_ID } }),
};

function modelsForMode(mode: BackupMode): (typeof ALL_MODELS)[number][] {
  const set = new Set<(typeof ALL_MODELS)[number]>();
  if (mode === "all" || mode === "database") {
    ALL_MODELS.forEach((m) => set.add(m));
    return [...set];
  }
  if (mode === "pages") PAGES_MODELS.forEach((m) => set.add(m));
  if (mode === "contents") CONTENT_MODELS.forEach((m) => set.add(m));
  return [...set];
}

/** ISO benzeri: backup-system.mjs ile aynı çıktı adı kültürü */
export function backupTimestampLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function buildDatabaseBackupPayload(mode: BackupMode): Promise<{
  counts: Record<string, number>;
  tables: Partial<Record<(typeof ALL_MODELS)[number], unknown>>;
}> {
  const models =
    mode === "files"
      ? ([] as (typeof ALL_MODELS)[number][])
      : mode === "all"
        ? modelsForMode("database")
        : modelsForMode(mode);

  const tables: Partial<Record<(typeof ALL_MODELS)[number], unknown>> = {};
  const counts: Record<string, number> = {};

  await withPrismaEngine(async () => {
    for (const m of models) {
      const rows = await MODEL_READERS[m]();
      counts[m] = Array.isArray(rows) ? rows.length : 0;
      tables[m] = rows;
    }
  });

  return { counts, tables };
}

export function backupManifest(mode: BackupMode, dbCounts: Record<string, number>, skippedFilesReason?: string | null) {
  return {
    createdAt: new Date().toISOString(),
    project: "web-page",
    source: "server-export",
    skippedFilesReason: skippedFilesReason ?? undefined,
    selected: {
      all: mode === "all",
      pages: mode === "pages",
      contents: mode === "contents",
      database: mode === "database",
      files: mode === "files",
    },
    dbTables: Object.keys(dbCounts),
    dbCounts,
    fileFolders: [] as string[],
    restoreHint: [
      "Yerelde: klasöre çıkarıp npm run backup:restore -- --from backups/<klasör> ...",
      "Panelden indirdiğiniz JSON’u klasör yapısına uygun oluşturmak gereklidir.",
    ],
  };
}
