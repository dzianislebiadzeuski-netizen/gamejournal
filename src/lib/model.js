// Pure helpers over a game record.
import { parseISO, todayISO, DAY } from './util.js';

export const STATUS = {
  wish: 'Хочу пройти',
  playing: 'Прохожу',
  paused: 'Отложено',
  done: 'Пройдено',
  dropped: 'Брошено',
  rotation: 'В ротации',
  quit: 'Забросил',
};

export const PLATFORMS = ['PC', 'PS5', 'PS4', 'Switch', 'Steam Deck', 'Xbox', 'Телефон'];

export const isOnline = (g) => g.type === 'online';
export const completed = (g) => (g.playthroughs || []).filter((p) => p.end || p.old);
export const timesCompleted = (g) => completed(g).length;
export const openPt = (g) => {
  const pts = g.playthroughs || [];
  const last = pts[pts.length - 1];
  return last && !last.end && !last.old ? last : null;
};

const sessMs = (s) => Math.max(0, (s.end || 0) - (s.start || 0));

function ptRange(p) {
  if (!p.start || !p.end) return null;
  return [parseISO(p.start).getTime(), parseISO(p.end).getTime() + DAY];
}

// Sessions not already accounted for by a completed playthrough with its own hours.
export function uncoveredSessions(g) {
  const ranges = completed(g).filter((p) => p.hours != null).map(ptRange).filter(Boolean);
  return (g.sessions || []).filter((s) => !ranges.some(([a, b]) => s.start >= a && s.start < b));
}

export function currentSessionsMs(g) {
  const p = openPt(g);
  const from = p && p.start ? parseISO(p.start).getTime() : 0;
  return (g.sessions || []).filter((s) => s.start >= from).reduce((a, s) => a + sessMs(s), 0);
}

export function activeMs(g, now = Date.now()) {
  return g.active ? now - g.active.t0 : 0;
}

// Total hours spent on the game (completed playthroughs' hours + uncovered sessions).
export function totalHours(g) {
  const pts = completed(g).reduce((a, p) => a + (p.hours || 0), 0);
  const ses = uncoveredSessions(g).reduce((a, s) => a + sessMs(s), 0) / 3600000;
  return pts + ses;
}

export function currentHours(g) {
  return currentSessionsMs(g) / 3600000;
}

export function lastCompleted(g) {
  const c = completed(g);
  return c[c.length - 1] || null;
}

export function lastActivity(g) {
  const s = g.sessions || [];
  const lastS = s.length ? s[s.length - 1].end : 0;
  return Math.max(lastS, g.active ? g.active.t0 : 0, g.statusAt || 0, g.addedAt || 0);
}

export const hltbSrc = (g) => (g && g.hltb && g.hltb.src === 'rawg' ? 'RAWG' : 'HLTB');

export function hltbHours(g) {
  return g.hltb && g.hltb.main ? g.hltb.main : null;
}

export function daysSince(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.round((parseISO(todayISO()) - parseISO(iso)) / DAY));
}

export function primaryGenre(g) {
  return (g.genres || [])[0] || '';
}
