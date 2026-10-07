alter table public.nexus_cards add column title text;
create table public.nexus_event_awards(event uuid references academy_events,player uuid references nexus_players,primary key(event,player));
alter table public.nexus_event_awards enable row level security;revoke all on public.nexus_event_awards from anon,authenticated;
create or replace function public.nexus_commit_room(rid uuid,expected integer,new_state jsonb) returns boolean language plpgsql security invoker set search_path=public as $$
declare hero jsonb; reward text;total integer;begin
update nexus_rooms set state=new_state,revision=revision+1 where id=rid and revision=expected;
if not found then return false;end if;
if new_state->>'phase'='finished' then
for hero in select * from jsonb_array_elements(new_state->'players') loop
insert into nexus_awards(room,player) values(rid,(hero->>'id')::uuid) on conflict do nothing;
if found then
perform id from nexus_players where id=(hero->>'id')::uuid for update;
select count(*) into total from nexus_awards where nexus_awards.player=(hero->>'id')::uuid;
reward:=case when (hero->>'score')::integer>=3 then 'scroll' else 'compass' end;
insert into nexus_cards(owner,card) values((hero->>'id')::uuid,reward);
if total in (7,12,20,30) then insert into nexus_cards(owner,card) values((hero->>'id')::uuid,case total when 7 then 'key' when 12 then 'portal' when 20 then 'wolf' else 'star' end);end if;end if;end loop;end if;
if new_state->>'phase'='finished' and new_state->>'eventId' is not null then
for hero in select * from jsonb_array_elements(new_state->'players') loop
if new_state->'winners' ? (hero->>'id') then
insert into nexus_event_awards(event,player) values((new_state->>'eventId')::uuid,(hero->>'id')::uuid) on conflict do nothing;
if found then insert into nexus_cards(owner,card,title) values((hero->>'id')::uuid,'key','Grade '||(new_state->>'grade')||' Trivia Night Champion');end if;
end if;end loop;end if;
return true;end $$;
revoke execute on function public.nexus_commit_room(uuid,integer,jsonb) from public,anon,authenticated;grant execute on function public.nexus_commit_room(uuid,integer,jsonb) to service_role;
