# Satisfying Lig ⚽

Instagram Reels, TikTok ve YouTube Shorts için **"satisfying" futbol simülasyonu videoları** üreten tek dosyalık bir tarayıcı uygulaması.

Çokgen bir arenanın her kenarında dünyanın önde gelen bir futbol kulübünün kalesi var. Top duvarlara çarptıkça hızlanır, kaleciler topu takip eder. Gol yiyen takım elenir, kalesi kapanır. **Son kalan takım kazanır** ve aldığı puanlar kalıcı bir **lig tablosuna** işlenir.

- Kurulum yok: `index.html` dosyasını Chrome'da açmanız yeterli.
- Dikey 1080×1920 (9:16) video, 60 FPS, sesli kayıt.
- Aynı seed + aynı takımlar + aynı ayarlar = birebir aynı maç.
- Videodaki tüm yazılar İngilizce (global kitle), kontrol paneli Türkçe.

---

## Hızlı başlangıç

1. `index.html` dosyasını güncel **Google Chrome** (masaüstü) ile açın.
2. Sağdaki panelden **▶ Başlat**'a basın (veya **Boşluk** tuşu). Maç önizleme olarak oynar.
3. Video almak için **● Kaydet ve Başlat**: maç sıfırdan 1x hızda oynar, bitiş ekranından sonra video dosyası otomatik iner.
4. Bitişte paneldeki **Açıklama metni** kutusu dolar; **📋 Kopyala** ile alıp paylaşımınıza yapıştırın.

> Kayıt sırasında sekmeyi önde ve görünür tutun. Arka plana atılırsa Chrome çizimi yavaşlatır ve video takılır.

### Video formatı

Chrome destekliyorsa kayıt doğrudan **MP4**, değilse **WebM** (VP9 + Opus, 12 Mbps) olarak iner. Dosya adı örneği: `arena_week3_match2_seed48213.webm`.

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
- **Goller:** Gol, topa en son dokunan takımın hanesine yazılır (oyuncu **veya kaleci**). Kendi kalesine atılan goller hiçbir takımın gol sayısına eklenmez (final düellosu ve derby skorunu ise yine değiştirir). Atılan goller lig tablosunda (`AG`/GF) birikir.
- **Gol sayacı:** Her takımın kalesinin arkasında, takım adının dışında, o maçta attığı her gol için bir mini futbol topu belirir (gol anında büyüyerek çıkar, takım renginde halka yayar). Çok gol atılırsa toplar küçülür ve ikinci sıraya geçer. Elenen takımın topları da kalır; sayı bitiş ekranındaki `⚽` gol sütunuyla aynıdır (kendi kalesine atılan goller sayılmaz).
- **Maç öncesi (~3,4 sn, `INTRO_DURATION`):** **`TODAY'S MATCHES`** ekranı: o gün (hafta) oynanmış grup maçları sonuçlarıyla (`FULL TIME`, her takımın sırası ve `+puan`), sıradaki maç (`PLAYING NOW`, hangi takımların oynayacağı) ve oynanacak maçlar (`LATER TODAY`) fikstür olarak listelenir. Ardından maç ekranı açılır. Derby'de yalnızca o maç görünür.
- **Maç sonu (~7 sn, `END_DURATION`):** tek ekranda **güncel tüm puan durumu**. Önce her takımın o maçtaki sırası (`1ST`, `2ND`…) ve aldığı puan çıkar: puan alanlar yeşil `+4`, alamayanlar kırmızı `+0`. Sonra puanlar sayarak güncellenir ve takımlar yeni sıralarına kayar (▲/▼). Video bu tabloda biter. Eski kazanan kartı, maç sonucu ve ilk 8 tablosu kaldırıldı. Sezonun son maçında şampiyon altın, ligden çıkacak son 3 takım kırmızı çerçeveyle işaretlenir ve başlıkta şampiyon yazar.
- **Tablo sütunları:** sıra, takım, `P` (oynanan), `GD` (averaj), maçtaki sıra + puan, `PTS`.
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

### Derby
İki takım, klasik saha, takım başına 1 kaleci + 2 oyuncu. 30 sn sonunda çok gol atan kazanır; berabere biterse ilk gol kazanır. Galibe +5 puan.


### Temalar
Otomatik (seed ile) veya elle seçilir: **Classic**, **Snow** (top %10 hızlı), **Rain** (top %15 yavaş), **Night** (karanlık, ışık saçan top ve kaleler). Eski **Bumpers** teması (sahadaki tamponlar) kaldırıldı; kayıtlı ayarda seçiliyse Otomatik'e döner.

---

## Lig sistemi

### Takımlar
Dünyanın önde gelen 18 kulübü, kendi renkleriyle: Real Madrid, Barcelona, Atlético Madrid, Manchester City, Liverpool, Arsenal, Chelsea, Manchester United, Bayern München, Borussia Dortmund, Bayer Leverkusen, Paris Saint-Germain, Inter, AC Milan, Juventus, Fenerbahçe, Beşiktaş, Galatasaray.

Daha eski varsayılan takımlarla kaydedilmiş bir lig, uygulama ilk açıldığında bu takımlarla sıfırdan başlar.

Ad, 3 harfli kod ve renkler panelden **✏️ Takımları düzenle** ile değiştirilebilir; takım eklenip silinebilir.

### Haftalar ve adil gruplar
- 18 takım, maç başına 6 takım → **haftada 3 grup maçı**. Her takım haftada bir kez oynar.
- Başlıkta `WEEK 3 · GROUP MATCH 2` yazar. Haftanın son grup maçı kaydedilince hafta kendiliğinden ilerler (**📅 Yeni hafta** ile elle de geçilir).
- Haftanın grupları, geçmişte **birbiriyle en az aynı grupta bulunmuş** takımları bir araya getirecek şekilde dağıtılır. 17 haftalık bir sezonda her takım ikilisi 4–6 kez aynı grupta bulunur (rastgele dağıtımda bu aralık çok daha geniştir). Panel, haftanın gruplarını ve en az/en çok karşılaşma sayısını gösterir.

### Puanlama
| Sıra | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Puan | 4 | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |

İlk 4 puan alır, gerisi 0 puan alır (6 takımlı maçta 5. ve 6. sıra `+0 PTS`). Puanlar panelden değiştirilebilir; eski varsayılan 10-7-5-4-3-2-1 ile kaydedilmiş bir lig açılışta yeni varsayılana geçer. Tablo sıralaması: **Puan → Averaj → Atılan gol → Birincilik**. Tablo sütunları: O, P, 1st, AG, YG, AV.

### Sezon sonu: şampiyon ve takım değişimi
Sezonun son haftası (varsayılan 17) oynanınca **final maçı yoktur**: tabloda **1. olan takım şampiyon** olur ve kaydedilir. Ardından:
- Tablonun **son 3 takımı** (`RELEGATE_COUNT`) ertesi sezon ligde yer almaz.
- Yerlerine **yedek kuyruğundaki ilk 3 kulüp** gelir. Kuyruk sırayla: Napoli, Roma, Atalanta, Tottenham, Aston Villa, Benfica, Porto, Ajax, Sevilla, Marseille, Sporting CP, Trabzonspor. Ligden çıkan takımlar kuyruğun sonuna eklenir; yani sıra gelince geri dönebilirler.
- Tablo, hafta ve maç geçmişi sıfırlanır; yeni sezon 1. haftadan başlar. Biten sezon `data/active/seasons/season-N.json` dosyasına (şampiyon, çıkanlar, gelenler, son tablo, maç geçmişi) arşivlenir.
- Sezonun son maçının açıklama metninde şampiyon, ligden çıkanlar ve gelenler yazılır. Tarayıcıda panel aynı bilgiyi gösterir ve **Yeni sezonu başlat** düğmesi geçişi yapar; günlük otomasyon (`tools/daily.js`) bunu kendiliğinden yapar.

### Kalıcılık ve yedekleme
- Lig verisi tarayıcının `localStorage`'ında `arenaLeague_v1` anahtarıyla saklanır. Depolama kullanılamazsa uygulama bellekte çalışır ve panelde uyarı gösterir.
- **⬇ Tabloyu dışa aktar** / **⬆ Tabloyu içe aktar**: takımlar, tablo, hafta, maç geçmişi (seed, mod, tema, takımlar, sonuç) tek bir JSON dosyasında.
- **Test maçı** kutusu işaretliyse sonuç tabloya yazılmaz.
- Sezon uzunluğu varsayılan 17 haftadır; sezon bitince panel şampiyonu ve ligden çıkacak takımları gösterir, **Yeni sezonu başlat** düğmesi sezonu arşivleyip yenisini açar.
- Tarayıcıdaki lig, repodaki aktif ligden ayrıdır; tarayıcıda yapılan denemeler aktif lige yansımaz. Aktif ligi tarayıcıda görmek için `data/active/league.json` dosyasını **⬆ Tabloyu içe aktar** ile yükleyin (bkz. [Otomatik günlük maç günü](#otomatik-günlük-maç-günü)).

---

## Otomatik günlük maç günü

Aktif ligin videoları tarayıcıyı açmadan üretilir: `tools/daily.js` uygulamayı ekransız Chrome'da çalıştırır, haftanın kalan grup maçlarını oynatır ve her maç için ayrı bir **MP4** (1080×1920, 60 FPS, H.264 + AAC) üretir. Maç gerçek zamanlı oynatılıp ekrandan kaydedilmez; her kare tek tek çizilip kodlanır, sesler de dosyaya sentezlenir. Bu yüzden video, makinenin hızından bağımsız olarak akıcıdır. 1 dakikalık bir maç yaklaşık 2 dakikada hazırlanır.

```bash
node tools/daily.js active                  # haftanın kalan maçları (normalde 3 video) — her sabah görev çalıştırır
node tools/daily.js --dry-run --max 1       # deneme: 1 video üretir, lig verisine dokunmaz
```

### Aktif lig

Sosyal medyada paylaşılan lig `data/active/` klasöründedir. Her gün otomatik olarak bir hafta (3 grup maçı) oynanır. `node tools/daily.js active` komutunu elle çalıştırmayın; lig bir hafta ilerler. Denemeler tarayıcıda (lig tablosuna yazılmaz) ya da `--dry-run` ile yapılır.

Klasörde:
- `league.json`: lig verisi. Biçimi paneldeki **⬇ Tabloyu dışa aktar** dosyasıyla aynıdır; **⬆ Tabloyu içe aktar** ile tarayıcıya yüklenebilir.
- `STANDINGS.md`: GitHub'da doğrudan okunabilen lig tablosu ve son maçlar.
- `seasons/season-N.json`: biten sezonların arşivi (son tablo, şampiyon, maç geçmişi).

Sezonun son haftası (varsayılan 17. hafta) oynandığında final maçı yoktur; **tabloda 1. olan şampiyon** olur (son maçın videosunda ve açıklama metninde duyurulur). Aynı çalıştırmada sezon arşivlenir, son 3 takım ligden çıkar, yedek kuyruğundaki 3 kulüp gelir ve yeni sezon 1. haftadan başlar (bkz. [Sezon sonu](#sezon-sonu-şampiyon-ve-takım-değişimi)).

Videolar ve açıklama metinleri `out/active/<tarih>/` klasörüne yazılır (`--dry-run` ile `out/dry-run/<tarih>/`) (repoya eklenmez): `*.mp4`, `captions.txt`, `summary.json`.

### Zamanlanmış görev

Aktif lig, Claude Code'da tanımlı zamanlanmış bir görevle her gün İstanbul saatiyle 04:00'e kadar oynatılır. Görev her sabah yeni bir oturum açar, `main` dalında `node tools/daily.js active` çalıştırır, videoları ve açıklama metinlerini Claude uygulamasına bildirimle gönderir, `data/active/` değişikliklerini `main`'e kaydeder.

---

## Kontrol paneli

| Bölüm | İçerik |
|---|---|
| Maç | Başlat, Kaydet ve Başlat, Duraklat/Devam, Sıfırla, durum ve `● REC` göstergesi |
| Ayarlar | Mod, takım sayısı (4–10), can (1–5), takım seçimi (otomatik/manuel), seed + rastgele seed, tema, top hızı çarpanı, test maçı, simülasyon hızı (1x/2x/4x, sadece önizleme), ses |
| Açıklama metni | Maç sonunda otomatik dolan, kopyalanabilir paylaşım metni |
| Lig | Hafta bilgisi, haftanın grupları, Yeni hafta, dışa/içe aktar, takımları düzenle, ligi sıfırla, puan ayarları, tam lig tablosu |
| Denge testi | Mevcut ayarlarla 100 maçı çizimsiz simüle eder (lig tablosunu etkilemez) |
| Yardım | Kısa kullanım notları ve ffmpeg komutu |

---

## Denge

Varsayılan ayarlarla (6 takım, 1 can) 100 maçlık testlerde:

| Mod | Ortalama süre |
|---|---|
| Arena, 6 takım | ~58 sn |
| Arena, 4 takım | ~36 sn |
| Arena, 8 takım | ~94 sn |
| Arena, 10 takım | ~140 sn (bazı maçlar 300 sn sınırına ulaşır) |
| Derby | ~31 sn |

Önemli ayarlar `src/01_core.js` dosyasının başındaki `CONFIG` nesnesinde:

| Ayar | Varsayılan | Anlamı |
|---|---|---|
| `BALL_SPEED` | 600 | Topun başlangıç hızı (px/sn) |
| `WALL_ACCEL` | 0.10 | Her duvar/direk çarpmasında hız artışı (%10) |
| `BALL_MAX_MULT` | 2.4 | Hız tavanı (başlangıç hızının katı) |
| `GOAL_FRAC` | 0.50 | Arena kale ağzı (ortalama kenar uzunluğunun oranı) |
| `ARENA_HALF_H` | 465 | Arenanın merkezden üst/alt köşelerine yüksekliği (uzatma miktarı) |
| `ROT_SPEED_DEG` | 0 | Arenanın dönme hızı (°/sn; 0 = sabit) |
| `GOAL_GROW` | false | `true` yapılırsa kaleler elemelerden sonra (`ELIM_GOAL_GROW` 0.25), uzatmada ve derby altın golünde genişler |
| `FINAL_GOAL_FRAC` | 0.54 | Final düellosu kale ağzı (saha genişliğinin oranı) |
| `FINAL_GOALS` | 2 | Final düellosunu kazanmak için gereken gol |
| `FINAL_W` / `FINAL_H` | 820 / 1030 | Final düellosu sahasının boyutu (`FINAL_DY` 30: skor tablosunun altında kalsın diye biraz aşağıda) |
| `CAPTAIN_SHOT_MULT` / `CAPTAIN_AIM_DEG` | 2 / 55 | Kaptan şutunun hız katı / rakip kaleye yönelme açısı |
| `KEEPER_GAIN` / `KEEPER_READ` | 3 / 0.3 | Kalecinin tepki hızı / topun yolunu okuma oranı |
| `OT_AT` | 45 | `GOAL_GROW` açıkken son elemeden kaç sn sonra uzatma başlar |
| `DEFAULT_LIVES` | 1 | Takım başına can |

---

## Proje yapısı

```
index.html          Uygulamanın kendisi (tek dosya, doğrudan açılır)
build.sh            src/ parçalarını index.html'de birleştirir
src/
  00_head.html      HTML iskeleti, panel ve stiller
  01_core.js        CONFIG, takımlar, seed'li RNG, matematik, adil grup dağıtıcı
  02_sim.js         Fizik ve oyun mantığı (arena, top, kaleci, oyuncu, eleme, final düellosu, derby)
  03_fx_audio.js    Temalar, görsel efektler, Web Audio ile sentezlenen sesler
  04_render.js      Canvas çizimi, HUD ve bitiş ekranı
  05_app.js         Lig, kayıt, kontrol paneli, denge testi, ana döngü
  06_offline.js     Ekransız video üretimi (kare kare çizim, WebCodecs H.264, OfflineAudioContext)
tools/
  balance.js        Terminalden denge testi (Node.js)
  daily.js          Günlük maç günü: maçları oynatır, MP4 üretir, lig verisini günceller
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
node tools/balance.js                 # arena, 6 takım, 1 can, 100 maç
node tools/balance.js arena 8 1 200   # mod, takım sayısı, can, maç sayısı
node tools/balance.js derby
CFG='{"BALL_SPEED":650,"WALL_ACCEL":0.08}' node tools/balance.js   # ayar denemek için
```

Harici kütüphane kullanılmaz (vanilla JavaScript + Canvas 2D + Web Audio). Fizik motoru, sonuçların seed ile tekrarlanabilmesi için uygulamaya özel yazılmıştır: sabit zaman adımı (240 Hz), oyun mantığı ve görsel efektler için ayrı seed'li rastgele sayı üreteçleri. Yazı tipleri (Bebas Neue, Inter) Google Fonts'tan yüklenir; internet yoksa sistem yazı tiplerine düşer.

---

## Not

Uygulama gerçek kulüp adlarını ve renklerini kullanır; logo veya arma kullanmaz. Para kazanan bir hesapta gerçek kulüp adlarıyla içerik yayınlamak marka hakkı şikâyetlerine yol açabilir. Takım listesi panelden kurgusal takımlarla değiştirilebilir.
