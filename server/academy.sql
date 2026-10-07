create table public.academy_profiles (
 id uuid primary key references auth.users on delete cascade,
 alias text not null default 'New Hero', role text not null default 'student' check(role in ('student','parent','teacher','admin','pending_parent','pending_teacher')),
 requested_grade int check(requested_grade in (5,6)), verified_grade int check(verified_grade in (5,6)),
 hero text, nexling text, pet_name text, growth int not null default 0, coins int not null default 0 check(coins>=0), skill_points int not null default 0 check(skill_points>=0),
 skills jsonb not null default '{}', owned jsonb not null default '["room-blue","poster-nexus"]', equipped jsonb not null default '{}', dorm jsonb not null default '[{"item":"poster-nexus","x":60,"y":30}]',
 mentor text not null default 'ana', chronicle int not null default 0, streak int not null default 0, surge_uses int not null default 0,
 link_code text unique not null default encode(extensions.gen_random_bytes(12),'hex'), created_at timestamptz not null default now()
);
create table public.academy_classes(id uuid primary key default gen_random_uuid(),teacher uuid not null references academy_profiles, name text not null,grade int not null check(grade in (5,6)),power text not null,color text not null,code text unique not null,created_at timestamptz default now());
create table public.academy_members(student uuid primary key references academy_profiles,class_id uuid not null references academy_classes,verified boolean not null default false);
create table public.academy_guardians(parent uuid references academy_profiles,student uuid references academy_profiles,primary key(parent,student));
create table public.academy_ledger(id uuid primary key default gen_random_uuid(),student uuid not null references academy_profiles,source text not null,coins int not null default 0,growth int not null default 0,house_credit int not null default 0,created_at timestamptz default now(),unique(student,source));
create index academy_ledger_student_date on academy_ledger(student,created_at);
create table public.academy_missions(id uuid primary key default gen_random_uuid(),creator uuid not null references academy_profiles,student uuid references academy_profiles,class_id uuid references academy_classes,title text not null,reward int not null check(reward between 0 and 500),created_at timestamptz default now(),check((student is null)<>(class_id is null)));
create table public.academy_submissions(id uuid primary key default gen_random_uuid(),mission uuid not null references academy_missions,student uuid not null references academy_profiles,status text not null default 'pending' check(status in ('pending','approved','returned')),unique(mission,student));
create table public.academy_trials(id uuid primary key default gen_random_uuid(),student uuid references academy_profiles,prompt text not null,options jsonb not null,answer text not null,kind text not null,completed boolean not null default false,expires_at timestamptz not null default now()+interval '15 minutes');
create index academy_trials_student on academy_trials(student);
create table public.academy_events(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('trivia','portal')),title text not null,starts_at timestamptz not null,grade int check(grade in (5,6)),target int not null default 500,status text not null default 'announced',created_at timestamptz default now());
create table public.academy_rsvps(event uuid references academy_events,student uuid references academy_profiles,primary key(event,student));
create table public.academy_drawing_rooms(id uuid primary key default gen_random_uuid(),code text unique not null,host uuid references academy_profiles,members uuid[] not null,artist uuid references academy_profiles,prompt text not null default 'PORTAL',strokes jsonb not null default '[]',guessed uuid[] not null default '{}',round int not null default 1,revision int not null default 0,created_at timestamptz default now());
create table public.academy_reports(id uuid primary key default gen_random_uuid(),reporter uuid references academy_profiles,room uuid references academy_drawing_rooms,category text not null,created_at timestamptz default now());
do $$ declare t text;begin foreach t in array array['academy_profiles','academy_classes','academy_members','academy_guardians','academy_ledger','academy_missions','academy_submissions','academy_trials','academy_events','academy_rsvps','academy_drawing_rooms','academy_reports'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;end $$;
create function public.academy_reward(pid uuid,src text,amount int,xp int,credit int) returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform id from academy_profiles where id=pid for update;
 insert into academy_ledger(student,source,coins,growth,house_credit) values(pid,src,amount,xp,credit) on conflict do nothing;
 if not found then return false;end if;
 update academy_profiles set coins=coins+amount,growth=growth+xp,skill_points=skill_points+case when xp>0 then 1 else 0 end where id=pid;
 return true;end $$;
create function public.academy_purchase(pid uuid,item text,price int,slot text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p academy_profiles;begin
 select * into p from academy_profiles where id=pid for update;
 if p.id is null then raise exception 'Hero not found';end if;
 if not p.owned ? item then
 if p.coins<price then raise exception 'Complete missions to earn more Nexus Coins';end if;
 update academy_profiles set coins=coins-price,owned=owned||to_jsonb(item) where id=pid;
 insert into academy_ledger(student,source,coins) values(pid,'purchase:'||item,-price);
 end if;
 if slot<>'' then update academy_profiles set equipped=jsonb_set(equipped,array[slot],to_jsonb(item)) where id=pid;end if;
 return jsonb_build_object('saved',true);end $$;
create function public.academy_review(pid uuid,sid uuid,decision text) returns boolean language plpgsql security invoker set search_path=public as $$
declare s academy_submissions;m academy_missions;total int;begin
 select * into s from academy_submissions where id=sid for update;
 select * into m from academy_missions where id=s.mission;
 if m.creator is distinct from pid then raise exception 'Only the assigning adult can review this mission';end if;
 if s.status='approved' then return false;end if;
 if decision not in ('approved','returned') then raise exception 'Choose a review decision';end if;
 if decision='approved' then
 perform id from academy_profiles where id=s.student for update;
 select coalesce(sum(coins),0) into total from academy_ledger where student=s.student and source like 'mission:%' and created_at>=date_trunc('week',now());
 if total+m.reward>500 then raise exception 'Weekly mission reward cap reached';end if;
 perform academy_reward(s.student,'mission:'||s.id,m.reward,10,0);
 end if;
 update academy_submissions set status=decision where id=sid;return true;end $$;
create function public.academy_answer(pid uuid,tid uuid,response text) returns jsonb language plpgsql security invoker set search_path=public as $$
declare t academy_trials;p academy_profiles;ok boolean;reward int;credit int;begin
 select * into t from academy_trials where id=tid for update;
 if t.student is distinct from pid or t.completed or t.expires_at<now() then raise exception 'Challenge expired or already answered';end if;
 select * into p from academy_profiles where id=pid for update;
 ok:=lower(trim(response))=lower(t.answer);reward:=case when ok then 10 else 0 end;
 if ok and p.surge_uses>0 then reward:=20;end if;
 select greatest(0,least(10,100-coalesce(sum(house_credit),0))) into credit from academy_ledger where student=pid and created_at>=date_trunc('day',now());
 if p.verified_grade is null or not ok then credit:=0;end if;
 perform academy_reward(pid,'trial:'||tid,reward,case when ok then 10 else 0 end,credit);
 update academy_trials set completed=true where id=tid;
 update academy_profiles set streak=case when ok then streak+1 else 0 end,surge_uses=case when ok and (streak+1)%5=0 then 3 when surge_uses>0 then surge_uses-1 else 0 end,chronicle=case when ok and t.kind='chronicle' then least(chronicle+1,3) else chronicle end where id=pid;
 return jsonb_build_object('correct',ok,'coins',reward);end $$;
revoke execute on function public.academy_reward(uuid,text,int,int,int),public.academy_purchase(uuid,text,int,text),public.academy_review(uuid,uuid,text),public.academy_answer(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.academy_reward(uuid,text,int,int,int),public.academy_purchase(uuid,text,int,text),public.academy_review(uuid,uuid,text),public.academy_answer(uuid,uuid,text) to service_role;
-- Account bridge added before foundation migration:
-- alter table public.nexus_players add column academy_id uuid references auth.users;
