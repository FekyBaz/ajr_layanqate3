-- Aggregated community stats cache table (single row id=1)
create table if not exists public.community_stats (
    id integer primary key,
    total_approved integer not null default 0,
    total_post_count bigint not null default 0,
    average_post_count numeric(12,4) not null default 0,
    updated_at timestamptz not null default now()
);

insert into public.community_stats (id, total_approved, total_post_count, average_post_count, updated_at)
values (1, 0, 0, 0, now())
on conflict (id) do nothing;
