import { useEffect } from 'preact/hooks';
import { useStore, tab, replace } from '../lib/store.js';
import { Cover, Icon, Cell } from '../ui/kit.jsx';
import { lastCompleted, timesCompleted, diffText } from '../lib/model.js';
import { fmtHours, fmtDate, daysBetween, daysWord } from '../lib/util.js';
import { enrich } from '../lib/enrich.js';
import { Game, Similar } from './Game.jsx';

// Celebration screen after finishing; shows similar games right away.
export function FinishDone({ id }) {
  const { db } = useStore();
  const g = db.games[id];
  useEffect(() => { if (g && g.extId) enrich(g.id); }, [id]);
  if (!g) return <Game id={id} />;
  const p = lastCompleted(g) || {};
  const days = p.start && p.end ? daysBetween(p.start, p.end) + 1 : null;
  const n = timesCompleted(g);
  return (
    <div class="screen no-nav" style={{ gap: 18, paddingTop: 'calc(var(--top) + 30px)' }}>
      <div class="col" style={{ alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Cover g={g} style={{ width: 150, height: 200, borderRadius: 20 }} />
          <span aria-hidden="true" style={{ position: 'absolute', right: -10, bottom: -10, width: 44, height: 44, borderRadius: 22, background: '#8A4DFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #0C0E13' }}>
            <Icon n="check" size={22} sw={2.6} />
          </span>
        </div>
        <span class="kicker" style={{ color: '#C9B4FF', letterSpacing: '0.14em' }}>{n > 1 ? `Пройдено ×${n}` : 'Пройдено'} · {fmtDate(p.end)}</span>
        <h1 style={{ fontFamily: 'var(--unb)', fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>{g.name}</h1>
      </div>
      <div class="card glass"><div class="stats3">
        <Cell l="Часы" v={fmtHours(p.hours || 0).replace(' ч', '')} s={g.hltb && g.hltb.main ? diffText(p.hours || 0, g.hltb.main) : 'часов'} />
        <Cell l="Дней" v={days ? String(days) : '—'} s={days ? daysWord(days).replace(/^\d+ /, '') : ''} />
        <Cell l="Оценка" v={g.rating ? String(g.rating) : '—'} s={g.fav ? '♥ любимая' : ''} />
      </div></div>
      <Similar g={g} />
      <div class="row">
        <button class="btn btn-glass" onClick={() => tab('now')}>На главную</button>
        <button class="btn btn-glass" onClick={() => replace('game', { id })}>К карточке</button>
      </div>
    </div>
  );
}
