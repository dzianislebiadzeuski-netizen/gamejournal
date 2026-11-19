// The ML Kit translation plugin only downloads language models over Wi-Fi.
// GameJournal is mostly used on mobile data, so allow any network.
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '..', 'node_modules', '@capacitor-mlkit', 'translation', 'android', 'src', 'main', 'java',
  'io', 'capawesome', 'capacitorjs', 'plugins', 'mlkit', 'translation', 'Translation.java');
if (!fs.existsSync(f)) process.exit(0);
const src = fs.readFileSync(f, 'utf8');
const out = src.split('new DownloadConditions.Builder().requireWifi().build()').join('new DownloadConditions.Builder().build()');
if (out !== src) {
  fs.writeFileSync(f, out);
  console.log('[patch-mlkit] Wi-Fi requirement removed');
}
