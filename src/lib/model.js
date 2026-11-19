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

export const PLATFORMS = ['PC', 'PS5', 'Xbox'];
// Brand colours + generic glyphs (no trademarked logos).
export const PLATFORM_META = {
  PC: { color: '#4f5d7a', icon: 'monitor' },
  PS5: { color: '#0070d1', icon: 'pad' },
  Xbox: { color: '#107c10', icon: 'console' },
};

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
  // online-mode sessions of a story+online game never belong to a story playthrough
  return (g.sessions || []).filter((s) => s.mode === 'net' || !ranges.some(([a, b]) => s.start >= a && s.start < b));
}

export function currentSessionsMs(g) {
  const p = openPt(g);
  const from = p && p.start ? parseISO(p.start).getTime() : 0;
  return (g.sessions || []).filter((s) => s.start >= from && s.mode !== 'net').reduce((a, s) => a + sessMs(s), 0);
}

export function activeMs(g, now = Date.now()) {
  return g.active ? now - g.active.t0 : 0;
}

// running time that counts toward the story playthrough (not the online mode)
export const storyActiveMs = (g) => (g.active && g.active.mode !== 'net' ? activeMs(g) : 0);

// hours played in the online mode of a story+online game
export const netSessions = (g) => (g.sessions || []).filter((s) => s.mode === 'net');
export const MODE_LABEL = { story: 'сюжет', net: 'сеть' };

// Total hours spent on the game (completed playthroughs' hours + uncovered sessions).
export function totalHours(g) {
  const pts = completed(g).reduce((a, p) => a + (p.hours || 0), 0);
  const ses = uncoveredSessions(g).reduce((a, s) => a + sessMs(s), 0) / 3600000;
  return pts + ses + (g.baseHours || 0);
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

// HLTB "Main Story" hours, entered by hand in the game card.
export function hltbHours(g) {
  return g && g.hltb && g.hltb.main ? g.hltb.main : null;
}

export const hltbSearchUrl = (g) => `https://howlongtobeat.com/?q=${encodeURIComponent((g && g.name) || '')}`;

const r1 = (h) => Math.round(h * 10) / 10;
const fh = (h) => {
  const v = r1(Math.abs(h));
  if (v > 0 && v < 1) return `${Math.max(1, Math.round(v * 60))} м`;
  return `${v >= 10 ? Math.round(v) : String(v).replace('.', ',')} ч`;
};

// Neutral wording, no "good/bad" — just facts.
export function remainingText(cur, hl) {
  if (!hl) return null;
  const rest = hl - cur;
  if (Math.abs(rest) < 0.25) return { v: '0 ч', s: 'ровно по HLTB' };
  return rest > 0 ? { v: `~${fh(rest)}`, s: 'до конца сюжета' } : { v: '—', s: `на ${fh(rest)} больше HLTB` };
}

export function diffText(mine, hl) {
  if (!hl || mine == null) return null;
  const d = mine - hl;
  if (Math.abs(d) < 0.5) return 'ровно как по HLTB';
  return d > 0 ? `на ${fh(d)} дольше HLTB` : `на ${fh(d)} быстрее HLTB`;
}

export function daysSince(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.round((parseISO(todayISO()) - parseISO(iso)) / DAY));
}

export function primaryGenre(g) {
  return (g.genres || [])[0] || '';
}
