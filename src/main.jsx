import { render } from 'preact';
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/600.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles.css';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from './App.jsx';
import { load, back, flush, allGames, getDb } from './lib/store.js';
import { enrich } from './lib/enrich.js';

load().then(() => {
  render(<App />, document.getElementById('app'));
  // Background top-up of data for games added offline or before keys were set.
  if (getDb().settings.rawgKey) {
    const todo = allGames().filter((g) => g.extId && (!g.enrichedAt || !g.coverFile));
    (async () => {
      for (const g of todo) {
        await enrich(g.id).catch(() => {});
      }
    })();
  }
});

if (Capacitor.isNativePlatform()) {
  SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {});
  CapApp.addListener('backButton', () => {
    if (!back()) CapApp.exitApp();
  });
  CapApp.addListener('pause', () => flush());
}
window.addEventListener('beforeunload', () => flush());
