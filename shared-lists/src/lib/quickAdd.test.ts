import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickAdd';

const base = new Date(2026, 10, 27, 12, 0);

describe('parseQuickAdd', () => {
  it('leaves plain text alone', () => {
    expect(parseQuickAdd('לקנות חלב', base)).toEqual({ title: 'לקנות חלב' });
  });

  it.each([
    ['לקנות חלב היום', '2026-11-27'],
    ['לקנות חלב מחר', '2026-11-28'],
    ['לקנות חלב מחרתיים', '2026-11-29'],
  ])('%s', (text, due) => {
    expect(parseQuickAdd(text, base)).toEqual({ title: 'לקנות חלב', due });
  });

  it('sets high priority from a trailing "!"', () => {
    expect(parseQuickAdd('להתקשר לרופא!', base)).toEqual({ title: 'להתקשר לרופא', priority: 3 });
    expect(parseQuickAdd('להתקשר לרופא !!', base)).toEqual({ title: 'להתקשר לרופא', priority: 3 });
  });

  it('combines a date word and "!" in either order', () => {
    expect(parseQuickAdd('לשלם חשבון מחר!', base)).toEqual({ title: 'לשלם חשבון', due: '2026-11-28', priority: 3 });
    expect(parseQuickAdd('לשלם חשבון ! מחר', base)).toEqual({ title: 'לשלם חשבון', due: '2026-11-28', priority: 3 });
  });

  it('only matches whole words at the end', () => {
    expect(parseQuickAdd('ארוחת שחר', base)).toEqual({ title: 'ארוחת שחר' });
    expect(parseQuickAdd('מחר לקנות חלב', base)).toEqual({ title: 'מחר לקנות חלב' });
  });

  it('never empties the title', () => {
    expect(parseQuickAdd('מחר', base)).toEqual({ title: 'מחר' });
    expect(parseQuickAdd('!', base)).toEqual({ title: '!' });
  });

  it('trims whitespace', () => {
    expect(parseQuickAdd('  לכבס   היום  ', base)).toEqual({ title: 'לכבס', due: '2026-11-27' });
  });
});
