import { useRef, useState } from 'preact/hooks';
import { back, replace, addGame, toast, updateGame } from '../lib/store.js';
import { Icon, Back, Field, Stepper, Rating, ToggleRow, ChipGroup, Info, PlatformPicker } from '../ui/kit.jsx';
import { todayISO, isoAddDays, placeholderGradient } from '../lib/util.js';
import { PtRows, cleanPts } from '../ui/pts.jsx';
import { coverUrl } from '../lib/catalog.js';
import { enrich, saveCoverBase64 } from '../lib/enrich.js';

function Header({ res }) {
  const src = res.coverData || coverUrl(res.cover, 'small');
  return (
    <div class="row" style={{ gap: 14 }}>
      <div class="cover" style={{ width: 72, height: 96, borderRadius: 12, background: src ? '#1a1d25' : placeholderGradient(res.name) }}>
        {src && <img src={src} alt="" />}
      </div>
      <div class="col" style={{ gap: 5, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--unb)', fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{res.name}</span>
        <span class="small text2">{[res.year, (res.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</span>
        {res.platform && <span class="mono xs muted">{res.platform}</span>}
      </div>
    </div>
  );
}

// "Уже прошёл" / "Бросил": dates (or "давно"), hours, rating, impressions.
export function AddDone({ res, platform, mode = 'done' }) {
  const dropped = mode === 'dropped';
  const [old, setOld] = useState(false);
  const [start, setStart] = useState(isoAddDays(todayISO(), res.online ? -365 : -14));
  const [end, setEnd] = useState(todayISO());
  const [hours, setHours] = useState(5);
  const [pts, setPts] = useState([{ start: isoAddDays(todayISO(), -14), end: todayISO(), hours: 20, old: false }]);
  const [rating, setRating] = useState(null);
  const [imp, setImp] = useState('');
  const [fav, setFav] = useState(false);
  const [rp, setRp] = useState(false);
  const [hl, setHl] = useState('');

  const save = async () => {
    const h = Number(hours) || 0;
    const from = start <= end ? start : end;
    const hlv = Number(String(hl).replace(',', '.')) || 0;
    const { coverData, online, ...rest } = res;
    let data;
    if (dropped) {
      const noon = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
      const t0 = noon(from);
      data = {
        status: online ? 'quit' : 'dropped',
        type: online ? 'online' : 'game',
        statusAt: old ? Date.now() : noon(end),
        baseHours: old ? h : 0,
        // hours are spread over the whole period in the stats (2015–2025 stays out of 2026)
        sessions: !old && h > 0 ? [{ start: t0, end: t0 + h * 3600000, manual: true, period: { from, to: end } }] : [],
        playthroughs: [],
      };
    } else {
      data = { status: 'done', playthroughs: cleanPts(pts), replay: rp };
    }
    const g = addGame({ ...rest, extId: res.extId || undefined, type: online && dropped ? 'online' : 'game', platform: platform || '', rating, impressions: imp.trim(), fav, ...data, ...(hlv > 0 ? { hltb: { main: Math.round(hlv * 10) / 10, src: 'manual' } } : {}) });
    if (coverData) {
      const patch = await saveCoverBase64(g.id, coverData.split(',')[1]).catch(() => null);
      if (patch) updateGame(g.id, patch);
    }
    if (g.extId) enrich(g.id);
    toast(dropped ? `${g.name} — в «${online ? 'Забросил' : 'Брошено'}»` : `${g.name} — в «Пройдено»${pts.length > 1 ? ` · ×${pts.length}` : ''}`);
    replace('game', { id: g.id });
  };

  return (
    <div class="screen no-nav" style={{ gap: 14 }}>
      <div class="between" style={{ alignItems: 'center' }}>
        <Back onClick={back} />
        <span style={{ fontFamily: 'var(--unb)', fontSize: 15, fontWeight: 600 }}>{dropped ? (res.online ? 'Забросил' : 'Бросил') : 'Уже прошёл'}</span>
        <span style={{ width: 44 }} />
      </div>
      <Header res={{ ...res, platform }} />
      {dropped ? (
        <>
          <div class="card glass tint">
            <span class="lbl">{res.online ? 'Когда играл' : 'Когда играл и бросил'}</span>
            {!old && (
              <div class="row" style={{ gap: 10 }}>
                <Field label="Начал" id="d1" type="date" mono value={start} max={end} onInput={(v) => v && setStart(v)} />
                <Field label={res.online ? 'Забросил' : 'Бросил'} id="d2" type="date" mono value={end} max={todayISO()} onInput={(v) => v && setEnd(v)} />
              </div>
            )}
            {old
              ? <span class="small muted" style={{ fontSize: 13 }}>Без дат: часы попадут в общий счёт игры, но не в статистику по месяцам и годам.</span>
              : <span class="small muted" style={{ fontSize: 13 }}>Часы распределятся по всему периоду — в статистику года попадёт только его доля.</span>}
            <ToggleRow on={old} onChange={setOld} icon="cal" title="Давно, не помню даты" sub="не пойдёт в статистику по времени" />
          </div>
          <div class="card glass">
            <Stepper id="h" label="Успел наиграть" value={hours} onChange={setHours} unit="ч" max={20000} />
            {!res.online && <Field label="HLTB · основной сюжет, часов (можно потом)" id="hlt" mono value={hl} onInput={setHl} placeholder="например, 28" suffix="ч" inputMode="decimal" />}
          </div>
        </>
      ) : (
        <>
          <div class="between sec-head" style={{ marginBottom: -4 }}>
            <h2 class="sec">Прохождения</h2>
            <span class="xs muted">каждое со своими датами</span>
          </div>
          <PtRows pts={pts} setPts={setPts} />
          <button class="btn btn-glass" style={{ flex: 'none' }} onClick={() => { const last = pts[pts.length - 1]; setPts([...pts, { start: isoAddDays(todayISO(), -14), end: todayISO(), hours: Number(last && last.hours) || 20, old: false }]); }}>
            <Icon n="plus" size={16} sw={2.2} />Ещё прохождение
          </button>
          <div class="card glass">
            <Field label="HLTB · основной сюжет, часов (можно потом)" id="hlt" mono value={hl} onInput={setHl} placeholder="например, 28" suffix="ч" inputMode="decimal" />
          </div>
        </>
      )}
      <div class="card glass">
        <div class="between"><span class="lbl">Оценка</span><span class="mono xs muted">1–10, можно не ставить</span></div>
        <Rating value={rating} onChange={setRating} />
      </div>
      <div class="card glass">
        <div class="field">
          <label class="lbl" for="imp">{dropped ? 'Почему бросил, впечатления (можно потом)' : 'Впечатления (можно потом)'}</label>
          <textarea id="imp" class="ta" value={imp} onInput={(e) => setImp(e.currentTarget.value)} placeholder={dropped ? 'Пара строк для себя' : 'Что понравилось, что нет'} />
        </div>
        <ToggleRow on={fav} onChange={setFav} icon="heart" color="#FF3D5E" fillIcon title="Любимая" />
        {!dropped && <ToggleRow on={rp} onChange={setRp} icon="book" color="#6CC0FF" fillIcon title="Хочу перепройти" />}
      </div>
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={save}>
        <Icon n="check" size={18} sw={2.2} />{dropped ? (res.online ? 'Добавить как заброшенную' : 'Добавить в «Брошено»') : 'Добавить в «Пройдено»'}
      </button>
    </div>
  );
}

export function AddManual({ name = '' }) {
  const [title, setTitle] = useState(name);
  const [genre, setGenre] = useState('');
  const [status, setStatus] = useState('wish');
  const [platform, setPlatform] = useState('');
  const [cover, setCover] = useState(null);
  const fileRef = useRef(null);

  const pick = (e) => {
    const f = e.currentTarget.files && e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      // downscale to keep the diary file small
      const w = 400;
      const h = Math.round((img.height / img.width) * w);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      setCover(c.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const draft = () => ({ name: title.trim(), genres: genre.trim() ? [genre.trim()] : [], coverData: cover });

  const save = async () => {
    if (status === 'done' || status === 'dropped') return replace('addDone', { res: draft(), platform, mode: status });
    const online = status === 'rotation';
    const { coverData, ...rest } = draft();
    const g = addGame({
      ...rest,
      status,
      type: online ? 'online' : 'game',
      platform,
      playthroughs: status === 'playing' ? [{ start: todayISO(), end: null, hours: null }] : [],
    });
    if (coverData) {
      const patch = await saveCoverBase64(g.id, coverData.split(',')[1]).catch(() => null);
      if (patch) updateGame(g.id, patch);
    }
    toast(`${g.name} добавлена`);
    replace('game', { id: g.id });
  };

  return (
    <div class="screen no-nav" style={{ gap: 14 }}>
      <div class="between" style={{ alignItems: 'center' }}>
        <Back onClick={back} />
        <span style={{ fontFamily: 'var(--unb)', fontSize: 15, fontWeight: 600 }}>Добавить вручную</span>
        <span style={{ width: 44 }} />
      </div>
      <Info>Для игр, которых нет в каталоге. Описание и похожие игры для неё не подтянутся.</Info>
      <button class="row glass" style={{ gap: 14, padding: 12, borderRadius: 18, border: '1px dashed rgba(255,255,255,0.22)', textAlign: 'left', color: 'inherit' }} onClick={() => fileRef.current.click()}>
        <span class="cover" style={{ width: 64, height: 86, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8C93A1' }}>
          {cover ? <img src={cover} alt="" /> : <Icon n="image" size={24} />}
        </span>
        <span class="col" style={{ gap: 3 }}><b style={{ fontSize: 14 }}>Обложка</b><span class="small muted">{cover ? 'выбрана · нажми, чтобы заменить' : 'выбрать из галереи телефона'}</span></span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
      <Field label="Название" id="mn" value={title} onInput={setTitle} placeholder="Как называется игра" />
      <Field label="Жанр" id="mg" value={genre} onInput={setGenre} placeholder="Например, RPG" />
      <div class="col" style={{ gap: 8 }}>
        <span class="lbl">Статус</span>
        <ChipGroup value={status} onChange={setStatus} options={[['wish', 'Хочу пройти'], ['playing', 'Прохожу'], ['done', 'Пройдено'], ['dropped', 'Брошено'], ['rotation', 'Сетевая']]} />
      </div>
      <div class="col" style={{ gap: 8 }}>
        <span class="lbl">Платформа</span>
        <PlatformPicker value={platform} onChange={setPlatform} />
      </div>
      <button class="btn btn-primary" style={{ flex: 'none' }} disabled={!title.trim()} onClick={save}>
        {status === 'done' || status === 'dropped' ? 'Дальше: даты, часы, оценка' : <><Icon n="plus" size={18} sw={2.2} />Добавить</>}
      </button>
    </div>
  );
}
