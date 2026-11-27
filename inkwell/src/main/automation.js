// Grabs the selected text from whatever app is in front (by sending the
// system copy shortcut) and pastes corrected text back into it.
// - Windows: a long-lived PowerShell helper calling user32 (fast after warm-up).
// - macOS: JXA via osascript (needs the Accessibility permission).
// - Linux: xdotool, if installed.
const { clipboard, systemPreferences, app } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- clipboard snapshot ----------
function snapshot() {
  const formats = clipboard.availableFormats();
  const snap = { text: clipboard.readText(), html: '', rtf: '', image: null };
  if (formats.some((f) => f.includes('html'))) snap.html = clipboard.readHTML();
  if (formats.some((f) => f.includes('rtf'))) snap.rtf = clipboard.readRTF();
  if (formats.some((f) => f.startsWith('image/'))) {
    const img = clipboard.readImage();
    if (!img.isEmpty()) snap.image = img;
  }
  return snap;
}

function restore(snap) {
  if (!snap) return;
  const data = {};
  if (snap.text) data.text = snap.text;
  if (snap.html) data.html = snap.html;
  if (snap.rtf) data.rtf = snap.rtf;
  if (snap.image) data.image = snap.image;
  if (Object.keys(data).length) clipboard.write(data);
  else clipboard.clear();
}

// ---------- Windows helper ----------
const WIN_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Threading;
using System.Runtime.InteropServices;
public static class InkKeys {
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  static bool Down(int vk) { return (GetAsyncKeyState(vk) & 0x8000) != 0; }
  public static void WaitRelease() {
    int t = 0;
    while (t < 2000 && (Down(0x10) || Down(0x11) || Down(0x12) || Down(0x5B) || Down(0x5C))) { Thread.Sleep(15); t += 15; }
  }
  public static void Ctrl(byte key) {
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(key, 0, 0, UIntPtr.Zero);
    keybd_event(key, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }
  public static void Focus(long handle) {
    IntPtr h = new IntPtr(handle);
    if (handle == 0 || !IsWindow(h) || GetForegroundWindow() == h) return;
    keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero); // lets us take focus
    SetForegroundWindow(h);
    Thread.Sleep(80);
  }
}
"@
[Console]::Out.WriteLine('ready')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $parts = $line.Split(' ')
  try {
    switch ($parts[0]) {
      'copy'  { [InkKeys]::WaitRelease(); $h = [InkKeys]::GetForegroundWindow().ToInt64(); [InkKeys]::Ctrl(0x43); [Console]::Out.WriteLine("ok $h") }
      'paste' { [InkKeys]::Focus([long]$parts[1]); [InkKeys]::WaitRelease(); [InkKeys]::Ctrl(0x56); [Console]::Out.WriteLine('ok') }
      'focus' { [InkKeys]::Focus([long]$parts[1]); [Console]::Out.WriteLine('ok') }
      default { [Console]::Out.WriteLine('err unknown') }
    }
  } catch { [Console]::Out.WriteLine("err $($_.Exception.Message)") }
  [Console]::Out.Flush()
}
`;

let winProc = null;
let winQueue = [];
let winBuf = '';
let winReady = null;

function startWinHelper() {
  if (winProc) return winReady;
  const scriptPath = path.join(app.getPath('userData'), 'inkwell-keys.ps1');
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, WIN_SCRIPT);
  winProc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  winReady = new Promise((resolve) => {
    winQueue.push(resolve); // first line is "ready"
  });
  winProc.stdout.setEncoding('utf8');
  winProc.stdout.on('data', (d) => {
    winBuf += d;
    let nl;
    while ((nl = winBuf.indexOf('\n')) >= 0) {
      const line = winBuf.slice(0, nl).trim();
      winBuf = winBuf.slice(nl + 1);
      const cb = winQueue.shift();
      if (cb) cb(line);
    }
  });
  winProc.on('exit', () => {
    winProc = null;
    winQueue.splice(0).forEach((cb) => cb('err helper exited'));
  });
  return winReady;
}

async function winCommand(cmd) {
  await startWinHelper();
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('err timeout'), 4000);
    winQueue.push((line) => {
      clearTimeout(timer);
      resolve(line);
    });
    winProc.stdin.write(cmd + '\n');
  });
}

// ---------- macOS ----------
function jxa(source) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', source], { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout.trim());
    });
  });
}

const MAC_COPY = `
ObjC.import('AppKit');
function run() {
  var i = 0;
  while (($.NSEvent.modifierFlags & 0x1E0000) && i < 100) { delay(0.02); i++; }
  var se = Application('System Events');
  var p = se.processes.whose({ frontmost: true })[0];
  var pid = p.unixId();
  se.keystroke('c', { using: 'command down' });
  return String(pid);
}`;

const macPaste = (pid) => `
ObjC.import('AppKit');
function run() {
  var pid = ${Number(pid) || 0};
  if (pid) {
    var a = $.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
    if (a && a.activateWithOptions) { a.activateWithOptions($.NSApplicationActivateIgnoringOtherApps); delay(0.15); }
  }
  var i = 0;
  while (($.NSEvent.modifierFlags & 0x1E0000) && i < 100) { delay(0.02); i++; }
  Application('System Events').keystroke('v', { using: 'command down' });
  return 'ok';
}`;

const macFocus = (pid) => `
ObjC.import('AppKit');
function run() {
  var a = $.NSRunningApplication.runningApplicationWithProcessIdentifier(${Number(pid) || 0});
  if (a && a.activateWithOptions) a.activateWithOptions($.NSApplicationActivateIgnoringOtherApps);
  return 'ok';
}`;

function macTrusted(prompt) {
  return systemPreferences.isTrustedAccessibilityClient(Boolean(prompt));
}

// ---------- Linux (xdotool) ----------
function xdotool(args) {
  return new Promise((resolve, reject) =>
    execFile('xdotool', args, { timeout: 4000 }, (err, out) => (err ? reject(err) : resolve(out.trim()))),
  );
}

// ---------- public API ----------
async function sendCopy() {
  if (process.platform === 'win32') {
    const r = await winCommand('copy');
    if (!r.startsWith('ok')) throw new Error(`Could not copy the selection (${r}).`);
    return r.split(' ')[1];
  }
  if (process.platform === 'darwin') {
    if (!macTrusted(false)) {
      const err = new Error('Inkwell needs the Accessibility permission to read the selected text.');
      err.code = 'NO_ACCESSIBILITY';
      throw err;
    }
    return jxa(MAC_COPY);
  }
  const win = await xdotool(['getactivewindow']).catch(() => '');
  await xdotool(['key', '--clearmodifiers', 'ctrl+c']);
  return win;
}

async function sendPaste(target) {
  if (process.platform === 'win32') return winCommand(`paste ${target || 0}`);
  if (process.platform === 'darwin') return jxa(macPaste(target));
  if (target) await xdotool(['windowactivate', '--sync', String(target)]).catch(() => {});
  return xdotool(['key', '--clearmodifiers', 'ctrl+v']);
}

async function focusTarget(target) {
  if (!target) return;
  try {
    if (process.platform === 'win32') await winCommand(`focus ${target}`);
    else if (process.platform === 'darwin') await jxa(macFocus(target));
    else await xdotool(['windowactivate', String(target)]);
  } catch {}
}

// Copy the current selection in the front app. Leaves the user's clipboard as it was.
async function grabSelection() {
  const saved = snapshot();
  const marker = `⁣inkwell-${Date.now()}`;
  clipboard.writeText(marker);
  let target = null;
  let text = '';
  try {
    target = await sendCopy();
    for (let i = 0; i < 25; i++) {
      await sleep(30);
      const t = clipboard.readText();
      if (t !== marker) {
        text = t;
        break;
      }
    }
  } finally {
    restore(saved);
  }
  return { text, target };
}

// Paste `text` into the target app, then put the user's clipboard back.
async function replaceSelection(text, target) {
  const saved = snapshot();
  clipboard.writeText(text);
  await sleep(30);
  await sendPaste(target);
  await sleep(450);
  restore(saved);
}

function warmUp() {
  if (process.platform === 'win32') startWinHelper().catch(() => {});
}

function dispose() {
  if (winProc) winProc.kill();
}

module.exports = { grabSelection, replaceSelection, focusTarget, warmUp, dispose, macTrusted };
