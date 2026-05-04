#!/usr/bin/env node
/**
 * Yerel projeyi Neon veritabanı ve GitHub (origin) ile eşitlemek için yardımcı script.
 *
 * Kullanım:
 *   npm run sync:neon-github
 *   npm run sync:neon-github -- --dry-run
 *   npm run sync:neon-github -- --seed
 *   npm run sync:neon-github -- --git-pull --commit=chore:sync --git-push
 *
 * PowerShell: boşluklu commit için --commit="mesaj" npm tarafından parçalanabilir;
 *   güvenli: --commit=mesaj veya --commit mesaj (tırnaksız tek kelime)
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const prismaSchemaPath = resolve(root, "prisma", "schema.prisma");
/** Windows’ta spawn + npx/npm + shell:false sessizce başarısız olabiliyor; doğrudan Node ile çalıştır. */
const prismaCliPath = resolve(root, "node_modules", "prisma", "build", "index.js");
const tsxCliPath = resolve(root, "node_modules", "tsx", "dist", "cli.mjs");
const nodeBin = process.execPath;

const isWin = process.platform === "win32";
function npmCmd() {
  return isWin ? "npm.cmd" : "npm";
}

/** Prisma CLI — `npx prisma` yerine (Windows uyumlu). */
function runPrisma(prismaArgs, opts = {}) {
  return run(nodeBin, [prismaCliPath, ...prismaArgs], opts);
}

function loadProjectEnv() {
  const envPath = resolve(root, ".env");
  const localPath = resolve(root, ".env.local");
  if (existsSync(envPath)) loadEnv({ path: envPath });
  if (existsSync(localPath)) loadEnv({ path: localPath, override: true });
}

function parseArgs(argv) {
  return {
    help: argv.includes("--help") || argv.includes("-h"),
    dryRun: argv.includes("--dry-run"),
    seed: argv.includes("--seed"),
    gitPull: argv.includes("--git-pull"),
    gitPush: argv.includes("--git-push"),
    strictNeon: argv.includes("--strict-neon"),
    skipDb: argv.includes("--no-db"),
    commitMessage: parseCommitMessage(argv),
  };
}

/** --commit=tek argüman veya --commit sonrası -- ile başlamayan tüm parçalar */
function parseCommitMessage(argv) {
  const eq = argv.find((a) => a.startsWith("--commit="));
  if (eq) return eq.slice("--commit=".length).replace(/^["']|["']$/g, "") || null;
  const i = argv.indexOf("--commit");
  if (i === -1) return null;
  const parts = [];
  for (let j = i + 1; j < argv.length; j++) {
    if (argv[j].startsWith("--")) break;
    parts.push(argv[j]);
  }
  return parts.length ? parts.join(" ") : null;
}

function run(cmd, args, opts = {}) {
  const { dryRun, cwd = root, inherit = true, stdinInput = null } = opts;
  if (dryRun) {
    const stdinHint = stdinInput != null ? " <stdin>" : "";
    process.stdout.write(`[dry-run] ${cmd} ${args.join(" ")}${stdinHint}\n`);
    return { status: 0 };
  }
  const stdio = inherit
    ? stdinInput != null
      ? ["pipe", "inherit", "inherit"]
      : "inherit"
    : "pipe";
  const r = spawnSync(cmd, args, {
    cwd,
    stdio,
    shell: false,
    encoding: "utf8",
    ...(stdinInput != null ? { input: stdinInput } : {}),
  });
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

function runCapture(cmd, args, opts = {}) {
  const { dryRun, cwd = root } = opts;
  if (dryRun) return { status: 0, stdout: "", stderr: "" };
  const r = spawnSync(cmd, args, {
    cwd,
    shell: false,
    encoding: "utf8",
  });
  return { status: r.status ?? 1, stdout: String(r.stdout ?? "").trim(), stderr: String(r.stderr ?? "").trim() };
}

function isLikelyNeonDatabaseUrl(url) {
  if (!url || !url.startsWith("postgres")) return false;
  const u = url.toLowerCase();
  return u.includes("neon.tech") || u.includes("neon.") || u.includes("-pooler.");
}

function gitDirty(dryRun) {
  const s = runCapture("git", ["status", "--porcelain"], { dryRun });
  return s.stdout.length > 0;
}

function printHelp() {
  process.stdout.write(`
sync-neon-github — Neon + GitHub eşitleme

Önkoşul: .env veya .env.local içinde Neon postgresql:// DATABASE_URL

Varsayılan:
  Neon URL → prisma generate → prisma db push → SELECT 1 → git özeti

İşaretler:
  --dry-run       Komutları yazdır, çalıştırma
  --no-db         Prisma adımlarını atla
  --strict-neon   URL'de neon.tech zorunlu
  --seed          npm run db:seed
  --git-pull      git pull --rebase (kirliyse önce --commit gerekir)
  --commit=mesaj  veya  --commit mesaj   (PowerShell'de boşluk için --commit=... kullanın)
  --git-push      git push

Sıra (--git-pull ile): commit (kirliyse) → pull --rebase → push

Örnek:
  npm run sync:neon-github -- --git-pull --commit=chore: sync neon --git-push
`);
}

function doGitCommit(message, dryRun) {
  process.stdout.write(`\n--- git add -A && git commit -m ... ---\n`);
  let r = run("git", ["add", "-A"], { dryRun });
  if (r.status !== 0) return r.status ?? 1;
  r = run("git", ["commit", "-m", message], { dryRun });
  if (r.status !== 0) {
    process.stderr.write("git commit başarısız (boş commit veya hook).\n");
    return r.status ?? 1;
  }
  return 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  process.chdir(root);
  loadProjectEnv();
  const databaseUrl = process.env.DATABASE_URL?.trim();

  process.stdout.write("\n=== Neon (DATABASE_URL) ===\n");
  if (!databaseUrl?.startsWith("postgres")) {
    process.stderr.write("Hata: DATABASE_URL yok veya postgresql:// değil.\n");
    process.exit(1);
  }
  if (args.strictNeon && !databaseUrl.toLowerCase().includes("neon.tech")) {
    process.stderr.write("Hata: --strict-neon: neon.tech bekleniyordu.\n");
    process.exit(1);
  }
  if (!isLikelyNeonDatabaseUrl(databaseUrl)) {
    process.stdout.write("Uyarı: URL tipik Neon host'u içermiyor; devam ediliyor.\n");
  } else {
    process.stdout.write("DATABASE_URL Neon benzeri host ile eşleşiyor.\n");
  }

  if (!args.skipDb) {
    process.stdout.write("\n=== Prisma: generate ===\n");
    let r = runPrisma(["generate"], { dryRun: args.dryRun });
    if (r.status !== 0) {
      process.stderr.write(
        "\nprisma generate başarısız. `npm run dev` veya başka Prisma süreçlerini kapatıp tekrar deneyin.\n" +
          "Elle: node node_modules/prisma/build/index.js generate\n",
      );
      process.exit(r.status ?? 1);
    }

    process.stdout.write("\n=== Prisma: db push (şema → Neon) ===\n");
    r = runPrisma(["db", "push"], { dryRun: args.dryRun });
    if (r.status !== 0) {
      process.stderr.write("\nprisma db push başarısız.\n");
      process.exit(r.status ?? 1);
    }

    process.stdout.write("\n=== Prisma: bağlantı testi (SELECT 1) ===\n");
    r = runPrisma(["db", "execute", "--stdin", "--schema", prismaSchemaPath], {
      dryRun: args.dryRun,
      inherit: true,
      stdinInput: "SELECT 1 as ok;",
    });
    if (r.status !== 0) {
      process.stdout.write("Uyarı: SELECT 1 başarısız (db push geçtiyse genelde sorun değil).\n");
    }
  }

  if (args.seed) {
    process.stdout.write("\n=== db:seed (tsx) ===\n");
    process.stdout.write("(!) Seed veritabanını değiştirebilir.\n");
    const seedPath = resolve(root, "prisma", "seed.ts");
    const r = run(nodeBin, [tsxCliPath, seedPath], { dryRun: args.dryRun });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }

  process.stdout.write("\n=== Git ===\n");
  const branch = runCapture("git", ["branch", "--show-current"], { dryRun: args.dryRun }).stdout || "main";
  process.stdout.write(`Dal: ${branch}\n`);

  run("git", ["fetch", "origin"], { dryRun: args.dryRun });

  let dirty = gitDirty(args.dryRun);
  const remoteRef = `origin/${branch}`;
  const remoteOk = runCapture("git", ["rev-parse", "--verify", remoteRef], { dryRun: args.dryRun }).status === 0;
  let aheadN = 0;
  let behindN = 0;
  if (remoteOk) {
    const a = runCapture("git", ["rev-list", "--count", `${remoteRef}..HEAD`], { dryRun: args.dryRun });
    const b = runCapture("git", ["rev-list", "--count", `HEAD..${remoteRef}`], { dryRun: args.dryRun });
    aheadN = parseInt(a.stdout, 10) || 0;
    behindN = parseInt(b.stdout, 10) || 0;
  } else {
    process.stdout.write(`Uyarı: ${remoteRef} yok.\n`);
  }
  process.stdout.write(`İlk durum: origin/${branch} → ${aheadN} ileri, ${behindN} geri. Kirli: ${dirty ? "evet" : "hayır"}\n`);

  if (args.gitPull && dirty && !args.commitMessage) {
    process.stderr.write(
      "\nHata: Commitlenmemiş dosyalar varken git pull yapılamaz.\n" +
        "  Çözüm: Önce --commit=mesaj verin (script önce commit eder, sonra pull) veya manuel stash/commit.\n",
    );
    process.exit(1);
  }

  if (args.commitMessage && dirty) {
    const code = doGitCommit(args.commitMessage, args.dryRun);
    if (code !== 0) process.exit(code);
    dirty = gitDirty(args.dryRun);
  }

  if (args.gitPull) {
    process.stdout.write(`\n--- git pull --rebase origin ${branch} ---\n`);
    const r = run("git", ["pull", "--rebase", "origin", branch], { dryRun: args.dryRun });
    if (r.status !== 0) {
      process.stderr.write("git pull başarısız (çakışma veya ağ).\n");
      process.exit(r.status ?? 1);
    }
    dirty = gitDirty(args.dryRun);
    if (remoteOk) {
      const a = runCapture("git", ["rev-list", "--count", `${remoteRef}..HEAD`], { dryRun: args.dryRun });
      const b = runCapture("git", ["rev-list", "--count", `HEAD..${remoteRef}`], { dryRun: args.dryRun });
      aheadN = parseInt(a.stdout, 10) || 0;
      behindN = parseInt(b.stdout, 10) || 0;
    }
    process.stdout.write(`Pull sonrası: ${aheadN} ileri, ${behindN} geri. Kirli: ${dirty ? "evet" : "hayır"}\n`);
  }

  if (args.commitMessage && dirty) {
    const code = doGitCommit(args.commitMessage, args.dryRun);
    if (code !== 0) process.exit(code);
    dirty = gitDirty(args.dryRun);
  } else if (!args.commitMessage && args.gitPush && dirty) {
    process.stderr.write("\nHata: Push için önce --commit=mesaj ile commit edin veya çalışma ağacını temizleyin.\n");
    process.exit(1);
  }

  if (args.gitPush) {
    process.stdout.write(`\n--- git push origin ${branch} ---\n`);
    const r = run("git", ["push", "origin", branch], { dryRun: args.dryRun });
    if (r.status !== 0) {
      process.stderr.write("git push başarısız.\n");
      process.exit(r.status ?? 1);
    }
  } else {
    process.stdout.write("\nGitHub push için: --commit=mesaj --git-push (isteğe --git-pull)\n");
  }

  process.stdout.write("\nBitti.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
