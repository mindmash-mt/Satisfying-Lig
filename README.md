# Satisfying Lig ⚽

Kendi kendine oynayan, **hiç durmayan canlı bir "satisfying" futbol ligi**: günün her saatinde **her 3 dakikada bir 1'e 1 maç** oynanır, her maç **90 saniye** sürer; siteye giren herkes aynı maçı aynı anda izler. Tek dosyalık bir tarayıcı uygulamasıdır; sunucu gerekmez. Ayrıca Reels/TikTok/Shorts videosu üreten bir **stüdyo** modu vardır (`?studio`).

Her maçta iki kulüp dikey bir futbol sahasında karşılaşır: her takımın bir kalecisi ve sahada 4 oyuncusu vardır (2 defans, orta sahada kaptan, 1 forvet); her oyuncu sahanın kendi üçte birinde dolaşır ve topa dokununca onu rakip kaleye doğru gönderir. Top duvarlara çarptıkça hızlanır, kaleciler topu takip eder. 90 saniyenin sonunda **çok gol atan kazanır**; berabere biterse beraberliktir. Sonuç kalıcı bir **lig tablosuna** işlenir (galibiyet 3, beraberlik 1 puan).

- Kurulum yok: `index.html` dosyasını Chrome'da açmanız yeterli.
- Dikey 1080×1920 (9:16) video, 60 FPS, sesli kayıt.
- Her maç, kurulurken üretilen rastgele bir **seed** (32 bit) ile oynanır; seed arayüzde ve dosya adlarında görünmez. Aynı seed + aynı takımlar + aynı ayarlar = birebir aynı maç; bu yüzden oynanan her maçın seed'i yalnızca maç geçmişinde (`league.json`) saklanır, sıradaki maçın seed'i hiçbir yere yazılmaz.
- Videodaki tüm yazılar İngilizce (global kitle), kontrol paneli Türkçe.

---

## Canlı lig (site)

Site adresi: https://mindmash-mt.github.io/Satisfying-Lig/ — **hiç durmayan bir lig**: maçlar günün her saatinde arka arkaya, kendi kendine oynar. Siteyi açan kişi şunları görür:

- **Maç sırasında:** maçın kendisi. Geç gelen kişi maçı baştan değil, **kaldığı yerden** izler; herkes aynı anda aynı maçı görür. Maçtan önce `WEEK 5 MATCHES` ekranı (haftanın 9 maçı: oynananlar skorlarıyla, sıradaki, kalanlar), maçtan sonra animasyonlu lig tablosu gelir.
- **Maçlar arasında:** güncel lig tablosu, sıradaki eşleşme (ev sahibi solda) ve **geri sayım**.
- Üstteki sekmeler: **⚽ Canlı** (yayın), **Lig tablosu** (O, G, B, M, AG, YG, AV, P, son 3 maç; düşme hattındaki son 3 takım kırmızı çizgili; son şampiyonlar), **Fikstür** (sezonun bütün haftaları ve her maçın saati; oynananlar skorlarıyla, oynanan maç `● CANLI`, geciken maç `ertelendi` etiketiyle), **Eleme** (havuzdaki 12 kulübün yükselme eleme tablosu: turlar, skorlar, altın gol / penaltılar, bay geçenler, sıradaki maç) ve **Geçmiş** (biten sezonların tablosu ve yükselme eleme sonuçları; eski 6'lı grup formatındaki ligin sezonları da; bkz. [Geçmiş sezonlar](#geçmiş-sezonlar)). Sekmeler açıkken yayın arka planda saate göre ilerler.
- Alttaki çubuk: ses düğmesi (tarayıcı kuralları gereği kapalı başlar) ve "Her 3 dk'da bir maç · 90 sn · sıradaki 21:03".
- **Sekme başlığı:** maçlar arasında sıradaki maça geri sayım (`⏱ 0:42 · RMA–BAR · Satisfying Lig`), maç oynanırken sağa sola giden bir top (`··⚽···· RMA–BAR · CANLI`). Kullanıcı başka bir sekmedeyken de işler: tarayıcılar arka plandaki sekmelerin zamanlayıcılarını yavaşlattığı (Chrome 5 dakikadan sonra dakikada bire indirir) için başlığı küçük bir Web Worker'ın saniyede 4 kez gönderdiği sinyal günceller; başlık yalnızca saate göre hesaplanır (maçın kendisi sayfa görünürken ilerler, skor başlıkta gösterilmez).

### Maç takvimi

Günün her saatinde **her 3 dakikada bir maç**: günde **480 maç**. 3 dakikalık bir aralık şöyle geçer:

| Süre | Ekranda |
|---|---|
| ~5 sn | `WEEK 5 MATCHES`: haftanın 9 maçı |
| **90 sn + 6 sn** | Maç: iki 45 sn'lik yarı ve 6 sn devre arası (üst şeritte hafta · süre · skor; son 10 saniye kırmızı ve sesli) |
| ~13 sn | `FULL TIME` + animasyonlu lig tablosu (+3 / +1 / +0, ▲▼, son 3 maç) |
| ~70 sn | Lig tablosu, sıradaki maç ve geri sayım |

Bir sezon 17 hafta × 9 maç = **153 lig maçı** ve ardından **12 maçlık yükselme elemesidir** (bkz. [Sezon sonu](#sezon-sonu-şampiyon-yükselme-elemesi-ve-takım-değişimi)): toplam 165 maç ≈ **8 saat 15 dakika**, yani günde ~2,9 sezon biter. Şampiyon belirlenir, son 3 takım düşer, elemede ilk 3'e giren 3 havuz kulübü gelir ve yeni sezon bir sonraki maçta başlar. Her takım 27 dakikada bir sahaya çıkar. Şampiyonlar listesinde son 50 sezon tutulur.

**Başlangıç:** yeni bir lig, ilk yayınından **birkaç dakika sonra** kendiliğinden başlar (`tools/live-start.js`, bkz. [Nasıl çalışıyor](#nasıl-çalışıyor-sunucusuz-ücretsiz)). Başlangıç saati o yayında bir kez belirlenir ve sonraki her yayında aynen korunur.

**Taşma kuralı (kilitlenme olmaz):** bir maç, ekranları dahil sıradaki maçın saatine kadar bitmezse sıradaki maç önceki bitince 5 sn sonra başlar (`gap`). Lig maçları ekranlarıyla ~108 sn (en fazla ~116 sn), altın gole ya da penaltıya giden eleme maçları en fazla ~2,3 dakika sürer; hepsi 3 dakikaya sığar. 48 saatlik testte 960 maçta hiç gecikme olmadı; kural yalnızca güvence için var. `node tools/live-check.js` aralığı zorla 1 dakikaya indirip maçların üst üste binmediğini ve takvimin kendini toparladığını test eder.

Ayar `src/01_core.js` dosyasındaki `CONFIG.LIVE`:

```js
LIVE: {
  start: '2026-11-04T22:00',   // yalnızca yerel derleme için; sitede başlangıcı ilk yayın belirler (BUILD_START)
  bands: [{ from: '00:00', every: 2 }],
  utcOffset: 3, gap: 5, salt: 'satisfying-lig-live-2', keepChampions: 50,
},
```

`start` ya da `salt` değişirse canlı lig **yeni bir lig** olarak baştan kurulur; bütün tarayıcılar kayıtlı durumu bırakır. **Takvimi (`bands`, `gap`) değiştirmek ligi sıfırlamaz:** lig o anki hâliyle dondurulur ve yeni takvim, son oynanan maçın bitişinden sonraki ilk aralıkta başlar (kural değişikliği gibi, bkz. aşağıda). Yeni bir lig başlatmanın doğru yolu `salt`'ı değiştirmektir: ilk yayın yeni başlangıç saatini kendisi seçer ve eski ligin şampiyonlarını ve biten sezonlarını Geçmiş'e taşır. (`salt` ve `start` ligin kimliğidir. **Simülasyonu değiştirmek ligi sıfırlamaz**, bkz. aşağıdaki [Kural değişikliği ligi sıfırlamaz](#kural-değişikliği-ligi-sıfırlamaz).)

### Geçmiş sezonlar

**Geçmiş** sekmesi biten sezonları gösterir. Sekmeye tıklayınca **en son biten sezonun** lig tablosu açılır; altında o sezonun yükselme eleme sonuçları (turlar, skorlar, altın gol / penaltılar, bay geçenler, yükselenler) durur. Üstteki seçiciden (ya da ‹ › düğmelerinden) önceki sezonlar seçilir; **yalnızca seçilen sezon çizilir**, diğerleri sayfaya hiç yüklenmez. Sekmeyi yeniden açınca yine en son sezonla başlar. Tabloda sezonun puanlaması, son 3 maç ve sezon sonunda düşen (kırmızı çizgili) takımlar görünür.

Biten her sezon, sezon geçişinde kompakt bir kayıt olarak lig durumuna eklenir (`seasons`; sezon başına ~1,2 KB, en yeni `CONFIG.LIVE.keepChampions` = 50 sezon): son tablo, düşenler, yükselenler ve eleme kurası/sonuçları. Lig maçlarının kendisi tutulmaz. Kayıt, tablonun sezonun bittiği andaki hâlidir; sonradan puanlama değişse de yeniden yazılmaz. Kural değişikliklerinde taban bu arşivi de taşır.

**Eski lig (6'lı grup maçları):** 1'e 1 formatına geçilmeden önce oynanan ligin biten sezonları ve şampiyonları, yeni ligin ilk yayınında yayındaki checkpoint'ten alınıp `live-start.json`'a yazılır ve Geçmiş seçicisinde `Eski lig · Sezon N` olarak, kendi sütunlarıyla (sıra puanları, birincilikler, son 3 maçtaki sırası) görünür. Eski ligin o an sürmekte olan sezonu bitmediği için taşınmaz.

### Nasıl çalışıyor (sunucusuz, ücretsiz)

Simülasyon deterministiktir: aynı seed + aynı takımlar = birebir aynı maç. Canlı ligde her maçın seed'i **sezon / hafta / maç numarasından** (ve `salt`'tan) türetilir. Fikstür, eşitlik kurası ve her maçın ekranda kaç saniye süreceği de aynı şekilde hesaplanır. Böylece siteyi açan her tarayıcı ligi kendisi hesaplar ve herkes aynı sonucu bulur:

1. Bitmiş maçlar çizilmeden simüle edilir (bir maç ~0,04 sn).
2. O an oynanan maç saate göre ileri sarılır ve oradan gerçek zamanlı oynar.
3. Hesaplanan lig tarayıcıda saklanır (`localStorage`, `arenaLive_v3`); bir sonraki ziyarette yalnızca yeni maçlar hesaplanır. Kayıtlı durumun hash'i `<kural>:<lig kimliği>[@<taban>]` biçimindedir; başka kurala ya da tabana ait durum geçersiz sayılır.
4. **Checkpoint:** GitHub Pages iş akışı her yayında ve **15 dakikada bir** (zamanlanmış) ligin o anki durumunu `live-state.json` olarak yayınlar (`tools/live-state.js`). Tarayıcısız çalışır (Node) ve sitede yayında olan son checkpoint'ten devam eder; süre lig yaşlandıkça uzamaz. **Not:** GitHub zamanlanmış iş akışlarını garanti etmez; bu repoda pratikte günde birkaç kez çalışıyor. Bu durumda siteye ilk girenler son checkpoint'ten bu yana oynanan maçları kendileri hesaplar (bir maç ~0,06 sn; saatlerce eski bir checkpoint bile birkaç saniye sürer). Checkpoint yalnızca hızlandırır; yoksa tarayıcı aynı sonucu kendisi hesaplar (kural değişmişse tabandan). Hesaplama başarısız olursa yayındaki son checkpoint aynen yeniden yayınlanır.
5. **Başlangıç (`live-start.json`):** iş akışı her yayında önce `tools/live-start.js`'i çalıştırır. Yayındaki `live-start.json` bu `salt`'a aitse aynen taşınır. Yoksa ve yayındaki checkpoint bu `salt`'ın ligine aitse başlangıç onun lig kimliğinden geri okunur (dosya kaybolsa bile lig yeniden başlamaz). İkisi de yoksa bu `salt` ilk kez yayınlanıyordur: başlangıç = **şimdi + 4 dakika** (İstanbul saati, dakikaya yuvarlanmış; ilk maç ondan sonraki ilk 3 dakikalık aralıkta). `build.sh` dosyayı sayfaya gömer (`BUILD_START`). Yayındaki dosyalar okunamazsa (404 dışında bir hata) yayın durur.
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

**Geçmişi izleme:** `index.html?now=2026-11-04T12:00:30+03:00` siteyi geçmişteki o anki hâliyle gösterir (yalnızca o tarayıcıda; lig değişmez). Gelecek bir an verilirse yok sayılır, aksi halde sonuçlar maçtan önce görülebilirdi.

**Sonuçlar önceden hesaplanabilir mi?** Evet, teknik bilgisi olan biri için mümkün. Site tek bir HTML dosyasıdır; ziyaretçinin tarayıcısı bütün kodu indirir (sağ tık → Kaynağı görüntüle). Maçlar yalnızca bu koddan ve saatten türediği için biri dosyayı indirip bilgisayarının saatini (ya da tarayıcı geliştirici araçlarında `Date.now`'u) ileri alırsa gelecekteki maçları görebilir. Bunu tamamen engellemenin yolu, her maçın seed'ini gizli tutup maç saatinde yayımlamaktır. Bu da maç saatlerinde güvenilir çalışan bir sunucu ya da zamanlanmış iş gerektirir.

---

## Stüdyo (video üretimi) — `?studio`

`index.html?studio` eski kontrol panelini açar. Bu moddaki lig, canlı ligden tamamen ayrıdır (tarayıcıda `arenaLeague_v2`), maç seed'leri rastgeledir. Kurallar canlı ligle aynıdır: 1'e 1, 90 sn, galibiyet 3 / beraberlik 1 puan.

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

### 1'e 1 maç (90 sn)
- Her maç iki kulüp arasındadır. Fikstürde ilk yazılan **ev sahibidir** ve **üst kalede** oynar (skor tabelasında solda). Ev sahipliği sezon boyunca dengelidir (her takım 8–9 maçta ev sahibi); 3000 maçlık testte üst ve alt kale galibiyetleri eşit (%42 / %43, gerisi beraberlik).
- Saha dar ve uzun, dikey bir futbol sahasıdır ve ekranı üst şeridin altından alt kenara, soldan sağa kadar doldurur (1020 × 1660, ortalı). Sahada her an **tek top** bulunur.
- **Diziliş:** her takımın bir **kalecisi** ve sahada **4 oyuncusu** vardır (`TEAM_PLAYERS`): **2 defans**, orta sahada **kaptan** (sarı **C** rozeti) ve **1 forvet**. Her oyuncu sahanın uzunluğuna göre **üçte birlik kendi bölgesinde** rastgele dolaşır ve bölgenin sınırına gelince geri döner: defanslar kendi kalesinin önündeki üçte birde, kaptan ortadaki üçte birde, forvet rakip kalenin önündeki üçte birde. Bölgeler kendi kalesine göre belirlenir; devre arasında takımlar kale değiştirince bölgeler de yer değiştirir.
- **Vuruş:** bir oyuncu topa dokununca top **rakip kaleye doğru** rastgele bir yöne gider: yukarı/aşağı bileşeni her zaman rakip kaleye doğrudur, sağ/sol bileşeni rastgeledir (düz ileriden en fazla `KICK_MAX_DEG` = ±60°). Top aynı hızla çıkar. Bu yüzden oyuncular topu kendi kalesine göndermez; kendi kalesine giren goller (kaleci sekmeleri) %43'ten %22'ye indi.
- **Top:** başlangıç hızıyla ortadan rastgele bir yöne çıkar, her **duvar veya direk** çarpmasında %10 hızlanır (en fazla 2,4 katı). Oyuncu ve kaleci çarpmaları hızı değiştirmez. Gol olunca yeni top 1,1 sn sonra yine başlangıç hızıyla doğar.
- **Kaptan şutu:** kaptan topa dokunduğunda top rakip kaleye doğru gidiyorsa (kale merkezine `CAPTAIN_AIM_DEG` = 25° içinde) **2 kat hızlı** gider; başka bir şeye çarpınca hız eski değerine döner.
- **Kaleciler** topu sürekli takip eder; her takımın kalecisine maç başında rastgele bir yetenek atanır.
- **Süre:** maç **90 saniye** sürer (`CONFIG.MATCH_TIME`). Saat ekran süresine göre işler: ağır çekim anları da saatten düşer, yani maç ekranda tam 90 saniyedir. Ekranın üstünde **tek satırlık bir şerit** vardır: solda hafta ve maç (`WEEK 5 · MATCH 3` + tema), ortada saat ve altında geçen süre çubuğu, sağda skor (ev sahibi solda). Saat son 10 saniyede kırmızıya döner ve her saniye tıklar; altın golde altın rengi `GOLDEN GOAL 21`, penaltılarda `PENALTIES` yazar. Başlangıçta ve bitişte düdük çalar.
- **Devre arası:** 45. saniyede (`MATCH_TIME / 2`) ilk yarı biter; top kaleye gidiyorsa maç sonundaki uzatma kuralı burada da aynen geçerlidir (en fazla `ADDED_MAX` = 10 sn, saatte `0:45+`). **6 sn devre arası** (`HALF_BREAK`) olur: saat durur ve `HALF TIME` yazar, top kaybolur, takımlar **kale değiştirir** (ev sahibi ikinci yarıda alt kalede) ve oyuncular yeni yarı sahalarına yürür. İkinci yarı tam 0:45'ten ortadan başlar; ilk yarının uzatması ikinci yarıdan yemez. Her iki yarının sonunda da uzatma olabildiği için maç ekranda 96–116 sn sürer.
- **Bitiş düdüğü ve uzatma:** süre bittiğinde top bir kalenin yarı sahasındaysa ve **o kaleye doğru** gidiyorsa (yalnızca yukarı/aşağı yön dikkate alınır, sağa sola gidişi önemsizdir) maç bitmez: top öbür kaleye doğru dönene ya da gol olana kadar sürer (en fazla `ADDED_MAX` = 10 sn). Bu sırada saatte `1:30+` yazar. Bu kural altın golün sonunda da geçerlidir. Sonra çok gol atan kazanır; skor eşitse **beraberlik**.
- **Goller:** her gol skora rakip takım lehine yazılır; kalecinin kendi kalesine sektirdiği top da rakibin golüdür. Bu yüzden skor, AG ve YG her zaman birbirini tutar. Gol anında sahanın üst yarısında kısa süre `+ ARSENAL GOAL` ve altında yeni skor (`ARS 2 – 1 CHE`) belirir; golü atan takımın kalesinin arkasında her gol için bir mini futbol topu çıkar.
- **Ağır çekim:** son 10 saniyede skor eşitken ya da fark 1 golken (ve altın golde) top kaleye yaklaşırsa kısa bir ağır çekim ve kamera yakınlaşması olur.
- **Maç öncesi (~5 sn, `INTRO_DURATION`):** **`WEEK 5 MATCHES`** ekranı: haftanın 9 maçı, oynananlar skorlarıyla (`FULL TIME`), sıradaki maç (`PLAYING NOW`) ve kalanlar (`COMING UP`).
- **Maç sonu (~9 sn, `END_DURATION`):** tek ekranda **güncel tüm puan durumu**, başlıkta `FULL TIME · LIVERPOOL 2–5 JUVENTUS`. Önce maçı oynayan iki takımın sonucu (`W` / `D` / `L`) ve aldığı puan çıkar (`+3` / `+1` yeşil, `+0` kırmızı), sonra puanlar sayarak güncellenir ve takımlar yeni sıralarına kayar (▲/▼). Sezonun son maçında şampiyon altın, ligden çıkacak son 3 takım kırmızı çerçeveyle işaretlenir ve başlıkta şampiyon yazar. **Eleme maçlarının** bitiş ekranı o turun maçlarıdır (skorlarla, oynanan maç altın çerçeveli); elemenin finalinde 3,2 sn sonra **sezon özeti** gelir: yükselen 3 ve düşen 3 kulüp.
- **Tablo sütunları (video):** sıra, takım, `P` (oynanan), `GD` (averaj), maçın sonucu + puan, `PTS` ve en sağda **`LAST 3`**: takımın bu sezonki son 3 maçının sonucu (`W` yeşil, `D` gri, `L` kırmızı; eskiden yeniye). Sayı `CONFIG.FORM_COUNT` ile değiştirilebilir.
- Saha çizgileri her temada beyazdır; sahada hiçbir engel yoktur.

### Temalar
Otomatik (rastgele) veya elle seçilir: **Classic**, **Snow** (top %10 hızlı), **Rain** (top %15 yavaş), **Night** (karanlık, ışık saçan top ve kaleler).

> Eski 6 takımlık arena (eleme usulü grup maçları) motorda hâlâ duruyor ama lig artık yalnızca 1'e 1 maç oynar.

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

90 saniyelik 1000 maçlık testte (varsayılan ayarlar): maç başına ortalama **7,2 gol**, **%16 beraberlik**; en sık skorlar 4–3, 4–2, 5–3, 5–2, 3–2.

### Sezon sonu: şampiyon, yükselme elemesi ve takım değişimi
Sezonun son haftası (17) oynanınca **tabloda 1. olan takım şampiyon** olur ve kaydedilir; tablonun **son 3 takımı** (`RELEGATE_COUNT`) ligden düşer. Düşenlerin yerini **havuzdaki kulüpler** doldurur. Havuzda 12 kulüp vardır (Napoli, Roma, Atalanta, Tottenham, Aston Villa, Benfica, Porto, Ajax, Sevilla, Marseille, Sporting CP, Trabzonspor + sonradan düşenler) ve **lig maçları bittikten sonra** kendi aralarında **tek maçlık (rövanşsız) yükselme elemesi** oynarlar:

| Tur | Maç | |
|---|---|---|
| 1. tur | 4 | 8 kulüp oynar, kurada ilk 4 çekilen kulüp **bay geçer** |
| Çeyrek final | 4 | 4 bay kulübü + 4 galip |
| Yarı final | 2 | |
| 3.lük maçı + Final | 2 | yarı final mağlupları 3.lük maçını oynar |

- Kura, lig maçları biter bitmez sezonun seed'iyle çekilir ve lig verisinde (`cup`) saklanır: aynı sezon aynı kura, her tarayıcıda aynı. Maçlar tablodaki sırayla, tek tek oynanır (toplam **12 maç**). Kurada ilk yazılan ev sahibidir.
- Her eleme maçı lig maçıyla aynıdır (**90 sn**) ama **berabere bitemez**: skor eşitse en fazla **20 sn altın gol** oynanır (ilk golü atan kazanır, `GOLDEN_TIME`); yine gol olmazsa **penaltı atışları** (5'er atış, sonra tek atış; sahanın ortasında tablo hâlinde, her atış ~0,9 sn). Testlerde eleme maçlarının ~%16'sı altın gole gidiyor, ~%1,3'ü penaltıya kalıyor. Eleme maçı puan getirmez, tabloya işlenmez.
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

Varsayılan ayarlarla 90 saniyelik 1000 maçlık testte (`node tools/balance.js 1000`): ortalama **7,2 gol**, **%16 beraberlik**; 3000 maçta üst kale (ev sahibi) ve alt kale galibiyeti eşit (%42 / %43). Eleme maçlarında (`--eleme`) ~%16 maç altın gole, ~%1,3'ü penaltıya gider; en uzun eleme maçı ~125 sn. Uzatma (devre ya da maç sonunda top kaleye gidiyorsa) maç başına ~1 kez, ortalama +0,7 sn.

Önemli ayarlar `src/01_core.js` dosyasının başındaki `CONFIG` nesnesinde:

| Ayar | Varsayılan | Anlamı |
|---|---|---|
| `MATCH_TIME` | 90 | Maç süresi (ekran saniyesi) |
| `GOLDEN_TIME` | 20 | Eleme maçında beraberlikte altın gol süresi (sn); sonra penaltılar |
| `ADDED_MAX` | 10 | Süre bittiğinde top kaleye giderken verilen uzatmanın üst sınırı (sn) |
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
  03_fx_audio.js    Temalar, görsel efektler, Web Audio ile sentezlenen sesler
  04_render.js      Canvas çizimi, üst şerit (hafta · saat · skor), penaltı tablosu, maç öncesi / sonu ekranları
  05_app.js         Lig (puan, sıralama, eleme), kayıt, kontrol paneli, denge testi, ana döngü
  06_offline.js     Ekransız video üretimi (kare kare çizim, WebCodecs H.264, OfflineAudioContext)
  07_live.js        Canlı lig: maç takvimi, seed türetme, geçmiş maçları hesaplama, saate senkron oynatma, geri sayım ekranı, sekmeler
tools/
  balance.js        Terminalden denge testi (Node.js)
  live-check.js     Canlı lig testleri: determinizm, takvim, fikstür, maç kuralları, sıralama, taşma kuralı, taban, başlangıç (--long: 48 saatlik koşu)
  live-start.js     Yeni ligin başlangıcını ilk yayında belirler, sonraki yayınlarda korur; eski ligin arşivini taşır (live-start.json)
  live-state.js     live-state.json checkpoint'ini üretir (Pages iş akışı 15 dakikada bir çalıştırır)
  live-base.js      Kural ya da takvim değişince ligi dondurur: yayındaki checkpoint, yayındaki kodla şu ana ilerletilip → live-base.json (Pages iş akışı her yayında çalıştırır)
  live-fingerprint.js  Simülasyon parmak izi (build.sh → BUILD_SIM_HASH)
  live-node.js      Canlı lig motorunu tarayıcısız (Node) yükler: kaynaktan ya da derlenmiş bir sayfadan (loadPage)
  daily.js          Stüdyo ligi: maçları oynatır, MP4 üretir, lig verisini günceller
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
node tools/live-check.js              # canlı lig testleri (--long: 48 saatlik koşu)
CFG='{"FINAL_GOAL_FRAC":0.45}' node tools/balance.js   # ayar denemek için
```

Harici kütüphane kullanılmaz (vanilla JavaScript + Canvas 2D + Web Audio). Fizik motoru, bir maçın kayıtlı seed'i ile birebir tekrarlanabilmesi (hata ayıklama, yeniden render) için uygulamaya özel yazılmıştır: sabit zaman adımı (240 Hz), oyun mantığı ve görsel efektler için ayrı seed'li rastgele sayı üreteçleri. Yazı tipleri (Bebas Neue, Inter) Google Fonts'tan yüklenir; internet yoksa sistem yazı tiplerine düşer.

---

## Not

Uygulama gerçek kulüp adlarını ve renklerini kullanır; logo veya arma kullanmaz. Para kazanan bir hesapta gerçek kulüp adlarıyla içerik yayınlamak marka hakkı şikâyetlerine yol açabilir. Takım listesi panelden kurgusal takımlarla değiştirilebilir.
