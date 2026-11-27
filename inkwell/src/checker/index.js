// Chooses an engine, merges in offline style rules and applies the user's
// dictionary and ignore lists.
const local = require('./localRules');
const languagetool = require('./languagetool');
const claude = require('./claude');
const { merge, normalize } = require('../shared/textops');

let counter = 0;
const withIds = (issues) => issues.map((i) => ({ ...i, id: `i${++counter}` }));

function filterIgnored(text, issues, settings) {
  const dict = new Set((settings.dictionary || []).map((w) => w.toLowerCase()));
  const ignoredRules = new Set(settings.disabledRules || []);
  return issues.filter((i) => {
    if (ignoredRules.has(i.rule)) return false;
    if (i.category === 'spelling' && dict.has(text.substr(i.offset, i.length).toLowerCase())) return false;
    if (!settings.styleSuggestions && (i.category === 'style')) return false;
    return true;
  });
}

async function check(text, settings, signal) {
  if (!text.trim()) return { issues: [], engine: settings.engine };
  const offline = local.check(text);
  let primary = [];
  let engine = settings.engine || 'languagetool';
  let note;
  let tone;
  let language;

  try {
    if (engine === 'claude') {
      const r = await claude.check(text, settings, signal);
      primary = r.issues;
      tone = r.tone;
    } else if (engine === 'languagetool') {
      const r = await languagetool.check(text, settings, signal);
      primary = r.issues;
      language = r.language;
    }
  } catch (err) {
    if (err.name === 'AbortError' || signal?.aborted) throw err;
    const reason = /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(err.message)
      ? `Couldn't reach ${engine === 'claude' ? 'Claude' : 'LanguageTool'} — are you offline?`
      : err.message;
    note = `${reason} Using the built-in offline checks for now.`;
    engine = 'offline';
  }

  let issues;
  if (engine === 'offline') issues = normalize(offline);
  else issues = merge(primary, offline.filter((i) => i.category === 'style' || i.category === 'clarity' || engine !== 'claude'));
  issues = filterIgnored(text, issues, settings);
  return { issues: withIds(issues), engine, note, tone, language };
}

module.exports = { check, rewrite: claude.rewrite, testKey: claude.testKey, MODES: claude.MODES };
