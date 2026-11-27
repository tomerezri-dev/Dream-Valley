// Settings persisted as JSON in the user-data folder. Secrets (API keys) are
// encrypted with the OS keychain via Electron's safeStorage when available.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const SECRET_KEYS = ['claudeApiKey', 'languageToolKey'];

const DEFAULTS = {
  engine: 'languagetool', // 'languagetool' | 'claude' | 'offline'
  language: 'auto',
  preferredVariants: 'en-US',
  languageToolUrl: '',
  languageToolUser: '',
  languageToolKey: '',
  claudeApiKey: '',
  claudeModel: 'claude-opus-5-5',
  hotkey: 'CommandOrControl+Shift+G',
  liveCheck: true,
  styleSuggestions: true,
  pickyMode: false,
  launchAtLogin: false,
  closePopupAfterReplace: true,
  theme: 'system',
  dictionary: [],
  disabledRules: [],
};

let cache;
const file = () => path.join(app.getPath('userData'), 'settings.json');

function encrypt(v) {
  if (!v) return '';
  if (safeStorage.isEncryptionAvailable()) return 'enc:' + safeStorage.encryptString(v).toString('base64');
  return 'b64:' + Buffer.from(v, 'utf8').toString('base64');
}

function decrypt(v) {
  if (!v) return '';
  try {
    if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
    if (v.startsWith('b64:')) return Buffer.from(v.slice(4), 'base64').toString('utf8');
  } catch {
    return '';
  }
  return v;
}

function load() {
  if (cache) return cache;
  let stored = {};
  try {
    stored = JSON.parse(fs.readFileSync(file(), 'utf8'));
  } catch {}
  for (const k of SECRET_KEYS) stored[k] = decrypt(stored[k]);
  cache = { ...DEFAULTS, ...stored };
  return cache;
}

function save(patch) {
  cache = { ...load(), ...patch };
  const out = { ...cache };
  for (const k of SECRET_KEYS) out[k] = encrypt(out[k]);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(out, null, 2));
  return cache;
}

// What the renderer is allowed to see: secrets are replaced with a flag.
function publicView() {
  const s = { ...load() };
  for (const k of SECRET_KEYS) {
    s[`has_${k}`] = Boolean(s[k]);
    delete s[k];
  }
  return s;
}

module.exports = { load, save, publicView, DEFAULTS, SECRET_KEYS };
