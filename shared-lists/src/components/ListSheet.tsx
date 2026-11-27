import { useState } from 'react';
import { COLORS } from '../lib/colors';
import type { List } from '../types';
import { Sheet } from './Sheet';

interface Props {
  list: List | null; // null = new list
  isOwner: boolean;
  taskCount: number;
  defaultColor: string;
  onSave: (name: string, color: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ListSheet({ list, isOwner, taskCount, defaultColor, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState(list?.color ?? defaultColor);
  const [armed, setArmed] = useState(false);

  const save = () => {
    const n = name.trim();
    if (n) onSave(n, color);
  };

  return (
    <Sheet label={list ? 'עריכת רשימה' : 'רשימה חדשה'} onClose={onClose}>
      <h3>{list ? 'עריכת רשימה' : 'רשימה חדשה'}</h3>
      <label htmlFor="ln">שם</label>
      <input className="f" id="ln" value={name} maxLength={60} placeholder="למשל: קניות לבית" enterKeyHint="done" autoFocus={!list}
        onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} />
      <label>צבע</label>
      <div className="colors">
        {COLORS.map(c => (
          <button key={c} style={{ background: c }} className={c === color ? 'on' : ''} onClick={() => setColor(c)}
            aria-label="צבע" aria-pressed={c === color} />
        ))}
      </div>
      <div className="acts">
        {list && isOwner ? (
          <button className="btn ghost" onClick={() => (armed ? onDelete() : setArmed(true))}>
            {armed ? (taskCount ? `לחצו שוב – יימחקו גם ${taskCount} משימות` : 'לחצו שוב למחיקה') : 'מחיקת רשימה'}
          </button>
        ) : <span />}
        <button className="btn" onClick={save} disabled={!name.trim()}>שמירה</button>
      </div>
    </Sheet>
  );
}
