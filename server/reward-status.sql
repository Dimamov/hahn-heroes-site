create or replace function public.academy_reward_status(pid uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p academy_profiles;learning int;mission int;open_missions jsonb;begin
 select * into p from academy_profiles where id=pid;
 if p.role is distinct from 'student' then return null;end if;
 select greatest(0,100-coalesce(sum(coins),0)) into learning from academy_ledger where student=pid and source like 'trial:%' and (created_at at time zone 'America/Detroit')::date=(now() at time zone 'America/Detroit')::date;
 select greatest(0,500-coalesce(sum(coins),0)) into mission from academy_ledger where student=pid and source like 'mission:%' and created_at>=date_trunc('week',now() at time zone 'America/Detroit') at time zone 'America/Detroit';
 select coalesce(jsonb_agg(m.id),'[]') into open_missions from academy_missions m where m.reward>0 and m.reward<=mission and (m.student=pid or exists(select 1 from academy_members mem where mem.student=pid and mem.verified and mem.class_id=m.class_id)) and not exists(select 1 from academy_submissions sub where sub.student=pid and sub.mission=m.id and sub.status in ('pending','approved'));
 return jsonb_build_object('day',(now() at time zone 'America/Detroit')::date,'learningRemaining',learning,'missionRemaining',mission,'missions',open_missions,'chronicle',p.chronicle<3);
end $$;
revoke execute on function public.academy_reward_status(uuid) from public,anon,authenticated;
grant execute on function public.academy_reward_status(uuid) to service_role;
