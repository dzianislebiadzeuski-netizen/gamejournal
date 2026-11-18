import { useEffect, useRef, useState } from 'preact/hooks';
import { back, go, openSheet, findByExt, useStore } from '../lib/store.js';
import { Icon, Back, Info } from '../ui/kit.jsx';
import { search, hasKeys, coverUrl } from '../lib/catalog.js';
import { STATUS } from '../lib/model.js';
import { placeholderGradient } from '../lib/util.js';

let lastQuery = '';
let lastResults = [];

export function Search() {
  useStore();
  const [q, setQ] = useState(lastQuery);
  const [res, setRes] = useState(lastResults);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inp = useRef(null);
  const seq = useRef(0);
  const keys = hasKeys();

  useEffect(() => { if (keys) setTimeout(() => inp.current && inp.current.focus(), 50); }, []);

  useEffect(() => {
    lastQuery = q;
    if (!keys) return;
    const text = q.trim();
    if (text.length < 2) { setRes([]); setErr(''); return; }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await search(text);
        if (my !== seq.current) return;
        setRes(r);
        lastResults = r;
        setErr('');
      } catch (e) {
        if (my === seq.current) setErr(e.message || 'Ошибка поиска');
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div class="screen no-nav">
      <div class="row" style={{ gap: 10 }}>
        <Back onClick={back} />
        <label class="search">
          <Icon n="search" size={18} sw={2} color="#6CC0FF" />
          <input ref={inp} type="search" aria-label="Поиск игры" placeholder="Название игры" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
          {busy && <span class="spinner" />}
        </label>
      </div>

      {!keys && (
        <div class="col">
          <Info>Чтобы искать игры, обложки и описания, подключи бесплатный ключ каталога RAWG.</Info>
          <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => go('onboardKey')}><Icon n="key" size={18} />Подключить каталог</button>
        </div>
      )}
      {err && <div class="info red"><Icon n="info" size={16} sw={2} /><span>{err}</span></div>}
      {res.length > 0 && <div class="kicker">Найдено в RAWG · {res.length}</div>}

      <div class="col">
        {res.map((r) => {
          const ex = findByExt(r.extId);
          return (
            <button class={`res ${ex ? 'in' : 'glass'}`} onClick={() => (ex ? go('game', { id: ex.id }) : openSheet('add', { res: r }))}>
              <div class="cover" style={{ background: r.cover ? '#1a1d25' : placeholderGradient(r.name) }}>
                {r.cover && <img src={coverUrl(r.cover, 'small')} alt="" loading="lazy" />}
              </div>
              <span class="t">
                <b>{r.name}</b>
                <span class="mono xs muted">{[r.year, (r.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ')}</span>
                {ex && <span class="plain" style={{ alignSelf: 'flex-start', fontSize: 11 }}>Уже в дневнике · {STATUS[ex.status]}</span>}
              </span>
              {ex ? <Icon n="chev" size={18} sw={2.2} color="#8C93A1" /> : <span class="plus-sq"><Icon n="plus" size={18} sw={2.2} /></span>}
            </button>
          );
        })}
      </div>

      {keys && q.trim().length >= 2 && !busy && !res.length && !err && <div class="center small muted">Ничего не нашлось.</div>}
      {res.length > 0 && <div class="center xs muted">Данные и изображения: <a href="https://rawg.io">RAWG</a></div>}
      <div class="center small muted" style={{ fontSize: 13 }}>
        Нет нужной игры? <button class="link" style={{ fontSize: 13 }} onClick={() => go('addManual', { name: q.trim() })}>Добавить вручную</button>
      </div>
    </div>
  );
}
