# Shared Lists — iPhone PWA (TickTick-style)

## Goal
A Hebrew (RTL) task app in the style of TickTick that my family/friends and I use on iPhone.
Lists can be shared with specific people, who do **not** need any special account beyond signing in with email.
It must feel like a real app: installable to the iPhone home screen, push reminders, works offline.

A working prototype is in `prototype.html` (single file, ran inside Claude artifacts with a
proprietary `claude.use("db")` API). Use it as the **design and behaviour reference** — look,
layout, Hebrew wording, quick-add parsing, grouping — but do not reuse its data layer.

## Stack
- Vite + React + TypeScript
- `vite-plugin-pwa` (manifest + service worker)
- Supabase: Postgres, Auth (email magic link), Realtime, Row Level Security, Edge Functions, pg_cron
- Web Push (VAPID) via the `web-push` library inside a Supabase Edge Function
- Hosting: Vercel (free Hobby tier), deployed from a GitHub repo
- Tests: Vitest for pure logic
- Keep dependencies minimal. No UI framework required; plain CSS (CSS variables, light/dark via `prefers-color-scheme`) is fine.

## Target platform
- iPhone Safari, iOS 16.4+ (needed for Web Push), installed via "Add to Home Screen"
- Must also work in desktop Chrome/Safari
- `dir="rtl"`, `lang="he"`, Heebo font, safe-area insets (`viewport-fit=cover` + `env(safe-area-inset-*)`)
- 44px minimum tap targets, 16px inputs (prevents iOS zoom)

## Features

### Carried over from the prototype
- Smart views: Today (incl. overdue), Next 7 days, All, Completed
- Lists with name + colour; sidebar on desktop, slide-in drawer on phone
- Tasks grouped: Overdue / Today / Tomorrow / This week / Later / No date
- Quick add bar with "Today"/"Tomorrow" chips and priority flag
- Quick-add parsing: trailing `היום`, `מחר`, `מחרתיים` set the due date; trailing `!` sets high priority
- Task detail sheet: title, due date, priority (none/low/medium/high), list, assignee, notes, subtasks, delete
- Search across titles and notes
- Undo toast after deleting a task
- Completed tasks hidden behind "show N completed"

### New
1. **Accounts** — email magic-link sign-in. A `profiles` row with display name (asked on first login).
2. **Per-list sharing** — each list has members with role `owner` or `editor`.
   - Owner invites by creating an invite link (random token, expires in 7 days); anyone signed in who opens it joins as editor.
   - Owner can remove members and delete the list; editors can edit tasks, leave the list.
   - Lists with only one member are effectively private. Show a "shared with N" indicator.
3. **Realtime** — changes by other members appear live (Supabase Realtime on `tasks`, `lists`, `list_members`).
4. **Reminders + push notifications**
   - Task can have a reminder time (`remind_at`). Presets: at due time 09:00, 1 hour before, custom.
   - Settings screen: "Enable notifications" button (permission must be requested from a user tap; on iOS only works when launched from the home screen — detect and explain this in Hebrew if not installed).
   - Push goes to the assignee; if no assignee, to all members of the list.
   - Notification click opens the task.
5. **Recurring tasks** — `daily`, `weekdays` (Sun–Thu, Israeli week), `weekly`, `monthly`, `yearly`, or every N days.
   Completing a recurring task marks it done and creates the next occurrence (copy title, list, priority, assignee, subtasks unchecked, reminder shifted by the same offset).
6. **Manual ordering** — drag to reorder tasks within a list (touch-friendly; store a `sort_order` float, insert between neighbours).
7. **Offline**
   - App shell cached by the service worker.
   - Last-known data cached in IndexedDB and shown immediately on launch.
   - Writes made offline are queued and replayed in order when back online; show a small "offline — changes will sync" banner.
   - Conflict policy: last write wins per field.

### Out of scope for the PWA (possible native phase later)
Home-screen widgets, Siri, Live Activities — iOS does not allow these for web apps.

## Data model (Supabase / Postgres)

```
profiles        (id uuid pk = auth.users.id, display_name text, created_at)
lists           (id uuid pk, name text, color text, created_by uuid, created_at)
list_members    (list_id uuid, user_id uuid, role text check in ('owner','editor'), joined_at, pk(list_id,user_id))
list_invites    (token text pk, list_id uuid, created_by uuid, expires_at timestamptz)
tasks           (id uuid pk, list_id uuid fk on delete cascade, title text, notes text,
                 due_date date null, remind_at timestamptz null, reminder_sent_at timestamptz null,
                 priority smallint 0-3, done bool, done_at timestamptz null,
                 assignee uuid null, recurrence jsonb null, subtasks jsonb default '[]',
                 sort_order double precision, created_by uuid, created_at, updated_at)
push_subscriptions (id uuid pk, user_id uuid, endpoint text unique, p256dh text, auth text, created_at)
```

- Write the schema as SQL migrations in `supabase/migrations/`.
- `updated_at` trigger on tasks.
- Accepting an invite goes through a `security definer` RPC `accept_invite(token)` that validates expiry and inserts into `list_members`.
- Creating a list goes through an RPC (or trigger) that also inserts the creator as `owner`.

### Row Level Security (must be on for every table)
- `lists`, `tasks`: select/insert/update/delete only if the user is a member of the list (helper SQL function `is_member(list_id)`).
- Deleting a list and managing members: owner only.
- `profiles`: a user can read profiles of people who share at least one list with them; update only their own.
- `push_subscriptions`: user manages only their own rows.
- Add a short SQL test script that checks a non-member cannot read another list's tasks.

## Reminders pipeline
- Edge Function `send-reminders`: selects tasks where `remind_at <= now()` and `reminder_sent_at is null` and `done = false`,
  sends Web Push to the right users, sets `reminder_sent_at`. Remove subscriptions that return 404/410.
- Scheduled every minute with `pg_cron` + `pg_net`.
- When `remind_at` changes, reset `reminder_sent_at` to null (trigger).
- VAPID keys and the service-role key live only in Supabase secrets, never in the frontend or the repo.

## Security & config
- `.env.local` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; commit only `.env.example`.
- Never put the service-role key in client code.
- Render all user text as text (React does this by default — no `dangerouslySetInnerHTML`).
- Validate list colours against a fixed palette.

## Tests (Vitest)
- Quick-add parsing
- Date grouping (overdue/today/tomorrow/week/later/none) — use the device's local date, not UTC
- Recurrence: next-occurrence calculation, including month-end (Jan 31 → Feb 28/29) and weekdays skipping Fri/Sat

## Build phases — stop after each phase so I can test on my iPhone
1. **Scaffold + auth + lists/tasks CRUD** with RLS, matching the prototype's UI. Deploy to Vercel.
2. **Sharing** (invite links, members, roles) + **Realtime**.
3. **PWA install + offline** (manifest, icons incl. `apple-touch-icon`, service worker, IndexedDB cache, write queue).
4. **Reminders + Web Push** (settings screen, subscriptions, edge function, cron).
5. **Recurring tasks + drag to reorder.**

At the end of each phase:
- Tell me exactly what to click in the Supabase / Vercel / GitHub dashboards (I'm comfortable with IT admin work, less with coding).
- List what I should test on the iPhone.
- Commit with a clear message.

## Optional phase 6 — native iOS client
A SwiftUI app using the same Supabase backend (`supabase-swift`), adding a home-screen widget (WidgetKit)
and Siri/Shortcuts "add task" (App Intents). I have a MacBook Air M1 with Xcode.
Only start this if I ask for it.
