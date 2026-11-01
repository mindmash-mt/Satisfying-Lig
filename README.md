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
- **Gol** yiyen takım elenir:
  - Kalesi takım renginde parlayan bir duvarla **kapanır** (kapanan kale duvar gibi davranır).
  - Kalesinin arkasında **adı yazmaya devam eder**, önünde **sırası ve aldığı puan** belirir (ör. `6TH · +2 PTS`).
  - Ekranın üstünde büyük harflerle `❌ CHELSEA · 6TH · +2 PTS` yazar (takım, sıra ve aldığı puan).
  - Arena küçülmez; kaleler maç boyunca hiç genişlemez.
- **Final düellosu:** İki takım kalınca arena dikey bir futbol sahasına dönüşür ve skor 0–0'dan başlar. **İlk 2 golü atan kazanır** (`FINAL_GOALS`). Skor sahanın üstünde gösterilir (eleme yazısı çıkarken kısa süre gizlenir); maç puanına düşen takımın kalesine top yaklaştığında ağır çekim ve kamera yakınlaşması olur.
- Maç sırasında **sadece eleme bilgileri** (ve final düellosunda skor) yazı olarak görünür; gol, kurtarış vb. sadece efekt ve sesle anlatılır.

### Derby
İki takım, klasik saha, takım başına 1 kaleci + 2 oyuncu. 30 sn sonunda çok gol atan kazanır; berabere biterse ilk gol kazanır. Galibe +5 puan.

### Season Final
Lig tablosunun ilk 4 takımı arena modunda şampiyonluk maçı oynar. Puan verilmez, şampiyon kaydedilir.

### Temalar
Otomatik (seed ile) veya elle seçilir: **Classic**, **Snow** (top %10 hızlı), **Rain** (top %15 yavaş), **Night** (karanlık, ışık saçan top ve kaleler), **Bumpers** (sahada sektiren tamponlar; derby'de kullanılmaz).

---

## Lig sistemi

### Takımlar
Dünyanın önde gelen 18 kulübü, kendi renkleriyle: Real Madrid, Barcelona, Atlético Madrid, Manchester City, Liverpool, Arsenal, Chelsea, Manchester United, Bayern München, Borussia Dortmund, Bayer Leverkusen, Paris Saint-Germain, Inter, AC Milan, Juventus, Fenerbahçe, Beşiktaş, Galatasaray.

Daha eski varsayılan takımlarla kaydedilmiş bir lig, uygulama ilk açıldığında bu takımlarla sıfırdan başlar.

Ad, 3 harfli kod ve renkler panelden **✏️ Takımları düzenle** ile değiştirilebilir; takım eklenip silinebilir.

### Haftalar ve adil gruplar
- 18 takım, maç başına 6 takım → **haftada 3 grup maçı**. Her takım haftada bir kez oynar.
- Başlıkta `WEEK 3 · GROUP MATCH 2` yazar. Haftanın son grup maçı kaydedilince hafta kendiliğinden ilerler (**📅 Yeni hafta** ile elle de geçilir).
- Haftanın grupları, geçmişte **birbiriyle en az aynı grupta bulunmuş** takımları bir araya getirecek şekilde dağıtılır. 30 haftalık bir sezonda her takım ikilisi 8–10 kez aynı grupta bulunur (rastgele dağıtımda bu aralık 1–15'tir). Panel, haftanın gruplarını ve en az/en çok karşılaşma sayısını gösterir.

### Puanlama
| Sıra | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Puan | 10 | 7 | 5 | 4 | 3 | 2 | 1 | 0 | 0 | 0 |

Puanlar panelden değiştirilebilir. Tablo sıralaması: **Puan → Averaj → Atılan gol → Birincilik**. Tablo sütunları: O, P, 1st, AG, YG, AV.

### Kalıcılık ve yedekleme
- Lig verisi tarayıcının `localStorage`'ında `arenaLeague_v1` anahtarıyla saklanır. Depolama kullanılamazsa uygulama bellekte çalışır ve panelde uyarı gösterir.
- **⬇ Tabloyu dışa aktar** / **⬆ Tabloyu içe aktar**: takımlar, tablo, hafta, maç geçmişi (seed, mod, tema, takımlar, sonuç) tek bir JSON dosyasında.
- **Test maçı** kutusu işaretliyse sonuç tabloya yazılmaz.
- Sezon uzunluğu varsayılan 30 haftadır; sezon bitince panel **Season Final** modunu önerir.

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
| Season Final (4 takım) | ~35 sn |

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
| `FINAL_GOAL_FRAC` | 0.61 | Final düellosu kale ağzı (saha genişliğinin oranı) |
| `FINAL_GOALS` | 2 | Final düellosunu kazanmak için gereken gol |
| `FINAL_W` / `FINAL_H` | 860 / 930 | Final düellosu sahasının boyutu |
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
  02_sim.js         Fizik ve oyun mantığı (arena, top, kaleci, oyuncu, eleme, final, derby)
  03_fx_audio.js    Temalar, görsel efektler, Web Audio ile sentezlenen sesler
  04_render.js      Canvas çizimi, HUD ve bitiş ekranı
  05_app.js         Lig, kayıt, kontrol paneli, denge testi, ana döngü
tools/
  balance.js        Terminalden denge testi (Node.js)
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
