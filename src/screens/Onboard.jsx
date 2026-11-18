import { useState } from 'preact/hooks';
import { getDb, setSettings, tab, back, toast, replace } from '../lib/store.js';
import { Icon, Field, Back } from '../ui/kit.jsx';
import { fetchToken } from '../lib/igdb.js';

function Feature({ icon, color, title, sub }) {
  return (
    <div class="feat glass">
      <span class="ic" style={{ color }}><Icon n={icon} size={22} /></span>
      <span class="col" style={{ gap: 3 }}><b style={{ fontSize: 15 }}>{title}</b><span class="text2" style={{ fontSize: 13, lineHeight: 1.4 }}>{sub}</span></span>
    </div>
  );
}

export function Onboard() {
  return (
    <div class="screen no-nav">
      <div style={{ height: 40 }} />
      <div class="kicker" style={{ color: '#9ED3FF', letterSpacing: '0.16em', fontSize: 12 }}>Дневник геймера</div>
      <h1 style={{ fontFamily: 'var(--unb)', fontSize: 44, fontWeight: 700, lineHeight: 1.02, letterSpacing: '-0.02em' }}>Game<br />Journal</h1>
      <p class="text2" style={{ fontSize: 16, lineHeight: 1.5 }}>Что прошёл, что бросил, что впереди — и сколько часов на это ушло.</p>
      <div class="col" style={{ marginTop: 8 }}>
        <Feature icon="lib" color="#6CC0FF" title="Вся библиотека" sub="пройдено, планы, отложено, брошено, любимые" />
        <Feature icon="clock" color="#FF7A92" title="Таймер сессий" sub="«Сел играть» — и часы считаются сами" />
        <Feature icon="stat" color="#B394FF" title="Статистика" sub="сколько в день, за год, любимые жанры" />
      </div>
      <div style={{ height: 14 }} />
      <button class="btn btn-primary" style={{ flex: 'none' }} onClick={() => replace('onboardKey', { first: true })}>Начать</button>
      <div class="center small muted">Все данные хранятся только на этом телефоне</div>
    </div>
  );
}

export function OnboardKey({ first }) {
  const s = getDb().settings;
  const [id, setId] = useState(s.igdbId || '');
  const [secret, setSecret] = useState(s.igdbSecret || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const finish = () => {
    setSettings({ onboarded: true });
    if (first) tab('now');
    else back();
  };

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      const t = await fetchToken(id.trim(), secret.trim());
      setSettings({ igdbId: id.trim(), igdbSecret: secret.trim(), ...t });
      toast('База игр подключена');
      finish();
    } catch (e) {
      setErr(e.message || 'Не получилось проверить ключ');
    } finally {
      setBusy(false);
    }
  };

  const Step = ({ n, children }) => (
    <div class="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      <span class="stepn">{n}</span>
      <span style={{ fontSize: 14, lineHeight: 1.5, color: '#D6DAE2' }}>{children}</span>
    </div>
  );

  return (
    <div class="screen no-nav">
      <Back onClick={() => (first ? replace('onboard') : back())} />
      <h1 style={{ fontFamily: 'var(--unb)', fontSize: 24, fontWeight: 600, lineHeight: 1.2 }}>Подключим базу игр</h1>
      <p class="text2" style={{ fontSize: 14, lineHeight: 1.5 }}>Обложки, описания, жанры и похожие игры берутся из IGDB. Нужен бесплатный ключ — один раз, минут пять.</p>
      <div class="card glass" style={{ gap: 14 }}>
        <Step n="1">Зайди на <b>dev.twitch.tv/console</b> и войди через Twitch (нужна двухфакторка)</Step>
        <Step n="2"><b>Register Your Application</b>: любое имя, OAuth Redirect URL — <span class="mono">http://localhost</span>, категория — Application Integration, тип клиента — Confidential</Step>
        <Step n="3">Скопируй <b>Client ID</b>, нажми <b>New Secret</b> и скопируй его</Step>
      </div>
      <Field label="Client ID" id="cid" icon="key" mono value={id} onInput={setId} placeholder="abcd1234…" />
      <Field label="Client Secret" id="cs" icon="key" mono type="password" value={secret} onInput={setSecret} placeholder="••••••••" />
      {err && <div class="info red"><Icon n="info" size={16} sw={2} /><span>{err}</span></div>}
      <button class="btn btn-primary" style={{ flex: 'none' }} disabled={busy || !id.trim() || !secret.trim()} onClick={save}>
        {busy ? <span class="spinner" /> : <Icon n="check" size={18} sw={2.2} />}Проверить и сохранить
      </button>
      <button class="link center" style={{ fontSize: 13, minHeight: 44 }} onClick={finish}>{first ? 'Пропустить — добавлю ключ позже' : 'Отмена'}</button>
      <div class="center small muted">Ключ хранится только на телефоне и не попадает в резервную копию.</div>
    </div>
  );
}
