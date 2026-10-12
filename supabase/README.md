# Supabase backup and restore

Everything needed to rebuild the hosted Supabase project (`bmixjsxxckvvwnvhpuwl`)
from nothing lives in three places:

| What | Where | In git? |
|---|---|---|
| Schema, RLS policies, functions, signup trigger, extensions, cron job | `supabase/migrations/*.sql` (11 files, byte-identical to the hosted migration history) | yes |
| Table rows, auth users, point-in-time schema dump, cron/extension snapshot | `backups/<timestamp>/` produced by `npm run backup:supabase` | **no** (gitignored: contains emails + password hashes) |
| Dashboard-only settings (auth URLs, email templates) | This file, section "Dashboard settings" | documented |

The app has no edge functions and no storage buckets, so there is nothing else to back up.

## Take a backup

One-time setup:

```bash
brew install libpq supabase/tap/supabase
```

Add the Postgres connection string to `.env` (see `.env.example`). Use the
**Session pooler** URL from Dashboard → Connect → Session mode. The direct
`db.<ref>.supabase.co` host is IPv6-only on the Free plan and usually fails from
home networks. The password is under Project Settings → Database.

Then:

```bash
npm run backup:supabase
```

Output lands in `backups/<YYYY-MM-DD_HHMMSS>/`:

| File | Contents |
|---|---|
| `schema.sql` | `pg_dump --schema-only --schema=public`: tables, indexes, functions, RLS policies, grants |
| `auth_trigger.sql` | `on_auth_user_created` trigger definition (it lives on `auth.users`, outside the public schema) |
| `extensions.sql` | `create extension` lines for everything installed |
| `cron_jobs.sql` | `cron.schedule(...)` for every pg_cron job |
| `data.sql` | All public rows in COPY format, FK-ordered |
| `auth_users.sql` | `auth.users` + `auth.identities` rows |
| `auth_config.json` | Auth settings from the Management API, only if `SUPABASE_ACCESS_TOKEN` is set |
| `manifest.txt` | Tool/server versions, row counts, migration history |

Copy the folder somewhere off this machine (iCloud, Drive, an external disk).

## Restore: recreate the project from scratch

1. **Create a new Supabase project** in the dashboard. Note the new project ref,
   publishable (anon) key, and database password.

2. **Apply the migrations**:

   ```bash
   supabase login                      # once per machine
   supabase link --project-ref <new-ref>
   supabase db push
   ```

   This replays all 11 migrations in order and creates the tables, RLS policies,
   `handle_new_user` / `get_career_stats` / `heartbeat` functions, the signup
   trigger, the `pg_cron` and `pg_net` extensions, the 33 seed teams, and the
   `heartbeat-hourly` cron job. The job will point at the *old* project; fix it
   in step 4.

   If the CLI is unavailable, paste the migration files into the SQL editor in
   filename order instead. Note that `supabase db push` then won't know they were
   applied; run `supabase migration repair --status applied <version>` for each.

3. **Restore the data** with `psql` against the new project's session-pooler
   URL. Order matters because `profiles` references `auth.users` and `picks`
   references `profiles`:

   ```bash
   export NEW_DB_URL='postgresql://postgres.<new-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
   psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f backups/<stamp>/auth_users.sql
   psql "$NEW_DB_URL" -c 'delete from public.profiles;'
   psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f backups/<stamp>/data.sql
   ```

   The `delete from public.profiles` step is needed because inserting
   `auth.users` fires the signup trigger, which creates stub profile rows that
   would collide with the real ones in `data.sql`.

   `data.sql` also re-inserts the 33 seed teams and the 2026 season that the
   migrations already created. If that fails on a unique constraint, delete
   those rows first: `delete from public.rounds; delete from public.seasons;
   delete from public.teams;` (nothing references them yet at that point).

   Users keep their passwords because `auth.users` carries the bcrypt hashes.

4. **Re-point the heartbeat cron job** at the new project. In the SQL editor:

   ```sql
   select cron.unschedule('heartbeat-hourly');
   ```

   then re-run the `cron.schedule(...)` block from
   `migrations/20260928161339_add_heartbeat.sql` with the new project URL and
   publishable key substituted.

5. **Dashboard settings** (see next section).

6. **Point the app at the new project**:
   - `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`
   - GitHub repo secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (used by `.github/workflows/deploy.yml`)
   - `.mcp.json`: `project_ref` in the Supabase MCP URL
   - `supabase/config.toml`: `project_id` (the CLI rewrites this on `supabase link`)

7. **Confirm an admin exists**. Admin flags are restored with `profiles`, but if
   you start from a fresh signup:

   ```sql
   update public.profiles set is_admin = true where id = '<user uuid>';
   ```

## Restore: data only (same project, accidental delete)

Truncate the affected table and replay its rows from `data.sql`. For example,
to restore all picks:

```bash
psql "$SUPABASE_DB_URL" -c 'truncate public.picks;'
sed -n '/^COPY public.picks /,/^\\\.$/p' backups/<stamp>/data.sql | psql "$SUPABASE_DB_URL"
```

The `sed` range extracts just that table's `COPY ... \.` block.

## Dashboard settings (not dumpable from SQL)

Authentication → URL Configuration:

- **Site URL**: `https://moorebrackets.com` (the custom domain in `public/CNAME`)
- **Redirect URLs**: `https://moorebrackets.com/reset-password`, `http://localhost:5173/reset-password`
- **Providers**: Email, with "Confirm email" on (sign-up requires confirmation)

Email templates: the app uses the stock Supabase templates unless you have
customised them. If you have, export them from Authentication → Email Templates
and keep a copy alongside the backup. With `SUPABASE_ACCESS_TOKEN` set,
`auth_config.json` captures most of these values automatically.

## Going forward: keep git as the source of truth

New schema changes should be written as migration files and pushed:

```bash
supabase migration new <short_name>   # creates supabase/migrations/<ts>_<short_name>.sql
# edit the file
supabase db push
```

If a change is instead applied through the MCP server or the SQL editor, export
it so the repo stays complete. The hosted history keeps the SQL:

```sql
select version, name, array_to_string(statements, E'\n')
from supabase_migrations.schema_migrations
order by version desc limit 1;
```

Save that to `supabase/migrations/<version>_<name>.sql` verbatim. You can
confirm a file matches the hosted copy by comparing `md5 -q <file>` with
`select md5(array_to_string(statements, E'\n')) ...` for that version.
