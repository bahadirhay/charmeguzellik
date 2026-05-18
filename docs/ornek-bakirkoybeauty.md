# Örnek salon: `bakirkoybeauty`

Bu dosya, `bakirkoybeauty.randevu.techizmet.com` ile **salona özel giriş** (ekranda salon seçimi yok) akışını denemek için yapılacakları özetler.

## 1) Veritabanında kiracıyı oluştur

Önkoşul: `.env` içinde `DATABASE_URL`. İlk panel kullanıcısı için `ADMIN_PASSWORD` (en az 8 karakter).

İstemci güncel değilse (veya şema değiştiyse) bir kez: `npx prisma generate`

```bash
npm run example:bakirkoybeauty
```

**Windows `EPERM … query_engine-windows.dll.node`:** `next dev` / başka `node` süreçlerini durdurun; gerekirse IDE’yi kapatıp yeniden `npx prisma generate` deneyin. Örnek script artık her çalışmada `prisma generate` tetiklemez (kilitlenmeyi azaltır).

Yerelde `hosts` ile denemek için:

```bash
npm run example:bakirkoybeauty -- --host=bakirkoybeauty.localhost --no-bootstrap
```

## 2) DNS (üretim)

- `bakirkoybeauty.randevu.techizmet.com` → uygulamanın çalıştığı sunucuya **A** veya **CNAME** (tek kayıt yeter; mail/MX/NS kopyası şart değil).
- Bu hostname için **TLS sertifikası** (Let’s Encrypt veya barındırıcı).

## 3) Ne elde edersiniz?

| Adres | Anlamı |
|--------|--------|
| `https://bakirkoybeauty.randevu.techizmet.com/` | O salona ait genel site |
| `https://bakirkoybeauty.randevu.techizmet.com/admin/login` | Aynı salonun paneli |

`Host` başlığından `TenantDomain` ile `tenantId` çözülür; başka salonun verisi görünmez.

## 3b) Randevular `localhost` ile `bakirkoybeauty.localhost` arasında karışıyorsa

**Neden:** `Host` için `TenantDomain` satırı yoksa uygulama **varsayılan kiracıya** düşer; iki adres de aynı `tenantId` ile randevu yazar/okur.

**Çözüm:** `TenantDomain` tablosunda `bakirkoybeauty.localhost` → `bakirkoybeauty` tenant `id` eşlemesi olmalı (örnek script bunu yapar). `localhost` genelde varsayılan salona kalır.

Doğrulama: Prisma Studio’da `TenantDomain` — iki host **farklı** `tenantId` göstermeli.

Geliştirmede eşleşme yoksa sunucu konsolunda uyarı: `[tenant-db] "…" için TenantDomain kaydı yok`.

## 4) Karşılaşacağınız konular

- **SMTP / Telegram:** Yeni kiracı için `SiteSettings` ayrı satırdır; `provisionTenant` varsayılan tenanttan kopyalar ama **Telegram token/chat** temizlenir — salon kendi ayarını panelden girer.
- **E-posta hacmi:** Ortak SMTP kullanıyorsanız kiracı başına kota / BYO SMTP politikası düşünün.
- **İçerik:** Script `--clone-content` ile sayfa + menüyü varsayılan tenanttan kopyalar; canlı veriyi (randevu, CRM) kopyalamaz — sıfırdan dolar.
- **Modül kilitleri:** Ticaret/randevu modülü açık seçildiyse script çıktısında üretilen **unlock token**’ları güvenli saklayın (ortam / secret).

## 5) Genel komut (script dışı)

```bash
npm run tenant:create -- --slug=bakirkoybeauty --name="Bakırköy Beauty" --host=bakirkoybeauty.randevu.techizmet.com --clone-content --commerce --bootstrap-admin
```

Mevcut kiracıya sadece ikinci domain eklemek için: `npm run tenant:add-domain -- --host=... --tenant-id=...`
