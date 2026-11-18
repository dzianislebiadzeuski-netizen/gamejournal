import { useStore, go, setLibTab, updateGame } from '../lib/store.js';
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
];

const lastEnd = (g) => {
  const p = lastCompleted(g);
  return p && p.end ? p.end : '';
};

export function filterTab(games, t) {
  switch (t) {
    case 'done':
      return games.filter((g) => g.status === 'done').sort((a, b) => lastEnd(b).localeCompare(lastEnd(a)) || b.statusAt - a.statusAt);
    case 'wish':
      return games.filter((g) => g.status === 'wish').sort((a, b) => b.addedAt - a.addedAt);
    case 'paused':
      return games.filter((g) => g.status === 'paused').sort((a, b) => b.statusAt - a.statusAt);
    case 'dropped':
      return games.filter((g) => g.status === 'dropped' || g.status === 'quit').sort((a, b) => b.statusAt - a.statusAt);
    case 'replay':
      return games.filter((g) => g.replay && g.status === 'done').sort((a, b) => (b.rating || 0) - (a.rating || 0));
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
    bottom = h ? fmtHours(h) : null;
  } else if (mode === 'paused') {
    bottom = fmtHours(totalHours(g));
    sub = `с ${fmtShort(todayISO(new Date(g.statusAt)))}`;
  } else if (mode === 'dropped') {
    bottom = fmtHours(totalHours(g));
    sub = (g.status === 'quit' ? 'забросил · ' : '') + fmtMonthYear(todayISO(new Date(g.statusAt)));
  }
  const ring = g.fav && (mode === 'done' || mode === 'replay');
  return (
    <div class={`tile`}>
      <div class={ring ? 'ring' : ''}>
      <Cover g={g}>
        <button aria-label={`Открыть: ${g.name}`} onClick={() => go('game', { id: g.id })} style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'none', border: 'none' }} />
        {bottom && <span class="badge bl">{bottom}</span>}
        {g.fav && mode !== 'wish' && (ring
          ? <span class="hb grad" aria-label="Любимая"><Icon n="heart" size={13} sw={1.6} fill="#FFFFFF" color="#FFFFFF" /></span>
          : <span class="hb" aria-label="Любимая"><Icon n="heart" size={14} sw={1.6} fill="#FF3D5E" color="#FF3D5E" /></span>)}
        {n > 1 && <span class="badge tl">×{n}</span>}
        {mode === 'wish' && (
          <button class={`fl ${g.top ? 'on' : ''}`} aria-pressed={g.top ? 'true' : 'false'} aria-label="Топ приоритет" onClick={() => updateGame(g.id, { top: !g.top })}>
            <span><Icon n="flame" size={14} sw={2} color={g.top ? '#FFFFFF' : '#FF7A92'} /></span>
          </button>
        )}
        {mode === 'wish' && (
          <button class="bm" aria-label="Убрать из «Хочу пройти»" onClick={() => removeFromWish(g.id)}>
            <span><Icon n="book" size={14} sw={1.8} fill="#6CC0FF" color="#6CC0FF" /></span>
          </button>
        )}
      </Cover>
      </div>
      <button class="nm" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => go('game', { id: g.id })}>{g.name}</button>
      {sub && <span class="sub">{sub}</span>}
    </div>
  );
}

function TopCard({ g }) {
  const h = hltbHours(g);
  return (
    <div class="top-card glass card tint-r" style={{ flexDirection: 'row', padding: 10, position: 'relative' }}>
      <button aria-label={`Открыть: ${g.name}`} onClick={() => go('game', { id: g.id })} style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', zIndex: 1 }} />
      <Cover g={g} />
      <div class="col" style={{ flex: 1, minWidth: 0, justifyContent: 'center', gap: 8 }}>
        <span class="flame"><Icon n="flame" size={12} sw={2} />Топ приоритет</span>
        <span style={{ fontFamily: 'var(--unb)', fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{g.name}</span>
        <span class="mono xs muted">{h ? `HLTB · сюжет ${fmtHours(h)}` : 'HLTB: не вписано'}</span>
        <span class="small text2">{(g.genres || []).slice(0, 2).join(' · ')}</span>
      </div>
      <button class="fl on" style={{ position: 'relative', alignSelf: 'flex-start', zIndex: 2 }} aria-label="Убрать из топ-приоритета" onClick={() => updateGame(g.id, { top: false })}>
        <span><Icon n="flame" size={14} sw={2} color="#FFFFFF" /></span>
      </button>
    </div>
  );
}

function FavStrip({ games }) {
  return (
    <div class="col" style={{ gap: 10 }}>
      <div class="fav-head">
        <h2 class="sec"><span class="sec-ic" style={{ background: 'var(--grad)', color: '#fff' }}><Icon n="heart" size={13} sw={1.6} fill="#FFFFFF" color="#FFFFFF" /></span>Любимые</h2>
        <span class="kicker">{games.length}</span>
      </div>
      <div class="fav-strip">
        {games.map((g) => (
          <button class="fav-card" onClick={() => go('game', { id: g.id })}>
            <div class="ring">
              <Cover g={g}>
                {g.rating && <span class="badge bl">★ {g.rating}</span>}
                <span class="hb grad"><Icon n="heart" size={13} sw={1.6} fill="#FFFFFF" color="#FFFFFF" /></span>
              </Cover>
            </div>
            <span class="nm">{g.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const EMPTY = {
  done: 'Пока ничего не пройдено. Закончи игру из «Играю сейчас» или добавь уже пройденную через «+».',
  wish: 'Список планов пуст. Добавь игру через «+» на главной или закладкой в похожих играх.',
  paused: 'Отложенных игр нет.',
  dropped: 'Брошенных игр нет — и это хорошо.',
  replay: 'Отметь пройденную игру «Хочу перепройти», и она появится здесь.',
};

export function Library() {
  const { db, ui } = useStore();
  const games = Object.values(db.games);
  const t = ui.libTab === 'fav' ? 'done' : ui.libTab;
  const list = filterTab(games, t);
  const counts = Object.fromEntries(TABS.map(([k]) => [k, filterTab(games, k).length]));
  const top = t === 'wish' ? list.filter((g) => g.top) : [];
  const rest = t === 'wish' ? list.filter((g) => !g.top) : list;
  const favDone = t === 'done' ? list.filter((g) => g.fav).sort((a, b) => (b.rating || 0) - (a.rating || 0)) : [];

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

  return (
    <>
      <div class="screen">
        <div>
          <div class="kicker c">{gamesWord(games.length)} в дневнике</div>
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
        <div class="col fade-swap" key={t} style={{ gap: 16 }}>
        {list.length > 0 && <div class="between small muted"><span>{left}</span><span class="mono">{right}</span></div>}
        {t === 'wish' && list.length > 0 && (
          <div class="col">
            <div class="between"><h2 class="sec"><span class="sec-ic"><Icon n="flame" size={13} sw={2} /></span>Топ приоритет</h2><span class="kicker">{top.length}</span></div>
            {top.length ? top.map((g) => <TopCard g={g} />) : <div class="dashed" style={{ textAlign: 'left' }}>Нажми огонёк на обложке игры, чтобы поднять её в топ. Здесь — то, что пройдёшь в первую очередь.</div>}
          </div>
        )}
        {t === 'wish' && rest.length > 0 && <div class="between"><h2 class="sec">Остальное</h2><span class="kicker">{rest.length}</span></div>}
        {list.length === 0 && <Info>{EMPTY[t]}</Info>}
        {t === 'done' && favDone.length > 0 && <FavStrip games={favDone} />}
        {t === 'done' && favDone.length > 0 && <div class="between sec-head"><h2 class="sec">Все пройденные</h2><span class="kicker">{list.length}</span></div>}
        <div class="grid3">{rest.map((g) => <Tile g={g} mode={t} />)}</div>
        </div>
      </div>
      <button class="fab" aria-label="Добавить игру" onClick={() => go('search')}><Icon n="plus" size={24} sw={2.4} /></button>
      <Nav active="library" />
    </>
  );
}
