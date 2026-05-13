#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "pipe",
    encoding: "utf-8",
    shell: false,
    ...opts,
  });
  return {
    code: r.status ?? 1,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  };
}

function fail(msg) {
  process.stderr.write(`\n[release-check] ${msg}\n`);
  process.exit(1);
}

process.stdout.write("[release-check] Git durum kontrolu...\n");
const status = run("git", ["status", "--porcelain"]);
if (status.code !== 0) fail(status.stderr || "git status calismadi.");
if (status.stdout) {
  fail(
    "Calisma agaci temiz degil. Once commit/push yapin.\n" +
      status.stdout
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
  );
}

process.stdout.write("[release-check] origin/main ile senkron kontrolu...\n");
const fetch = run("git", ["fetch", "origin", "main"]);
if (fetch.code !== 0) fail(fetch.stderr || "git fetch basarisiz.");

const diverge = run("git", ["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
if (diverge.code !== 0) fail(diverge.stderr || "rev-list calismadi.");
const [behindRaw, aheadRaw] = diverge.stdout.split(/\s+/);
const behind = Number(behindRaw || "0");
const ahead = Number(aheadRaw || "0");
if (Number.isNaN(behind) || Number.isNaN(ahead)) {
  fail(`Divergence parse edilemedi: "${diverge.stdout}"`);
}
if (behind > 0) {
  fail(`Branch origin/main gerisinde (${behind} commit). Once pull/rebase yapin.`);
}
if (ahead > 0) {
  fail(`Local branch push edilmemis (${ahead} commit). Once git push yapin.`);
}

const skipBuild = process.argv.includes("--skip-build");
if (!skipBuild) {
  process.stdout.write("[release-check] Build kontrolu...\n");
  const build = run("npm", ["run", "build"], { stdio: "inherit" });
  if (build.code !== 0) fail("Build basarisiz.");
}

const runTenantKeyCheck =
  process.argv.includes("--tenant-module-keys") || process.argv.includes("--tenant-keys-strict");
const tenantKeysStrict = process.argv.includes("--tenant-keys-strict");
if (runTenantKeyCheck) {
  process.stdout.write("[release-check] Kiraci modul anahtari kontrolu...\n");
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    if (tenantKeysStrict) {
      fail("--tenant-keys-strict icin DATABASE_URL ortam degiskeni gerekli.");
    }
    process.stdout.write("[release-check] DATABASE_URL yok; kiraci anahtar kontrolu atlandi.\n");
  } else {
    const args = ["scripts/check-tenant-module-unlock-keys.mjs"];
    if (tenantKeysStrict) args.push("--strict");
    const k = run("node", args, { stdio: "inherit" });
    if (k.code !== 0) fail("Kiraci modul anahtari kontrolu basarisiz.");
  }
}

process.stdout.write("\n[release-check] OK: yayin oncesi kontroller basarili.\n");
if (!runTenantKeyCheck) {
  process.stdout.write(
    "[release-check] Istege bagli: uretim DATABASE_URL ile kiraci anahtari ozeti -> npm run release:check -- --tenant-module-keys\n",
  );
}
