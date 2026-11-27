import type { Task } from '../types';
import { bucket, dayOff, localDay, today } from './dates';

export type SmartView = 'today' | 'week' | 'all' | 'done';
export const isListView = (v: string) => v.startsWith('l:');

export function filterTasks(tasks: Task[], view: string, q: string, base: Date = new Date()): Task[] {
  if (q) {
    const s = q.toLowerCase();
    return tasks.filter(t => t.title.toLowerCase().includes(s) || (t.notes || '').toLowerCase().includes(s));
  }
  const T = today(base), W = dayOff(7, base);
  if (view === 'today') return tasks.filter(t => t.due_date && t.due_date <= T);
  if (view === 'week') return tasks.filter(t => t.due_date && t.due_date <= W);
  if (view === 'all' || view === 'done') return tasks;
  return tasks.filter(t => t.list_id === view.slice(2));
}

export const sortOpen = (a: Task, b: Task) =>
  b.priority - a.priority ||
  (a.due_date ?? '9').localeCompare(b.due_date ?? '9') ||
  a.created_at.localeCompare(b.created_at);

/** Open tasks split into the six date groups. */
export function groupOpen(tasks: Task[], base: Date = new Date()): Task[][] {
  const g: Task[][] = [[], [], [], [], [], []];
  tasks.filter(t => !t.done).sort(sortOpen).forEach(t => g[bucket(t.due_date, base)].push(t));
  return g;
}

/** Completed tasks to offer under "show N completed": smart views only show today's. */
export function doneTasks(tasks: Task[], view: string, q: string, base: Date = new Date()): Task[] {
  const T = today(base);
  return tasks
    .filter(t => t.done && (isListView(view) || q || view === 'done' || localDay(t.done_at) === T))
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
}
