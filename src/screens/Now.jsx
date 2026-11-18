import { useStore, go, tab, openSheet } from '../lib/store.js';
import { Cover, Icon, Nav, Status, useTick, Section } from '../ui/kit.jsx';
import { currentHours, hltbHours, hltbSrc, lastActivity, openPt, primaryGenre, activeMs } from '../lib/model.js';
import { fmtHours, fmtClock, fmtDate, monthName, monthPrep, gamesWord, todayISO } from '../lib/util.js';
import { computeStats, sumRange, dailyHours } from '../lib/stats.js';
import { toggleSession } from '../lib/actions.js';

export const perDayLabel = (h) => (h < 1 ? `${Math.round(h * 60)} мин/день` : `${(Math.round(h * 10) / 10).toString().replace('.', ',')} ч/день`);

function SessionBtn({ g, small }) {
  if (g.active) {
    return (
      <button class={`btn btn-red ${small ? 'btn-sm' : 'btn-sm'}`} onClick={() => toggleSession(g.id)}>
        <Icon n="stop" size={14} /><span class="mono">{fmtClock(activeMs(g))}</span>
      </button>
    );
  }
  return <button class="btn btn-primary btn-sm" onClick={() => toggleSession(g.id)}><Icon n="play" size={16} />Сел играть</button>;
}

function Hero({ g }) {
  const cur = currentHours(g) + activeMs(g) / 3600000;
  const hl = hltbHours(g);
  const p = openPt(g);
  return (
    <div class="hero">
      <button class="bg" aria-label={`Открыть: ${g.name}`} onClick={() => go('game', { id: g.id })}>
        <Cover g={g} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0 }} />
      </button>
      <div class="panel">
        <div class="row small" style={{ color: '#A9B0BD' }}>
          {g.active ? <span class="live-dot">Идёт сессия</span> : <Status s="playing" />}
          <span>{[p && p.start ? `с ${fmtDate(p.start)}` : '', primaryGenre(g)].filter(Boolean).join(' · ')}</span>
        </div>
        <button class="nm" onClick={() => go('game', { id: g.id })}>{g.name}</button>
        <div class="col" style={{ gap: 6 }}>
          <div class="between mono small" style={{ color: '#A9B0BD' }}>
            <span style={{ color: '#E9ECF2' }}>{fmtHours(cur)} наиграно</span>
            {hl && <span>~{fmtHours(hl)} по {hltbSrc(g)}</span>}
          </div>
          {hl && <div class="prog"><i style={{ width: `${Math.min(100, (cur / hl) * 100)}%` }} /></div>}
        </div>
        <div class="row">
          <SessionBtn g={g} />
          <button class="btn btn-glass btn-sm" onClick={() => openSheet('finish', { id: g.id })}><Icon n="check" size={16} sw={2.2} />Закончить</button>
          <button class="btn btn-glass btn-icon sm" aria-label="Ещё: отложить, бросить" onClick={() => openSheet('more', { id: g.id })}><Icon n="dots" size={18} /></button>
        </div>
      </div>
    </div>
  );
}

function GameRow({ g, sub }) {
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
  const rotation = games.filter((g) => g.status === 'rotation').sort((a, b) => lastActivity(b) - lastActivity(a));
  useTick(games.some((g) => g.active));
  const now = new Date();
  const st = computeStats(games, db.settings, now);
  const monthStart = todayISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthOf = (g) => sumRange(dailyHours([g]), monthStart, todayISO());
  const [hero, ...rest] = playing;

  return (
    <>
      <div class="screen">
        <div class="head">
          <div>
            <div class="kicker">{monthName(now.getMonth())} · {gamesWord(playing.length + rotation.length)}</div>
            <h1 class="title">Играю сейчас</h1>
          </div>
          <button class="chip pill glass mono" style={{ fontWeight: 500 }} onClick={() => tab('stats')}>
            <Icon n="clock" size={16} sw={2} color="#6CC0FF" />{perDayLabel(st.perDay)}
          </button>
        </div>

        {!hero && !rotation.length && (
          <div class="empty">
            <span class="ic"><Icon n="pad" size={32} sw={1.6} /></span>
            <span style={{ fontFamily: 'var(--unb)', fontSize: 17, fontWeight: 600 }}>Сейчас ничего не проходишь</span>
            <span class="text2" style={{ fontSize: 14, lineHeight: 1.5 }}>Добавь игру или возьми что-нибудь из «Хочу пройти»</span>
            <div class="col" style={{ width: '100%', gap: 8, marginTop: 6 }}>
              <button class="btn btn-primary" onClick={() => go('search')}><Icon n="plus" size={18} sw={2.2} />Добавить игру</button>
              <button class="btn btn-glass" onClick={() => { tab('library'); }}><Icon n="book" size={16} sw={2} />Открыть библиотеку</button>
            </div>
          </div>
        )}

        {hero && <Hero g={hero} />}
        {rest.length > 0 && (
          <div class="col" style={{ gap: 8 }}>
            {rest.map((g) => <GameRow g={g} sub={`${fmtHours(currentHours(g))} · с ${fmtDate((openPt(g) || {}).start)}`} />)}
          </div>
        )}

        {(rotation.length > 0 || hero) && (
          <Section title="В ротации" right={<span class="kicker">сетевые</span>}>
            {rotation.length
              ? <div class="col" style={{ gap: 8 }}>{rotation.map((g) => <GameRow g={g} sub={`${fmtHours(monthOf(g))} в ${monthPrep(now.getMonth())}`} />)}</div>
              : <span class="small muted" style={{ fontSize: 13 }}>Сетевые игры, в которые играешь, появятся здесь.</span>}
          </Section>
        )}
      </div>
      <button class="fab" aria-label="Добавить игру" onClick={() => go('search')}><Icon n="plus" size={24} sw={2.4} /></button>
      <Nav active="now" />
    </>
  );
}
