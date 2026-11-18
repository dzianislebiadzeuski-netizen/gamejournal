import { useStore } from './lib/store.js';
import { Glows, Toast } from './ui/kit.jsx';
import { Now } from './screens/Now.jsx';
import { Library } from './screens/Library.jsx';
import { Stats } from './screens/Stats.jsx';
import { Settings } from './screens/Settings.jsx';
import { Onboard, OnboardKey } from './screens/Onboard.jsx';
import { Search } from './screens/Search.jsx';
import { AddDone, AddManual } from './screens/Add.jsx';
import { Game } from './screens/Game.jsx';
import { FinishDone } from './screens/FinishDone.jsx';
import { SHEETS } from './screens/sheets.jsx';

const SCREENS = {
  now: Now,
  library: Library,
  stats: Stats,
  settings: Settings,
  onboard: Onboard,
  onboardKey: OnboardKey,
  search: Search,
  addDone: AddDone,
  addManual: AddManual,
  game: Game,
  finishDone: FinishDone,
};

export function App() {
  const { ui } = useStore();
  const top = ui.stack[ui.stack.length - 1];
  const Screen = SCREENS[top.name] || Now;
  const Sh = ui.sheet ? SHEETS[ui.sheet.name] : null;
  return (
    <div class="app">
      <Glows />
      <div class={`page page-${ui.nav}`} key={ui.navId}>
        <Screen {...(top.params || {})} />
      </div>
      {Sh && <Sh key={ui.sheet.name} {...ui.sheet.params} />}
      <Toast />
    </div>
  );
}
