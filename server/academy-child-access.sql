-- Preflight verified 0 academy_profiles and 0 existing heroes on 2026-10-04.
-- Abort if this assumption changes; no existing identity or progress is rewritten.
do $$ begin if exists(select 1 from public.academy_profiles) then raise exception 'Existing profiles require a separately reviewed migration';end if;end $$;
-- Children have independent profile IDs; adult identities still validate through Auth.
alter table public.academy_profiles drop constraint academy_profiles_id_fkey;
alter table public.academy_profiles add column adult_user_id uuid unique references auth.users(id) on delete cascade;
alter table public.nexus_players drop constraint nexus_players_academy_id_fkey;
alter table public.nexus_players add constraint nexus_players_academy_id_fkey foreign key(academy_id) references public.academy_profiles(id);
create table public.academy_child_credentials(profile uuid primary key references academy_profiles,hero text not null,login_hash text unique not null);
create table public.academy_child_sessions(token_hash text primary key,profile uuid not null references academy_child_credentials(profile),expires_at timestamptz not null default now()+interval '30 days');
create table public.academy_access_limits(bucket text primary key,hits int not null,expires_at timestamptz not null);
create table public.academy_parent_requests(parent uuid references academy_profiles,student uuid references academy_profiles,status text not null default 'pending' check(status in ('pending','approved','declined')),primary key(parent,student));
do $$ declare t text;begin foreach t in array array['academy_child_credentials','academy_child_sessions','academy_access_limits','academy_parent_requests'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;end $$;
create function public.academy_access_limit(key text,maximum int,minutes int) returns boolean language plpgsql security invoker set search_path=public as $$ declare n int;begin
 insert into academy_access_limits(bucket,hits,expires_at) values(key,1,now()+make_interval(mins=>minutes)) on conflict(bucket) do update set hits=case when academy_access_limits.expires_at<now() then 1 else academy_access_limits.hits+1 end,expires_at=case when academy_access_limits.expires_at<now() then excluded.expires_at else academy_access_limits.expires_at end returning hits into n;return n<=maximum;end $$;
create function public.academy_create_child(chosen_hero text,grade int,display_alias text,digest text,session_digest text) returns uuid language plpgsql security invoker set search_path=public as $$ declare pid uuid:=gen_random_uuid();begin
 if grade not in (5,6) then raise exception 'Choose grade 5 or 6';end if;
 insert into academy_profiles(id,hero,requested_grade,alias) values(pid,chosen_hero,grade,display_alias);
 insert into academy_child_credentials(profile,hero,login_hash) values(pid,chosen_hero,digest);
 insert into academy_child_sessions(profile,token_hash) values(pid,session_digest);
 perform academy_reward(pid,'welcome',100,0,0);return pid;end $$;
revoke execute on function public.academy_access_limit(text,int,int),public.academy_create_child(text,int,text,text,text) from public,anon,authenticated;
grant execute on function public.academy_access_limit(text,int,int),public.academy_create_child(text,int,text,text,text) to service_role;
