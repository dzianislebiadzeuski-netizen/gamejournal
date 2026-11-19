import { useStore, go, setLibTab, tab, openSheet } from '../lib/store.js';
import { Cover, Icon, Nav, Section, Info } from '../ui/kit.jsx';
import { computeStats } from '../lib/stats.js';
import { fmtHours, monthName, monthGen, daysWord } from '../lib/util.js';

const num = (h) => (h < 10 ? (Math.round(h * 10) / 10).toString().replace('.', ',') : String(Math.round(h)));

export function Stats() {
  const { db } = useStore();
  const games = Object.values(db.games);
  const s = computeStats(games, db.settings);
  const maxPct = Math.max(1, ...s.genres.map((g) => g.pct));
  return (
    <>
      <div class="screen" style={{ gap: 14 }}>
        <div class="head">
          <div>
            <div class="kicker c">{monthName(s.month)} {s.year}</div>
            <h1 class="title">Статистика</h1>
          </div>
        </div>

        <button class="card glass tint-r tap-card" style={{ gap: 6, padding: 18, borderRadius: 24 }} onClick={() => openSheet('statHours', { period: 'month' })}>
          <span class="between" style={{ width: '100%' }}><span class="text2" style={{ fontSize: 13, fontWeight: 600 }}>В день вы играете</span><Icon n="chev" size={14} sw={2} color="#8C93A1" /></span>
          <div class="row" style={{ alignItems: 'baseline' }}>
            <span class="mono" style={{ fontSize: 56, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.02em' }}>{num(s.perDay)}</span>
            <span style={{ fontFamily: 'var(--unb)', fontSize: 18, color: '#FF9AB4' }}>ч</span>
          </div>
          <span class="mono xs muted">{fmtHours(s.monthHours)} за {daysWord(s.dayOfMonth)} {monthGen(s.month)}</span>
        </button>

        <div class="stats2" style={{ gap: 10 }}>
          <button class="card glass tint tap-card" style={{ gap: 4, padding: '14px 16px', borderRadius: 20 }} onClick={() => openSheet('statHours', { period: 'year' })}>
            <span class="between" style={{ width: '100%' }}><span class="text2" style={{ fontSize: 12, fontWeight: 600 }}>Часы за {s.year}</span><Icon n="chev" size={13} sw={2} color="#8C93A1" /></span>
            <span class="mono" style={{ fontSize: 28, fontWeight: 600 }}>{Math.round(s.yearHours)}</span>
          </button>
          <button class="card glass tint" style={{ gap: 4, padding: '14px 16px', borderRadius: 20, textAlign: 'left', color: 'inherit' }} onClick={() => { setLibTab('done'); tab('library'); }}>
            <span class="text2" style={{ fontSize: 12, fontWeight: 600 }}>Пройдено в {s.year}</span>
            <span class="mono" style={{ fontSize: 28, fontWeight: 600 }}>{s.doneThisYear}</span>
          </button>
        </div>

        <div class="card glass">
          <div class="between"><h2 class="sec">Любимые жанры</h2><span class="xs muted">по ♥, оценкам и часам</span></div>
          {s.genres.length ? s.genres.map((g) => (
            <div class="bar">
              <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
              <div class="tr"><i style={{ width: `${(g.pct / maxPct) * 100}%`, background: 'var(--grad)' }} /></div>
              <span class="mono small" style={{ color: '#C3C8D2', textAlign: 'right' }}>{g.pct}%</span>
            </div>
          )) : <span class="small muted">Появятся, когда наберётся несколько игр с жанрами.</span>}
        </div>

        <Section title="Любимые игры" right={s.favs.length ? <button class="link mono" onClick={() => { setLibTab('done'); tab('library'); }}>все {s.favs.length} ♥</button> : null}>
          {s.favs.length ? (
            <div class="grid4">
              {s.favs.slice(0, 4).map((g) => (
                <Cover g={g} style={{ aspectRatio: '3 / 4', borderRadius: 12 }}>
                  <button aria-label={`Открыть: ${g.name}`} onClick={() => go('game', { id: g.id })} style={{ position: 'absolute', inset: 0, background: 'none', border: 'none' }} />
                  <span class="hb"><Icon n="heart" size={14} sw={1.6} fill="#FF3D5E" color="#FF3D5E" /></span>
                </Cover>
              ))}
            </div>
          ) : <Info>Отмечай игры ♥ в их карточке — лучшие соберутся здесь.</Info>}
        </Section>
      </div>
      <Nav active="stats" />
    </>
  );
}
