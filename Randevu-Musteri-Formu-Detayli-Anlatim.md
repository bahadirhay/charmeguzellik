# Müşteri randevu formu — detaylı anlatım

Bu metin **yalnızca** ziyaretçinin sitede gördüğü randevu formunun nasıl işlediğini anlatır: hangi alanlar var, sırayla ne olur, hizmet ve personel listesi nereden gelir, tarih/saat nasıl seçilir, gönderimden sonra ne mesaj görünür. İşletme paneli veya teknik altyapı burada kısaca yalnızca “talebin kayda geçtiği” ölçüsünde geçer.

**Admin paneli, kurulum sırası, e-posta / Telegram / iptal–teyit–hatırlatma akışı** için bkz. [`Rezervasyon-Tam-Rehber-Musteri-ve-Admin.md`](./Rezervasyon-Tam-Rehber-Musteri-ve-Admin.md).

---

## Form nerede çıkar?

Randevu, sitedeki bir sayfada **iletişim / randevu bloğu** olarak eklenir. Blok “randevu modu”nda olduğunda müşteri **randevu talebi** oluşturur; sıradan iletişim mesajı değildir. Formun altında yönetimden gelen bir **başlık** olabilir.

---

## 1. Ad Soyad

İlk alan genelde **Ad Soyad**dır. Zorunludur; randevu kim için isteniyorsa o kişinin adı yazılır.

---

## 2. İstenen hizmet (açıksa)

Yönetim tarafında bu bölüm **açık** seçilmişse müşteri bir **açılır liste**den hizmeti seçer.

- **Liste nereden gelir?**  
  - Çoğu kurulumda site menüsündeki **“Hizmetlerimiz”** (veya seçilen menü dalı) altındaki **yayında olan alt bağlantılar** otomatik olarak hizmet adı olarak listelenir.  
  - Buna ek olarak blok ayarlarına **manuel hizmet satırları** da eklenebilir; bunlar listenin devamında görünür.

- **Ne zaman görünmez?**  
  Yönetimde “hizmet seçimini gösterme” kapatılmışsa bu satır yoktur; arka planda hizmet adı “Belirtilmedi” gibi genel bir ifadeyle kaydedilebilir.

- **Hizmet değişince ne olur?**  
  Müşteri başka bir hizmet seçerse, **personel seçimi sıfırlanır** (aşağıda). Çünkü her hizmet için uygun personel farklı olabilir.

Liste yüklenirken kısa süre **“Hizmet listesi yükleniyor…”** benzeri bir bilgi çıkabilir. Menüde uygun yapı yoksa yöneticiye yönelik uyarı metinleri görünebilir; müşteri için anlamı “liste boş veya eksik yapılandırma” olabilir.

---

## 3. Uygun personel (hizmet seçildikten ve eşleme varsa)

Hizmet alanı açıkken, yönetimin panelde tanımladığı **hizmet ↔ personel** eşlemesi varsa **“Uygun personel”** seçimi çıkar.

- İlk seçenek: **“Müsait personele otomatik ata”** — Müşteri kimseyi seçmez; sistem uygun bir personele atamayı sunucuda dener.  
- Diğer seçenekler: O hizmet için tanımlı personel **adları** (örnek: “Ayşe”, “Mehmet”) listelenir.

**Önemli:** Personel listesinin **hangi isimlerle** dolacağı, paneldeki tema/ayarlarda her **hizmet etiketi** için hangi personelin bağlandığına bağlıdır (menüdeki hizmet adıyla aynı metin eşleşmelidir).

Personel satırı **hiç açılmaz** ise: Ya hizmet seçimi kapalıdır ya da bu hizmet için personel eşlemesi tanımlı değildir; müşteri yine de tarih/saat seçip talep bırakabilir (sunucu tarafında uygun kurallarla atanır veya hizmete personel zorunluysa hata dönebilir).

---

## 4. Tarih

**Tarih** alanı takvimden seçilir.

- **Bugünden önceki günler** seçilemez.  
- **Üst sınır:** Genelde bugünden itibaren yaklaşık **120 gün** ilerisi (form içi sınırlama).  
- Tarih, blokta ayarlanan **saat dilimi**ne göre “bugün” hesaplanır (örneğin Türkiye saati).

Müşteri tarihi değiştirdiğinde **saat seçimi temizlenir**; çünkü her günün uygun saat dilimi farklıdır.

**O gün salon kapalıysa** veya yayınlanan **çalışma tablosunda** o güne ait aralık yoksa, tarih seçildikten sonra altta uyarı benzeri bir metin gösterilir: o tarihte tanımlı slot yok demektir.

---

## 5. Saat (çalışma aralığı)

**Saat** ikinci bir açılır listedir; etiket genelde **“Saat (çalışma aralığı)”** şeklindedir.

- **Önce tarih şart:** Tarih seçilmeden saatte yalnızca “Önce tarih seçin” benzeri bir seçenek görünür.  
- Tarih seçildikten sonra, o gün için blok ayarlarındaki **çalışma gün/saatleri** ve **slot süresi** (ör. 30 veya 60 dakika) kullanılarak **dakika dakika başlangıç saatleri** üretilir (ör. 09:00, 10:00, 11:00).

### Personel seçildiyse veya “otomatik” dışında biri seçildiyse

Personel seçili olduğunda (veya filtre aktifken), tarayıcı **sunucuya sorar**: Bu tarihte bu personel için **hangi saatler hâlâ boş?**

- Saatler yüklenirken saat alanı **kısa süre devre dışı** kalabilir ve listede “yükleniyor” satırı görünebilir.  
- Gelen cevapta **yalnızca müsait saatler** gerçekten seçilebilir; diğer saatler listede **“(dolu)”** olarak görünüp seçilemez olabilir.

Hiç müsait saat kalmadıysa, uyarı metni: seçilen personelin o tarihte **boş slotu kalmadığını**; dolu saatlerin pasif göründüğünü anlatır.

### Personel “otomatik” veya personel listesi yoksa

Tüm **teorik** çalışma aralığı slotları listelenir; doluluk kontrolü o ayarda daha gevşek olabilir — yine de gönderim anında sunucu **çakışma** veya **kurallar** nedeniyle reddedebilir.

---

## 6. E-posta (açıksa)

Açıksa isteğe bağlı veya zorunlu olabilir (blok ayarına göre). Randevu onayı veya hatırlatma için işletme bu adresi kullanabilir.

---

## 7. Telefon (zorunlu)

**Telefon** alanı randevu formunda **her zaman görünür ve zorunludur.**

- Format olarak **Türkiye cep telefonu** kuralına uygun olması beklenir (başında 0 ile veya ülke kodu ile kabul edilen biçimler; ipucu metni formda yer alır).  
- Alanın altında kısa bir not olabilir: **Kayıtlı bir numara** CRM’de varsa, müşteri alandan çıkınca (odaktan çıkınca) **ad** ve **e-posta** boşsa bazen **otomatik doldurulabilir** — böylece daha önce kayıt olmuş müşteriler tekrar yazmak zorunda kalmaz.

---

## 8. Not (opsiyonel, açıksa)

Ek açıklama: özel istek, hastalık, tercih edilen oda vb. Açık değilse bu kutu yoktur.

---

## 9. Açık rıza / KVKK kutuları

Blokta tanımlıysa bir veya daha fazla **onay kutusu** çıkar (ör. açık rıza metinleri). Bazıları zorunlu işaretlenebilir. Bu kutular işaretlenmeden gönderim yapılamaz.

---

## 10. Gizlilik sözleşmesi

Formun altında **gizlilik sözleşmesi** bağlantısı ve “okudum, kabul ediyorum” kutusu vardır. Kabul edilmeden gönderim **bilinçli olarak engellenir**; hata mesajı bunu söyler.

---

## 11. Gönder

Müşteri **Gönder** dediğinde tarayıcı bilgileri sunucuya iletir. Sunucu şunları kontrol eder (özet):

- Çalışma saatleri ve slot ile uyum  
- Telefon geçerliliği  
- Gizlilik kabulü  
- Gerekirse seçilen personelin o saatte müsait olması  
- Çift talep, slot doluluğu, işletmenin koyduğu diğer kurallar  

**Başarılı olursa** ekranda yeşil bir onay mesajı görülür; örneğin: talebin alındığı, onay için iletişime geçileceği yazılır. Form temizlenir.

**Başarısız olursa** kırmızı bir kutu içinde sunucudan gelen açıklama (veya genel bir uyarı) çıkar: örneğin saat dolu, aynı gün aynı hizmet için zaten bekleyen talep var, personel o saatte meşgul vb. Müşteri tarih/saat veya seçimleri düzelterek yeniden deneyebilir.

---

## Müşteri gözüyle tek paragraf

**Adını yazarsınız; isterseniz menüden hizmeyi seçersiniz. Bu hizmete göre uygun personeller listelenir veya “otomatik” bırakırsınız. Tarihi seçince o güne ait çalışma saatlerine bölünmüş saatler belirir; personel seçtiyseniz sadece o kişinin boş olduğu saatler seçilebilir. Telefon zorunludur; onay kutularını ve gizlilik şartını işaretlersiniz. Gönder dediğinizde talep işletmeye düşer; ekranda onaylanmadan önce “talep alındı” benzeri bilgi görürsünüz.**

---

*Bu anlatım, projedeki `ContactFormBlock` randevu modu ve `POST /api/appointments` ile uyumludur.*
