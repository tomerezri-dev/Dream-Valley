const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/shared/textops');

const iss = (offset, length, rep, extra = {}) => ({ id: `${offset}`, offset, length, replacements: [rep], category: 'grammar', ...extra });

test('applyAll fixes every issue right-to-left', () => {
  const text = 'teh cat sat on teh mat';
  const r = T.applyAll(text, [iss(0, 3, 'the'), iss(15, 3, 'the')]);
  assert.equal(r.text, 'the cat sat on the mat');
  assert.equal(r.applied, 2);
});

test('applyIssue shifts later issues and keeps earlier ones', () => {
  const text = 'a teh b teh c';
  const a = iss(2, 3, 'the');
  const b = iss(8, 3, 'the');
  const first = iss(0, 1, 'A');
  const r = T.applyIssue(text, [first, a, b], a, 'the!!');
  assert.equal(r.text, 'a the!! b teh c');
  assert.deepEqual(r.issues.map((i) => i.offset), [0, 10]);
});

test('adjustForEdit drops touched issues and shifts the rest', () => {
  const old = 'teh cat and teh dog';
  const issues = [iss(0, 3, 'the'), iss(12, 3, 'the')];
  const next = 'teh big cat and teh dog';
  const r = T.adjustForEdit(old, next, issues);
  assert.deepEqual(r.map((i) => i.offset), [0, 16]);
  const typedIntoWord = T.adjustForEdit(old, 'tehx cat and teh dog', issues);
  assert.deepEqual(typedIntoWord.map((i) => i.offset), [13]);
});

test('normalize removes overlaps; merge prefers primary', () => {
  const p = [iss(0, 5, 'x')];
  const s = [iss(3, 4, 'y'), iss(10, 2, 'z')];
  assert.deepEqual(T.merge(p, s).map((i) => i.offset), [0, 10]);
});

test('stats counts words and scores', () => {
  const s = T.stats('One two three four.', []);
  assert.equal(s.words, 4);
  assert.equal(s.score, 100);
  assert.ok(T.stats('One two three four.', [{ category: 'spelling' }]).score < 100);
});

test('diffWords marks additions and deletions', () => {
  const d = T.diffWords('the quick fox', 'the slow fox');
  assert.deepEqual(d.filter((p) => p.type !== 'same').map((p) => [p.type, p.text]), [['del', 'quick'], ['add', 'slow']]);
});
