// Global app state: persisted diary (db) + transient UI state. Tiny pub/sub store.
import { useEffect, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { todayISO, uid } from './util.js';
import { openPt, lastCompleted } from './model.js';

const FILE = 'gamejournal.json';
const PREV = 'gamejournal.prev.json';
const LS_KEY = 'gamejournal';
export const native = Capacitor.isNativePlatform();

function defaultDb() {
  return {
    version: 1,
    games: {},
    settings: { rawgKey: '', lang: 'ru', countOnline: true, lastBackup: null, onboarded: false },
  };
}

let db = defaultDb();
let ui = { stack: [{ name: 'now' }], sheet: null, toast: null, libTab: 'done', tick: 0, nav: 'tab', navId: 0 };
const listeners = new Set();

export const getDb = () => db;
export const getUi = () => ui;

function emit() {
  for (const l of listeners) l();
}

export function useStore() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((x) => x + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return { db, ui };
}

// ---------------- persistence ----------------
let saveTimer = null;
let lastSavedText = '';

export async function load() {
  try {
    let text = null;
    if (native) {
      try {
        const r = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
        text = r.data;
      } catch {
        try {
          const r = await Filesystem.readFile({ path: PREV, directory: Directory.Data, encoding: Encoding.UTF8 });
          text = r.data;
        } catch {}
      }
    } else {
      text = localStorage.getItem(LS_KEY);
    }
    if (text) {
      const parsed = JSON.parse(text);
      db = { ...defaultDb(), ...parsed, settings: { ...defaultDb().settings, ...(parsed.settings || {}) } };
      lastSavedText = text;
    }
  } catch (e) {
    console.error('load failed', e);
  }
  if (!db.settings.onboarded) ui = { ...ui, stack: [{ name: 'onboard' }] };
  emit();
}

async function writeNow() {
  const text = JSON.stringify(db);
  if (text === lastSavedText) return;
  if (native) {
    if (lastSavedText) {
      await Filesystem.writeFile({ path: PREV, data: lastSavedText, directory: Directory.Data, encoding: Encoding.UTF8 }).catch(() => {});
    }
    await Filesystem.writeFile({ path: FILE, data: text, directory: Directory.Data, encoding: Encoding.UTF8 });
  } else {
    localStorage.setItem(LS_KEY, text);
  }
  lastSavedText = text;
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeNow().catch((e) => console.error('save failed', e)), 300);
}

export function flush() {
  clearTimeout(saveTimer);
  return writeNow().catch(() => {});
}

function commit() {
  db = { ...db };
  persist();
  emit();
}

// ---------------- settings ----------------
export function setSettings(patch) {
  db.settings = { ...db.settings, ...patch };
  commit();
}

// ---------------- games ----------------
export const getGame = (id) => db.games[id];
export const allGames = () => Object.values(db.games);
export const findByExt = (extId) => allGames().find((g) => g.extId === extId);

export function addGame(g) {
  const game = {
    id: g.id || (g.extId ? `r${g.extId}` : `m${uid()}`),
    type: 'game',
    status: 'wish',
    top: false,
    fav: false,
    replay: false,
    rating: null,
    impressions: '',
    platform: '',
    genres: [],
    summary: { en: '', ru: '' },
    similar: [],
    playthroughs: [],
    sessions: [],
    active: null,
    addedAt: Date.now(),
    statusAt: Date.now(),
    ...g,
  };
  db.games = { ...db.games, [game.id]: game };
  commit();
  return game;
}

export function updateGame(id, patch) {
  const g = db.games[id];
  if (!g) return;
  const next = typeof patch === 'function' ? patch(g) : { ...g, ...patch };
  db.games = { ...db.games, [id]: next };
  commit();
}

export function deleteGame(id) {
  const { [id]: _, ...rest } = db.games;
  db.games = rest;
  commit();
}

// Stop a running timer and store it as a session (used before status changes).
function closeActive(g) {
  if (!g.active) return g;
  const end = Date.now();
  const sessions = end - g.active.t0 > 30000 ? [...g.sessions, { start: g.active.t0, end }] : g.sessions;
  return { ...g, sessions, active: null };
}

export function startPlaythrough(id, date = todayISO()) {
  updateGame(id, (g) => ({
    ...g,
    status: 'playing',
    top: false,
    statusAt: Date.now(),
    playthroughs: [...g.playthroughs.filter((p) => p.end || p.old), { start: date, end: null, hours: null }],
  }));
}

export function setOpenStart(id, date) {
  updateGame(id, (g) => {
    const pts = [...g.playthroughs];
    const i = pts.length - 1;
    if (i >= 0 && !pts[i].end) pts[i] = { ...pts[i], start: date };
    return { ...g, playthroughs: pts };
  });
}

export function startSession(id) {
  updateGame(id, (g) => {
    let next = { ...g, active: { t0: Date.now() } };
    if (g.status === 'paused' || g.status === 'dropped' || g.status === 'wish') {
      next.status = 'playing';
      next.statusAt = Date.now();
      if (!openPt(g)) next.playthroughs = [...g.playthroughs, { start: todayISO(), end: null, hours: null }];
    }
    if (g.status === 'quit') {
      next.status = 'rotation';
      next.statusAt = Date.now();
    }
    return next;
  });
}

// Returns {start, end} of the stopped session; caller decides to save or discard.
export function stopSession(id) {
  const g = db.games[id];
  if (!g || !g.active) return null;
  const r = { start: g.active.t0, end: Date.now() };
  updateGame(id, { active: null });
  return r;
}

export function saveSession(id, start, end) {
  if (end - start < 1000) return;
  updateGame(id, (g) => ({ ...g, sessions: [...g.sessions, { start, end }].sort((a, b) => a.start - b.start) }));
}

export function addManualTime(id, dateISO, ms) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const start = new Date(y, m - 1, d, 12, 0, 0).getTime();
  updateGame(id, (g) => ({ ...g, sessions: [...g.sessions, { start, end: start + ms, manual: true }].sort((a, b) => a.start - b.start) }));
}

export function setStatus(id, status) {
  updateGame(id, (g) => {
    let next = closeActive(g);
    next = { ...next, status, statusAt: Date.now() };
    if (status === 'playing' && !openPt(next)) {
      next.playthroughs = [...next.playthroughs, { start: todayISO(), end: null, hours: null }];
    }
    return next;
  });
}

export function finishPlaythrough(id, { start, end, hours, rating, impressions, fav, replay }) {
  updateGame(id, (g) => {
    let next = closeActive(g);
    const pts = [...next.playthroughs];
    const i = pts.length - 1;
    const done = { start, end, hours, old: false };
    if (i >= 0 && !pts[i].end && !pts[i].old) pts[i] = done;
    else pts.push(done);
    return {
      ...next,
      playthroughs: pts,
      status: 'done',
      statusAt: Date.now(),
      rating: rating ?? next.rating,
      impressions: impressions ?? next.impressions,
      fav: fav ?? next.fav,
      replay: replay ?? next.replay,
    };
  });
}

export function startReplay(id, date, unmarkReplay) {
  updateGame(id, (g) => ({
    ...g,
    status: 'playing',
    statusAt: Date.now(),
    replay: unmarkReplay ? false : g.replay,
    playthroughs: [...g.playthroughs, { start: date, end: null, hours: null }],
  }));
}

export function previousHours(g) {
  const p = lastCompleted(g);
  return p && p.hours ? p.hours : null;
}

// ---------------- navigation / UI ----------------
const TABS = ['now', 'library', 'stats', 'settings'];

function setUi(patch) {
  ui = { ...ui, ...patch };
  emit();
}

export function go(name, params = {}) {
  setUi({ stack: [...ui.stack, { name, params }], sheet: null, nav: 'push', navId: ui.navId + 1 });
  window.scrollTo(0, 0);
}

export function replace(name, params = {}) {
  setUi({ stack: [...ui.stack.slice(0, -1), { name, params }], sheet: null, nav: 'push', navId: ui.navId + 1 });
  window.scrollTo(0, 0);
}

export function tab(name) {
  setUi({ stack: [{ name }], sheet: null, nav: 'tab', navId: ui.navId + 1 });
  window.scrollTo(0, 0);
}

export function resetTo(name, params = {}) {
  setUi({ stack: [{ name: TABS.includes(name) ? name : 'now' }, ...(TABS.includes(name) ? [] : [{ name, params }])], sheet: null, nav: 'tab', navId: ui.navId + 1 });
  window.scrollTo(0, 0);
}

// Returns false when there is nowhere to go back to (root tab).
export function back() {
  if (ui.sheet) {
    setUi({ sheet: null });
    return true;
  }
  if (ui.stack.length > 1) {
    setUi({ stack: ui.stack.slice(0, -1), nav: 'pop', navId: ui.navId + 1 });
    return true;
  }
  if (ui.stack[0].name !== 'now' && ui.stack[0].name !== 'onboard') {
    tab('now');
    return true;
  }
  return false;
}

export function openSheet(name, params = {}) {
  setUi({ sheet: { name, params } });
}

export function closeSheet() {
  setUi({ sheet: null });
}

let toastTimer;
export function toast(text, action = null, ms = 3500) {
  clearTimeout(toastTimer);
  setUi({ toast: { text, action, id: Date.now() } });
  toastTimer = setTimeout(() => setUi({ toast: null }), ms);
}

export function hideToast() {
  clearTimeout(toastTimer);
  setUi({ toast: null });
}

export function setLibTab(t) {
  setUi({ libTab: t });
}

// ---------------- backup ----------------
export function exportJson() {
  const { rawgKey, ...settings } = db.settings;
  return JSON.stringify({ app: 'gamejournal', exportedAt: new Date().toISOString(), ...db, settings }, null, 1);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data.games !== 'object') throw new Error('Это не файл копии GameJournal');
  const keep = { rawgKey: db.settings.rawgKey };
  db = {
    ...defaultDb(),
    games: data.games,
    settings: { ...defaultDb().settings, ...(data.settings || {}), ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v)), onboarded: true },
  };
  // covers are re-fetched lazily from cover
  for (const g of Object.values(db.games)) delete g.coverFile;
  commit();
  return Object.keys(db.games).length;
}
