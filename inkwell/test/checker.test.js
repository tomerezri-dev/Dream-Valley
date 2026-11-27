const test = require('node:test');
const assert = require('node:assert');
const local = require('../src/checker/localRules');
const lt = require('../src/checker/languagetool');
const { toIssues } = require('../src/checker/claude');

const found = (text) => local.check(text).map((i) => [text.substr(i.offset, i.length), i.replacements[0]]);

test('offline rules catch common mistakes', () => {
  const r = found('i think teh plan is very unique , we should of known.');
  assert.deepEqual(r.find(([s]) => s === 'teh'), ['teh', 'the']);
  assert.deepEqual(r.find(([s]) => s === 'should of'), ['should of', 'should have']);
  assert.deepEqual(r.find(([s]) => s === 'very unique'), ['very unique', 'unique']);
  assert.ok(r.some(([s, rep]) => s === 'i' && rep === 'I'));
  assert.ok(r.some(([s, rep]) => s === ' ' && rep === ''));
});

test('a/an handles vowel sounds and exceptions', () => {
  assert.deepEqual(found('It was a honest mistake.').filter(([s]) => s === 'a'), [['a', 'an']]);
  assert.deepEqual(found('She went to a university.').filter(([s]) => s === 'a'), []);
  assert.deepEqual(found('An cat sat.').filter(([s]) => s === 'An'), [['An', 'A']]);
});

test('offline rules leave clean text alone', () => {
  assert.deepEqual(local.check('This is a clean sentence. It has no mistakes, e.g. none at all.'), []);
});

test('repeated words and capitalisation', () => {
  const r = found('We went to the the store. then we left.');
  assert.ok(r.some(([s, rep]) => s === 'the the' && rep === 'the'));
  assert.ok(r.some(([s, rep]) => s === 't' && rep === 'T'));
});

test('LanguageTool responses are mapped', async () => {
  const realFetch = global.fetch;
  let sent;
  global.fetch = async (url, opts) => {
    sent = { url, body: String(opts.body) };
    return {
      ok: true,
      json: async () => ({
        language: { name: 'English (US)' },
        matches: [
          { offset: 0, length: 5, message: 'Did you mean "They\'re"?', shortMessage: 'Confused word',
            replacements: [{ value: "They're" }], rule: { id: 'YOUR_YOU_RE', issueType: 'grammar', category: { id: 'CONFUSED_WORDS' } } },
          { offset: 15, length: 7, message: 'Possible spelling mistake', replacements: [{ value: 'receive' }],
            rule: { id: 'MORFOLOGIK', issueType: 'misspelling', category: { id: 'TYPOS' } } },
        ],
      }),
    };
  };
  try {
    const r = await lt.check('Their going to recieve it', { language: 'auto', preferredVariants: 'en-US' });
    assert.match(sent.url, /api\.languagetool\.org\/v2\/check$/);
    assert.match(sent.body, /preferredVariants=en-US/);
    assert.deepEqual(r.issues.map((i) => [i.offset, i.category, i.replacements[0]]), [[0, 'clarity', "They're"], [15, 'spelling', 'receive']]);
  } finally {
    global.fetch = realFetch;
  }
});

test('LanguageTool chunks long text with correct offsets', () => {
  const para = 'word '.repeat(2000) + '\n';
  const text = para.repeat(4);
  const parts = lt.chunk(text);
  assert.ok(parts.length > 1);
  assert.equal(parts.map((p) => p.text).join(''), text);
  for (const p of parts) assert.equal(text.substr(p.start, p.text.length), p.text);
});

test('Claude spans are located in order', () => {
  const text = 'teh cat and teh dog';
  const r = toIssues(text, [
    { original: 'teh', replacement: 'the', explanation: 'x', category: 'spelling' },
    { original: 'teh dog', replacement: 'the dog', explanation: 'x', category: 'spelling' },
    { original: 'missing', replacement: 'y', explanation: 'x', category: 'grammar' },
  ]);
  assert.deepEqual(r.map((i) => i.offset), [0, 12]);
});
