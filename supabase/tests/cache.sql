-- Executable with psql or the Management API. Every probe is rolled back.
begin;
set local role service_role;
do $$
declare
  t text;
  f text;
  k text := 'token-economics:v999999:all';
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  snap jsonb;
begin
  foreach t in array array['arena_snapshot_cache','arena_cache_leases','arena_cache_archives'] loop
    assert (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS disabled: ' || t;
    assert not has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'), 'anon has a table grant';
    assert not has_table_privilege('authenticated', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated has a table grant';
  end loop;
  foreach f in array array['arena_cache_acquire(text,uuid,integer)','arena_cache_release(text,uuid)','arena_cache_publish(jsonb,uuid)'] loop
    assert not has_function_privilege('anon', 'public.' || f, 'EXECUTE'), 'anon has RPC access';
    assert not has_function_privilege('authenticated', 'public.' || f, 'EXECUTE'), 'authenticated has RPC access';
    assert has_function_privilege('service_role', 'public.' || f, 'EXECUTE'), 'server lacks RPC access';
    assert not (select prosecdef from pg_proc where oid = ('public.' || f)::regprocedure), 'unexpected security definer';
  end loop;
  assert not has_table_privilege('service_role', 'public.arena_cache_archives', 'UPDATE,DELETE'), 'archives are mutable';
  assert public.arena_cache_acquire(k, a, 30), 'first acquisition failed';
  assert not public.arena_cache_acquire(k, b, 30), 'concurrent writer acquired lock';
  snap := jsonb_build_object('cache_key', k, 'scope', 'token-economics', 'version', 999999, 'variant', 'all',
    'payload', '{"total":42}'::jsonb, 'data_from', '2026-01-01T00:00:00Z', 'data_through', '2026-09-11T00:00:00Z',
    'refreshed_at', '2026-09-11T00:01:00Z', 'expires_at', '2026-09-12T00:00:00Z', 'payload_bytes', 12);
  assert not public.arena_cache_publish(snap, b), 'unowned publish accepted';
  assert public.arena_cache_publish(snap, a), 'insert failed';
  assert not public.arena_cache_publish(jsonb_set(snap, '{data_through}', '"2026-09-10T00:00:00Z"'), a), 'older cutoff overwrote history';
  assert public.arena_cache_publish(jsonb_set(snap, '{payload}', '{"total":43}'), a), 'update failed';
  perform public.arena_cache_release(k, b);
  assert not public.arena_cache_acquire(k, b, 30), 'unowned release dropped lock';
  perform public.arena_cache_release(k, a);
  assert public.arena_cache_acquire(k, b, 30), 'lease was not released';
  assert not public.arena_cache_publish(snap, a), 'expired writer was not fenced';
  assert (select payload->>'total' from public.arena_snapshot_cache where cache_key = k) = '43', 'payload regressed';
end;
$$;
rollback;
