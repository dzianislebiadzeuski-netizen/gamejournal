// Statistics: hours are spread over calendar days.
// - Completed playthroughs with dates and hours: hours spread evenly between start and end.
// - Sessions not covered by such playthroughs: counted on the day they started.
import { parseISO, todayISO, isoAddDays, daysBetween } from './util.js';
import { completed, uncoveredSessions, totalHours, isOnline } from './model.js';

export function dailyHours(games, { countOnline = true } = {}) {
  const map = new Map();
  const add = (iso, h) => map.set(iso, (map.get(iso) || 0) + h);
  for (const g of games) {
    if (isOnline(g) && !countOnline) continue;
    for (const p of completed(g)) {
      if (p.old || !p.start || !p.end || !p.hours) continue;
      const n = Math.max(1, daysBetween(p.start, p.end) + 1);
      for (let i = 0; i < n; i++) add(isoAddDays(p.start, i), p.hours / n);
    }
    for (const s of uncoveredSessions(g)) add(todayISO(new Date(s.start)), (s.end - s.start) / 3600000);
    if (g.active) add(todayISO(new Date(g.active.t0)), (Date.now() - g.active.t0) / 3600000);
  }
  return map;
}

export function sumRange(map, fromISO, toISO) {
  let s = 0;
  for (const [d, h] of map) if (d >= fromISO && d <= toISO) s += h;
  return s;
}

export function computeStats(games, settings, now = new Date()) {
  const map = dailyHours(games, { countOnline: settings.countOnline });
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = todayISO(now);
  const monthStart = todayISO(new Date(y, m, 1));
  const yearStart = `${y}-01-01`;
  const monthHours = sumRange(map, monthStart, today);
  const dayOfMonth = now.getDate();
  const yearHours = sumRange(map, yearStart, today);
  const doneThisYear = games.reduce((a, g) => a + completed(g).filter((p) => p.end && p.end >= yearStart && p.end <= `${y}-12-31`).length, 0);

  // Favorite genres: weight each game by ♥, rating and hours.
  const score = new Map();
  for (const g of games) {
    if (!g.genres || !g.genres.length) continue;
    const w = (g.fav ? 3 : 0) + (g.rating ? g.rating / 3 : 0) + Math.log2(1 + totalHours(g)) / 2;
    if (w <= 0) continue;
    for (const gen of g.genres.slice(0, 3)) score.set(gen, (score.get(gen) || 0) + w);
  }
  const total = [...score.values()].reduce((a, b) => a + b, 0) || 1;
  const genres = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, v]) => ({ name, pct: Math.round((v / total) * 100) }));

  const favs = games.filter((g) => g.fav).sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return {
    monthHours,
    dayOfMonth,
    perDay: monthHours / dayOfMonth,
    yearHours,
    doneThisYear,
    genres,
    favs,
    year: y,
    month: m,
  };
}
