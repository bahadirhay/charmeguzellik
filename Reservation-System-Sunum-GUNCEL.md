# Rezervasyon sistemi — sunum metni (güncel, basit dil)

*Bunu PowerPoint’e slayt slayt kopyalayabilir veya konuşma notu olarak kullanabilirsin.*

---

## Slayt 1 — Bu ne?

**Tek cümle:** Müşteri internetten randevu talebi bırakır; sen panelden onaylarsın veya reddedersin; müşteriye e-posta / WhatsApp ile haber gider.

* En basit haliyle: Web sitesi var → form doldur → senin tabletinde/telefonunda liste → “tamam” veya “olmaz”.

---

## Slayt 2 — Bir yazılım, çok müşteri (SaaS gibi düşün)

- Sunucuda **tek program** çalışıyor; **tek veritabanı** var.
- “Çok müşteri” demek: Her işletmenin verisi **ayrı kutuda** — biri diğerinin randevusunu göremez.

* Örnek: Biri `charmeguzellik.com`, biri `randevu.techizmet.com` — ikisi de aynı kodu kullanır ama **içerik, ayar, randevu listesi birbirine karışmaz.**

---

## Slayt 3 — Siteye hangi adresten girildiğini program anlıyor

- Ziyaretçi **`randevu.techizmet.com`** yazdıysa → sistem “bu Randevu kiracısı” der.
- Başka biri **`baska-isletme.com`** yazdıysa → o işletmenin kutusu açılır.

* Teknik kelime yok: **Adres çubuğundaki isim = hangi dükkânın vitrini.**

---

## Slayt 4 — Merkez panel (senin “fabrika” ekranın)

- **`PLATFORM_CONTROL_TENANT_ID`** diye bir ayar var: Hangi site “ana yönetim” sayılır.
- O siteden **yeni müşteri (yeni kiracı)** açılabilir — müşteri paneli sadece orada görünür.

* Basit anlatım: “Randevu.techizmet.com = genel merkez; oradan yeni salon hesabı açılır.”

---

## Slayt 5 — Ayarlar ve site adı (düzelttiğimiz kısım)

- Eskiden hata vardı: Ayarlar bazen **yanlış kutuya** yazılıyordu; site adresi değişse bile başka kutunun ayarı görünüyordu.
- Şimdi: **Hangi adresten panele girdiysen, o işletmenin ayarları** açılır ve kaydedilir.

* Yani: “Site adı”, “meta başlık” randevu sitesinde — **o sitenin kutusunda**, Charme’ninkiyle karışmaz.

---

## Slayt 6 — Google’da / sekmede görünen başlık (SEO)

- Ana sayfanın kendi “sayfa SEO” alanı varsa önce o okunur.
- **Ayarlar’daki “varsayılan meta başlık”** artık ana sayfada **ön planda** (klon içerikte eski başlık kalmaz diye).
- Kök sitede **“… · site adı”** şablonu artık **o işletmenin adıyla** biter, sabit “Güzellik & Hizmet” kalmaz.

---

## Slayt 7 — E-posta ve iptal / teyit linkleri

- Randevu onayı, hatırlatma, iptal linki giden maillerde **SMTP / gönderen** → **o işletmenin ayarlarından** (aynı kutudan).
- Link adresi: **Mümkünse ziyaretçinin geldiği alan adı** kullanılır; böylece Charme’den giren Charme linki, Randevu’dan giren Randevu linki görür.

* Cron (otomatik hatırlatma) istek göndermez → orada **varsayılan adres** (env’deki kök URL) kullanılır; onu Randevu yaptıysan hatırlatmalar Randevu köküne uygun olur.*

---

## Slayt 8 — robots.txt ve sitemap (Google’a harita)

- **`robots.txt`** ve **`sitemap.xml`** artık **o an hangi domain açıldıysa ona göre** yazılır (aynı program, doğru adres).
- Bir hata olursa sitemap **en azından ana sayfa** döner, site patlamaz.

---

## Slayt 9 — İptal linkinin güvenliği (yeni)

- Eskiden: Token bulmak için **son yüzlerce kayda bakılıyordu** — hem yavaş hem riskli.
- Şimdi: Bağlantıdaki kodun **hash’i** ile veritabanında **doğrudan aranıyor** + index var.

* Basit anlatım: “Şifreyi tek tek denemek yerine doğru çekmeceye gidiyor.”

---

## Slayt 10 — Yeni domain eklemek

- **Vercel’e domain ekle** + **veritabanında o domaini hangi müşteri = kiracıya bağladığını kaydet** (`TenantDomain`).
- **`NEXT_PUBLIC_SITE_URL`** her yeni müşteri için değiştirmek **zorunlu değil**; çok site aynı projede çalışır. Önemli olan **adres → doğru kiracı** eşleşmesi.

*(Kök URL env’inde Randevu varsa: otomatik işlerde varsayılan kök Randevu; canlı sitede ziyaretçi her zaman kendi adresini görür.)*

---

## Slayt 11 — Özet (30 saniye)

| Ne | Basit cümle |
|----|----------------|
| Çok müşteri | Aynı program, ayrı kutular (veri karışmaz). |
| Hangi dükkân | Tarayıcıdaki domain söyler. |
| Ayarlar / başlık / mail | Hepsi o kutunun içinden. |
| İptal linki | Hızlı ve doğrudan arama. |
| Yeni site | Domain + kayıt; her seferinde env değiştirmek şart değil. |

---

## Konuşma ipucu (sunumda söyleyeceğin tek cümle)

**“Tek bir rezervasyon motoru var; her işletme kendi alan adıyla kendi vitrinini ve kendi randevu kutusunu kullanıyor. Ayarlar ve mailler birbirine karışmıyor.”**

---

*Bu metin; kiracı bazlı ayarlar, Host tabanlı SEO, e-posta kökü, token index ve çok domain davranışı dahil son kod değişiklikleriyle uyumludur (2026).*
