export type Priority = 0 | 1 | 2 | 3;
export type Subtask = { t: string; d: boolean };

export interface Task {
  id: string;
  list_id: string;
  title: string;
  notes: string;
  due_date: string | null; // YYYY-MM-DD, local calendar date
  remind_at: string | null;
  priority: Priority;
  done: boolean;
  done_at: string | null;
  assignee: string | null;
  subtasks: Subtask[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface List {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export interface Member {
  list_id: string;
  user_id: string;
  role: 'owner' | 'editor';
}

export interface Profile {
  id: string;
  display_name: string;
}
