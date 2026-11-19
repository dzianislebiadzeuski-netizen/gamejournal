// Fills a game with data from RAWG/HLTB, translates the description and caches the cover on device.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { request } from './http.js';
import * as catalog from './catalog.js';
import { getGame, updateGame } from './store.js';

const native = Capacitor.isNativePlatform();

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

let modelReady = null;
export function ensureRuModel() {
  if (!native) return Promise.resolve(false);
  if (!modelReady) {
    modelReady = (async () => {
      const { Translation, Language } = await import('@capacitor-mlkit/translation');
      await withTimeout(Translation.downloadModel({ language: Language.Russian }), 180000);
      return true;
    })().catch((e) => {
      modelReady = null;
      throw e;
    });
  }
  return modelReady;
}

export async function ruModelDownloaded() {
  if (!native) return false;
  try {
    const { Translation, Language } = await import('@capacitor-mlkit/translation');
    const r = await Translation.getDownloadedModels();
    return (r.languages || []).includes(Language.Russian);
  } catch {
    return false;
  }
}

// Paragraph by paragraph: ML Kit handles short chunks far more reliably than one long blob.
export async function translateToRu(text) {
  if (!text || !native) return null;
  try {
    const { Translation, Language } = await import('@capacitor-mlkit/translation');
    await ensureRuModel();
    const parts = text.split(/\n{2,}|\n/).map((x) => x.trim()).filter(Boolean);
    const out = [];
    for (const part of parts) {
      const r = await withTimeout(Translation.translate({ text: part, sourceLanguage: Language.English, targetLanguage: Language.Russian }), 30000);
      out.push(r.text || part);
    }
    return out.join('\n\n') || null;
  } catch (e) {
    console.warn('translate failed', e);
    return null;
  }
}

const translating = new Set();
export async function translateGame(id) {
  const g = getGame(id);
  if (!g || !g.summary || !g.summary.en || translating.has(id)) return false;
  translating.add(id);
  try {
    const ru = await translateToRu(g.summary.en);
    if (ru) updateGame(id, (x) => ({ ...x, summary: { ...x.summary, ru } }));
    return !!ru;
  } finally {
    translating.delete(id);
  }
}

export function coverSrc(g, size = 'big') {
  if (!g) return null;
  if (g.coverFile && native) return Capacitor.convertFileSrc(g.coverFile);
  if (g.coverData) return g.coverData;
  return catalog.coverUrl(g.cover, size);
}

export async function saveCoverBase64(id, base64) {
  if (!native) return { coverData: `data:image/jpeg;base64,${base64}` };
  const path = `covers/${id}.jpg`;
  await Filesystem.writeFile({ path, data: base64, directory: Directory.Data, recursive: true });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Data });
  return { coverFile: uri };
}

export async function cacheCover(id) {
  const g = getGame(id);
  if (!g || !g.cover || g.coverFile || !native) return;
  try {
    const r = await request({ url: catalog.coverUrl(g.cover), responseType: 'blob', timeout: 20000 });
    if (r.status !== 200 || !r.data) return;
    const patch = await saveCoverBase64(id, r.data);
    updateGame(id, patch);
  } catch (e) {
    console.warn('cover cache failed', e);
  }
}

const running = new Set();

// Pulls everything we can about the game. Safe to call repeatedly.
// Fix "online" games that are really story games (a co-op campaign etc.) and mark story+online hybrids.
// Never overrides a type the user switched by hand.
function reclass(x, d) {
  const patch = { modeAt: 1 };
  if (x.typeManual) return patch;
  patch.hybrid = !!d.hybrid;
  if (x.type === 'online' && !d.online && !(x.sessions || []).length && (x.status === 'wish' || x.status === 'quit')) {
    patch.type = 'game';
    patch.status = x.status === 'quit' ? 'dropped' : 'wish';
  }
  return patch;
}

export async function enrich(id, { force = false } = {}) {
  const g = getGame(id);
  if (!g || !g.extId || running.has(id)) return;
  if (g.enrichedAt && !force) {
    if (!g.modeAt && !running.has('m' + id)) {
      running.add('m' + id);
      const d = await catalog.details(g.extId).catch(() => null);
      if (d) updateGame(id, (x) => ({ ...x, ...reclass(x, d) }));
      running.delete('m' + id);
    }
    cacheCover(id);
    if (g.summary && g.summary.en && !g.summary.ru) await translateGame(id);
    return;
  }
  running.add(id);
  try {
    const d = await catalog.details(g.extId).catch(() => null);
    if (d) {
      updateGame(id, (x) => ({
        ...x,
        name: x.name || d.name,
        year: x.year || d.year,
        cover: x.cover || d.cover,
        slug: x.slug || d.slug,
        genres: x.genres && x.genres.length ? x.genres : d.genres,
        summary: { ...(x.summary || {}), en: d.summaryEn },
        enrichedAt: Date.now(),
        ...reclass(x, d),
      }));
      cacheCover(id);
      catalog.similar(g.extId, d.raw).then((sim) => { if (sim.length) updateGame(id, { similar: sim }); }).catch(() => {});
    }
    const cur = getGame(id);
    if (cur && cur.summary && cur.summary.en && !cur.summary.ru) await translateGame(id);
  } finally {
    running.delete(id);
  }
}
