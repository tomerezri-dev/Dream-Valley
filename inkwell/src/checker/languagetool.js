// LanguageTool engine. Works with the free public API (no account needed),
// LanguageTool Premium (username + API key) or a self-hosted server.

const PUBLIC_URL = 'https://api.languagetool.org';
const PREMIUM_URL = 'https://api.languagetoolplus.com';
const MAX_CHUNK = 15000;

function categoryOf(match) {
  const issueType = match.rule?.issueType || '';
  const cat = (match.rule?.category?.id || '').toUpperCase();
  if (issueType === 'misspelling' || cat === 'TYPOS') return 'spelling';
  if (['PUNCTUATION', 'TYPOGRAPHY', 'CASING'].includes(cat) || issueType === 'whitespace' || issueType === 'typographical') {
    return cat === 'CASING' ? 'grammar' : 'punctuation';
  }
  if (['STYLE', 'REDUNDANCY', 'PLAIN_ENGLISH', 'COLLOQUIALISMS', 'REPETITIONS_STYLE'].includes(cat) || issueType === 'style') return 'style';
  if (['CONFUSED_WORDS', 'SEMANTICS'].includes(cat)) return 'clarity';
  return 'grammar';
}

// Split long text at paragraph boundaries so each request stays under the limit.
function chunk(text) {
  if (text.length <= MAX_CHUNK) return [{ start: 0, text }];
  const parts = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_CHUNK, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf('\n', end);
      const sp = text.lastIndexOf(' ', end);
      end = nl > start + 1000 ? nl + 1 : sp > start + 1000 ? sp + 1 : end;
    }
    parts.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return parts;
}

async function checkChunk(part, settings, signal) {
  const custom = (settings.languageToolUrl || '').trim().replace(/\/+$/, '');
  const premium = settings.languageToolUser && settings.languageToolKey;
  const base = custom || (premium ? PREMIUM_URL : PUBLIC_URL);
  const body = new URLSearchParams({ text: part.text, language: settings.language || 'auto' });
  if ((settings.language || 'auto') === 'auto' && settings.preferredVariants) {
    body.set('preferredVariants', settings.preferredVariants);
  }
  if (settings.pickyMode) body.set('level', 'picky');
  if (premium) {
    body.set('username', settings.languageToolUser);
    body.set('apiKey', settings.languageToolKey);
  }
  const res = await fetch(`${base}/v2/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal,
  });
  if (!res.ok) {
    const msg = res.status === 429 ? 'LanguageTool rate limit reached — try again in a minute.' : `LanguageTool error ${res.status}`;
    throw new Error(msg);
  }
  const data = await res.json();
  return {
    language: data.language?.detectedLanguage?.name || data.language?.name,
    issues: (data.matches || []).map((m) => ({
      offset: part.start + m.offset,
      length: m.length,
      message: m.message,
      title: m.shortMessage || m.rule?.description,
      category: categoryOf(m),
      replacements: (m.replacements || []).slice(0, 5).map((r) => r.value),
      rule: m.rule?.id,
      source: 'languagetool',
    })),
  };
}

async function check(text, settings, signal) {
  const results = [];
  for (const part of chunk(text)) results.push(await checkChunk(part, settings, signal));
  return {
    language: results[0]?.language,
    issues: results.flatMap((r) => r.issues),
  };
}

module.exports = { check, chunk, categoryOf };
