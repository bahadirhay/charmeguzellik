/**
 * Görsel URL listesini indirip public/uploads/{slug}/ altına kaydeder.
 *
 * ÖNEMLİ: Yalnızca kullanım hakkınız olan (kendi çekiminiz veya lisanslı) dosyaları kullanın.
 *
 * 1) scripts/image-urls.json oluşturun: [ "https://ornek.com/a.jpg", ... ]
 * 2) Çalıştırın: node scripts/download-images.cjs --slug site-adi
 *
 * Dosya adları: {slug}-01.webp veya uzantı orijinalden.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const LIST_FILE = path.join(__dirname, "image-urls.json");

function parseArgs() {
  const args = process.argv.slice(2);
  let slug = "site";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--slug" && args[i + 1]) slug = args[++i];
  }
  return { slug: slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase() };
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBuffer(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

function extFromUrl(u, contentType) {
  try {
    const p = new URL(u).pathname;
    const m = p.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i);
    if (m) return "." + m[1].toLowerCase().replace("jpeg", "jpg");
  } catch {
    /* ignore */
  }
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("jpeg")) return ".jpg";
  return ".jpg";
}

async function main() {
  const { slug } = parseArgs();
  if (!fs.existsSync(LIST_FILE)) {
    console.error("Eksik:", LIST_FILE);
    console.error('Örnek içerik: ["https://.../1.jpg","https://.../2.jpg"]');
    process.exit(1);
  }
  const raw = fs.readFileSync(LIST_FILE, "utf8");
  const urls = JSON.parse(raw);
  if (!Array.isArray(urls) || !urls.length) {
    console.error("image-urls.json boş veya dizi değil");
    process.exit(1);
  }

  const outDir = path.join(ROOT, "public", "uploads", slug);
  fs.mkdirSync(outDir, { recursive: true });

  let i = 0;
  for (const url of urls) {
    if (typeof url !== "string" || !url.trim()) continue;
    i++;
    const padded = String(i).padStart(2, "0");
    try {
      const buf = await fetchBuffer(url.trim());
      const ext = extFromUrl(url, null);
      const filename = `${slug}-slayt-${padded}${ext}`;
      const dest = path.join(outDir, filename);
      fs.writeFileSync(dest, buf);
      console.log("OK", filename);
    } catch (e) {
      console.error("Hata", url, e.message);
    }
  }
  console.log("\nBlok düzenleyicide görsel yolu örneği:");
  console.log(`/uploads/${slug}/${slug}-slayt-01.jpg`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
