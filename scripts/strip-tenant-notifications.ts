/**
 * Mevcut kiracıda yanlışlıkla kopyalanmış ortak bildirim hedeflerini temizler:
 * - Randevu bildirim e-posta alanları (admin/operatör)
 * - Telegram token + chat id (themeTokensJson)
 * - Personel eşlemesi (başka kiracının StaffUser id'leri)
 *
 * Kullanım: npm run tenant:strip-notifications -- --slug=randevu
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { parseThemeTokens, themeTokensToJson } from "../src/lib/theme-tokens";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env.local"), override: true });
config({ path: resolve(root, ".env") });

const prisma = new PrismaClient();

function parseArg(name: string): string | null {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length).trim() : null;
}

async function main() {
  const slug = (parseArg("slug") ?? "").trim().toLowerCase();
  if (!slug) throw new Error("Kullanım: npm run tenant:strip-notifications -- --slug=<kiraci-slug>");

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant bulunamadı: ${slug}`);

  const settings = await prisma.siteSettings.findUnique({ where: { tenantId: tenant.id } });
  if (!settings) {
    console.log(`Bu tenant için SiteSettings yok: ${slug}`);
    return;
  }

  const tokens = parseThemeTokens(settings.themeTokensJson);
  delete tokens.telegramBotToken;
  delete tokens.telegramChatId;
  delete tokens.appointmentStaffByService;

  await prisma.siteSettings.update({
    where: { id: settings.id },
    data: {
      appointmentNotifyAdminEmails: null,
      appointmentNotifyOperatorEmails: null,
      themeTokensJson: themeTokensToJson(tokens),
    },
  });

  console.log(`Temizlendi: ${slug} (SiteSettings id=${settings.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
