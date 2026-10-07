import {createClient} from 'npm:@supabase/supabase-js@2.99.3';
import {questions5,questions6,words} from './question-bank.mjs';
import {games,start,move,tick,view} from './games.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const origins=['https://hahnheroes.com','https://www.hahnheroes.com','https://hahn-heroes.coral-ball-5810.chatgpt.site'];
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(8))).map(n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const checked=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data};
const weights={lantern:1,compass:1,scroll:2,key:4,portal:8,wolf:16,star:32};
Deno.serve(async req=>{
const origin=req.headers.get('origin')||'';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.includes(origin)?origin:origins[0],'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
if(req.method==='OPTIONS')return new Response(null,{headers});
if(req.method!=='POST')return new Response(JSON.stringify({error:'Use POST'}),{status:405,headers});
try{
if(Number(req.headers.get('content-length')||0)>12000)throw Error('Request too large');
const b=await req.json();if(JSON.stringify(b).length>12000)throw Error('Request too large');
if(b.op==='register'){
const ip=await hash(req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown');
const rate=await db.from('nexus_players').select('id',{count:'exact',head:true}).eq('ip_hash',ip).gte('created_at',new Date(Date.now()-3600000).toISOString());if(rate.error)throw rate.error;if((rate.count||0)>=12)throw Error('Too many heroes created. Try again later.');
const secret=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');
const p=checked(await db.from('nexus_players').insert({secret_hash:await hash(secret),nickname:['Violet','Golden','Blue','Brave','Hidden'][Math.floor(Math.random()*5)]+' '+['Wolf','Spark','Hero','Fox','Star'][Math.floor(Math.random()*5)]+' '+code().slice(0,3),ip_hash:ip}).select('id,nickname').single());
checked(await db.from('nexus_cards').insert([{owner:p.id,card:'lantern'},{owner:p.id,card:'compass'},{owner:p.id,card:'scroll'}]));
return new Response(JSON.stringify({secret,player:p}),{headers});}
if(typeof b.secret!=='string'||!(/^[a-f0-9]{64}$/.test(b.secret)))throw Error('Connect your hero first');
const p=checked(await db.from('nexus_players').select('id,nickname,academy_id').eq('secret_hash',await hash(b.secret)).single());if(!p)throw Error('Hero connection expired');
let result:any;
if(b.op==='inventory'){result={player:p,cards:checked(await db.from('nexus_cards').select('id,card,title').eq('owner',p.id).order('created_at'))};}
else if(b.op==='room-create'){
if(!games[b.game])throw Error('Choose a game');
const recent=await db.from('nexus_rooms').select('id',{count:'exact',head:true}).contains('state',{host:p.id}).gte('created_at',new Date(Date.now()-3600000).toISOString());if(recent.error)throw recent.error;if((recent.count||0)>=20)throw Error('Room limit reached. Rejoin an existing room.');
let grade=null;if(b.game==='escape'){const a=checked(await db.from('academy_profiles').select('requested_grade,verified_grade').eq('id',p.academy_id).single());grade=a.verified_grade||a.requested_grade;if(!grade)throw Error('Choose your hero and grade first');}if(b.game==='trivia'){const a=checked(await db.from('academy_profiles').select('verified_grade').eq('id',p.academy_id).single());if(!a.verified_grade)throw Error('Trivia battles require a teacher-verified grade');grade=a.verified_grade;}
let eventId=null;if(b.eventId){if(b.game!=='trivia')throw Error('Choose the trivia event');const e=checked(await db.from('academy_events').select('*').eq('id',b.eventId).eq('kind','trivia').single());if(e.grade!==grade||Date.now()<Date.parse(e.starts_at)||Date.now()>Date.parse(e.starts_at)+7200000)throw Error('This grade division is not open now');checked(await db.from('academy_rsvps').select('student').eq('event',e.id).eq('student',p.academy_id).single());eventId=e.id;}
const s={eventId,grade,game:b.game,phase:'lobby',host:p.id,players:[{id:p.id,nickname:p.nickname,grade,score:0}],turn:0};const r=checked(await db.from('nexus_rooms').insert({code:code(),game:b.game,state:s}).select().single());result={id:r.id,code:r.code,revision:r.revision,...view(r.state,p.id)};
}else if(['room-join','room-state','room-start','room-move','room-leave'].includes(b.op)){
const r=checked(await db.from('nexus_rooms').select().eq('code',String(b.code||'').toUpperCase()).single());if(Date.now()-Date.parse(r.created_at)>86400000)throw Error('Room expired. Create a new room.');
if(r.game==='trivia'){const a=checked(await db.from('academy_profiles').select('verified_grade').eq('id',p.academy_id).single());if(!a.verified_grade||a.verified_grade!==r.state.grade)throw Error('This trivia room is for a different verified grade');}
if(r.state.eventId){checked(await db.from('academy_rsvps').select('student').eq('event',r.state.eventId).eq('student',p.academy_id).single());}
const s=r.state,member=s.players.some((x:any)=>x.id===p.id);let changed=false;
if(b.op==='room-join'&&!member){if(s.phase!=='lobby'||s.players.length>=8)throw Error('This room has already started or is full');let grade=null;if(r.game==='escape'){const a=checked(await db.from('academy_profiles').select('requested_grade,verified_grade').eq('id',p.academy_id).single());grade=a.verified_grade||a.requested_grade;if(!grade)throw Error('Choose your hero and grade first');}s.players.push({id:p.id,nickname:p.nickname,grade,score:0});changed=true}else if(!member)throw Error('Join the room first');
if(b.op==='room-start'){if(s.host!==p.id)throw Error('Only the room creator can start');if(s.phase!=='lobby')throw Error('Already started');if(s.game==='escape'){s.rescueQuestions={};for(const member of s.players){const identity=checked(await db.from('nexus_players').select('academy_id').eq('id',member.id).single());const qs=member.grade===6?questions6:questions5;const ids=checked(await db.rpc('academy_reserve_questions',{pids:[identity.academy_id],candidates:qs.map((q:any)=>q[4]),amount:1}));s.rescueQuestions[member.id]=qs.find((q:any)=>q[4]===ids[0]);}}else if(['trivia','scramble'].includes(s.game)){const profiles=checked(await db.from('nexus_players').select('academy_id').in('id',s.players.map((x:any)=>x.id)));const qs=s.game==='scramble'?words.map(w=>[null,null,null,null,'word:'+w]):s.grade===6?questions6:questions5;const ids=checked(await db.rpc('academy_reserve_questions',{pids:profiles.map((x:any)=>x.academy_id),candidates:qs.map((q:any)=>q[4]),amount:10}));s.order=ids.map((id:string)=>qs.findIndex((q:any)=>q[4]===id));}start(s);changed=true}
if(b.op==='room-leave'){if(s.phase==='playing')throw Error('Use Back to HQ to reconnect later');s.players=s.players.filter((x:any)=>x.id!==p.id);if(s.host===p.id)s.host=s.players[0]?.id||'';changed=true}
if(b.op==='room-move'){if(b.revision!==r.revision)throw Error('Room updated. Try your move again.');move(s,p.id,b.move||{});changed=true}
const before=JSON.stringify(s);tick(s);changed=changed||before!==JSON.stringify(s);
if(changed){const saved=checked(await db.rpc('nexus_commit_room',{rid:r.id,expected:r.revision,new_state:s}));if(!saved)throw Error('Another move arrived. Try again.');r.revision++}
result={id:r.id,code:r.code,revision:r.revision,...view(s,p.id)};
}else if(b.op==='trade-create'){
const recent=await db.from('nexus_trades').select('id',{count:'exact',head:true}).eq('a',p.id).eq('status','open');if(recent.error)throw recent.error;if((recent.count||0)>=5)throw Error('Finish or cancel your open trades first');
result=checked(await db.from('nexus_trades').insert({a:p.id,code:code()}).select().single());
}else if(['trade-join','trade-state','trade-offer','trade-confirm','trade-cancel'].includes(b.op)){
let t=checked(await db.from('nexus_trades').select().eq('code',String(b.code||'').toUpperCase()).single());if(Date.now()-Date.parse(t.created_at)>86400000)throw Error('Trade expired');
if(b.op==='trade-join'&&p.id!==t.a&&p.id!==t.b){if(t.b||t.status!=='open')throw Error('Trade unavailable');t=checked(await db.from('nexus_trades').update({b:p.id,revision:t.revision+1,confirmed_a:null,confirmed_b:null}).eq('id',t.id).is('b',null).eq('revision',t.revision).select().single())}
if(t.a!==p.id&&t.b!==p.id)throw Error('This trade belongs to other heroes');
if(b.op==='trade-offer'||b.op==='trade-confirm'||b.op==='trade-cancel'){checked(await db.rpc('nexus_trade_action',{pid:p.id,tid:t.id,expected:b.revision,action:b.op==='trade-offer'?'offer':b.op==='trade-confirm'?'confirm':'cancel',offered:b.cards||[],ack:b.ack===true}));t=checked(await db.from('nexus_trades').select().eq('id',t.id).single())}
const cards=checked(await db.from('nexus_cards').select('id,owner,card,title').in('owner',[t.a,t.b].filter(Boolean)));
const value=(ids:string[],owner:string)=>ids.reduce((sum,id)=>{const c=cards.find((x:any)=>x.id===id);if(!c)return sum;const owned=cards.filter((x:any)=>x.owner===owner&&x.card===c.card).length;const offered=ids.filter(i=>cards.find((x:any)=>x.id===i)?.card===c.card).length;return sum+weights[c.card]*(owned>offered?.75:1)},0);
const av=value(t.offer_a,t.a),bv=value(t.offer_b,t.b),ratio=av&&bv?Math.max(av,bv)/Math.min(av,bv):null;
result={...t,side:p.id===t.a?'a':'b',cards:cards.filter((x:any)=>x.owner===p.id||t.offer_a.includes(x.id)||t.offer_b.includes(x.id)),values:{a:av,b:bv},fairness:ratio===null?'incomplete':ratio>=3?'blocked':ratio>1.5?'uneven':'balanced',givingMore:av>bv?'a':bv>av?'b':null};
}else throw Error('Unknown action');
return new Response(JSON.stringify(result),{headers});
}catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Try again'}),{status:400,headers})}
});
