import { useRef, useState } from 'preact/hooks';
import { useStore, go, tab, openSheet, setLibTab } from '../lib/store.js';
import { Cover, Icon, Nav, Status, useTick, Section, PlatformBadge } from '../ui/kit.jsx';
import { currentHours, hltbHours, remainingText, lastActivity, openPt, primaryGenre, activeMs, timesCompleted } from '../lib/model.js';
import { fmtHours, fmtClock, fmtDate, monthName, monthPrep, todayISO, plural } from '../lib/util.js';
import { computeStats, sumRange, dailyHours } from '../lib/stats.js';
import { toggleSession } from '../lib/actions.js';

export const perDayLabel = (h) => (h < 1 ? `${Math.round(h * 60)} мин/день` : `${(Math.round(h * 10) / 10).toString().replace('.', ',')} ч/день`);

function Hero({ g }) {
  const cur = currentHours(g) + activeMs(g) / 3600000;
  const hl = hltbHours(g);
  const p = openPt(g);
  const n = timesCompleted(g);
  const open = () => go('game', { id: g.id });
  return (
    <div class="hero">
      <button class="bg" aria-label={`Открыть: ${g.name}`} onClick={open}>
        <Cover g={g} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0 }} />
      </button>
      <div class="top-chips">
        {g.active ? <span class="pill-dark live-dot">Идёт сессия</span> : <Status s="playing" label={n ? `Прохождение №${n + 1}` : undefined} />}
        <PlatformBadge p={g.platform} />
      </div>
      <div class="panel">
        <div class="small" style={{ color: '#B9BFCB' }}>{[p && p.start ? `с ${fmtDate(p.start)}` : '', primaryGenre(g)].filter(Boolean).join(' · ')}</div>
        <button class="nm" onClick={open}>{g.name}</button>
        <div class="col" style={{ gap: 6 }}>
          <div class="between mono small" style={{ color: '#A9B0BD' }}>
            <span style={{ color: '#E9ECF2' }}>{fmtHours(cur)} наиграно</span>
            {hl ? <span>{remainingText(cur, hl).v === '—' ? `HLTB ${fmtHours(hl)}` : `осталось ${remainingText(cur, hl).v}`}</span> : <span>HLTB не вписан</span>}
          </div>
          {hl && <div class="prog"><i style={{ width: `${Math.min(100, (cur / hl) * 100)}%` }} /></div>}
        </div>
        <div class="row">
          {g.active
            ? <button class="btn btn-red btn-sm" onClick={() => toggleSession(g.id)}><Icon n="stop" size={14} /><span class="mono">{fmtClock(activeMs(g))}</span></button>
            : <button class="btn btn-primary btn-sm" onClick={() => toggleSession(g.id)}><Icon n="play" size={16} />Сел играть</button>}
          <button class="btn btn-glass btn-sm" onClick={() => openSheet('finish', { id: g.id })}><Icon n="check" size={16} sw={2.2} />Закончить</button>
          <button class="btn btn-glass btn-icon sm" aria-label="Ещё: отложить, бросить" onClick={() => openSheet('more', { id: g.id })}><Icon n="dots" size={18} /></button>
        </div>
      </div>
    </div>
  );
}

function Carousel({ games }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const onScroll = () => {
    const el = ref.current;
    if (!el || !el.firstElementChild) return;
    const w = el.firstElementChild.getBoundingClientRect().width + 12;
    setIdx(Math.max(0, Math.min(games.length - 1, Math.round(el.scrollLeft / w))));
  };
  const goTo = (i) => {
    const el = ref.current;
    if (!el || !el.children[i]) return;
    el.scrollTo({ left: el.children[i].offsetLeft - 20, behavior: 'smooth' });
  };
  return (
    <>
      <div ref={ref} class={`carousel ${games.length > 1 ? 'multi' : ''}`} onScroll={onScroll}>
        {games.map((g) => <Hero g={g} key={g.id} />)}
      </div>
      {games.length > 1 && (
        <div class="dots" role="tablist" aria-label="Игры в прохождении">
          {games.map((g, i) => <i class={i === idx ? 'on' : ''} role="tab" aria-label={g.name} aria-selected={i === idx ? 'true' : 'false'} onClick={() => goTo(i)} />)}
        </div>
      )}
    </>
  );
}

function RotationRow({ g, sub }) {
  return (
    <div class={`grow glass ${g.active ? 'live' : ''}`}>
      <button style={{ background: 'none', border: 'none', padding: 0 }} aria-label={`Открыть: ${g.name}`} onClick={() => go('game', { id: g.id })}>
        <Cover g={g} size="small" label={false} />
      </button>
      <button class="info" onClick={() => go('game', { id: g.id })}>
        <b>{g.name}</b>
        {g.active ? <span class="live-dot">Идёт сессия <span class="mono" style={{ color: '#E9ECF2' }}>{fmtClock(activeMs(g))}</span></span>
          : <span class="mono xs muted">{sub}</span>}
      </button>
      {g.active
        ? <button class="stop-sq" aria-label={`Закончить сессию: ${g.name}`} onClick={() => toggleSession(g.id)}><Icon n="stop" size={14} /></button>
        : <button class="play-sq" aria-label={`Сел играть: ${g.name}`} onClick={() => toggleSession(g.id)}><Icon n="play" size={14} /></button>}
    </div>
  );
}

export function Now() {
  const { db } = useStore();
  const games = Object.values(db.games);
  const playing = games.filter((g) => g.status === 'playing').sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0) || lastActivity(b) - lastActivity(a));
  const rotation = games.filter((g) => g.status === 'rotation' || (g.net && g.status !== 'playing')).sort((a, b) => lastActivity(b) - lastActivity(a));
  const top = games.filter((g) => g.status === 'wish' && g.top);
  useTick(games.some((g) => g.active));
  const now = new Date();
  const st = computeStats(games, db.settings, now);
  const monthStart = todayISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthOf = (g) => sumRange(dailyHours([g]), monthStart, todayISO());

  return (
    <>
      <div class="screen">
        <div class="head">
          <div>
            <div class="kicker c">{monthName(now.getMonth())} {now.getFullYear()}</div>
            <h1 class="title">Играю сейчас</h1>
          </div>
          <button class="chip pill glass mono" style={{ fontWeight: 500 }} onClick={() => tab('stats')}>
            <Icon n="clock" size={16} sw={2} color="#FF8FA3" />{perDayLabel(st.perDay)}
          </button>
        </div>

        <Section title={<><span class="sec-ic"><Icon n="play" size={12} /></span>Игры в прохождении</>}
          right={playing.length > 0 ? <span class="kicker">{playing.length} {plural(playing.length, 'сюжетка', 'сюжетки', 'сюжеток')}</span> : null}>
          {playing.length ? <Carousel games={playing} /> : (
            <div class="empty">
              <span class="ic"><Icon n="pad" size={32} sw={1.6} /></span>
              <span style={{ fontFamily: 'var(--unb)', fontSize: 17, fontWeight: 600 }}>Сейчас ничего не проходишь</span>
              <span class="text2" style={{ fontSize: 14, lineHeight: 1.5 }}>
                {top.length ? `В топ-приоритете: ${top.slice(0, 2).map((g) => g.name).join(', ')}` : 'Добавь игру или возьми что-нибудь из «Хочу пройти»'}
              </span>
              <div class="col" style={{ width: '100%', gap: 8, marginTop: 6 }}>
                <button class="btn btn-primary" onClick={() => go('search')}><Icon n="plus" size={18} sw={2.2} />Добавить игру</button>
                <button class="btn btn-glass" onClick={() => { setLibTab('wish'); tab('library'); }}><Icon n="book" size={16} sw={2} />Открыть «Хочу пройти»</button>
              </div>
            </div>
          )}
        </Section>

        <Section title={<><span class="sec-ic"><Icon n="repeat" size={12} /></span>В ротации</>} right={<span class="kicker">сетевые</span>}>
          {rotation.length
            ? <div class="col" style={{ gap: 8 }}>{rotation.map((g) => <RotationRow g={g} sub={`${fmtHours(monthOf(g))} в ${monthPrep(now.getMonth())}`} />)}</div>
            : <span class="small muted" style={{ fontSize: 13 }}>Сетевые игры, в которые играешь, появятся здесь. Добавь через «+» → «Сетевая».</span>}
        </Section>
      </div>
      <button class="fab" aria-label="Добавить игру" onClick={() => go('search')}><Icon n="plus" size={24} sw={2.4} /></button>
      <Nav active="now" />
    </>
  );
}
