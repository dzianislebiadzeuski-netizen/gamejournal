import { useStore, go, setLibTab } from '../lib/store.js';
import { Cover, Icon, Nav, Info } from '../ui/kit.jsx';
import { timesCompleted, lastCompleted, totalHours, hltbHours, completed } from '../lib/model.js';
import { fmtHours, fmtMonthYear, fmtShort, gamesWord, todayISO } from '../lib/util.js';
import { removeFromWish } from '../lib/actions.js';

const TABS = [
  ['done', 'Пройдено'],
  ['wish', 'Хочу пройти'],
  ['paused', 'Отложено'],
  ['dropped', 'Брошено'],
  ['replay', 'Перепройти'],
  ['fav', 'Любимые'],
];

const lastEnd = (g) => {
  const p = lastCompleted(g);
  return p && p.end ? p.end : '';
};

export function filterTab(games, t) {
  switch (t) {
    case 'done':
      return games.filter((g) => timesCompleted(g) > 0).sort((a, b) => lastEnd(b).localeCompare(lastEnd(a)));
    case 'wish':
      return games.filter((g) => g.status === 'wish').sort((a, b) => b.addedAt - a.addedAt);
    case 'paused':
      return games.filter((g) => g.status === 'paused').sort((a, b) => b.statusAt - a.statusAt);
    case 'dropped':
      return games.filter((g) => g.status === 'dropped' || g.status === 'quit').sort((a, b) => b.statusAt - a.statusAt);
    case 'replay':
      return games.filter((g) => g.replay && timesCompleted(g) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'fav':
      return games.filter((g) => g.fav).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    default:
      return [];
  }
}

function Tile({ g, mode }) {
  const n = timesCompleted(g);
  let bottom = null;
  let sub = '';
  if (mode === 'done' || mode === 'replay' || mode === 'fav') {
    bottom = g.rating ? String(g.rating) : null;
    const e = lastEnd(g);
    sub = mode === 'fav' && !n ? (g.status === 'wish' ? 'хочу пройти' : g.status === 'dropped' ? 'брошено' : g.status === 'playing' ? 'прохожу' : '') : e ? fmtMonthYear(e) : n ? 'давно' : '';
  } else if (mode === 'wish') {
    const h = hltbHours(g);
    bottom = h ? `~${fmtHours(h)}` : null;
  } else if (mode === 'paused') {
    bottom = fmtHours(totalHours(g));
    sub = `с ${fmtShort(todayISO(new Date(g.statusAt)))}`;
  } else if (mode === 'dropped') {
    bottom = fmtHours(totalHours(g));
    sub = (g.status === 'quit' ? 'забросил · ' : '') + fmtMonthYear(todayISO(new Date(g.statusAt)));
  }
  return (
    <div class={`tile`}>
      <Cover g={g}>
        <button aria-label={`Открыть: ${g.name}`} onClick={() => go('game', { id: g.id })} style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'none', border: 'none' }} />
        {bottom && <span class="badge bl">{bottom}</span>}
        {g.fav && mode !== 'wish' && <span class="hb" aria-label="Любимая"><Icon n="heart" size={14} sw={1.6} fill="#FF3D5E" color="#FF3D5E" /></span>}
        {n > 1 && <span class="badge tl">×{n}</span>}
        {mode === 'wish' && (
          <button class="bm" aria-label="Убрать из «Хочу пройти»" onClick={() => removeFromWish(g.id)}>
            <span><Icon n="book" size={14} sw={1.8} fill="#6CC0FF" color="#6CC0FF" /></span>
          </button>
        )}
      </Cover>
      <button class="nm" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => go('game', { id: g.id })}>{g.name}</button>
      {sub && <span class="sub">{sub}</span>}
    </div>
  );
}

function TopCard({ g }) {
  const h = hltbHours(g);
  return (
    <button class="top-card glass" onClick={() => go('game', { id: g.id })}>
      <Cover g={g} />
      <div class="col" style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 8 }}>
        <span class="flame"><Icon n="flame" size={12} sw={2} />Топ приоритет</span>
        <span style={{ fontFamily: 'var(--unb)', fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{g.name}</span>
        <span class="mono xs muted">{h ? `~${fmtHours(h)} по HLTB` : 'HLTB: данных пока нет'}</span>
        <span class="small text2">{(g.genres || []).slice(0, 2).join(' · ')}</span>
      </div>
    </button>
  );
}

const EMPTY = {
  done: 'Пока ничего не пройдено. Закончи игру из «Играю сейчас» или добавь уже пройденную через «+».',
  wish: 'Список планов пуст. Добавь игру через «+» на главной или закладкой в похожих играх.',
  paused: 'Отложенных игр нет.',
  dropped: 'Брошенных игр нет — и это хорошо.',
  replay: 'Отметь пройденную игру «Хочу перепройти», и она появится здесь.',
  fav: 'Ставь ♥ в карточке игры — любимые соберутся здесь.',
};

export function Library() {
  const { db, ui } = useStore();
  const games = Object.values(db.games);
  const t = ui.libTab;
  const list = filterTab(games, t);
  const counts = Object.fromEntries(TABS.map(([k]) => [k, filterTab(games, k).length]));
  const top = t === 'wish' ? list.filter((g) => g.top) : [];
  const rest = t === 'wish' ? list.filter((g) => !g.top) : list;

  let left = '';
  let right = gamesWord(list.length);
  if (t === 'done') {
    left = 'по дате окончания';
    const r = list.filter((g) => g.rating);
    if (r.length) right = `★ ср. ${(r.reduce((a, g) => a + g.rating, 0) / r.length).toFixed(1).replace('.', ',')}`;
  } else if (t === 'wish') {
    left = 'сначала новые';
    const h = list.reduce((a, g) => a + (hltbHours(g) || 0), 0);
    if (h) right = `${gamesWord(list.length)} · ~${fmtHours(h)}`;
  } else if (t === 'paused') left = 'на паузе, собираюсь вернуться';
  else if (t === 'dropped') {
    left = 'часы идут в статистику';
    right = `${gamesWord(list.length)} · ${fmtHours(list.reduce((a, g) => a + totalHours(g), 0))}`;
  } else if (t === 'replay') left = 'с меткой «Хочу перепройти»';
  else if (t === 'fav') left = 'по оценке';

  return (
    <>
      <div class="screen">
        <div>
          <div class="kicker">{gamesWord(games.length)} в дневнике</div>
          <h1 class="title">Библиотека</h1>
        </div>
        <div class="chips scroll" role="tablist">
          {TABS.map(([k, l]) => (
            <button role="tab" aria-selected={t === k ? 'true' : 'false'} class={`chip pill ${t === k ? 'on' : ''}`}
              ref={(el) => el && t === k && el.scrollIntoView({ inline: 'center', block: 'nearest' })} onClick={() => setLibTab(k)}>
              {l}<span class="n">{counts[k]}</span>
            </button>
          ))}
        </div>
        {list.length > 0 && <div class="between small muted"><span>{left}</span><span class="mono">{right}</span></div>}
        {top.length > 0 && <div class="col">{top.map((g) => <TopCard g={g} />)}</div>}
        {top.length > 0 && rest.length > 0 && <div class="between"><h2 class="sec">Остальное</h2></div>}
        {list.length === 0 && <Info>{EMPTY[t]}</Info>}
        <div class="grid3">{rest.map((g) => <Tile g={g} mode={t} />)}</div>
      </div>
      <button class="fab" aria-label="Добавить игру" onClick={() => go('search')}><Icon n="plus" size={24} sw={2.4} /></button>
      <Nav active="library" />
    </>
  );
}
