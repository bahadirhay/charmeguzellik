import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireStaffApiPerm } from "@/lib/admin-api-auth";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const backupsRoot = resolve(root, "backups");

async function listBackups() {
  if (!existsSync(backupsRoot)) return [];
  const names = await readdir(backupsRoot);
  const rows = await Promise.all(
    names
      .filter((n) => n.startsWith("backup-"))
      .map(async (name) => {
        const full = join(backupsRoot, name);
        const st = await stat(full);
        return { name, full, mtimeMs: st.mtimeMs };
      }),
  );
  return rows.sort((a, b) => b.mtimeMs - a.mtimeMs).map((x) => x.name);
}

export async function GET() {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;
  const items = await listBackups();
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const auth = await requireStaffApiPerm("site.settings");
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    action?: "create" | "restore";
    mode?: "all" | "pages" | "contents" | "database" | "files";
    from?: string;
    apply?: boolean;
  };

  if (body.action === "create") {
    const flags =
      body.mode && body.mode !== "all" ? [`--${body.mode}`] : ["--all"];
    const { stdout, stderr } = await execFileAsync("node", ["scripts/backup-system.mjs", ...flags], {
      cwd: root,
      windowsHide: true,
    });
    return NextResponse.json({ ok: true, stdout, stderr, items: await listBackups() });
  }

  if (body.action === "restore") {
    if (!body.from?.trim()) {
      return NextResponse.json({ ok: false, error: "Yedek seçin." }, { status: 400 });
    }
    const flags = ["--from", `backups/${body.from.trim()}`];
    if (body.mode && body.mode !== "all") flags.push(`--${body.mode}`);
    else flags.push("--all");
    if (body.apply) flags.push("--apply");
    const { stdout, stderr } = await execFileAsync("node", ["scripts/restore-system.mjs", ...flags], {
      cwd: root,
      windowsHide: true,
    });
    return NextResponse.json({ ok: true, stdout, stderr, items: await listBackups() });
  }

  return NextResponse.json({ ok: false, error: "Geçersiz action." }, { status: 400 });
}
