-- Arena shared data plane. Idempotent setup; no changes to billing or Insights.
begin;

create table if not exists public.arena_snapshot_cache (
  cache_key text primary key,
  scope text not null check (scope in ('token-economics', 'token-deals')),
  version integer not null check (version > 0),
  variant text not null check (variant in ('all', '72h')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  data_from timestamptz not null,
  data_through timestamptz not null,
  refreshed_at timestamptz not null,
  expires_at timestamptz not null,
  payload_bytes integer not null check (payload_bytes > 0),
  updated_at timestamptz not null default clock_timestamp(),
  check (data_from <= data_through),
  check (cache_key = scope || ':v' || version::text || ':' || variant)
);

create table if not exists public.arena_cache_leases (
  cache_key text primary key,
  owner uuid not null,
  locked_until timestamptz not null
);

-- Immutable imports/checkpoints. The hash identifies source bytes; payload_hash
-- verifies JSONB round trips without depending on object key order.
create table if not exists public.arena_cache_archives (
  scope text not null check (scope in ('token-economics', 'token-deals')),
  source_path text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  data_through timestamptz not null,
  imported_at timestamptz not null default clock_timestamp(),
  primary key (scope, source_path, source_sha256)
);

alter table public.arena_snapshot_cache enable row level security;
alter table public.arena_cache_leases enable row level security;
alter table public.arena_cache_archives enable row level security;
revoke all on public.arena_snapshot_cache, public.arena_cache_leases, public.arena_cache_archives from public, anon, authenticated;
grant select, insert, update, delete on public.arena_snapshot_cache, public.arena_cache_leases to service_role;
revoke all on public.arena_cache_archives from service_role;
grant select, insert on public.arena_cache_archives to service_role;

create or replace function public.arena_cache_acquire(p_key text, p_owner uuid, p_seconds integer default 900)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_seconds < 1 or p_seconds > 900 then
    raise exception 'Lease duration must be between 1 and 900 seconds';
  end if;
  insert into public.arena_cache_leases(cache_key, owner, locked_until)
  values (p_key, p_owner, clock_timestamp() + make_interval(secs => p_seconds))
  on conflict (cache_key) do update
    set owner = excluded.owner, locked_until = excluded.locked_until
    where public.arena_cache_leases.locked_until <= clock_timestamp();
  return found;
end;
$$;

create or replace function public.arena_cache_release(p_key text, p_owner uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.arena_cache_leases set locked_until = clock_timestamp()
  where cache_key = p_key and owner = p_owner;
$$;

-- The lease row is locked only for this short commit, never during origin IO.
-- Fencing rejects an expired writer even after another worker acquires a lease.
create or replace function public.arena_cache_publish(p_snapshot jsonb, p_owner uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.arena_cache_leases
  where cache_key = p_snapshot->>'cache_key' and owner = p_owner
    and locked_until > clock_timestamp() for update;
  if not found then return false; end if;

  insert into public.arena_snapshot_cache(
    cache_key, scope, version, variant, payload, data_from, data_through,
    refreshed_at, expires_at, payload_bytes
  ) values (
    p_snapshot->>'cache_key', p_snapshot->>'scope', (p_snapshot->>'version')::integer,
    p_snapshot->>'variant', p_snapshot->'payload', (p_snapshot->>'data_from')::timestamptz,
    (p_snapshot->>'data_through')::timestamptz, (p_snapshot->>'refreshed_at')::timestamptz,
    (p_snapshot->>'expires_at')::timestamptz, (p_snapshot->>'payload_bytes')::integer
  ) on conflict (cache_key) do update set
    payload = excluded.payload, data_from = excluded.data_from, data_through = excluded.data_through,
    refreshed_at = excluded.refreshed_at, expires_at = excluded.expires_at,
    payload_bytes = excluded.payload_bytes, updated_at = clock_timestamp()
  where (excluded.data_through, excluded.refreshed_at) >=
    (public.arena_snapshot_cache.data_through, public.arena_snapshot_cache.refreshed_at);
  return found;
end;
$$;

revoke all on function public.arena_cache_acquire(text, uuid, integer),
  public.arena_cache_release(text, uuid), public.arena_cache_publish(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.arena_cache_acquire(text, uuid, integer),
  public.arena_cache_release(text, uuid), public.arena_cache_publish(jsonb, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
