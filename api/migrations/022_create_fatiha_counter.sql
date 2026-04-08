-- Global Fatiha counter for martyrs page (single row table)
create table if not exists public.fatiha_counter (
  id integer primary key,
  count integer not null default 0 check (count >= 0)
);

insert into public.fatiha_counter (id, count)
values (1, 0)
on conflict (id) do nothing;

alter table public.fatiha_counter enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fatiha_counter'
      and policyname = 'Public can read fatiha counter'
  ) then
    create policy "Public can read fatiha counter"
      on public.fatiha_counter
      for select
      to anon
      using (id = 1);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'fatiha_counter'
      and policyname = 'Public can increment fatiha counter'
  ) then
    create policy "Public can increment fatiha counter"
      on public.fatiha_counter
      for update
      to anon
      using (id = 1)
      with check (id = 1 and count >= 0);
  end if;
end $$;

grant select, update on table public.fatiha_counter to anon;
