# Satisfying Lig ⚽

Kendi kendine oynayan, **hiç durmayan canlı bir "satisfying" futbol ligi**: günün her saatinde **her 3 dakikada bir maç saati** vardır; her saatte ligin bir maçı ve aynı anda **yükselme liginin** (havuzdaki 12 kulübün kendi ligi) bir maçı başlar, her maç **90 saniye** sürer; siteye giren herkes istediği maçı, herkesle aynı anda izler. Tek dosyalık bir tarayıcı uygulamasıdır; sunucu gerekmez. Ayrıca Reels/TikTok/Shorts videosu üreten bir **stüdyo** modu vardır (`?studio`).

Her maçta iki kulüp dikey bir futbol sahasında karşılaşır: her takımın bir kalecisi ve sahada 4 oyuncusu vardır (2 defans, orta sahada kaptan, 1 forvet); her oyuncu sahanın kendi üçte birinde dolaşır ve topa dokununca onu rakip kaleye doğru gönderir. Top duvarlara çarptıkça hızlanır, kaleciler topu takip eder. 90 saniyenin sonunda **çok gol atan kazanır**; berabere biterse beraberliktir. Sonuç kalıcı bir **lig tablosuna** işlenir (galibiyet 3, beraberlik 1 puan).

- Kurulum yok: `index.html` dosyasını Chrome'da açmanız yeterli.
- Dikey 1080×1920 (9:16) video, 60 FPS, sesli kayıt.
- Her maç, kurulurken üretilen rastgele bir **seed** (32 bit) ile oynanır; seed arayüzde ve dosya adlarında görünmez. Aynı seed + aynı takımlar + aynı ayarlar = birebir aynı maç; bu yüzden oynanan her maçın seed'i yalnızca maç geçmişinde (`league.json`) saklanır, sıradaki maçın seed'i hiçbir yere yazılmaz.
- Videodaki tüm yazılar İngilizce (global kitle), kontrol paneli Türkçe.

---

## Canlı lig (site)

Site adresi: https://mindmash-mt.github.io/Satisfying-Lig/ — **hiç durmayan iki lig**: maçlar günün her saatinde arka arkaya, kendi kendine oynar. **Lig** (18 kulüp) ve **yükselme ligi** (havuzdaki 12 kulüp) paralel gider: iki ligin maçları aynı saatte başlar ve iki sezon aynı maç saatinde biter (bkz. [Yükselme ligi](#yükselme-ligi-canlı-lig)). Siteyi açan kişi şunları görür:

- **Açılış: Fikstür.** Site artık doğrudan yayınla değil, **ligin fikstürüyle** açılır (**Lig tablosu › Fikstür**, bu haftaya kaydırılmış). Fikstürler ayrı bir sekme değil, tabloların altında birer alt sekmedir: **Lig tablosu** ve **Yükselme ligi** sekmelerinin üstündeki **Tablo / Fikstür** düğmesiyle (sayfa aşağı kaydırılınca da sekmelerin hemen altında görünür kalır) tabloya ya da o ligin fikstürüne (yükselme ligi: 22 hafta + eleme) geçilir. O an oynanan maçın yanında **⚽ CANLI · İzle** düğmesi vardır.
- **⚽ Canlı:** o an **oynanmakta olan maçlar** (iki ligden birer tane) ve **10 dakikadan kısa süre sonra başlayacak maçlar** (geri sayımlı) kart kart listelenir. Kullanıcı istediği maça dokunur ve onu izler. Geç gelen kişi maçı baştan değil, **kaldığı yerden** izler; herkes aynı anda aynı maçı görür. Maçtan önce `WEEK 5 MATCHES` (yükselme liginde `PROMO WEEK 5 MATCHES`) ekranı, maçtan sonra o ligin animasyonlu tablosu gelir; maç bitince **aynı ligin sıradaki maçı** aynı ekranda başlar (aradaki sürede o ligin tablosu ve sıradaki maça geri sayım). Başlamasına birkaç dakika olan bir maçı seçen kişi önce geri sayımı görür. Alttaki **‹ Maçlar** (ya da yeniden **⚽ Canlı** sekmesi) listeye döner.
- **⚽ işaretleri:** fikstürde oynanmakta olan maçın yanında, **lig tablosunda ve yükselme ligi tablosunda** o an maçı olan takımların yanında **⚽** vardır; dokununca o canlı maç açılır. Maç bitince (son düdük) işaret kalkar, sonuç tabloya işlenir.
- Üstteki sekmeler: **⚽ Canlı**, **Lig tablosu** (O, G, B, M, AG, YG, AV, P, son 3 maç; düşme hattındaki son 3 takım kırmızı çizgili; son şampiyonlar; **Fikstür** alt sekmesi: sezonun bütün haftaları ve her maçın saati, oynananlar skorlarıyla, geciken maç `ertelendi` etiketiyle), **Yükselme ligi** (havuz kulüplerinin tablosu, doğrudan yükselen ilk 2 sarı, elemeye kalan 3.–6. yeşil çizgili; yükselme elemesi: yarı finaller, final, skorlar, altın gol / penaltılar; **Fikstür** alt sekmesi), **Geçmiş** (biten sezonların lig tablosu, yükselme ligi tablosu ve eleme sonuçları; eski 6'lı grup formatındaki ligin sezonları da; bkz. [Geçmiş sezonlar](#geçmiş-sezonlar)) ve **İstatistik** (tüm zamanlar tablosu, şampiyonluklar, rekorlar, sezon başına gol ortalaması; bkz. [İstatistik ve kulüp sayfaları](#i̇statistik-ve-kulüp-sayfaları)). Tablolarda ve maç listelerinde bir kulübün adına dokununca **kulüp sayfası** açılır (ikili karşılaşmalar orada). Sekmeler açıkken izlenen maç arka planda saate göre ilerler; izlenmeyen maçlar da son düdükte ligine işlenir.
- **Arka plan müziği:** ses açıkken maç oynanmayan bütün ekranlarda (sekmeler, Canlı listesi, geri sayımlı tablo, maçın giriş ve bitiş ekranları) fonda müzik çalar; maç başlayınca kısılır, son düdükten sonra geri gelir. 7 farklı parça vardır (Gece Lo-fi, Neon Gece, Tribün Funk, 8-Bit Marş, Tropik Akşam, Soyunma Odası, Stadyum Rock): her biri yaklaşık 1,5 dakika çalar, sonra bir başkasına geçilir; müzik her yeniden başladığında da yeni bir parça seçilir. Her parça bir kez çalmadan tekrar gelmez, aynı parça art arda çalmaz. Parçalar ses efektleri gibi Web Audio ile tarayıcıda üretilir (dosya indirilmez) ve aynı ses seviyesine ayarlıdır (maç efektlerinin altında). İzlenen maç sürerken başka bir sekmeye geçilirse maçın sesleri susar, müzik çalar. Video çıktısına müzik girmez.
- Alttaki çubuk: ses düğmesi (tarayıcı kuralları gereği kapalı başlar; müziği de açar/kapatır), izlenen maç / "Her 3 dk'da maç · sıradaki 21:03", maç izlenirken **‹ Maçlar** ve **🔗 Paylaş** (o maçın bağlantısı; telefonda paylaşım menüsü açılır, masaüstünde panoya kopyalanır).
- **Maç bağlantısı (tekrar):** fikstürlerde ve eleme tablolarında biten her maçın yanında **▶ İzle** vardır. Bağlantıyı açan kişi o maçı baştan, tek başına izler (sekmeler gizlenir; üstte `▶ Tekrar · 3. hafta 5. maç · RMA–BAR · 4 Kasım 22:09`, altta **↻ Baştan** ve **⚽ Canlıya dön**). Bkz. [Maç bağlantıları](#maç-bağlantıları).
- **Paylaşım kartı ve simge:** sayfada açıklama, Open Graph / Twitter kartı (`og.jpg`, 1200×630, gerçek bir maç karesiyle), site simgesi ve web uygulaması manifesti vardır; bağlantı WhatsApp, X, Telegram gibi yerlerde önizlemeli görünür, telefonda "Ana ekrana ekle" ile uygulama gibi açılır (tam ekran, simgeli). Bkz. [Paylaşım dosyaları](#paylaşım-dosyaları).
- **Sekme başlığı:** maçlar arasında sıradaki maça geri sayım (`⏱ 0:42 · RMA–BAR · Satisfying Lig`), maç oynanırken sağa sola giden bir top (`··⚽···· RMA–BAR · CANLI`; izlenen maçın, yoksa ligin maçının kodları). Kullanıcı başka bir sekmedeyken de işler: tarayıcılar arka plandaki sekmelerin zamanlayıcılarını yavaşlattığı (Chrome 5 dakikadan sonra dakikada bire indirir) için başlığı küçük bir Web Worker'ın saniyede 4 kez gönderdiği sinyal günceller; başlık yalnızca saate göre hesaplanır (maçın kendisi sayfa görünürken ilerler, skor başlıkta gösterilmez).

### Maç takvimi

Günün her saatinde **her 3 dakikada bir maç saati**: günde **480 maç saati**. Her saatte ligin bir maçı başlar, çoğu saatte aynı anda yükselme liginin bir maçı da (günde ~900 maç). Bir maç 3 dakikalık aralıkta şöyle geçer:

| Süre | Ekranda |
|---|---|
| ~5 sn | `WEEK 5 MATCHES`: haftanın 9 maçı |
| **90 sn + 6 sn** | Maç: iki 45 sn'lik yarı ve 6 sn devre arası (üst şeritte hafta · süre · skor; son 10 saniye kırmızı ve sesli) |
| ~13 sn | `FULL TIME` + animasyonlu lig tablosu (+3 / +1 / +0, ▲▼, son 3 maç) |
| ~70 sn | Lig tablosu, sıradaki maç ve geri sayım |

Bir sezon 17 hafta × 9 maç = **153 maç saatidir** ≈ **7 saat 39 dakika** (günde ~3,1 sezon). Her saatte bir lig maçı oynanır; aynı saatlerde yükselme ligi 132 maçını (22 hafta × 6) bu 153 saate eşit aralıkla yayar (18 saatte yükselme ligi maçı yoktur) ve **son 3 saatte** 3.–6. takımların **yükselme elemesi** oynanır: yarı finaller ve **final, ligin son maçıyla aynı anda** (bkz. [Yükselme ligi](#yükselme-ligi-canlı-lig)). Böylece iki sezon aynı anda biter: şampiyon belirlenir, ligin son 3 takımı düşer, yükselme liginin ilk 2'si ve elemenin galibi lige çıkar ve iki lig de bir sonraki maç saatinde yeni sezona başlar. Ligde her takım 27 dakikada bir sahaya çıkar. Şampiyonlar listesinde son 50 sezon tutulur.

**Başlangıç:** yeni bir lig, `CONFIG.LIVE.start` yayın anında henüz gelmemiş bir saatse **tam o saatte**, değilse ilk yayınından **birkaç dakika sonra** kendiliğinden başlar (`tools/live-start.js`, bkz. [Nasıl çalışıyor](#nasıl-çalışıyor-sunucusuz-ücretsiz)). Başlangıç saati o yayında bir kez belirlenir ve sonraki her yayında aynen korunur. Şu anki lig (`satisfying-lig-live-3`) **8 Kasım 2026 13:00**'te sıfırdan başladı: önceki ligin tabloları, sezonları, şampiyonları ve istatistikleri taşınmadı.

**Taşma kuralı (kilitlenme olmaz):** bir maç saatinin maçları (en uzunu), ekranları dahil sıradaki maç saatine kadar bitmezse sıradaki saatin maçları önceki bitince 5 sn sonra başlar (`gap`). Lig maçları ekranlarıyla ~124 sn (en fazla ~133 sn), altın gole ya da penaltıya giden eleme maçları en fazla ~2,8 dakika sürer; hepsi 3 dakikaya sığar. 48 saatlik testte 960 maçta hiç gecikme olmadı; kural yalnızca güvence için var. `node tools/live-check.js` aralığı zorla 1 dakikaya indirip maçların üst üste binmediğini ve takvimin kendini toparladığını test eder.

Ayar `src/01_core.js` dosyasındaki `CONFIG.LIVE`:

```js
LIVE: {
  start: '2026-11-08T13:00',   // yeni ligin başlama saati (yayın anında geçmişse ilk yayından birkaç dk sonra; BUILD_START)
  bands: [{ from: '00:00', every: 3 }],
  utcOffset: 3, gap: 5, salt: 'satisfying-lig-live-3', keepChampions: 50,
},
```

`start` ya da `salt` değişirse canlı lig **yeni bir lig** olarak baştan kurulur; bütün tarayıcılar kayıtlı durumu bırakır. **Takvimi (`bands`, `gap`) değiştirmek ligi sıfırlamaz:** lig o anki hâliyle dondurulur ve yeni takvim, son oynanan maçın bitişinden sonraki ilk aralıkta başlar (kural değişikliği gibi, bkz. aşağıda). Yeni bir lig başlatmanın doğru yolu `salt`'ı değiştirmektir (istenirse `start`'a ileri bir saat yazılır): yeni lig **sıfırdan** başlar; eski ligin tabloları, şampiyonları, biten sezonları ve istatistikleri taşınmaz. (`salt` ve `start` ligin kimliğidir. **Simülasyonu değiştirmek ligi sıfırlamaz**, bkz. aşağıdaki [Kural değişikliği ligi sıfırlamaz](#kural-değişikliği-ligi-sıfırlamaz).)

### Geçmiş sezonlar

**Geçmiş** sekmesi biten sezonları gösterir. Sekmeye tıklayınca **en son biten sezonun** lig tablosu açılır; altında o sezonun yükselme eleme sonuçları (turlar, skorlar, altın gol / penaltılar, bay geçenler, yükselenler) durur. Üstteki seçiciden (ya da ‹ › düğmelerinden) önceki sezonlar seçilir; **yalnızca seçilen sezon çizilir**, diğerleri sayfaya hiç yüklenmez. Sekmeyi yeniden açınca yine en son sezonla başlar. Tabloda sezonun puanlaması, son 3 maç ve sezon sonunda düşen (kırmızı çizgili) takımlar görünür.

Biten her sezon, sezon geçişinde kompakt bir kayıt olarak lig durumuna eklenir (`seasons`; sezon başına ~2,7 KB, en yeni `CONFIG.LIVE.keepChampions` = 50 sezon): son tablo, düşenler, yükselenler, eleme kurası/sonuçları, lig maçlarının skorları (`m`: maç başına 4 karakter, ev sahibi · deplasman · goller; İstatistik sekmesi ve kulüp sayfaları için) ve yükselme liginin tablosu ile skorları (`pl`). Geçmiş sekmesinde sezonun lig tablosunun altında yükselme ligi tablosu (elemeye kalan ilk 4 yeşil çizgili) ve yükselme elemesi görünür; yükselme liginden önceki sezonlarda eski 12 kulüplük eleme. Maçların seed'i ve ayrıntısı tutulmaz. Kayıt, tablonun sezonun bittiği andaki hâlidir; sonradan puanlama değişse de yeniden yazılmaz. Kural değişikliklerinde taban bu arşivi de taşır.

**Eski lig (6'lı grup maçları):** sayfa, `live-start.json`'da bir `legacy` arşivi varsa onu Geçmiş seçicisinde `Eski lig · Sezon N` olarak, kendi sütunlarıyla gösterebilir. 8 Kasım 2026'daki sıfırlamadan beri yeni ligler eski ligin arşivini taşımaz (`legacy: null`), bu yüzden Geçmiş ve İstatistik yalnızca sürmekte olan ligin sezonlarını gösterir.

### İstatistik ve kulüp sayfaları

**İstatistik** sekmesi ligin bütün sezonlarından (Geçmiş arşivi + sürmekte olan sezon) hesaplanır; sunucu ya da ek veri gerekmez. **Lig maçlarıyla birlikte yükselme ligi maçları da** sayılır (tüm zamanlar tablosu, rekorlar, seriler, gol ortalamaları, ikili karşılaşmalar); şampiyonluklar ve sezon rekorları ligindir. Yükselme elemesi maçları sayılmaz.

- **Tüm zamanlar tablosu:** her kulübün ligde (Sz) ve yükselme liginde (YL) oynadığı sezon sayısı, O, G, B, M, AG, YG, AV, puan (lig + yükselme ligi; her sezonun kendi puanlamasıyla) ve şampiyonlukları. Sıralama: puan → averaj → atılan gol.
- **Şampiyonluklar:** kulüp başına şampiyonluk sayısı ve sezonları.
- **Rekorlar:** en farklı galibiyetler, en gollü maçlar (yükselme ligi maçları `Yükselme ligi · Sezon N` etiketiyle), en uzun galibiyet ve yenilmezlik serileri (lig ve yükselme ligi maçları; düşen ya da yükselen kulübün serisi sürer, yalnızca maç oynamadığı bir sezon (eski havuz) keser; süren seri `sürüyor` etiketiyle) ve ligin sezon rekorları (en çok / en az puan, en çok galibiyet, en çok gol atan, en az gol yiyen).
- **Sezon başına gol ortalaması** (lig + yükselme ligi): çubuk grafik (üstüne gelince maç, gol, beraberlik oranı) ve aynı sayılar tablo olarak.

**Kulüp sayfası** (bir kulübün adına dokununca; **‹ Geri** ya da `Esc` ile kapanır): kulübün şu anki durumu (havuzdaysa yükselme ligindeki sırası), şampiyonluk sayısı, ligde geçirdiği sezonlar, tüm zamanlar sırası; bu sezonki **form grafiği** (her maçtan sonraki toplam puan, liderle karşılaştırmalı; havuz kulübünde yükselme ligindeki formu) ve son 10 maçı; **ikili karşılaşma** (rakip listeden seçilir, varsayılan: sıradaki rakibi; galibiyet / beraberlik, goller ve lig ile yükselme ligindeki bütün maçları); **sezon sezon sıra grafiği** (düşme hattı, şampiyonluklar, havuzda geçen sezonlar); **sezon geçmişi** tablosu (sıra, G-B-M, averaj, puan, şampiyon / düştü / yükseldi; havuzdaysa yükselme ligindeki sırası, G-B-M, averajı, puanı ve elemede nereye kadar geldiği); **şampiyonluk, düşme ve yükselme geçmişi** ve kulüp rekorları (en farklı galibiyet, en ağır yenilgi, en uzun seriler). Tüm zamanlar tablosu, rekorlar ve seriler lig ve yükselme ligi maçlarından hesaplanır.

Skorlar arşive bu özellikle birlikte eklendi: daha önce biten sezonlar tablolara, şampiyonluklara ve gol ortalamalarına girer, ama maç rekorları (farklı galibiyet, seriler, ikili karşılaşma) onlardan sonraki sezondan başlar (sekmede not düşülür). İstatistikler lig verisini değiştirmez ve maç sonuçlarını etkilemez (simülasyon parmak izi aynı kalır, lig dondurulmaz); yalnızca lig değişince (maç ya da sezon bitince) yeniden hesaplanır. Kod: `src/08_stats.js`.

### Erişilebilirlik

- Sekmeler WAI-ARIA sekme düzenindedir (`role="tablist"` / `tab` / `tabpanel`, `aria-selected`); klavyede **← →** sekmeler arasında gezer, **Home / End** ilk ve son sekmeye gider, yalnızca seçili sekme Tab sırasındadır. Klavye odağı her yerde görünür (`:focus-visible`).
- Canvas'taki maç ekran okuyucuya gizli bir canlı bölgeyle (`aria-live="polite"`) anlatılır: maç başladı, her gol ve yeni skor, devre arası, ikinci yarı, altın gol, penaltılar, maç sonucu. Maça geç katılınca bir kez o anki skor söylenir; ileri sarılan kısımda bir şey söylenmez. Canvas'ın etiketi (`role="img"`) güncel skoru taşır.
- Grafiklerin her birinin özet etiketi ve aynı verinin tablo hâli vardır; tablo başlıkları `scope="col"`, kulüp adları klavyeyle açılabilen düğmelerdir. Ses ve paylaş düğmeleri durumlarını/adlarını bildirir (`aria-pressed`, `aria-label`).

### Nasıl çalışıyor (sunucusuz, ücretsiz)

Simülasyon deterministiktir: aynı seed + aynı takımlar = birebir aynı maç. Canlı ligde her maçın seed'i **sezon / hafta / maç numarasından** (ve `salt`'tan) türetilir. Fikstür, eşitlik kurası ve her maçın ekranda kaç saniye süreceği de aynı şekilde hesaplanır. Böylece siteyi açan her tarayıcı ligi kendisi hesaplar ve herkes aynı sonucu bulur:

1. Bitmiş maçlar çizilmeden simüle edilir (bir maç ~0,07 sn, iki ligli bir maç saati ~0,14 sn).
2. O an oynanan maçların sonucu da önceden hesaplanır; izlenen maç saate göre ileri sarılır ve oradan gerçek zamanlı oynar, izlenmeyen maç son düdük anında ligine işlenir.
3. Hesaplanan lig tarayıcıda saklanır (`localStorage`, `arenaLive_v3`); bir sonraki ziyarette yalnızca yeni maçlar hesaplanır. Kayıtlı durumun hash'i `<kural>:<lig kimliği>[@<taban>]` biçimindedir; başka kurala ya da tabana ait durum geçersiz sayılır.
4. **Checkpoint:** GitHub Pages iş akışı her yayında ve **15 dakikada bir** (zamanlanmış) ligin o anki durumunu `live-state.json` olarak yayınlar (`tools/live-state.js`). Tarayıcısız çalışır (Node) ve sitede yayında olan son checkpoint'ten devam eder; süre lig yaşlandıkça uzamaz. **Not:** GitHub zamanlanmış iş akışlarını garanti etmez; bu repoda pratikte günde birkaç kez çalışıyor. Bu durumda siteye ilk girenler son checkpoint'ten bu yana oynanan maçları kendileri hesaplar (bir maç ~0,07 sn; saatlerce eski bir checkpoint bile birkaç saniye sürer). Checkpoint yalnızca hızlandırır; yoksa tarayıcı aynı sonucu kendisi hesaplar (kural değişmişse tabandan). Hesaplama başarısız olursa yayındaki son checkpoint aynen yeniden yayınlanır.
5. **Başlangıç (`live-start.json`):** iş akışı her yayında önce `tools/live-start.js`'i çalıştırır. Yayındaki `live-start.json` bu `salt`'a aitse aynen taşınır. Yoksa ve yayındaki checkpoint bu `salt`'ın ligine aitse başlangıç onun lig kimliğinden geri okunur (dosya kaybolsa bile lig yeniden başlamaz). İkisi de yoksa bu `salt` ilk kez yayınlanıyordur: başlangıç = `CONFIG.LIVE.start` yayından sonraysa o saat, değilse **şimdi + 4 dakika** (İstanbul saati, dakikaya yuvarlanmış; ilk maç ondan sonraki ilk 3 dakikalık aralıkta). Eski ligin hiçbir verisi taşınmaz. `build.sh` dosyayı sayfaya gömer (`BUILD_START`). Yayındaki dosyalar okunamazsa (404 dışında bir hata) yayın durur.
6. **Yeni site:** açık bir sayfa 10 dakikada bir yayındaki checkpoint'e bakar; site başka bir lig ya da başka kurallarla yeniden yayınlanmışsa kendini yeniler (en fazla 10 dakikada bir).
7. **Cihaz saati:** telefonun saati yanlışsa site, GitHub Pages yanıtındaki saate göre düzeltir.
8. **Sekme uyursa:** sekme 1 dakikadan uzun arka planda kalıp geri gelince lig en yeni kayıtlı durumdan yeniden kurulur ve o anki maça katılır.

**Maliyet:** repo herkese açık olduğu için GitHub Actions dakikaları ve GitHub Pages ücretsizdir. Not: GitHub, herkese açık bir repoda 60 gün hiç commit olmazsa zamanlanmış iş akışlarını durdurur (Actions sekmesinden tek tıkla yeniden açılır). Durursa site çalışmaya devam eder, yalnızca checkpoint eskidiği için ilk açılış yavaşlar.

**Tarayıcılar arası aynılık:** `Math.sin/cos/atan2/hypot/exp/pow` tarayıcıdan tarayıcıya son basamakta farklı sonuç verebilir; kaotik bir simülasyonda bu, Safari ile Chrome'da farklı maçlar demektir. Bu yüzden simülasyon yalnızca IEEE 754'te birebir tanımlı işlemlerle (`+ − × ÷ √`) yazılmış kendi fonksiyonlarını (`DM`, `src/01_core.js`) kullanır. `node tools/live-check.js` bunu doğrular: tarayıcının matematik kütüphanesi bozulmuşken bile maçlar birebir aynı çıkmalı.

### Kural değişikliği ligi sıfırlamaz

Maç sonuçlarını, fikstürü, puanlamayı (`CONFIG.POINTS`), sezon uzunluğunu, sıralamayı, sezon geçişini, maç süresini (`CONFIG.MATCH_TIME`) ya da denge ayarlarını değiştirmek **ligi sıfırlamaz**. Lig oynadığı yerden, yeni kurallarla devam eder; tablo, geçmiş, sezon ve şampiyonlar olduğu gibi kalır.

Neden gerekli: lig tarayıcıda maç maç hesaplanır, kural değişince aynı geçmiş artık aynı çıkmaz ve eski kodu saklamadığımız için geçmişi yeniden hesaplayamayız. Bu yüzden geçmiş **dondurulur**:

1. `build.sh`, simülasyonun sonuçlarından bir parmak izi çıkarır (`tools/live-fingerprint.js`) ve sayfaya `BUILD_SIM_HASH` olarak yazar. Yalnızca görünümü değiştiren düzenlemeler (çizim, panel, sekmeler, yazılar) parmak izini değiştirmez; sonuçları etkileyen her düzenleme değiştirir.
2. Pages iş akışı her yayında siteyi derlemeden önce `tools/live-base.js`'i çalıştırır. Yayındaki son checkpoint (`live-state.json`) başka bir parmak iziyle üretilmişse, o checkpoint yeni sitenin **tabanı** olur (`live-base.json`) ve `build.sh` onu sayfaya gömer (`BUILD_BASE`, ~16 KB).
3. Tarayıcılar ve checkpoint üreteci ligi tabandan başlatır (hiçbir zaman ligin başından değil). Tabandan sonraki maçlar yeni kurallarla oynanır.
4. Kural aynı kaldıkça (15 dakikalık yayınlar, görünüm düzenlemeleri) taban aynen taşınır. Bir sonraki kural değişikliği tabanı yine o anki checkpoint'ten yeniler (birikimli).
5. Yayındaki checkpoint saatlerce eski olabilir; bu yüzden `tools/live-base.js` dondurmadan önce onu **yayındaki sitenin kendi koduyla** (`index.html`) şu ana kadar ilerletir. Ziyaretçilerin gördüğü bütün maçlar korunur.
6. Takvim değişikliği de bir kural değişikliğidir (`bands` ve `gap` parmak izine dahil): taban, son maçının bitişinden sonraki ilk aralıkta yeni takvimle devam eder.

Bilmeniz gerekenler:

- **Tek istisna, yayın anında oynanmakta olan maçtır**: o maç yeni kurallarla yeniden oynanır (sitedeki kod indirilemezse son checkpoint'ten sonraki bütün maçlar yeniden oynanır).
- Puanlama ve hız gibi kurallar kayıtlı durumda saklandığı için ligin kuralları her zaman `CONFIG`'den alınır (`Live.applyRules`). Puanlama değişince tabloda eski maçların puanı **yeniden yazılmaz**, yeni puanlama sonraki maçlardan itibaren işler. Başlamış bir sezonun uzunluğu sezon bitene kadar korunur, yeni uzunluk bir sonraki sezonda başlar.
- Takım kadrosu, adı ve renkleri de kayıtlı durumdadır: `DEFAULT_TEAMS` / `RESERVE_TEAMS` düzenlemeleri çalışan ligi etkilemez (kadro zaten yükselme/düşmeyle değişir).
- Lig verisinin **biçimini** değiştirirseniz (yeni alan, yeniden adlandırma), eski kayıtların açılabilmesi için `League.normalize`'a geçiş ekleyin.
- `start`'ı ya da `salt`'ı değiştirmek hâlâ **bilinçli bir yeni lig** başlatır: taban ve checkpoint yok sayılır. Zaman çizelgesi (`bands`, `gap`) ise ligi sıfırlamaz (yukarıda 6).
- Yayındaki `live-base.json` / `live-state.json` okunamazsa (404 dışında bir hata) iş akışı **durur** ve eski site yayında kalır; ligi yanlışlıkla sıfırlamaktansa 15 dk sonra yeniden dener. Pages sitesini silip baştan kurarsanız (taban ve `live-start.json` kaybolur), lig yeni bir başlangıç saatiyle baştan başlar.

Testler (`node tools/live-check.js`): dondurulmuş lig yeni kurallarla devam ediyor, geçmiş aynen duruyor, iki bağımsız tarayıcı ve checkpoint'ten devam eden üçüncüsü birebir aynı ligi buluyor, taban kararı her durumda (ilk yayın, aynı kural, kural değişti, ikinci değişiklik, checkpoint yok, yeni lig) ve başlangıç kararı (ilk yayın, sonraki yayınlar, `live-start.json` kaybı, elle saat) doğru.

### Maç bağlantıları

Biten bir maç yalnızca seed'i, kulüpleri (ev sahibi önce) ve temasıyla belirlenir; bu yüzden bir maçın bağlantısı onu **ligi hesaplamadan**, anında yeniden oynatır:

```
?tekrar=1.<kural parmak izi>.<seed>.<ev sahibi>.<deplasman>.<tema>.<w5m2 | p5m2 | cFIN>.<başlama saati, unix sn>
```

- `w5m2`: ligin 5. haftası 2. maçı, `p5m2`: yükselme liginin, `cFIN` / `cSF-1` …: eleme maçı.
- Bağlantı yalnızca **aynı kurallarla** (aynı `BUILD_SIM_HASH`) oynatılır: kurallar değiştiyse aynı seed başka bir maç oynar, bu yüzden site "Bu maç eski kurallarla oynandı, tekrarı gösterilemiyor" der ve canlı yayına geçer.
- Henüz bitmemiş (ya da geleceğe ait) bir maçın bağlantısı tekrar oynatılmaz, canlı yayın açılır: sonuç canlı izleyenlerden önce görülmesin. Paylaş düğmesi maç sürerken de bağlantı verir; bağlantıyı açan kişi maç bitmemişse onu canlı izler, bittiyse baştan.
- Kulüp kimlikleri (`t1` … `t30`) her canlı ligde aynıdır. Tekrar hiçbir lig verisine dokunmaz.
- Geçmiş sekmesindeki eski sezonların maçları arşivde seed'siz tutulduğu için onlarda bağlantı yoktur.

**Geçmişi izleme:** `index.html?now=2026-11-04T12:00:30+03:00` siteyi geçmişteki o anki hâliyle gösterir (yalnızca o tarayıcıda; lig değişmez). Gelecek bir an verilirse yok sayılır, aksi halde sonuçlar maçtan önce görülebilirdi.

**Sonuçlar önceden hesaplanabilir mi?** Evet, teknik bilgisi olan biri için mümkün. Site tek bir HTML dosyasıdır; ziyaretçinin tarayıcısı bütün kodu indirir (sağ tık → Kaynağı görüntüle). Maçlar yalnızca bu koddan ve saatten türediği için biri dosyayı indirip bilgisayarının saatini (ya da tarayıcı geliştirici araçlarında `Date.now`'u) ileri alırsa gelecekteki maçları görebilir. Bunu tamamen engellemenin yolu, her maçın seed'ini gizli tutup maç saatinde yayımlamaktır. Bu da maç saatlerinde güvenilir çalışan bir sunucu ya da zamanlanmış iş gerektirir.

### Paylaşım dosyaları

`public/` altındaki dosyalar (`manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `og.jpg`, `fonts/`) site derlemesinde sayfanın yanına kopyalanır (`./build.sh dist/index.html`). Sekme simgesi sayfaya gömülüdür, yerelde açılan `index.html`'de de görünür. Paylaşım kartı mutlak adres ister: `build.sh` sitenin adresini `SITE_URL` ile alır (Pages iş akışı kendi adresini verir; varsayılan `https://mindmash-mt.github.io/Satisfying-Lig/`).

Simge ya da görünüm değişirse PNG'ler ve `og.jpg` yeniden üretilir (Playwright + Chromium): `npm run assets` (ya da `node tools/make-assets.js <derlenmiş sayfa> [geçmiş bir an]`; görseldeki maç karesi o anda oynanan maçtır). Servis çalışanı (çevrimdışı önbellek) bilerek yoktur: canlı lig her an güncel `live-state.json`'u okumalı.

---

## Stüdyo (video üretimi) — `?studio`

`index.html?studio` eski kontrol panelini açar. Bu moddaki lig, canlı ligden tamamen ayrıdır (tarayıcıda `arenaLeague_v2`), maç seed'leri rastgeledir. Kurallar canlı ligle aynıdır: iki takımlı maç, 90 sn, galibiyet 3 / beraberlik 1 puan.

1. `index.html?studio` adresini güncel **Google Chrome** (masaüstü) ile açın.
2. Sağdaki panelden **▶ Başlat**'a basın (veya **Boşluk** tuşu). Maç önizleme olarak oynar.
3. Video almak için **● Kaydet ve Başlat**: maç sıfırdan 1x hızda oynar, bitiş ekranından sonra video dosyası otomatik iner.
4. Bitişte paneldeki **Açıklama metni** kutusu dolar; **📋 Kopyala** ile alıp paylaşımınıza yapıştırın.

> Kayıt sırasında sekmeyi önde ve görünür tutun. Arka plana atılırsa Chrome çizimi yavaşlatır ve video takılır.

### Video formatı

Chrome destekliyorsa kayıt doğrudan **MP4**, değilse **WebM** (VP9 + Opus, 12 Mbps) olarak iner. Dosya adı örneği: `match_week3_match2.webm`.

WebM dosyasını Instagram'a uygun MP4'e çevirmek için:

```bash
ffmpeg -i girdi.webm -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 60 -c:a aac -b:a 192k cikti.mp4
```

---

## Oyun kuralları

### Maç (90 sn)
- Her maç iki kulüp arasındadır. Fikstürde ilk yazılan **ev sahibidir** ve **üst kalede** oynar (skor tabelasında solda). Ev sahipliği sezon boyunca dengelidir (her takım 8–9 maçta ev sahibi); 30.000 maçlık testte ev sahibi ve deplasman galibiyetleri eşit (%42,9 / %43,3, gerisi beraberlik).
- Saha dar ve uzun, dikey bir futbol sahasıdır ve ekranı üst şeridin altından alt kenara, soldan sağa kadar doldurur (1020 × 1660, ortalı). Sahada her an **tek top** bulunur.
- **Diziliş:** her takımın bir **kalecisi** ve sahada **4 oyuncusu** vardır (`TEAM_PLAYERS`): **2 defans**, orta sahada **kaptan** (sarı **C** rozeti) ve **1 forvet**. Her oyuncu sahanın uzunluğuna göre **üçte birlik kendi bölgesinde** rastgele dolaşır ve bölgenin sınırına gelince geri döner: defanslar kendi kalesinin önündeki üçte birde, kaptan ortadaki üçte birde, forvet rakip kalenin önündeki üçte birde. Bölgeler kendi kalesine göre belirlenir; devre arasında takımlar kale değiştirince bölgeler de yer değiştirir.
- **Vuruş:** bir oyuncu topa dokununca top **rakip kaleye doğru** rastgele bir yöne gider: yukarı/aşağı bileşeni her zaman rakip kaleye doğrudur, sağ/sol bileşeni rastgeledir (düz ileriden en fazla `KICK_MAX_DEG` = ±60°). Top aynı hızla çıkar. Bu yüzden oyuncular topu kendi kalesine göndermez. **Forvet şut çeker:** vuruşu rakip kalenin ortasına nişanlıdır, en fazla `FWD_AIM_DEG` = ±20° sapar.
- **Oyuncular topu görür:** top bir oyuncunun kendi üçte birlik bölgesindeyken oyuncu dolaşmayı sürdürür ama topa doğru yönelir (saniyede en fazla `PLAYER_CHASE` = 2,5 radyan döner; 0 yapılırsa eski rastgele dolaşma).
- **Top:** maçın ilk topu ve ikinci yarının topu başlangıç hızıyla ortadan rastgele bir yöne çıkar, her **duvar veya direk** çarpmasında %10 hızlanır (en fazla 2,4 katı). Oyuncu ve kaleci çarpmaları hızı değiştirmez.
- **Golden sonra santra:** gol olunca yeni top 1,1 sn sonra (`GOAL_RESPAWN`) yine başlangıç hızıyla ortadan çıkar; **santrayı golü yiyen takım yapar**: top rakip kaleye doğru (düz ileriden en fazla ±60°) gider. **Golden santraya kadar saat durur.**
- **Kaptan şutu:** kaptan topa dokunduğunda top rakip kaleye doğru gidiyorsa (kale merkezine `CAPTAIN_AIM_DEG` = 25° içinde) **2 kat hızlı** gider; başka bir şeye çarpınca hız eski değerine döner.
- **Kaleciler** topu sürekli takip eder; iki kaleci de **aynı yetenektedir** (`KEEPER_SKILL` = 0,4): maçtan önce gizli bir kura çekilmez.
- **Süre:** maç **90 saniye** sürer (`CONFIG.MATCH_TIME`). Saat oyun süresine göre işler: **ağır çekimde saat de ağır akar** (ağır çekim oyun süresinden yemez), golden sonraki santraya kadar ve devre arasında **durur**. Bu yüzden maç ekranda 90 saniyeden uzun sürer (gol başına ~1,1 sn, ağır çekim başına ~1,1 sn). Ekranın üstünde **tek satırlık bir şerit** vardır: solda hafta ve maç (`WEEK 5 · MATCH 3` + tema), ortada saat ve altında geçen süre çubuğu (ortasında devre işareti, yanında `1H` / `2H`), sağda kulüp renklerindeki kutularda takım kodları ve aralarında çerçeveli skor (ev sahibi solda). Sahada çim şeritleri, ince çim dokusu, ortası aydınlık kenarları koyulaşan ışık ve duvar boyunca gölge vardır; oyuncu rozetlerinde takım kodu her renkte okunur (açık renkte koyu, koyu renkte beyaz konturlu yazı). Saat son 10 saniyede kırmızıya döner ve her saniye tıklar; altın golde altın rengi `GOLDEN GOAL 21`, penaltılarda `PENALTIES` yazar. Başlangıçta ve bitişte düdük çalar.
- **Devre arası:** 45. saniyede (`MATCH_TIME / 2`) ilk yarı biter; maç sonundaki uzatma kuralı burada da aynen geçerlidir: 45. saniye dolunca devre arası, **top orta sahayı geçince** başlar (en fazla `ADDED_MAX` = 10 sn, saatte `0:45+`). **6 sn devre arası** (`HALF_BREAK`) olur: saat durur ve `HALF TIME` yazar, top kaybolur, takımlar **kale değiştirir** (ev sahibi ikinci yarıda alt kalede) ve oyuncular yeni yarı sahalarına yürür. İkinci yarı tam 0:45'ten ortadan başlar; ilk yarının uzatması ikinci yarıdan yemez. Her iki yarının sonunda da top orta sahayı geçene kadar oyun sürdüğü ve gollerden sonra saat durduğu için maç ekranda yaklaşık 101–119 sn sürer.
- **Bitiş düdüğü ve uzatma:** süre bittiğinde maç (ve devre arası) hemen bitmez; oyun **top orta sahayı geçene** kadar sürer, yani düdük hiçbir zaman atağın ortasında çalmaz. Süre dolduğu anda topun hangi yarı sahada olduğu hatırlanır; top öbür yarı sahaya geçince (ya da gol olunca, top ağda ise) maç biter. En fazla `ADDED_MAX` = 10 sn beklenir. Bu sırada saatte `1:30+` yazar. Bu kural altın golün sonunda da geçerlidir. Sonra çok gol atan kazanır; skor eşitse **beraberlik**.
- **Goller:** her gol skora rakip takım lehine yazılır; kalecinin kendi kalesine sektirdiği top da rakibin golüdür. Bu yüzden skor, AG ve YG her zaman birbirini tutar. **Kendi kalesine gol** yalnızca golü yiyen takımın bir oyuncusu topa son dokunduysa sayılır: kalecisinden sekip giren top, onu oraya gönderenin golüdür (kalecinin dokunuşu "son dokunuş"u silmez). Gol anında sahanın üst yarısında kısa süre `+ ARSENAL GOAL` ve altında yeni skor (`ARS 2 – 1 CHE`) belirir; golü atan takımın kalesinin arkasında her gol için bir mini futbol topu çıkar.
- **Ağır çekim:** son 10 saniyede skor eşitken ya da fark 1 golken (ve altın golde) top kaleye yaklaşırsa kısa bir ağır çekim ve kamera yakınlaşması olur.
- **Maç öncesi (~5 sn, `INTRO_DURATION`):** **`WEEK 5 MATCHES`** ekranı: haftanın 9 maçı, oynananlar skorlarıyla (`FULL TIME`), sıradaki maç (`PLAYING NOW`) ve kalanlar (`COMING UP`).
- **Maç sonu (~9 sn, `END_DURATION`):** tek ekranda **güncel tüm puan durumu**, başlıkta `FULL TIME · LIVERPOOL 2–5 JUVENTUS`. Önce maçı oynayan iki takımın sonucu (`W` / `D` / `L`) ve aldığı puan çıkar (`+3` / `+1` yeşil, `+0` kırmızı), sonra puanlar sayarak güncellenir ve takımlar yeni sıralarına kayar (▲/▼). Sezonun son maçında şampiyon altın, ligden çıkacak son 3 takım kırmızı çerçeveyle işaretlenir ve başlıkta şampiyon yazar. **Eleme maçlarının** bitiş ekranı o turun maçlarıdır (skorlarla, oynanan maç altın çerçeveli); elemenin finalinde 3,2 sn sonra **sezon özeti** gelir: yükselen 3 ve düşen 3 kulüp.
- **Tablo sütunları (video):** sıra, takım, `P` (oynanan), `GD` (averaj), maçın sonucu + puan, `PTS` ve en sağda **`LAST 3`**: takımın bu sezonki son 3 maçının sonucu (`W` yeşil, `D` gri, `L` kırmızı; eskiden yeniye). Sayı `CONFIG.FORM_COUNT` ile değiştirilebilir. Lider altın, son 3 sıra (`RELEGATE_COUNT`) kırmızı sıra rozetiyle gösterilir ve son 3'ün üstünde kesikli kırmızı `RELEGATION` çizgisi vardır.
- Saha çizgileri her temada beyazdır; sahada hiçbir engel yoktur.

### Temalar
Otomatik (rastgele) veya elle seçilir: **Classic**, **Snow** (top %10 hızlı), **Rain** (top %15 yavaş), **Night** (karanlık, ışık saçan top ve kaleler).

> Eski 6 takımlık arena (eleme usulü grup maçları, güçlendirmeler, dönen çokgen saha) motordan kaldırıldı; lig yalnızca iki takımlı maç oynar. O dönemin sezonları Geçmiş sekmesinde durur.

---

## Lig sistemi

### Takımlar
Dünyanın önde gelen 18 kulübü, kendi renkleriyle: Real Madrid, Barcelona, Atlético Madrid, Manchester City, Liverpool, Arsenal, Chelsea, Manchester United, Bayern München, Borussia Dortmund, Bayer Leverkusen, Paris Saint-Germain, Inter, AC Milan, Juventus, Fenerbahçe, Beşiktaş, Galatasaray.

Ad, 3 harfli kod ve renkler panelden **✏️ Takımları düzenle** ile değiştirilebilir; takım eklenip silinebilir. Her hafta her takım bir maç oynasın diye **takım sayısı çift olmalıdır**; başka bir sayı kaydedilmez, içe aktarılan dosya da reddedilir. Takımlar yalnızca **sezon başında** (hiç maç oynanmadan) değiştirilebilir.

### Sezon fikstürü (tek devreli lig)
- 18 takım, her maçta 2 takım → **haftada 9 maç**. Her takım her hafta tam bir kez oynar ve 17 haftada **her takımla tam bir kez** karşılaşır (`planRoundRobin`: seed'li sırayla daire yöntemi).
- Ev sahipliği dengelidir: her takım 8 ya da 9 maçta ev sahibi, en fazla 2 maç üst üste aynı tarafta. Haftanın maç sırası da kurayla belirlenir.
- Sezon uzunluğu 17 haftadan uzun ayarlanırsa (stüdyo) lig ev sahibi ve deplasman yer değiştirerek tekrarlanır (34 hafta = çift devre).
- **Fikstür sezon başında bir kez oluşturulur ve sezon bitene kadar değişmez.** Lig verisinde (`seasonPlan`) saklanır.
- Başlıkta `WEEK 3 · MATCH 2` yazar. Haftanın son maçı kaydedilince hafta kendiliğinden ilerler. **📅 Yeni hafta** ile elle de geçilebilir; haftada oynanmamış maç varsa uyarı çıkar ve onay istenir.
- Sezonun son haftası bitince lig maçı kurulmaz: önce yükselme elemesi oynanır, o da bitince yeni sezon başlar.

### Puanlama
| Sonuç | Galibiyet | Beraberlik | Mağlubiyet |
|---|---|---|---|
| Puan | 3 | 1 | 0 |

Tablo sıralaması: **Puan → averaj (AV) → atılan gol (AG) → aralarındaki maç(lar) (eşit takımlar arasındaki puan, sonra averaj) → sezonluk kura**. Hâlâ eşit kalan takımlar için ad sırası yerine her sezon başında bir kez çekilen ve lig verisinde (`tieOrder`) saklanan rastgele kura sırası kullanılır. Tablo sütunları: O, G, B, M, AG, YG, AV, P, Son 3 (G yeşil, B gri, M kırmızı; en sağdaki en yeni). Puanlar panelden değiştirilebilir (canlı ligde `CONFIG.POINTS`).

90 saniyelik 1000 maçlık testte (varsayılan ayarlar): maç başına ortalama **9,3 gol**, **%14 beraberlik**; en sık skorlar 5–4, 5–3, 6–4, 4–3, 6–3. (Gollerden sonra saatin durması, eşit kaleciler, topa yönelen oyuncular ve forvetin nişanı gol ortalamasını 7,2'den 9,3'e çıkardı; düşürmek için `FINAL_GOAL_FRAC` küçültülebilir.)

### Yükselme ligi (canlı lig)
Sitedeki canlı ligde havuzdaki 12 kulüp (Napoli, Roma, Atalanta, Tottenham, Aston Villa, Benfica, Porto, Ajax, Sevilla, Marseille, Sporting CP, Trabzonspor + sonradan düşenler) **yükselmeyi beklerken kendi ligini oynar** ve bu lig ana ligle **paralel** gider:

- **Fikstür:** çift devreli lig: 22 hafta × 6 maç = 132 maç; her ikili iki kez karşılaşır (bir iç saha, bir deplasman), her kulüp 11 maçta ev sahibi. Fikstür ve eşitlik kurası sezon başında sezonun seed'iyle çekilir (`promo` lig verisinde).
- **Saatler:** her yükselme ligi maçı ligin bir maçıyla **aynı saatte** başlar. 132 maç, sezonun ilk 150 maç saatine eşit aralıkla yayılır (`League.promoSlot`); sezonun **son 3 maç saati** elemenindir.
- **Doğrudan yükselme:** lig bitince tablonun **ilk 2 takımı doğrudan lige yükselir** (`PO_DIRECT`): 132 maçlık ligi önde bitirmenin karşılığı kesindir.
- **Yükselme elemesi (son yer):** **3.–6. takımlar** tek maçlık eleme oynar: **yarı finaller 3.–6. ve 4.–5.** (ev sahibi üst sıradaki), sonra **final**. Berabere biten maç en fazla 20 sn altın gol, sonra penaltılarla biter. **Final galibi lige yükselir.** Final, ligin son maçıyla aynı anda oynanır: iki sezon aynı anda biter.
- **Önceki format:** ilk sürümde ilk 4 takım eleme oynuyor (1.–4., 2.–3., 3.lük maçı, final) ve elemenin ilk 3'ü yükseliyordu; lig birincisi dördüncüyle aynı şansa sahipti. O formatla başlamış bir sezon o formatla biter (`promo.direct` yok), yeni format bir sonraki sezonla başlar; Geçmiş sekmesi iki formatı da gösterir.
- Puanlama ve sıralama ligle aynıdır (galibiyet 3, beraberlik 1; puan → averaj → atılan gol → aralarındaki maç → kura). Maçlar videodaki şeritte `PROMO · WEEK 5 · MATCH 3` başlığını taşır; bitiş ekranı yükselme ligi tablosudur (ilk 2 altın, `PROMOTION` çizgisi; 3.–6. yeşil, `PLAYOFFS` çizgisi).
- **Geçiş:** yükselme ligi bir sezonun başında kurulur. Bu özellik yayınlandığında sürmekte olan sezon (eski formatla başladığı için) eski kuralla, lig maçlarından sonra 12 kulübün elemesiyle biter; yükselme ligi bir sonraki sezonla başlar. Lig sıfırlanmaz (bkz. [Kural değişikliği ligi sıfırlamaz](#kural-değişikliği-ligi-sıfırlamaz)).
- Stüdyo (`?studio`) ve günlük video otomasyonu eski formatı kullanır (aşağıdaki 12 kulüplük eleme).

### Sezon sonu: şampiyon, yükselme elemesi ve takım değişimi
> Bu bölüm stüdyonun (ve canlı ligde yükselme liginden önce başlamış sezonun) formatıdır; canlı ligde yükselenleri [yükselme ligi](#yükselme-ligi-canlı-lig) belirler.

Sezonun son haftası (17) oynanınca **tabloda 1. olan takım şampiyon** olur ve kaydedilir; tablonun **son 3 takımı** (`RELEGATE_COUNT`) ligden düşer. Düşenlerin yerini **havuzdaki kulüpler** doldurur. Havuzda 12 kulüp vardır (Napoli, Roma, Atalanta, Tottenham, Aston Villa, Benfica, Porto, Ajax, Sevilla, Marseille, Sporting CP, Trabzonspor + sonradan düşenler) ve **lig maçları bittikten sonra** kendi aralarında **tek maçlık (rövanşsız) yükselme elemesi** oynarlar:

| Tur | Maç | |
|---|---|---|
| 1. tur | 4 | 8 kulüp oynar, kurada ilk 4 çekilen kulüp **bay geçer** |
| Çeyrek final | 4 | 4 bay kulübü + 4 galip |
| Yarı final | 2 | |
| 3.lük maçı + Final | 2 | yarı final mağlupları 3.lük maçını oynar |

- Kura, lig maçları biter bitmez sezonun seed'iyle çekilir ve lig verisinde (`cup`) saklanır: aynı sezon aynı kura, her tarayıcıda aynı. Maçlar tablodaki sırayla, tek tek oynanır (toplam **12 maç**). Kurada ilk yazılan ev sahibidir.
- Her eleme maçı lig maçıyla aynıdır (**90 sn**) ama **berabere bitemez**: skor eşitse en fazla **20 sn altın gol** oynanır (ilk golü atan kazanır, `GOLDEN_TIME`); yine gol olmazsa **penaltı atışları** (5'er atış, sonra tek atış; sahanın ortasında tablo hâlinde, her atış ~0,9 sn). Testlerde eleme maçlarının ~%14'ü altın gole gidiyor, ~%0,4'ü penaltıya kalıyor. Eleme maçı puan getirmez, tabloya işlenmez.
- **Yükselenler:** final galibi, finalist ve 3.lük maçının galibi (`FIN` + `3RD`). Düşen 3 takım havuza girer; havuz hep 12 kulüp kalır, düşenler en erken **bir sonraki sezonun** elemesine katılır.
- Eleme bitince tablo, hafta ve maç geçmişi sıfırlanır; yeni sezon 1. haftadan başlar. Biten sezon (stüdyo / günlük otomasyonda) `data/active/seasons/season-N.json` dosyasına (şampiyon, çıkanlar, gelenler, son tablo, maç geçmişi, **eleme kurası ve sonuçları**) arşivlenir.
- Sezonun son maçının açıklama metninde şampiyon ve düşenler yazılır, "eleme belirleyecek" notu düşülür; elemenin finalinin açıklamasında yükselenler ve düşenler yazılır. Tarayıcıda panel durumu gösterir ve eleme bittiğinde **Yeni sezonu başlat** düğmesi geçişi yapar; günlük otomasyon (`tools/daily.js`) her çalıştırmada bir eleme turunu oynatır, eleme bitince geçişi kendiliğinden yapar.
- Eleme yalnızca havuzda tam `CONFIG.CUP_SIZE` (12) kulüp varken ve `RELEGATE_COUNT` 3 iken oynanır; başka bir havuz (ör. içe aktarılan dosyada) eski kuyruk kuralıyla çalışır: havuzun ilk `RELEGATE_COUNT` kulübü gelir, düşenler sona eklenir.

### Kalıcılık ve yedekleme
- Stüdyo ligi tarayıcının `localStorage`'ında `arenaLeague_v2` anahtarıyla saklanır (eski 6'lı grup formatındaki `arenaLeague_v1` artık okunmaz). Depolama kullanılamazsa uygulama bellekte çalışır ve panelde uyarı gösterir.
- **⬇ Tabloyu dışa aktar** / **⬆ Tabloyu içe aktar**: takımlar, tablo, hafta, maç geçmişi (seed, tema, takımlar, skor) ve sezon fikstürü tek bir JSON dosyasında.
- **Test maçı** kutusu işaretliyse sonuç tabloya yazılmaz.
- Tarayıcıdaki lig, repodaki aktif ligden ayrıdır; tarayıcıda yapılan denemeler aktif lige yansımaz. Aktif ligi tarayıcıda görmek için `data/active/league.json` dosyasını **⬆ Tabloyu içe aktar** ile yükleyin (bkz. [Otomatik günlük maç günü](#otomatik-günlük-maç-günü)).

---

## Otomatik günlük maç günü

> Canlı lig (site) videosuz çalışır. Bu bölüm stüdyo ligi için video üretimini anlatır ve isteğe bağlıdır.

Aktif ligin videoları tarayıcıyı açmadan üretilir: `tools/daily.js` uygulamayı ekransız Chrome'da çalıştırır, haftanın kalan maçlarını (18 takımda 9 maç) oynatır ve her maç için ayrı bir **MP4** (1080×1920, 60 FPS, H.264 + AAC, ~107 sn) üretir. Maç gerçek zamanlı oynatılıp ekrandan kaydedilmez; her kare tek tek çizilip kodlanır, sesler de dosyaya sentezlenir. Bu yüzden video, makinenin hızından bağımsız olarak akıcıdır. Bir maç yaklaşık 2 dakikada hazırlanır.

```bash
node tools/daily.js active --max 1          # sıradaki tek maç (1 video)
node tools/daily.js active                  # haftanın kalan maçları (normalde 9 video) tek seferde
node tools/daily.js --dry-run --max 1       # deneme: 1 video üretir, lig verisine dokunmaz
```

### Aktif lig

Sosyal medyada paylaşılan lig `data/active/` klasöründedir. Her çalıştırma bir haftayı (9 maç) oynatır. `node tools/daily.js active` komutunu elle çalıştırmayın; lig ilerler. Denemeler tarayıcıda (lig tablosuna yazılmaz) ya da `--dry-run` ile yapılır.

Klasörde:
- `league.json`: lig verisi. Biçimi paneldeki **⬇ Tabloyu dışa aktar** dosyasıyla aynıdır; **⬆ Tabloyu içe aktar** ile tarayıcıya yüklenebilir.
- `STANDINGS.md`: GitHub'da doğrudan okunabilen lig tablosu (G/B/M, son maçlar) ve son maç skorları.
- `seasons/season-N.json`: biten sezonların arşivi (son tablo, şampiyon, maç geçmişi).

Sezonun son haftası (17. hafta) oynandığında **tabloda 1. olan şampiyon** olur (son maçın videosunda ve açıklama metninde duyurulur). Sonraki çalıştırmalar yükselme elemesini oynatır: her çalıştırma bir turu (1. tur, çeyrek final, yarı final, 3.lük maçı + final) videolar. Elemenin son maçını oynatan çalıştırma sezonu arşivler, elemede ilk 3'e giren 3 havuz kulübünü lige alır ve yeni sezon 1. haftadan başlar (bkz. [Sezon sonu](#sezon-sonu-şampiyon-yükselme-elemesi-ve-takım-değişimi)). Eleme videoları `sN_playoff_<sıra>_<maç>.mp4` adını taşır.

Videolar ve açıklama metinleri `out/active/<tarih>/` klasörüne yazılır (`--dry-run` ile `out/dry-run/<tarih>/`) (repoya eklenmez): `*.mp4`, `captions.txt`, `summary.json`.

### Zamanlanmış görev

Eskiden aktif lig, Claude Code'da tanımlı bir zamanlanmış görevle her gece oynatılıp videoları gönderiliyordu. Canlı siteye geçildiği için bu görev **durduruldu** (silinmedi; Claude uygulamasındaki zamanlanmış görevler listesinden yeniden açılabilir). Görev `main` dalında `node tools/daily.js active` çalıştırır, videoları Claude uygulamasına gönderir, `data/active/` değişikliklerini `main`'e kaydeder.

---

## Kontrol paneli

| Bölüm | İçerik |
|---|---|
| Maç | Başlat, Kaydet ve Başlat, Duraklat/Devam, Sıfırla, durum ve `● REC` göstergesi |
| Lig tablosu | O, G, B, M, AG, YG, AV, P, son 3 maç; şampiyonlar |
| Ayarlar | Tema, top hızı çarpanı, test maçı, simülasyon hızı (1x/2x/4x, sadece önizleme), ses |
| Açıklama metni | Maç sonunda otomatik dolan, kopyalanabilir paylaşım metni |
| Lig | Sezon/hafta bilgisi, haftanın maçları, sezon fikstürü, Yeni hafta (oynanmamış maç varsa uyarır), dışa/içe aktar, takımları düzenle, ligi sıfırla, puanlar (galibiyet, beraberlik, mağlubiyet), sezon uzunluğu |
| Denge testi | Mevcut ayarlarla 100 maçı çizimsiz simüle eder: ortalama gol, beraberlik, ev sahibi/deplasman galibiyeti (lig tablosunu etkilemez) |
| Yardım | Kısa kullanım notları ve ffmpeg komutu |

---

## Denge

Varsayılan ayarlarla 90 saniyelik 1000 maçlık testte (`node tools/balance.js 1000`): ortalama **9,3 gol**, **%14 beraberlik**, kendi kalesine gol %8; 30.000 maçta ev sahibi ve deplasman galibiyeti eşit (%42,9 / %43,3). Eleme maçlarında (`--eleme`) ~%14 maç altın gole, ~%0,4'ü penaltıya gider; en uzun eleme maçı ~151 sn. Uzatma (devre ve maç sonunda top orta sahayı geçene kadar) maç başına 2 kez, ortalama +1,1 sn; maç ekranda 101–119 sn sürer.

Önemli ayarlar `src/01_core.js` dosyasının başındaki `CONFIG` nesnesinde:

| Ayar | Varsayılan | Anlamı |
|---|---|---|
| `MATCH_TIME` | 90 | Maç süresi (ekran saniyesi) |
| `GOLDEN_TIME` | 20 | Eleme maçında beraberlikte altın gol süresi (sn); sonra penaltılar |
| `ADDED_MAX` | 10 | Süre bittikten sonra top orta sahayı geçene kadar verilen uzatmanın üst sınırı (sn) |
| `HALF_BREAK` | 6 | Devre arası (sn; saat durur, takımlar kale değiştirir) |
| `PEN_P` / `PEN_STEP` | 0.75 / 0.9 | Penaltının gol olma olasılığı / ekranda her atışın süresi (sn) |
| `POINTS` | 3, 1, 0 | Galibiyet, beraberlik, mağlubiyet puanı |
| `SEASON_LENGTH` | 17 | Sezon uzunluğu (hafta; 18 takımda tek devre) |
| `BALL_SPEED` | 600 | Topun başlangıç hızı (px/sn) |
| `WALL_ACCEL` | 0.10 | Her duvar/direk çarpmasında hız artışı (%10) |
| `BALL_MAX_MULT` | 2.4 | Hız tavanı (başlangıç hızının katı) |
| `FINAL_GOAL_FRAC` | 0.54 | Kale ağzı (saha genişliğinin oranı); küçültmek golü azaltır, beraberliği artırır |
| `FINAL_W` / `FINAL_H` | 1020 / 1660 | Sahanın boyutu: üst şeridin altından alt kenara, x 30–1050 (`FINAL_CX` 540: ortalı; `FINAL_DY` 37: merkezi biraz aşağıda; `TOPBAR_Y` 60: üst şeridin yüksekliği) |
| `TEAM_PLAYERS` | 4 | Takım başına sahadaki oyuncu (kaleci hariç): 2 defans, kaptan (orta saha), 1 forvet; her biri kendi üçte birlik bölgesinde |
| `KICK_MAX_DEG` | 60 | Oyuncunun vuruşu: rakip kaleye doğru, düz ileriden en fazla bu kadar derece sapar |
| `CAPTAIN_SHOT_MULT` / `CAPTAIN_AIM_DEG` | 2 / 25 | Kaptan şutunun hız katı / rakip kaleye yönelme açısı |
| `KEEPER_GAIN` / `KEEPER_READ` | 3 / 0.3 | Kalecinin tepki hızı / topun yolunu okuma oranı |
| `KEEPER_SKILL` | 0.4 | İki kalecinin de yeteneği (eşit) |
| `PLAYER_CHASE` | 2.5 | Oyuncunun, top kendi bölgesindeyken topa dönme hızı (radyan/sn; 0: rastgele dolaşma) |
| `FWD_AIM_DEG` | 20 | Forvetin şutu: rakip kalenin ortasından en fazla bu kadar derece sapar |
| `INTRO_DURATION` / `END_DURATION` | 5 / 9 | Maç öncesi ve maç sonu ekranlarının süresi (sn) |
| `FORM_COUNT` | 3 | Lig tablosunun en sağındaki son maç sayısı (`LAST 3`) |
| `RELEGATE_COUNT` / `CUP_SIZE` | 3 / 12 | Sezon sonunda düşen / yükselen takım sayısı; yükselme elemesine katılan havuz kulübü sayısı |
| `LIVE` | her 3 dk | Canlı ligin takvimi, taşma payı ve seed tohumu (bkz. [Canlı lig](#canlı-lig-site)) |

---

## Proje yapısı

```
index.html          Uygulamanın kendisi (tek dosya, doğrudan açılır)
build.sh            src/ parçalarını index.html'de birleştirir
src/
  00_head.html      HTML iskeleti, panel ve stiller
  01_core.js        CONFIG, takımlar (lig + havuz), seed'li RNG, matematik, sezon fikstürü (tek devreli lig)
  02_sim.js         Fizik ve oyun mantığı (saha, top, kaleci, oyuncu, 90 sn'lik maç, altın gol, penaltılar)
  03_fx_audio.js    Temalar, görsel efektler, Web Audio ile sentezlenen sesler ve arka plan müziği (Music)
  04_render.js      Canvas çizimi, üst şerit (hafta · saat · skor), penaltı tablosu, maç öncesi / sonu ekranları
  05_app.js         Lig (puan, sıralama, eleme), kayıt, kontrol paneli, denge testi, ana döngü
  06_offline.js     Ekransız video üretimi (kare kare çizim, WebCodecs H.264, OfflineAudioContext)
  07_live.js        Canlı lig: maç takvimi, iki lig (lig + yükselme ligi) aynı saatlerde, seed türetme, geçmiş maçları hesaplama, saate senkron oynatma, Canlı listesi ve maç seçimi, geri sayım ekranı, sekmeler (fikstür, tablolar, ⚽), maç bağlantıları (tekrar), ekran okuyucu duyuruları
  08_stats.js       İstatistik sekmesi ve kulüp sayfaları (tüm zamanlar tablosu, rekorlar, seriler, ikili karşılaşma, grafikler)
  types.d.ts        Yalnızca tip denetimi için (sayfaya girmez)
tools/
  balance.js        Terminalden denge testi (Node.js)
  live-check.js     Canlı lig testleri: determinizm, takvim, fikstür, maç kuralları, sıralama, taşma kuralı, taban, başlangıç, yükselme ligi ve elemesi, Canlı listesi ve ⚽ işaretleri (--long: 48 saatlik koşu)
  live-start.js     Yeni ligin başlangıcını ilk yayında belirler, sonraki yayınlarda korur; eski ligin arşivini taşır (live-start.json)
  live-state.js     live-state.json checkpoint'ini üretir (Pages iş akışı 15 dakikada bir çalıştırır)
  live-base.js      Kural ya da takvim değişince ligi dondurur: yayındaki checkpoint, yayındaki kodla şu ana ilerletilip → live-base.json (Pages iş akışı her yayında çalıştırır)
  live-fingerprint.js  Simülasyon parmak izi (build.sh → BUILD_SIM_HASH)
  live-node.js      Canlı lig motorunu tarayıcısız (Node) yükler: kaynaktan ya da derlenmiş bir sayfadan (loadPage)
  daily.js          Stüdyo ligi: maçları oynatır, MP4 üretir, lig verisini günceller
  make-assets.js    public/ altındaki PNG simgeleri ve paylaşım görselini (og.jpg) üretir
public/             Site derlemesinde sayfanın yanına kopyalanan dosyalar: manifest, simgeler, og.jpg, fonts/ (yazı tipleri ve lisansları)
package.json        Komut kısayolları (npm test, npm run typecheck …); bağımlılık yok
tsconfig.json       Tip denetimi ayarları
data/
  active/           Aktif lig (league.json, STANDINGS.md, seasons/)
```

### Geliştirme

`index.html` derlenmiş çıktıdır; değişiklikleri `src/` altındaki dosyalarda yapıp yeniden derleyin:

```bash
./build.sh
```

Terminalden denge testi (Node.js 18+):

```bash
node tools/balance.js 1000            # 1000 lig maçı (90 sn)
node tools/balance.js 1000 --eleme    # eleme maçı: altın gol + penaltılar
node tools/live-check.js              # canlı lig testleri, ~2,5 dk (--quick: ~1,5 dk, --long: 48 saatlik koşu)
CFG='{"FINAL_GOAL_FRAC":0.45}' node tools/balance.js   # ayar denemek için
```

Aynı komutların kısayolları (`package.json`; kurulacak paket yok):

| Komut | Ne yapar |
|---|---|
| `npm run build` | `./build.sh` |
| `npm test` | Canlı lig testlerinin hızlı koşusu (`--quick`: daha az maç, 9 saatlik takvim koşusu yok) |
| `npm run test:full` / `test:long` | Bütün testler / 48 saatlik koşu |
| `npm run typecheck` | TypeScript ile tip denetimi (`tsc`, `npx` ile indirilir; derleme yapmaz) |
| `npm run balance` | 1000 maçlık denge testi |
| `npm run assets` | Simgeleri ve paylaşım görselini yeniden üretir |

**Tip denetimi:** kaynaklar düz JavaScript'tir; `tsconfig.json` onları `checkJs` ile denetler. Dosyalar tek bir betikte birleştiği için birbirinin globallerini görür. Lig verisinin biçimi `src/05_app.js` başında JSDoc tipleriyle (`LeagueData`, `Club`, `HistoryEntry`, `CupState` …) tanımlıdır; biçimi değiştirirken önce oradaki tipleri, sonra `League.normalize`'daki geçişi güncelleyin. Panele HTML yazan her yerde kulüp adı, kodu ve rengi `esc()` ile kaçırılır.

**Simülasyonu sadeleştirirken:** `node tools/live-fingerprint.js` çıktısı aynı kalıyorsa maç sonuçları değişmemiştir (canlı lig dondurulmaz). Eski 6 takımlık arena kodu bu yolla, parmak izi değişmeden kaldırıldı.

Harici kütüphane kullanılmaz (vanilla JavaScript + Canvas 2D + Web Audio). Fizik motoru, bir maçın kayıtlı seed'i ile birebir tekrarlanabilmesi (hata ayıklama, yeniden render) için uygulamaya özel yazılmıştır: sabit zaman adımı (240 Hz), oyun mantığı ve görsel efektler için ayrı seed'li rastgele sayı üreteçleri. Yazı tipleri (Bebas Neue ve değişken ağırlıklı Inter; latin + latin-ext, Türkçe karakterler dahil) sitenin kendisinden yüklenir (`public/fonts/`, SIL Open Font License; lisans metinleri aynı klasörde): üçüncü bir tarafa (Google Fonts) istek gitmez, en çok kullanılan iki dosya sayfayla birlikte önceden yüklenir (`preload`). `build.sh` font yolunu çıktıya göre yazar: site derlemesinde `fonts/`, repodaki `index.html`'de (diskten açılınca, stüdyo ve `tools/daily.js`) `public/fonts/`. Font yüklenemezse sistem yazı tiplerine düşer.

---

## Not

Uygulama gerçek kulüp adlarını ve renklerini kullanır; logo veya arma kullanmaz. Para kazanan bir hesapta gerçek kulüp adlarıyla içerik yayınlamak marka hakkı şikâyetlerine yol açabilir. Takım listesi panelden kurgusal takımlarla değiştirilebilir.
