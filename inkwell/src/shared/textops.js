// Pure text helpers shared by the main process, the renderer and tests.
// Loaded in the renderer as a classic <script> (exposes window.TextOps)
// and in Node via require().
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TextOps = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const WEIGHTS = { spelling: 3, grammar: 3, punctuation: 2, clarity: 1, style: 1 };

  function countWords(text) {
    const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
    return m ? m.length : 0;
  }

  function stats(text, issues) {
    const words = countWords(text);
    const chars = text.length;
    const sentences = (text.match(/[^.!?\n]+[.!?]+/g) || []).length || (words ? 1 : 0);
    const readingMinutes = words / 238;
    const weighted = (issues || []).reduce((s, i) => s + (WEIGHTS[i.category] || 1), 0);
    const score = words === 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - (weighted / words) * 100)));
    return { words, chars, sentences, readingMinutes, score };
  }

  // Sort by offset and drop issues that overlap an earlier one.
  function normalize(issues) {
    const sorted = [...issues].sort((a, b) => a.offset - b.offset || b.length - a.length);
    const out = [];
    let end = -1;
    for (const i of sorted) {
      if (i.length < 0 || i.offset < 0) continue;
      if (i.offset < end) continue;
      out.push(i);
      end = i.offset + Math.max(i.length, 1);
    }
    return out;
  }

  // Merge secondary issues into primary ones, skipping any that overlap.
  function merge(primary, secondary) {
    const res = [...primary];
    for (const s of secondary) {
      const sEnd = s.offset + Math.max(s.length, 1);
      const clash = primary.some((p) => s.offset < p.offset + Math.max(p.length, 1) && p.offset < sEnd);
      if (!clash) res.push(s);
    }
    return normalize(res);
  }

  // Replace one issue's span and shift the others. Returns new text + issues.
  function applyIssue(text, issues, issue, replacement) {
    const start = issue.offset;
    const end = issue.offset + issue.length;
    const newText = text.slice(0, start) + replacement + text.slice(end);
    const delta = replacement.length - issue.length;
    const rest = [];
    for (const i of issues) {
      if (i === issue || i.id === issue.id) continue;
      const iEnd = i.offset + i.length;
      if (iEnd <= start && i.offset < start) rest.push(i);
      else if (i.offset >= end && (i.offset > start || issue.length > 0)) rest.push({ ...i, offset: i.offset + delta });
      // overlapping issues are dropped; the next check will re-find them
    }
    return { text: newText, issues: rest };
  }

  // Apply the first replacement of every issue that has one.
  function applyAll(text, issues) {
    const fixable = normalize(issues.filter((i) => i.replacements && i.replacements.length));
    let out = text;
    for (let k = fixable.length - 1; k >= 0; k--) {
      const i = fixable[k];
      out = out.slice(0, i.offset) + i.replacements[0] + out.slice(i.offset + i.length);
    }
    const remaining = issues.filter((i) => !fixable.includes(i));
    return { text: out, applied: fixable.length, remaining };
  }

  // Locate `needle` in `text`, preferring the first hit at or after `from`.
  function locate(text, needle, from) {
    if (!needle) return -1;
    let idx = text.indexOf(needle, from);
    if (idx === -1) idx = text.indexOf(needle);
    return idx;
  }

  // After the user edits the text, keep issues outside the edited region
  // (shifting those after it) and drop the ones the edit touched.
  function adjustForEdit(oldText, newText, issues) {
    if (oldText === newText) return issues;
    let p = 0;
    const max = Math.min(oldText.length, newText.length);
    while (p < max && oldText[p] === newText[p]) p++;
    let s = 0;
    while (s < max - p && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
    const oldEnd = oldText.length - s;
    const delta = newText.length - oldText.length;
    const out = [];
    for (const i of issues) {
      const iEnd = i.offset + i.length;
      if (iEnd < p || (iEnd === p && i.length > 0 && !/\w/.test(newText[p] || ''))) out.push(i);
      else if (i.offset > oldEnd || (i.offset === oldEnd && oldEnd > p)) out.push({ ...i, offset: i.offset + delta });
    }
    return out;
  }

  // Word-level diff for previews: returns [{type:'same'|'add'|'del', text}]
  function diffWords(a, b) {
    const A = a.match(/\s+|[^\s]+/g) || [];
    const B = b.match(/\s+|[^\s]+/g) || [];
    if (A.length * B.length > 4e6) return [{ type: 'del', text: a }, { type: 'add', text: b }];
    const n = A.length, m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = [];
    const push = (type, text) => {
      const last = out[out.length - 1];
      if (last && last.type === type) last.text += text;
      else out.push({ type, text });
    };
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { push('same', A[i]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', A[i++]);
      else push('add', B[j++]);
    }
    while (i < n) push('del', A[i++]);
    while (j < m) push('add', B[j++]);
    return out;
  }

  return { stats, countWords, normalize, merge, applyIssue, applyAll, locate, adjustForEdit, diffWords, WEIGHTS };
});
