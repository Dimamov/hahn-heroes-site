alter table public.academy_child_credentials drop constraint if exists academy_child_credentials_login_hash_key;
create or replace function public.academy_reward(pid uuid,src text,amount int,xp int,credit int) returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform id from academy_profiles where id=pid for update;
 insert into academy_ledger(student,source,coins,growth,house_credit) values(pid,src,amount,xp,credit) on conflict do nothing;
 if not found then return false;end if;
 update academy_profiles set coins=coins+amount,growth=growth+xp,skill_points=skill_points+((growth+xp)/100)-(growth/100) where id=pid;
 return true;end $$;
create or replace function public.academy_answer(pid uuid,tid uuid,response text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare t academy_trials;p academy_profiles;ok boolean;reward int;credit int;earned int;begin
 select * into t from academy_trials where id=tid for update;
 if t.student is distinct from pid or t.completed or t.expires_at<now() then raise exception 'Challenge expired or already answered';end if;
 select * into p from academy_profiles where id=pid for update;
 ok:=lower(trim(response))=lower(t.answer);reward:=case when ok then 10 else 0 end;
 if ok and p.surge_uses>0 then reward:=20;end if;
 select coalesce(sum(coins),0) into earned from academy_ledger where student=pid and source like 'trial:%' and (created_at at time zone 'America/Detroit')::date=(now() at time zone 'America/Detroit')::date;reward:=least(reward,greatest(0,100-earned));
 select greatest(0,least(10,100-coalesce(sum(house_credit),0))) into credit from academy_ledger where student=pid and (created_at at time zone 'America/Detroit')::date=(now() at time zone 'America/Detroit')::date;
 if p.verified_grade is null or not ok then credit:=0;end if;
 perform academy_reward(pid,'trial:'||tid,reward,case when ok then 10 else 0 end,credit);
 update academy_trials set completed=true where id=tid;
 update academy_profiles set streak=case when ok then streak+1 else 0 end,surge_uses=case when ok and (streak+1)%5=0 then 3 when ok and surge_uses>0 then surge_uses-1 else surge_uses end,chronicle=case when ok and t.kind='chronicle' then least(chronicle+1,3) else chronicle end where id=pid;
 return jsonb_build_object('correct',ok,'coins',reward,'answer',t.answer);end $$;
create table if not exists public.academy_content_history(student uuid not null references public.academy_profiles(id),question text not null,seen_at timestamptz not null default now(),primary key(student,question));
alter table public.academy_content_history enable row level security;
revoke all on public.academy_content_history from public,anon,authenticated;
grant all on public.academy_content_history to service_role;
create or replace function public.academy_reserve_questions(pids uuid[],candidates text[],amount int) returns text[] language plpgsql security invoker set search_path=public as $$
declare selected text[]; who uuid; begin
 if amount<1 or amount>10 or cardinality(pids)<1 then raise exception 'Invalid question request';end if;
 for who in select unnest(pids) order by 1 loop perform id from academy_profiles where id=who for update;end loop;
 select array_agg(q) into selected from (select distinct q from unnest(candidates) q where not exists(select 1 from academy_content_history h where h.student=any(pids) and h.question=q) order by q limit amount) fresh;
 if cardinality(selected) is null or cardinality(selected)<amount then raise exception 'New challenges are on the way. Try a different game for now.';end if;
 insert into academy_content_history(student,question) select hero_id,question_id from unnest(pids) hero_id cross join unnest(selected) question_id;
 return selected;end $$;
revoke execute on function public.academy_reserve_questions(uuid[],text[],int) from public,anon,authenticated;
grant execute on function public.academy_reserve_questions(uuid[],text[],int) to service_role;
