// Date & formatting helpers. Dates for playthroughs are stored as 'YYYY-MM-DD' (local).

export const DAY = 86400000;

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoAddDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / DAY);
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

export const monthName = (m) => MONTHS_NOM[m];
export const monthPrep = (m) => MONTHS_PREP[m];
export const monthGen = (m) => MONTHS_GEN[m];

export function fmtDate(iso, withYear = 'auto') {
  if (!iso) return '';
  const d = parseISO(iso);
  const y = d.getFullYear();
  const showYear = withYear === true || (withYear === 'auto' && y !== new Date().getFullYear());
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${showYear ? ' ' + y : ''}`;
}

export function fmtMonthYear(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtShort(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function relDay(iso) {
  const t = todayISO();
  if (iso === t) return 'Сегодня';
  if (iso === isoAddDays(t, -1)) return 'Вчера';
  return fmtShort(iso);
}

// "23 ч", "4,5 ч", "40 м"
export function fmtHours(h) {
  if (h == null || isNaN(h)) return '—';
  if (h > 0 && h < 1) return `${Math.max(1, Math.round(h * 60))} м`;
  if (h < 10 && h % 1 !== 0) return `${(Math.round(h * 10) / 10).toString().replace('.', ',')} ч`;
  return `${Math.round(h)} ч`;
}

export function fmtHM(ms) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm} м`;
  return mm ? `${h} ч ${String(mm).padStart(2, '0')} м` : `${h} ч`;
}

export function fmtClock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const gamesWord = (n) => `${n} ${plural(n, 'игра', 'игры', 'игр')}`;
export const daysWord = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// Stable pseudo-random gradient for games without a cover.
export function placeholderGradient(seed = '') {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  return `linear-gradient(160deg, hsl(${hue} 35% 12%), hsl(${(hue + 30) % 360} 40% 30%) 55%, hsl(${(hue + 60) % 360} 45% 55%))`;
}

// "2015 – 2025" or "12 мар – 4 апр" for a hand-entered period.
export function periodLabel(from, to) {
  if (!from || !to) return '';
  const a = parseISO(from), b = parseISO(to);
  if (a.getFullYear() !== b.getFullYear()) return `${a.getFullYear()} – ${b.getFullYear()}`;
  if (from === to) return fmtShort(from);
  return `${fmtShort(from)} – ${fmtShort(to)}`;
}
