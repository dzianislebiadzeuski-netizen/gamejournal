import { useEffect, useState } from 'preact/hooks';
import { useStore, back, openSheet, updateGame, setStatus, startSession, findByExt, go } from '../lib/store.js';
import { Cover, Icon, Status, Section, Cell, Info, ToggleRow, useTick, Back, PlatformBadge } from '../ui/kit.jsx';
import {
  timesCompleted, totalHours, currentHours, hltbHours, remainingText, diffText, openPt, completed, activeMs, daysSince, isOnline, lastCompleted,
} from '../lib/model.js';
import { fmtHours, fmtDate, fmtClock, fmtTime, relDay, todayISO, fmtHM, placeholderGradient, monthName, periodLabel } from '../lib/util.js';
import { toggleSession, toggleFav, addSimilarToWish, removeFromWish } from '../lib/actions.js';
import { enrich, translateGame } from '../lib/enrich.js';
import { coverUrl, sourceUrl } from '../lib/catalog.js';
import { dailyHours, sumRange } from '../lib/stats.js';

function SessionButton({ g, children }) {
  return (
    <div class="row">
      {g.active
        ? <button class="btn btn-red" onClick={() => toggleSession(g.id)}><Icon n="stop" size={16} />Стоп <span class="mono">{fmtClock(activeMs(g))}</span></button>
        : <button class="btn btn-primary" onClick={() => toggleSession(g.id)}><Icon n="play" size={18} />Сел играть</button>}
      {children}
    </div>
  );
}

const Dots = ({ id }) => (
  <button class="btn btn-glass btn-icon" aria-label="Ещё: отложить, бросить, удалить" onClick={() => openSheet('more', { id })}><Icon n="dots" size={20} /></button>
);

function Sessions({ g }) {
  const [all, setAll] = useState(false);
  const sorted = [...(g.sessions || [])].sort((a, b) => b.start - a.start);
  const list = all ? sorted : sorted.slice(0, 5);
  return (
    <Section title="Сессии" right={<button class="link" onClick={() => openSheet('manual', { id: g.id })}>+ Добавить вручную</button>}>
      {list.length ? (
        <div class="col" style={{ gap: 0 }}>
          {list.map((s) => (
            <button class="ses ses-btn" aria-label="Изменить сессию" onClick={() => openSheet('session', { id: g.id, start: s.start })}>
              <Icon n="clock" size={16} color="#8C93A1" />
              <span style={{ flex: 1, fontWeight: 600, textAlign: 'left' }}>{s.period ? periodLabel(s.period.from, s.period.to) : relDay(todayISO(new Date(s.start)))}
                <span class="mono xs muted" style={{ marginLeft: 8 }}>{s.period ? 'период' : s.manual ? 'вручную' : `${fmtTime(s.start)}–${fmtTime(s.end)}`}</span>
              </span>
              <span class="mono" style={{ fontWeight: 600 }}>{fmtHM(s.end - s.start)}</span>
              <Icon n="chev" size={14} sw={2} color="#8C93A1" />
            </button>
          ))}
          {sorted.length > 5 && <button class="link" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setAll(!all)}>{all ? 'Свернуть' : `Показать все (${sorted.length})`}</button>}
        </div>
      ) : <span class="small muted" style={{ fontSize: 13 }}>Жми «Сел играть», когда садишься играть, — время посчитается само.</span>}
    </Section>
  );
}

function Description({ g, lang }) {
  const [orig, setOrig] = useState(lang === 'en');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const s = g.summary || {};
  if (!s.en && !s.ru) return null;
  const hasRu = !!s.ru;
  const showRu = !orig && hasRu;
  const translate = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await translateGame(g.id);
    setBusy(false);
    if (ok) setOrig(false);
    else setFailed(true);
  };
  let right;
  if (hasRu) right = <button class="link" onClick={() => setOrig(!orig)}>{orig ? 'Показать перевод' : 'Показать оригинал'}</button>;
  else if (s.en) right = busy ? <span class="spinner" /> : <button class="link" onClick={translate}>Перевести</button>;
  return (
    <Section title="Описание" right={right}>
      <p class="desc" lang={showRu ? 'ru' : 'en'}>{showRu ? s.ru : s.en}</p>
      {!hasRu && failed && <span class="small muted">Не получилось перевести. Нужен интернет, чтобы один раз скачать языковой пакет (~30 МБ). Попробуй ещё раз или скачай его в настройках.</span>}
    </Section>
  );
}

export function Similar({ g }) {
  useStore();
  const list = (g.similar || []).slice(0, 9);
  if (!list.length) return <Section title="Похожие игры"><div class="dashed">{g.extId ? 'Подбираем похожие игры…' : 'Для игр, добавленных вручную, похожие не подбираются.'}</div></Section>;
  return (
    <Section title="Похожие игры" right={<span class="mono xs muted">по данным RAWG</span>}>
      <div class="grid3" style={{ gap: 12 }}>
        {list.map((s) => {
          const ex = findByExt(s.extId);
          const inWish = ex && ex.status === 'wish';
          const src = coverUrl(s.cover);
          const open = () => (ex ? go('game', { id: ex.id }) : openSheet('add', { res: s }));
          return (
            <div class="tile">
              <div class="cover" style={{ background: src ? '#1a1d25' : placeholderGradient(s.name) }}>
                {src ? <img src={src} alt="" loading="lazy" /> : <div class="ph">{s.name}</div>}
                <button aria-label={`Открыть: ${s.name}`} onClick={open} style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'none', border: 'none' }} />
                {ex && !inWish ? (
                  <span class="badge bl" style={{ color: '#C9B4FF' }}>в дневнике</span>
                ) : (
                  <button class="bm" aria-pressed={inWish ? 'true' : 'false'} aria-label={inWish ? 'Убрать из «Хочу пройти»' : 'В «Хочу пройти»'}
                    onClick={() => (inWish ? removeFromWish(ex.id) : addSimilarToWish(s))}>
                    <span><Icon n="book" size={14} sw={1.8} fill={inWish ? '#6CC0FF' : 'none'} color="#6CC0FF" /></span>
                  </button>
                )}
              </div>
              <button class="nm" style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', whiteSpace: 'normal', lineHeight: 1.3 }} onClick={open}>{s.name}</button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function History({ g }) {
  const pts = completed(g);
  if (!pts.length) return null;
  return (
    <Section title="Прохождения" right={<span class="row" style={{ gap: 14 }}>
      {g.status === 'done' && <button class="link" onClick={() => openSheet('playthroughs', { id: g.id, add: true })}>+ Добавить</button>}
      <button class="link" onClick={() => openSheet('playthroughs', { id: g.id })}>Изменить</button></span>}>
      <div class="col" style={{ gap: 0 }}>
        {pts.map((p, i) => (
          <button class="ses ses-btn" aria-label="Изменить прохождение" onClick={() => openSheet('playthroughs', { id: g.id })}>
            <span class="mono xs muted" style={{ width: 22 }}>#{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 600, textAlign: 'left' }}>{p.old || !p.end ? 'давно' : `${fmtDate(p.start)} — ${fmtDate(p.end, true)}`}</span>
            <span class="mono" style={{ fontWeight: 600 }}>{p.hours ? fmtHours(p.hours) : '—'}</span>
            <Icon n="chev" size={14} sw={2} color="#8C93A1" />
          </button>
        ))}
      </div>
    </Section>
  );
}

function HltbCell({ g, hl }) {
  return <Cell l="HLTB · сюжет" v={hl ? fmtHours(hl) : '+'} s={hl ? 'нажми, чтобы изменить' : 'вписать вручную'} onClick={() => openSheet('hltb', { id: g.id })} />;
}

function Compare({ g, mine, hl, label }) {
  if (!hl) {
    return (
      <button class="dashed" style={{ textAlign: 'left', background: 'none', color: 'var(--muted)', width: '100%' }} onClick={() => openSheet('hltb', { id: g.id })}>
        Впиши время основного сюжета с HowLongToBeat — покажу, насколько ты быстрее или дольше.
      </button>
    );
  }
  const max = Math.max(mine, hl) || 1;
  return (
    <div class="card glass" style={{ gap: 10 }}>
      <div class="between"><span class="lbl">Сравнение с HLTB</span><button class="link" onClick={() => openSheet('hltb', { id: g.id })}>Изменить</button></div>
      <div class="cmp"><span>{label}</span><div class="tr"><i style={{ width: `${(mine / max) * 100}%` }} /></div><b class="mono">{fmtHours(mine)}</b></div>
      <div class="cmp"><span>HLTB, сюжет</span><div class="tr"><i class="h" style={{ width: `${(hl / max) * 100}%` }} /></div><b class="mono">{fmtHours(hl)}</b></div>
      <span class="small text2">{diffText(mine, hl)}</span>
    </div>
  );
}

export function Game({ id }) {
  const { db } = useStore();
  const g = db.games[id];
  useTick(!!(g && g.active));
  useEffect(() => { if (g && g.extId) enrich(g.id); }, [id]);
  if (!g) {
    return (
      <div class="screen no-nav">
        <Back onClick={back} />
        <Info>Этой игры больше нет в дневнике.</Info>
      </div>
    );
  }
  const n = timesCompleted(g);
  const hl = hltbHours(g);
  const p = openPt(g);
  const total = totalHours(g) + activeMs(g) / 3600000;
  const cur = currentHours(g) + activeMs(g) / 3600000;
  const online = isOnline(g);
  const meta = [(g.genres || []).slice(0, 3).join(' · '), g.year].filter(Boolean).join(' · ');

  let stats = null;
  let actions = null;
  const s = g.status;

  if (s === 'wish') {
    stats = (
      <div class="card glass"><div class="stats2">
        {online ? <Cell l="Тип" v={<span style={{ fontSize: 16 }}>Сетевая</span>} s="пройти нельзя" /> : <HltbCell g={g} hl={hl} />}
        <Cell l="В списке" v={`${daysSince(todayISO(new Date(g.addedAt)))} дн`} s={`с ${fmtDate(todayISO(new Date(g.addedAt)))}`} />
      </div></div>
    );
    actions = (
      <>
        <ToggleRow on={g.top} onChange={(v) => updateGame(id, { top: v })} icon="flame" color="#FF7A92" title="Топ приоритет" sub="будет наверху «Хочу пройти»" />
        <div class="row">
          {online
            ? <button class="btn btn-primary" onClick={() => setStatus(id, 'rotation')}><Icon n="play" size={18} />Начать играть</button>
            : <button class="btn btn-primary" onClick={() => openSheet('start', { id })}><Icon n="play" size={18} />Начать прохождение</button>}
          <Dots id={id} />
        </div>
      </>
    );
  } else if (s === 'playing') {
    stats = (
      <div class="card glass">
        <div class="stats3">
          <Cell l="Наиграно" v={fmtHours(cur)} s={`${n ? `№${n + 1} · ` : ''}с ${p ? fmtDate(p.start) : '—'}`} />
          <HltbCell g={g} hl={hl} />
          <Cell l="Осталось" v={hl ? remainingText(cur, hl).v : '—'} s={hl ? remainingText(cur, hl).s : 'нужно время HLTB'} />
        </div>
        {hl && <div class="prog"><i style={{ width: `${Math.min(100, (cur / hl) * 100)}%` }} /></div>}
      </div>
    );
    actions = (
      <div class="col" style={{ gap: 8 }}>
        <SessionButton g={g}><Dots id={id} /></SessionButton>
        <button class="btn btn-glass" style={{ flex: 'none' }} onClick={() => openSheet('finish', { id })}><Icon n="check" size={16} sw={2.2} />Закончить прохождение</button>
      </div>
    );
  } else if (s === 'paused') {
    stats = (
      <div class="card glass">
        <div class="stats3">
          <Cell l="Наиграно" v={fmtHours(cur)} s={`на паузе ${daysSince(todayISO(new Date(g.statusAt)))} дн`} />
          <HltbCell g={g} hl={hl} />
          <Cell l="Осталось" v={hl ? remainingText(cur, hl).v : '—'} s={hl ? remainingText(cur, hl).s : 'нужно время HLTB'} />
        </div>
        {hl && <div class="prog"><i style={{ width: `${Math.min(100, (cur / hl) * 100)}%` }} /></div>}
      </div>
    );
    actions = (
      <>
        <Info icon="pause">«Продолжить» вернёт игру в «Играю сейчас», часы и дата начала сохранятся.</Info>
        <div class="row">
          <button class="btn btn-primary" onClick={() => setStatus(id, 'playing')}><Icon n="play" size={18} />Продолжить</button>
          <Dots id={id} />
        </div>
      </>
    );
  } else if (s === 'dropped') {
    stats = (
      <div class="card glass"><div class="stats2">
        <Cell l="Наиграно" v={fmtHours(total)} s="нажми, чтобы изменить" onClick={() => openSheet('playthroughs', { id })} />
        <Cell l="Бросил" v={fmtDate(todayISO(new Date(g.statusAt)), false)} s={String(new Date(g.statusAt).getFullYear())} />
      </div></div>
    );
    actions = (
      <>
        <div class="row">
          <button class="btn btn-glass" onClick={() => setStatus(id, 'playing')}><Icon n="play" size={16} />Вернуться к игре</button>
          <Dots id={id} />
        </div>
        <button class="row glass" style={{ justifyContent: 'space-between', minHeight: 52, padding: '0 16px', borderRadius: 16, color: 'inherit' }} onClick={() => openSheet('rating', { id })}>
          <b style={{ fontSize: 14 }}>Оценка</b><span class="small muted" style={{ fontSize: 13 }}>{g.rating ? `${g.rating}/10` : 'поставить, если хочешь ›'}</span>
        </button>
      </>
    );
  } else if (s === 'done') {
    const pts = completed(g);
    const same = pts.length > 1 && pts.every((x) => x.hours === pts[0].hours);
    stats = (
      <div class="card glass"><div class="stats3">
        <Cell l="Оценка" v={g.rating ? <>{g.rating}<span style={{ fontSize: 13, color: '#8C93A1' }}>/10</span></> : '—'} s="нажми, чтобы изменить" onClick={() => openSheet('rating', { id })} />
        <Cell l="Прохождений" v={String(n)} s={pts[pts.length - 1] && pts[pts.length - 1].end ? `последнее: ${fmtDate(pts[pts.length - 1].end, true)}` : ''} />
        <Cell l="Наиграно" v={fmtHours(total)} s={same ? `${fmtHours(pts[0].hours)} × ${pts.length} · изменить` : 'нажми, чтобы изменить'} onClick={() => openSheet('playthroughs', { id })} />
      </div></div>
    );
    actions = (
      <>
        <div class="row">
          <button class="btn btn-purple" onClick={() => openSheet('replay', { id })}><Icon n="repeat" size={16} sw={2} />Перепройти</button>
          <Dots id={id} />
        </div>
        <ToggleRow on={g.replay} onChange={(v) => updateGame(id, { replay: v })} icon="book" color="#6CC0FF" fillIcon title="Хочу перепройти" sub={g.replay ? 'игра в списке «Перепройти»' : 'добавить в список «Перепройти»'} />
      </>
    );
  } else if (s === 'rotation' || s === 'quit') {
    const now = new Date();
    const map = dailyHours([g]);
    const month = sumRange(map, todayISO(new Date(now.getFullYear(), now.getMonth(), 1)), todayISO());
    const year = sumRange(map, `${now.getFullYear()}-01-01`, todayISO());
    stats = (
      <div class="card glass"><div class="stats3">
        <Cell l={monthName(now.getMonth())} v={fmtHours(month)} />
        <Cell l={String(now.getFullYear())} v={fmtHours(year)} s="за год" />
        <Cell l="Всего" v={fmtHours(total)} s={g.baseHours ? 'за всё время' : `с ${fmtDate(todayISO(new Date(Math.min(g.addedAt || Date.now(), ...(g.sessions || []).map((x) => x.start)))), true)}`} />
      </div></div>
    );
    actions = s === 'rotation'
      ? <SessionButton g={g}><button class="btn btn-glass" style={{ flex: '0 0 120px' }} onClick={() => setStatus(id, 'quit')}><Icon n="x" size={16} sw={2} />Забросил</button><Dots id={id} /></SessionButton>
      : <div class="row"><button class="btn btn-primary" onClick={() => setStatus(id, 'rotation')}><Icon n="repeat" size={16} sw={2} />Вернуть в ротацию</button><Dots id={id} /></div>;
  }

  return (
    <>
      <div class="amb" aria-hidden="true"><Cover g={g} label={false} /></div>
      <div class="gp-cover" aria-hidden="true">
        <Cover g={g} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0 }} />
      </div>
      <div class="gp-top">
        <Back onClick={back} />
        <button class="round" aria-pressed={g.fav ? 'true' : 'false'} aria-label="Любимая" onClick={() => toggleFav(id)}>
          <Icon n="heart" size={20} sw={1.8} fill={g.fav ? '#FF3D5E' : 'none'} color={g.fav ? '#FF3D5E' : '#E9ECF2'} />
        </button>
      </div>
      <div class="gp-body">
        <div class="col">
          <div class="chips">
            <Status s={s} label={s === 'done' && n > 1 ? `Пройдено ×${n}` : online && s === 'wish' ? 'Хочу поиграть' : undefined} />
            {online && <span class="plain">Сетевая</span>}
            <PlatformBadge p={g.platform} />
            {s === 'playing' && n > 0 && <span class="plain">перепрохождение</span>}
          </div>
          <h1 class="gp-title">{g.name}</h1>
          {meta && <div class="text2" style={{ fontSize: 13 }}>{meta}</div>}
        </div>
        {stats}
        {actions}
        {s === 'done' && <Compare g={g} mine={(lastCompleted(g) || {}).hours || 0} hl={hl} label={n > 1 ? 'Последнее прохождение' : 'Твоё прохождение'} />}
        {(s === 'playing' || online || s === 'paused' || s === 'dropped') && <Sessions g={g} />}
        {online && <Info>У сетевых игр нет «пройдено». Только «в ротации» или «забросил», а часы считаются по сессиям.</Info>}
        {(g.impressions || s === 'done') && (
          <Section title="Мои впечатления" right={<button class="link" onClick={() => openSheet('impressions', { id })}>{g.impressions ? 'Изменить' : 'Написать'}</button>}>
            {g.impressions
              ? <div class="card glass" style={{ padding: '14px 16px', borderRadius: 18, gap: 8 }}><p class="desc" style={{ color: '#E1E5EC' }}>{g.impressions}</p></div>
              : <div class="dashed">Что понравилось, что нет — пара строк для себя.</div>}
          </Section>
        )}
        <History g={g} />
        <Description g={g} lang={db.settings.lang} />
        {n > 0 && !online && <Similar g={g} />}
        {n === 0 && !online && g.extId && s !== 'dropped' && (
          <Section title="Похожие игры"><div class="dashed">Похожие игры появятся,<br />когда пройдёшь эту</div></Section>
        )}
        {g.extId && <div class="center xs muted">Данные и изображения: <a href={sourceUrl(g.slug)}>RAWG</a></div>}
      </div>
    </>
  );
}
