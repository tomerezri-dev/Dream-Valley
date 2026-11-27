# Inkwell: a writing assistant for Windows 11 and macOS

Inkwell checks your grammar, spelling, punctuation and style, works in any app, and can rewrite text with Claude AI.

- **Works everywhere.** Select text in any app (Outlook, Gmail in the browser, Word, Slack, Notes…) and press **Ctrl + Shift + G** (Windows) or **⌘ ⇧ G** (Mac). A small window opens with suggestions. Click **Replace** to paste the fixed text back where it came from.
- **Full editor.** A distraction-free writing window shows live underlines, suggestion cards, an overall score, word count and reading time.
- **Three checking engines:**
  - **LanguageTool** (the default). Free with no account. Covers grammar, spelling and style in 30+ languages.
  - **Claude AI.** Context-aware proofreading with tone detection. Uses your own API key.
  - **Offline.** Built-in English rules. Your text never leaves your computer. Inkwell also uses these automatically when you're offline.
- **Rewrite with AI.** Fix all, Improve, Formal, Friendly, Shorter or Confident. You see a before/after comparison of the changes before you accept. Rewrites the selected part, or the whole text if nothing is selected.
- **Personal dictionary**, dismiss or turn off rules, and an undo history for every fix (Ctrl/⌘ + Z).
- Runs in the system tray or menu bar. You can set it to start at login, change the shortcut, and use light or dark mode.

## Install

### Download a build
Every push builds installers on GitHub Actions. Open the repository's **Actions** tab, then **Build Inkwell desktop app**, then the latest run, and download:

| Platform | File |
|---|---|
| Windows 11 (x64 & ARM) | `Inkwell-Setup-1.0.0.exe` (installer) or `Inkwell-1.0.0-portable.exe` |
| macOS (Apple Silicon & Intel) | `Inkwell-1.0.0-mac.dmg` |

To publish a proper release, push a tag such as `inkwell-v1.0.0`. The installers are then attached to a GitHub Release.

**First launch on Windows:** The builds aren't code-signed, so SmartScreen may say "Windows protected your PC". Click **More info**, then **Run anyway**.

**First launch on macOS:** Drag Inkwell into Applications. The app isn't notarized, so the first time you open it, right-click it and choose **Open**, then **Open** again. If macOS says the app "is damaged", run `xattr -cr /Applications/Inkwell.app` in Terminal.
For the shortcut to work in other apps, allow Inkwell under **System Settings → Privacy & Security → Accessibility**. Inkwell prompts you for this the first time. Because the builds are unsigned, you may need to turn this permission off and on again after installing an update.

### Build it yourself
Requires Node.js 20 or later.

```bash
cd inkwell
npm install
npm start          # run in development
npm test           # unit tests
npm run dist:win   # on Windows: builds dist/Inkwell-Setup-*.exe
npm run dist:mac   # on a Mac: builds dist/Inkwell-*-mac.dmg
```

## Using Claude AI
1. Create an API key at [platform.claude.com](https://platform.claude.com/settings/keys).
2. In Inkwell, open **Settings**, paste the key under **Claude AI**, and click **Test key**. The key is encrypted with your OS keychain (Windows DPAPI or macOS Keychain).
3. The **Rewrite with AI** buttons are now available. To use Claude for checking as well, choose **Claude AI** as the checking engine.

The default model is Claude Opus 5.5, for the best quality. In Settings you can switch to Sonnet 5.5 (balanced) or Haiku 5.5 (fastest and cheapest). With Claude as the checking engine, Inkwell checks less often while you type (about 2 seconds after you stop) to keep API costs down. You can turn off **Check as I type** to check only when you click ✓.

## Privacy
- **Offline** engine: nothing leaves your computer.
- **LanguageTool**: the text being checked is sent to LanguageTool's servers (see their privacy policy). You can also point Inkwell at your own LanguageTool server in Settings.
- **Claude**: the text is sent to the Anthropic API using your key.
- The shortcut briefly uses your clipboard to copy and paste the selection. Inkwell then restores what was on your clipboard before.

## How it works
```
inkwell/
├─ src/main/        Electron main process
│  ├─ main.js       windows, tray, global shortcut, IPC
│  ├─ automation.js copy/paste in other apps (PowerShell+user32 on Windows, JXA on macOS)
│  ├─ settings.js   settings + encrypted API keys
│  └─ preload.js    safe bridge to the UI
├─ src/checker/     LanguageTool, Claude and offline engines, merged into one issue list
├─ src/renderer/    the editor and the popup (one page, two layouts)
├─ src/shared/      text helpers shared by UI, engines and tests
└─ test/            node:test unit tests
```
