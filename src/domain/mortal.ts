import { backgrounds,chains,methods,places,roles,shortSeeds } from '../content/mortal';
import { PLAYER,type World } from './model';
import { type Person,type MortalCommand,freshMortal } from './mortal-model';
import { samplePpm } from './random';
import { requireRule } from './actions';
import { log } from './world';
const DAY=1440;
export const isMortal=(w:World)=>w.mortal.mode==='chapter';
const flag=(w:World,id:string)=>{if(!w.mortal.flags.includes(id))w.mortal.flags.push(id);};
export const done=(w:World,id:string)=>w.mortal.flags.includes(id);
export const chainDone=(w:World,id:string)=>!!chains.find(c=>c.id===id&& (w.mortal.stages[id]??0)>=c.stages.length);
const free=(w:World)=>{requireRule(!w.mortal.task&&!Object.values(w.projects).some(p=>p.state==='running'),'ACTOR_BUSY','你正在另一项行事中，请先完成或取消。');};
function entry(w:World,from:string,to:string,amount:number,reason:string){const id='entry.'+(w.counters.entry=(w.counters.entry??0)+1);w.mortal.ledger.push({id,tick:w.tick,from,to,amount,reason});}
function asset(w:World,id:string,kind:World['mortal']['assets'][string]['kind'],name:string,source:string,ownerId=PLAYER){w.mortal.assets[id]??={id,kind,name,source,ownerId,quantity:1,location:w.entities[PLAYER].location!,status:'available'};}
const pay=(w:World,n:number)=>{requireRule(w.money>=n,'MISSING_REQUIREMENT','钱款不足，可先做公共短工或包食宿帮工。');w.money-=n;if(n)entry(w,PLAYER,'local.services',n,'实际支出');};
const remember=(p:Person,text:string)=>{p.memories.push(text);p.memories=p.memories.slice(-8);};
function pin(p:Person,id:string,reason:string,tier:'L1'|'L2'|'A'='L1'){if(!p.pins.some(r=>r.ownerId===id))p.pins.push({ownerId:id,pinReason:reason,minimumTier:tier,releaseCondition:'对应事项完成、取消或到期结算'});}
function unpin(w:World,id:string){for(const p of Object.values(w.mortal.people))p.pins=p.pins.filter(r=>r.ownerId!==id);}
export function meetRole(w:World,roleId:string,encounterId:string,location?:string):Person{
 const m=w.mortal,previous=m.encounters[encounterId];if(previous&&m.people[previous]){const p=m.people[previous];requireRule(p.worldStatus==='local'&&(!location||p.location===location),'MISSING_REQUIREMENT','原相遇对象已不在现场，请延期或选择另一线索。');return p;}
 const role=roles.find(r=>r.id===roleId);requireRule(role,'MISSING_REQUIREMENT','未知角色席位');
 const loc=location??role!.location;
 let person=Object.values(m.people).find(p=>p.role===roleId&&p.skill>=role!.skill&&p.worldStatus==='local'&&p.location===loc&&!p.pins.some(r=>r.minimumTier==='L2')&&p.simulationTier!=='L0');
 if(!person){
  requireRule(Object.values(m.people).filter(p=>p.simulationTier==='L2').length<32,'MISSING_REQUIREMENT','现场人手已满，请先结清正在进行的约定。');
  const seq=++m.generation,id='person.'+seq,random=samplePpm(w.seed,'person-v1/'+seq+'/'+roleId),surname=['陈','许','周','陶','顾','赵','苏','叶'][random%8],given=['明远','秋禾','怀川','照溪','清和','向晚','砚生','听澜'][Math.floor(random/8)%8];
  const fixed=roleId==='R04'?{id:'character.worker',name:'林小满'}:roleId==='R07'?{id:'character.teacher',name:'沈知弦'}:roleId==='R10'?{id:'character.physician',name:'云岚'}:null;
  const canFixed=fixed&&!m.people[fixed.id];
  const name=canFixed?fixed.name:surname+given+(Object.values(m.people).some(p=>p.name===surname+given)?'·'+seq:'');
  person={id:canFixed?fixed.id:id,name,role:roleId,origin:role!.visitor?'visitor':'resident',enteredWorldAt:w.tick,entryReason:encounterId,birthAt:w.tick-(24+random%25)*365*DAY,anchors:[role!.visitor?'从下游来到青溪':'在青溪住了十余年','从业 '+(5+random%12)+' 年，能力来自练习',role!.goal],appearance:'portrait-'+random%12,skill:role!.skill,goal:role!.goal,location:loc,worldStatus:'local',knownStatus:'在 '+places.find(p=>p.id===loc)?.name,contact:'',simulationTier:'L0',retentionClass:'ordinary',lastSeen:w.tick,departAt:role!.visitor?w.tick+7*DAY:null,returnAt:null,encounters:0,memories:[],keyMemories:[],pins:[],policy:roleId==='R02'?'immediate':role!.visitor?'timed':'event'};
  m.people[person.id]=person;if(person.origin==='resident')m.population.embodied++;else m.population.visitors++;
 }
 person.encounters++;person.lastSeen=w.tick;person.simulationTier='L2';m.encounters[encounterId]=person.id;
 log(w,'在'+places.find(p=>p.id===loc)?.name+'结识了'+person.name+'。'+person.goal+'。');return person;
}
export function releasePerson(w:World,id:string){
 const m=w.mortal,p=m.people[id];if(!p)return;
 if(p.pins.some(r=>r.minimumTier==='L2'))return;
 if(p.policy==='immediate'&&!m.relationships[p.id]&&!Object.values(m.contracts).some(c=>c.personId===p.id)&&!p.pins.length&&!p.contact&&p.retentionClass==='ordinary'){
  if(p.origin==='resident')m.population.embodied--;else m.population.visitors--;
  for(const [enc,pid]of Object.entries(m.encounters))if(pid===id)delete m.encounters[enc];
  delete m.people[id];return;
 }
 p.simulationTier='L1';
 if(p.pins.every(r=>r.minimumTier==='A')&&p.retentionClass==='ordinary'&&w.tick-p.lastSeen>=30*DAY)p.simulationTier='A';
}
export type MortalPreview={name:string;minutes:number;cost:number;reward:number;fatigue:number;location:string|null;role:string|null;errors:string[];detail:string};
export function previewMortal(w:World,actionId:string,choice=''):MortalPreview{
 const m=w.mortal,p=w.entities[PLAYER],out:MortalPreview={name:'',minutes:60,cost:0,reward:0,fatigue:8,location:null,role:null,errors:[],detail:''};
 if(!isMortal(w)||!m.created)out.errors.push('请先确定出身。');
 if(m.task)out.errors.push('自身正在行事，先完成或取消。');
 const chain=chains.find(c=>c.id===actionId);
 if(chain){
  const index=m.stages[actionId]??0,stage=chain.stages[index],option=stage?.choices.find(o=>o.id===choice);
  out.name=chain.name+' · '+(stage?.name??'已完成');out.location=chain.location;out.role=chain.role;
  if(chain.requires.some(id=>!chainDone(w,id)))out.errors.push('先完成：'+chain.requires.filter(id=>!chainDone(w,id)).map(id=>chains.find(c=>c.id===id)!.name).join('、'));
  if(!option)out.errors.push(stage?'请选择一个可行办法。':'这条事件链已结清。');
  else {Object.assign(out,{minutes:option.minutes,cost:option.cost,reward:option.reward,detail:option.detail});}
  if(actionId==='CH01'&&index===0){out.role=choice==='ask'?'R01':'R02';out.location='location.market';}
  if(actionId==='CH01'&&index===1){out.role='R01';if(choice==='relief'&&Math.floor(w.tick/DAY)-m.reliefDay<7)out.errors.push('包食宿帮工七日内仅一次；仍可做公共短工。');}
  if(actionId==='CH09'){out.role=index===0?(choice==='mentor'?'R10':choice==='sect'?'R11':'R09'):null;}
  if(actionId==='CH08'&&index===1&&m.foodDays<1)out.errors.push('山路需要一日补给，先在客舍购买。');
 }else if(actionId==='work'||actionId==='relief'){
  out.name=actionId==='relief'?'包食宿帮工':'公共短工';out.location='location.market';out.role='R02';out.minutes=360;out.reward=actionId==='relief'?6:12;out.fatigue=choice==='light'?6:18;
  if(choice==='light'&&actionId==='work'){out.reward=8;out.name='低强度公共短工';}
  if(actionId==='relief'&&Math.floor(w.tick/DAY)-m.reliefDay<7)out.errors.push('本周已领取帮工食宿，下次第 '+(m.reliefDay+8)+' 日开放。');
  if(m.workDay===Math.floor(w.tick/DAY)&&m.workCount>=2)out.errors.push('今日公开短工需求已满，可休息或学习。');
  out.detail='工作实际完成后付款；取消不拿报酬，未发工钱退回。';
 }else if(actionId.startsWith('job.')){
  const id=actionId.slice(4),c=chains.find(c=>c.id===id);out.name='专业委托 · '+(c?.name??'未知');out.location=c?.location??null;out.role=c?.role??null;out.minutes=360;out.cost=4;out.reward=18;out.fatigue=16;
  if(!c?.skill||!chainDone(w,id))out.errors.push('先完成该门技艺的独立成果。');
  if(m.workDay===Math.floor(w.tick/DAY)&&m.workCount>=2)out.errors.push('今日订单需求已满。');
  out.detail='材料 4 文开工消耗，完成得 18 文；当日最多两单。';
 }else if(actionId==='rest'){out.name='在住处歇息';out.minutes=360;out.fatigue=0;out.location='location.inn';if(m.paidUntil<w.tick+360)out.errors.push('住处需覆盖休息时间，先续住或参加包食宿帮工。');out.detail='恢复健康，减少 55 疲劳；已付期间不再扣租费。';}
 else if(actionId==='rent'){out.name='续住两日';out.minutes=10;out.cost=4;out.fatigue=0;out.location='location.inn';out.role='R01';out.detail='4 文支付两日铺位，在现有期限后顺延。';}
 else if(actionId==='food'){out.name='备下两日饭食';out.minutes=10;out.cost=4;out.fatigue=0;out.location='location.market';out.detail='两日食物按跨日结算，山路补给另有明确消耗。';}
 else if(actionId.startsWith('travel.')){const id=actionId.slice(7);out.name='前往'+places.find(l=>l.id===id)?.name;out.minutes=['location.mountain','location.temple'].includes(id)?180:20;out.fatigue=2;if(!places.some(l=>l.id===id))out.errors.push('未知地点');if(p.location===id)out.errors.push('已在这里。');out.detail='按安全路线出行，途经预约与生活费用照常结算。';}
 else if(actionId==='method') {out.name='选择适配方法';out.minutes=30;out.fatigue=0;if(!methods.some(x=>x.id===choice))out.errors.push('未知方法');if(!chainDone(w,'CH09'))out.errors.push('先验证可靠修法来源。');out.detail='改换方法需重新理解、试行、纠错；已完成应用记录保留。';}
 else if(['understand','practice','correct','apply','medicine'].includes(actionId)){
  const method=methods.find(d=>d.id===m.method);out.name=({understand:'理解方法',practice:'试行与重复验证',correct:'比对注本，纠正问题',apply:'首次实际应用',medicine:'公开辨药基础课'} as Record<string,string>)[actionId];out.minutes=120;out.location=actionId==='medicine'?'location.pharmacy':method?.location??null;out.detail=method?.requirement??'通过公开图册与常见样本学习基础辨药。';
  if(actionId!=='medicine'){
   if(!method||!chainDone(w,'CH10'))out.errors.push('先选一种方法，并完成「第一缕」的步骤与环境准备。');
   if(p.health<40)out.errors.push('健康不足 40，先在住处调养。');
   if(p.fatigue>60)out.errors.push('疲劳超过 60，先休息；错误条件不会增加有效进度。');
   if(method?.id==='MT02'&&(m.skills.medicine??0)<2)out.errors.push('先上两次公开辨药课，或完成医药入门。');
   if(actionId==='practice'&&m.understanding<2)out.errors.push('先完成两次有效理解。');
   if(actionId==='correct'&&m.practice<1)out.errors.push('先试行一次，才能针对实际问题纠错。');
   if(actionId==='practice'&&m.practice>=1&&!m.corrected)out.errors.push('已发现偏差，请先比对注本纠错，再重复验证。');
   if(actionId==='apply'&&(m.practice<3||!m.corrected))out.errors.push('须完成三次有效实践及一次纠错。');
   if(actionId==='apply'&&m.applied)out.errors.push('该方法的首次应用已经记录，可继续生活或另学方法。');
  }
 }else out.errors.push('未知行动。');
 if((m.talent==='steady'&&actionId==='practice')||(m.talent==='observant'&&actionId==='medicine')||(m.talent==='focused'&&actionId==='understand'))out.minutes=Math.max(30,out.minutes-30);
 if((actionId==='work'||actionId==='relief')&&p.location==='location.inn')out.location=p.location;
 if(actionId==='job.CH05'&&p.location==='location.teahouse')out.location=p.location;
 if(out.location&&p.location!==out.location)out.errors.push('需前往'+places.find(l=>l.id===out.location)?.name+'。');
 if(w.money<out.cost)out.errors.push('钱款不足；公共短工与包食宿帮工不收押金。');
 if(out.reward>m.bank)out.errors.push('本地今日用工预算不足，明日补充。');
 if(out.fatigue&&p.fatigue>=80&&!['relief','work'].includes(actionId)&&!actionId.startsWith('travel.'))out.errors.push('疲劳过高，先休息。');
 return out;
}
function start(w:World,actionId:string,choice:string){
 free(w);const m=w.mortal,preview=previewMortal(w,actionId,choice);requireRule(!preview.errors.length,'MISSING_REQUIREMENT',preview.errors.join(' '));
 const id='mortal.task.'+(w.counters.mortalTask=(w.counters.mortalTask??0)+1);const people:Person[]=[];
 if(preview.role){const p=meetRole(w,preview.role,id,w.entities[PLAYER].location!);people.push(p);pin(p,id,'行动占用','L2');}
 pay(w,preview.cost);
 const chainIndex=m.stages[actionId]??0;
 if(actionId==='CH04'&&chainIndex===0){asset(w,'object.old-qin','item','待修旧琴',id,people[0]!.id);pin(people[0],'object.old-qin','物品所有权','A');}
 if(actionId==='CH04'&&chainIndex===1){requireRule(m.assets['object.old-qin']?.ownerId!==PLAYER,'PERMISSION_DENIED','维修不转移旧琴所有权');m.assets['object.old-qin'].status='reserved';}
 if(preview.cost&&(actionId.startsWith('job.')||['CH02','CH04'].includes(actionId)&&chainIndex===1)){asset(w,'material.'+id,'item','本次已购材料',id);m.assets['material.'+id].status='consumed';m.assets['material.'+id].quantity=0;}

 let contractId:string|null=null;
 if(preview.reward){contractId='contract.'+id;m.bank-=preview.reward;m.contracts[contractId]={id:contractId,personId:people[0]?.id??null,kind:actionId,state:'active',escrow:preview.reward,deposit:0,dueTick:w.tick+preview.minutes+DAY,receipt:null};asset(w,contractId,'commitment','待完成的工作约定',id);entry(w,'regional.work',contractId,preview.reward,'预留报酬');if(people[0])pin(people[0],contractId,'待付报酬');}
 if(actionId==='CH08'&&(m.stages.CH08??0)===1)m.foodDays--;
 if(actionId==='relief'||actionId==='CH01'&&choice==='relief')m.reliefDay=Math.floor(w.tick/DAY);
 m.task={id,actionId,choice,startedTick:w.tick,dueTick:w.tick+preview.minutes,personIds:people.map(p=>p.id),cost:preview.cost,contractId};
 log(w,'开始「'+preview.name+'」；'+preview.minutes+' 分钟'+(preview.cost?'，支出 '+preview.cost+' 文':'')+'。');
}
function settleContract(w:World,id:string,state:'completed'|'cancelled'|'expired'){
 const c=w.mortal.contracts[id];if(!c||c.receipt)return;
 entry(w,id,state==='completed'?PLAYER:'regional.work',c.escrow,state);if(state==='completed')w.money+=c.escrow;else w.mortal.bank+=c.escrow;if(w.mortal.assets[id])w.mortal.assets[id].status='returned';
 c.escrow=0;c.state=state;c.receipt=id+'/'+state;w.receipts[c.receipt]=state;unpin(w,id);
}
export function cancelMortal(w:World){const t=w.mortal.task;requireRule(t,'MISSING_REQUIREMENT','没有正在进行的行动。');if(t!.contractId)settleContract(w,t!.contractId,'cancelled');unpin(w,t!.id);for(const id of t!.personIds){remember(w.mortal.people[id],'约定已提前取消，未领取报酬。');releasePerson(w,id);}w.receipts[t!.id]='cancelled';w.mortal.task=null;w.mortal.plan=0;if(w.mortal.assets['object.old-qin']?.status==='reserved')w.mortal.assets['object.old-qin'].status='available';log(w,'已取消；已投入的时间与开工材料不返还，未付报酬归还委托方，当前阶段可重试。','warning');}
function finish(w:World){
 const m=w.mortal,t=m.task;if(!t||w.receipts[t.id])return;const p=w.entities[PLAYER],a=t.actionId,choice=t.choice,chain=chains.find(c=>c.id===a),index=m.stages[a]??0;
 if(['practice','correct','understand','apply'].includes(a)&&(p.health<40||p.fatigue>60)){cancelMortal(w);log(w,'修持中身体或专注已不适合，停止本次练习；有效进度未增加，请调养后再试。','warning');return;}
 const fatigue=a==='rest'?0:a==='work'||a==='relief'?choice==='light'?6:18:a.startsWith('travel.')?2:['rent','food','method'].includes(a)?0:8;
 p.fatigue=Math.min(100,p.fatigue+fatigue);
 if(t.contractId)settleContract(w,t.contractId,'completed');
 if(chain){
  m.choices[a+'/'+index]=choice;m.stages[a]=index+1;
  if(chain.skill)m.skills[chain.skill]=(m.skills[chain.skill]??0)+1;
  if(a==='CH01'&&index===1){m.paidUntil=Math.max(w.tick,m.paidUntil)+2*DAY;if(choice==='relief')m.foodDays+=2;flag(w,'shelter');}
  if(a==='CH01'&&index===2)flag(w,'income');
  if(a==='CH09'&&index===0){m.channel=choice;asset(w,'public.manual','method','公开基础注本',t.id);}
  if(a==='CH09'&&index===2&&choice==='leave')m.channel='independent';
  if(a==='CH04'&&index===2&&m.assets['object.old-qin'])m.assets['object.old-qin'].status='returned';
  if(chainDone(w,a)){
   flag(w,a);if(chain.work&&!w.works.some(x=>x.id==='work.'+a))w.works.push({id:'work.'+a,authorId:PLAYER,title:a==='CH06'&&choice==='notes'?'旧水道访谈录':chain.work,topic:chain.skill!,tick:w.tick});
   if(chain.work)asset(w,'work.'+a,'work',chain.work,t.id);
   if(['CH03','CH06','CH08'].includes(a)){flag(w,'clue');asset(w,'clue.'+a,'clue',a==='CH03'?'异常药畦的位置与时段':a==='CH06'?'旧观观测位置':'旧观安全路线',t.id);}
   log(w,'「'+chain.name+'」已结清。'+(chain.work?'留下《'+chain.work+'》，后续专业工作已开放。':''),'success');
  }
 }else if(a==='work'||a==='relief'||a.startsWith('job.')){
  if(m.workDay!==Math.floor(w.tick/DAY)){m.workDay=Math.floor(w.tick/DAY);m.workCount=0;}m.workCount++;flag(w,'income');
  if(a==='relief'){m.foodDays+=2;m.paidUntil=Math.max(w.tick,m.paidUntil)+2*DAY;flag(w,'shelter');}
 }else if(a==='rest'){p.fatigue=Math.max(0,p.fatigue-55);p.health=Math.min(100,p.health+10);}
 else if(a==='rent'){m.paidUntil=Math.max(w.tick,m.paidUntil)+2*DAY;flag(w,'shelter');}
 else if(a==='food')m.foodDays+=2;
 else if(a.startsWith('travel.'))p.location=a.slice(7);
 else if(a==='method'){asset(w,choice,'method',methods.find(d=>d.id===choice)!.name,t.id);m.method=choice;m.understanding=0;m.practice=0;m.corrected=false;m.applied=false;}
 else if(a==='understand')m.understanding=Math.min(2,m.understanding+1);
 else if(a==='medicine')m.skills.medicine=(m.skills.medicine??0)+1;
 else if(a==='practice'){m.practice++;log(w,m.practice===1?'试行发现呼吸与注意力不同步。请比对注本，纠正后再验证。':'这一次，变化可以依照步骤再次出现。','success');}
 else if(a==='correct')m.corrected=true;
 else if(a==='apply'){m.applied=true;flag(w,'applied.'+m.method);log(w,methods.find(x=>x.id===m.method)!.application+'：你知道第一步踩在哪里。普通技艺、道行和寿数未因此改变。','success');}
 for(const id of t.personIds){const person=m.people[id];remember(person,'共同完成：'+(chain?.name??a));if(person.role!=='R02'){const edge=m.relationships[id]??={personId:id,kind:'acquaintance',trust:0,facts:[]};edge.trust=Math.min(100,edge.trust+1);edge.kind=chain?.skill?'colleague':person.role==='R10'?'guide':edge.kind;edge.facts.push('完成约定：'+(chain?.name??a));edge.facts=edge.facts.slice(-12);log(w,person.name+'因你实际完成这次约定，更信任了一分。');}if(person.role!=='R02')person.contact='可寄信至青溪'+(roles.find(r=>r.id===person.role)?.name??'客舍');person.lastSeen=w.tick;person.knownStatus='最后在'+places.find(l=>l.id===person.location)?.name+'相见';if(chain?.work&&chainDone(w,a)){person.keyMemories.push('参与见证《'+chain.work+'》');pin(person,'work.'+a,'作品来源','A');}}
 unpin(w,t.id);w.receipts[t.id]='completed';m.task=null;for(const id of t.personIds)releasePerson(w,id);
 log(w,'「'+(chain?.stages[index]?.name??a)+'」完成，人物与占用已结清。','success');
 if(!m.completed&&done(w,'income')&&m.paidUntil>w.tick&&w.works.length>0&&m.flags.some(f=>f.startsWith('applied.'))){m.completed=true;log(w,'凡尘篇回顾：有可维持的食宿，有亲手做成的事，有可靠修法与首次应用。你可以留在青溪继续生活。','success');}
}
export function mortalDeadline(w:World,target:number){const m=w.mortal;return Math.min(target,...[m.task?.dueTick,...Object.values(m.messages).filter(x=>x.state==='travelling').map(x=>x.dueTick),...Object.values(m.people).flatMap(p=>[p.departAt,p.returnAt])].filter((n):n is number=>typeof n==='number'&&n>w.tick));}
export function tickMortal(w:World){
 if(!isMortal(w))return false;const m=w.mortal;let interruption=false;
 if(m.task&&m.task.dueTick<=w.tick)finish(w);
 const day=Math.floor(w.tick/DAY);
 while(m.lastChargedDay<day){m.lastChargedDay++;m.bank=Math.min(240,m.bank+36);if(m.foodDays>0)m.foodDays--;else if(w.money>=2){w.money-=2;entry(w,PLAYER,'local.food',2,'跨日饮食');}else {w.entities[PLAYER].health=Math.max(40,w.entities[PLAYER].health-4);log(w,'今日饮食不足。公共低强度短工和包食宿帮工仍可恢复生活。','warning');}if(m.paidUntil<=w.tick)log(w,'铺位已到期，可续住或做包食宿帮工；随身物品保留。','warning');}
 for(const msg of Object.values(m.messages))if(msg.state==='travelling'&&msg.dueTick<=w.tick){const p=m.people[msg.personId];msg.state=p.worldStatus==='dead'||p.worldStatus==='missing'?'returned':'delivered';interruption=true;remember(p,msg.state==='delivered'?'收到近况来信。':'来信退回。');unpin(w,msg.id);log(w,p.name+(msg.state==='delivered'?'的回信到了：我已收到近况，若要相见，请按行程约定。':'的信件退回，暂无可靠消息。'));}
 for(const p of Object.values(m.people)){
  if(p.departAt!==null&&p.departAt<=w.tick&&p.worldStatus==='local'&&!p.pins.some(r=>r.minimumTier==='L2')){p.worldStatus='travelling';p.location='downstream';p.departAt=null;p.returnAt=w.tick+7*DAY;p.knownStatus='来信告知：按原定行程赴下游';log(w,p.name+'按行程赴下游，身份与已学内容保留。');}
  if(p.returnAt!==null&&p.returnAt<=w.tick&&p.worldStatus==='travelling'){p.worldStatus='local';p.location=roles.find(r=>r.id===p.role)!.location;p.returnAt=null;p.departAt=w.tick+7*DAY;p.knownStatus='回信告知：已回到青溪';}
  if(!m.task?.personIds.includes(p.id))releasePerson(w,p.id);
 }
 for(const c of Object.values(m.contracts))if(c.state==='active'&&c.dueTick<=w.tick&&m.task?.contractId!==c.id)settleContract(w,c.id,'expired');
 // Small events wait for their actual context and do not reward passive waiting.
 for(const seed of shortSeeds){
  if(Object.values(m.shortEvents).filter(e=>e.state==='open').length>=3)break;
  const eligible=seed.trigger==='life'?chainDone(w,'CH01'):seed.trigger==='mail'?Object.values(m.messages).some(x=>x.state==='delivered'):chainDone(w,seed.trigger);
  if(eligible&&!m.shortEvents[seed.id])m.shortEvents[seed.id]={id:seed.id,state:'open',choice:null,personId:null,createdTick:w.tick};
 }
 if(interruption){m.plan=0;return true;}
 if(m.plan>0&&!m.task){
  if(w.entities[PLAYER].fatigue>=m.planStopFatigue||w.entities[PLAYER].health<50||m.foodDays<1||m.paidUntil<w.tick+360||Object.values(m.shortEvents).some(e=>e.state==='open')){m.plan=0;log(w,'长期安排暂停：请检查食宿、身体或待处理消息。');}
  else {const pre=previewMortal(w,'work','light');if(pre.errors.length){m.plan=0;log(w,'长期安排暂停：'+pre.errors.join(' '));}else{m.plan--;start(w,'work','light');}}
 }
 return interruption;
}
export function mortalCommand(w:World,c:MortalCommand){
 const m=w.mortal;requireRule(isMortal(w),'PERMISSION_DENIED','旧档仍沿用原有旅程。');
 if(c.type==='CreateMortal'){
  requireRule(!m.created,'ALREADY_SETTLED','出身已经确定。');requireRule(c.name.trim().length>0&&c.name.trim().length<=16,'MISSING_REQUIREMENT','姓名需为 1—16 个字。');
  const b=backgrounds.find(x=>x.id===c.origin);requireRule(b&&['steady','observant','focused'].includes(c.talent),'MISSING_REQUIREMENT','未知出身或天赋');
  m.created=true;m.origin=c.origin;m.talent=c.talent;w.entities[PLAYER].name=c.name.trim();w.entities[PLAYER].description=b!.name+'，成年后独自抵达青溪。';w.entities[PLAYER].tags=['player'];if(b!.skill)m.skills[b!.skill]=1;
  if(c.acquaintance&&c.origin!=='traveller'){const r=({herbalist:'R08',artisan:'R05',scribe:'R06',musician:'R07'} as Record<string,string>)[c.origin];const p=meetRole(w,r,'background');if(p.origin==='resident')m.population.embodied--;else m.population.visitors--;p.origin='background';p.anchors[0]='曾与你同业学习，有一面旧缘';p.contact='寄信至原籍同业处';p.worldStatus='travelling';p.location='hometown';p.knownStatus='旧相识，目前在外地，可通信';p.returnAt=7*DAY;p.departAt=null;p.simulationTier='L1';p.retentionClass='important';m.relationships[p.id]={personId:p.id,kind:'acquaintance',trust:1,facts:['在原籍曾同业学习，现可通信']};}
  asset(w,'tool.'+c.origin,'item',b!.tool,'background');if(c.origin!=='traveller')asset(w,'bag','item','个人包袱','background');flag(w,'tool.'+c.origin);log(w,'你带着'+b!.tool+'、24 文和两日干粮来到青溪。');return;
 }
 requireRule(m.created,'MISSING_REQUIREMENT','请先选择出身。');
 if(c.type==='MortalAction')start(w,c.actionId,c.choice);
 else if(c.type==='CancelMortal')cancelMortal(w);
 else if(c.type==='MortalFocus'){requireRule(['life','work','path'].includes(c.focus),'MISSING_REQUIREMENT','未知目标');m.focus=c.focus;}
 else if(c.type==='MortalPlan'){requireRule(Number.isInteger(c.days)&&c.days>=0&&c.days<=7&&Number.isInteger(c.stopFatigue)&&c.stopFatigue>=20&&c.stopFatigue<=70,'MISSING_REQUIREMENT','安排 0—7 次工作，疲劳阈值 20—70。');requireRule(done(w,'income'),'MISSING_REQUIREMENT','先实际完成一次劳动。');m.plan=c.days;m.planStopFatigue=c.stopFatigue;tickMortal(w);}
 else if(c.type==='MortalContact'){
  requireRule(['bookmark','letter','meet'].includes(c.operation),'MISSING_REQUIREMENT','未知交往方式');const p=m.people[c.personId];requireRule(p,'MISSING_REQUIREMENT','找不到这位相识。');
  if(c.operation==='bookmark'){p.retentionClass=p.retentionClass==='important'?'ordinary':'important';if(p.retentionClass==='important')pin(p,'bookmark.'+p.id,'玩家关注');else unpin(w,'bookmark.'+p.id);}
  else if(c.operation==='letter'){requireRule(p.contact&&p.worldStatus!=='dead','MISSING_REQUIREMENT','没有有效的通信途径。');requireRule(!Object.values(m.messages).some(x=>x.personId===p.id&&x.state==='travelling'),'ACTOR_BUSY','已有一封信在途。');pay(w,1);const id='message.'+(w.counters.message=(w.counters.message??0)+1);m.messages[id]={id,personId:p.id,dueTick:w.tick+2*DAY,state:'travelling',text:'问候近况'};pin(p,id,'在途信件');p.simulationTier='L1';}
  else if(c.operation==='meet'){free(w);requireRule(p.worldStatus==='local'&&p.location===w.entities[PLAYER].location&&!p.pins.some(r=>r.minimumTier==='L2'),'WRONG_LOCATION','对方不在此地或正忙，请按已知去向寻访。');p.lastSeen=w.tick;p.encounters++;p.simulationTier='L1';remember(p,'再次在青溪相见。');log(w,'与'+p.name+'重逢，仍记得从前的相遇。');}
 }else if(c.type==='MortalEvent'){
  const e=m.shortEvents[c.eventId],seed=shortSeeds.find(s=>s.id===c.eventId);requireRule(e?.state==='open'&&seed&&['act','decline'].includes(c.choice),'ALREADY_SETTLED','此事不可重复处理。');e.state='resolved';e.choice=c.choice;m.choices[e.id]=c.choice;w.receipts['short.'+e.id]=c.choice;log(w,seed!.name+'：'+(c.choice==='act'?seed!.act:seed!.decline)+'。');
 }
}
export function assertMortal(w:World){
 const m=w.mortal;
 for(const [id,a]of Object.entries(m.assets)){if(a.id!==id)throw new Error('物品索引不一致');if(a.ownerId!==PLAYER&&!m.people[a.ownerId])throw new Error('物品所有者丢失');}
 for(const [id,p]of Object.entries(m.people)){if(p.id!==id)throw new Error('人物身份索引不一致');if(p.worldStatus!=='local'&&p.simulationTier==='L2')throw new Error('远方人物不能现场行动');for(const pin of p.pins){if(pin.ownerId.startsWith('mortal.task.')&&m.task?.id!==pin.ownerId)throw new Error('行动引用悬空');if(pin.ownerId.startsWith('contract.')&&m.contracts[pin.ownerId]?.state!=='active')throw new Error('合同保护未结清');if(pin.ownerId.startsWith('message.')&&m.messages[pin.ownerId]?.state!=='travelling')throw new Error('消息保护未结清');if(pin.ownerId.startsWith('work.')&&!w.works.some(x=>x.id===pin.ownerId))throw new Error('作品引用悬空');if(pin.ownerId.startsWith('object.')&&!m.assets[pin.ownerId])throw new Error('所有权引用悬空');}}
 for(const edge of Object.values(m.relationships))if(!m.people[edge.personId])throw new Error('关系身份悬空');
 for(const id of Object.values(m.encounters))if(!m.people[id])throw new Error('相遇引用悬空');
 for(const c of Object.values(m.contracts))if(c.personId&&!m.people[c.personId])throw new Error('合同身份悬空');
 for(const msg of Object.values(m.messages))if(!m.people[msg.personId])throw new Error('信件身份悬空');
 if(m.task){if(m.task.dueTick<=m.task.startedTick||m.task.dueTick<w.tick||w.receipts[m.task.id])throw new Error('无效凡尘行动');for(const id of m.task.personIds)if(!m.people[id]?.pins.some(p=>p.ownerId===m.task!.id&&p.minimumTier==='L2'))throw new Error('人物占用丢失');}
 for(const [id,stage]of Object.entries(m.stages))if(!chains.some(c=>c.id===id&&stage<=c.stages.length))throw new Error('未知事件阶段');
}
export {freshMortal};
