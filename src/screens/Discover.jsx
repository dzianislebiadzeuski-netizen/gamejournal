import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore, go, getDb, setDiscover, addGame, deleteGame, findByExt, toast, openSheet, closeSheet } from '../lib/store.js';
import { Icon, Nav, Info, PlatformBadge, ChipGroup, Sheet } from '../ui/kit.jsx';
import { discover, details, hasKeys, coverUrl, GENRE_SLUG_BY_RU } from '../lib/catalog.js';
import { enrich, translateToRu } from '../lib/enrich.js';
import { placeholderGradient } from '../lib/util.js';

const MODES = [['for', 'Для тебя'], ['hits', 'Хиты'], ['new', 'Новинки']];

// in-memory deck per mode (survives tab switches within a session)
const decks = { for: [], hits: [], new: [] };
const history = [];
// set by the mounted Discover screen so the info sheet can act on the top card
const deckActions = { swipe: () => {}, already: () => {} };
const descCache = new Map();

function DeckButtons({ disabled, onSkip, onDone, onLike }) {
  return (
    <div class="deck-btns">
      <button class="db skip" aria-label="Мимо" disabled={disabled} onClick={onSkip}><Icon n="x" size={22} sw={2.4} /></button>
      <button class="db done" aria-label="Уже прошёл" disabled={disabled} onClick={onDone}><Icon n="check" size={20} sw={2.4} /><span>Уже прошёл</span></button>
      <button class="db like" aria-label="Хочу пройти" disabled={disabled} onClick={onLike}><Icon n="heart" size={22} sw={2} fill="#fff" color="#fff" /></button>
    </div>
  );
}

// Tap on a card: plot + the same three actions.
export function DeckInfoSheet({ g }) {
  const [desc, setDesc] = useState(descCache.get(g.extId) || null);
  const [err, setErr] = useState('');
  const [ru, setRu] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (desc != null) return;
    details(g.extId).then((d) => {
      const t = (d && d.summaryEn) || '';
      descCache.set(g.extId, t);
      setDesc(t);
    }).catch((e) => setErr(e.message || 'Не получилось загрузить описание'));
  }, [g.extId]);
  const translate = async () => {
    setBusy(true);
    const r = await translateToRu(desc);
    setBusy(false);
    if (r) setRu(r);
  };
  const run = (fn) => { closeSheet(); setTimeout(fn, 60); };
  return (
    <Sheet title={g.name} sub={[g.year, (g.genres || []).slice(0, 3).join(' · ')].filter(Boolean).join(' · ')}>
      <div class="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {(g.platforms || []).map((p) => <PlatformBadge p={p} small />)}
        {g.metacritic && <span class="pf sm" style={{ background: 'rgba(255,255,255,0.1)' }}>Metacritic {g.metacritic}</span>}
      </div>
      <div class="col" style={{ gap: 8 }}>
        <div class="between sec-head"><h2 class="sec" style={{ fontSize: 15 }}>Сюжет</h2>
          {desc && (ru ? <button class="link" onClick={() => setRu(null)}>Показать оригинал</button>
            : busy ? <span class="spinner" /> : <button class="link" onClick={translate}>Перевести</button>)}
        </div>
        {desc == null && !err && <span class="spinner" />}
        {err && <span class="small muted">{err}</span>}
        {desc != null && <p class="desc deck-desc">{ru || desc || 'У RAWG нет описания этой игры.'}</p>}
      </div>
      <DeckButtons onSkip={() => run(() => deckActions.swipe(-1))} onDone={() => run(() => deckActions.already())} onLike={() => run(() => deckActions.swipe(1))} />
    </Sheet>
  );
}

function favoriteGenreSlugs(games) {
  const score = new Map();
  for (const g of games) {
    if (!(g.status === 'done' || g.fav || g.status === 'playing' || g.status === 'wish')) continue;
    const w = (g.fav ? 3 : 1) + (g.rating ? g.rating / 4 : 0);
    const slugs = g.genreSlugs && g.genreSlugs.length ? g.genreSlugs : (g.genres || []).map((r) => GENRE_SLUG_BY_RU[r]).filter(Boolean);
    for (const s of slugs.slice(0, 3)) if (s !== 'indie' && s !== 'casual') score.set(s, (score.get(s) || 0) + w);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
}

function Card({ g, top, onSwipe, offset, onTap }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [fly, setFly] = useState(0);
  const src = coverUrl(g.cover);

  useEffect(() => {
    if (!top || !offset) return;
    setFly(offset);
    const t = setTimeout(() => onSwipe(offset > 0 ? 'like' : 'skip'), 260);
    return () => clearTimeout(t);
  }, [offset]);

  const down = (e) => {
    if (!top || fly) return;
    drag.current = { x: e.clientX, y: e.clientY };
    ref.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    setDx(e.clientX - drag.current.x);
    setDy(e.clientY - drag.current.y);
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      setDx(0);
      setDy(0);
      onTap && onTap();
      return;
    }
    if (Math.abs(dx) > 110) {
      const dir = dx > 0 ? 1 : -1;
      setFly(dir);
      setTimeout(() => onSwipe(dir > 0 ? 'like' : 'skip'), 240);
    } else {
      setDx(0);
      setDy(0);
    }
  };

  const x = fly ? fly * 640 : dx;
  const style = top
    ? { transform: `translate(${x}px, ${fly ? dy : dy * 0.25}px) rotate(${x / 18}deg)`, transition: drag.current ? 'none' : 'transform 0.28s cubic-bezier(.2,.8,.2,1)' }
    : { transform: 'translateY(14px) scale(0.95)', opacity: 0.7 };
  const like = Math.max(0, Math.min(1, x / 110));
  const nope = Math.max(0, Math.min(1, -x / 110));

  return (
    <div ref={ref} class="swipe-card" style={style} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      aria-hidden={top ? undefined : 'true'}>
      <div class="sc-img" style={{ background: src ? '#1a1d25' : placeholderGradient(g.name) }}>
        {src && <img src={src} alt="" draggable={false} />}
      </div>
      <div class="sc-shade" />
      {top && <span class="stamp like" style={{ opacity: like }}>ХОЧУ</span>}
      {top && <span class="stamp nope" style={{ opacity: nope }}>МИМО</span>}
      <div class="sc-info">
        <div class="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {(g.platforms || []).map((p) => <PlatformBadge p={p} small />)}
          {g.metacritic && <span class="pf sm" style={{ background: 'rgba(12,14,19,0.6)' }}>Metacritic {g.metacritic}</span>}
        </div>
        <h2>{g.name}</h2>
        <span class="small" style={{ color: '#D6DAE2' }}>{[g.year, (g.genres || []).slice(0, 3).join(' · ')].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  );
}

export function Discover() {
  const { db } = useStore();
  const st = db.discover || { mode: 'for', pages: {}, seen: [] };
  const mode = st.mode || 'for';
  const [, force] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [offset, setOffset] = useState(0);
  const [done, setDone] = useState({});
  const keys = hasKeys();
  const deck = decks[mode];

  const refill = async () => {
    if (loading || !keys || done[mode]) return;
    setLoading(true);
    setErr('');
    try {
      const games = Object.values(getDb().games);
      const genres = mode === 'for' ? favoriteGenreSlugs(games) : [];
      let page = (getDb().discover && getDb().discover.pages && getDb().discover.pages[mode]) || 1;
      const seen = new Set((getDb().discover && getDb().discover.seen) || []);
      for (let tries = 0; tries < 4 && decks[mode].length < 6; tries++) {
        const r = await discover(mode, page, genres);
        page += 1;
        const have = new Set(decks[mode].map((x) => x.extId));
        decks[mode].push(...r.items.filter((x) => !seen.has(x.extId) && !findByExt(x.extId) && !have.has(x.extId)));
        if (!r.more) {
          setDone((d) => ({ ...d, [mode]: true }));
          break;
        }
      }
      setDiscover((d) => ({ ...d, pages: { ...(d.pages || {}), [mode]: page } }));
    } catch (e) {
      setErr(e.message || 'Не получилось загрузить игры');
    } finally {
      setLoading(false);
      force((x) => x + 1);
    }
  };

  useEffect(() => { if (deck.length < 4) refill(); }, [mode, deck.length]);

  const markSeen = (g) => setDiscover((d) => ({ ...d, seen: [...(d.seen || []), g.extId] }));

  const act = (kind) => {
    const g = deck[0];
    if (!g) return;
    setOffset(0);
    decks[mode] = deck.slice(1);
    markSeen(g);
    if (kind === 'like') {
      const added = addGame({ extId: g.extId, name: g.name, year: g.year, cover: g.cover, genres: g.genres, genreSlugs: g.genreSlugs, slug: g.slug, status: 'wish' });
      enrich(added.id);
      toast(`${g.name} — в «Хочу пройти»`);
      history.push({ g, mode, kind, id: added.id });
    } else if (kind === 'skip') {
      history.push({ g, mode, kind });
    }
    force((x) => x + 1);
  };

  const undo = () => {
    const h = history.pop();
    if (!h) return;
    if (h.id) deleteGame(h.id);
    setDiscover((d) => ({ ...d, seen: (d.seen || []).filter((x) => x !== h.g.extId) }));
    decks[h.mode] = [h.g, ...decks[h.mode]];
    if (h.mode !== mode) setDiscover({ mode: h.mode });
    force((x) => x + 1);
  };

  const already = () => {
    const g = deck[0];
    if (!g) return;
    decks[mode] = deck.slice(1);
    markSeen(g);
    go('addDone', { res: { extId: g.extId, name: g.name, year: g.year, cover: g.cover, genres: g.genres, genreSlugs: g.genreSlugs, slug: g.slug }, mode: 'done' });
  };

  deckActions.swipe = (dir) => setOffset(dir);
  deckActions.already = already;
  const top2 = deck.slice(0, 2).reverse();

  return (
    <>
      <div class="screen discover">
        <div class="head">
          <div>
            <div class="kicker c">Когда скучно</div>
            <h1 class="title">Подборка</h1>
          </div>
          <button class="round glass" aria-label="Вернуть последнюю карточку" disabled={!history.length} style={{ opacity: history.length ? 1 : 0.4 }} onClick={undo}>
            <Icon n="undo" size={20} sw={2} />
          </button>
        </div>
        <ChipGroup value={mode} onChange={(m) => setDiscover({ mode: m })} options={MODES} pill />

        {!keys ? (
          <div class="col">
            <Info>Подборка берёт игры из каталога RAWG — подключи бесплатный ключ.</Info>
            <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => go('onboardKey')}><Icon n="key" size={18} />Подключить каталог</button>
          </div>
        ) : (
          <>
            <div class="deck">
              {top2.map((g, i) => <Card key={g.extId} g={g} top={i === top2.length - 1} offset={i === top2.length - 1 ? offset : 0} onSwipe={act} onTap={() => openSheet('deckInfo', { g })} />)}
              {!deck.length && (
                <div class="deck-empty">
                  {loading ? <span class="spinner" /> : err ? <><span class="small text2">{err}</span><button class="btn btn-glass btn-sm" style={{ flex: 'none' }} onClick={refill}>Ещё раз</button></>
                    : <span class="small text2">Карточки в этой подборке закончились. Загляни в другую.</span>}
                </div>
              )}
            </div>
            <DeckButtons disabled={!deck.length} onSkip={() => setOffset(-1)} onDone={already} onLike={() => setOffset(1)} />
            <div class="center xs muted">Тап — сюжет · влево — мимо · вправо — в «Хочу пройти» · данные: <a href="https://rawg.io">RAWG</a></div>
          </>
        )}
      </div>
      <Nav active="discover" />
    </>
  );
}
