import type { ReactNode } from 'react';
import { safeColor } from '../lib/colors';
import type { List } from '../types';
import { Avatar, Check, IcAll, IcDone, IcToday, IcWeek } from './Icons';

export const SMART: { k: string; name: string; icon: ReactNode }[] = [
  { k: 'today', name: 'היום', icon: <IcToday /> },
  { k: 'week', name: '7 הימים הקרובים', icon: <IcWeek /> },
  { k: 'all', name: 'כל המשימות', icon: <IcAll /> },
  { k: 'done', name: 'הושלמו', icon: <IcDone /> },
];

interface Props {
  open: boolean;
  view: string;
  q: string;
  lists: List[];
  counts: Record<string, number>;
  myName: string;
  onQ: (q: string) => void;
  onView: (v: string) => void;
  onNewList: () => void;
  onAccount: () => void;
}

export function Sidebar({ open, view, q, lists, counts, myName, onQ, onView, onNewList, onAccount }: Props) {
  const nav = (v: string, icon: ReactNode, name: string) => (
    <button key={v} className={'nav' + (view === v && !q ? ' on' : '')} onClick={() => onView(v)}>
      {icon}<span className="nm">{name}</span><span className="n">{counts[v] || ''}</span>
    </button>
  );
  return (
    <aside className={open ? 'on' : ''} aria-label="ניווט">
      <div className="brand"><i><Check /></i>רשימות</div>
      <input className="search" type="search" placeholder="חיפוש משימות" aria-label="חיפוש משימות"
        value={q} onChange={e => onQ(e.target.value)} />
      {SMART.map(s => nav(s.k, s.icon, s.name))}
      <div className="sec"><span>הרשימות שלי</span><button onClick={onNewList} aria-label="רשימה חדשה">+</button></div>
      {lists.map(l => nav('l:' + l.id, <i className="dot" style={{ background: safeColor(l.color) }} />, l.name))}
      {!lists.length && <p className="mute small pad">אין עדיין רשימות</p>}
      <div className="grow" />
      <button className="nav" onClick={onAccount}><Avatar name={myName} size={24} /><span className="nm">{myName}</span></button>
    </aside>
  );
}
