import { useRef, useState, type FormEvent } from 'react';
import { dayOff, today } from '../lib/dates';
import { PRIORITY } from '../lib/colors';
import type { List, Priority, Subtask, Task } from '../types';
import type { TaskPatch } from '../useData';
import { Flag } from './Icons';
import { Sheet } from './Sheet';

interface Props {
  task: Task;
  lists: List[];
  membersOf: (listId: string) => string[];
  nameOf: (uid: string) => string;
  onSave: (patch: TaskPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

const FIELDS = ['title', 'notes', 'list_id', 'assignee', 'due_date', 'priority', 'subtasks'] as const;

/** Edits a draft; changed fields are saved when the sheet closes (Done, scrim or Escape). */
export function TaskSheet({ task, lists, membersOf, nameOf, onSave, onDelete, onClose }: Props) {
  const [d, setD] = useState(() => ({ ...task, subtasks: task.subtasks.map(s => ({ ...s })) }));
  const [newSub, setNewSub] = useState('');
  const draft = useRef(d);
  draft.current = d;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setD(x => ({ ...x, [k]: v }));
  const setSubs = (f: (s: Subtask[]) => Subtask[]) => setD(x => ({ ...x, subtasks: f(x.subtasks) }));

  function close() {
    const cur = draft.current;
    const next = {
      ...cur,
      title: cur.title.trim() || task.title,
      subtasks: cur.subtasks.map(s => ({ t: s.t.trim(), d: s.d })).filter(s => s.t),
    };
    const patch: Record<string, unknown> = {};
    for (const k of FIELDS) if (JSON.stringify(next[k] ?? null) !== JSON.stringify(task[k] ?? null)) patch[k] = next[k] ?? null;
    if (Object.keys(patch).length) onSave(patch as TaskPatch);
    onClose();
  }

  function addSub(e: FormEvent) {
    e.preventDefault();
    const t = newSub.trim();
    if (!t) return;
    setSubs(s => [...s, { t, d: false }]);
    setNewSub('');
  }

  const T = today();
  const people = [...new Set([...membersOf(d.list_id), ...(d.assignee ? [d.assignee] : [])])];
  const presets: [string, string | null][] = [['ללא', null], ['היום', T], ['מחר', dayOff(1)], ['בעוד שבוע', dayOff(7)]];

  return (
    <Sheet label="פרטי משימה" onClose={close}>
      <input className="ttl" value={d.title} onChange={e => set('title', e.target.value)} maxLength={300} aria-label="כותרת" />

      <label>תאריך יעד</label>
      <div className="row">
        {presets.map(([n, v]) => (
          <button key={n} className={'pr' + (d.due_date === v ? ' on' : '')} onClick={() => set('due_date', v)}>{n}</button>
        ))}
        <input type="date" className="f date" value={d.due_date ?? ''} onChange={e => set('due_date', e.target.value || null)} aria-label="תאריך" />
      </div>

      <label>עדיפות</label>
      <div className="row">
        {([3, 2, 1, 0] as Priority[]).map(p => (
          <button key={p} className={'pr' + (d.priority === p ? ' on' : '')} style={{ ['--p' as string]: PRIORITY[p].color }}
            onClick={() => set('priority', p)}>
            <Flag color={PRIORITY[p].color} />{PRIORITY[p].name}
          </button>
        ))}
      </div>

      <div className="row two">
        <div>
          <label htmlFor="sl">רשימה</label>
          <select className="f" id="sl" value={d.list_id} onChange={e => set('list_id', e.target.value)}>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sa">אחראי/ת</label>
          <select className="f" id="sa" value={d.assignee ?? ''} onChange={e => set('assignee', e.target.value || null)}>
            <option value="">ללא</option>
            {people.map(u => <option key={u} value={u}>{nameOf(u)}</option>)}
          </select>
        </div>
      </div>

      <label htmlFor="sn">הערות</label>
      <textarea className="f" id="sn" value={d.notes} onChange={e => set('notes', e.target.value)} maxLength={10000} />

      <label>תת־משימות</label>
      {d.subtasks.map((s, i) => (
        <div className="sub" key={i}>
          <button className={'ck' + (s.d ? ' on' : '')} aria-label={s.d ? 'ביטול סימון' : 'סימון'}
            onClick={() => setSubs(xs => xs.map((x, j) => (j === i ? { ...x, d: !x.d } : x)))} />
          <input value={s.t} maxLength={200} aria-label="תת־משימה"
            onChange={e => setSubs(xs => xs.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))} />
          <button className="x" aria-label="הסרה" onClick={() => setSubs(xs => xs.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <form className="sub" onSubmit={addSub}>
        <span className="plus">+</span>
        <input value={newSub} onChange={e => setNewSub(e.target.value)} placeholder="הוספת תת־משימה" enterKeyHint="done" maxLength={200} aria-label="תת־משימה חדשה" />
      </form>

      <div className="acts">
        <button className="btn ghost" onClick={onDelete}>מחיקה</button>
        <button className="btn" onClick={close}>סיום</button>
      </div>
    </Sheet>
  );
}
