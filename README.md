# Satisfying Lig ⚽

Kendi kendine oynayan, **hiç durmayan canlı bir "satisfying" futbol ligi**: maçlar günün her saatinde arka arkaya başlar (gece 3, sabah 5, gündüz 10 dakikada bir); siteye giren herkes aynı maçı aynı anda izler. Tek dosyalık bir tarayıcı uygulamasıdır; sunucu gerekmez. Ayrıca Reels/TikTok/Shorts videosu üreten bir **stüdyo** modu vardır (`?studio`).

Çokgen bir arenanın her kenarında dünyanın önde gelen bir futbol kulübünün kalesi var. Top duvarlara çarptıkça hızlanır, kaleciler topu takip eder. Gol yiyen takım elenir, kalesi kapanır. **Son kalan takım kazanır** ve aldığı puanlar kalıcı bir **lig tablosuna** işlenir.

- Kurulum yok: `index.html` dosyasını Chrome'da açmanız yeterli.
- Dikey 1080×1920 (9:16) video, 60 FPS, sesli kayıt.
- Her maç, kurulurken üretilen rastgele bir **seed** (32 bit) ile oynanır; seed arayüzde ve dosya adlarında görünmez. Aynı seed + aynı takımlar + aynı ayarlar = birebir aynı maç; bu yüzden oynanan her maçın seed'i yalnızca maç geçmişinde (`league.json`) saklanır, sıradaki maçın seed'i hiçbir yere yazılmaz.
- Videodaki tüm yazılar İngilizce (global kitle), kontrol paneli Türkçe.

---

## Canlı lig (site)

Site adresi: https://mindmash-mt.github.io/Satisfying-Lig/ — **hiç durmayan bir lig**: maçlar günün her saatinde arka arkaya, kendi kendine oynar. Siteyi açan kişi şunları görür:

- **Maç sırasında:** maçın kendisi. Geç gelen kişi maçı baştan değil, **kaldığı yerden** izler; herkes aynı anda aynı maçı görür. Maçtan önce `WEEK 5 MATCHES` ekranı, maçtan sonra animasyonlu lig tablosu gelir.
- **Maçlar arasında:** güncel lig tablosu ve bir sonraki maça **geri sayım**.
- Üstteki sekmeler: **⚽ Canlı** (yayın), **Lig tablosu** (O, P, 1., AG, YG, AV, son 3 maç; düşme hattındaki son 3 takım kırmızı çizgili; son şampiyonlar) **Fikstür** (sezonun bütün haftaları ve her maçın saati; oynananlar sıralama ve puanlarla, oynanan maç `● CANLI`, geciken maç `ertelendi` etiketiyle) ve **Eleme** (havuzdaki 12 kulübün yükselme eleme tablosu: turlar, skorlar, bay geçenler, sıradaki maç). Sekmeler açıkken yayın arka planda saate göre ilerler.
- Alttaki çubuk: ses düğmesi (tarayıcı kuralları gereği kapalı başlar) ve "Her 3 dk'da bir maç · sıradaki 21:03".

### Maç takvimi

| Saat (İstanbul) | Aralık | Günlük maç |
|---|---|---|
| 05:00 – 09:00 | 5 dk | 48 |
| 09:00 – 19:00 | 10 dk | 60 |
| 19:00 – 05:00 | 3 dk | 200 |
| **Toplam** | | **308** |

Lig **4 Kasım 2026 00:36**'de başladı. Bir sezon 17 hafta × 3 grup maçı = 51 maç ve ardından 12 maçlık yükselme elemesidir (bkz. [Sezon sonu](#sezon-sonu-şampiyon-ve-takım-değişimi)); toplam 63 maç, yani günde ~4,9 sezon biter: şampiyon belirlenir, son 3 takım düşer, elemede ilk 3'e giren 3 havuz kulübü gelir ve yeni sezon bir sonraki maçta başlar. Şampiyonlar listesinde son 50 sezon tutulur.

**Taşma kuralı (kilitlenme olmaz):** bir maç, ekranları dahil sıradaki maçın saatine kadar bitmezse sıradaki maç önceki bitince 10 sn sonra başlar (`gap`). Gecikme birikmez, sonraki aralıklarda erir. 3000 test maçında en uzun maç (giriş + maç + bitiş tablosu) 165 sn sürdü, yani 3 dakikalık aralığa her zaman sığdı. Kural yalnızca güvence için var. `node tools/live-check.js` aralığı zorla 1 dakikaya indirip maçların üst üste binmediğini ve takvimin kendini toparladığını test eder.

Ayar `src/01_core.js` dosyasındaki `CONFIG.LIVE`:

```js
LIVE: {
  start: '2026-11-04T00:36',   // 'YYYY-MM-DD' (o gün ilk bandın saati) ya da 'YYYY-MM-DDTHH:MM'
  bands: [{ from: '05:00', every: 5 }, { from: '09:00', every: 10 }, { from: '19:00', every: 3 }],
  utcOffset: 3, gap: 10, salt: 'satisfying-lig-live-1', keepChampions: 50,
},
```

`start`, `bands`, `gap` ya da `salt` değişirse canlı lig **yeni bir lig** olarak baştan kurulur; bütün tarayıcılar kayıtlı durumu bırakır.

### Nasıl çalışıyor (sunucusuz, ücretsiz)

Simülasyon deterministiktir: aynı seed + aynı takımlar = birebir aynı maç. Canlı ligde her maçın seed'i **sezon / hafta / grup maçından** (ve `salt`'tan) türetilir. Fikstür, eşitlik kurası ve her maçın ekranda kaç saniye süreceği de aynı şekilde hesaplanır. Böylece siteyi açan her tarayıcı ligi kendisi hesaplar ve herkes aynı sonucu bulur:

1. Bitmiş maçlar çizilmeden simüle edilir (bir maç ~0,14 sn).
2. O an oynanan maç saate göre ileri sarılır ve oradan gerçek zamanlı oynar.
3. Hesaplanan lig tarayıcıda saklanır (`localStorage`, `arenaLive_v2`); bir sonraki ziyarette yalnızca yeni maçlar hesaplanır.
4. **Checkpoint:** GitHub Pages iş akışı her yayında ve **15 dakikada bir** ligin o anki durumunu `live-state.json` olarak yayınlar (`tools/live-state.js`). Tarayıcısız çalışır (Node, ~15 sn) ve sitede yayında olan son checkpoint'ten devam eder; süre lig yaşlandıkça uzamaz. Siteye ilk girenler en fazla son 15 dakikanın maçlarını (gece en fazla 5 maç) kendileri hesaplar. Checkpoint yalnızca hızlandırır; yoksa tarayıcı aynı sonucu kendisi hesaplar. Hesaplama başarısız olursa yayındaki son checkpoint aynen yeniden yayınlanır.
5. **Cihaz saati:** telefonun saati yanlışsa site, GitHub Pages yanıtındaki saate göre düzeltir.
6. **Sekme uyursa:** sekme 1 dakikadan uzun arka planda kalıp geri gelince lig en yeni kayıtlı durumdan yeniden kurulur ve o anki maça katılır.

**Maliyet:** repo herkese açık olduğu için GitHub Actions dakikaları ve GitHub Pages ücretsizdir. Not: GitHub, herkese açık bir repoda 60 gün hiç commit olmazsa zamanlanmış iş akışlarını durdurur (Actions sekmesinden tek tıkla yeniden açılır). Durursa site çalışmaya devam eder, yalnızca checkpoint eskidiği için ilk açılış yavaşlar.

**Tarayıcılar arası aynılık:** `Math.sin/cos/atan2/hypot/exp/pow` tarayıcıdan tarayıcıya son basamakta farklı sonuç verebilir; kaotik bir simülasyonda bu, Safari ile Chrome'da farklı maçlar demektir. Bu yüzden simülasyon yalnızca IEEE 754'te birebir tanımlı işlemlerle (`+ − × ÷ √`) yazılmış kendi fonksiyonlarını (`DM`, `src/01_core.js`) kullanır. `node tools/live-check.js` bunu doğrular: tarayıcının matematik kütüphanesi bozulmuşken bile maçlar birebir aynı çıkmalı.

> ⚠️ **Simülasyonu değiştirmek = yeni lig.** `build.sh`, simülasyonun sonuçlarından bir parmak izi çıkarır (`tools/live-fingerprint.js`) ve sayfaya yazar. Kayıtlı lig durumları yalnızca aynı parmak iziyle geçerlidir. Yalnızca görünümü değiştiren düzenlemeler (çizim, panel, sekmeler, yazılar) parmak izini değiştirmez. Maç sonuçlarını, fikstürü, puanlamayı, sıralamayı, sezon geçişini ya da maç sürelerini değiştiren bir düzenleme (ör. denge ayarı) parmak izini değiştirir. O zaman `CONFIG.LIVE.start`'ı bugüne ya da ileri bir tarihe alın, canlı lig yeni bir lig olarak başlasın. Unutulursa checkpoint iş akışı ligin başından binlerce maçı yeniden hesaplamayı reddeder ve hata verir.

**Geçmişi izleme:** `index.html?now=2026-11-04T12:00:30+03:00` siteyi geçmişteki o anki hâliyle gösterir (yalnızca o tarayıcıda; lig değişmez). Gelecek bir an verilirse yok sayılır, aksi halde sonuçlar maçtan önce görülebilirdi.

**Sonuçlar önceden hesaplanabilir mi?** Evet, teknik bilgisi olan biri için mümkün. Site tek bir HTML dosyasıdır; ziyaretçinin tarayıcısı bütün kodu indirir (sağ tık → Kaynağı görüntüle). Maçlar yalnızca bu koddan ve saatten türediği için biri dosyayı indirip bilgisayarının saatini (ya da tarayıcı geliştirici araçlarında `Date.now`'u) ileri alırsa gelecekteki maçları görebilir. Bunu tamamen engellemenin yolu, her maçın seed'ini gizli tutup maç saatinde yayımlamaktır. Bu da maç saatlerinde güvenilir çalışan bir sunucu ya da zamanlanmış iş gerektirir.

---

## Stüdyo (video üretimi) — `?studio`

`index.html?studio` eski kontrol panelini açar. Bu moddaki lig, canlı ligden tamamen ayrıdır (tarayıcıda `arenaLeague_v1`), maç seed'leri rastgeledir.

1. `index.html?studio` adresini güncel **Google Chrome** (masaüstü) ile açın.
2. Sağdaki panelden **▶ Başlat**'a basın (veya **Boşluk** tuşu). Maç önizleme olarak oynar.
3. Video almak için **● Kaydet ve Başlat**: maç sıfırdan 1x hızda oynar, bitiş ekranından sonra video dosyası otomatik iner.
4. Bitişte paneldeki **Açıklama metni** kutusu dolar; **📋 Kopyala** ile alıp paylaşımınıza yapıştırın.

> Kayıt sırasında sekmeyi önde ve görünür tutun. Arka plana atılırsa Chrome çizimi yavaşlatır ve video takılır.

### Video formatı

Chrome destekliyorsa kayıt doğrudan **MP4**, değilse **WebM** (VP9 + Opus, 12 Mbps) olarak iner. Dosya adı örneği: `arena_week3_match2.webm`.

WebM dosyasını Instagram'a uygun MP4'e çevirmek için:

```bash
ffmpeg -i girdi.webm -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 60 -c:a aac -b:a 192k cikti.mp4
```

---

## Oyun kuralları

### Arena (günlük ana video)
- Varsayılan **6 takım**, her takımın **1 canı** var. Sahada her an **tek top** bulunur.
- Arena dönmeyen, dikey ekrana sığacak şekilde yukarı-aşağı uzatılmış bir çokgendir (`ARENA_HALF_H`). Kenar uzunlukları ve açıları farklıdır ama tüm kale ağızları eşit genişliktedir (kenarların ortalama uzunluğuna göre).
- **Top:** 600 px/sn ile başlar, her **duvar veya direk** çarpmasında %10 hızlanır (en fazla 2,4 katı). Oyuncu ve kaleci çarpmaları hızı değiştirmez. Gol olunca yeni top yine başlangıç hızıyla doğar. Top hızlandıkça izi uzar ve son dokunan takımın renginde parlar.
- **Kaleciler** topu sürekli takip eder; her takımın kalecisine maç başında rastgele bir yetenek (`skill`) atanır.
- **Oyuncular** sahada rastgele dolaşır, topa çarptıklarında topun son dokunan takımı olurlar.
- **Goller:** Gol, topa en son dokunan takımın hanesine yazılır (oyuncu **veya kaleci**). Kendi kalesine atılan goller (ve hiçbir takımın dokunmadığı toptan giren goller) ne bir takımın `AG`'sine ne de yiyenin `YG`'sine yazılır (yiyen takım yine elenir; final düellosu skorunu ise yine değiştirir). Böylece ligdeki toplam AG ile toplam YG hep eşittir. Atılan goller lig tablosunda (`AG`) birikir.
- **Gol sayacı:** Her takımın kalesinin arkasında, takım adının dışında, o maçta attığı her gol için bir mini futbol topu belirir (gol anında büyüyerek çıkar, takım renginde halka yayar). Çok gol atılırsa toplar küçülür ve ikinci sıraya geçer. Elenen takımın topları da kalır; sayı bitiş ekranındaki `⚽` gol sütunuyla aynıdır (kendi kalesine atılan goller sayılmaz).
- **Maç öncesi (~3,4 sn, `INTRO_DURATION`):** **`TODAY'S MATCHES`** ekranı: o gün (hafta) oynanmış grup maçları sonuçlarıyla (`FULL TIME`, her takımın sırası ve `+puan`), sıradaki maç (`PLAYING NOW`, hangi takımların oynayacağı) ve oynanacak maçlar (`LATER TODAY`) fikstür olarak listelenir. Ardından maç ekranı açılır.
- **Maç sonu (~7 sn, `END_DURATION`):** tek ekranda **güncel tüm puan durumu**. Önce her takımın o maçtaki sırası (`1ST`, `2ND`…) ve aldığı puan çıkar: puan alanlar yeşil `+4`, alamayanlar kırmızı `+0`. Sonra puanlar sayarak güncellenir ve takımlar yeni sıralarına kayar (▲/▼). Video bu tabloda biter. Eski kazanan kartı, maç sonucu ve ilk 8 tablosu kaldırıldı. Sezonun son grup maçında şampiyon altın, ligden çıkacak son 3 takım kırmızı çerçeveyle işaretlenir ve başlıkta şampiyon yazar. **Eleme maçlarının** bitiş ekranı o turun kartlarıdır (skorlarla, oynanan maç altın çerçeveli); elemenin finalinde 3,2 sn sonra **sezon özeti** gelir: yükselen 3 ve düşen 3 kulüp.
- **Tablo sütunları:** sıra, takım, `P` (oynanan), `GD` (averaj), maçtaki sıra + puan, `PTS` ve en sağda **`LAST 3`**: takımın bu sezonki son 3 maçtaki sırası (`1ST`, `2ND`, `3RD`…; eskiden yeniye, en sağdaki en yeni). 1. altın, 2. gümüş, 3. bronz, 4. gri, puan alınamayan 5.–6. kırmızı; henüz oynanmamış maçlar boş (`–`) kalır. Maçı oynayan takımlarda eski sonuçlar sola kayar, yeni sıra sağdan belirir. Sayı `CONFIG.FORM_COUNT` ile değiştirilebilir.
- **Gol** yiyen takım elenir:
  - Kalesi takım renginde parlayan bir duvarla **kapanır** (kapanan kale duvar gibi davranır).
  - Kalesinin arkasında **adı yazmaya devam eder** (her temada okunsun diye düz beyaz harfler, koyu çerçeveli), önünde **sırası ve aldığı puan** belirir (ör. `6TH · +2 PTS`).
  - Ekranın üstünde iki satır belirir: önce yeşil bir artıyla golü atan takım (`+ ARSENAL GOAL`; kendi kalesine atılan golde artısız `OWN GOAL`), altında elenen takım, sırası ve aldığı puan (`❌ CHELSEA · 6TH · +2 PTS`).
  - Arena küçülmez; kaleler maç boyunca hiç genişlemez.
- **Final düellosu:** İki takım kalınca arena dar ve uzun, dikey bir futbol sahasına dönüşür (kaleler arenadakinden biraz kısa) ve skor 0–0'dan başlar. **İlk 2 golü atan kazanır** (`FINAL_GOALS`).
  - Final düellosunda **her takımın 2 oyuncusu** vardır: arenadaki oyuncu **kaptan** olur (sarı **C** rozeti), yanından bir takım arkadaşı kayarak kendi yarı sahasına geçer.
  - **Kaptan şutu:** Kaptan topa dokunduğunda top rakip kaleye doğru gidiyorsa (kale merkezine `CAPTAIN_AIM_DEG` = 55° içinde) **2 kat hızlı** gider (`CAPTAIN_SHOT_MULT`); top parlar, izi uzar. Başka bir oyuncuya, kaleciye, duvara veya direğe çarpınca hız önceki değerine döner (duvar/direkte her zamanki %10 hızlanma yine uygulanır).
  - Skor sahanın üstünde gösterilir (eleme yazısı çıkarken kısa süre gizlenir); maç puanına düşen takımın kalesine top yaklaştığında ağır çekim ve kamera yakınlaşması olur.
- Saha çizgileri her temada beyazdır; sahada hiçbir engel (tampon vb.) yoktur.
- Maç sırasında **sadece eleme bilgileri** (ve final düellosunda skor) yazı olarak görünür; gol, kurtarış vb. sadece efekt ve sesle anlatılır.

### Yalnızca grup maçları
Her maç, sezon fikstüründeki sıradaki **6 takımlık grup maçıdır**. Eski **Derby** modu ve **manuel takım seçimi** kaldırıldı; tabloya yalnızca fikstürdeki grup maçları işlenir (eski kayıtlardaki bu ayarlar açılışta temizlenir).

### Temalar
Otomatik (rastgele) veya elle seçilir: **Classic**, **Snow** (top %10 hızlı), **Rain** (top %15 yavaş), **Night** (karanlık, ışık saçan top ve kaleler). Eski **Bumpers** teması (sahadaki tamponlar) kaldırıldı; kayıtlı ayarda seçiliyse Otomatik'e döner.

---

## Lig sistemi

### Takımlar
Dünyanın önde gelen 18 kulübü, kendi renkleriyle: Real Madrid, Barcelona, Atlético Madrid, Manchester City, Liverpool, Arsenal, Chelsea, Manchester United, Bayern München, Borussia Dortmund, Bayer Leverkusen, Paris Saint-Germain, Inter, AC Milan, Juventus, Fenerbahçe, Beşiktaş, Galatasaray.

Daha eski varsayılan takımlarla kaydedilmiş bir lig, uygulama ilk açıldığında bu takımlarla sıfırdan başlar.

Ad, 3 harfli kod ve renkler panelden **✏️ Takımları düzenle** ile değiştirilebilir; takım eklenip silinebilir. Gruplar hep eşit (6'şar takım) olsun diye **takım sayısı 6'nın katı olmalıdır** (6, 12, 18, 24…); başka bir sayı kaydedilmez, içe aktarılan dosya da reddedilir. Takımlar yalnızca **sezon başında** (hiç maç oynanmadan) değiştirilebilir.

### Sezon fikstürü (adil gruplar)
- 18 takım, her maçta 6 takım (`GROUP_SIZE`) → **haftada 3 grup maçı**. Her takım her hafta tam bir kez oynar; sezonu herkes aynı sayıda maçla bitirir.
- **Fikstür sezon başında bir kez oluşturulur ve sezon bitene kadar değişmez.** Bütün haftaların grupları, takım ikilileri sezon boyunca olabildiğince eşit sayıda aynı grupta bulunacak şekilde birlikte planlanır (`planSeason`: seed'li başlangıç + benzetimli tavlama). 17 haftalık bir sezonda her ikili 4–6 kez aynı grupta bulunur. Fikstür lig verisinde (`seasonPlan`) saklanır.
- Sezon başladıktan sonra takım listesi ve sezon uzunluğu değiştirilemez; bu sayede fikstür sabit kalır. Yeni sezon başlatılınca (takım değişiminden sonra) yeni fikstür oluşturulur.
- Panel haftanın gruplarını ve açılır **Sezon fikstürü** listesini (tüm haftalar, en az/en çok karşılaşma sayısı) gösterir.
- Başlıkta `WEEK 3 · GROUP MATCH 2` yazar. Haftanın son grup maçı kaydedilince hafta kendiliğinden ilerler. **📅 Yeni hafta** ile elle de geçilebilir; haftada oynanmamış grup maçı varsa hangi maçların (ve kaç takımın) atlanacağını gösteren bir **uyarı** çıkar ve onay istenir, çünkü atlanan maçlar bir daha oynanmaz.
- Sezonun son haftası bitince grup maçı kurulmaz: önce yükselme elemesi oynanır, o da bitince yeni sezon başlatılır.

### Puanlama
| Sıra | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Puan | 4 | 3 | 2 | 1 | 0 | 0 |

İlk 4 puan alır, 5. ve 6. sıra `+0 PTS` alır. Bütün gruplar 6 takımlık olduğu için her maçın beklenen puanı her takım için aynıdır. Puanlar panelden değiştirilebilir; eski varsayılan 10-7-5-4-3-2-1 ile kaydedilmiş bir lig açılışta yeni varsayılana geçer. Tablo sıralaması: **Puan → birincilik sayısı → ikincilik sayısı → üçüncülük sayısı → dördüncülük sayısı → atılan gol (AG) → sezonluk kura**. Averaj (AV) sütunu bilgi amaçlı gösterilir ama sıralamada kullanılmaz: yenilen gol zaten maçtaki bitiş sırasına bağlı olduğundan (ör. finalde yenilen ikinci 2 gol yer) sırayı iki kez sayardı. Hâlâ eşit kalan takımlar için ad sırası yerine, her sezon başında bir kez çekilen ve `league.json`'da (`tieOrder`) saklanan rastgele kura sırası kullanılır; böylece alfabede önde olmak avantaj sağlamaz. Tablo sütunları: O, P, 1st, AG, YG, AV, Son 3 (son 3 maçtaki sırası, en sağdaki en yeni).

### Sezon sonu: şampiyon, yükselme elemesi ve takım değişimi
Sezonun son haftası (varsayılan 17) oynanınca **grup maçlarının finali yoktur**: tabloda **1. olan takım şampiyon** olur ve kaydedilir; tablonun **son 3 takımı** (`RELEGATE_COUNT`) ligden düşer (yeri kesinleşir, tablo "final tablosu" olarak kalır). Düşenlerin yerini **havuzdaki kulüpler** doldurur. Havuzda 12 kulüp vardır (Napoli, Roma, Atalanta, Tottenham, Aston Villa, Benfica, Porto, Ajax, Sevilla, Marseille, Sporting CP, Trabzonspor + sonradan düşenler) ve **grup maçları bittikten sonra** kendi aralarında **tek maçlık (rövanşsız) yükselme elemesi** oynarlar:

| Tur | Maç | |
|---|---|---|
| 1. tur | 4 | 8 kulüp oynar, kurada ilk 4 çekilen kulüp **bay geçer** |
| Çeyrek final | 4 | 4 bay kulübü + 4 galip |
| Yarı final | 2 | |
| 3.lük maçı + Final | 2 | yarı final mağlupları 3.lük maçını oynar |

- Kura, grup maçları biter bitmez sezonun seed'iyle çekilir ve `league.json`'da (`cup`) saklanır: aynı sezon aynı kura, her tarayıcıda aynı. Maçlar tablodaki sırayla, tek tek oynanır (toplam **12 maç**).
- Her eleme maçı **1'e 1 düellodur**: 2 kulüp, final düellosu sahası (kaptan + 1 oyuncu), **ilk 2 golü atan kazanır**; beraberlik, uzatma ya da penaltı olmaz (skor 2–0 ya da 2–1). Eleme maçı puan getirmez, tabloya işlenmez.
- **Yükselenler:** final galibi, finalist ve 3.lük maçının galibi (`FIN` + `3RD`). Düşen 3 takım havuza girer; havuz hep 12 kulüp kalır, düşenler en erken **bir sonraki sezonun** elemesine katılır.
- Eleme bitince tablo, hafta ve maç geçmişi sıfırlanır; yeni sezon 1. haftadan başlar. Biten sezon `data/active/seasons/season-N.json` dosyasına (şampiyon, çıkanlar, gelenler, son tablo, maç geçmişi, **eleme kurası ve sonuçları**) arşivlenir.
- Son grup maçının açıklama metninde şampiyon ve düşenler yazılır, "eleme belirleyecek" notu düşülür; elemenin finalinin açıklamasında yükselenler ve düşenler yazılır. Tarayıcıda panel durumu gösterir ve eleme bittiğinde **Yeni sezonu başlat** düğmesi geçişi yapar; günlük otomasyon (`tools/daily.js`) her çalıştırmada bir eleme turunu oynatır, eleme bitince geçişi kendiliğinden yapar.
- Eleme yalnızca havuzda tam `CONFIG.CUP_SIZE` (12) kulüp varken ve `RELEGATE_COUNT` 3 iken oynanır; başka bir havuz (ör. içe aktarılan dosyada) eski kuyruk kuralıyla çalışır: havuzun ilk `RELEGATE_COUNT` kulübü gelir, düşenler sona eklenir.

### Kalıcılık ve yedekleme
- Lig verisi tarayıcının `localStorage`'ında `arenaLeague_v1` anahtarıyla saklanır. Depolama kullanılamazsa uygulama bellekte çalışır ve panelde uyarı gösterir.
- **⬇ Tabloyu dışa aktar** / **⬆ Tabloyu içe aktar**: takımlar, tablo, hafta, maç geçmişi (seed, tema, takımlar, sonuç) ve sezon fikstürü tek bir JSON dosyasında.
- **Test maçı** kutusu işaretliyse sonuç tabloya yazılmaz.
- Sezon uzunluğu varsayılan 17 haftadır; grup maçları bitince panel şampiyonu, ligden çıkacak takımları ve yükselme elemesinin durumunu gösterir; eleme bitince **Yeni sezonu başlat** düğmesi sezonu arşivleyip yenisini açar.
- Tarayıcıdaki lig, repodaki aktif ligden ayrıdır; tarayıcıda yapılan denemeler aktif lige yansımaz. Aktif ligi tarayıcıda görmek için `data/active/league.json` dosyasını **⬆ Tabloyu içe aktar** ile yükleyin (bkz. [Otomatik günlük maç günü](#otomatik-günlük-maç-günü)).

---

## Otomatik günlük maç günü

> Canlı lig (site) videosuz çalışır. Bu bölüm stüdyo ligi için video üretimini anlatır ve isteğe bağlıdır.

Aktif ligin videoları tarayıcıyı açmadan üretilir: `tools/daily.js` uygulamayı ekransız Chrome'da çalıştırır, haftanın kalan grup maçlarını oynatır ve her maç için ayrı bir **MP4** (1080×1920, 60 FPS, H.264 + AAC) üretir. Maç gerçek zamanlı oynatılıp ekrandan kaydedilmez; her kare tek tek çizilip kodlanır, sesler de dosyaya sentezlenir. Bu yüzden video, makinenin hızından bağımsız olarak akıcıdır. 1 dakikalık bir maç yaklaşık 2 dakikada hazırlanır.

```bash
node tools/daily.js active --max 1          # sıradaki tek grup maçı (1 video) — zamanlanmış görev günde 3 kez çalıştırır
node tools/daily.js active                  # haftanın kalan maçları (normalde 3 video) tek seferde
node tools/daily.js --dry-run --max 1       # deneme: 1 video üretir, lig verisine dokunmaz
```

### Aktif lig

Sosyal medyada paylaşılan lig `data/active/` klasöründedir. Her gün otomatik olarak bir hafta (3 grup maçı) oynanır; her grup maçı günün ayrı bir saatinde. `node tools/daily.js active` komutunu elle çalıştırmayın; lig ilerler. Denemeler tarayıcıda (lig tablosuna yazılmaz) ya da `--dry-run` ile yapılır.

Klasörde:
- `league.json`: lig verisi. Biçimi paneldeki **⬇ Tabloyu dışa aktar** dosyasıyla aynıdır; **⬆ Tabloyu içe aktar** ile tarayıcıya yüklenebilir.
- `STANDINGS.md`: GitHub'da doğrudan okunabilen lig tablosu (her takımın son maçlardaki sırasıyla) ve son maçlar.
- `seasons/season-N.json`: biten sezonların arşivi (son tablo, şampiyon, maç geçmişi).

Sezonun son haftası (varsayılan 17. hafta) oynandığında grup maçlarının finali yoktur; **tabloda 1. olan şampiyon** olur (son maçın videosunda ve açıklama metninde duyurulur). Sonraki çalıştırmalar yükselme elemesini oynatır: her çalıştırma bir turu (1. tur, çeyrek final, yarı final, 3.lük maçı + final) videolar. Elemenin son maçını oynatan çalıştırma sezonu arşivler, elemede ilk 3'e giren 3 havuz kulübünü lige alır ve yeni sezon 1. haftadan başlar (bkz. [Sezon sonu](#sezon-sonu-şampiyon-ve-takım-değişimi)). Eleme videoları `sN_playoff_<sıra>_<maç>.mp4` adını taşır.

Videolar ve açıklama metinleri `out/active/<tarih>/` klasörüne yazılır (`--dry-run` ile `out/dry-run/<tarih>/`) (repoya eklenmez): `*.mp4`, `captions.txt`, `summary.json`.

### Zamanlanmış görev

Eskiden aktif lig, Claude Code'da tanımlı bir zamanlanmış görevle her gece oynatılıp videoları gönderiliyordu. Canlı siteye geçildiği için bu görev **durduruldu** (silinmedi; Claude uygulamasındaki zamanlanmış görevler listesinden yeniden açılabilir). Görev `main` dalında `node tools/daily.js active` çalıştırır, videoları Claude uygulamasına gönderir, `data/active/` değişikliklerini `main`'e kaydeder.

---

## Kontrol paneli

| Bölüm | İçerik |
|---|---|
| Maç | Başlat, Kaydet ve Başlat, Duraklat/Devam, Sıfırla, durum ve `● REC` göstergesi |
| Ayarlar | Can (1–5), tema, top hızı çarpanı, test maçı, simülasyon hızı (1x/2x/4x, sadece önizleme), ses |
| Açıklama metni | Maç sonunda otomatik dolan, kopyalanabilir paylaşım metni |
| Lig | Sezon/hafta bilgisi, haftanın grupları, sezon fikstürü, Yeni hafta (oynanmamış maç varsa uyarır), dışa/içe aktar, takımları düzenle, ligi sıfırla, puan ayarları, tam lig tablosu |
| Denge testi | Mevcut ayarlarla 100 maçı çizimsiz simüle eder (lig tablosunu etkilemez) |
| Yardım | Kısa kullanım notları ve ffmpeg komutu |

---

## Denge

Varsayılan ayarlarla (6 takımlık grup maçı, 1 can) testlerde ortalama maç süresi **~58 sn**. 2000 maçlık testte her kale konumu her sırayı %15–18 oranında aldı (eşit dağılım %16,7); final düellosunda üst ve alt kale %50'şer kazandı.

Önemli ayarlar `src/01_core.js` dosyasının başındaki `CONFIG` nesnesinde:

| Ayar | Varsayılan | Anlamı |
|---|---|---|
| `BALL_SPEED` | 600 | Topun başlangıç hızı (px/sn) |
| `WALL_ACCEL` | 0.10 | Her duvar/direk çarpmasında hız artışı (%10) |
| `BALL_MAX_MULT` | 2.4 | Hız tavanı (başlangıç hızının katı) |
| `GOAL_FRAC` | 0.50 | Arena kale ağzı (ortalama kenar uzunluğunun oranı) |
| `ARENA_HALF_H` | 465 | Arenanın merkezden üst/alt köşelerine yüksekliği (uzatma miktarı) |
| `ROT_SPEED_DEG` | 0 | Arenanın dönme hızı (°/sn; 0 = sabit) |
| `GOAL_GROW` | false | `true` yapılırsa kaleler elemelerden sonra (`ELIM_GOAL_GROW` 0.25) ve uzatmada genişler |
| `FINAL_GOAL_FRAC` | 0.54 | Final düellosu kale ağzı (saha genişliğinin oranı) |
| `FINAL_GOALS` | 2 | Final düellosunu kazanmak için gereken gol |
| `FINAL_W` / `FINAL_H` | 820 / 1030 | Final düellosu sahasının boyutu (`FINAL_DY` 30: skor tablosunun altında kalsın diye biraz aşağıda) |
| `CAPTAIN_SHOT_MULT` / `CAPTAIN_AIM_DEG` | 2 / 55 | Kaptan şutunun hız katı / rakip kaleye yönelme açısı |
| `KEEPER_GAIN` / `KEEPER_READ` | 3 / 0.3 | Kalecinin tepki hızı / topun yolunu okuma oranı |
| `OT_AT` | 45 | `GOAL_GROW` açıkken son elemeden kaç sn sonra uzatma başlar |
| `DEFAULT_LIVES` | 1 | Takım başına can |
| `FORM_COUNT` | 3 | Lig tablosunun en sağındaki son maç sırası sayısı (`LAST 3`) |
| `RELEGATE_COUNT` / `CUP_SIZE` | 3 / 12 | Sezon sonunda düşen / yükselen takım sayısı; yükselme elemesine katılan havuz kulübü sayısı (bkz. [Sezon sonu](#sezon-sonu-şampiyon-ve-takım-değişimi)) |
| `LIVE` | 05–09: 5 dk · 09–19: 10 dk · 19–05: 3 dk | Canlı ligin başlangıcı, maç takvimi, taşma payı ve seed tohumu (bkz. [Canlı lig](#canlı-lig-site)) |

---

## Proje yapısı

```
index.html          Uygulamanın kendisi (tek dosya, doğrudan açılır)
build.sh            src/ parçalarını index.html'de birleştirir
src/
  00_head.html      HTML iskeleti, panel ve stiller
  01_core.js        CONFIG, takımlar (lig + havuz), seed'li RNG, matematik, sezon fikstürü planlayıcısı
  02_sim.js         Fizik ve oyun mantığı (arena, top, kaleci, oyuncu, eleme, final düellosu)
  03_fx_audio.js    Temalar, görsel efektler, Web Audio ile sentezlenen sesler
  04_render.js      Canvas çizimi, HUD ve bitiş ekranı
  05_app.js         Lig, kayıt, kontrol paneli, denge testi, ana döngü
  06_offline.js     Ekransız video üretimi (kare kare çizim, WebCodecs H.264, OfflineAudioContext)
  07_live.js        Canlı lig: maç takvimi, seed türetme, geçmiş maçları hesaplama, saate senkron oynatma, geri sayım ekranı, sekmeler
tools/
  balance.js        Terminalden denge testi (Node.js)
  live-check.js     Canlı lig testleri: determinizm, takvim, taşma kuralı (--long: 48 saatlik koşu)
  live-state.js     live-state.json checkpoint'ini üretir (Pages iş akışı 15 dakikada bir çalıştırır)
  live-fingerprint.js  Simülasyon parmak izi (build.sh → BUILD_SIM_HASH)
  live-node.js      Canlı lig motorunu tarayıcısız (Node) yükler
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
node tools/balance.js          # 6 takımlık grup maçı, 1 can, 100 maç
node tools/live-check.js       # canlı lig: determinizm, takvim, taşma kuralı (--long: 48 saatlik koşu)
node tools/balance.js 1 200    # can, maç sayısı
CFG='{"BALL_SPEED":650,"WALL_ACCEL":0.08}' node tools/balance.js   # ayar denemek için
```

Harici kütüphane kullanılmaz (vanilla JavaScript + Canvas 2D + Web Audio). Fizik motoru, bir maçın kayıtlı seed'i ile birebir tekrarlanabilmesi (hata ayıklama, yeniden render) için uygulamaya özel yazılmıştır: sabit zaman adımı (240 Hz), oyun mantığı ve görsel efektler için ayrı seed'li rastgele sayı üreteçleri. Yazı tipleri (Bebas Neue, Inter) Google Fonts'tan yüklenir; internet yoksa sistem yazı tiplerine düşer.

---

## Not

Uygulama gerçek kulüp adlarını ve renklerini kullanır; logo veya arma kullanmaz. Para kazanan bir hesapta gerçek kulüp adlarıyla içerik yayınlamak marka hakkı şikâyetlerine yol açabilir. Takım listesi panelden kurgusal takımlarla değiştirilebilir.
