import { NextResponse } from "next/server";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { resolve, join } from "node:path";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";
import {
  backupManifest,
  backupTimestampLabel,
  buildDatabaseBackupPayload,
  type BackupMode,
} from "@/lib/backup/server-export";

export const runtime = "nodejs";

/** Yerelde uzun süren işlemler; barındırıcı üst sınırından düşük tutulmalı */
export const maxDuration = 120;

const root = resolve(process.cwd());
const backupsRoot = resolve(root, "backups");

/**
 * Çoğu serverless/hosting ortamında proje klasörü salt okunur → spawn + klasör yedeği çalışmaz.
 * Tek başına PROCESS env bayraklarına güvenilmez (Vercel dışı read-only VPS vb.).
 */
async function probeBackupsFilesystemWritable(): Promise<boolean> {
  try {
    await mkdir(backupsRoot, { recursive: true });
    const probe = join(backupsRoot, `.probe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    await writeFile(probe, "1", "utf8");
    await unlink(probe);
    return true;
  } catch {
    return false;
  }
}

let writableCache: { value: boolean; until: number } | null = null;
const WRITABLE_CACHE_MS = 45_000;

async function backupsFilesystemWritable(): Promise<boolean> {
  const now = Date.now();
  if (writableCache && now < writableCache.until) return writableCache.value;
  const value = await probeBackupsFilesystemWritable();
  writableCache = { value, until: now + WRITABLE_CACHE_MS };
  return value;
}

function runExecFile(
  command: string,
  args: string[],
  options: { cwd: string; windowsHide?: boolean; timeout?: number; env?: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(command, args, options, (err, stdout, stderr) => {
      if (err) {
        rejectPromise(err);
        return;
      }
      resolvePromise({
        stdout: stdout == null ? "" : Buffer.isBuffer(stdout) ? stdout.toString("utf8") : String(stdout),
        stderr: stderr == null ? "" : Buffer.isBuffer(stderr) ? stderr.toString("utf8") : String(stderr),
      });
    });
  });
}

async function listBackups(): Promise<string[]> {
  if (!existsSync(backupsRoot)) return [];
  const entries = await readdir(backupsRoot, { withFileTypes: true });
  const rows: { name: string; mtimeMs: number }[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith("backup-")) continue;
    const full = join(backupsRoot, e.name);
    try {
      const st = await stat(full);
      rows.push({ name: e.name, mtimeMs: st.mtimeMs });
    } catch {
      continue;
    }
  }
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs).map((x) => x.name);
}

function parseMode(raw: unknown): BackupMode | null {
  if (raw === "all" || raw === "pages" || raw === "contents" || raw === "database" || raw === "files") {
    return raw;
  }
  return null;
}

async function createMemoryExport(mode: BackupMode) {
  const exportMode: BackupMode = mode === "all" ? "database" : mode;
  const { counts: dbCounts, tables } = await buildDatabaseBackupPayload(exportMode);
  const skipFilesReason =
    mode === "all"
      ? "Sunucuda kalıcı `backups/` yazılamıyor veya klasör çıktısı yok; yalnızca veritabanı tabloları bu dosyada."
      : null;
  const manifest = backupManifest(mode, dbCounts, skipFilesReason);
  const label = backupTimestampLabel();
  const stdout = [
    `Veritabanı anlık görüntüsü hazır — tarayıcı indirmesi başlamalı.`,
    `Tablo sayıları: ${JSON.stringify(dbCounts)}`,
  ].join("\n");
  return {
    stdout,
    manifest,
    tables,
    label,
  };
}

export async function GET() {
  try {
    const auth = await requireStaffApiPerm("site.settings");
    if (auth instanceof NextResponse) return auth;

    const diskWritable = await backupsFilesystemWritable();
    const items = await listBackups();

    return NextResponse.json({
      ok: true,
      items,
      diskBackupAvailable: diskWritable,
      restoreAllowed: diskWritable,
      /**
       * Yedek oluştur: disk yoksa indirilebilir JSON; disk varsa klasör + liste.
       */
      onlineExportAvailable: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/backups GET]", e);
    return NextResponse.json({ ok: false, error: msg, items: [] }, { status: 500 });
  }
}

async function spawnLocalBackup(mode: BackupMode): Promise<{ stdout: string; stderr: string }> {
  const flags = mode !== "all" ? [`--${mode}`] : ["--all"];
  const bin = typeof process.execPath === "string" && process.execPath.length > 0 ? process.execPath : "node";
  const scriptPath = join(root, "scripts", "backup-system.mjs");
  return runExecFile(bin, [scriptPath, ...flags], {
    cwd: root,
    windowsHide: true,
    timeout: maxDuration > 110 ? 110_000 : 55_000,
    env: { ...process.env },
  });
}

async function spawnLocalRestore(mode: BackupMode, from: string, apply: boolean): Promise<{ stdout: string; stderr: string }> {
  const flags = [`--from`, `backups/${from}`];
  if (mode !== "all") flags.push(`--${mode}`);
  else flags.push("--all");
  if (apply) flags.push("--apply");
  const bin = typeof process.execPath === "string" && process.execPath.length > 0 ? process.execPath : "node";
  const scriptPath = join(root, "scripts", "restore-system.mjs");
  return runExecFile(bin, [scriptPath, ...flags], {
    cwd: root,
    windowsHide: true,
    timeout: maxDuration > 110 ? 110_000 : 55_000,
    env: { ...process.env },
  });
}

export async function POST(req: Request) {
  try {
    const auth = await requireStaffApiPerm("site.settings");
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json()) as {
      action?: "create" | "restore";
      mode?: string;
      from?: string;
      apply?: boolean;
    };

    const mode = parseMode(body.mode) ?? ("all" as BackupMode);

    const diskWritable = await backupsFilesystemWritable();

    if (body.action === "create") {
      const filesUnavailableMsg =
        "Dosya yedekleri (uploads vb.) bu sunucuya yazılamadığı için panelden çıkmıyor. Tam klasör yedeği için `npm run backup:create` ile yerelde çalıştırın veya SSH/barındırıcıdan kopyalayın.";

      if (mode === "files") {
        if (!diskWritable) {
          return NextResponse.json({ ok: false, error: filesUnavailableMsg }, { status: 400 });
        }
        const { stdout, stderr } = await spawnLocalBackup(mode);
        return NextResponse.json({ ok: true, stdout, stderr, items: await listBackups() });
      }

      if (!diskWritable) {
        try {
          const { stdout, manifest, tables, label } = await createMemoryExport(mode);
          return NextResponse.json({
            ok: true,
            stdout,
            stderr: "",
            items: await listBackups(),
            serverlessExport: true,
            downloadFilename: `backup-${label}.json`,
            download: { manifest, database: tables },
          });
        } catch (memErr) {
          const inner = memErr instanceof Error ? memErr.message : String(memErr);
          console.error("[admin/backups POST] memory export failed", memErr);
          return NextResponse.json(
            {
              ok: false,
              error: `İndirilebilir yedek oluşturulamadı: ${inner}. DATABASE_URL bağlantısını ve barındırıcı loglarını kontrol edin.`,
            },
            { status: 500 },
          );
        }
      }

      try {
        const { stdout, stderr } = await spawnLocalBackup(mode);
        return NextResponse.json({ ok: true, stdout, stderr, items: await listBackups() });
      } catch (spawnErr) {
        console.warn("[admin/backups POST] klasör scripti başarısız; JSON export denenecek", spawnErr);
        try {
          const { stdout, manifest, tables, label } = await createMemoryExport(mode);
          const scriptErr = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
          return NextResponse.json({
            ok: true,
            stdout,
            stderr: `${scriptErr}\n\nNot: Klasör yazma denendiği halde backup scripti çalışmadı; veritabanı JSON indirmesi kullanıldı.`,
            items: await listBackups(),
            serverlessExport: true,
            downloadFilename: `backup-${label}.json`,
            download: { manifest, database: tables },
          });
        } catch (memErr) {
          const inner = memErr instanceof Error ? memErr.message : String(memErr);
          const outer = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
          console.error("[admin/backups POST] Hem script hem JSON export başarısız", spawnErr, memErr);
          return NextResponse.json(
            {
              ok: false,
              error: `Klasör yedeği başarısız (${outer}); indirilebilir yedek de oluşmadı (${inner}).`,
            },
            { status: 500 },
          );
        }
      }
    }

    if (body.action === "restore") {
      if (!diskWritable) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Geri yükleme klasör gerektirdiği için bu ortamda devre dışı. Yerelde `npm run backup:restore` veya SSH kullanın.",
          },
          { status: 503 },
        );
      }
      if (!body.from?.trim()) {
        return NextResponse.json({ ok: false, error: "Yedek seçin." }, { status: 400 });
      }
      try {
        const { stdout, stderr } = await spawnLocalRestore(mode, body.from.trim(), Boolean(body.apply));
        return NextResponse.json({ ok: true, stdout, stderr, items: await listBackups() });
      } catch (spawnErr) {
        const msg = spawnErr instanceof Error ? spawnErr.message : String(spawnErr);
        console.error("[admin/backups POST] restore spawn", spawnErr);
        return NextResponse.json(
          {
            ok: false,
            error: `Geri yükleme betiği çalışmadı: ${msg}. Sunucunun Node ve scripts/ klasörüne eriştiğinden emin olun.`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ ok: false, error: "Geçersiz action." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/backups POST]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
