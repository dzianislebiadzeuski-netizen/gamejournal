import { useEffect, useState } from 'preact/hooks';
import { coverSrc } from '../lib/enrich.js';
import { placeholderGradient } from '../lib/util.js';
import { STATUS, PLATFORM_META } from '../lib/model.js';
import { closeSheet, tab, useStore, hideToast } from '../lib/store.js';

const P = {
  pad: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6l-.9 8.1a2.5 2.5 0 0 0 4.6 1.5L7.5 16h9l1.1 2.2a2.5 2.5 0 0 0 4.6-1.5l-.9-8.1a4 4 0 0 0-4-3.6z"/>',
  lib: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  stat: '<path d="M3 20h18M6 16v-5M11 16V5M16 16v-8M21 16v-3"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 5.5 3.7 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>',
  book: '<path d="M6 3.5h12v17l-6-4-6 4z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1.5-5-.5-8z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  console: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><circle cx="12" cy="7" r="1.6"/><path d="M10 17h4"/>',
  cards: '<rect x="7.5" y="3.5" width="11" height="15" rx="2" transform="rotate(8 13 11)"/><rect x="4.5" y="5" width="11" height="15" rx="2" transform="rotate(-6 10 12.5)"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  leave: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  device: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M7 12h3M8.5 10.5v3M15.5 12h.01M17.5 11h.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20 16l-5-5-8 8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
};

export function Icon({ n, size = 20, sw = 1.9, fill = 'none', color = 'currentColor', class: cls }) {
  return (
    <svg aria-hidden="true" class={cls} width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} stroke-width={sw}
      stroke-linecap="round" stroke-linejoin="round" dangerouslySetInnerHTML={{ __html: P[n] }} />
  );
}

export function Glows() {
  return <div class="glows" aria-hidden="true"><i class="g1" /><i class="g2" /><i class="g3" /><i class="g4" /></div>;
}

export function Cover({ g, size, style, class: cls, children, label = true }) {
  const [err, setErr] = useState(false);
  const src = !err ? coverSrc(g, size) : null;
  useEffect(() => setErr(false), [g && (g.coverFile || g.cover || g.coverData)]);
  return (
    <div class={`cover ${cls || ''}`} style={{ background: src ? '#1a1d25' : placeholderGradient(g ? g.name : ''), ...style }}>
      {src ? <img src={src} alt="" loading="lazy" onError={() => setErr(true)} /> : label && <div class="ph" aria-hidden="true">{g ? g.name : ''}</div>}
      {children}
    </div>
  );
}

export function Status({ s, label }) {
  return <span class={`status st-${s}`}><i />{label || STATUS[s]}</span>;
}

export function PlatformBadge({ p, small }) {
  if (!p) return null;
  const m = PLATFORM_META[p];
  if (!m) return <span class="plain">{p}</span>;
  return (
    <span class={`pf ${small ? 'sm' : ''}`} style={{ background: m.color }}>
      <Icon n={m.icon} size={small ? 12 : 14} sw={2} />{p}
    </span>
  );
}

export function PlatformPicker({ value, onChange }) {
  return (
    <div class="chips">
      {Object.keys(PLATFORM_META).map((p) => {
        const on = value === p;
        const m = PLATFORM_META[p];
        return (
          <button class="chip pfc" aria-pressed={on ? 'true' : 'false'} onClick={() => onChange(on ? '' : p)}
            style={on ? { background: m.color, borderColor: m.color, color: '#fff' } : {}}>
            <Icon n={m.icon} size={16} sw={2} color={on ? '#fff' : m.color === '#4f5d7a' ? '#9aa6c0' : m.color} />{p}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ on }) {
  return <span class={`switch ${on ? 'on' : ''}`} aria-hidden="true"><i /></span>;
}

export function ToggleRow({ on, onChange, icon, color = '#C3C8D2', title, sub, fillIcon }) {
  return (
    <button class="trow" aria-pressed={on ? 'true' : 'false'} onClick={() => onChange(!on)}>
      <Icon n={icon} color={color} fill={fillIcon && on ? color : 'none'} />
      <span class="t"><b>{title}</b>{sub && <span>{sub}</span>}</span>
      <Switch on={on} />
    </button>
  );
}

export function Rating({ value, onChange }) {
  return (
    <div class="rating" role="radiogroup" aria-label="Оценка">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <button role="radio" aria-checked={value === i ? 'true' : 'false'} class={value === i ? 'on' : ''} onClick={() => onChange(value === i ? null : i)}>{i}</button>
      ))}
    </div>
  );
}

export function Stepper({ label, value, onChange, step = 1, min = 0, max = 9999, unit, id }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div class="field">
      {label && <label class="lbl" for={id}>{label}</label>}
      <div class="stepper">
        <button aria-label="Меньше" onClick={() => set((Number(value) || 0) - step)}><Icon n="minus" size={18} sw={2.2} /></button>
        <span class="row" style={{ gap: 0 }}>
          <input id={id} inputMode="decimal" value={value} style={{ width: `${Math.max(1, String(value ?? '').length) + 0.4}ch`, minWidth: '1.6ch' }} onInput={(e) => {
            const v = e.currentTarget.value.replace(',', '.');
            if (v === '') return onChange('');
            const n = Number(v);
            if (!isNaN(n)) onChange(n);
          }} />
          {unit && <span class="u">{unit}</span>}
        </span>
        <button aria-label="Больше" onClick={() => set((Number(value) || 0) + step)}><Icon n="plus" size={18} sw={2.2} /></button>
      </div>
    </div>
  );
}

export function ChipGroup({ options, value, onChange, pill }) {
  return (
    <div class="chips">
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button class={`chip ${pill ? 'pill' : ''} ${value === v ? 'on' : ''}`} aria-pressed={value === v ? 'true' : 'false'} onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
  );
}

export function Field({ label, id, icon, value, onInput, type = 'text', placeholder, suffix, mono, max, inputMode }) {
  return (
    <div class="field">
      <label class="lbl" for={id}>{label}</label>
      <div class="inp">
        {icon && <Icon n={icon} size={18} />}
        <input id={id} type={type} value={value} max={max} placeholder={placeholder} inputMode={inputMode} class={mono ? 'mono' : ''} onInput={(e) => onInput(e.currentTarget.value)} />
        {suffix && <span class="mono muted small">{suffix}</span>}
      </div>
    </div>
  );
}

export function Info({ children, icon = 'info', red }) {
  return <div class={`info ${red ? 'red' : ''}`}><Icon n={icon} size={16} sw={2} /><span>{children}</span></div>;
}

export function Section({ title, right, children }) {
  return (
    <div class="col">
      <div class="between sec-head"><h2 class="sec">{title}</h2>{right}</div>
      {children}
    </div>
  );
}

export function Cell({ l, v, s, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return <Tag class="cell" onClick={onClick}><span class="l">{l}</span><span class="v">{v}</span>{s && <span class="s">{s}</span>}</Tag>;
}

export function Sheet({ title, sub, children, onClose = closeSheet }) {
  return (
    <>
      <div class="backdrop" onClick={onClose} />
      <div class="sheet" role="dialog" aria-label={title}>
        <div class="grab" aria-hidden="true" />
        <div class="between" style={{ alignItems: 'flex-start' }}>
          <div class="col" style={{ gap: 4 }}>
            <h2>{title}</h2>
            {sub && <span class="small text2" style={{ fontSize: 13 }}>{sub}</span>}
          </div>
          <button class="x" aria-label="Закрыть" onClick={onClose}><Icon n="x" size={18} sw={2} /></button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Nav({ active }) {
  const items = [['now', 'pad', 'Сейчас'], ['library', 'lib', 'Библиотека'], ['discover', 'cards', 'Подборка'], ['stats', 'stat', 'Статистика'], ['settings', 'gear', 'Настройки']];
  return (
    <nav class="nav">
      {items.map(([k, ic, l]) => (
        <button class={active === k ? 'on' : ''} aria-current={active === k ? 'page' : undefined} onClick={() => tab(k)}>
          <Icon n={ic} size={22} sw={1.8} />{l}
        </button>
      ))}
    </nav>
  );
}

export function Toast() {
  const { ui } = useStore();
  if (!ui.toast) return null;
  const { text, action } = ui.toast;
  return (
    <div class="toast" role="status">
      <Icon n="check" size={18} sw={2.4} color="#B394FF" />
      <span>{text}</span>
      {action && <button onClick={() => { hideToast(); action.fn(); }}>{action.label}</button>}
    </div>
  );
}

export function Back({ onClick, label = 'Назад' }) {
  return <button class="round" aria-label={label} onClick={onClick}><Icon n="back" size={20} sw={2.2} /></button>;
}

// re-render every second while mounted (for live timers)
export function useTick(active = true) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}
