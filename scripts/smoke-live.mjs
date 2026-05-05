#!/usr/bin/env node
const base = (process.env.SMOKE_BASE_URL || "https://charmeguzellik.com").replace(/\/+$/, "");

const checks = [
  { path: "/", expectStatus: 200, expectText: "Güzellik" },
  { path: "/admin/login", expectStatus: 200, expectText: "Yönetim girişi" },
  { path: "/admin/settings", expectStatus: 200, expectText: "Yönetim girişi" },
];

async function run() {
  process.stdout.write(`[smoke-live] Base URL: ${base}\n`);
  let failed = 0;

  for (const c of checks) {
    const url = `${base}${c.path}`;
    try {
      const res = await fetch(url, { redirect: "follow" });
      const body = await res.text();
      const okStatus = res.status === c.expectStatus;
      const okText = body.includes(c.expectText);
      const ok = okStatus && okText;
      process.stdout.write(
        `[${ok ? "OK" : "FAIL"}] ${c.path} -> ${res.status} ${
          okText ? "text-ok" : `missing-text:${c.expectText}`
        }\n`,
      );
      if (!ok) failed += 1;
    } catch (e) {
      failed += 1;
      process.stdout.write(`[FAIL] ${c.path} -> request-error ${(e && e.message) || "unknown"}\n`);
    }
  }

  if (failed > 0) {
    process.stderr.write(`[smoke-live] ${failed} check failed.\n`);
    process.exit(1);
  }
  process.stdout.write("[smoke-live] All checks passed.\n");
}

run();
