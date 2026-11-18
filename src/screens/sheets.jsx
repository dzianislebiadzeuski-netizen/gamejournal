import { useState } from 'preact/hooks';
import {
  getGame, closeSheet, replace, go, tab, toast, updateGame, deleteGame, setStatus, startPlaythrough, saveSession,
  addManualTime, setOpenStart, finishPlaythrough, startReplay, previousHours, back, getUi, openSheet,
} from '../lib/store.js';
import { Sheet, Icon, ChipGroup, Field, Stepper, Rating, ToggleRow, Info, Cell } from '../ui/kit.jsx';
import { PLATFORMS, openPt, currentSessionsMs, hltbHours, hltbSrc, timesCompleted, totalHours, STATUS } from '../lib/model.js';
import { todayISO, isoAddDays, fmtHM, fmtTime, fmtDate, fmtHours } from '../lib/util.js';
import { addFromSearch } from '../lib/actions.js';
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
  const src = coverUrl(res.cover, 'small');
  const add = () => {
    if (status === 'done') return go('addDone', { res, platform });
    const g = addFromSearch(res, { status, top, platform });
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
  const label = { wish: 'Добавить в «Хочу пройти»', playing: 'Добавить в «Играю сейчас»', done: 'Дальше: даты, часы, оценка', rotation: 'Добавить в «В ротации»' }[status];
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
        <R k="playing" title="Прохожу сейчас" sub="в «Играю сейчас», начало — сегодня" />
        <R k="done" title="Уже прошёл" sub="укажешь даты, часы и оценку" />
        <R k="rotation" title="Сетевая — играю" sub="в «В ротации», часы через таймер" />
      </div>
      <div class="col" style={{ gap: 8 }}>
        <span class="lbl">Платформа</span>
        <ChipGroup value={platform} onChange={(v) => setPlatform(v === platform ? '' : v)} options={PLATFORMS} />
      </div>
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
function SessionEndSheet({ id, start, end }) {
  const g = getGame(id);
  const [edit, setEdit] = useState(false);
  const dur = end - start;
  const [h, setH] = useState(Math.floor(dur / 3600000));
  const [m, setM] = useState(Math.round((dur % 3600000) / 60000));
  if (!g) return null;
  const save = (ms) => {
    saveSession(id, start, start + ms);
    toast(`Сессия сохранена · ${fmtHM(ms)}`);
    closeSheet();
  };
  const totalNow = (totalHours(g) * 3600000 + dur);
  return (
    <Sheet title="Сессия закончена" sub={g.name} onClose={() => save(dur)}>
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

// ---------- Manual time ----------
function ManualSheet({ id }) {
  const g = getGame(id);
  const [date, setDate] = useState(todayISO());
  const [h, setH] = useState(1);
  const [m, setM] = useState(0);
  if (!g) return null;
  const ms = ((Number(h) || 0) * 60 + (Number(m) || 0)) * 60000;
  return (
    <Sheet title="Добавить время" sub={`${g.name} · если забыл нажать «Сел играть»`}>
      <DatePick label="Когда играл" value={date} onChange={setDate} />
      <div class="row" style={{ gap: 10 }}>
        <Stepper id="mh" label="Часы" value={h} onChange={setH} max={23} unit="ч" />
        <Stepper id="mm" label="Минуты" value={m} onChange={setM} step={15} max={45} unit="м" />
      </div>
      <button class="btn btn-primary" style={{ flex: 'none' }} disabled={ms <= 0} onClick={() => { addManualTime(id, date, ms); toast(`Добавлено ${fmtHM(ms)}`); closeSheet(); }}>
        <Icon n="plus" size={18} sw={2.2} />Добавить {fmtHM(ms)}
      </button>
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
        {s === 'wish' && <Row icon="play" title="Начать прохождение" sub="в «Играю сейчас»" onClick={() => openSheet('start', { id })} />}
        {s === 'paused' && <Row icon="play" title="Продолжить" sub="вернуть в «Играю сейчас»" onClick={() => act('playing', `${g.name} — снова в «Играю сейчас»`)} />}
        {s === 'playing' && <Row icon="pause" title="Отложить" sub="вернусь позже — уйдёт в «Отложено»" onClick={() => act('paused', `${g.name} — в «Отложено»`)} />}
        {(s === 'playing' || s === 'paused') && <Row icon="x" danger title="Бросить" sub="уйдёт в «Брошено», часы сохранятся" onClick={() => act('dropped', `${g.name} — в «Брошено»`)} />}
        {s === 'rotation' && <Row icon="x" title="Забросил" sub="убрать из «В ротации»" onClick={() => act('quit', `${g.name} — заброшена`)} />}
        {s === 'quit' && <Row icon="repeat" title="Вернуть в ротацию" onClick={() => act('rotation', `${g.name} — снова в ротации`)} />}
        {s === 'done' && <Row icon="star" title="Изменить оценку" onClick={() => openSheet('rating', { id })} />}
        {p && (
          <>
            <Row icon="cal" title="Изменить дату начала" sub={`сейчас: ${fmtDate(p.start)}`} expanded={open === 'date'} onClick={() => toggle('date')} />
            {open === 'date' && <div style={{ padding: '4px 4px 8px' }}><Field label="Дата начала" id="ps" type="date" mono value={p.start} max={todayISO()} onInput={(v) => v && setOpenStart(id, v)} /></div>}
          </>
        )}
        <Row icon="device" title="Платформа" sub={g.platform ? `сейчас: ${g.platform}` : 'для категоризации'} expanded={open === 'pf'} onClick={() => toggle('pf')} />
        {open === 'pf' && <div style={{ padding: '4px 4px 8px' }}><ChipGroup value={g.platform} onChange={(v) => updateGame(id, { platform: v === g.platform ? '' : v })} options={PLATFORMS} /></div>}
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
  const ses = g ? currentSessionsMs(g) / 3600000 : 0;
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
  const hint = [ses > 0 ? `по таймеру ${fmtHM(ses * 3600000)}` : '', hltbHours(g) ? `${hltbSrc(g)} ~${fmtHours(hltbHours(g))}` : '', previousHours(g) ? `прошлый раз ${fmtHours(previousHours(g))}` : ''].filter(Boolean).join(' · ');
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
    <Sheet title="Начать заново" sub={`${g.name} · будет ${n + 1}-е прохождение`}>
      <DatePick label="Дата начала" value={date} onChange={setDate} />
      {g.replay && <ToggleRow on={unmark} onChange={setUnmark} icon="book" color="#6CC0FF" fillIcon title="Снять метку «Хочу перепройти»" sub="раз уж перепрохожу" />}
      <Info icon="repeat">Игра переедет в «Играю сейчас». Когда закончишь — счётчик станет ×{n + 1}{prev ? `, часы прохождения подставятся из прошлого раза (${fmtHours(prev)})` : ''}. Оценку и впечатления можно будет обновить.</Info>
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => { startReplay(id, date, unmark); toast(`${g.name} — в «Играю сейчас»`); closeSheet(); }}>
        <Icon n="play" size={18} />Начать прохождение
      </button>
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

export const SHEETS = {
  add: AddSheet,
  start: StartSheet,
  sessionEnd: SessionEndSheet,
  manual: ManualSheet,
  more: MoreSheet,
  finish: FinishSheet,
  rating: RatingSheet,
  replay: ReplaySheet,
  impressions: ImpressionsSheet,
};
