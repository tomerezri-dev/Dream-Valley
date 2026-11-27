import { describe, expect, it } from 'vitest';
import { bucket, dayOff, fmtDue, localDay, today } from './dates';

// Tests run with TZ=Asia/Jerusalem (see package.json).
const base = new Date(2026, 10, 27, 12, 0); // Fri 27 Nov 2026, local noon

describe('local dates', () => {
  it('uses the local calendar day, not UTC', () => {
    // 00:30 in Israel is still 22:30 the previous day in UTC
    const justAfterMidnight = new Date('2026-11-28T00:30:00+02:00');
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-11-27');
    expect(today(justAfterMidnight)).toBe('2026-11-28');
    expect(localDay('2026-11-27T22:30:00Z')).toBe('2026-11-28');
  });

  it('offsets across month and year ends', () => {
    expect(dayOff(4, base)).toBe('2026-12-01');
    expect(dayOff(35, base)).toBe('2027-01-01');
    expect(dayOff(-27, base)).toBe('2026-10-31');
  });

  it('formats relative days in Hebrew', () => {
    expect(fmtDue('2026-11-27', base)).toBe('היום');
    expect(fmtDue('2026-11-28', base)).toBe('מחר');
    expect(fmtDue('2026-11-26', base)).toBe('אתמול');
    expect(fmtDue(null, base)).toBe('');
  });
});

describe('bucket', () => {
  it.each([
    ['2026-11-01', 0],
    ['2026-11-26', 0],
    ['2026-11-27', 1],
    ['2026-11-28', 2],
    ['2026-11-29', 3],
    ['2026-12-04', 3], // exactly 7 days ahead
    ['2026-12-05', 4],
    [null, 5],
  ] as const)('%s → %i', (due, b) => {
    expect(bucket(due, base)).toBe(b);
  });

  it('moves into "today" right after local midnight', () => {
    expect(bucket('2026-11-28', new Date('2026-11-28T00:05:00+02:00'))).toBe(1);
  });
});
