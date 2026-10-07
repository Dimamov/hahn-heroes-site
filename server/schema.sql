create table public.nexus_players(id uuid primary key default gen_random_uuid(), secret_hash text unique not null, nickname text not null, created_at timestamptz not null default now(), ip_hash text not null);
create table public.nexus_rooms(id uuid primary key default gen_random_uuid(),code text unique not null, game text not null, state jsonb not null, revision integer not null default 0, created_at timestamptz not null default now());
create table public.nexus_cards(id uuid primary key default gen_random_uuid(),owner uuid not null references public.nexus_players,card text not null check(card in ('lantern','compass','scroll','key','portal','wolf','star')),created_at timestamptz not null default now());
create table public.nexus_trades(id uuid primary key default gen_random_uuid(),code text unique not null,a uuid not null references public.nexus_players,b uuid references public.nexus_players,offer_a uuid[] not null default '{}',offer_b uuid[] not null default '{}',revision integer not null default 0,confirmed_a integer,confirmed_b integer,status text not null default 'open',created_at timestamptz not null default now());
create index on public.nexus_cards(owner);create index on public.nexus_players(ip_hash,created_at);
alter table public.nexus_players enable row level security;alter table public.nexus_rooms enable row level security;alter table public.nexus_cards enable row level security;alter table public.nexus_trades enable row level security;
revoke all on public.nexus_players,public.nexus_rooms,public.nexus_cards,public.nexus_trades from anon,authenticated;
create function public.nexus_trade_action(pid uuid,tid uuid,expected integer,action text,offered uuid[] default '{}',ack boolean default false) returns jsonb language plpgsql security invoker set search_path=public as $$
declare t nexus_trades; av numeric;bv numeric;ratio numeric;side text;begin
select * into t from nexus_trades where id=tid for update;
if t.id is null or (pid<>t.a and pid is distinct from t.b) then raise exception 'Trade not found';end if;
if t.status<>'open' or t.revision<>expected then raise exception 'Trade changed. Review it again.';end if;
side:=case when pid=t.a then 'a' else 'b' end;
if action='cancel' then update nexus_trades set status='cancelled' where id=tid;return jsonb_build_object('status','cancelled');end if;
if action='offer' then
if cardinality(offered)>12 or cardinality(offered)<>(select count(distinct x) from unnest(offered) x) then raise exception 'Choose up to 12 different card copies';end if;
if (select count(*) from nexus_cards where id=any(offered) and owner=pid)<>cardinality(offered) then raise exception 'You no longer own those cards';end if;
update nexus_trades set offer_a=case when side='a' then offered else offer_a end,offer_b=case when side='b' then offered else offer_b end,revision=revision+1,confirmed_a=null,confirmed_b=null where id=tid;
return jsonb_build_object('status','updated');end if;
if action<>'confirm' or t.b is null or cardinality(t.offer_a)=0 or cardinality(t.offer_b)=0 then raise exception 'Both heroes must offer cards';end if;
perform id from nexus_cards where id=any(t.offer_a||t.offer_b) order by id for update;
if (select count(*) from nexus_cards where id=any(t.offer_a) and owner=t.a)<>cardinality(t.offer_a) or (select count(*) from nexus_cards where id=any(t.offer_b) and owner=t.b)<>cardinality(t.offer_b) then raise exception 'Card ownership changed. Make a new offer.';end if;
select sum((case card when 'lantern' then 1 when 'compass' then 1 when 'scroll' then 2 when 'key' then 4 when 'portal' then 8 when 'wolf' then 16 when 'star' then 32 end)*case when (select count(*) from nexus_cards d where d.owner=c.owner and d.card=c.card)>(select count(*) from nexus_cards d where d.id=any(t.offer_a) and d.card=c.card) then .75 else 1 end) into av from nexus_cards c where id=any(t.offer_a);
select sum((case card when 'lantern' then 1 when 'compass' then 1 when 'scroll' then 2 when 'key' then 4 when 'portal' then 8 when 'wolf' then 16 when 'star' then 32 end)*case when (select count(*) from nexus_cards d where d.owner=c.owner and d.card=c.card)>(select count(*) from nexus_cards d where d.id=any(t.offer_b) and d.card=c.card) then .75 else 1 end) into bv from nexus_cards c where id=any(t.offer_b);
ratio:=greatest(av,bv)/least(av,bv);
if ratio>=3 then raise exception 'This trade is too lopsided. Balance the cards first.';end if;
if ratio>1.5 and not ack then raise exception 'Hold up! This trade looks uneven. Review and confirm the warning.';end if;
if side='a' then t.confirmed_a:=t.revision;else t.confirmed_b:=t.revision;end if;
if t.confirmed_a=t.revision and t.confirmed_b=t.revision then
update nexus_cards set owner=case when id=any(t.offer_a) then t.b else t.a end where id=any(t.offer_a||t.offer_b);t.status:='completed';end if;
update nexus_trades set confirmed_a=t.confirmed_a,confirmed_b=t.confirmed_b,status=t.status where id=tid;
return jsonb_build_object('status',t.status);end $$;
revoke execute on function public.nexus_trade_action(uuid,uuid,integer,text,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.nexus_trade_action(uuid,uuid,integer,text,uuid[],boolean) to service_role;
create table public.nexus_awards(room uuid references public.nexus_rooms,player uuid references public.nexus_players,primary key(room,player));alter table public.nexus_awards enable row level security;revoke all on public.nexus_awards from anon,authenticated;
create function public.nexus_commit_room(rid uuid,expected integer,new_state jsonb) returns boolean language plpgsql security invoker set search_path=public as $$
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
return true;end $$;
revoke execute on function public.nexus_commit_room(uuid,integer,jsonb) from public,anon,authenticated;grant execute on function public.nexus_commit_room(uuid,integer,jsonb) to service_role;
