#!/usr/bin/env bash
#
# Full backup of the hosted Supabase project into backups/<timestamp>/.
#
# Produces everything needed to rebuild the project from scratch together with
# the migrations committed under supabase/migrations/:
#
#   schema.sql        public schema: tables, indexes, functions, RLS policies, grants
#   auth_trigger.sql  the on_auth_user_created trigger (lives on auth.users)
#   extensions.sql    CREATE EXTENSION statements for every installed extension
#   cron_jobs.sql     cron.schedule(...) statements for every pg_cron job
#   data.sql          all rows from the public schema (COPY format)
#   auth_users.sql    auth.users + auth.identities rows (emails + password hashes)
#   auth_config.json  (optional) auth settings via the Management API
#   manifest.txt      versions, row counts, migration history
#
# Requirements: pg_dump/psql >= server major version (brew install libpq) and
# SUPABASE_DB_URL in .env (see .env.example). See supabase/README.md to restore.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Homebrew's libpq is keg-only; make its binaries visible without shell config.
if [[ -d /opt/homebrew/opt/libpq/bin ]]; then
  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

die() { echo "error: $*" >&2; exit 1; }

for tool in pg_dump psql; do
  command -v "$tool" >/dev/null 2>&1 \
    || die "$tool not found. Install with: brew install libpq"
done

[[ -n "${SUPABASE_DB_URL:-}" ]] \
  || die "SUPABASE_DB_URL is not set. Add it to .env (see .env.example)."

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT="backups/$STAMP"
mkdir -p "$OUT"

# All psql calls: fail on SQL errors, no psqlrc, tuples-only + unaligned output.
q() { psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -At "$@"; }

echo "==> Backing up to $OUT"

echo "--> schema.sql"
pg_dump "$SUPABASE_DB_URL" --schema-only --schema=public --no-owner \
  > "$OUT/schema.sql"

echo "--> auth_trigger.sql"
{
  echo "-- Triggers on auth.users (not covered by --schema=public)."
  echo "-- Function bodies are in schema.sql."
  q -c "select pg_get_triggerdef(t.oid) || ';'
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'auth' and not t.tgisinternal
        order by t.tgname;"
} > "$OUT/auth_trigger.sql"

echo "--> extensions.sql"
{
  echo "-- Installed extensions (plpgsql is built in and listed for completeness)."
  q -c "select format('create extension if not exists %I with schema %I; -- %s',
                      e.extname, n.nspname, e.extversion)
        from pg_extension e
        join pg_namespace n on n.oid = e.extnamespace
        order by e.extname;"
} > "$OUT/extensions.sql"

echo "--> cron_jobs.sql"
{
  echo "-- pg_cron jobs. NOTE: commands may embed the project URL and publishable key;"
  echo "-- edit them before running against a different project."
  q -c "select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command)
        from cron.job order by jobname;"
} > "$OUT/cron_jobs.sql"

echo "--> data.sql"
pg_dump "$SUPABASE_DB_URL" --data-only --schema=public --no-owner \
  > "$OUT/data.sql"

echo "--> auth_users.sql"
pg_dump "$SUPABASE_DB_URL" --data-only --no-owner \
  --table=auth.users --table=auth.identities \
  > "$OUT/auth_users.sql"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "--> auth_config.json"
  curl -fsS \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
    > "$OUT/auth_config.json" \
    || echo "    (auth config export failed; continuing)" >&2
else
  echo "--> auth_config.json skipped (set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF to enable)"
fi

echo "--> manifest.txt"
{
  echo "created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "pg_dump:    $(pg_dump --version)"
  echo "server:     $(q -c 'select version();')"
  echo
  echo "row counts (public):"
  q -c "select '  ' || rpad(c.relname, 12) || ' ' || (xpath('/row/n/text()',
          query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname;"
  echo "  auth.users   $(q -c 'select count(*) from auth.users;')"
  echo
  echo "migration history (supabase_migrations.schema_migrations):"
  q -c "select '  ' || version || ' ' || coalesce(name, '')
        from supabase_migrations.schema_migrations order by version;"
} > "$OUT/manifest.txt"

echo
echo "==> Done: $OUT"
du -sh "$OUT"
echo "    Copy this folder somewhere off this machine. It contains user emails and password hashes."
