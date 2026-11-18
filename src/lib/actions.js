// Multi-step user actions shared by several screens.
import { addGame, deleteGame, findByIgdb, getGame, openSheet, stopSession, toast, startSession, updateGame } from './store.js';
import { enrich } from './enrich.js';
import { todayISO } from './util.js';

export function addFromSearch(res, { status, top = false, platform = '' }) {
  const online = status === 'rotation';
  const g = addGame({
    igdbId: res.igdbId,
    name: res.name,
    year: res.year,
    coverId: res.coverId,
    genres: res.genres || [],
    type: online ? 'online' : 'game',
    status,
    top: status === 'wish' ? top : false,
    platform,
    playthroughs: status === 'playing' ? [{ start: todayISO(), end: null, hours: null }] : [],
  });
  enrich(g.id);
  return g;
}

export function addSimilarToWish(s) {
  const existing = findByIgdb(s.igdbId);
  if (existing) return existing;
  const g = addGame({ igdbId: s.igdbId, name: s.name, year: s.year, coverId: s.coverId, genres: s.genres || [], status: 'wish' });
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
