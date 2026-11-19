// Game catalog: RAWG Video Games Database (https://rawg.io/apidocs).
// Free personal key, attribution to RAWG required (shown on game pages and in search).
import { request } from './http.js';
import { getDb } from './store.js';

const BASE = 'https://api.rawg.io/api';
export const SOURCE_NAME = 'RAWG';
export const sourceUrl = (slug) => (slug ? `https://rawg.io/games/${slug}` : 'https://rawg.io');

export class CatalogError extends Error {}

export const hasKeys = () => !!getDb().settings.rawgKey;

async function get(path, params = {}, key = getDb().settings.rawgKey) {
  if (!key) throw new CatalogError('Не подключён каталог игр. Добавь ключ RAWG в настройках.');
  const qs = new URLSearchParams({ key, ...params }).toString();
  let r;
  try {
    r = await request({ url: `${BASE}${path}?${qs}`, headers: { Accept: 'application/json' } });
  } catch {
    throw new CatalogError('Нет интернета — каталог игр недоступен.');
  }
  if (r.status === 401 || r.status === 403) throw new CatalogError('Ключ RAWG не подошёл. Проверь его в настройках.');
  if (r.status === 429) throw new CatalogError('RAWG просит подождать. Попробуй через минуту.');
  if (r.status === 404) return null;
  if (r.status >= 400) throw new CatalogError(`RAWG ответил ошибкой ${r.status}`);
  return r.data;
}

export async function checkKey(key) {
  let r;
  try {
    r = await request({ url: `${BASE}/games?key=${encodeURIComponent(key)}&page_size=1`, headers: { Accept: 'application/json' } });
  } catch {
    throw new CatalogError('Нет связи с RAWG. Проверь интернет.');
  }
  if (r.status !== 200 || !r.data || !Array.isArray(r.data.results)) throw new CatalogError('Ключ не подошёл. Скопируй его ещё раз целиком.');
  return true;
}

export async function search(text) {
  const q = text.trim();
  if (q.length < 2) return [];
  const d = await get('/games', { search: q, search_precise: 'true', exclude_additions: 'true', page_size: '20' });
  return ((d && d.results) || []).map(normalize);
}

// RAWG often appends a Spanish copy ("Español ...") and markdown leftovers to the English text.
function cleanDesc(t) {
  let s = t.replace(/\r/g, '');
  const cut = s.search(/(^|\n)\s*(Español|Espanol|Descripción)\b/i);
  if (cut > 0) s = s.slice(0, cut);
  return s.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function details(id) {
  const d = await get(`/games/${Number(id)}`);
  if (!d) return null;
  return { ...normalize(d), summaryEn: cleanDesc(d.description_raw || ''), playtime: d.playtime || null, raw: d };
}

const GENERIC_TAGS = new Set([
  'singleplayer', 'multiplayer', 'steam-achievements', 'full-controller-support', 'steam-cloud', 'steam-trading-cards',
  'controller', 'partial-controller-support', 'great-soundtrack', 'atmospheric', 'story-rich', 'steam-leaderboards',
  'steam-workshop', 'in-app-purchases', 'online-multiplayer', 'co-op', 'online-co-op', 'cooperative', 'local-multiplayer',
  'split-screen', 'local-co-op', 'achievements', 'exclusive', 'true-exclusive', 'console-exclusive', 'remote-play-together',
  'family-sharing', 'steamvr-collectibles', 'stats', 'cross-platform-multiplayer', 'vr', 'free-to-play', 'early-access',
  'utilities', 'great-for-beginners', 'colorful', 'cute', 'funny', 'difficult', 'replay-value', 'classic', '2d', '3d',
  'first-person', 'third-person', 'fantasy', 'violent', 'blood', 'gore', 'female-protagonist', 'pvp', 'online-pvp', 'pve',
  'mature', 'nudity', 'sexual-content', 'steam-turn-notifications', 'includes-level-editor', 'captions-available',
  'commentary-available', 'tracked-controller-support', 'ru', 'eng',
]);

// RAWG's ready-made "suggested" list is paid-only, so similar games are found by genres + distinctive tags.
export async function similar(id, raw) {
  const out = new Map();
  const add = (list) => {
    for (const g of list || []) {
      if (g.id === Number(id) || out.has(g.id)) continue;
      out.set(g.id, normalize(g));
    }
  };
  try {
    const s = await get(`/games/${Number(id)}/game-series`, { page_size: '6' });
    add(s && s.results);
  } catch {}
  const genres = (raw.genres || []).slice(0, 2).map((g) => g.id).join(',');
  const tags = (raw.tags || []).filter((t) => t.language === 'eng' && !GENERIC_TAGS.has(t.slug)).slice(0, 3).map((t) => t.id);
  const q = { ordering: '-added', exclude_additions: 'true', page_size: '15' };
  try {
    if (tags.length) add((await get('/games', { ...q, ...(genres ? { genres } : {}), tags: tags.slice(0, 2).join(',') })).results);
    if (out.size < 9 && tags.length) add((await get('/games', { ...q, tags: String(tags[0]) })).results);
    if (out.size < 9 && genres) add((await get('/games', { ...q, genres })).results);
  } catch {}
  return [...out.values()].slice(0, 9).map((g) => ({ extId: g.extId, name: g.name, cover: g.cover, year: g.year, genres: g.genres, slug: g.slug, online: g.online }));
}

// RAWG images are landscape; the app crops them with object-fit. Request a resized copy to save traffic.
export function coverUrl(url, size = 'big') {
  if (!url) return null;
  if (!/media\.rawg\.io\/media\//.test(url) || /\/media\/(resize|crop)\//.test(url)) return url;
  return url.replace('/media/', size === 'small' ? '/media/resize/420/-/' : '/media/resize/640/-/');
}

const ONLINE_TAGS = ['multiplayer', 'online-multiplayer', 'massively-multiplayer', 'mmo', 'online-pvp', 'pvp', 'battle-royale', 'moba'];

function normalize(g) {
  const tagSlugs = (g.tags || []).map((t) => t.slug);
  const genreSlugs = (g.genres || []).map((x) => x.slug);
  const single = tagSlugs.includes('singleplayer');
  const multi = genreSlugs.includes('massively-multiplayer') || tagSlugs.some((t) => ONLINE_TAGS.includes(t));
  return {
    extId: g.id,
    slug: g.slug,
    name: g.name,
    year: g.released ? Number(g.released.slice(0, 4)) : null,
    cover: g.background_image || null,
    genres: genresRu(g.genres),
    genreSlugs,
    online: genreSlugs.includes('massively-multiplayer') || (multi && !single),
    metacritic: g.metacritic || null,
    platforms: (g.parent_platforms || []).map((p) => PF[p.platform && p.platform.slug]).filter(Boolean),
  };
}

const PF = { pc: 'PC', playstation: 'PS5', xbox: 'Xbox' };
export const GENRE_SLUG_BY_RU = Object.fromEntries(Object.entries({
  action: 'Экшен', indie: 'Инди', adventure: 'Приключения', 'role-playing-games-rpg': 'RPG', strategy: 'Стратегия', shooter: 'Шутер',
  casual: 'Казуальная', simulation: 'Симулятор', puzzle: 'Головоломка', arcade: 'Аркада', platformer: 'Платформер',
  'massively-multiplayer': 'MMO', racing: 'Гонки', sports: 'Спорт', fighting: 'Файтинг',
}).map(([k, v]) => [v, k]));

// Card deck for the "Подборка" tab.
export async function discover(mode, page, genreSlugs = []) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const base = { parent_platforms: '1,2,3', exclude_additions: 'true', page_size: '30', page: String(page) };
  let q;
  if (mode === 'hits') q = { ...base, ordering: '-metacritic', metacritic: '82,100' };
  else if (mode === 'new') q = { ...base, ordering: '-added', dates: `${iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()))},${iso(today)}` };
  else q = { ...base, ordering: '-added', ...(genreSlugs.length ? { genres: genreSlugs.slice(0, 3).join(',') } : {}), metacritic: '70,100' };
  const d = await get('/games', q);
  return { items: ((d && d.results) || []).filter((g) => g.background_image).map(normalize), more: !!(d && d.next) };
}

const GENRES = {
  action: 'Экшен',
  indie: 'Инди',
  adventure: 'Приключения',
  'role-playing-games-rpg': 'RPG',
  strategy: 'Стратегия',
  shooter: 'Шутер',
  casual: 'Казуальная',
  simulation: 'Симулятор',
  puzzle: 'Головоломка',
  arcade: 'Аркада',
  platformer: 'Платформер',
  'massively-multiplayer': 'MMO',
  racing: 'Гонки',
  sports: 'Спорт',
  fighting: 'Файтинг',
  family: 'Семейная',
  'board-games': 'Настольная',
  educational: 'Обучающая',
  card: 'Карточная',
};

function genresRu(list) {
  const out = [];
  for (const g of list || []) {
    const n = GENRES[g.slug] || g.name;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
