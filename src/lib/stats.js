// Statistics: hours are spread over calendar days.
// - Completed playthroughs with dates and hours: hours spread evenly between start and end.
// - Sessions not covered by such playthroughs: counted on the day they started.
import { parseISO, todayISO, isoAddDays, daysBetween } from './util.js';
import { completed, uncoveredSessions, totalHours, isOnline } from './model.js';

// Hours spread evenly over every day of [from, to].
function spread(add, from, to, h) {
  const n = Math.max(1, daysBetween(from, to) + 1);
  for (let i = 0; i < n; i++) add(isoAddDays(from, i), h / n);
}

// Calls add(isoDay, hours) for every bit of time recorded for one game.
export function gameDaily(g, add) {
  for (const p of completed(g)) {
    if (p.old || !p.start || !p.end || !p.hours) continue;
    spread(add, p.start, p.end, p.hours);
  }
  for (const s of uncoveredSessions(g)) {
    const h = (s.end - s.start) / 3600000;
    // a hand-entered period ("играл с 2015 по 2025") is spread over those years
    if (s.period && s.period.from && s.period.to) spread(add, s.period.from, s.period.to, h);
    else if (h > 24) continue; // a lump of hours without dates — not part of time stats
    else add(todayISO(new Date(s.start)), h);
  }
  if (g.active) add(todayISO(new Date(g.active.t0)), (Date.now() - g.active.t0) / 3600000);
}

export function dailyHours(games, { countOnline = true } = {}) {
  const map = new Map();
  const add = (iso, h) => map.set(iso, (map.get(iso) || 0) + h);
  for (const g of games) {
    if (isOnline(g) && !countOnline) continue;
    gameDaily(g, add);
  }
  return map;
}

// Which games make up the hours of a period: [{ g, hours }] sorted by hours.
export function hoursByGame(games, settings, fromISO, toISO) {
  const out = [];
  for (const g of games) {
    if (isOnline(g) && !settings.countOnline) continue;
    let h = 0;
    gameDaily(g, (d, x) => { if (d >= fromISO && d <= toISO) h += x; });
    if (h >= 1 / 60) out.push({ g, hours: h });
  }
  return out.sort((a, b) => b.hours - a.hours);
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

  // Games finished this year (newest first), with how many times and when.
  const doneYear = games
    .map((g) => {
      const ends = completed(g).filter((p) => p.end && p.end >= yearStart && p.end <= `${y}-12-31`).map((p) => p.end).sort();
      return ends.length ? { g, times: ends.length, last: ends[ends.length - 1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.last.localeCompare(a.last));

  return {
    monthHours,
    dayOfMonth,
    perDay: monthHours / dayOfMonth,
    yearHours,
    doneThisYear,
    genres,
    favs,
    doneYear,
    year: y,
    month: m,
    yearStart,
    monthStart,
    today,
  };
}
