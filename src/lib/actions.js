// Multi-step user actions shared by several screens.
import { addGame, deleteGame, findByExt, getGame, openSheet, stopSession, toast, startSession, updateGame } from './store.js';
import { enrich } from './enrich.js';
import { todayISO } from './util.js';

export function addFromSearch(res, { status, top = false, platform = '' }) {
  const online = status === 'rotation' && !res.hybrid;
  const g = addGame({
    extId: res.extId,
    name: res.name,
    year: res.year,
    cover: res.cover,
    genres: res.genres || [],
    genreSlugs: res.genreSlugs || [],
    slug: res.slug,
    type: online ? 'online' : 'game',
    hybrid: !!res.hybrid,
    net: !!res.hybrid && status === 'rotation',
    status,
    top: status === 'wish' ? top : false,
    platform,
    playthroughs: status === 'playing' ? [{ start: todayISO(), end: null, hours: null }] : [],
  });
  enrich(g.id);
  return g;
}

export function addSimilarToWish(s) {
  const existing = findByExt(s.extId);
  if (existing) return existing;
  const g = addGame({ extId: s.extId, name: s.name, year: s.year, cover: s.cover, genres: s.genres || [], slug: s.slug, status: 'wish' });
  toast(`${s.name} — в «Хочу пройти»`, { label: 'Отменить', fn: () => deleteGame(g.id) });
  enrich(g.id);
  return g;
}

export function removeFromWish(id) {
  const g = getGame(id);
  if (!g) return;
  deleteGame(id);
  toast(`${g.name} убрана из «Хочу пройти»`, { label: 'Отменить', fn: () => addGame(g) });
}

export function toggleSession(id) {
  const g = getGame(id);
  if (!g) return;
  if (g.active) {
    const r = stopSession(id);
    if (r) openSheet('sessionEnd', { id, ...r });
  } else {
    startSession(id);
  }
}

export function toggleFav(id) {
  const g = getGame(id);
  if (g) updateGame(id, { fav: !g.fav });
}
