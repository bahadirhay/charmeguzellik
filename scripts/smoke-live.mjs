#!/usr/bin/env node
/**
 * Deploy sonrası canlı doğrulama.
 * Apex + www için ayrı SSL sertifikası gerekir; www projeye eklenmediyse bu script başarısız olur.
 */
const DEFAULT_HOSTS = ["https://charmeguzellik.com", "https://www.charmeguzellik.com"];

const checks = [
  { path: "/", expectStatus: 200, expectText: "Güzellik" },
  { path: "/admin/login", expectStatus: 200, expectText: "Yönetim girişi" },
  { path: "/admin/settings", expectStatus: 200, expectText: "Yönetim girişi" },
];

function basesFromEnv() {
  if (process.env.SMOKE_BASE_URL?.trim()) {
    return [process.env.SMOKE_BASE_URL.trim().replace(/\/+$/, "")];
  }
  if (process.env.SMOKE_BASE_URLS?.trim()) {
    return process.env.SMOKE_BASE_URLS
      .split(",")
      .map((s) => s.trim().replace(/\/+$/, ""))
      .filter(Boolean);
  }
  return DEFAULT_HOSTS.map((u) => u.replace(/\/+$/, ""));
}

async function runHost(base, failedArr) {
  process.stdout.write(`[smoke-live] Host: ${base}\n`);

  for (const c of checks) {
    const url = `${base}${c.path}`;
    try {
      const res = await fetch(url, { redirect: "follow" });
      const body = await res.text();
      const okStatus = res.status === c.expectStatus;
      const okText = body.includes(c.expectText);
      const ok = okStatus && okText;
      process.stdout.write(
        `[${ok ? "OK" : "FAIL"}] ${base}${c.path} -> ${res.status} ${
          okText ? "text-ok" : `missing-text:${c.expectText}`
        }\n`,
      );
      if (!ok) failedArr.push(`${base}${c.path}`);
    } catch (e) {
      failedArr.push(`${base}${c.path}`);
      process.stdout.write(
        `[FAIL] ${base}${c.path} -> request-error ${(e && e.message) || "unknown"}\n`,
      );
    }
  }
}

async function run() {
  const bases = basesFromEnv();
  const failed = [];

  for (const b of bases) {
    await runHost(b, failed);
  }

  if (failed.length > 0) {
    process.stderr.write(`[smoke-live] ${failed.length} check failed: ${failed.join("; ")}\n`);
    process.exit(1);
  }
  process.stdout.write("[smoke-live] All checks passed.\n");
}

run();
