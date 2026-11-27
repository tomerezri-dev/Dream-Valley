const {
  app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, shell, clipboard, dialog, nativeImage, Notification,
} = require('electron');
const path = require('path');
const settings = require('./settings');
const automation = require('./automation');
const checker = require('../checker');

const isMac = process.platform === 'darwin';
const ASSETS = path.join(__dirname, '..', '..', 'assets');
const RENDERER = path.join(__dirname, '..', 'renderer', 'index.html');

let editorWin = null;
let popupWin = null;
let tray = null;
let lastTarget = null;
let hotkeyBusy = false;
let quitting = false;
const inflight = new Map(); // webContents.id -> AbortController

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showEditor());
}

const webPreferences = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
};

function lockDown(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

// ---------- windows ----------
function createEditor() {
  editorWin = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    show: false,
    title: 'Inkwell',
    icon: path.join(ASSETS, 'icon-256.png'),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    backgroundColor: '#f7f6f3',
    webPreferences,
  });
  lockDown(editorWin);
  editorWin.loadFile(RENDERER, { query: { mode: 'editor', platform: process.platform } });
  editorWin.once('ready-to-show', () => editorWin.show());
  editorWin.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      editorWin.hide();
      if (isMac) app.dock?.hide();
    }
  });
}

function showEditor(text) {
  if (!editorWin || editorWin.isDestroyed()) createEditor();
  if (isMac) app.dock?.show();
  if (text != null) {
    const send = () => editorWin.webContents.send('editor:load', text);
    if (editorWin.webContents.isLoading()) editorWin.webContents.once('did-finish-load', send);
    else send();
  }
  editorWin.show();
  editorWin.focus();
}

function createPopup() {
  popupWin = new BrowserWindow({
    width: 460,
    height: 600,
    minWidth: 360,
    minHeight: 300,
    show: false,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    backgroundColor: '#00000000',
    transparent: isMac,
    roundedCorners: true,
    hasShadow: true,
    webPreferences,
  });
  popupWin.setAlwaysOnTop(true, 'pop-up-menu');
  if (isMac) popupWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockDown(popupWin);
  popupWin.loadFile(RENDERER, { query: { mode: 'popup', platform: process.platform } });
  popupWin.on('blur', () => {
    if (popupWin && popupWin.isVisible() && !popupWin.webContents.isDevToolsOpened()) popupWin.hide();
  });
}

function placePopup(point) {
  const display = screen.getDisplayNearestPoint(point);
  const area = display.workArea;
  const [w, h] = popupWin.getSize();
  let x = point.x + 14;
  let y = point.y + 18;
  if (x + w > area.x + area.width) x = point.x - w - 14;
  if (y + h > area.y + area.height) y = area.y + area.height - h - 8;
  x = Math.max(area.x + 8, Math.min(x, area.x + area.width - w - 8));
  y = Math.max(area.y + 8, y);
  popupWin.setPosition(Math.round(x), Math.round(y));
}

function showPopup(point, payload) {
  if (!popupWin || popupWin.isDestroyed()) createPopup();
  const send = () => popupWin.webContents.send('popup:load', payload);
  if (popupWin.webContents.isLoading()) popupWin.webContents.once('did-finish-load', send);
  else send();
  placePopup(point);
  popupWin.show();
  popupWin.focus();
  if (isMac) app.focus({ steal: true });
}

// ---------- hotkey flow ----------
async function checkSelection() {
  if (hotkeyBusy) return;
  if (popupWin && popupWin.isVisible()) {
    popupWin.hide();
    return;
  }
  hotkeyBusy = true;
  const point = screen.getCursorScreenPoint();
  try {
    const { text, target } = await automation.grabSelection();
    lastTarget = target;
    showPopup(point, { text, source: 'selection', canReplace: Boolean(text) });
  } catch (err) {
    if (err.code === 'NO_ACCESSIBILITY') askForAccessibility();
    else showPopup(point, { text: '', source: 'selection', error: err.message });
  } finally {
    hotkeyBusy = false;
  }
}

function checkClipboard() {
  lastTarget = null;
  showPopup(screen.getCursorScreenPoint(), { text: clipboard.readText(), source: 'clipboard', canReplace: false });
}

function askForAccessibility() {
  const choice = dialog.showMessageBoxSync({
    type: 'info',
    buttons: ['Open System Settings', 'Later'],
    defaultId: 0,
    message: 'Allow Inkwell to read your selection',
    detail:
      'To check text in other apps, Inkwell copies and pastes your selection for you. macOS needs you to allow this once:\n\n' +
      'System Settings → Privacy & Security → Accessibility → turn on Inkwell.\n\nThen press the shortcut again.',
  });
  automation.macTrusted(true);
  if (choice === 0) shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
}

function registerHotkey(accel) {
  globalShortcut.unregisterAll();
  if (!accel) return true;
  try {
    return globalShortcut.register(accel, checkSelection);
  } catch {
    return false;
  }
}

// ---------- tray ----------
function prettyHotkey(accel) {
  return (accel || '')
    .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+');
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(ASSETS, isMac ? 'trayTemplate.png' : 'tray.png'));
  if (isMac) icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Inkwell');
  refreshTrayMenu();
  if (!isMac) tray.on('click', () => showEditor());
}

function refreshTrayMenu() {
  if (!tray) return;
  const s = settings.load();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Check selected text   ${prettyHotkey(s.hotkey)}`, click: checkSelection },
      { label: 'Check clipboard', click: checkClipboard },
      { label: 'Open Inkwell', click: () => showEditor() },
      { type: 'separator' },
      {
        label: 'Engine',
        submenu: [
          ['languagetool', 'LanguageTool (free)'],
          ['claude', 'Claude AI'],
          ['offline', 'Offline only'],
        ].map(([id, label]) => ({
          label,
          type: 'radio',
          checked: s.engine === id,
          click: () => applySettings({ engine: id }),
        })),
      },
      { label: 'Launch at login', type: 'checkbox', checked: s.launchAtLogin, click: (i) => applySettings({ launchAtLogin: i.checked }) },
      { label: 'Settings…', click: () => { showEditor(); editorWin.webContents.send('editor:settings'); } },
      { type: 'separator' },
      { label: 'Quit Inkwell', role: 'quit' },
    ]),
  );
}

// ---------- settings ----------
const EDITABLE = new Set(Object.keys(settings.DEFAULTS));

function applySettings(patch) {
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) if (EDITABLE.has(k)) clean[k] = v;
  const before = settings.load();
  if ('hotkey' in clean && clean.hotkey !== before.hotkey) {
    if (!registerHotkey(clean.hotkey)) {
      registerHotkey(before.hotkey);
      return { ok: false, error: `The shortcut ${clean.hotkey} is unavailable. Try another one.` };
    }
  }
  if ('launchAtLogin' in clean) {
    try {
      app.setLoginItemSettings({ openAtLogin: Boolean(clean.launchAtLogin), openAsHidden: true, args: ['--hidden'] });
    } catch {}
  }
  settings.save(clean);
  refreshTrayMenu();
  broadcast('settings:changed', settings.publicView());
  return { ok: true, settings: settings.publicView() };
}

function broadcast(channel, data) {
  for (const w of [editorWin, popupWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, data);
}

// ---------- IPC ----------
function setupIpc() {
  ipcMain.handle('check', async (e, text) => {
    inflight.get(e.sender.id)?.abort();
    const ctrl = new AbortController();
    inflight.set(e.sender.id, ctrl);
    try {
      return await checker.check(String(text || ''), settings.load(), ctrl.signal);
    } catch (err) {
      if (ctrl.signal.aborted) return { aborted: true };
      return { issues: [], error: err.message };
    } finally {
      if (inflight.get(e.sender.id) === ctrl) inflight.delete(e.sender.id);
    }
  });

  ipcMain.handle('rewrite', async (_e, text, mode) => {
    try {
      return { text: await checker.rewrite(String(text || ''), String(mode), settings.load()) };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('settings:get', () => ({
    ...settings.publicView(),
    platform: process.platform,
    version: app.getVersion(),
    accessibility: isMac ? automation.macTrusted(false) : true,
  }));
  ipcMain.handle('settings:set', (_e, patch) => applySettings(patch));
  ipcMain.handle('settings:testClaude', async () => {
    try {
      return { ok: true, model: await checker.testKey(settings.load()) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('dictionary:add', (_e, word) => {
    const w = String(word || '').trim();
    if (!w) return;
    const dict = new Set(settings.load().dictionary);
    dict.add(w);
    applySettings({ dictionary: [...dict].sort((a, b) => a.localeCompare(b)) });
  });
  ipcMain.handle('dictionary:remove', (_e, word) => {
    applySettings({ dictionary: settings.load().dictionary.filter((w) => w !== word) });
  });
  ipcMain.handle('rule:disable', (_e, rule) => {
    if (!rule) return;
    applySettings({ disabledRules: [...new Set([...settings.load().disabledRules, String(rule)])] });
  });

  ipcMain.handle('clipboard:write', (_e, text) => clipboard.writeText(String(text || '')));

  ipcMain.handle('popup:replace', async (_e, text) => {
    if (!popupWin) return;
    popupWin.hide();
    await automation.replaceSelection(String(text), lastTarget);
    return { ok: true };
  });
  ipcMain.handle('popup:close', async () => {
    if (popupWin) popupWin.hide();
    if (isMac && !(editorWin && editorWin.isVisible())) app.hide();
    await automation.focusTarget(lastTarget);
  });
  ipcMain.handle('popup:openInEditor', (_e, text) => {
    if (popupWin) popupWin.hide();
    showEditor(String(text || ''));
  });
  ipcMain.handle('popup:resize', (_e, height) => {
    if (!popupWin) return;
    const [w] = popupWin.getSize();
    popupWin.setSize(w, Math.max(300, Math.min(760, Math.round(height))));
  });
  ipcMain.handle('app:openAccessibility', () =>
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'),
  );
  ipcMain.handle('app:openExternal', (_e, url) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });
}

// ---------- lifecycle ----------
app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('app.inkwell.desktop');
  setupIpc();
  const s = settings.load();
  buildTray();
  createPopup();
  automation.warmUp();
  if (!registerHotkey(s.hotkey) && Notification.isSupported()) {
    new Notification({ title: 'Inkwell', body: `Couldn't register ${s.hotkey}. Pick another shortcut in Settings.` }).show();
  }
  const hidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;
  if (!hidden) showEditor();
  else if (isMac) app.dock?.hide();

  app.on('activate', () => showEditor());
});

app.on('before-quit', () => {
  quitting = true;
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  automation.dispose();
});
// Keep running in the tray/menu bar when windows are closed.
app.on('window-all-closed', () => {});
