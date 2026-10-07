create table if not exists public.academy_builder_progress(student uuid not null references academy_profiles(id),puzzle text not null,found jsonb not null default '[]',completed boolean not null default false,created_at timestamptz not null default now(),primary key(student,puzzle));
alter table public.academy_builder_progress enable row level security;
revoke all on public.academy_builder_progress from public,anon,authenticated;
grant all on public.academy_builder_progress to service_role;
create or replace function public.academy_builder_open(pid uuid,candidates text[]) returns jsonb language plpgsql security invoker set search_path=public as $$
declare r academy_builder_progress;chosen text;begin
 perform id from academy_profiles where id=pid and role='student' for update;if not found then raise exception 'Choose your student hero';end if;
 select * into r from academy_builder_progress where student=pid and not completed order by created_at desc limit 1;if found then return to_jsonb(r);end if;
 select q into chosen from unnest(candidates) q where not exists(select 1 from academy_builder_progress b where b.student=pid and b.puzzle=q) limit 1;
 if chosen is null then return null;end if;
 insert into academy_builder_progress(student,puzzle) values(pid,chosen) returning * into r;return to_jsonb(r);
end $$;
create or replace function public.academy_builder_word(pid uuid,puzzle_id text,word text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare r academy_builder_progress;begin
 select * into r from academy_builder_progress where student=pid and puzzle=puzzle_id for update;if not found then raise exception 'Open your letter set first';end if;
 if r.found ? word then raise exception 'You already found that word';end if;
 update academy_builder_progress b set found=b.found||to_jsonb(word),completed=jsonb_array_length(b.found)+1>=12 where student=pid and puzzle=puzzle_id returning * into r;return to_jsonb(r);
end $$;
revoke execute on function public.academy_builder_open(uuid,text[]),public.academy_builder_word(uuid,text,text) from public,anon,authenticated;
grant execute on function public.academy_builder_open(uuid,text[]),public.academy_builder_word(uuid,text,text) to service_role;
