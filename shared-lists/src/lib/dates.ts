// All dates are the device's local calendar date (never UTC).
const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function dayOff(n: number, base: Date = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  return ymd(d);
}

export const today = (base: Date = new Date()) => dayOff(0, base);

/** Local calendar day of an ISO timestamp. */
export const localDay = (iso: string | null | undefined) => (iso ? ymd(new Date(iso)) : '');

export function fmtDue(s: string | null, base: Date = new Date()): string {
  if (!s) return '';
  if (s === today(base)) return 'היום';
  if (s === dayOff(1, base)) return 'מחר';
  if (s === dayOff(-1, base)) return 'אתמול';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const BUCKET_NAMES = ['באיחור', 'היום', 'מחר', 'השבוע הקרוב', 'בהמשך', 'ללא תאריך'] as const;
/** 0 overdue · 1 today · 2 tomorrow · 3 next 7 days · 4 later · 5 no date */
export function bucket(due: string | null, base: Date = new Date()): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!due) return 5;
  const t = today(base);
  if (due < t) return 0;
  if (due === t) return 1;
  if (due === dayOff(1, base)) return 2;
  return due <= dayOff(7, base) ? 3 : 4;
}
