// Editable list of finished playthroughs: dates (or "давно") + hours each.
import { Icon, Field, Stepper } from './kit.jsx';
import { todayISO, isoAddDays } from '../lib/util.js';

export function PtRows({ pts, setPts }) {
  const set = (i, patch) => setPts(pts.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const toggleOld = (i) => {
    const p = pts[i];
    if (p.old) set(i, { old: false, start: p.start || isoAddDays(todayISO(), -14), end: p.end || todayISO() });
    else set(i, { old: true });
  };
  return pts.map((p, i) => (
    <div class="pt-row" style={p.isNew ? { borderColor: 'rgba(255,120,160,0.45)', background: 'rgba(196,60,180,0.08)' } : {}}>
      <div class="between"><b style={{ fontSize: 14 }}>Прохождение №{i + 1}{p.isNew ? ' · новое' : ''}</b>
        {(pts.length > 1 || p.isNew) && <button class="link" style={{ color: '#FF8FA3' }} onClick={() => setPts(pts.filter((_, k) => k !== i))}>Удалить</button>}
      </div>
      {!p.old && (
        <div class="row" style={{ gap: 10 }}>
          <Field label="Начал" id={`ps${i}`} type="date" mono value={p.start || ''} max={p.end || todayISO()} onInput={(v) => v && set(i, { start: v })} />
          <Field label="Закончил" id={`pe${i}`} type="date" mono value={p.end || ''} max={todayISO()} onInput={(v) => v && set(i, { end: v })} />
        </div>
      )}
      <button class="trow" style={{ minHeight: 44, padding: '6px 10px' }} aria-pressed={p.old ? 'true' : 'false'} onClick={() => toggleOld(i)}>
        <Icon n="cal" size={16} color="#A9B0BD" /><span class="t"><b style={{ fontSize: 13 }}>Давно, без дат</b><span>не пойдёт в статистику по годам</span></span>
        <span class={`switch ${p.old ? 'on' : ''}`}><i /></span>
      </button>
      <Stepper id={`ph${i}`} label="Часов" value={p.hours ?? 0} onChange={(v) => set(i, { hours: v })} max={2000} unit="ч" />
    </div>
  ));
}

// Normalise rows for saving: numbers, undated first, then by end date.
export function cleanPts(pts) {
  const clean = pts.map(({ isNew, ...p }) => (p.old ? { start: null, end: null, hours: Number(p.hours) || 0, old: true } : { ...p, hours: Number(p.hours) || 0, old: false }));
  clean.sort((a, b) => (a.old ? '' : a.end || '').localeCompare(b.old ? '' : b.end || ''));
  return clean;
}
