# Yedekleme ve Taşıma

Bu proje için seçenekli yedek/geri yükleme komutları:

- `npm run backup:create`
- `npm run backup:restore`

## 1) Tek komutta her şeyi yedekle

```bash
npm run backup:create -- --all
```

Çıktı klasörü:

- `backups/backup-YYYYMMDD-HHMMSS/manifest.json`
- `backups/.../database/*.json`
- `backups/.../files/uploads` (varsa)
- `backups/.../files/webpace-mirror` (varsa)

## 2) Seçenekli yedek

```bash
npm run backup:create -- --pages --contents --files
```

Seçenekler:

- `--pages` → `Page`, `NavItem`
- `--contents` → `SiteSettings`, sosyal vitrin tabloları
- `--database` → tüm veritabanı tabloları
- `--files` → `public/uploads` + `public/webpace-mirror`
- `--all` → hepsi

Hiç seçenek vermezseniz komut interaktif sorar: “neyi yedeklemek istiyorsunuz?”

## 3) Yeni host/domain'e kolay aktarım

1. Yeni ortamda repo + `.env` / `.env.local` (`DATABASE_URL`) hazır olsun.
2. Şema:
   ```bash
   npm run db:push
   ```
3. Geri yükle (dry-run):
   ```bash
   npm run backup:restore -- --from backups/backup-... --all
   ```
4. Uygula:
   ```bash
   npm run backup:restore -- --from backups/backup-... --all --apply
   ```

Bu akışla “1-2 komutta” yeni alana taşıma yapılır.

## Notlar

- `--apply` verilmeden geri yükleme veri yazmaz (dry-run).
- `--database` / `--all` geri yüklemede ilgili tablolar temizlenip yedekten yazılır.
- Yedek klasörünü zipleyip başka sunucuya taşıyabilirsiniz.
