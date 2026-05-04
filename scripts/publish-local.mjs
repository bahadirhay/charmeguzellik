#!/usr/bin/env node
/**
 * Yerelde çalışan hâli “yayına yaklaştırır”: Vercel üretim env çekme (isteğe bağlı),
 * Prisma şema → Neon, panel admin şifresini .env ile eşitleme, Git’e güvenli push.
 *
 * .env ve .env.local Git’e GİTMEZ (şifre sızmasın). Üretim sırları için:
 *   npx vercel env pull .env.vercel.production --environment=production -y
 * bu dosya da .gitignore’daki .env* ile zaten takip edilmez.
 *
 * Kullanım:
 *   npm run publish:local -- --dry-run
 *   npm run publish:local
 *   npm run publish:local -- --vercel-env
 *   npm run publish:local -- --vercel-env --commit=chore:publish --push
 *
 * Önkoşul: .env içinde DATABASE_URL (Neon), ADMIN_PASSWORD (>=6), isteğe ADMIN_STAFF_USERNAME
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const pulledPath = resolve(root, ".env.vercel.production");
const prismaCli = resolve(root, "node_modules", "prisma", "build", "index.js");
const tsxCli = resolve(root, "node_modules", "tsx", "dist", "cli.mjs");
const resetStaffScript = resolve(root, "scripts", "reset-staff-admin.ts");
const node = process.execPath;

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    vercelEnv: argv.includes("--vercel-env"),
    gitPush: argv.includes("--push"),
    commitMessage: (() => {
      const eq = argv.find((a) => a.startsWith("--commit="));
      if (eq) return eq.slice("--commit=".length) || null;
      const i = argv.indexOf("--commit");
      if (i === -1) return null;
      const parts = [];
      for (let j = i + 1; j < argv.length; j++) {
        if (argv[j].startsWith("--")) break;
        parts.push(argv[j]);
      }
      return parts.length ? parts.join(" ") : null;
    })(),
  };
}

function run(cmd, args, opts = {}) {
  const { cwd = root, dry, shell = false } = opts;
  if (dry) {
    process.stdout.write(`[dry-run] ${cmd} ${args.join(" ")}\n`);
    return 0;
  }
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell, encoding: "utf8" });
  return r.status ?? 1;
}

function loadStack(usePulled) {
  const envPath = resolve(root, ".env");
  const localPath = resolve(root, ".env.local");
  if (existsSync(envPath)) loadEnv({ path: envPath });
  if (existsSync(localPath)) loadEnv({ path: localPath, override: true });
  if (usePulled && existsSync(pulledPath)) {
    loadEnv({ path: pulledPath, override: true });
    process.stdout.write("Ortam: .env + .env.local + .env.vercel.production (üretimden çekilen)\n");
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`
publish:local — şema + admin şifresi + (isteğe) Vercel env + Git

  npm run publish:local -- --dry-run
  npm run publish:local
  npm run publish:local -- --vercel-env
  npm run publish:local -- --vercel-env --commit=chore:publish --push

--vercel-env  npx vercel env pull (production) → .env.vercel.production ve bu çalıştırmada env önceliği
`);
    process.exit(0);
  }

  const args = parseArgs(argv);
  process.chdir(root);

  if (args.vercelEnv) {
    if (!existsSync(resolve(root, ".vercel", "project.json"))) {
      process.stderr.write("Önce: npx vercel link\n");
      process.exit(1);
    }
    process.stdout.write("\n=== Vercel: production env pull ===\n");
    const code = run(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["vercel", "env", "pull", ".env.vercel.production", "--environment=production", "-y"],
      { dry: args.dryRun, shell: process.platform === "win32" },
    );
    if (code !== 0) process.exit(code);
    if (!args.dryRun && !existsSync(pulledPath)) {
      process.stderr.write(".env.vercel.production oluşmadı.\n");
      process.exit(1);
    }
  }

  loadStack(args.vercelEnv);

  if (!process.env.DATABASE_URL?.trim().startsWith("postgres")) {
    process.stderr.write("DATABASE_URL (postgresql://) gerekli. --vercel-env ile Vercel’den çekin veya .env doldurun.\n");
    process.exit(1);
  }

  process.stdout.write("\n=== Prisma generate ===\n");
  let c = run(node, [prismaCli, "generate"], { dry: args.dryRun });
  if (c !== 0) process.exit(c);

  process.stdout.write("\n=== Prisma db push ===\n");
  c = run(node, [prismaCli, "db", "push"], { dry: args.dryRun });
  if (c !== 0) process.exit(c);

  process.stdout.write("\n=== Panel kullanıcısı (ADMIN_PASSWORD) ===\n");
  c = run(node, [tsxCli, resetStaffScript], { dry: args.dryRun });
  if (c !== 0) process.exit(c);

  process.stdout.write("\n=== Git (şifre dosyaları hariç — .gitignore) ===\n");
  c = run("git", ["add", "-A"], { dry: args.dryRun });
  if (c !== 0) process.exit(c);
  c = run("git", ["status", "-sb"], { dry: args.dryRun });
  if (c !== 0) process.exit(c);

  if (args.commitMessage) {
    c = run("git", ["commit", "-m", args.commitMessage], { dry: args.dryRun });
    if (c !== 0 && !args.dryRun) {
      process.stderr.write("Commit atlandı (boş veya aynı içerik olabilir).\n");
    }
  }
  if (args.gitPush) {
    const branch = args.dryRun
      ? "main"
      : spawnSync("git", ["branch", "--show-current"], { encoding: "utf8", cwd: root, shell: false }).stdout?.trim() ||
        "main";
    c = run("git", ["push", "origin", branch], { dry: args.dryRun });
    if (c !== 0) process.exit(c);
  } else if (!args.dryRun) {
    process.stdout.write("\nPush için: --commit=mesaj --push\n");
  }

  process.stdout.write(`
Not: .env / .env.local / .env.vercel.production Git'e GİTMEZ.
Canlı sır'lar Vercel panelinde kalmalı; bu script yalnızca yerel/Neon şema ve admin DB kaydını hizalar.
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
