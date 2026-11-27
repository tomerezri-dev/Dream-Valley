import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { COLORS, PRIORITY } from '../lib/colors';
import { BUCKET_NAMES, dayOff, today, ymd } from '../lib/dates';
import { parseQuickAdd } from '../lib/quickAdd';
import { doneTasks, filterTasks, groupOpen, isListView } from '../lib/views';
import { errorText, sb } from '../supabase';
import type { Priority, Profile, Task } from '../types';
import { useData } from '../useData';
import { AccountSheet } from './AccountSheet';
import { Empty, Flag, IcMenu, IcMore } from './Icons';
import { ListSheet } from './ListSheet';
import { SMART, Sidebar } from './Sidebar';
import { TaskRow } from './TaskRow';
import { TaskSheet } from './TaskSheet';
import { Toast, type ToastMsg } from './Toast';

type SheetState = { kind: 'task'; id: string } | { kind: 'list'; id: string | null } | { kind: 'account' } | null;

const VIEW_KEY = 'sl-view';
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || 'today'; } catch { return 'today'; } };

export function Planner({ me, email, profile, onProfile }: {
  me: string; email: string; profile: Profile; onProfile: (p: Profile) => void;
}) {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const notify = useCallback((msg: string, undo?: () => void) => setToast({ msg, undo, key: Date.now() }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const data = useData(me, notify);

  const [view, setViewState] = useState(readView);
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [addDue, setAddDue] = useState<number | null>(null);
  const [addPr, setAddPr] = useState<Priority>(0);
  const [text, setText] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [now, setNow] = useState(() => new Date());

  // Roll the date groups over at midnight.
  useEffect(() => {
    const iv = setInterval(() => setNow(n => (ymd(n) === ymd(new Date()) ? n : new Date())), 30_000);
    return () => clearInterval(iv);
  }, []);

  const setView = useCallback((v: string) => {
    setViewState(v); setQ(''); setShowDone(false); setDrawer(false);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ }
    window.scrollTo(0, 0);
  }, []);

  const list = isListView(view) ? data.lists.find(l => l.id === view.slice(2)) : undefined;
  useEffect(() => {
    if (data.loaded && isListView(view) && !list) setView('today');
  }, [data.loaded, view, list, setView]);

  const nameOf = useCallback(
    (uid: string) => (uid === me ? 'אני' : data.profiles[uid]?.display_name || 'משתתף'),
    [me, data.profiles],
  );
  const membersOf = useCallback(
    (listId: string) => data.members.filter(m => m.list_id === listId).map(m => m.user_id),
    [data.members],
  );
  const listById = useMemo(() => Object.fromEntries(data.lists.map(l => [l.id, l])), [data.lists]);

  const counts = useMemo(() => {
    const T = today(now), W = dayOff(7, now), open = data.tasks.filter(t => !t.done);
    const c: Record<string, number> = {
      today: open.filter(t => t.due_date && t.due_date <= T).length,
      week: open.filter(t => t.due_date && t.due_date <= W).length,
      all: open.length,
    };
    for (const t of open) c['l:' + t.list_id] = (c['l:' + t.list_id] || 0) + 1;
    return c;
  }, [data.tasks, now]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const raw = text.trim();
    if (!raw) return;
    const p = parseQuickAdd(raw, now);
    let due = p.due ?? (addDue === null ? null : dayOff(addDue, now));
    if (!due && (view === 'today' || view === 'week')) due = today(now);
    const listId = list?.id ?? data.lists[0]?.id ?? (await data.createList('כללי', COLORS[0]));
    if (!listId) return;
    setText(''); setAddDue(null); setAddPr(0);
    const ok = await data.addTask({ list_id: listId, title: p.title, due_date: due, priority: p.priority ?? addPr });
    if (!ok) setText(raw);
  }

  const toggle = (t: Task) =>
    data.updateTask(t.id, { done: !t.done, done_at: t.done ? null : new Date().toISOString() });

  async function removeTask(id: string) {
    setSheet(null);
    const orig = await data.deleteTask(id);
    if (orig) notify('המשימה נמחקה', () => data.restoreTask(orig));
  }

  async function saveName(display_name: string) {
    const { data: p, error } = await sb.from('profiles').update({ display_name }).eq('id', me).select('id,display_name').single();
    if (error) notify(errorText(error));
    else { onProfile(p as Profile); data.setMyProfile(p as Profile); }
  }

  // ---------- task pane ----------
  const qq = q.trim();
  const all = filterTasks(data.tasks, view, qq, now);
  const done = doneTasks(all, view, qq, now);
  const row = (t: Task) => (
    <TaskRow key={t.id} task={t} now={now} list={isListView(view) ? undefined : listById[t.list_id]}
      assigneeName={t.assignee ? nameOf(t.assignee) : undefined}
      onToggle={() => toggle(t)} onOpen={() => setSheet({ kind: 'task', id: t.id })} />
  );

  let pane;
  if (!data.loaded) pane = <p className="empty">טוען…</p>;
  else if (data.failed && !data.tasks.length) pane = <Empty title="הנתונים לא נטענים" sub="בדקו את החיבור לאינטרנט ונסו שוב." />;
  else if (view === 'done' && !qq) {
    pane = done.length ? <section className="grp">{done.map(row)}</section> : <Empty title="עוד לא הושלמו משימות" sub="משימות שתסמנו יופיעו כאן." />;
  } else {
    const groups = groupOpen(all, now);
    const openCount = groups.reduce((n, g) => n + g.length, 0);
    pane = (
      <>
        {groups.map((g, i) => g.length > 0 && (
          <section className="grp" key={i}>
            <h2 className={i === 0 ? 'late' : ''}>{BUCKET_NAMES[i]}<span>{g.length}</span></h2>
            {g.map(row)}
          </section>
        ))}
        {!openCount && (qq ? <Empty title="לא נמצאו משימות" /> :
          <Empty title={view === 'today' ? 'אין משימות להיום' : 'אין משימות פתוחות'} sub="הוסיפו משימה בשורה למעלה." />)}
        {done.length > 0 && (
          <>
            <button className="donebtn" onClick={() => setShowDone(s => !s)}>{showDone ? 'הסתרת' : 'הצגת'} {done.length} שהושלמו</button>
            {showDone && <section className="grp">{done.map(row)}</section>}
          </>
        )}
      </>
    );
  }

  const title = qq ? 'תוצאות חיפוש' : list ? list.name : (SMART.find(s => s.k === view) ?? SMART[0]).name;
  const sheetTask = sheet?.kind === 'task' ? data.tasks.find(t => t.id === sheet.id) : undefined;
  const sheetList = sheet?.kind === 'list' && sheet.id ? listById[sheet.id] ?? null : null;
  const myName = profile.display_name;

  return (
    <div className="app">
      <Sidebar open={drawer} view={view} q={q} lists={data.lists} counts={counts} myName={myName}
        onQ={setQ} onView={setView}
        onNewList={() => { setDrawer(false); setSheet({ kind: 'list', id: null }); }}
        onAccount={() => { setDrawer(false); setSheet({ kind: 'account' }); }} />
      {drawer && <div className="scrim on" onClick={() => setDrawer(false)} />}

      <main>
        <div className="top">
          <button className="ib menu" onClick={() => setDrawer(true)} aria-label="תפריט"><IcMenu /></button>
          <h1>{title}</h1>
          {list && <button className="ib" onClick={() => setSheet({ kind: 'list', id: list.id })} aria-label="עריכת רשימה"><IcMore /></button>}
        </div>
        {data.failed && data.tasks.length > 0 && <div className="banner">ייתכן שהנתונים לא מעודכנים – אין חיבור כרגע.</div>}

        {view !== 'done' && (
          <form className="add" onSubmit={submit}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="הוספת משימה…" enterKeyHint="send"
              autoComplete="off" maxLength={300} aria-label="משימה חדשה" />
            {[0, 1].map(d => (
              <button type="button" key={d} className={'chip' + (addDue === d ? ' on' : '')}
                onClick={() => setAddDue(addDue === d ? null : d)}>{d ? 'מחר' : 'היום'}</button>
            ))}
            <button type="button" className={'chip' + (addPr ? ' on' : '')} aria-label={'עדיפות: ' + PRIORITY[addPr].name}
              onClick={() => setAddPr(([3, 0, 1, 2] as Priority[])[addPr])}><Flag color={PRIORITY[addPr].color} /></button>
          </form>
        )}
        <p className="hint">אפשר לכתוב ״מחר״ או ״היום״ בסוף המשפט, ו־! לעדיפות גבוהה.</p>
        <div className="tasks">{pane}</div>
      </main>

      {sheetTask && (
        <TaskSheet key={sheetTask.id} task={sheetTask} lists={data.lists} membersOf={membersOf} nameOf={nameOf}
          onSave={patch => data.updateTask(sheetTask.id, patch)} onDelete={() => removeTask(sheetTask.id)}
          onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'list' && (
        <ListSheet list={sheetList}
          isOwner={!!sheetList && data.members.some(m => m.list_id === sheetList.id && m.user_id === me && m.role === 'owner')}
          taskCount={sheetList ? data.tasks.filter(t => t.list_id === sheetList.id).length : 0}
          defaultColor={COLORS[data.lists.length % COLORS.length]}
          onClose={() => setSheet(null)}
          onSave={async (name, color) => {
            setSheet(null);
            if (sheetList) data.updateList(sheetList.id, { name, color });
            else { const id = await data.createList(name, color); if (id) setView('l:' + id); }
          }}
          onDelete={() => {
            if (!sheetList) return;
            setSheet(null); setView('today');
            data.deleteList(sheetList.id).then(ok => ok && notify('הרשימה נמחקה'));
          }} />
      )}
      {sheet?.kind === 'account' && (
        <AccountSheet name={myName} email={email} onSaveName={saveName}
          onSignOut={() => { setSheet(null); sb.auth.signOut(); }} onClose={() => setSheet(null)} />
      )}
      <Toast t={toast} onDone={clearToast} />
    </div>
  );
}
