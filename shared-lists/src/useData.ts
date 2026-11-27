import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, sb } from './supabase';
import type { List, Member, Profile, Task } from './types';

type Notify = (msg: string) => void;
export type NewTask = Pick<Task, 'list_id' | 'title' | 'due_date' | 'priority'>;
export type TaskPatch = Partial<Omit<Task, 'id' | 'created_at' | 'created_by'>>;

const TASK_COLS =
  'id,list_id,title,notes,due_date,remind_at,priority,done,done_at,assignee,subtasks,sort_order,created_by,created_at';

/** Loads everything the signed-in user can see, with optimistic writes. */
export function useData(me: string, notify: Notify) {
  const [lists, setLists] = useState<List[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const load = useCallback(async () => {
    const [l, m, t] = await Promise.all([
      sb.from('lists').select('id,name,color,created_by,created_at').order('created_at'),
      sb.from('list_members').select('list_id,user_id,role'),
      sb.from('tasks').select(TASK_COLS),
    ]);
    if (l.error || m.error || t.error) {
      setFailed(true);
      setLoaded(true);
      return;
    }
    setLists(l.data as List[]);
    setMembers(m.data as Member[]);
    setTasks((t.data as Task[]).map(x => ({ ...x, subtasks: Array.isArray(x.subtasks) ? x.subtasks : [] })));
    setFailed(false);
    setLoaded(true);
    const ids = [...new Set((m.data as Member[]).map(x => x.user_id).concat(me))];
    const p = await sb.from('profiles').select('id,display_name').in('id', ids);
    if (!p.error) setProfiles(Object.fromEntries((p.data as Profile[]).map(x => [x.id, x])));
  }, [me]);

  // Phase 1: refresh when the app comes back to the foreground (Realtime arrives in phase 2).
  useEffect(() => {
    load();
    const onShow = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', load);
    const iv = setInterval(onShow, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('online', load);
      clearInterval(iv);
    };
  }, [load]);

  /** Runs a write; on failure shows a message and re-syncs from the server. */
  const write = useCallback(
    async (op: () => PromiseLike<{ error: { code?: string; message?: string } | null }>) => {
      try {
        const { error } = await op();
        if (!error) return true;
        notify(errorText(error));
      } catch (e) {
        notify(errorText(e as Error));
      }
      load();
      return false;
    },
    [load, notify],
  );

  const addTask = useCallback(
    (n: NewTask) => {
      const row: Task = {
        id: crypto.randomUUID(), notes: '', remind_at: null, done: false, done_at: null, assignee: null,
        subtasks: [], sort_order: 0, created_by: me, created_at: new Date().toISOString(), ...n,
      };
      setTasks(ts => [...ts, row]);
      return write(() => sb.from('tasks').insert({ id: row.id, ...n }));
    },
    [me, write],
  );

  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => {
      setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
      return write(() => sb.from('tasks').update(patch).eq('id', id));
    },
    [write],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const orig = tasksRef.current.find(t => t.id === id);
      setTasks(ts => ts.filter(t => t.id !== id));
      return (await write(() => sb.from('tasks').delete().eq('id', id))) ? orig : undefined;
    },
    [write],
  );

  const restoreTask = useCallback(
    (orig: Task) => {
      setTasks(ts => [...ts, orig]);
      const { created_by: _c, ...row } = orig;
      return write(() => sb.from('tasks').insert(row));
    },
    [write],
  );

  const createList = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      const { data, error } = await sb.rpc('create_list', { p_name: name, p_color: color });
      if (error || !data) {
        notify(errorText(error));
        return null;
      }
      const l = data as List;
      setLists(ls => [...ls, l]);
      setMembers(ms => [...ms, { list_id: l.id, user_id: me, role: 'owner' }]);
      return l.id;
    },
    [me, notify],
  );

  const updateList = useCallback(
    (id: string, patch: Pick<List, 'name' | 'color'>) => {
      setLists(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));
      return write(() => sb.from('lists').update(patch).eq('id', id));
    },
    [write],
  );

  const deleteList = useCallback(
    (id: string) => {
      setLists(ls => ls.filter(l => l.id !== id));
      setTasks(ts => ts.filter(t => t.list_id !== id));
      return write(() => sb.from('lists').delete().eq('id', id)); // tasks cascade in the database
    },
    [write],
  );

  const setMyProfile = useCallback((p: Profile) => setProfiles(ps => ({ ...ps, [p.id]: p })), []);

  return {
    lists, tasks, members, profiles, loaded, failed, reload: load,
    addTask, updateTask, deleteTask, restoreTask, createList, updateList, deleteList, setMyProfile,
  };
}
