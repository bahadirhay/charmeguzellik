# Rezervasyon sistemi — herkes için anlatım

Bu belge, teknik bilgisi olmayan kişilerin de anlayabileceği şekilde sistemin ne yaptığını, nasıl çalıştığını ve son dönemde yapılan iyileştirmeleri özetler. Sunum, ekip içi bilgilendirme veya müşteriye özet vermek için kullanılabilir.

---

## 1. Bu sistem ne işe yarıyor?

**Kısaca:** Müşteri web siteniz üzerinden randevu talebi gönderir. Siz yönetim panelinden bu talepleri görürsünüz; uygunsa onaylar, değilse reddedersiniz. Onay, ret, hatırlatma gibi durumlarda müşteriye e-posta (ve yapılandırdığınız kanallarla WhatsApp, Telegram vb.) gidebilir.

**Günlük hayattan benzetme:** Randevuyu telefonla değil, sitenizdeki formdan “istek” olarak bırakıyorlar; siz de bir ajanda veya defter gibi panelden yönetiyorsunuz — sadece defter internet üzerinde ve kayıtlar veritabanında tutuluyor.

---

## 2. “Bir program, çok işletme” (çok kiracılı yapı)

Sizin kurduğunuz yapıda **aynı uygulama kodu** ve **aynı veritabanı sunucusu** kullanılıyor; buna genelde “SaaS” veya “çok kiracılı (multi-tenant)” denir.

**Önemli nokta:** Bu, “herkesin verisi birbirine karışıyor” anlamına gelmez. Her işletmenin verileri veritabanında **ayrı bir kiracı (tenant)** kutusuna bağlanır. Örneğin:

- `charmeguzellik.com` → A işletmesinin kutusu  
- `randevu.techizmet.com` → B işletmesinin kutusu  
- İleride eklenecek başka bir alan adı → O müşterinin kutusu  

**Basit kural:** Hangi **adresten** site açılmışsa, sistem o adresi tanır ve **o işletmenin** sayfalarını, ayarlarını ve randevu listesini gösterir. Başka işletmenin listesine geçmez.

---

## 3. Alan adı (domain) nasıl “doğru dükkânı” seçiyor?

Ziyaretçi tarayıcıya bir adres yazar (örneğin `https://randevu.techizmet.com`). Sunucu bu isteğin **hangi host’tan** geldiğini bilir. Veritabanında her müşteri için **alan adı → kiracı kimliği** eşlemesi tutulur (`TenantDomain` tablosu).

**Sonuç:** Aynı program çalışır; ama ekranda gördüğünüz içerik, o alan adına atanmış işletmeye aittir. Bunu değiştirmek için kodda “şu sayfayı göster” demek yeterli değil — önce o işletmenin domain kaydı doğru olmalı.

---

## 4. Merkez yönetim paneli (platform)

Bazı işletmeler sadece kendi salonunu yönetir. Sizin senaryonuzda **bir “merkez” site** vardır (`randevu.techizmet.com` gibi): buradan **yeni müşteri (yeni kiracı / yeni site)** açılabilir.

Bunun çalışması için sunucuda bir ortam değişkeni kullanılır: hangi kiracının kimliği “platform kontrolü” sayılacağı. Bu, **sadece bu merkez panel menüsünün** (örneğin “Müşteri siteleri”) görünmesi ve yeni kiracı oluşturma yetkisi için kullanılır. Randevu alma veya normal salon paneli ile karıştırılmamalıdır.

**Özet:** Merkez panel = fabrika anahtarı; diğer salonlar = fabrikadan çıkan ayrı dükkânlar.

---

## 5. Sayfalar, ayarlar, menü — hepsi kiracıya özel mi?

**Evet.** Her kiracının kendi:

- **Site ayarı** satırı (site adı, e-posta ayarları, tema, sosyal linkler, randevu bildirim e-postaları vb.)  
- **Sayfaları** (anasayfa, hizmetler, iletişim içerikleri)  
- **Menü öğeleri**  
- **Randevu kayıtları**  
- **Personel / roller** (tanımlandıysa)  

bulunur.

**Son dönem düzeltme (önemli):** Eskiden yönetim ayarları bazen yanlışlıkla veritabanında tek bir “sabit satıra” (`id: 1` gibi) yazılabiliyordu; canlı sitede gösterilen içerik ise kiracının kendi satırındandı. Bu yüzden “panelde değiştirdim ama sitede değişmedi” sorunu yaşanıyordu. Artık panel, **o an giriş yapılan / o domainin** kiracısının satırını kullanıyor.

---

## 6. Site adı, sekme başlığı ve Google (SEO)

**Site adı:** Üst menüde ve birçok yerde görünen marka adı; ayarlardan gelir.

**Tarayıcı sekmesindeki başlık ve arama sonuçları:** Birden fazla kaynaktan oluşur:

- **Ana sayfa** için yayında bir “home” sayfası varsa, o sayfanın kendi “meta başlık” alanı öncelikli olabilirdi; klon içerikte eski başlık kalmasın diye **Ayarlar’daki “varsayılan meta başlık”** ana sayfada üst sıraya alındı.
- Tüm sitede **“… · Site adı”** gibi bir şablon vardı; sabit metin kalmaması için kök şablon **o kiracının site adına** bağlandı.
- **robots.txt** ve **sitemap.xml** artık mümkün olduğunca **hangi alan adıyla girildiyse** o köke göre üretiliyor; tek bir yanlış sabit domain (eski ortam değişkeni) yüzünden Google’a yanlış adres gitmesi azaltıldı.

**Pratik tavsiye:** Randevu sitesinde hâlâ “Charme” yazıları görünüyorsa bu çoğu zaman **sayfa içeriği ve blokların** kopyalanmış olmasından kaynaklanır — bunları panelden **Sayfalar** ve blok düzenleyici ile değiştirmeniz gerekir; sistem otomatik olarak tüm metinleri sıfırlamaz.

---

## 7. Randevu akışı — uçtan uca (basit adımlar)

1. **Müşteri** sitede tarih/saat veya iletişim formu ile talep bırakır.  
2. Kayıt **o işletmenin** randevu listesine düşer (`tenantId` ile).  
3. **Siz** panelden onaylar veya reddedersiniz.  
4. **E-posta** (ve kurduğunuz kanallar) devreye girer: müşteriye veya size bildirim gidebilir.  
5. **İptal / teyit linki** e-postada olabilir; müşteri linke tıklayınca sunucu **doğru randevuyu** bulur ve işlemi yapar.

**Son dönem güvenlik ve hız iyileştirmesi:** İptal linkindeki gizli anahtar artık veritabanında hash ile saklanıyor ve **hash üzerinden doğrudan** aranıyor. Eskiden çok sayıda kayıt taranıp içinden aranıyordu; bu hem yavaş hem riskliydi. Şimdi uygun **veritabanı indeksi** ile tek seferde bulunuyor.

---

## 8. E-posta adresleri ve “link hangi sitede açılacak?”

Giden e-postalardaki bağlantıların adresi, mümkün olduğunca **istek hangi alan adından gelmişse** ona göre kuruluyor. Böylece Charme panelinden işlem yapıldığında linkler Charme domain’ine, Randevu’dan yapıldığında Randevu domain’ine uygun olur.

**Otomatik cron işleri** (örneğin günlük hatırlatma) tarayıcı yoktur; o durumda sistem “varsayılan kök adres” olarak genelde **ortam değişkenindeki** `NEXT_PUBLIC_SITE_URL` veya benzeri yedeği kullanır. Bu yüzden bu değişkeni hangi işletmeyi “birincil” saydığınıza göre seçmek mantıklıdır; çok domain kullanıyorsanız “tek env ile her şey” mümkün ama otomatik görevlerin hangi kökte link üreteceğini bilmeniz gerekir.

---

## 9. Yeni bir müşteri / yeni alan adı eklemek

**Teknik olarak gerekenler (özet):**

1. **DNS:** Alan adı Vercel’e (veya kullandığınız barındırmaya) yönlendirilir.  
2. **Barındırma:** O domain bu projeye **Custom Domain** olarak eklenir.  
3. **Veritabanı:** Bu host, ilgili kiracıya bağlanır (`TenantDomain`).  
4. **İçerik:** O kiracı için sayfalar, ayarlar, menü doldurulur veya şablon kopyalanır.

**Her yeni müşteri için `NEXT_PUBLIC_SITE_URL` değiştirmek zorunda değilsiniz.** Çok site aynı projede çalışır; kritik olan domain → kiracı eşlemesinin doğru olmasıdır.

---

## 10. Sunucu ve veritabanı (çok kısa)

- **Vercel:** Uygulamanın çalıştığı yer (Next.js).  
- **Neon (veya PostgreSQL):** Verilerin saklandığı yer.  
- Neon’daki **proje adını** değiştirmek bağlantı adresinizi bozmaz; sadece konsolda görünen isimdir.

**Migration:** Şema değişiklikleri (örneğin indeks ekleme) üretimde `prisma migrate deploy` ile uygulanmalıdır; aksi halde kod yeni hali beklerken veritabanı eski kalabilir.

---

## 11. Sık sorulan netleştirmeler

**S: Aynı veritabanında herkes varsa veri güvenliği nasıl sağlanıyor?**  
C: Uygulama kodu her sorguda **kiracı kimliğini** kullanır; A işletmesinin paneli B’nin kaydına id ile “tahminen” gitmez. Ek katman olarak ileride veritabanı düzeyinde kural (ör. Row Level Security) da eklenebilir; şu an mantık uygulama katmanında.

**S: Charme ve Randevu aynı projede; biri diğerini etkiler mi?**  
C: İçerik ve ayarlar kutuları ayrı olduğu sürece hayır. Ortam değişkenleri bazı **varsayılan** davranışları (ör. cron link kökü, metadata bazı yerler) etkileyebilir; bu yüzden kritik yerlerde istek **Host**’una geçildi.

**S: Randevu sitesinde hâlâ Charme metinleri var — sistem hatası mı?**  
C: Genelde hayır; kopyalanan sayfa blokları ve metinler hâlâ eski markayı içeriyordur. Bunları **Sayfa düzenleyici** ve **Ayarlar** ile güncellemek gerekir.

---

## 12. Tek paragrafta özet (sunuma son cümle)

**Aynı rezervasyon motorunu birden çok işletme kullanır; her işletme kendi alan adıyla kendi vitrinini ve kendi randevu kutusunu görür. Ayarlar, sayfalar ve bildirimler birbirine karışmaz; son iyileştirmelerle panel kayıtları ve teknik link üretimi de bu ayrıma uyumlu hale getirildi.**

---

*Bu belge, projedeki çok kiracılı mimari, domain çözümlemesi, site ayarları, SEO/robots/sitemap, e-posta kök adresi, iptal token araması ve ortam değişkenleriyle ilgili yapılan güncellemeleri anlatmak için yazılmıştır.*
