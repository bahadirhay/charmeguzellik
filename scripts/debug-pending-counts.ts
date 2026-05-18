import { PrismaClient } from "@prisma/client";
import { istanbulDayUtcRange, getIstanbulTodayYmd } from "../src/lib/istanbul-day-bounds";

const prisma = new PrismaClient();

async function main() {
  const domains = await prisma.tenantDomain.findMany({
    select: { host: true, tenantId: true, isPrimary: true },
    orderBy: { host: "asc" },
  });
  console.log("=== TenantDomain ===");
  for (const d of domains) {
    console.log(`  ${d.host} -> ${d.tenantId}${d.isPrimary ? " (primary)" : ""}`);
  }

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("\n=== Tenants ===");
  for (const t of tenants) {
    console.log(`  ${t.slug ?? t.name ?? "?"} : ${t.id}`);
  }

  const todayYmd = getIstanbulTodayYmd();
  const { startUtc: dayStart, endUtc: dayEnd } = istanbulDayUtcRange(todayYmd);
  const nowUtc = new Date();

  console.log(`\nIstanbul bugün: ${todayYmd}`);
  console.log(`dayStart UTC: ${dayStart.toISOString()}`);
  console.log(`dayEnd UTC: ${dayEnd.toISOString()}\n`);

  const calendarStatuses = ["pending", "approved", "confirmed", "cancel_request", "checked_in"] as const;

  for (const t of tenants) {
    const pendingAll = await prisma.appointment.findMany({
      where: { tenantId: t.id, status: "pending" },
      select: { id: true, startAt: true, clientName: true, serviceName: true },
      orderBy: { startAt: "asc" },
    });
    const pendingActionable = pendingAll.filter((r) => r.startAt >= nowUtc);
    const pendingOverdue = pendingAll.filter((r) => r.startAt < nowUtc);

    const todayRows = await prisma.appointment.findMany({
      where: {
        tenantId: t.id,
        startAt: { gte: dayStart, lt: dayEnd },
        status: { in: [...calendarStatuses] },
      },
      select: { id: true, startAt: true, status: true, clientName: true, serviceName: true },
      orderBy: { startAt: "asc" },
    });

    const todayPending = todayRows.filter((r) => r.status === "pending");

    console.log(`--- ${t.slug ?? t.name ?? t.id} ---`);
    console.log(`  Bekleyen (tüm tarihler): ${pendingAll.length} (aktif: ${pendingActionable}, gecikmiş: ${pendingOverdue})`);
    console.log(`  Bugünkü randevular (KPI): ${todayRows.length} (bunların pending: ${todayPending})`);

    if (pendingAll.length > 0) {
      console.log("  Tüm pending:");
      for (const p of pendingAll) {
        const when = p.startAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
        const tag = p.startAt < nowUtc ? "[GEÇMİŞ]" : "[gelecek]";
        console.log(`    ${tag} ${when} · ${p.clientName} · ${p.serviceName ?? "—"}`);
      }
    }
    if (todayRows.length > 0) {
      console.log("  Bugün (İstanbul günü):");
      for (const r of todayRows) {
        const when = r.startAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
        console.log(`    ${r.status} · ${when} · ${r.clientName}`);
      }
    }
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
