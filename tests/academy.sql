begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();parent uuid:=gen_random_uuid();mid uuid;sid uuid;tid uuid;v jsonb;n int;begin
insert into auth.users(id) values(a),(b),(parent);
insert into public.academy_profiles(id,requested_grade,verified_grade,coins) values(a,5,5,100),(b,6,null,100);
insert into public.academy_profiles(id,role) values(parent,'parent');
perform public.academy_purchase(a,'badge-blue',20,'accessory');perform public.academy_purchase(a,'badge-blue',20,'accessory');
select coins into n from public.academy_profiles where id=a;if n<>80 then raise exception 'Purchase retry charged twice';end if;
perform public.academy_reward(a,'unique-award',10,10,0);perform public.academy_reward(a,'unique-award',10,10,0);select coins into n from public.academy_profiles where id=a;if n<>90 then raise exception 'Reward retry doubled';end if;
insert into public.academy_missions(creator,student,title,reward) values(parent,a,'Test mission',25) returning id into mid;
insert into public.academy_submissions(mission,student) values(mid,a) returning id into sid;
begin perform public.academy_review(b,sid,'approved');raise exception 'Unauthorized review accepted';exception when others then if sqlerrm='Unauthorized review accepted' then raise;end if;end;
perform public.academy_review(parent,sid,'approved');perform public.academy_review(parent,sid,'approved');select coins into n from public.academy_profiles where id=a;if n<>115 then raise exception 'Review duplicated rewards';end if;
insert into public.academy_trials(student,prompt,options,answer,kind) values(a,'1+1','["2","3"]','2','learning') returning id into tid;
v:=public.academy_answer(a,tid,'2');if not (v->>'correct')::boolean then raise exception 'Valid answer rejected';end if;
begin perform public.academy_answer(a,tid,'2');raise exception 'Duplicate answer accepted';exception when others then if sqlerrm='Duplicate answer accepted' then raise;end if;end;
insert into public.academy_trials(student,prompt,options,answer,kind) values(b,'1+1','["2","3"]','2','learning') returning id into tid;
perform public.academy_answer(b,tid,'2');select house_credit into n from public.academy_ledger where source='trial:'||tid;if n<>0 then raise exception 'Unverified grade earned house credit';end if;
if has_table_privilege('authenticated','public.academy_profiles','SELECT') then raise exception 'Client can read private records';end if;
if has_function_privilege('authenticated','public.academy_reward(uuid,text,integer,integer,integer)','EXECUTE') then raise exception 'Client can forge rewards';end if;
end $$;
rollback;
