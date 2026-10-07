import {createClient} from 'npm:@supabase/supabase-js@2.99.3';
import {builderPuzzles,wordScore} from '../word-builder.mjs';
import {words} from '../question-bank.mjs';
import {heroes,species,shop,roles,chronicles,challenge,bank} from './catalog.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origins=['https://hahnheroes.com','https://www.hahnheroes.com','https://hahn-heroes.coral-ball-5810.chatgpt.site'];
const checked=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data};
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(8))).map(n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const keyedHash=async(s:string)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('')};
const newSession=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
const origin=req.headers.get('origin')||'';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return new Response('{}',{status:405,headers});
try{
const b=await req.json();if(JSON.stringify(b).length>20000)throw Error('Request too large');
if(['child-create','child-login'].includes(b.op)){
 const hero=heroes.find((h:any)=>h.id===b.hero);if(!hero||!/^\d{6}$/.test(b.pin||''))throw Error('Choose your character and enter your six-digit code');
 const bucket=await keyedHash('access:'+String(b.account||b.hero+':'+b.pin)+':'+b.op);
 const failures=checked(await db.from('academy_access_limits').select('hits,expires_at').eq('bucket',bucket).maybeSingle());if(failures&&Date.parse(failures.expires_at)>Date.now()&&failures.hits>=20)throw Error('Take a short break, then try again');
 const loginHash=await keyedHash('child:'+b.hero+':'+b.pin);const secret=newSession();let pid;
 if(b.op==='child-create'){
  if(/^(\d)\1{5}$/.test(b.pin)||['123456','654321','012345','543210','234567','345678','456789','987654','876543','765432'].includes(b.pin))throw Error('Pick a harder code');
  if(![5,6].includes(b.grade))throw Error('Choose grade 5 or 6');
  const created=await db.rpc('academy_create_child',{chosen_hero:b.hero,grade:b.grade,display_alias:hero.name+' '+code().slice(0,3),digest:loginHash,session_digest:await hash(secret)});
  if(created.error)throw Error('Unable to create your hero. Try again');pid=created.data;
 }else{
  let query=db.from('academy_child_credentials').select('profile').eq('hero',b.hero).eq('login_hash',loginHash);if(/^[a-f0-9-]{36}$/.test(b.account||''))query=query.eq('profile',b.account);const matches=checked(await query.limit(2));
  if(matches.length!==1){checked(await db.rpc('academy_access_limit',{key:bucket,maximum:20,minutes:5}));throw Error('Use your saved hero on this device, or ask your connected parent to help you sign in');}pid=matches[0].profile;checked(await db.from('academy_access_limits').delete().eq('bucket',bucket));
  checked(await db.from('academy_child_sessions').insert({profile:pid,token_hash:await hash(secret)}));
 }
 return new Response(JSON.stringify({secret,account:pid}),{headers});
}
const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)throw Error('Choose your hero and enter your code');
let p:any;let user:any=null;let childSessionHash:string|null=null;
if(token.startsWith('child.')){
 childSessionHash=await hash(token.slice(6));const session=checked(await db.from('academy_child_sessions').select('profile').eq('token_hash',childSessionHash).gt('expires_at',new Date().toISOString()).maybeSingle());
 if(!session)throw Error('Your session ended. Enter your character and code again');p=checked(await db.from('academy_profiles').select('*').eq('id',session.profile).single());if(p.role!=='student')throw Error('Use an adult email account');
}else{
 user=checked(await db.auth.getUser(token)).user;if(!user)throw Error('Sign in again');
 p=checked(await db.from('academy_profiles').select('*').eq('adult_user_id',user.id).maybeSingle());
 if(!p){const legacy=checked(await db.from('academy_profiles').select('*').eq('id',user.id).is('adult_user_id',null).maybeSingle());if(legacy){p=checked(await db.from('academy_profiles').update({adult_user_id:user.id,...(legacy.role==='student'&&!legacy.hero?{role:'pending_parent',alias:'Parent'}:{})}).eq('id',user.id).select().single())}}
 if(!p){p=checked(await db.from('academy_profiles').upsert({id:user.id,adult_user_id:user.id,role:'pending_parent',alias:'Parent'},{onConflict:'adult_user_id',ignoreDuplicates:true}).select().maybeSingle());if(!p)p=checked(await db.from('academy_profiles').select('*').eq('adult_user_id',user.id).single())}
}
const student=()=>{if(p.role!=='student')throw Error('This activity is for student heroes')};
const admin=()=>{if(p.role!=='admin')throw Error('Only the Sensei can publish this')};
let result:any={saved:true};
if(b.op==='child-logout'){
if(childSessionHash)checked(await db.from('academy_child_sessions').delete().eq('token_hash',childSessionHash));
}else if(b.op==='snapshot'){
const membership=checked(await db.from('academy_members').select('*,academy_classes(*)').eq('student',p.id).maybeSingle());
const guardians=checked(await db.from('academy_guardians').select('student').eq('parent',p.id));
const classes=checked(await db.from('academy_classes').select('*').eq('teacher',p.id));
const children=guardians.length?checked(await db.from('academy_profiles').select('id,alias,hero,coins,growth,requested_grade,verified_grade').in('id',guardians.map((x:any)=>x.student))):[];
let missions:any[]=[];if(p.role==='student'){const personal=checked(await db.from('academy_missions').select('*').eq('student',p.id));const classWork=membership?.verified?checked(await db.from('academy_missions').select('*').eq('class_id',membership.class_id)):[];missions=[...personal,...classWork]}else missions=checked(await db.from('academy_missions').select('*').eq('creator',p.id));
let subQuery=db.from('academy_submissions').select('*').in('mission',missions.map(x=>x.id));if(p.role==='student')subQuery=subQuery.eq('student',p.id);const submissions=missions.length?checked(await subQuery):[];
const events=checked(await db.from('academy_events').select('*').neq('status','ended').order('starts_at'));
const rsvps=checked(await db.from('academy_rsvps').select('event').eq('student',p.id));
const ledger=checked(await db.from('academy_ledger').select('source,coins,growth,created_at').eq('student',p.id).order('created_at',{ascending:false}).limit(20));
const reports=p.role==='admin'?checked(await db.from('academy_reports').select('*,academy_drawing_rooms(code,strokes)').order('created_at',{ascending:false}).limit(30)):[];
const pending=p.role==='admin'?checked(await db.from('academy_profiles').select('id,alias,role').in('role',['pending_parent','pending_teacher'])):[];
const parentRequests=p.role==='student'?checked(await db.from('academy_parent_requests').select('parent,status,academy_profiles!academy_parent_requests_parent_fkey(alias)').eq('student',p.id).eq('status','pending')):[];
const week=checked(await db.from('academy_ledger').select('source,coins,growth').eq('student',p.id).gte('created_at',new Date(Date.now()-7*86400000).toISOString()));const recap={coins:week.reduce((n:number,r:any)=>n+Math.max(0,r.coins),0),growth:week.reduce((n:number,r:any)=>n+r.growth,0),missions:week.filter((r:any)=>r.source.startsWith('mission:')).length};
const rewardStatus=checked(await db.rpc('academy_reward_status',{pid:p.id}));
result={rewardStatus,recap,profile:p,membership,children,classes,missions,submissions,events,rsvps:rsvps.map((r:any)=>r.event),ledger,pending,reports,parentRequests};
}else if(b.op==='onboard'){
student();if(p.hero)throw Error('Your starter character is already chosen');if(!heroes.some((h:any)=>h.id===b.hero)||![5,6].includes(b.grade))throw Error('Choose a hero and your grade');
checked(await db.from('academy_profiles').update({hero:b.hero,requested_grade:p.verified_grade||b.grade,alias:heroes.find((h:any)=>h.id===b.hero).name+' '+code().slice(0,3)}).eq('id',p.id));
}else if(b.op==='adult-request'){
if(!user||p.hero||!['parent','teacher'].includes(b.role)||!['student','pending_parent','pending_teacher'].includes(p.role))throw Error('Create a separate adult account');
checked(await db.from('academy_profiles').update({role:'pending_'+b.role,alias:b.role==='parent'?'Parent':'Teacher'}).eq('id',p.id));
}else if(b.op==='approve-adult'){
admin();const target=checked(await db.from('academy_profiles').select('role').eq('id',b.id).single());if(!target.role.startsWith('pending_'))throw Error('Request is no longer pending');checked(await db.from('academy_profiles').update({role:target.role.replace('pending_','')}).eq('id',b.id));
}else if(b.op==='nexling'){
student();if(!species.some((s:any)=>s.id===b.species))throw Error('Choose a Nexling');if(p.nexling&&p.nexling!==b.species)throw Error('Your Nexling bond is already chosen');checked(await db.from('academy_profiles').update({nexling:b.species,pet_name:species.find((s:any)=>s.id===b.species).name}).eq('id',p.id));
}else if(b.op==='purchase'){
student();const item=shop.find((s:any)=>s.id===b.item);if(!item)throw Error('Item unavailable');const slot=item.category==='decor'?'':item.category;result=checked(await db.rpc('academy_purchase',{pid:p.id,item:item.id,price:item.cost,slot}));
}else if(b.op==='dorm-save'){
student();if(!Array.isArray(b.items)||b.items.length>20)throw Error('Choose up to 20 decorations');const items=b.items.map((x:any)=>{if(!p.owned.includes(x.item)||!shop.some((s:any)=>s.id===x.item&&s.category==='decor')||!Number.isFinite(x.x)||!Number.isFinite(x.y))throw Error('Choose an owned decoration');return {item:x.item,x:Math.max(5,Math.min(95,x.x)),y:Math.max(10,Math.min(90,x.y))}});checked(await db.from('academy_profiles').update({dorm:items}).eq('id',p.id));
}else if(b.op==='dorm-visit'){
student();const friend=checked(await db.from('academy_profiles').select('id,alias,hero,dorm,equipped,nexling').eq('link_code',String(b.code)).maybeSingle());if(!friend)throw Error('Ask your friend for their private room invite');result=friend;
}else if(b.op==='skill'){
student();if(!roles.some((r:any)=>r.id===b.role))throw Error('Choose a role');const rank=p.skills[b.role]||0;if(rank>=3||p.skill_points<1)throw Error('Earn a skill point or choose another path');
const out=await db.from('academy_profiles').update({skills:{...p.skills,[b.role]:rank+1},skill_points:p.skill_points-1}).eq('id',p.id).eq('skill_points',p.skill_points).select('id');if(!checked(out).length)throw Error('Progress changed. Try again');
}else if(b.op==='mentor'){
student();if(!['ana','keeper','sensei'].includes(b.mentor))throw Error('Choose a mentor');checked(await db.from('academy_profiles').update({mentor:b.mentor}).eq('id',p.id));
}else if(b.op==='challenge'){
student();if(!p.requested_grade)throw Error('Choose your hero and grade first');const recent=await db.from('academy_trials').select('id',{count:'exact',head:true}).eq('student',p.id).eq('completed',false).gt('expires_at',new Date().toISOString());if(recent.error)throw recent.error;if((recent.count||0)>10)throw Error('Finish an open challenge first');
let c;if(b.kind==='chronicle')c=chronicles[Math.min(p.chronicle,2)];else{const choices=bank(p.verified_grade||p.requested_grade);const ids=checked(await db.rpc('academy_reserve_questions',{pids:[p.id],candidates:choices.map((q:any)=>q.id),amount:1}));c=choices.find((q:any)=>q.id===ids[0]);}if(b.kind==='chronicle'&&p.chronicle>=3)throw Error('More archive chapters will arrive with the story');
const trial=checked(await db.from('academy_trials').insert({student:p.id,prompt:c.prompt,options:c.options,answer:c.answer,kind:b.kind==='chronicle'?'chronicle':'learning'}).select('id,prompt,options,kind').single());result=trial;
}else if(b.op==='builder-open'){
student();const progress=checked(await db.rpc('academy_builder_open',{pid:p.id,candidates:builderPuzzles.map(x=>x.id)}));result=progress?{...progress,letters:builderPuzzles.find(x=>x.id===progress.puzzle)?.letters}:null;
}else if(b.op==='builder-word'){
student();const puzzle=builderPuzzles.find(x=>x.id===b.puzzle);const word=String(b.word||'').toUpperCase();if(!puzzle||!puzzle.words.includes(word))throw Error('Not a word in this set. Try another!');const progress=checked(await db.rpc('academy_builder_word',{pid:p.id,puzzle_id:puzzle.id,word}));result={...progress,letters:puzzle.letters,points:wordScore(word)};
}else if(b.op==='reserve-questions'){student();const choices=b.game==='scramble'?words.map(w=>({id:'word:'+w})):bank(p.verified_grade||p.requested_grade);const ids=checked(await db.rpc('academy_reserve_questions',{pids:[p.id],candidates:choices.map((q:any)=>q.id),amount:10}));result={ids};
}else if(b.op==='answer'){
student();result=checked(await db.rpc('academy_answer',{pid:p.id,tid:b.id,response:String(b.answer).slice(0,60)}));const answeredTrial=checked(await db.from('academy_trials').select('prompt').eq('id',b.id).eq('student',p.id).single());result.why=bank(p.verified_grade||p.requested_grade).find((q:any)=>q.prompt===answeredTrial.prompt)?.why||'Look back at the clue and compare the choices.';
}else if(b.op==='link-parent'){
if(!user||!user.email_confirmed_at||!['parent','pending_parent'].includes(p.role))throw Error('A confirmed parent email account is required');const child=checked(await db.from('academy_profiles').select('id,role').eq('guardian_code',String(b.code)).maybeSingle());if(!child||child.role!=='student')throw Error('Scan your child’s parent QR again');
checked(await db.from('academy_parent_requests').upsert({parent:p.id,student:child.id,status:'pending'}));result={saved:true,message:'Ask your child to confirm your connection in Parent Link.'};
}else if(b.op==='child-code-reset'){
if(!user||p.role!=='parent'||!/^\d{6}$/.test(b.pin||''))throw Error('A connected parent can reset a six-digit code');const link=checked(await db.from('academy_guardians').select('student').eq('parent',p.id).eq('student',b.student).single());const credential=checked(await db.from('academy_child_credentials').select('hero').eq('profile',link.student).single());const changed=await db.from('academy_child_credentials').update({login_hash:await keyedHash('child:'+credential.hero+':'+b.pin)}).eq('profile',link.student);if(changed.error)throw Error('Choose another code for this character');checked(await db.from('academy_child_sessions').delete().eq('profile',link.student));
}else if(b.op==='parent-confirm'){
student();const request=checked(await db.from('academy_parent_requests').select('*').eq('parent',b.parent).eq('student',p.id).eq('status','pending').single());if(b.approve){checked(await db.from('academy_guardians').upsert({parent:request.parent,student:p.id}));checked(await db.from('academy_profiles').update({role:'parent'}).eq('id',request.parent).eq('role','pending_parent'));}checked(await db.from('academy_parent_requests').update({status:b.approve?'approved':'declined'}).eq('parent',request.parent).eq('student',p.id));
}else if(b.op==='class-create'){
if(p.role!=='teacher')throw Error('Teacher approval is required');if(![5,6].includes(b.grade)||!['Storm','Crystal','Flame','Forest','Shadow','Light'].includes(b.power))throw Error('Choose a grade and house power');
checked(await db.from('academy_classes').insert({teacher:p.id,name:String(b.name||'Class House').slice(0,60),grade:b.grade,power:b.power,color:b.color==='#ffca58'?'#ffca58':'#7d6aff',code:code()}));
}else if(b.op==='class-join'){
student();if(p.verified_grade)throw Error('Your verified classroom can only be changed by the Sensei');const c=checked(await db.from('academy_classes').select('*').eq('code',String(b.code).toUpperCase()).single());checked(await db.from('academy_members').upsert({student:p.id,class_id:c.id,verified:false}));checked(await db.from('academy_profiles').update({verified_grade:null}).eq('id',p.id));
}else if(b.op==='class-roster'){
const c=checked(await db.from('academy_classes').select('id').eq('id',b.id).eq('teacher',p.id).single());result=checked(await db.from('academy_members').select('*,academy_profiles(id,alias,requested_grade,hero)').eq('class_id',c.id));
}else if(b.op==='class-verify'){
const member=checked(await db.from('academy_members').select('*,academy_classes(*)').eq('student',b.student).single());if(member.academy_classes.teacher!==p.id||p.role!=='teacher')throw Error('Only the classroom teacher can verify grade');checked(await db.from('academy_members').update({verified:true}).eq('student',b.student));checked(await db.from('academy_profiles').update({verified_grade:member.academy_classes.grade}).eq('id',b.student));
}else if(b.op==='mission-create'){
if(!['parent','teacher'].includes(p.role))throw Error('An approved adult account is required');const title=String(b.title||'').trim();if(title.length<3||title.length>160||!Number.isInteger(b.reward)||b.reward<0||b.reward>100)throw Error('Use a mission title and 0–100 coins');
if(p.role==='parent'){checked(await db.from('academy_guardians').select('student').eq('parent',p.id).eq('student',b.target).single());checked(await db.from('academy_missions').insert({creator:p.id,student:b.target,title,reward:b.reward}))}else{checked(await db.from('academy_classes').select('id').eq('teacher',p.id).eq('id',b.target).single());checked(await db.from('academy_missions').insert({creator:p.id,class_id:b.target,title,reward:b.reward}))}
}else if(b.op==='mission-submit'){
student();const m=checked(await db.from('academy_missions').select('*').eq('id',b.id).single());if(m.student!==p.id){const member=checked(await db.from('academy_members').select('*').eq('student',p.id).single());if(member.class_id!==m.class_id||!member.verified)throw Error('This mission belongs to another class')}
const existing=checked(await db.from('academy_submissions').select('*').eq('mission',m.id).eq('student',p.id).maybeSingle());if(existing?.status==='approved')throw Error('Already approved');checked(await db.from('academy_submissions').upsert({mission:m.id,student:p.id,status:'pending'},{onConflict:'mission,student'}));
}else if(b.op==='mission-review'){
result=checked(await db.rpc('academy_review',{pid:p.id,sid:b.id,decision:b.decision}));
}else if(b.op==='houses'){
const classes=checked(await db.from('academy_classes').select('id,name,power,grade,color'));const members=checked(await db.from('academy_members').select('student,class_id').eq('verified',true));const scores=checked(await db.from('academy_ledger').select('student,house_credit').gte('created_at',new Date(Date.now()-7*86400000).toISOString()));
result=classes.map((c:any)=>{const roster=members.filter((m:any)=>m.class_id===c.id);const total=scores.filter((s:any)=>roster.some((m:any)=>m.student===s.student)).reduce((n:number,s:any)=>n+s.house_credit,0);return {...c,members:roster.length,score:roster.length?Math.round(total/roster.length):0}}).sort((a:any,b:any)=>b.score-a.score);
}else if(b.op==='rsvp'){
student();const e=checked(await db.from('academy_events').select('*').eq('id',b.id).single());if(e.kind!=='trivia'||e.grade!==p.verified_grade)throw Error('Trivia Night needs a teacher-verified matching grade');checked(await db.from('academy_rsvps').upsert({event:e.id,student:p.id}));
}else if(b.op==='event-create'){
admin();if(!['trivia','portal'].includes(b.kind)||!Number.isFinite(Date.parse(b.starts_at)))throw Error('Choose an event and time');const records=b.kind==='trivia'?[5,6].map(grade=>({kind:'trivia',title:'Trivia Night',starts_at:b.starts_at,grade})): [{kind:'portal',title:'The Sensei: Reopen the Portal',starts_at:b.starts_at,target:500}];checked(await db.from('academy_events').insert(records));
}else if(b.op==='portal-progress'){
const e=checked(await db.from('academy_events').select('*').eq('id',b.id).eq('kind','portal').single());const rows=checked(await db.from('academy_ledger').select('growth').gte('created_at',e.starts_at).gt('growth',0));result={progress:rows.reduce((sum:number,x:any)=>sum+x.growth/10,0),target:e.target};
 }else if(b.op==='nexus-identity'){
student();const signingKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),{name:'HMAC',hash:'SHA-256'},false,['sign']);const secret=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode('academy:'+p.id)))).map(n=>n.toString(16).padStart(2,'0')).join('');
let player=checked(await db.from('nexus_players').select('id,nickname').eq('academy_id',p.id).maybeSingle());
if(!player&&/^[a-f0-9]{64}$/.test(b.secret||'')){const old=checked(await db.from('nexus_players').select('id,nickname,academy_id').eq('secret_hash',await hash(b.secret)).maybeSingle());if(old&&!old.academy_id){checked(await db.from('nexus_players').update({academy_id:p.id,secret_hash:await hash(secret)}).eq('id',old.id).is('academy_id',null));player=checked(await db.from('nexus_players').select('id,nickname').eq('academy_id',p.id).maybeSingle())}}
if(!player){player=checked(await db.from('nexus_players').insert({secret_hash:await hash(secret),nickname:p.alias,academy_id:p.id,ip_hash:await hash('academy:'+p.id)}).select('id,nickname').single());checked(await db.from('nexus_cards').insert([{owner:player.id,card:'lantern'},{owner:player.id,card:'compass'},{owner:player.id,card:'scroll'}]));}else checked(await db.from('nexus_players').update({secret_hash:await hash(secret)}).eq('id',player.id));result={secret,player};
}else if(b.op==='bug-report'){
const message=String(b.message||'').trim();if(!message||message.length>1000)throw Error('Keep the report under 1,000 characters');if(!checked(await db.rpc('academy_access_limit',{key:'reports:'+p.id,maximum:5,minutes:60})))throw Error('You have sent enough reports for now. Try later');checked(await db.from('academy_reports').insert({reporter:p.id,category:'bug',message}));
}else if(b.op==='drawing-moderate'){
admin();if(!['restore','hide'].includes(b.decision))throw Error('Choose a review decision');checked(await db.from('academy_reports').update({category:b.decision==='hide'?'blocked':'restored'}).eq('room',b.id));
}else if(b.op==='drawing-create'){
student();result=checked(await db.from('academy_drawing_rooms').insert({code:code(),host:p.id,members:[p.id],artist:p.id}).select().single());
}else if(['drawing-join','drawing-state','drawing-stroke','drawing-guess','drawing-next','drawing-report'].includes(b.op)){
student();let r=checked(await db.from('academy_drawing_rooms').select('*').eq('code',String(b.code).toUpperCase()).single());const roomReports=checked(await db.from('academy_reports').select('category').eq('room',r.id));r.hidden=roomReports.some((x:any)=>['drawing','blocked'].includes(x.category));if(Date.now()-Date.parse(r.created_at)>86400000)throw Error('Room expired');
let patch:any={};if(b.op==='drawing-join'&&!r.members.includes(p.id)){if(r.members.length>=8)throw Error('Room full');patch.members=[...r.members,p.id]}else if(!r.members.includes(p.id))throw Error('Join this room first');
if(r.hidden&&b.op!=='drawing-report'){if(!r.members.includes(p.id))throw Error('Room is hidden pending review');result={...r,strokes:[],prompt:null};return new Response(JSON.stringify(result),{headers});}
if(b.op==='drawing-stroke'){if(r.artist!==p.id)throw Error('Only the artist can draw');if(r.strokes.length>=250)throw Error('Clear the canvas for more strokes');if(!Array.isArray(b.points)||b.points.length<2||b.points.length>256||b.points.some((pt:any)=>!Array.isArray(pt)||pt.length!==2||pt.some((n:any)=>!Number.isFinite(n)||n<0||n>1)))throw Error('Invalid drawing');patch.strokes=[...r.strokes,{points:b.points,color:['#18324a','#7b46ed','#00a9ec','#ffb52e','#ec4b7e'].includes(b.color)?b.color:'#18324a'}]}
if(b.op==='drawing-guess'){if(r.artist===p.id)throw Error('Artists cannot guess');result={correct:String(b.guess).trim().toUpperCase()===r.prompt};if(result.correct&&!r.guessed.includes(p.id))patch.guessed=[...r.guessed,p.id]}
if(b.op==='drawing-next'){if(r.host!==p.id&&r.artist!==p.id)throw Error('Only the host or artist can start the next drawing');patch={artist:r.members[(r.members.indexOf(r.artist)+1)%r.members.length],prompt:['PORTAL','WOLF','SCHOOL','BOOK','COMPASS','TREE'][(r.round)%6],strokes:[],guessed:[],round:r.round+1}}
if(b.op==='drawing-report'){checked(await db.from('academy_reports').insert({reporter:p.id,room:r.id,category:'drawing'}));r.hidden=true;}
if(Object.keys(patch).length){const hidden=r.hidden;r=checked(await db.from('academy_drawing_rooms').update({...patch,revision:r.revision+1}).eq('id',r.id).eq('revision',r.revision).select().single());r.hidden=hidden;}
if(b.op!=='drawing-guess')result={...r,strokes:r.hidden?[]:r.strokes,prompt:!r.hidden&&r.artist===p.id?r.prompt:null};
}else throw Error('Unknown activity');
return new Response(JSON.stringify(result),{headers});
}catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Try again'}),{headers,status:400})}
});
