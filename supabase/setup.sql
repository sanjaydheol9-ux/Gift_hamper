create table if not exists public.gifts (
  id uuid primary key,
  message text not null default '' check (char_length(message) <= 220),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 10),
  created_at timestamptz not null default now()
);

alter table public.gifts enable row level security;

grant insert on public.gifts to anon, authenticated;

drop policy if exists "Anyone can create gifts" on public.gifts;
create policy "Anyone can create gifts"
  on public.gifts for insert
  to anon, authenticated
  with check (
    cardinality(photo_paths) between 1 and 10
    and char_length(message) <= 220
  );

create or replace function public.get_gift(gift_id uuid)
returns table (id uuid, message text, photo_paths text[])
language sql
stable
security definer
set search_path = ''
as $$
  select gifts.id, gifts.message, gifts.photo_paths
  from public.gifts
  where gifts.id = gift_id
$$;

revoke all on function public.get_gift(uuid) from public;
grant execute on function public.get_gift(uuid) to anon, authenticated;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from public, anon, authenticated;

create or replace function public.get_admin_gifts()
returns table (id uuid, created_at timestamptz, photo_paths text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  ) then
    raise exception 'Not authorized to view the admin gallery';
  end if;

  return query
    select gifts.id, gifts.created_at, gifts.photo_paths
    from public.gifts
    order by gifts.created_at desc;
end;
$$;

revoke all on function public.get_admin_gifts() from public, anon, authenticated;
grant execute on function public.get_admin_gifts() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gift-photos', 'gift-photos', true, 5242880, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can upload gift photos" on storage.objects;
create policy "Anyone can upload gift photos"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'gift-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
