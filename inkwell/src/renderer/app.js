/* global TextOps */
(() => {
  const api = window.inkwell;
  const params = new URLSearchParams(location.search);
  const MODE = params.get('mode') === 'popup' ? 'popup' : 'editor';
  const PLATFORM = params.get('platform') || 'win32';
  const isMac = PLATFORM === 'darwin';
  document.body.classList.add(`mode-${MODE}`, `platform-${PLATFORM}`);

  const $ = (id) => document.getElementById(id);
  const ta = $('text');
  const highlights = $('highlights');
  const backdrop = $('backdrop');

  const GROUP = { spelling: 'correctness', grammar: 'correctness', punctuation: 'correctness', clarity: 'clarity', style: 'style' };
  const LABEL = { spelling: 'Spelling', grammar: 'Grammar', punctuation: 'Punctuation', clarity: 'Clarity', style: 'Style' };
  const DELAY = { languagetool: 900, offline: 250, claude: 1800 };

  const state = {
    settings: {},
    text: '',
    issues: [],
    checkedText: null,
    ignored: new Set(),
    filter: 'all',
    activeId: null,
    checking: false,
    engine: 'languagetool',
    note: null,
    tone: null,
    canReplace: false,
    version: 0,
  };
  let checkTimer = null;

  // ---------- helpers ----------
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const issueKey = (i, text = state.text) => `${i.rule || ''}|${text.substr(i.offset, i.length)}`;
  const visibleIssues = () => state.issues.filter((i) => !state.ignored.has(issueKey(i)));
  const filteredIssues = () => visibleIssues().filter((i) => state.filter === 'all' || GROUP[i.category] === state.filter);
  const hotkeyLabel = (accel) =>
    (accel || '')
      .replace('CommandOrControl', isMac ? '⌘' : 'Ctrl')
      .replace('Command', '⌘')
      .replace('Control', isMac ? '⌃' : 'Ctrl')
      .replace('Shift', isMac ? '⇧' : 'Shift')
      .replace('Alt', isMac ? '⌥' : 'Alt')
      .replace('Super', 'Win')
      .split('+')
      .join(isMac ? '' : ' + ');

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  function setStatus(text, cls = '') {
    const el = $('status');
    el.textContent = text;
    el.className = `status ${cls}`;
  }

  function banner(text, kind = 'warn') {
    const b = $('banner');
    if (!text) return b.classList.add('hidden');
    b.textContent = text;
    b.classList.toggle('warn', kind === 'warn');
    b.classList.toggle('info', kind === 'info');
    b.classList.remove('hidden');
  }

  // ---------- rendering ----------
  function renderHighlights() {
    const text = state.text;
    const issues = TextOps.normalize(visibleIssues());
    let html = '';
    let pos = 0;
    for (const i of issues) {
      if (i.offset < pos || i.offset > text.length) continue;
      html += esc(text.slice(pos, i.offset));
      const span = text.substr(i.offset, i.length);
      const cls = `m-${i.category}${i.id === state.activeId ? ' active' : ''}${span ? '' : ' empty'}`;
      html += `<mark class="${cls}" data-id="${i.id}">${esc(span) || '​'}</mark>`;
      pos = i.offset + i.length;
    }
    html += esc(text.slice(pos)) + '\n​';
    highlights.innerHTML = html;
    syncScroll();
  }

  function syncScroll() {
    backdrop.scrollTop = ta.scrollTop;
    // keep widths equal when the textarea shows a scrollbar
    backdrop.style.right = `${ta.offsetWidth - ta.clientWidth}px`;
  }

  function renderCards() {
    const cards = $('cards');
    const list = filteredIssues();
    const all = visibleIssues();
    const count = (g) => all.filter((i) => GROUP[i.category] === g).length;
    $('cAll').textContent = all.length;
    $('cCorrectness').textContent = count('correctness');
    $('cClarity').textContent = count('clarity');
    $('cStyle').textContent = count('style');
    const fixable = all.filter((i) => i.replacements && i.replacements.length).length;
    $('acceptAllBtn').disabled = fixable === 0;
    $('acceptAllBtn').textContent = fixable ? `Accept all (${fixable})` : 'Accept all';

    if (!state.text.trim()) {
      cards.innerHTML = MODE === 'popup'
        ? `<div class="empty-state"><strong>No text selected</strong>Select text in any app and press ${esc(hotkeyLabel(state.settings.hotkey))}, or type here.</div>`
        : `<div class="empty-state"><div class="big">✍️</div><strong>Nothing to check yet</strong>Write or paste text on the left. Anywhere else, select text and press ${esc(hotkeyLabel(state.settings.hotkey))}.</div>`;
      return;
    }
    if (!list.length) {
      const done = !state.checking && state.checkedText === state.text;
      cards.innerHTML = done
        ? `<div class="empty-state"><div class="big">✨</div><strong>${all.length ? 'Nothing in this category' : 'Looking good!'}</strong>${all.length ? 'Check the other tabs.' : 'No issues found.'}</div>`
        : `<div class="empty-state">Checking…</div>`;
      return;
    }

    cards.innerHTML = list
      .map((i) => {
        const orig = state.text.substr(i.offset, i.length);
        const reps = i.replacements || [];
        const first = reps[0];
        const repLabel = first === undefined ? '' : first === '' ? '<span class="rep remove">Remove</span>' : `<span class="rep">${esc(first)}</span>`;
        const line = orig.trim()
          ? `<span class="orig">${esc(orig)}</span>${repLabel ? `<span class="arrow">→</span>${repLabel}` : ''}`
          : repLabel ? `<span class="arrow">Insert</span>${repLabel}` : '';
        const repButtons = reps
          .map((r, k) => `<button class="rep-btn${k ? ' alt' : ''}" data-rep="${k}">${r === '' ? 'Remove' : esc(r === ' ' ? '␣ (space)' : r)}</button>`)
          .join('');
        const isWord = i.category === 'spelling' && /^[\p{L}'’-]+$/u.test(orig);
        return `<div class="card cat-${i.category}${i.id === state.activeId ? ' active' : ''}" data-id="${i.id}" tabindex="0">
          <div class="card-top"><i class="dot c-${GROUP[i.category]}"></i><span class="label">${LABEL[i.category] || 'Suggestion'}</span>${i.title && i.title !== i.message ? `<span>· ${esc(i.title)}</span>` : ''}</div>
          <div class="card-line">${line || esc(i.message)}</div>
          <div class="details">
            <p class="msg">${esc(i.message || '')}</p>
            ${repButtons ? `<div class="reps">${repButtons}</div>` : ''}
            <div class="card-actions">
              <button data-act="ignore">Dismiss</button>
              ${isWord ? '<button data-act="dict">Add to dictionary</button>' : ''}
              ${i.rule && i.rule !== 'AI' ? '<button data-act="rule">Turn off this rule</button>' : ''}
            </div>
          </div>
        </div>`;
      })
      .join('');
    const active = cards.querySelector('.card.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function renderScore() {
    const s = TextOps.stats(state.text, visibleIssues());
    $('metaWords').textContent = `${s.words.toLocaleString()} word${s.words === 1 ? '' : 's'}`;
    $('metaChars').textContent = `${s.chars.toLocaleString()} characters`;
    $('metaRead').textContent = s.words ? `${Math.max(1, Math.round(s.readingMinutes))} min read` : '0 min read';
    $('score').textContent = s.score;
    const ring = $('ring');
    ring.style.setProperty('--p', s.score);
    ring.style.setProperty('--ring', s.score >= 85 ? 'var(--good)' : s.score >= 60 ? 'var(--punct)' : 'var(--correctness)');
    const n = visibleIssues().length;
    $('scoreSub').textContent = !s.words ? 'Start typing to get suggestions' : n ? `${n} suggestion${n === 1 ? '' : 's'} to review` : 'No issues found';
    const tone = $('metaTone');
    tone.textContent = state.tone ? `Tone: ${state.tone}` : '';
    tone.classList.toggle('hidden', !state.tone);
  }

  function renderStatus() {
    if (state.checking) return setStatus('Checking…', 'busy');
    if (!state.text.trim()) return setStatus('');
    const n = visibleIssues().length;
    const engineName = { languagetool: 'LanguageTool', claude: 'Claude', offline: 'Offline' }[state.engine] || '';
    if (state.checkedText !== state.text) return setStatus(state.settings.liveCheck ? '' : 'Press ✓ to check');
    setStatus(n ? `${n} suggestion${n === 1 ? '' : 's'} · ${engineName}` : `All good · ${engineName}`, n ? '' : 'good');
  }

  function render() {
    renderHighlights();
    renderCards();
    renderScore();
    renderStatus();
    const hasKey = state.settings.has_claudeApiKey;
    document.querySelectorAll('.ai-buttons .pill').forEach((b) => (b.disabled = !hasKey || !state.text.trim()));
    $('aiHint').classList.toggle('hidden', Boolean(hasKey));
    document.body.classList.toggle('no-ai', !hasKey);
    $('replaceBtn').disabled = !state.canReplace;
    $('replaceBtn').classList.toggle('hidden', !state.canReplace);
    $('copyBtn').classList.toggle('btn-primary', !state.canReplace);
    $('copyBtn').classList.toggle('btn-soft', state.canReplace);
  }

  // ---------- checking ----------
  function scheduleCheck(immediate = false) {
    clearTimeout(checkTimer);
    if (!immediate && !state.settings.liveCheck) return;
    const delay = immediate ? 0 : DELAY[state.settings.engine] ?? 900;
    checkTimer = setTimeout(runCheck, delay);
  }

  async function runCheck() {
    const sent = state.text;
    const version = ++state.version;
    if (!sent.trim()) {
      state.issues = [];
      state.checkedText = sent;
      state.tone = null;
      return render();
    }
    state.checking = true;
    renderStatus();
    const res = await api.check(sent);
    if (version !== state.version) return; // a newer check is running
    state.checking = false;
    if (res.aborted) return;
    if (res.error) {
      banner(res.error, 'warn');
      state.issues = [];
    } else {
      banner(res.note || null, 'info');
      // The user may have kept typing; carry the result over to the current text.
      state.issues = TextOps.adjustForEdit(sent, state.text, res.issues || []);
      state.engine = res.engine;
      state.tone = res.tone || (res.engine === 'claude' ? state.tone : null);
    }
    state.checkedText = sent === state.text ? sent : null;
    if (state.activeId && !state.issues.some((i) => i.id === state.activeId)) state.activeId = null;
    render();
    if (sent !== state.text) scheduleCheck();
  }

  function onTextChanged() {
    const next = ta.value;
    state.issues = TextOps.adjustForEdit(state.text, next, state.issues);
    state.text = next;
    if (state.activeId && !state.issues.some((i) => i.id === state.activeId)) state.activeId = null;
    if (MODE === 'editor') {
      try { localStorage.setItem('inkwell.draft', next); } catch {}
    }
    render();
    scheduleCheck();
  }

  function loadText(text, { check = true } = {}) {
    ta.value = text;
    state.text = text;
    state.issues = [];
    state.checkedText = null;
    state.activeId = null;
    state.tone = null;
    state.ignored.clear();
    ta.scrollTop = 0;
    render();
    if (check) scheduleCheck(true);
  }

  // ---------- applying suggestions ----------
  // Uses execCommand so each change can be undone with Ctrl/Cmd+Z.
  function replaceRange(start, end, replacement) {
    ta.focus();
    ta.setSelectionRange(start, end);
    if (replacement === '') {
      if (start !== end) document.execCommand('delete');
    } else if (!document.execCommand('insertText', false, replacement)) {
      ta.setRangeText(replacement, start, end, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }

  function applyIssue(issue, k = 0) {
    const rep = issue.replacements[k];
    if (rep === undefined) return;
    const idx = filteredIssues().findIndex((i) => i.id === issue.id);
    replaceRange(issue.offset, issue.offset + issue.length, rep);
    // Move on to the next suggestion so you can keep going with the keyboard.
    const next = filteredIssues()[idx] || filteredIssues()[idx - 1];
    state.activeId = next ? next.id : null;
    render();
  }

  function acceptAll() {
    const fixable = TextOps.normalize(visibleIssues().filter((i) => i.replacements && i.replacements.length));
    if (!fixable.length) return;
    for (let k = fixable.length - 1; k >= 0; k--) {
      const i = fixable[k];
      replaceRange(i.offset, i.offset + i.length, i.replacements[0]);
    }
    state.activeId = null;
    toast(`Applied ${fixable.length} suggestion${fixable.length === 1 ? '' : 's'}`);
    render();
  }

  function setActive(id, { focusText = false } = {}) {
    state.activeId = id;
    render();
    if (!id) return;
    const mark = highlights.querySelector(`mark[data-id="${id}"]`);
    if (mark) {
      const top = mark.offsetTop - ta.clientHeight / 3;
      if (mark.offsetTop < ta.scrollTop || mark.offsetTop > ta.scrollTop + ta.clientHeight - 40) ta.scrollTop = Math.max(0, top);
      syncScroll();
    }
    if (focusText) {
      const i = state.issues.find((x) => x.id === id);
      if (i) { ta.focus(); ta.setSelectionRange(i.offset, i.offset + i.length); }
    }
  }

  // ---------- AI rewrite ----------
  let pendingRewrite = null;
  async function rewrite(mode, btn) {
    const sel = ta.selectionStart !== ta.selectionEnd && document.activeElement === ta
      ? { start: ta.selectionStart, end: ta.selectionEnd }
      : { start: 0, end: state.text.length };
    const source = state.text.slice(sel.start, sel.end);
    if (!source.trim()) return;
    document.querySelectorAll('.ai-buttons .pill').forEach((b) => (b.disabled = true));
    btn.classList.add('loading');
    const res = await api.rewrite(source, mode);
    btn.classList.remove('loading');
    render();
    if (res.error) return toast(res.error);
    pendingRewrite = { ...sel, source, text: res.text, baseText: state.text };
    const parts = TextOps.diffWords(source, res.text);
    $('diff').innerHTML = parts
      .map((p) => (p.type === 'same' ? esc(p.text) : p.type === 'add' ? `<ins>${esc(p.text)}</ins>` : `<del>${esc(p.text)}</del>`))
      .join('');
    $('rewriteTitle').textContent = sel.start === 0 && sel.end === state.text.length ? `Rewrite: ${btn.textContent}` : `Rewrite selection: ${btn.textContent}`;
    openModal('rewriteModal');
    $('useRewriteBtn').focus();
  }

  function useRewrite() {
    const r = pendingRewrite;
    closeModal('rewriteModal');
    if (!r) return;
    if (state.text !== r.baseText) return toast('The text changed — run the rewrite again.');
    replaceRange(r.start, r.end, r.text);
    pendingRewrite = null;
    scheduleCheck(true);
  }

  // ---------- modals ----------
  function openModal(id) { $(id).classList.remove('hidden'); }
  function closeModal(id) { $(id).classList.add('hidden'); }
  const anyModalOpen = () => [...document.querySelectorAll('.modal')].some((m) => !m.classList.contains('hidden'));

  // ---------- settings UI ----------
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    document.querySelectorAll('[data-theme-opt]').forEach((b) => b.classList.toggle('active', b.dataset.themeOpt === (theme || 'system')));
  }

  function fillSettings() {
    const s = state.settings;
    document.querySelectorAll('input[name="engine"]').forEach((r) => (r.checked = r.value === s.engine));
    $('sLanguage').value = s.language || 'auto';
    $('sVariant').value = s.preferredVariants || 'en-US';
    $('sLive').checked = s.liveCheck;
    $('sStyle').checked = s.styleSuggestions;
    $('sPicky').checked = s.pickyMode;
    $('sLogin').checked = s.launchAtLogin;
    $('sClaudeModel').value = s.claudeModel || 'claude-opus-5-5';
    $('sClaudeKey').value = '';
    $('sClaudeKey').placeholder = s.has_claudeApiKey ? '•••••••• saved — paste to replace' : 'sk-ant-…';
    $('removeClaudeBtn').classList.toggle('hidden', !s.has_claudeApiKey);
    $('sHotkey').value = hotkeyLabel(s.hotkey);
    $('sLtUrl').value = s.languageToolUrl || '';
    $('sLtUser').value = s.languageToolUser || '';
    $('sLtKey').value = '';
    $('sLtKey').placeholder = s.has_languageToolKey ? '•••••••• saved' : '';
    $('dictList').innerHTML = (s.dictionary || []).map((w) => `<span class="tag">${esc(w)}<button data-unword="${esc(w)}" title="Remove">×</button></span>`).join('');
    $('rulesList').innerHTML = (s.disabledRules || []).map((r) => `<span class="tag">${esc(r)}<button data-unrule="${esc(r)}" title="Turn back on">×</button></span>`).join('');
    if (isMac) {
      $('axStatus').textContent = s.accessibility
        ? '✓ Accessibility access is on, so the shortcut works in every app.'
        : 'Accessibility access is off. Turn on Inkwell in System Settings → Privacy & Security → Accessibility so the shortcut can read your selection.';
    }
    $('version').textContent = `Inkwell ${s.version || ''}`;
    applyTheme(s.theme);
  }

  async function saveSetting(patch) {
    const res = await api.setSettings(patch);
    if (!res.ok) {
      toast(res.error);
      return false;
    }
    return true;
  }

  async function refreshSettings() {
    state.settings = await api.getSettings();
    fillSettings();
    render();
  }

  function wireSettings() {
    document.querySelectorAll('input[name="engine"]').forEach((r) =>
      r.addEventListener('change', async () => {
        if (r.value === 'claude' && !state.settings.has_claudeApiKey) toast('Add your Claude API key below to use Claude.');
        await saveSetting({ engine: r.value });
        scheduleCheck(true);
      }),
    );
    const bindSelect = (id, key) => $(id).addEventListener('change', async (e) => { await saveSetting({ [key]: e.target.value }); scheduleCheck(true); });
    bindSelect('sLanguage', 'language');
    bindSelect('sVariant', 'preferredVariants');
    bindSelect('sClaudeModel', 'claudeModel');
    const bindToggle = (id, key, recheck = true) => $(id).addEventListener('change', async (e) => { await saveSetting({ [key]: e.target.checked }); if (recheck) scheduleCheck(true); });
    bindToggle('sLive', 'liveCheck');
    bindToggle('sStyle', 'styleSuggestions');
    bindToggle('sPicky', 'pickyMode');
    bindToggle('sLogin', 'launchAtLogin', false);

    $('sClaudeKey').addEventListener('change', async (e) => {
      const key = e.target.value.trim();
      if (!key) return;
      await saveSetting({ claudeApiKey: key });
      e.target.value = '';
      testClaude();
    });
    $('removeClaudeBtn').addEventListener('click', async () => {
      await saveSetting({ claudeApiKey: '', ...(state.settings.engine === 'claude' ? { engine: 'languagetool' } : {}) });
      $('claudeResult').textContent = 'Key removed.';
      $('claudeResult').className = 'test-result';
    });
    $('testClaudeBtn').addEventListener('click', testClaude);

    const bindText = (id, key) => $(id).addEventListener('change', (e) => saveSetting({ [key]: e.target.value.trim() }));
    bindText('sLtUrl', 'languageToolUrl');
    bindText('sLtUser', 'languageToolUser');
    $('sLtKey').addEventListener('change', (e) => { if (e.target.value.trim()) saveSetting({ languageToolKey: e.target.value.trim() }); });

    // Shortcut recorder
    const hk = $('sHotkey');
    hk.addEventListener('focus', () => { hk.classList.add('recording'); hk.value = 'Press keys…'; });
    hk.addEventListener('blur', () => { hk.classList.remove('recording'); hk.value = hotkeyLabel(state.settings.hotkey); });
    hk.addEventListener('keydown', async (e) => {
      e.preventDefault();
      if (e.key === 'Escape') return hk.blur();
      const key = codeToKey(e.code);
      if (!key) return;
      const mods = [];
      if (isMac ? e.metaKey : e.ctrlKey) mods.push('CommandOrControl');
      if (isMac && e.ctrlKey) mods.push('Control');
      if (!isMac && e.metaKey) mods.push('Super');
      if (e.altKey) mods.push('Alt');
      if (e.shiftKey) mods.push('Shift');
      if (!mods.length && !/^F\d+$/.test(key)) {
        $('hotkeyResult').textContent = 'Use at least one modifier key (Ctrl, ⌘, Alt, Shift).';
        $('hotkeyResult').className = 'test-result err';
        return;
      }
      const accel = [...mods, key].join('+');
      const ok = await saveSetting({ hotkey: accel });
      $('hotkeyResult').textContent = ok ? 'Saved.' : '';
      $('hotkeyResult').className = 'test-result ok';
      hk.blur();
    });
    $('resetHotkeyBtn').addEventListener('click', () => saveSetting({ hotkey: 'CommandOrControl+Shift+G' }));

    $('dictAddBtn').addEventListener('click', addDictWord);
    $('dictInput').addEventListener('keydown', (e) => e.key === 'Enter' && addDictWord());
    $('dictList').addEventListener('click', async (e) => {
      const w = e.target.dataset.unword;
      if (w) { await api.removeFromDictionary(w); scheduleCheck(true); }
    });
    $('rulesList').addEventListener('click', async (e) => {
      const r = e.target.dataset.unrule;
      if (r) { await saveSetting({ disabledRules: state.settings.disabledRules.filter((x) => x !== r) }); scheduleCheck(true); }
    });
    $('axBtn').addEventListener('click', () => api.openAccessibility());
    document.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => saveSetting({ theme: b.dataset.themeOpt })));
    document.querySelectorAll('[data-href]').forEach((b) => b.addEventListener('click', () => api.openExternal(b.dataset.href)));
  }

  async function addDictWord() {
    const w = $('dictInput').value.trim();
    if (!w) return;
    await api.addToDictionary(w);
    $('dictInput').value = '';
    scheduleCheck(true);
  }

  async function testClaude() {
    const out = $('claudeResult');
    out.textContent = 'Testing…';
    out.className = 'test-result';
    const res = await api.testClaude();
    out.textContent = res.ok ? `✓ Connected (${res.model})` : res.error;
    out.className = `test-result ${res.ok ? 'ok' : 'err'}`;
  }

  function codeToKey(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^F\d{1,2}$/.test(code)) return code;
    const map = { Space: 'Space', Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`' };
    return map[code] || null;
  }

  // ---------- events ----------
  ta.addEventListener('input', onTextChanged);
  ta.addEventListener('scroll', syncScroll);
  new ResizeObserver(syncScroll).observe(ta);
  const caretToIssue = () => {
    const pos = ta.selectionStart;
    const hit = visibleIssues().find((i) => pos >= i.offset && pos <= i.offset + i.length && ta.selectionStart === ta.selectionEnd);
    if (hit && hit.id !== state.activeId) {
      if (state.filter !== 'all' && GROUP[hit.category] !== state.filter) state.filter = 'all';
      document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === state.filter));
      setActive(hit.id);
    }
  };
  ta.addEventListener('click', caretToIssue);
  ta.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') caretToIssue(); });

  $('cards').addEventListener('click', async (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const issue = state.issues.find((i) => i.id === card.dataset.id);
    if (!issue) return;
    const repBtn = e.target.closest('[data-rep]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (repBtn) return applyIssue(issue, Number(repBtn.dataset.rep));
    if (act === 'ignore') {
      state.ignored.add(issueKey(issue));
      state.activeId = null;
      return render();
    }
    if (act === 'dict') {
      await api.addToDictionary(state.text.substr(issue.offset, issue.length));
      toast('Added to your dictionary');
      state.ignored.add(issueKey(issue));
      return render();
    }
    if (act === 'rule') {
      await api.disableRule(issue.rule);
      toast('Rule turned off. Re-enable it in Settings.');
      state.issues = state.issues.filter((i) => i.rule !== issue.rule);
      return render();
    }
    if (state.activeId !== issue.id) setActive(issue.id);
  });
  $('cards').addEventListener('keydown', (e) => {
    const card = e.target.closest('.card');
    if (!card || e.target !== card) return;
    const issue = state.issues.find((i) => i.id === card.dataset.id);
    if (e.key === 'Enter' && issue) {
      if (state.activeId === issue.id) applyIssue(issue, 0);
      else setActive(issue.id);
    }
  });

  $('filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    render();
  });

  $('acceptAllBtn').addEventListener('click', acceptAll);
  $('checkBtn').addEventListener('click', () => scheduleCheck(true));
  document.querySelectorAll('.ai-buttons .pill').forEach((b) => b.addEventListener('click', () => rewrite(b.dataset.mode, b)));
  $('useRewriteBtn').addEventListener('click', useRewrite);
  $('showChanges').addEventListener('change', (e) => $('diff').classList.toggle('clean', !e.target.checked));

  document.querySelectorAll('.modal').forEach((m) =>
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) closeModal(m.id);
    }),
  );
  const openSettings = async () => { await refreshSettings(); openModal('settingsModal'); };
  $('settingsBtn').addEventListener('click', openSettings);
  document.querySelectorAll('[data-open-settings]').forEach((b) => b.addEventListener('click', openSettings));

  $('copyAllBtn').addEventListener('click', async () => { await api.copy(state.text); toast('Copied to clipboard'); });
  $('clearBtn').addEventListener('click', () => { ta.focus(); ta.select(); document.execCommand('delete'); });
  $('copyBtn').addEventListener('click', async () => {
    await api.copy(state.text);
    toast('Copied — paste it anywhere');
  });
  $('replaceBtn').addEventListener('click', () => state.canReplace && api.replace(state.text));
  $('closeBtn').addEventListener('click', () => api.closePopup());
  $('openEditorBtn').addEventListener('click', () => api.openInEditor(state.text));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.modal')].find((m) => !m.classList.contains('hidden'));
      if (open) return closeModal(open.id);
      if (MODE === 'popup') return api.closePopup();
      if (state.activeId) setActive(null);
    }
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.key === 'Enter' && !anyModalOpen()) {
      e.preventDefault();
      if (MODE === 'popup') {
        if (state.canReplace) api.replace(state.text);
        else api.copy(state.text).then(() => toast('Copied'));
      } else scheduleCheck(true);
    }
    if (mod && e.key === ',') { e.preventDefault(); openSettings(); }
  });

  api.onPopupLoad((payload) => {
    closeModal('rewriteModal');
    closeModal('settingsModal');
    state.canReplace = Boolean(payload.canReplace);
    $('sourceLabel').textContent = payload.source === 'clipboard' ? 'Clipboard' : 'Selected text';
    loadText(payload.text || '');
    if (payload.error) banner(payload.error, 'warn');
    else banner(null);
    ta.focus();
    ta.setSelectionRange(0, 0);
  });
  api.onEditorLoad((text) => { loadText(text); ta.focus(); });
  api.onOpenSettings(openSettings);
  api.onSettingsChanged((s) => {
    state.settings = { ...state.settings, ...s };
    fillSettings();
    render();
  });

  // ---------- start ----------
  (async () => {
    state.settings = await api.getSettings();
    state.engine = state.settings.engine;
    fillSettings();
    wireSettings();
    if (MODE === 'editor') {
      let draft = '';
      try { draft = localStorage.getItem('inkwell.draft') || ''; } catch {}
      loadText(draft || '');
      ta.focus();
    } else {
      render();
    }
  })();
})();
