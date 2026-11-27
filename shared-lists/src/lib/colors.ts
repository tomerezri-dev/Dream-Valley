// Must match the check constraint on lists.color in the migration.
export const COLORS = ['#4772fa', '#e5484d', '#f59e0b', '#30a46c', '#8e4ec6', '#0ea5b7', '#e93d82', '#6b7280'] as const;
export const safeColor = (c: string | null | undefined) =>
  COLORS.includes((c ?? '') as (typeof COLORS)[number]) ? (c as string) : '#6b7280';

export const PRIORITY: Record<number, { name: string; color: string }> = {
  3: { name: 'גבוהה', color: 'var(--hi)' },
  2: { name: 'בינונית', color: 'var(--md)' },
  1: { name: 'נמוכה', color: 'var(--lo)' },
  0: { name: 'ללא', color: 'var(--mute)' },
};
