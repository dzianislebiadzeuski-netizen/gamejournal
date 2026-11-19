import { useState } from 'preact/hooks';
import {
  getGame, closeSheet, replace, go, tab, toast, updateGame, deleteGame, setStatus, startPlaythrough, saveSession,
  addManualTime, startSession, setOpenStart, finishPlaythrough, startReplay, previousHours, back, getUi, openSheet, getDb,
} from '../lib/store.js';
import { hoursByGame, computeStats } from '../lib/stats.js';
import { Cover } from '../ui/kit.jsx';
import { PtRows, cleanPts } from '../ui/pts.jsx';
import { monthGen } from '../lib/util.js';
import { Sheet, Icon, ChipGroup, Field, Stepper, Rating, ToggleRow, Info, Cell, PlatformPicker } from '../ui/kit.jsx';
import { MODE_LABEL } from '../lib/model.js';
import { PLATFORMS, openPt, currentSessionsMs, hltbHours, hltbSearchUrl, timesCompleted, totalHours, STATUS, completed, currentHours, remainingText, diffText } from '../lib/model.js';
import { todayISO, isoAddDays, fmtHM, fmtTime, fmtDate, fmtHours } from '../lib/util.js';
import { addFromSearch } from '../lib/actions.js';
import { DeckInfoSheet } from './Discover.jsx';
import { coverUrl } from '../lib/catalog.js';
import { placeholderGradient } from '../lib/util.js';

function DatePick({ label, value, onChange, max = todayISO() }) {
  const t = todayISO();
  const y = isoAddDays(t, -1);
  const mode = value === t ? 't' : value === y ? 'y' : 'o';
  return (
    <div class="col" style={{ gap: 8 }}>
      <span class="lbl">{label}</span>
      <ChipGroup value={mode} onChange={(m) => onChange(m === 't' ? t : m === 'y' ? y : isoAddDays(t, -2))}
        options={[['t', `Сегодня, ${fmtDate(t)}`], ['y', 'Вчера'], ['o', 'Другая дата']]} />
      {mode === 'o' && <Field label="Дата" id="dp" type="date" mono value={value} max={max} onInput={(v) => v && onChange(v)} />}
    </div>
  );
}

// ---------- Add from search / similar ----------
function AddSheet({ res }) {
  const [status, setSt] = useState(res.online ? 'rotation' : 'wish');
  const [top, setTop] = useState(false);
  const [platform, setPlatform] = useState('');
  const [hl, setHl] = useState('');
  const src = coverUrl(res.cover, 'small');
  const add = () => {
    if (status === 'done' || status === 'dropped' || status === 'paused') return go('addDone', { res, platform, mode: status });
    const g = addFromSearch(res, { status, top, platform });
    if (res.online && status === 'wish') updateGame(g.id, { type: 'online' });
    const hlv = Number(String(hl).replace(',', '.')) || 0;
    if (hlv > 0 && status !== 'rotation') updateGame(g.id, { hltb: { main: Math.round(hlv * 10) / 10, src: 'manual' } });
    const where = { wish: '«Хочу пройти»', playing: '«Играю сейчас»', rotation: '«В ротации»' }[status];
    toast(`${g.name} — в ${where}`);
    const ui = getUi();
    const top1 = ui.stack[ui.stack.length - 1];
    if (top1.name === 'search') replace('game', { id: g.id });
    else closeSheet();
  };
  const R = ({ k, title, sub, children }) => (
    <div class={`radio ${status === k ? 'on' : ''}`}>
      <button role="radio" aria-checked={status === k ? 'true' : 'false'} onClick={() => setSt(k)}>
        <span class="dot" /><span class="col" style={{ gap: 2 }}><b style={{ fontSize: 15 }}>{title}</b><span class="small muted">{sub}</span></span>
      </button>
      {status === k && children}
    </div>
  );
  const label = { wish: 'Добавить в «Хочу пройти»', playing: 'Добавить в «Играю сейчас»', done: 'Дальше: даты, часы, оценка', dropped: 'Дальше: часы и дата', paused: 'Дальше: часы и дата', rotation: 'Добавить в «В ротации»' }[status];
  return (
    <Sheet title="Куда добавить?">
      <div class="row" style={{ gap: 14 }}>
        <div class="cover" style={{ width: 72, height: 96, borderRadius: 12, background: src ? '#1a1d25' : placeholderGradient(res.name) }}>{src && <img src={src} alt="" />}</div>
        <div class="col" style={{ gap: 5, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--unb)', fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{res.name}</span>
          <span class="small text2">{[res.year, (res.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      <div class="col" role="radiogroup" aria-label="Статус" style={{ gap: 8 }}>
        <R k="wish" title="Хочу пройти" sub="в список планов">
          <button class="trow" style={{ marginLeft: 34, width: 'auto', minHeight: 48, padding: '8px 10px', border: 'none' }} aria-pressed={top ? 'true' : 'false'} onClick={() => setTop(!top)}>
            <Icon n="flame" size={16} sw={2} color="#FF7A92" /><span class="t"><b style={{ fontSize: 13 }}>Топ приоритет</b></span>
            <span class={`switch ${top ? 'on' : ''}`}><i /></span>
          </button>
        </R>
        {!res.online && <R k="playing" title="Прохожу сейчас" sub="в «Играю сейчас», начало — сегодня" />}
        {!res.online && <R k="done" title="Уже прошёл" sub="укажешь даты, часы и оценку" />}
        <R k="rotation" title={res.hybrid ? 'Играю в сетевой режим' : 'Сетевая — играю'} sub={res.hybrid ? 'в «В ротации»; сюжет можно пройти когда угодно' : 'в «В ротации», часы через таймер'} />
        {!res.online && <R k="paused" title="Отложил" sub="начал, прервался — хочу когда-нибудь добить" />}
        <R k="dropped" title={res.online ? 'Забросил' : 'Бросил'} sub="сколько успел наиграть и когда бросил" />
        {res.hybrid && <span class="small muted">Сюжет + сетевой режим: проходи сюжет как обычно, а сетевую часть держи в ротации — время трекается в любом статусе.</span>}
        {res.online && <span class="small muted">Это сетевая игра — её нельзя пройти, только играть в ротации или бросить. Если RAWG ошибся, выбери «Хочу пройти» и начни как обычную.</span>}
      </div>
      <div class="col" style={{ gap: 8 }}>
        <span class="lbl">Платформа</span>
        <PlatformPicker value={platform} onChange={setPlatform} />
      </div>
      {(status === 'wish' || status === 'playing') && (
        <Field label="HLTB · основной сюжет, часов (можно потом)" id="ahl" mono value={hl} onInput={setHl} placeholder="например, 28" suffix="ч" inputMode="decimal" />
      )}
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={add}>{label}</button>
    </Sheet>
  );
}

// ---------- Start playthrough ----------
function StartSheet({ id }) {
  const g = getGame(id);
  const [date, setDate] = useState(todayISO());
  if (!g) return null;
  return (
    <Sheet title="Начать прохождение" sub={g.name}>
      <DatePick label="Дата начала" value={date} onChange={setDate} />
      <Info>Игра переедет в «Играю сейчас». Когда садишься играть — жми «Сел играть», таймер посчитает часы.</Info>
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => { startPlaythrough(id, date); toast(`${g.name} — в «Играю сейчас»`); closeSheet(); }}>
        <Icon n="play" size={18} />Начать
      </button>
    </Sheet>
  );
}

// ---------- After a timer session ----------
function SessionEndSheet({ id, start, end, mode: mode0 }) {
  const g = getGame(id);
  const [edit, setEdit] = useState(false);
  const [mode, setMode] = useState(mode0 || (g && g.hybrid ? 'story' : null));
  const dur = end - start;
  const [h, setH] = useState(Math.floor(dur / 3600000));
  const [m, setM] = useState(Math.round((dur % 3600000) / 60000));
  if (!g) return null;
  const save = (ms) => {
    saveSession(id, start, start + ms, g.hybrid ? mode : null);
    toast(`Сессия сохранена · ${fmtHM(ms)}${g.hybrid ? ` · ${MODE_LABEL[mode]}` : ''}`);
    closeSheet();
  };
  const totalNow = (totalHours(g) * 3600000 + dur);
  return (
    <Sheet title="Сессия закончена" sub={g.name} onClose={() => save(dur)}>
      {g.hybrid && <ModePick value={mode} onChange={setMode} />}
      {!edit ? (
        <>
          <div class="col" style={{ alignItems: 'center', gap: 6, padding: '10px 0' }}>
            <span class="mono" style={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>{fmtHM(dur)}</span>
            <span class="mono small muted">{todayISO(new Date(start)) === todayISO() ? 'сегодня' : fmtDate(todayISO(new Date(start)))} · {fmtTime(start)} → {fmtTime(end)}</span>
          </div>
          <div class="card glass"><div class="stats2">
            <Cell l="Всего в игре" v={fmtHours(totalNow / 3600000)} s={`было ${fmtHours(totalHours(g))}`} />
            <Cell l="Статус" v={<span style={{ fontSize: 16 }}>{STATUS[g.status]}</span>} />
          </div></div>
          <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => save(dur)}><Icon n="check" size={18} sw={2.2} />Сохранить</button>
          <div class="row">
            <button class="btn btn-glass" onClick={() => setEdit(true)}><Icon n="clock" size={16} sw={2} />Поправить время</button>
            <button class="btn btn-danger" onClick={() => { toast('Сессия не засчитана'); closeSheet(); }}>Не считать</button>
          </div>
        </>
      ) : (
        <>
          <div class="row" style={{ gap: 10 }}>
            <Stepper id="sh" label="Часы" value={h} onChange={setH} max={23} unit="ч" />
            <Stepper id="sm" label="Минуты" value={m} onChange={setM} step={5} max={59} unit="м" />
          </div>
          <button class="btn btn-primary" style={{ flex: 'none' }} disabled={((Number(h) || 0) * 60 + (Number(m) || 0)) <= 0} onClick={() => save(((Number(h) || 0) * 60 + (Number(m) || 0)) * 60000)}>
            <Icon n="check" size={18} sw={2.2} />Сохранить {fmtHM(((Number(h) || 0) * 60 + (Number(m) || 0)) * 60000)}
          </button>
        </>
      )}
    </Sheet>
  );
}

// ---------- Edit / delete one tracked session ----------
function SessionEditSheet({ id, start }) {
  const g = getGame(id);
  const s0 = g && (g.sessions || []).find((x) => x.start === start);
  const pad = (n) => String(n).padStart(2, '0');
  const d0 = s0 ? new Date(s0.start) : new Date();
  const dur0 = s0 ? s0.end - s0.start : 0;
  const [date, setDate] = useState(todayISO(d0));
  const [time, setTime] = useState(`${pad(d0.getHours())}:${pad(d0.getMinutes())}`);
  const [h, setH] = useState(Math.floor(dur0 / 3600000));
  const [m, setM] = useState(Math.round((dur0 % 3600000) / 60000));
  const [confirm, setConfirm] = useState(false);
  const [per, setPer] = useState(!!(s0 && s0.period));
  const [from, setFrom] = useState(s0 && s0.period ? s0.period.from : todayISO(d0));
  const [to, setTo] = useState(s0 && s0.period ? s0.period.to : todayISO(d0));
  const [ph, setPh] = useState(Math.round(dur0 / 360000) / 10);
  const [mode, setMode] = useState((s0 && s0.mode) || 'story');
  if (!g || !s0) return null;
  const ms = per ? (Number(ph) || 0) * 3600000 : ((Number(h) || 0) * 60 + (Number(m) || 0)) * 60000;
  const save = () => {
    let st;
    let extra;
    if (per) {
      const a = from <= to ? from : to;
      const b = from <= to ? to : from;
      const [y, mo, d] = a.split('-').map(Number);
      st = new Date(y, mo - 1, d, 12).getTime();
      extra = { manual: true, period: { from: a, to: b } };
    } else {
      const [y, mo, d] = date.split('-').map(Number);
      const [hh, mm] = (time || '12:00').split(':').map(Number);
      st = new Date(y, mo - 1, d, hh || 0, mm || 0).getTime();
      extra = { period: undefined };
    }
    if (g.hybrid) extra.mode = mode;
    updateGame(id, (x) => ({ ...x, sessions: x.sessions.map((q) => (q.start === start ? { ...q, ...extra, start: st, end: st + ms } : q)).sort((a, b) => a.start - b.start) }));
    toast('Сессия обновлена');
    closeSheet();
  };
  const del = () => {
    updateGame(id, (x) => ({ ...x, sessions: x.sessions.filter((q) => q.start !== start) }));
    toast(`Сессия удалена · ${fmtHM(dur0)}`, { label: 'Вернуть', fn: () => updateGame(id, (x) => ({ ...x, sessions: [...x.sessions, s0].sort((a, b) => a.start - b.start) })) });
    closeSheet();
  };
  return (
    <Sheet title={per ? 'Период' : 'Сессия'} sub={`${g.name} · ${fmtHM(dur0)}`}>
      {g.hybrid && <ModePick value={mode} onChange={setMode} />}
      {per ? (
        <>
          <div class="row" style={{ gap: 10 }}>
            <Field label="Начал" id="pf" type="date" mono value={from} max={to} onInput={(v) => v && setFrom(v)} />
            <Field label="Закончил" id="pt" type="date" mono value={to} max={todayISO()} onInput={(v) => v && setTo(v)} />
          </div>
          <Stepper id="ph" label="Часов за период" value={ph} onChange={setPh} max={20000} unit="ч" />
          <span class="small muted" style={{ fontSize: 13 }}>Часы распределяются по всем дням периода — в статистику года попадает только его доля.</span>
        </>
      ) : (
        <>
          <div class="row" style={{ gap: 10 }}>
            <Field label="Дата" id="sd" type="date" mono value={date} max={todayISO()} onInput={(v) => v && setDate(v)} />
            <Field label="Начало" id="st" type="time" mono value={time} onInput={(v) => v && setTime(v)} />
          </div>
          <div class="row" style={{ gap: 10 }}>
            <Stepper id="eh" label="Часы" value={h} onChange={setH} max={23} unit="ч" />
            <Stepper id="em" label="Минуты" value={m} onChange={setM} step={5} max={59} unit="м" />
          </div>
        </>
      )}
      {(s0.manual || s0.period) && <ToggleRow on={per} onChange={(v) => { if (v && !s0.period) setPh(Math.round(dur0 / 360000) / 10); setPer(v); }} icon="cal" title="Играл в течение периода" sub="например, с 2015 по 2025 — часы растянутся на эти годы" />}
      <button class="btn btn-primary" style={{ flex: 'none' }} disabled={ms <= 0} onClick={save}><Icon n="check" size={18} sw={2.2} />Сохранить · {fmtHM(ms)}</button>
      {!confirm
        ? <button class="btn btn-danger" style={{ flex: 'none' }} onClick={() => setConfirm(true)}><Icon n="trash" size={16} sw={2} />Удалить сессию</button>
        : (
          <div class="info red" style={{ flexDirection: 'column' }}>
            <b>Удалить сессию на {fmtHM(dur0)}? Часы игры уменьшатся.</b>
            <div class="row">
              <button class="btn btn-glass btn-sm" onClick={() => setConfirm(false)}>Отмена</button>
              <button class="btn btn-red btn-sm" onClick={del}>Удалить</button>
            </div>
          </div>
        )}
    </Sheet>
  );
}

// ---------- Manual time ----------
function ManualSheet({ id }) {
  const g = getGame(id);
  const [kind, setKind] = useState('day'); // day | period | old
  const [date, setDate] = useState(todayISO());
  const [from, setFrom] = useState(isoAddDays(todayISO(), -365));
  const [to, setTo] = useState(todayISO());
  const [h, setH] = useState(1);
  const [m, setM] = useState(0);
  const [big, setBig] = useState(100);
  const [mode, setMode] = useState(g && g.net && g.status !== 'playing' ? 'net' : 'story');
  if (!g) return null;
  const md = g.hybrid && kind !== 'old' ? mode : null;
  const ms = kind === 'day' ? ((Number(h) || 0) * 60 + (Number(m) || 0)) * 60000 : (Number(big) || 0) * 3600000;
  const add = () => {
    if (kind === 'day') addManualTime(id, date, ms, md);
    else if (kind === 'period') {
      const a = from <= to ? from : to;
      const b = from <= to ? to : from;
      const [y, mo, d] = a.split('-').map(Number);
      const st = new Date(y, mo - 1, d, 12).getTime();
      updateGame(id, (x) => ({ ...x, sessions: [...x.sessions, { start: st, end: st + ms, manual: true, period: { from: a, to: b }, ...(md ? { mode: md } : {}) }].sort((p, q) => p.start - q.start) }));
    } else updateGame(id, (x) => ({ ...x, baseHours: (x.baseHours || 0) + ms / 3600000 }));
    toast(`Добавлено ${fmtHM(ms)}${kind === 'old' ? ' · без даты' : ''}`);
    closeSheet();
  };
  return (
    <Sheet title="Добавить время" sub={`${g.name} · если забыл нажать «Сел играть»`}>
      {g.hybrid && <ModePick value={mode} onChange={setMode} />}
      <ChipGroup value={kind} onChange={setKind} options={[['day', 'Один день'], ['period', 'За период'], ['old', 'Давно']]} />
      {kind === 'day' && (
        <>
          <DatePick label="Когда играл" value={date} onChange={setDate} />
          <div class="row" style={{ gap: 10 }}>
            <Stepper id="mh" label="Часы" value={h} onChange={setH} max={23} unit="ч" />
            <Stepper id="mm" label="Минуты" value={m} onChange={setM} step={15} max={45} unit="м" />
          </div>
        </>
      )}
      {kind === 'period' && (
        <>
          <div class="row" style={{ gap: 10 }}>
            <Field label="С" id="mf" type="date" mono value={from} max={to} onInput={(v) => v && setFrom(v)} />
            <Field label="По" id="mt" type="date" mono value={to} max={todayISO()} onInput={(v) => v && setTo(v)} />
          </div>
          <Stepper id="mb" label="Часов за период" value={big} onChange={setBig} max={20000} unit="ч" />
          <span class="small muted" style={{ fontSize: 13 }}>Часы распределятся по дням периода — в статистику каждого года попадёт его доля.</span>
        </>
      )}
      {kind === 'old' && (
        <>
          <Stepper id="mb" label="Сколько наиграл" value={big} onChange={setBig} max={20000} unit="ч" />
          <span class="small muted" style={{ fontSize: 13 }}>Без даты: часы прибавятся к общему времени игры, но не попадут в статистику по месяцам и годам.</span>
        </>
      )}
      <button class="btn btn-primary" style={{ flex: 'none' }} disabled={ms <= 0} onClick={add}>
        <Icon n="plus" size={18} sw={2.2} />Добавить {fmtHM(ms)}
      </button>
    </Sheet>
  );
}

// ---------- Undated hours ("давно") ----------
function BaseHoursSheet({ id }) {
  const g = getGame(id);
  const [v, setV] = useState(g ? Math.round((g.baseHours || 0) * 10) / 10 : 0);
  if (!g) return null;
  return (
    <Sheet title="Давно, без даты" sub={`${g.name} · не идёт в статистику по времени`}>
      <Stepper id="bh" label="Часов" value={v} onChange={setV} max={20000} unit="ч" />
      <div class="row">
        <button class="btn btn-glass" style={{ flex: '0 0 120px' }} onClick={() => { const old = g.baseHours; updateGame(id, { baseHours: 0 }); toast('Часы без даты убраны', { label: 'Вернуть', fn: () => updateGame(id, { baseHours: old }) }); closeSheet(); }}>Убрать</button>
        <button class="btn btn-primary" onClick={() => { updateGame(id, { baseHours: Number(v) || 0 }); toast('Сохранено'); closeSheet(); }}><Icon n="check" size={18} sw={2.2} />Сохранить</button>
      </div>
    </Sheet>
  );
}

// ---------- "⋯" menu ----------
function Row({ icon, title, sub, onClick, danger, expanded }) {
  return (
    <button class={`menu-row ${danger ? 'danger' : ''}`} aria-expanded={expanded == null ? undefined : expanded ? 'true' : 'false'} onClick={onClick}>
      <Icon n={icon} /><span class="t"><b>{title}</b>{sub && <span>{sub}</span>}</span>
    </button>
  );
}

function MoreSheet({ id }) {
  const g = getGame(id);
  const [open, setOpen] = useState('');
  if (!g) return null;
  const s = g.status;
  const p = openPt(g);
  const toggle = (k) => setOpen(open === k ? '' : k);
  const act = (status, msg) => { setStatus(id, status); toast(msg); closeSheet(); };
  return (
    <Sheet title={g.name} sub={`${STATUS[s]}${totalHours(g) ? ' · ' + fmtHours(totalHours(g)) : ''}`}>
      <div class="col" style={{ gap: 6 }}>
        {s === 'wish' && g.type !== 'online' && <Row icon="play" title="Начать прохождение" sub="в «Играю сейчас»" onClick={() => openSheet('start', { id })} />}
        {s === 'wish' && g.type === 'online' && <Row icon="play" title="Начать играть" sub="в «В ротации»" onClick={() => act('rotation', `${g.name} — в «В ротации»`)} />}
        {g.type !== 'online' && (s === 'wish' || s === 'dropped') && <Row icon="repeat" title="Это сетевая игра" sub="перенести в сетевые: без прохождений, только ротация" onClick={() => { updateGame(id, { type: 'online', hybrid: false, net: false, typeManual: true, status: s === 'dropped' ? 'quit' : 'wish' }); closeSheet(); }} />}
        {g.type === 'online' && (s === 'wish' || s === 'quit') && <Row icon="check" title="Это не сетевая игра" sub="вернуть в обычные, с прохождениями" onClick={() => { updateGame(id, { type: 'game', typeManual: true, status: s === 'quit' ? 'dropped' : 'wish' }); closeSheet(); }} />}
        {g.type !== 'online' && s !== 'rotation' && (g.hybrid
          ? <Row icon={g.net ? 'x' : 'repeat'} title={g.net ? 'Убрать сетевой режим из ротации' : 'Играю в сетевой режим'} sub={g.net ? 'сюжетный статус не изменится' : 'игра появится в «В ротации», время — кнопкой «Сел играть»'} onClick={() => { updateGame(id, { net: !g.net }); toast(g.net ? `${g.name} — убрана из ротации` : `${g.name} — в «В ротации»`); closeSheet(); }} />
          : <Row icon="repeat" title="Есть сетевой режим" sub="сюжет + сеть: можно держать в ротации и трекать время в любом статусе" onClick={() => { updateGame(id, { hybrid: true, typeManual: true }); toast('Отмечено: сюжет + сетевой режим'); closeSheet(); }} />)}
        {g.hybrid && s === 'rotation' && <Row icon="play" title="Начать прохождение сюжета" sub="в «Играю сейчас», сетевой режим останется в ротации" onClick={() => { updateGame(id, { net: true }); openSheet('start', { id }); }} />}
        {g.hybrid && s === 'rotation' && <Row icon="check" title="Сюжет уже пройден" sub="вписать даты и часы прохождения" onClick={() => { updateGame(id, { net: true }); openSheet('playthroughs', { id, add: true }); }} />}
        {g.hybrid && <Row icon="x" title="Это не сетевая игра" sub="убрать сетевой режим — обычная сюжетная" onClick={() => { updateGame(id, { hybrid: false, net: false, typeManual: true, ...(s === 'rotation' ? { status: 'wish' } : {}) }); closeSheet(); }} />}
        {s === 'paused' && <Row icon="play" title="Продолжить" sub="вернуть в «Играю сейчас»" onClick={() => act('playing', `${g.name} — снова в «Играю сейчас»`)} />}
        {s === 'playing' && <Row icon="pause" title="Отложить" sub="вернусь позже — уйдёт в «Отложено»" onClick={() => act('paused', `${g.name} — в «Отложено»`)} />}
        {(s === 'playing' || s === 'paused') && <Row icon="x" danger title="Бросить" sub="уйдёт в «Брошено», часы сохранятся" onClick={() => act('dropped', `${g.name} — в «Брошено»`)} />}
        {s === 'rotation' && <Row icon="x" title="Забросил" sub="убрать из «В ротации»" onClick={() => act('quit', `${g.name} — заброшена`)} />}
        {s === 'quit' && <Row icon="repeat" title="Вернуть в ротацию" onClick={() => act('rotation', `${g.name} — снова в ротации`)} />}
        {s === 'done' && <Row icon="repeat" title="Перепройти" sub={`начать прохождение №${timesCompleted(g) + 1} сейчас`} onClick={() => openSheet('replay', { id })} />}
        {s === 'done' && <Row icon="plus" title="Добавить прохождение" sub="уже было — вписать даты и часы" onClick={() => openSheet('playthroughs', { id, add: true })} />}
        {(s === 'done' || s === 'dropped') && <Row icon="star" title={g.rating ? `Оценка: ${g.rating}/10` : 'Поставить оценку'} sub="изменить" onClick={() => openSheet('rating', { id })} />}
        {(s === 'done' || s === 'dropped') && <Row icon="clock" title="Часы и даты" sub={s === 'done' ? 'поправить часы и даты прохождений' : 'поправить наигранные часы'} onClick={() => openSheet('playthroughs', { id })} />}
        {s === 'dropped' && <Row icon="play" title="Вернуться к игре" sub="снова в «Играю сейчас»" onClick={() => act('playing', `${g.name} — снова в «Играю сейчас»`)} />}
        {p && (
          <>
            <Row icon="cal" title="Изменить дату начала" sub={p.start ? `сейчас: ${fmtDate(p.start)}` : 'не указана'} expanded={open === 'date'} onClick={() => toggle('date')} />
            {open === 'date' && <div style={{ padding: '4px 4px 8px' }}><Field label="Дата начала" id="ps" type="date" mono value={p.start || ''} max={todayISO()} onInput={(v) => v && setOpenStart(id, v)} /></div>}
          </>
        )}
        <Row icon="monitor" title="Платформа" sub={g.platform ? `сейчас: ${g.platform}` : 'для категоризации'} expanded={open === 'pf'} onClick={() => toggle('pf')} />
        {open === 'pf' && <div style={{ padding: '4px 4px 8px' }}><PlatformPicker value={g.platform} onChange={(v) => updateGame(id, { platform: v })} /></div>}
        {open !== 'del' ? (
          <Row icon="trash" danger title="Удалить из дневника" sub="насовсем, вместе с часами" onClick={() => setOpen('del')} />
        ) : (
          <div class="info red" style={{ flexDirection: 'column' }}>
            <b>Точно удалить «{g.name}»? Это нельзя отменить.</b>
            <div class="row">
              <button class="btn btn-glass btn-sm" onClick={() => setOpen('')}>Отмена</button>
              <button class="btn btn-red btn-sm" onClick={() => { closeSheet(); const ui = getUi(); if (ui.stack[ui.stack.length - 1].name === 'game') back(); deleteGame(id); toast('Игра удалена'); }}>Удалить</button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ---------- Finish playthrough (2 steps) ----------
function FinishSheet({ id }) {
  const g = getGame(id);
  const p = g && openPt(g);
  const ses = g ? currentHours(g) : 0; // tracked sessions + hours played before adding
  const prefill = ses >= 0.5 ? Math.round(ses) : previousHours(g || {}) || (g && hltbHours(g) ? Math.round(hltbHours(g)) : 10);
  const [step, setStep] = useState(1);
  const [start, setStart] = useState((p && p.start) || isoAddDays(todayISO(), -14));
  const [end, setEnd] = useState(todayISO());
  const [hours, setHours] = useState(prefill);
  const [rating, setRating] = useState(g ? g.rating : null);
  const [imp, setImp] = useState(g ? g.impressions : '');
  const [fav, setFav] = useState(g ? g.fav : false);
  const [rp, setRp] = useState(g ? g.replay : false);
  if (!g) return null;
  const hint = [ses > 0 ? `по таймеру ${fmtHM(ses * 3600000)}` : '', hltbHours(g) ? `HLTB ${fmtHours(hltbHours(g))}` : '', previousHours(g) ? `прошлый раз ${fmtHours(previousHours(g))}` : ''].filter(Boolean).join(' · ');
  const steps = <div class="steps"><i class="on" /><i class={step === 2 ? 'on' : ''} /></div>;
  if (step === 1) {
    return (
      <Sheet title="Закончить прохождение" sub="Шаг 1 из 2 · даты и часы">
        {steps}
        <div class="row" style={{ gap: 10 }}>
          <Field label="Начал" id="f1" type="date" mono value={start} max={end} onInput={(v) => v && setStart(v)} />
          <Field label="Закончил" id="f2" type="date" mono value={end} max={todayISO()} onInput={(v) => v && setEnd(v)} />
        </div>
        <div class="col" style={{ gap: 8 }}>
          <Stepper id="fh" label="Сколько часов" value={hours} onChange={setHours} max={2000} unit="ч" />
          {hint && <span class="mono xs muted">{hint}</span>}
        </div>
        <button class="btn btn-primary" style={{ flex: 'none' }} disabled={!start || !end || start > end} onClick={() => setStep(2)}>Дальше</button>
      </Sheet>
    );
  }
  return (
    <Sheet title="Как тебе?" sub="Шаг 2 из 2 · оценка и впечатления">
      {steps}
      <div class="col" style={{ gap: 8 }}><span class="lbl">Оценка</span><Rating value={rating} onChange={setRating} /></div>
      <div class="field">
        <label class="lbl" for="fi">Что понравилось, что нет</label>
        <textarea id="fi" class="ta" value={imp} onInput={(e) => setImp(e.currentTarget.value)} placeholder="Пара строк для себя" />
      </div>
      <div class="col" style={{ gap: 8 }}>
        <ToggleRow on={fav} onChange={setFav} icon="heart" color="#FF3D5E" fillIcon title="Любимая" />
        <ToggleRow on={rp} onChange={setRp} icon="book" color="#6CC0FF" fillIcon title="Хочу перепройти" />
      </div>
      <div class="row">
        <button class="btn btn-glass" style={{ flex: '0 0 110px' }} onClick={() => setStep(1)}>Назад</button>
        <button class="btn btn-primary" onClick={() => {
          finishPlaythrough(id, { start, end, hours: Number(hours) || 0, rating, impressions: (imp || '').trim(), fav, replay: rp });
          closeSheet();
          go('finishDone', { id });
        }}><Icon n="check" size={18} sw={2.2} />Сохранить</button>
      </div>
    </Sheet>
  );
}

// ---------- Rating ----------
function RatingSheet({ id }) {
  const g = getGame(id);
  const [r, setR] = useState(g ? g.rating : null);
  if (!g) return null;
  return (
    <Sheet title="Оценка" sub={g.status === 'dropped' ? `${g.name} · брошено, оценка по желанию` : g.name}>
      <Rating value={r} onChange={setR} />
      <span class="small muted">Меняй сколько угодно — старая оценка не сохраняется. Нажми на выбранную ещё раз, чтобы убрать.</span>
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => { updateGame(id, { rating: r }); closeSheet(); }}><Icon n="check" size={18} sw={2.2} />Сохранить</button>
    </Sheet>
  );
}

// ---------- Replay ----------
function ReplaySheet({ id }) {
  const g = getGame(id);
  const [date, setDate] = useState(todayISO());
  const [unmark, setUnmark] = useState(true);
  if (!g) return null;
  const n = timesCompleted(g);
  const prev = previousHours(g);
  return (
    <Sheet title="Перепройти" sub={`${g.name} · прохождение №${n + 1}`}>
      <DatePick label="Когда начинаешь" value={date} onChange={setDate} />
      {g.replay && (
        <ToggleRow on={unmark} onChange={setUnmark} icon="book" color="#6CC0FF" fillIcon={false}
          title="Убрать из «Хочу перепройти»" sub={unmark ? 'игра пропадёт из этого списка' : 'игра останется в списке «Перепройти»'} />
      )}
      <Info icon="repeat">Игра появится в «Играю сейчас». Прошлые прохождения, оценка и впечатления никуда не денутся. Когда закончишь, в карточке будет «Пройдено ×{n + 1}»{prev ? `, а часы нового прохождения предложим взять из прошлого раза — ${fmtHours(prev)}` : ''}.</Info>
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => { startReplay(id, date, g.replay && unmark); toast(`${g.name} — в «Играю сейчас»`); closeSheet(); }}>
        <Icon n="play" size={18} />Начать прохождение №{n + 1}
      </button>
    </Sheet>
  );
}

// ---------- Edit hours & dates of finished playthroughs ----------
function PlaythroughsSheet({ id, add }) {
  const g = getGame(id);
  const blank = () => {
    const prev = g ? previousHours(g) : null;
    return { start: isoAddDays(todayISO(), -14), end: todayISO(), hours: prev || (g && hltbHours(g) ? Math.round(hltbHours(g)) : 10), old: false, isNew: true };
  };
  const [pts, setPts] = useState(() => {
    const list = g ? completed(g).map((p) => ({ ...p })) : [];
    return add ? [...list, blank()] : list;
  });
  const [base, setBase] = useState(g ? g.baseHours || 0 : 0);
  if (!g) return null;
  const save = () => {
    const open = (g.playthroughs || []).filter((p) => !p.end && !p.old);
    const clean = cleanPts(pts);
    const patch = { playthroughs: [...clean, ...open], baseHours: Number(base) || 0 };
    if (g.status !== 'done' && !open.length && clean.length && g.type !== 'online' && g.status !== 'dropped') patch.status = 'done';
    updateGame(id, patch);
    toast(pts.some((p) => p.isNew) ? `Прохождение добавлено · теперь ×${clean.length}` : 'Сохранено');
    closeSheet();
  };
  return (
    <Sheet title={add ? 'Добавить прохождение' : 'Часы и даты'} sub={g.name}>
      {pts.length === 0 && g.status !== 'dropped' && <Info>У этой игры нет завершённых прохождений.</Info>}
      <PtRows pts={pts} setPts={setPts} />
      {g.type !== 'online' && (
        <button class="btn btn-glass" style={{ flex: 'none' }} onClick={() => setPts([...pts, blank()])}><Icon n="plus" size={16} sw={2.2} />Ещё прохождение</button>
      )}
      {(g.status === 'dropped' || base > 0) && (
        <div class="pt-row">
          <b style={{ fontSize: 14 }}>Часы до начала учёта</b>
          <Stepper id="base" label="Без даты" value={base} onChange={setBase} max={5000} unit="ч" />
        </div>
      )}
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={save}><Icon n="check" size={18} sw={2.2} />Сохранить</button>
    </Sheet>
  );
}

// ---------- HLTB main story hours (manual) ----------
function HltbSheet({ id }) {
  const g = getGame(id);
  const [h, setH] = useState(g && g.hltb ? g.hltb.main : '');
  if (!g) return null;
  const v = Number(String(h).replace(',', '.')) || 0;
  const cur = currentHours(g);
  const rem = g.status === 'playing' || g.status === 'paused' ? remainingText(cur, v) : null;
  return (
    <Sheet title="HLTB · основной сюжет" sub={g.name}>
      <Info>Найди игру на HowLongToBeat и возьми время <b>Main Story</b>. Побочки и 100% не нужны.</Info>
      <a class="btn btn-glass" style={{ flex: 'none', textDecoration: 'none' }} href={hltbSearchUrl(g)}><Icon n="search" size={16} sw={2} />Открыть HowLongToBeat</a>
      <Stepper id="hl" label="Часов на сюжет" value={h} onChange={setH} step={0.5} max={500} unit="ч" />
      {v > 0 && rem && <span class="small text2">Сейчас наиграно {fmtHours(cur)} · осталось {rem.v === '—' ? '0 ч' : rem.v}{rem.v === '—' ? ` (${rem.s})` : ''}</span>}
      <div class="row">
        {g.hltb && <button class="btn btn-glass" style={{ flex: '0 0 120px' }} onClick={() => { updateGame(id, { hltb: null }); closeSheet(); }}>Убрать</button>}
        <button class="btn btn-primary" disabled={v <= 0} onClick={() => { updateGame(id, { hltb: { main: Math.round(v * 10) / 10, src: 'manual' } }); toast('Время HLTB сохранено'); closeSheet(); }}>
          <Icon n="check" size={18} sw={2.2} />Сохранить
        </button>
      </div>
    </Sheet>
  );
}

// ---------- Impressions ----------
function ImpressionsSheet({ id }) {
  const g = getGame(id);
  const [t, setT] = useState(g ? g.impressions : '');
  if (!g) return null;
  return (
    <Sheet title="Мои впечатления" sub={g.name}>
      <div class="field">
        <label class="lbl" for="imp2">Что понравилось, что нет</label>
        <textarea id="imp2" class="ta" style={{ minHeight: 220 }} value={t} onInput={(e) => setT(e.currentTarget.value)} />
      </div>
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => { updateGame(id, { impressions: t.trim() }); closeSheet(); }}><Icon n="check" size={18} sw={2.2} />Сохранить</button>
    </Sheet>
  );
}

// ---------- What the hours of a year / month are made of ----------
function StatHoursSheet({ period = 'year' }) {
  const db = getDb();
  const games = Object.values(db.games);
  const st = computeStats(games, db.settings);
  const from = period === 'year' ? st.yearStart : st.monthStart;
  const list = hoursByGame(games, db.settings, from, st.today);
  const total = list.reduce((a, x) => a + x.hours, 0);
  const max = Math.max(1e-9, ...list.map((x) => x.hours));
  const title = period === 'year' ? `Часы за ${st.year}` : `Часы с 1 ${monthGen(st.month)}`;
  return (
    <Sheet title={title} sub={list.length ? `${fmtHours(total)} · ${list.length} ${list.length % 10 === 1 && list.length % 100 !== 11 ? 'игра' : list.length % 10 >= 2 && list.length % 10 <= 4 && (list.length % 100 < 10 || list.length % 100 >= 20) ? 'игры' : 'игр'}` : 'Пока пусто'}>
      {!list.length && <Info>За этот период нет ни сессий, ни прохождений с датами.</Info>}
      <div class="col" style={{ gap: 6 }}>
        {list.map(({ g, hours }) => (
          <button class="hrow" onClick={() => { closeSheet(); go('game', { id: g.id }); }} aria-label={`${g.name}, ${fmtHours(hours)}`}>
            <Cover g={g} size="small" label={false} style={{ width: 40, height: 54, borderRadius: 9, flex: 'none' }} />
            <span class="col" style={{ gap: 6, flex: 1, minWidth: 0 }}>
              <span class="between" style={{ gap: 10 }}>
                <b class="ell" style={{ fontSize: 14 }}>{g.name}</b>
                <span class="mono" style={{ fontWeight: 600, fontSize: 14, flex: 'none' }}>{fmtHours(hours)}</span>
              </span>
              <span class="tr"><i style={{ width: `${(hours / max) * 100}%` }} /></span>
              <span class="xs muted">{STATUS[g.status]}{total ? ` · ${Math.round((hours / total) * 100)}%` : ''}</span>
            </span>
          </button>
        ))}
      </div>
      {!db.settings.countOnline && <span class="xs muted">Сетевые игры не учитываются — это переключается в настройках.</span>}
    </Sheet>
  );
}

// Story or online mode — for games that have both.
function ModePick({ value, onChange }) {
  return (
    <div class="col" style={{ gap: 8 }}>
      <span class="lbl">Что играл</span>
      <ChipGroup value={value} onChange={onChange} options={[['story', 'Сюжет'], ['net', 'Сетевой режим']]} />
    </div>
  );
}

function PickModeSheet({ id }) {
  const g = getGame(id);
  if (!g) return null;
  const go1 = (mode) => { startSession(id, mode); closeSheet(); };
  const storySub = g.status === 'playing' ? 'часы пойдут в текущее прохождение'
    : g.status === 'done' ? 'часы засчитаются игре, статус «Пройдено» останется'
      : 'игра переедет в «Играю сейчас»';
  return (
    <Sheet title="Что играешь?" sub={g.name}>
      <div class="col" style={{ gap: 8 }}>
        <button class="menu-row" onClick={() => go1('story')}><Icon n="play" /><span class="t"><b>Сюжет</b><span>{storySub}</span></span></button>
        <button class="menu-row" onClick={() => go1('net')}><Icon n="repeat" /><span class="t"><b>Сетевой режим</b><span>часы — в сеть, сюжетный статус не изменится</span></span></button>
      </div>
    </Sheet>
  );
}

export const SHEETS = {
  pickMode: PickModeSheet,
  baseHours: BaseHoursSheet,
  statHours: StatHoursSheet,
  add: AddSheet,
  start: StartSheet,
  sessionEnd: SessionEndSheet,
  manual: ManualSheet,
  more: MoreSheet,
  finish: FinishSheet,
  rating: RatingSheet,
  replay: ReplaySheet,
  impressions: ImpressionsSheet,
  playthroughs: PlaythroughsSheet,
  hltb: HltbSheet,
  session: SessionEditSheet,
  deckInfo: DeckInfoSheet,
};
