// IGDB API (https://api-docs.igdb.com). Auth: Twitch client-credentials token.
import { request } from './http.js';
import { getDb, setSettings } from './store.js';

const BASE = 'https://api.igdb.com/v4';

export class IgdbError extends Error {}

export async function fetchToken(id, secret) {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`;
  let r;
  try {
    r = await request({ url, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, data: '' });
  } catch {
    throw new IgdbError('Нет связи с Twitch. Проверь интернет.');
  }
  if (r.status !== 200 || !r.data || !r.data.access_token) {
    throw new IgdbError('Ключ не подошёл. Проверь Client ID и Client Secret.');
  }
  return { token: r.data.access_token, tokenExp: Date.now() + (r.data.expires_in || 3600) * 1000 };
}

export const hasKeys = () => {
  const s = getDb().settings;
  return !!(s.igdbId && s.igdbSecret);
};

async function token(force = false) {
  const s = getDb().settings;
  if (!s.igdbId || !s.igdbSecret) throw new IgdbError('Не подключена база игр IGDB. Добавь ключ в настройках.');
  if (!force && s.token && s.tokenExp > Date.now() + 60000) return s.token;
  const t = await fetchToken(s.igdbId, s.igdbSecret);
  setSettings(t);
  return t.token;
}

async function query(endpoint, body, retry = true) {
  const tok = await token();
  let r;
  try {
    r = await request({
      url: `${BASE}/${endpoint}`,
      method: 'POST',
      headers: { 'Client-ID': getDb().settings.igdbId, Authorization: `Bearer ${tok}`, Accept: 'application/json', 'Content-Type': 'text/plain' },
      data: body,
    });
  } catch {
    throw new IgdbError('Нет интернета — поиск игр недоступен.');
  }
  if (r.status === 401 && retry) {
    await token(true);
    return query(endpoint, body, false);
  }
  if (r.status === 429) throw new IgdbError('IGDB просит подождать секунду. Попробуй ещё раз.');
  if (r.status >= 400) throw new IgdbError(`IGDB ответил ошибкой ${r.status}`);
  return Array.isArray(r.data) ? r.data : [];
}

const esc = (s) => s.replace(/["\\]/g, ' ').trim();

export async function search(text) {
  const q = esc(text);
  if (q.length < 2) return [];
  const rows = await query(
    'games',
    `search "${q}"; fields name,first_release_date,cover.image_id,genres.name,game_modes.name,version_parent; limit 25;`
  );
  return rows.filter((g) => !g.version_parent).map(normalize);
}

export async function details(igdbId) {
  const rows = await query(
    'games',
    `fields name,summary,first_release_date,cover.image_id,genres.name,game_modes.name,similar_games.name,similar_games.cover.image_id,similar_games.first_release_date,similar_games.genres.name; where id = ${Number(igdbId)};`
  );
  if (!rows[0]) return null;
  const g = rows[0];
  return {
    ...normalize(g),
    summaryEn: g.summary || '',
    similar: (g.similar_games || []).slice(0, 10).map((s) => ({
      igdbId: s.id,
      name: s.name,
      coverId: s.cover ? s.cover.image_id : null,
      year: s.first_release_date ? new Date(s.first_release_date * 1000).getFullYear() : null,
      genres: genresRu(s.genres),
    })),
  };
}

export async function timeToBeat(igdbId) {
  try {
    const rows = await query('game_time_to_beats', `fields hastily,normally,completely; where game_id = ${Number(igdbId)};`);
    const t = rows[0];
    if (!t) return null;
    const sec = t.hastily || t.normally || t.completely;
    return sec ? Math.round((sec / 3600) * 10) / 10 : null;
  } catch {
    return null;
  }
}

export function coverUrl(imageId, size = 't_cover_big') {
  return imageId ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg` : null;
}

function normalize(g) {
  const modes = (g.game_modes || []).map((m) => m.name);
  const single = modes.some((m) => /single/i.test(m));
  const multi = modes.some((m) => /multiplayer|mmo|battle royale/i.test(m));
  return {
    igdbId: g.id,
    name: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
    coverId: g.cover ? g.cover.image_id : null,
    genres: genresRu(g.genres),
    online: multi && !single,
  };
}

const GENRES = {
  'Role-playing (RPG)': 'RPG',
  Shooter: 'Шутер',
  Adventure: 'Приключения',
  Platform: 'Платформер',
  Strategy: 'Стратегия',
  'Real Time Strategy (RTS)': 'Стратегия',
  'Turn-based strategy (TBS)': 'Пошаговая',
  Tactical: 'Тактика',
  Puzzle: 'Головоломка',
  Racing: 'Гонки',
  Sport: 'Спорт',
  Fighting: 'Файтинг',
  Simulator: 'Симулятор',
  Indie: 'Инди',
  Arcade: 'Аркада',
  "Hack and slash/Beat 'em up": 'Слэшер',
  MOBA: 'MOBA',
  Music: 'Музыка',
  'Point-and-click': 'Квест',
  'Card & Board Game': 'Карточная',
  'Visual Novel': 'Визуальная новелла',
  'Quiz/Trivia': 'Викторина',
  Pinball: 'Пинбол',
};

function genresRu(list) {
  const out = [];
  for (const g of list || []) {
    const n = GENRES[g.name] || g.name;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
