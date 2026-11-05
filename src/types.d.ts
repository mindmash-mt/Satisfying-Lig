/* Tip denetimi için (npm run typecheck): derlenmiş sayfaya girmez. build.sh'ın sayfaya yazdığı sabitler ve
   pencereye eklenen birkaç alan. Kaynaklar tek bir betikte birleştiği için src/*.js birbirinin globallerini görür. */
declare const BUILD_SIM_HASH: string;
declare const BUILD_BASE: { id: string, data: any } | null;
declare const BUILD_START: { salt: string, start: string, legacy?: { champions: any[], seasons: any[] } } | null;
interface Window {
  webkitAudioContext?: typeof AudioContext;
  /** tools/daily.js (Puppeteer) hands encoded video / audio to Node through this */
  __sink?: (kind: 'video' | 'audio', base64: string) => Promise<void>;
}
