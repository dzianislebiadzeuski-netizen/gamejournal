// HowLongToBeat has no official API. This is a best-effort client that discovers the current
// search endpoint from the site's JS bundle. Any failure returns null and the caller falls back
// to RAWG's average playtime.
import { request } from './http.js';

const SITE = 'https://howlongtobeat.com';
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const HEADERS = { 'User-Agent': UA, Referer: `${SITE}/`, Origin: SITE };

let cached = null; // { path }

async function discover() {
  if (cached) return cached;
  const home = await request({ url: `${SITE}/`, responseType: 'text', headers: HEADERS, timeout: 10000 });
  const html = String(home.data || '');
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]).filter((s) => /_app|pages|chunks/.test(s));
  scripts.sort((a, b) => (/_app/.test(b) ? 1 : 0) - (/_app/.test(a) ? 1 : 0));
  for (const s of scripts.slice(0, 12)) {
    const url = s.startsWith('http') ? s : `${SITE}${s.startsWith('/') ? '' : '/'}${s}`;
    let js;
    try {
      js = String((await request({ url, responseType: 'text', headers: HEADERS, timeout: 10000 })).data || '');
    } catch {
      continue;
    }
    // fetch("/api/<name>/".concat("abc").concat("def"), …)
    const m = js.match(/fetch\(\s*["'`](\/api\/[a-zA-Z]+\/)["'`]((?:\s*\.concat\(\s*["'`][^"'`]*["'`]\s*\))+)/);
    if (m) {
      const key = [...m[2].matchAll(/["'`]([^"'`]*)["'`]/g)].map((x) => x[1]).join('');
      cached = { path: m[1] + key };
      return cached;
    }
    const m2 = js.match(/["'`](\/api\/(?:search|seek|find|lookup|s)\/)["'`]/);
    if (m2) {
      cached = { path: m2[1] };
      return cached;
    }
  }
  return null;
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, ' ').trim();

function body(name) {
  return {
    searchType: 'games',
    searchTerms: norm(name).split(' ').filter(Boolean),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };
}

export async function hltbMain(name) {
  try {
    const ep = await discover();
    if (!ep) return null;
    const headers = { ...HEADERS, 'Content-Type': 'application/json', Accept: '*/*' };
    // Newer site versions hand out a short-lived token first; harmless if absent.
    try {
      const base = ep.path.replace(/\/[^/]*$/, '/').replace(/\/$/, '');
      const init = await request({ url: `${SITE}${base}/init?t=${Date.now()}`, headers: HEADERS, timeout: 8000 });
      if (init.status === 200 && init.data && init.data.token) headers['x-auth-token'] = init.data.token;
    } catch {}
    const r = await request({ url: `${SITE}${ep.path}`, method: 'POST', headers, data: body(name), timeout: 12000 });
    if (r.status !== 200 || !r.data || !Array.isArray(r.data.data)) {
      cached = null;
      return null;
    }
    const target = norm(name);
    const rows = r.data.data;
    const best = rows.find((x) => norm(x.game_name || '') === target) || rows[0];
    if (!best || !best.comp_main) return null;
    return Math.round((best.comp_main / 3600) * 10) / 10;
  } catch {
    cached = null;
    return null;
  }
}
