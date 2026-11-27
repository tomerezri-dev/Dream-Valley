import { fmtDue, today } from '../lib/dates';
import { PRIORITY, safeColor } from '../lib/colors';
import type { List, Task } from '../types';
import { Avatar, IcNotes, IcSubs } from './Icons';

interface Props {
  task: Task;
  list?: List;       // shown when not inside that list's own view
  assigneeName?: string;
  now: Date;
  onToggle: () => void;
  onOpen: () => void;
}

export function TaskRow({ task: x, list, assigneeName, now, onToggle, onOpen }: Props) {
  const T = today(now);
  const dueCls = x.due_date && x.due_date < T && !x.done ? 'late' : x.due_date === T ? 'tod' : '';
  const subsDone = x.subtasks.filter(s => s.d).length;
  const meta = [
    x.due_date && <span key="d" className={dueCls}>{fmtDue(x.due_date, now)}</span>,
    x.subtasks.length > 0 && <span key="s" className="lt"><IcSubs />{subsDone}/{x.subtasks.length}</span>,
    x.notes && <span key="n" className="lt"><IcNotes /></span>,
    list && <span key="l" className="lt"><i className="dot" style={{ background: safeColor(list.color) }} />{list.name}</span>,
    assigneeName && <span key="a" className="lt"><Avatar name={assigneeName} size={18} />{assigneeName}</span>,
  ].filter(Boolean);
  return (
    <div className={'task' + (x.done ? ' done' : '')}>
      <button className="ck" style={{ ['--p' as string]: PRIORITY[x.priority]?.color ?? 'var(--mute)' }} onClick={onToggle}
        aria-label={x.done ? 'החזרה למשימות פתוחות' : 'סימון כהושלם'} />
      <button className="body" onClick={onOpen}>
        <span className="tt">{x.title}</span>
        {meta.length > 0 && <span className="meta">{meta}</span>}
      </button>
    </div>
  );
}
