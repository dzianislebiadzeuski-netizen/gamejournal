// Fills a game with data from IGDB/HLTB, translates the description and caches the cover on device.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { request } from './http.js';
import * as igdb from './igdb.js';
import { hltbMain } from './hltb.js';
import { getGame, updateGame } from './store.js';

const native = Capacitor.isNativePlatform();

export async function translateToRu(text) {
  if (!text || !native) return null;
  try {
    const { Translation, Language } = await import('@capacitor-mlkit/translation');
    await Translation.downloadModel({ language: Language.Russian });
    const r = await Translation.translate({ text, sourceLanguage: Language.English, targetLanguage: Language.Russian });
    return r.text || null;
  } catch (e) {
    console.warn('translate failed', e);
    return null;
  }
}

export function coverSrc(g, size = 't_cover_big') {
  if (!g) return null;
  if (g.coverFile && native) return Capacitor.convertFileSrc(g.coverFile);
  if (g.coverData) return g.coverData;
  return igdb.coverUrl(g.coverId, size);
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
  if (!g || !g.coverId || g.coverFile || !native) return;
  try {
    const r = await request({ url: igdb.coverUrl(g.coverId), responseType: 'blob', timeout: 20000 });
    if (r.status !== 200 || !r.data) return;
    const patch = await saveCoverBase64(id, r.data);
    updateGame(id, patch);
  } catch (e) {
    console.warn('cover cache failed', e);
  }
}

const running = new Set();

// Pulls everything we can about the game. Safe to call repeatedly.
export async function enrich(id, { force = false } = {}) {
  const g = getGame(id);
  if (!g || !g.igdbId || running.has(id)) return;
  if (g.enrichedAt && !force) {
    cacheCover(id);
    if (g.summary && g.summary.en && !g.summary.ru) {
      const ru = await translateToRu(g.summary.en);
      if (ru) updateGame(id, (x) => ({ ...x, summary: { ...x.summary, ru } }));
    }
    return;
  }
  running.add(id);
  try {
    const d = await igdb.details(g.igdbId).catch(() => null);
    if (d) {
      updateGame(id, (x) => ({
        ...x,
        name: x.name || d.name,
        year: x.year || d.year,
        coverId: x.coverId || d.coverId,
        genres: x.genres && x.genres.length ? x.genres : d.genres,
        summary: { ...(x.summary || {}), en: d.summaryEn },
        similar: d.similar,
        enrichedAt: Date.now(),
      }));
    }
    cacheCover(id);
    const name = (getGame(id) || g).name;
    const [h, t] = await Promise.all([hltbMain(name), igdb.timeToBeat(g.igdbId)]);
    const main = h || t;
    if (main) updateGame(id, { hltb: { main, src: h ? 'hltb' : 'igdb' } });
    const cur = getGame(id);
    if (cur && cur.summary && cur.summary.en && !cur.summary.ru) {
      const ru = await translateToRu(cur.summary.en);
      if (ru) updateGame(id, (x) => ({ ...x, summary: { ...x.summary, ru } }));
    }
  } finally {
    running.delete(id);
  }
}
