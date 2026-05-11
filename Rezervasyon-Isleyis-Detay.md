# Rezervasyon sistemi — sadece randevu işleyişi (detaylı)

Bu metin **çok kiracılı mimari, domain veya platform paneli** anlatmaz; yalnızca bir işletme bağlamında **müşteri randevu talebinden** başlayıp **kayıt, kurallar, bildirimler, panel kararları ve müşteri self-servis adımlarına** kadar uçtan uca akışı özetler.

---

## 1. Başlangıç durumu (sistem ne bekliyor?)

1. **Randevu modülü** ilgili kiracı için açık olmalı (kapalıysa hem site formları hem API “randevu kapalı” döner).  
2. Sitede **yayında** bir sayfa blokunda **iletişim formu**, modu **“randevu” (`appointment`)** olacak şekilde yapılandırılmış olmalı. Bu blokta şunlar tanımlıdır:  
   - Çalışma günleri ve saat aralıkları (`appointmentDays`)  
   - **Slot süresi** (ör. 60 dakika)  
   - **Saat dilimi** (ör. `Europe/Istanbul`)  

3. (İsteğe bağlı) Tema / ayarlarda **hizmet → personel** eşlemesi varsa sistem hizmet seçimine göre **personel atayabilir** veya müşteri personel seçerse o kişinin o saatte başka randevusu var mı kontrol edilir.

---

## 2. Müşteri tarafı: talep nasıl oluşur?

1. Ziyaretçi ilgili sayfada **randevu formunu** görür (isim, **Türkiye cep telefonu**, istenirse e-posta, hizmet seçimi, tarih, saat, not, KVKK onayları vb.).  
2. Form, arka planda **`POST /api/appointments`** ile gönderilir.  
3. Sunucu sırasıyla kontrol eder:  
   - **Honeypot** alanı doluysa isteği sessizce reddeder (bot koruması).  
   - Gönderilen **form bağlamı** (`blockId`, `pageSlug`, `header`/`footer`/`page`) ile veritabanında **aynı blok**, mod **randevu** mu — değilse hata.  
   - **`preferredStart` (ISO tarih/saat)** gerçekten o blok için tanımlı **takvime ve slot ızgarasına** uyuyor mu (`validatePreferredStartAgainstSchedule`). Uymuyorsa: *“Seçilen saat çalışma saatleri veya randevu aralığına uymuyor.”*  
   - Cep telefonu formatı TR kurallarına uygun mu.  

4. **Bitiş zamanı** başlangıç + slot süresi ile hesaplanır (ör. 60 dk slot → bitiş +60 dk).

---

## 3. Personel ve “kim bu randevuda?”

- Tema token’larında **hizmet adı → personel** (id veya görünen ad) haritası varsa:  
  - Müşteri belirli bir **personel** seçtiyse: bu personelin o hizmet için listede olması ve **o saatte çakışan başka randevusu olmaması** gerekir.  
  - Seçmediyse sistem müsait adaylar arasından **otomatik** bir personel seçmeye çalışır; hiçbiri boş değilse hata.  
- Atanan personel, kayıt **`notes`** alanının başında özel bir işaret ile saklanır: `[[STAFF:...]]` — böylece panel ve müsaitlik API’si aynı kaynaktan okur.

---

## 4. Veritabanına yazılırken ne oluyor?

Kayıt **`status: "pending"` (bekliyor)** ile oluşturulur. İş kuralları (transaction içinde) şunları doğrular:

| Kural | Anlamı |
|--------|--------|
| **Aynı kişi + aynı başlangıç + aynı hizmet** (normalize isim/telefon ile) | Zaten kayıt varsa **çift kayıt** kabul edilmez. |
| **Aynı gün, aynı hizmet, hâlâ bekleyen (`pending`) başka talep** | Yeni pending talep engellenebilir (önce mevcut talebin sonuçlanması beklenir). |
| **Farklı hizmet ama zaman çok yakın** | Aynı müşteri için mevcut randevuya göre **en az 1 saat** aralık kuralı (çakışma önlemi). |
| **Slot dolu** | O saatte başka onaylı/pending kayıt varsa slot kapatılır. |
| **Telefon zorunlu** | Kayıtta telefon yoksa kayıt oluşturulmaz. |

Başarılı olunca **CRM**: aynı telefon anahtarıyla müşteri kartı güncellenir / oluşturulur (`CrmContact`).

---

## 5. Talep oluştuktan sonra: kim ne bildirimi alır?

Kayıt oluştuktan sonra (işletme ayarlarında tanımlıysa):

- **Yönetici / operatör e-postalarına** “Yeni randevu talebi” özeti gidebilir (`appointmentNotifyAdminEmails`, `appointmentNotifyOperatorEmails` ve ortam değişkenleri birleşimi — `appointmentInboundNotifyRecipients`).  
- **Push bildirimi** (tanımlı personel abonelikleri), **Telegram** bildirimi gibi kanallar tetiklenebilir.

Müşteri tarafında **otomatik “onaylandınız”** bu aşamada zorunlu değildir; talep **bekleyen** kalır ta ki panelden onaylanana kadar.

---

## 6. Müşteri: müsait saatleri kim hesaplıyor?

- **`GET /api/appointments/availability`**: Seçilen **tarih** + yayınlanan form bloğu + isteğe bağlı **personel adı** ile o gün için üretilmiş **slot saat etiketleri (HH:mm)** döner.  
- Personel verilmişse her slot için o personelin **o anda başka randevusu var mı** kontrol edilir; sadece boş slotlar listelenir.

Paneldeki manuel randevu formu da benzer takvim/slot mantığını kullanır (yönetim içi `AppointmentForm`).

---

## 7. Yönetim paneli: randevu listesi ve durumlar

Panelde (`/admin/appointments`) personele göre **tüm randevular** veya **yalnızca kendine atananlar** (yetkiye bağlı) görülebilir.

**Durum (`status`)** alanı örnek anlamlar (arayüzde Türkçe etiketler):

| Kod | Panelde (örnek) |
|-----|------------------|
| `pending` | Bekliyor — müşteri talebi, onay bekliyor |
| `approved` | Onaylı |
| `confirmed` | Teyitli |
| `rejected` | Reddedildi |
| `cancelled` | İptal |
| `cancel_request` | İptal talebi |
| `checked_in` | Geldi |
| `no_show` | Gelmedi |

Yetkili kullanıcı **`PATCH /api/admin/appointments/[id]`** ile:

- **Onay / red / iptal / geldi / gelmedi** gibi durum güncelleyebilir (aynı istekte hem durum hem diğer alanlar gönderilmez — ayrı istekler).  
- Tarih, hizmet, müşteri bilgisi vb. değişiklikleri ayrı kurallara tabidir (çakışma, slot, kilit süreleri).

Onay/red sonrası **müşteriye e-posta** (şablon ve `sendTransactionalEmail` ile), **WhatsApp ön doldurma**, **Telegram** gibi yan etkiler tetiklenebilir. Onaylandığında müşteri e-postasına **iptal / teyit / yeniden zamanlama** için güvenli link üretimi için token saklama yapısı devreye girer.

---

## 8. Müşteri self-servis: e-postadaki bağlantı

Müşteriye giden mailde (onay sonrası üretilen) **token** ile **`/api/appointments/cancel`** (ve ilgili sayfa akışı) üzerinden:

- **İptal**  
- **Teyit (`confirm`)**  
- **Yeniden tarih/saat seçimi (`reschedule`)** — yine takvim ve çakışma kurallarına tabi  

işlemleri yapılabilir. Başarılı olunca kayıt güncellenir, gerekirse müşteriye kısa bilgi maili gider.

---

## 9. Hatırlatma (cron / manuel)

- **`POST /api/admin/appointments/reminders`**: Genelde **yarın** gerçekleşecek, durumu **`approved`** ve e-postası dolu randevular için hatırlatma e-postası gönderir.  
- Güvenlik için **`APPOINTMENT_REMINDER_CRON_SECRET`** başlığı ile çağrılır; yetkili personel de panel üzerinden tetikleyebilir.  
- Gönderim sonrası kayda not düşülebilir (*“Teyit hatırlatması gönderildi”* önekli).

---

## 10. Özet akış diyagramı (tek işletme)

```
Müşteri formu → Doğrulama (takvim, telefon, slot, personel)
       → Kayıt: pending
       → Operatöre bildirim (ayarlara göre)
       → Panel: liste / takvim
       → Karar: onay | red | iptal | …
       → (Onay sonrası) Müşteri e-postası + self-servis linkler
       → (Zamanlanmış) Hatırlatma maili
```

---

## 11. Sık sorulanlar (sadece işleyiş)

**S: Talep hemen “kesin randevu” mu?**  
C: Hayır; önce **`pending`**. İşletme onaylayınca **`approved`** (ve süreçte `confirmed` vb.) olur.

**S: Aynı kişi aynı gün iki kere talep edebilir mi?**  
C: Aynı hizmette bekleyen talep varken genelde hayır; farklı hizmetlerde zaman yakınlığı kuralları devreye girer.

**S: Neden bazen “slot dolu” veya “personel müsait değil”?**  
C: Takvimde o saat başka randevu ile dolu veya seçilen personel o saatte meşgul.

**S: Randevu modülü kapalıysa ne olur?**  
C: Site randevu formu/API randevu oluşturmaz; panel randevu sayfaları da modül kapalı uyarısı verir.

---

*Bu belge projedeki `POST /api/appointments`, `GET /api/appointments/availability`, `PATCH /api/admin/appointments/[id]`, `POST /api/appointments/cancel`, `POST /api/admin/appointments/reminders` ve `create-appointment-record` / `update-appointment-record` iş kurallarına dayanır.*
