#!/usr/bin/env node
/**
 * Neon'da bağlantı kurulamıyorsa okuyun (production_old dallarında compute olmayabilir).
 */
process.stdout.write(`
============================================================
NEON ÜZERİNDEN BAĞLANTI — HIZLI REHBER
============================================================

1) DOĞRU BRANCH
   Varsayılan / aktif dal genelde adı tam olarak «production» olur.
   İsimleri «production_old_2026-…» gibi olanlar ESKİ YEDEK DALLARdır;
   bunların üzerinde çoğu zaman Neon «Compute» (uygulama bağlantı noktası)
   kapalıdır veya hiç eklenmemiştir.

2) COMPUTE (SUNUCU UÇ NOKTASI) GEREKLİ
   Panelde «Add a compute to connect…» yazıyorsa bu dala uygulama
   bağlanamaz. Ya:
   • Varsayılan «production» dalına geçin ve Oradaki Connect ile
     connection string alın,
   Ya da (gerekmedikçe önerilmez) o eski dala «Add a compute» ile
   uç nokta açın.

3) CONNECTION STRING
   Neon > proje > dal: production > Connect (PSQL veya URI)
   Çıkan adres MUTLAKA şöyle başlar:
   postgresql:// veya postgres://
   Tüm satırı tek parça kopyalayın (şifre dahil).

4) POWERSHELL
   Script adlarini TEK BASINA yazmayin; hep: npm run <script>
   Ornek: «site:list» DEGIL — dogrusu: npm run site:list
   $env:DATABASE_URL=\"postgresql://...neon.tech/neondb?sslmode=require\"
   npm run site:list
   npm run site:reset-basics -- --host=alanadiniz.com --repair

5) VERCEL / UYGULAMA
   Hosting ortamındaki DATABASE_URL da aynı dalın (çoğunlukla
   production) connection string'i olmalı; eski yedek dala bağlı
   adres kullanmayın.

Yardımı tekrar görmek: npm run neon:baglanti-yardim

`);
