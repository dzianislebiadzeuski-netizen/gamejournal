import { useRef, useState } from 'preact/hooks';
import { back, replace, addGame, toast, updateGame } from '../lib/store.js';
import { Icon, Back, Field, Stepper, Rating, ToggleRow, ChipGroup, Info } from '../ui/kit.jsx';
import { PLATFORMS } from '../lib/model.js';
import { todayISO, placeholderGradient } from '../lib/util.js';
import { coverUrl } from '../lib/igdb.js';
import { enrich, saveCoverBase64 } from '../lib/enrich.js';

function Header({ res }) {
  const src = res.coverData || coverUrl(res.coverId, 't_cover_small');
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

// "Уже прошёл": dates (or "давно"), hours, times, rating, impressions.
export function AddDone({ res, platform }) {
  const [old, setOld] = useState(false);
  const [start, setStart] = useState(todayISO(new Date(Date.now() - 14 * 86400000)));
  const [end, setEnd] = useState(todayISO());
  const [hours, setHours] = useState(20);
  const [times, setTimes] = useState(1);
  const [rating, setRating] = useState(null);
  const [imp, setImp] = useState('');
  const [fav, setFav] = useState(false);
  const [rp, setRp] = useState(false);

  const save = async () => {
    const h = Number(hours) || 0;
    const n = Math.max(1, Number(times) || 1);
    const pts = [];
    for (let i = 0; i < n - 1; i++) pts.push({ start: null, end: null, hours: h, old: true });
    pts.push(old ? { start: null, end: null, hours: h, old: true } : { start, end, hours: h, old: false });
    const { coverData, ...rest } = res;
    const g = addGame({
      ...rest,
      igdbId: res.igdbId || undefined,
      type: 'game',
      status: 'done',
      platform: platform || '',
      rating,
      impressions: imp.trim(),
      fav,
      replay: rp,
      playthroughs: pts,
    });
    if (coverData) {
      const patch = await saveCoverBase64(g.id, coverData.split(',')[1]).catch(() => null);
      if (patch) updateGame(g.id, patch);
    }
    if (g.igdbId) enrich(g.id);
    toast(`${g.name} — в «Пройдено»`);
    replace('game', { id: g.id });
  };

  return (
    <div class="screen no-nav" style={{ gap: 14 }}>
      <div class="between" style={{ alignItems: 'center' }}>
        <Back onClick={back} />
        <span style={{ fontFamily: 'var(--unb)', fontSize: 15, fontWeight: 600 }}>Уже прошёл</span>
        <span style={{ width: 44 }} />
      </div>
      <Header res={{ ...res, platform }} />
      <div class="card glass">
        <span class="lbl">Даты прохождения</span>
        {!old && (
          <div class="row" style={{ gap: 10 }}>
            <Field label="Начал" id="d1" type="date" mono value={start} max={end} onInput={setStart} />
            <Field label="Закончил" id="d2" type="date" mono value={end} max={todayISO()} onInput={setEnd} />
          </div>
        )}
        {old && <span class="small muted" style={{ fontSize: 13 }}>Без дат: игра попадёт в «Пройдено», но не в статистику по месяцам и годам.</span>}
        <ToggleRow on={old} onChange={setOld} icon="cal" title="Давно, не помню даты" sub="не пойдёт в статистику по времени" />
      </div>
      <div class="card glass">
        <div class="row" style={{ gap: 10 }}>
          <Stepper id="h" label="Часов" value={hours} onChange={setHours} unit="ч" max={2000} />
          <Stepper id="n" label="Раз пройдено" value={times} onChange={setTimes} min={1} max={50} unit="×" />
        </div>
      </div>
      <div class="card glass">
        <div class="between"><span class="lbl">Оценка</span><span class="mono xs muted">1–10, можно не ставить</span></div>
        <Rating value={rating} onChange={setRating} />
      </div>
      <div class="card glass">
        <div class="field">
          <label class="lbl" for="imp">Впечатления (можно потом)</label>
          <textarea id="imp" class="ta" value={imp} onInput={(e) => setImp(e.currentTarget.value)} placeholder="Что понравилось, что нет" />
        </div>
        <ToggleRow on={fav} onChange={setFav} icon="heart" color="#FF3D5E" fillIcon title="Любимая" />
        <ToggleRow on={rp} onChange={setRp} icon="book" color="#6CC0FF" fillIcon title="Хочу перепройти" />
      </div>
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={save}><Icon n="check" size={18} sw={2.2} />Добавить в «Пройдено»</button>
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
    if (status === 'done') return replace('addDone', { res: draft(), platform });
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
      <Info>Для игр, которых нет в IGDB. Описание и похожие игры для неё не подтянутся.</Info>
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
        <ChipGroup value={status} onChange={setStatus} options={[['wish', 'Хочу пройти'], ['playing', 'Прохожу'], ['done', 'Пройдено'], ['rotation', 'Сетевая']]} />
      </div>
      <div class="col" style={{ gap: 8 }}>
        <span class="lbl">Платформа</span>
        <ChipGroup value={platform} onChange={(v) => setPlatform(v === platform ? '' : v)} options={PLATFORMS} />
      </div>
      <button class="btn btn-primary" style={{ flex: 'none' }} disabled={!title.trim()} onClick={save}>
        {status === 'done' ? 'Дальше: даты, часы, оценка' : <><Icon n="plus" size={18} sw={2.2} />Добавить</>}
      </button>
    </div>
  );
}
