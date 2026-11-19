import { useEffect, useRef, useState } from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useStore, back, go, setSettings, exportJson, importJson, toast } from '../lib/store.js';
import { Icon, ToggleRow, Info, Nav } from '../ui/kit.jsx';
import { fmtDate, todayISO, gamesWord } from '../lib/util.js';
import { ensureRuModel, ruModelDownloaded, translateGame } from '../lib/enrich.js';
import { allGames } from '../lib/store.js';

export function Settings() {
  const { db } = useStore();
  const s = db.settings;
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // parsed text waiting for confirm
  const [busy, setBusy] = useState(false);
  const count = Object.keys(db.games).length;
  const [model, setModel] = useState('?'); // '?', 'yes', 'no', 'busy', 'fail'
  useEffect(() => { ruModelDownloaded().then((ok) => setModel(ok ? 'yes' : 'no')); }, []);
  const untranslated = Object.values(db.games).filter((g) => g.summary && g.summary.en && !g.summary.ru).length;
  const getModel = async () => {
    setModel('busy');
    try {
      await ensureRuModel();
      setModel('yes');
      for (const g of allGames().filter((x) => x.summary && x.summary.en && !x.summary.ru)) await translateGame(g.id);
      toast('Описания переведены');
    } catch {
      setModel('fail');
    }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const text = exportJson();
      const name = `gamejournal-${todayISO()}.json`;
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
        const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
        await Share.share({ title: 'Резервная копия GameJournal', files: [uri], dialogTitle: 'Куда сохранить копию?' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = name;
        a.click();
      }
      setSettings({ lastBackup: todayISO() });
      toast('Копия готова');
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) toast('Не получилось сохранить копию');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const f = e.currentTarget.files && e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!f) return;
    setPending(await f.text());
  };

  const doImport = () => {
    try {
      const n = importJson(pending);
      toast(`Восстановлено: ${gamesWord(n)}`);
    } catch (e) {
      toast(e.message || 'Файл не подошёл');
    }
    setPending(null);
  };

  return (
    <>
    <div class="screen" style={{ gap: 14 }}>
      <div>
        <div class="kicker c">GameJournal 1.3</div>
        <h1 class="title">Настройки</h1>
      </div>

      <div class="card glass tint">
        <span class="lbl">Резервная копия</span>
        <span class="text2" style={{ fontSize: 13, lineHeight: 1.45 }}>Весь дневник в одном файле. Отправь его себе в Telegram или на Google Диск.</span>
        <div class="row">
          <button class="btn btn-glass" disabled={busy} onClick={doExport}><Icon n="down" size={16} sw={2} />Сохранить</button>
          <button class="btn btn-glass" onClick={() => fileRef.current.click()}><Icon n="up" size={16} sw={2} />Восстановить</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json,text/plain" style={{ display: 'none' }} onChange={onFile} />
        {pending ? (
          <div class="info red" style={{ flexDirection: 'column' }}>
            <span>Текущий дневник ({gamesWord(count)}) заменится данными из файла. Продолжить?</span>
            <div class="row">
              <button class="btn btn-glass btn-sm" onClick={() => setPending(null)}>Отмена</button>
              <button class="btn btn-red btn-sm" onClick={doImport}>Заменить</button>
            </div>
          </div>
        ) : (
          <span class="mono xs muted">{s.lastBackup ? `последняя копия: ${fmtDate(s.lastBackup, true)}` : 'копий ещё не было'} · {gamesWord(count)}</span>
        )}
      </div>

      <div class="card glass" style={{ gap: 8 }}>
        <span class="lbl">Каталог игр</span>
        <div class="row" style={{ minHeight: 56, gap: 12 }}>
          <Icon n="key" color="#A9B0BD" />
          <span class="col" style={{ flex: 1, gap: 2 }}><b style={{ fontSize: 14 }}>RAWG</b><span class="small muted">{s.rawgKey ? `ключ ··· ${s.rawgKey.slice(-4)}` : 'не подключён'}</span></span>
          {s.rawgKey
            ? <span class="status st-wish"><Icon n="check" size={13} sw={2.4} />Подключено</span>
            : <span class="status st-dropped">Нет ключа</span>}
        </div>
        <button class="btn btn-glass btn-sm" style={{ flex: 'none' }} onClick={() => go('onboardKey')}>{s.rawgKey ? 'Изменить ключ' : 'Подключить'}</button>
      </div>

      <div class="card glass" style={{ gap: 10 }}>
        <span class="lbl">Описания игр</span>
        <div class="seg" role="radiogroup" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {[['ru', 'Русский'], ['en', 'Оригинал']].map(([k, l]) => (
            <button role="radio" aria-checked={s.lang === k ? 'true' : 'false'} class={s.lang === k ? 'on' : ''} onClick={() => setSettings({ lang: k })}>{l}</button>
          ))}
        </div>
        {Capacitor.isNativePlatform() && (model === 'yes'
          ? <span class="mono xs muted">языковой пакет скачан{untranslated ? ` · без перевода: ${untranslated}` : ''}</span>
          : <button class="btn btn-glass btn-sm" style={{ flex: 'none' }} disabled={model === 'busy'} onClick={getModel}>
              {model === 'busy' ? <><span class="spinner" />Скачиваю…</> : <><Icon n="down" size={16} sw={2} />Скачать перевод (~30 МБ)</>}
            </button>)}
        {model === 'fail' && <span class="small muted">Не получилось скачать. Проверь интернет и попробуй ещё раз.</span>}
        {model === 'yes' && untranslated > 0 && <button class="btn btn-glass btn-sm" style={{ flex: 'none' }} onClick={getModel}>Перевести описания ({untranslated})</button>}
      </div>

      <div class="card glass" style={{ gap: 10 }}>
        <span class="lbl">Статистика</span>
        <ToggleRow on={s.countOnline} onChange={(v) => setSettings({ countOnline: v })} icon="pad" color="#6CC0FF" title="Учитывать сетевые игры" sub="в «в день» и часах за год" />
      </div>

      {!Capacitor.isNativePlatform() && <Info>Это веб-версия для проверки. Поиск по каталогу работает только в приложении на телефоне.</Info>}
      <div class="center mono xs muted" style={{ paddingBottom: 10 }}>GameJournal 1.3 · данные только на телефоне</div>
    </div>
    <Nav active="settings" />
    </>
  );
}
