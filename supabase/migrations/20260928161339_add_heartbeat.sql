-- Keep-alive endpoint: POST /rest/v1/rpc/heartbeat
create or replace function public.heartbeat()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

grant execute on function public.heartbeat() to anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Hourly call to the project's own REST API so the Free plan project is not paused.
-- The key is the publishable (public) key that also ships in the frontend bundle.
select cron.schedule(
  'heartbeat-hourly',
  '0 * * * *',
  $job$
  select net.http_post(
    url := 'https://bmixjsxxckvvwnvhpuwl.supabase.co/rest/v1/rpc/heartbeat',
    headers := jsonb_build_object(
      'apikey', 'sb_publishable_hoGwWOGp47VhBG4mrDVPQA_paR_K6cD',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $job$
);