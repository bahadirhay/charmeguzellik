# Rezervasyon sistemi — tam rehber (müşteri + yönetim paneli)

Bu belge **tek bir işletme** perspektifinde yazılmıştır: müşteri tarafında formdan başlayıp, panelde neleri tanımlayabileceğiniz, önerilen kurulum sırası, **Telegram**, **e-posta**, **iptal / teyit / tarih değiştirme** ve **hatırlatma** akışlarını uçtan uca anlatır. Çoklu domain veya merkez salon yönetimi burada yok sayılır (isterseniz ayrı dokümanlarınıza bakın).

---

## Bölüm A — Önce bu kavramlar

| Kavram | Ne işe yarar? |
|--------|----------------|
| **Randevu modülü** | Kapalıysa sitede randevu formu çalışmaz, panelde randevu sayfaları kilitlenir. **Genel ayarlar** içinde aç/kapa. |
| **Randevu bloğu** | Sitedeki sayfaya eklenen “iletişim formu” bloğunun modu **Randevu** olmalı. Çalışma günleri, slot süresi, saat dilimi burada. |
| **Menü — hizmet listesi** | Formdaki “İstenen hizmet” listesi için çoğu kurulumda üst menüde **“Hizmetlerimiz”** altına yayınlı alt başlıklar konur; etiketler personel eşlemesiyle **aynı yazı** ile eşleşmeli. |
| **Tema / personel eşlemesi** | Ayarlarda (tema JSON) **hangi hizmet etiketine hangi personeller** bağlı; müşteriye “Uygun personel” listesi ve otomatik atama buradan gelir. |
| **Bekleyen talep (`pending`)** | Müşteri formu gönderdi — işletme henüz onaylamadı. |
| **Onaylı (`approved`)** | Panelden onaylandı; müşteriye onay maili gidebilir ve e-postada **yönetim bağlantısı** (teyit/iptal) üretilir. |
| **Teyitli (`confirmed`)** | Müşteri e-postadaki bağlantıdan “teyit” derse veya bazı süreçlerde bu duruma geçer. |

---

## Bölüm B — İşletme kurulumu: önerilen iş akışı (sırayla)

Aşağıdaki sıra hem “çalışan bir zincir” kurmak hem de sonra ince ayar yapmak için uygundur.

### 1) Randevu modülünü açın

**Yönetim → Genel ayarlar** (veya ayarlar ana sayfası). **Randevu modülü** kutusunu işaretleyin ve kaydedin.

- Açık değilse müşteri formu gönderemez; panelde de randevu bölümü kapalıdır.

### 2) Menüyü hazırlayın (hizmet isimleri)

**Yönetim → Menü** ile üst menüde bir başlık (çoğu yerde otomatik olarak **“Hizmetlerimiz”** aranır) ve altına **yayında** alt menü öğeleri ekleyin. Her alt öğenin etiketi, randevu formunda seçilecek **hizmet adı** olur.

- İsterseniz blok ayarlarında **manuel ek hizmet satırları** da tanımlayabilirsiniz; menü + manuel birlikte listelenir.

### 3) Sayfaya randevu formu ekleyin

**Yönetim → Sayfalar** → ilgili sayfayı düzenleyin → içerik bloklarına **İletişim / randevu formu** ekleyin ve modu **Randevu** yapın.

Burada tanımlarsınız:

- **Çalışma günleri ve saat aralıkları** (hangi gün hangi saatler açık)
- **Slot süresi** (ör. 60 dk) — hem müşteri takvimi hem süre hesabı buna göre
- **Saat dilimi** (ör. `Europe/Istanbul`)
- Hizmet seçiminin gösterilip gösterilmeyeceği, e-posta alanının açılıp kapanması, not alanı, KVKK metinleri, gizlilik linki vb.

Sayfayı **yayınlayın**; taslak sayfada form bağlamı sunucuda doğrulanmayabilir.

### 4) Personel – hizmet eşlemesi (isteğe bağlı ama güçlü)

**Genel ayarlar → Tema özelleştirici** bölümünde (içeride JSON olarak) **randevu personeli** haritası: menüdeki **hizmet adı** (küçük harf eşlemesi Türkçe’ye duyarlı) ile **personel görünen adları** veya sistem id’leri.

- Bu eşleme yoksa müşteri “Uygun personel” görmez; sunucu yine de uygun kurallarla atama deneyebilir.
- Eşleme varsa: **Uygun personel** açılır; “Müsait personele otomatik ata” veya seçilen isim.

**Personel planlama** sayfası ile (yetkiniz varsa) zaman çizelgesi tarafını da yönetebilirsiniz; form ile aynı personel adları tutarlı olmalı.

### 5) Giden e-posta (müşteriye onay / red / hatırlatma için şart)

**Yönetim → Genel ayarlar** bölümünde **Giden e-posta (SMTP)** alanlarını doldurun:

- **SMTP sunucusu (host)**, port, **SSL/TLS** (genelde 465), **SMTP kullanıcı adı**, **SMTP şifresi**, **Gönderen (From)**
- Panelde boş bırakırsanız ortamda **`RESEND_API_KEY`** / **`MAIL_FROM`** kullanımı devreye girebilir (ayar metninde de belirtilir).
- SPF/DKIM için alan adı DNS’inizi işletmenizle uyumlu tutun.

SMTP / Resend hiçbiri uygun değilse müşteriye otomatik mailler **gidemez**. **Test mail gönder** ile teslimatı doğrulayın.

### 6) Yeni talep bildirimi — e-posta alıcıları

**İletişim** bölümünde (aynı genel ayarlar sayfasında):

- **Randevu bildirimi — admin e-postaları** — yeni talep gelince bu adreslere özet mail (`APPOINTMENT_NOTIFY_TO` ile birleşir; tekrar gönderilmez).
- **Randevu bildirimi — operatör e-postaları** — ikinci grup (`APPOINTMENT_OPERATOR_NOTIFY_TO` ile birleşir; gönderen adresi buraya yazmayın).

Admin listesi boşsa sistem **SMTP kullanıcı adresini** yedek alıcı olarak kullanabilir.

**Test:** **Randevu bildirimi testini gönder** düğmesi ile alıcıların postayı aldığını doğrulayın.

### 7) Telegram anlık bildirim (isteğe bağlı)

**Telegram anlık bildirim** kutusunda **Telegram Bot Token** ve **Telegram Chat ID** (tema alanlarında saklanır).

- Doldurulduğunda: **Yeni randevu talebi** (site veya panelden), **müşterinin bağlantıdan teyidi / iptali / tarih değiştirmesi**, **panelden iptal**, **hatırlatma gönderimi** gibi olaylarda tek bir sohbete özet mesaj düşer.
- **Telegram test bildirimi gönder** ile önce bağlantıyı doğrulayın.

Personel adları **Personel & roller → Görünen ad**; hizmet atamaları **Randevular / Personel Planlama** ile uyumlu tutulmalıdır (ayarlar sayfasındaki nota göre).

Telegram yoksa veya token eksikse sistem sessizce atlar (iş akışı durmaz).

### 8) (İsteğe bağlı) WhatsApp

**İletişim** bölümünde **WhatsApp (ülke kodu ile, örn. 90555…)** alanı doluysa panel satırlarında müşteriye hızlı **wa.me** ön doldurmalı mesaj açılabilir; onay e-postasındaki metin de WhatsApp için uyumlu üretilir.

---

## Bölüm C — Müşteri: formda sırayla ne olur?

1. **Ad Soyad** (zorunlu)  
2. **İstenen hizmet** (açıksa): menü + manuel seçenekler; değişince personel seçimi sıfırlanır.  
3. **Uygun personel** (personel eşlemesi varsa): “Otomatik” veya isim seçimi.  
4. **Tarih**: bugünden önce yok; yaklaşık 120 gün üzeri sınırlı.  
5. **Saat**: Önce tarih şart. Tüm “çalışma aralığına uygun” slotlar listelenir. Personel seçildiyse sunucu o kişinin **dolu saatlerini** elemez; dolu slotlar “(dolu)” yazıp seçilemez.  
6. **E-posta** (açıksa)  
7. **Telefon** (zorunlu, TR cep kuralı). Alandan çıkınca kayıtlı müşteri ise ad/e-posta otomatik dolabilir.  
8. **Not** (açıksa)  
9. **KVKK / açık rıza** kutuları  
10. **Gizlilik sözleşmesi** — kabul şart  
11. **Gönder**

Başarılı mesaj örneği: talebin alındığı, onay için dönüleceği. Arka planda kayıt **bekleyen (`pending`)** oluşur; çakışma kuralları (aynı saat, aynı gün aynı hizmet bekleyen talep, slot dolu, 1 saat yakınlık vb.) uygun değilse müşteri **sunucu mesajı** görür.

---

## Bölüm D — Talep geldikten sonra (otomatik)

1. **Yönetici/operatör e-postalarına** özet (ayarlardaki listeler + ENV).  
2. **Telegram** (ayarlıysa): “Yeni randevu talebi” + müşteri, telefon, hizmet, tarih, kaynak (site/admin), atanan personel.  
3. **Push** (tanımlı personel abonelikleri varsa) tetiklenebilir.

Müşteri henüz “onaylı” sayılmaz; işletme panele girer.

---

## Bölüm E — Yönetim paneli: günlük iş

**Randevular** sayfası: liste veya hafta görünümü.

- **Bekleyen** satırda **Onayla** / **Reddet**  
- **Onayla** dediğinizde:  
  - Durum `approved` olur.  
  - Müşteri **e-posta adresi varsa** onay metni gönderilir (SMTP şart).  
  - Metinde **tek kullanımlık yönetim bağlantısı** üretilir: müşteri kendi randevusunu **teyit**, **iptal** veya (kural uygunsa) **tarih değiştirme** sayfasına gider.  
  - **WhatsApp** bağlantısı (numara uygunsa) aynı metinle ön doldurulur.  
  - Onay anında token/kod veritabanına güvenli şekilde yazılır (süre dolmadan kullanılabilir).

- **Reddet**: Müşteriye ret metni (e-posta varsa) gidebilir.

- Diğer durumlar (işletmenizin sürecine göre): **İptal talebi**, **İptal**, **Geldi**, **Gelmedi** vb. — panel butonları ve geçiş kuralları kodda tanımlıdır (ör. geldi/gelmedi çoğu yerde önce teyit beklenir).

**Panelden manuel randevu** oluşturma: Aynı takvim ve kurallar; kaynak “Admin panel” olarak Telegram’da işlenebilir.

---

## Bölüm F — Müşteri: e-postadaki bağlantı (`/rezervasyonbilgi`)

Onay sonrası veya **hatırlatma** mailindeki link formatı (sizin alan adınızla):  
`https://siteniz.com/rezervasyonbilgi?t=...`  
(Eski yayınlara `/rezervasyoniptal` da yönlendirilir.)

Sayfada müşteri:

### Teyit (`confirm`)

- Randevu durumu **teyitli (`confirmed`)** olur (veya zaten teyitliyse mesaj verilir).  
- **E-posta** varsa kısa bilgilendirme gidebilir.  
- **Telegram**: “Müşteri randevusunu teyit etti”.

### İptal (`cancel`)

- Randevu **iptal (`cancelled`)** olur; token geçersiz hale gelir.  
- Müşteri **e-posta** varsa iptal bilgisi gider.  
- **Telegram**: “Randevu iptal edildi” + işlemi yapan satırı.  
- İsteğe bağlı: Ayarlardaki WhatsApp hattına bilgi mesajı için hazır `wa.me` linki dönülebilir.

### Tarih değiştirme (`reschedule`)

- Randevuya **en az 1 saat** kalması gerekir; aksi halde güncellenmez.  
- Yayında ilk randevu bloğunun takvimine uygun tarih/saat seçilir.  
- Atanan personel varsa o saatte **meşgul mü** kontrol edilir.  
- Başarılı olunca kayda not düşülür. **Telegram**: “Müşteri randevuyu güncelledi”.

Bağlantı **geçersiz veya süresi dolmuşsa** sayfa/API hata verir.

---

## Bölüm G — Hatırlatma e-postası (cron)

Amaç: **Yarın** gerçekleşecek, **onaylı** ve **e-posta adresi dolu** randevulara bir gece öncesi hatırlatma.

- Sunucuda **`POST /api/admin/appointments/reminders`** çağrılır (genelde dış cron: Günlük, Vercel Cron vb.).  
- Güvenlik: İstekte **`APPOINTMENT_REMINDER_CRON_SECRET`** — `Authorization: Bearer ...` veya `X-Cron-Secret` başlığı.  
- Zaman penceresi kodda yaklaşık **23–25 saat sonra** başlayan randevuları hedefler (yani “yarın” bandı).  
- Her başarılı gönderimde randevu notuna **“Teyit hatırlatması gönderildi”** eklenir; aynı kayda ikinci kez hatırlatma gitmez.  
- Mail metni: teyit/iptal için **aynı türden yönetim bağlantısı** üretilir (token yenilenir).  
- **Telegram** (ayarlıysa): “Randevu teyit hatırlatması gönderildi” özeti.

**Not:** Cron’un “varsayılan site adresi” ortam değişkenine bağlı olabilir; canlı müşteri yüzü her zaman kendi domain’indedir. Hatırlatma linkinin doğru kökte üretilmesi için barındırma ve `NEXT_PUBLIC_SITE_URL` uyumunu gözden geçirin.

---

## Bölüm H — Telegram mesaj türleri (özet)

| Tetikleyici | Örnek başlık / içerik |
|-------------|------------------------|
| Yeni talep (web) | “Yeni randevu talebi”, işletme adı, kaynak: Web sitesi, tarih, müşteri, iletişim, hizmet, atanan personel |
| Yeni talep (panel) | Aynı; kaynak: Admin panel; oluşturan kullanıcı |
| Müşteri teyit | “Müşteri randevusunu teyit etti” |
| Müşteri iptal (link) | “Randevu iptal edildi” — işlemi yapan: Müşteri (iptal bağlantısı) |
| Müşteri tarih değiştirdi | “Müşteri randevuyu güncelledi” |
| Panel iptal | “Randevu iptal edildi” — işlemi yapan: panel kullanıcı adı |
| Hatırlatma gönderildi | “Randevu teyit hatırlatması gönderildi” + müşteri özeti |

Token/chat yoksa bu adımlar **atlanır**, randevu akışı durmaz.

---

## Bölüm I — Müşteriye giden e-posta türleri (özet)

| Durum | Örnek konu / içerik |
|-------|---------------------|
| Onay (panel) | Konu: “Randevunuz onaylandı”; gövde: tarih, hizmet + **yönetim bağlantısı** (teyit/iptal) |
| Red (panel) | Uygun bulunmadı metni |
| Teyit (müşteri link) | “Teyidiniz alındı” kısa mail |
| İptal (müşteri link) | İptal bilgisi |
| Hatırlatma (cron) | “Teyit hatırlatma ve teyit” + yönetim bağlantısı |

Tümü **SMTP + transactional** ayarıyla; alıcı müşteri e-postası kayıtta olmalı.

---

## Bölüm J — Sık kontrol listesi (sorun giderme)

| Sorun | Bakılacak yer |
|-------|----------------|
| Form hiç açılmıyor | Randevu modülü açık mı? Sayfa yayında mı? Blok modu randevu mu? |
| Hizmet listesi boş | Menüde “Hizmetlerimiz” altı mı? Manuel hizmet satırı eklendi mi? |
| Personel görünmüyor | Tema personel haritası; hizmet adı menü ile birebir (Türkçe küçük harf eşlemesi) |
| Mail gitmiyor | SMTP; gönderen alanı; alıcı müşteri e-postası |
| Telegram yok | Bot token + Chat ID; test bildirimi |
| Bağlantı “geçersiz” | Süre dolmuş token; randevu artık onaylı/teyitli değil |
| Tarih değiştiremiyorum | Randevuya 1 saatten az kaldı mı? |

---

## Bölüm K — Tek cümleyle sistem özeti

**Müşteri sitede takvime uygun talep bırakır; işletme panelden onaylar veya reddeder; onay sonrası müşteri e-postadaki güvenli linkle teyit veya iptal eder; isterseniz Telegram ve hatırlatma ile süreç tamamlanır.**

---

*Bu rehber; randevu formu bileşeni (`ContactFormBlock`), `POST /api/appointments`, `GET /api/appointments/availability`, `PATCH /api/admin/appointments/[id]`, `POST /api/appointments/cancel`, `POST /api/admin/appointments/reminders`, ayarlar formu ve Telegram bildirim modülleriyle uyumludur.*
