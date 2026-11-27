# רשימות · Shared Lists

A Hebrew (RTL) shared task app for iPhone and desktop, built from `SPEC.md`
with `prototype.html` as the design reference.

Stack: Vite + React + TypeScript, Supabase (Postgres, Auth, RLS), hosted on Vercel.

## Status

| Phase | | |
|---|---|---|
| 1 | Sign-in, profile, lists and tasks with RLS, prototype UI | ✅ done |
| 2 | Sharing (invite links, members, roles) + Realtime | next |
| 3 | Home-screen install + offline | |
| 4 | Reminders + Web Push | |
| 5 | Recurring tasks + drag to reorder | |

## Layout

```
src/lib/          pure logic: dates, quick-add parsing, views (unit tested)
src/components/   screens and sheets
src/useData.ts    loading and optimistic writes to Supabase
supabase/migrations/  database schema + Row Level Security
supabase/tests/rls_test.sql  checks that a non-member cannot see another list
supabase/email-templates.md  sign-in email with a typed code (needed on iPhone)
```

## Local development

```sh
cp .env.example .env.local   # fill in the Supabase URL and anon/publishable key
npm install
npm run dev                  # http://localhost:5173
npm test                     # Vitest
npm run build
```

Add `http://localhost:5173/**` to Supabase → Authentication → URL Configuration →
Redirect URLs to sign in locally.

## Security notes

- Only the public anon/publishable key is used in the browser; every table has RLS.
- The service-role/secret key must never be added to this project or to Vercel.
- List colours are checked against a fixed palette in the database.
