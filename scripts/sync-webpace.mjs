/**
 * HTTrack (veya benzeri) çıktı klasörünü `public/webpace-mirror` içine kopyalar;
 * wp-content mutlak URL'lerini `/wp-content` yapar (next.config rewrites).
 *
 * Kullanım:
 *   node scripts/sync-webpace.mjs
 *   node scripts/sync-webpace.mjs "D:\siteler\www.example.com"
 *   set WEBPACE_MIRROR_SOURCE=D:\siteler\www.example.com && node scripts/sync-webpace.mjs
 *
 * `REPLACEMENTS` dizisine kendi alan adınızı ekleyin (wp-content yolu için).
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.join(import.meta.dirname, "..");
const DEFAULT_SOURCE = String.raw`C:\My Web Sites\webpace\www.cherryguzelliksalonu.com`;
const SOURCE = (
  process.argv[2]?.trim() ||
  process.env.WEBPACE_MIRROR_SOURCE?.trim() ||
  DEFAULT_SOURCE
).replace(/^["']|["']$/g, "");
const DEST = path.join(ROOT, "public", "webpace-mirror");

const REPLACEMENTS = [
  [/https:\/\/www\.cherryguzelliksalonu\.com\/wp-content/g, "/wp-content"],
  [/http:\/\/www\.cherryguzelliksalonu\.com\/wp-content/g, "/wp-content"],
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(html|css|js)$/i.test(name)) files.push(p);
  }
  return files;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("Kaynak yok:", SOURCE);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  execSync(`robocopy "${SOURCE}" "${DEST}" /E /NFL /NDL /NJH /NJS /nc /ns /np`, {
    stdio: "inherit",
    shell: true,
  });

  let changed = 0;
  for (const file of walk(DEST)) {
    let c = fs.readFileSync(file, "utf8");
    let n = c;
    for (const [re, to] of REPLACEMENTS) {
      n = n.replace(re, to);
    }
    if (n !== c) {
      fs.writeFileSync(file, n, "utf8");
      changed++;
    }
  }
  console.log("wp-content URL düzeltildi:", changed, "dosya");
}

main();
