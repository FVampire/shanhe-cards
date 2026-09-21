import { content,actionById,type ActionDef } from '../content';
import { PLAYER,type World,type Project,type Entity } from './model';
import { available,busy,locationOf,ownedBy,hasFact,recordFact,baseEntity,log } from './world';
export class RuleError extends Error{constructor(public code:string,message:string){super(message);}}
export const fail=(code:string,message:string):never=>{throw new RuleError(code,message);};
export const requireRule=(yes:unknown,code:string,message:string)=>{if(!yes)fail(code,message);};
const stages=['acquired','understood','mastered'];
export function conditionErrors(w:World,a:ActionDef,b:Record<string,string>,finishing=false):string[]{
 const errors:string[]=[];const actor=w.entities[b.actor];
 for(const c of a.conditions){
  switch(c.op){
   case 'skill': if((w.entities[b[c.slot]]?.skills[c.skillId]??0)<c.value)errors.push((content.skills.find(s=>s.id===c.skillId)?.name??c.skillId)+'需达到 '+c.value);break;
   case 'knowledge': if(stages.indexOf(w.entities[b[c.slot]]?.knowledge[c.knowledgeId])<stages.indexOf(c.stage))errors.push('需理解'+content.knowledge.find(k=>k.id===c.knowledgeId)?.name);break;
   case 'no_work': if(w.works.some(x=>x.authorId===b.actor&&x.topic===c.topic))errors.push('已经完成这项作品');break;
   case 'location': if(actor&&locationOf(w,actor.id)!==c.value)errors.push('需身处'+content.locations.find(l=>l.id===c.value)?.name);break;
   case 'not_location': if(actor&&locationOf(w,actor.id)===c.value)errors.push('已经在这里');break;
   case 'consent': if(!finishing&&(w.consents.duet.uses<1||w.tick+a.duration>=w.consents.duet.expiresTick))errors.push('合奏许可已用尽，或无法在约定期限前完成');break;
   case 'consent_spent': if(!finishing&&w.consents.duet.uses>=1&&w.tick+a.duration<w.consents.duet.expiresTick)errors.push('合奏之约还在，不必强求');break;
   case 'contract': if(w.contract.state!=='accepted'||(finishing?w.tick:w.tick+a.duration)>=w.contract.expiresTick)errors.push('需要有效演出合同，且在截止之前完成');break;
   case 'market_demand': if(!finishing&&(w.market.demand<1||w.market.money<12))errors.push('今日茶席已满，或茶肆预算不足');break;
   case 'daily_harvest': if(w.counters.harvestDay===Math.floor(w.tick/1440))errors.push('今日已采收，明日再来');break;
  }
 }
 return errors;
}
export function validateBindings(w:World,a:ActionDef,b:Record<string,string>,finishing=false){
 requireRule(Object.keys(b).length===a.slots.length,'MISSING_REQUIREMENT','卡牌组合不完整');
 requireRule(new Set(Object.values(b)).size===Object.values(b).length,'MISSING_REQUIREMENT','同一对象不能占用两个槽位');
 const places:string[]=[];
 for(const s of a.slots){
  const e=w.entities[b[s.name]];
  requireRule(e&&e.kind===s.kind&&s.tags.every(t=>e.tags.includes(t)),'MISSING_REQUIREMENT','缺少'+s.name+'对应卡牌');
  requireRule(e.active&&e.quantity>0,'MISSING_REQUIREMENT',e.name+'当前不可用');
  if(e.kind==='character'){
   requireRule(e.willing||['action.rest','action.nurture','action.medicine','action.converse','action.lore_talk'].includes(a.id),'PERMISSION_DENIED',e.name+'不愿参与这项工作');
   requireRule(e.health>0,'MISSING_REQUIREMENT',e.name+'需要先恢复健康');
   if(!['action.rest','action.nurture','action.medicine'].includes(a.id))requireRule(e.fatigue<80,'MISSING_REQUIREMENT',e.name+'过于疲劳，请先歇息');
  }
  if(!finishing)requireRule(!busy(w,e.id),'ACTOR_BUSY',e.name+'正在另一项行动中');
  if(e.kind==='item')requireRule(e.ownerId===ownedBy(w,b.actor)||e.ownerId==='org','PERMISSION_DENIED','没有该物品的使用权');
  places.push(locationOf(w,e.id));
 }
 requireRule(new Set(places).size===1,'WRONG_LOCATION','所有实际参与者与工具必须在同一地点');
 const errors=conditionErrors(w,a,b,finishing);requireRule(!errors.length,'MISSING_REQUIREMENT',errors[0]??'条件不满足');
}
function resources(w:World,definitionId:string,owner:string){return Object.values(w.entities).filter(e=>e.kind==='item'&&e.definitionId===definitionId&&e.ownerId===owner&&available(w,e.id)>0);}
export function resourceErrors(w:World,a:ActionDef,b:Record<string,string>){
 const messages:string[]=[];for(const c of a.costs){
  const owner=c.owner==='org'?'org':ownedBy(w,b.actor);
  const count=c.resource==='currency'?(owner==='org'?w.organization.money:w.money):resources(w,c.resource,owner).reduce((sum,e)=>sum+available(w,e.id),0);
  if(count<c.quantity)messages.push('不足：'+(c.resource==='currency'?'灵钱':content.items.find(i=>i.id===c.resource)?.name)+' × '+c.quantity);
 }return messages;
}
export type Preview={action:ActionDef;bindings:Record<string,string>;errors:string[]};
export function matchActions(w:World,ids:string[]):Preview[]{
 const unique=[...new Set(ids)].filter(id=>w.entities[id]);const result:Preview[]=[];
 for(const a of content.actions){
  if(a.slots.length!==unique.length)continue;
  const bind=(index:number,b:Record<string,string>,used:Set<string>)=>{
   if(index===a.slots.length){
    let errors:string[]=[];try{validateBindings(w,a,b);}catch(e){errors.push((e as Error).message);}
    errors.push(...resourceErrors(w,a,b));result.push({action:a,bindings:b,errors});return;
   }
   const s=a.slots[index];
   for(const id of unique){const e=w.entities[id];if(!used.has(id)&&e.kind===s.kind&&s.tags.every(t=>e.tags.includes(t)))bind(index+1,{...b,[s.name]:id},new Set([...used,id]));}
  };bind(0,{},new Set());
 }return result;
}
export function suggestedBindings(w:World,a:ActionDef):Record<string,string>|null{
 const b:Record<string,string>={};const used=new Set<string>();
 for(const s of a.slots){
  const candidates=Object.values(w.entities).filter(e=>e.kind===s.kind&&s.tags.every(t=>e.tags.includes(t))&&!used.has(e.id)&&e.quantity>0);
  candidates.sort((x,y)=>Number(y.id===PLAYER)-Number(x.id===PLAYER)||Number(locationOf(w,y.id)===locationOf(w,PLAYER))-Number(locationOf(w,x.id)===locationOf(w,PLAYER))||Number(x.ownerId==='org')-Number(y.ownerId==='org'));
  if(!candidates[0])return null;b[s.name]=candidates[0].id;used.add(candidates[0].id);
 }return b;
}
export function startAction(w:World,actionId:string,b:Record<string,string>,delegated=false):Project{
 const a=actionById(actionId);validateBindings(w,a,b);
 requireRule(delegated?b.actor==='character.worker':b.actor===PLAYER,'PERMISSION_DENIED','只能安排本人，或通过药园委托派工');
 const errors=resourceErrors(w,a,b);requireRule(!errors.length,'RESOURCE_RESERVED',errors[0]??'资源已被预留');
 w.counters.project=(w.counters.project??0)+1;const id='project.'+w.counters.project;
 const p:Project={id,definitionId:actionId,boundSlots:{...b},state:'running',startedTick:w.tick,dueTick:w.tick+a.duration,generation:0,spent:[],delegated,receipt:null};w.projects[id]=p;
 for(const s of a.slots){if(s.usage==='reference')continue;const rid=id+'/'+s.name;w.reservations[rid]={id:rid,projectId:id,resourceId:b[s.name],quantity:1,mode:'exclusive'};}
 for(const [index,c]of a.costs.entries()){
  const owner=c.owner==='org'?'org':ownedBy(w,b.actor);
  if(c.resource==='currency'){if(owner==='org')w.organization.money-=c.quantity;else w.money-=c.quantity;p.spent.push('灵钱 × '+c.quantity);continue;}
  let remaining=c.quantity;
  for(const e of resources(w,c.resource,owner)){
   const quantity=Math.min(remaining,available(w,e.id));remaining-=quantity;
   if(c.phase==='start'){e.quantity-=quantity;p.spent.push(e.name+' × '+quantity);}
   else {const rid=id+'/cost/'+index+'/'+e.id;w.reservations[rid]={id:rid,projectId:id,resourceId:e.id,quantity,mode:'quantity'};}
   if(remaining===0)break;
  }
  requireRule(remaining===0,'RESOURCE_RESERVED','资源预留失败');
 }
 if(a.id==='action.duet')w.consents.duet.uses--;
 if(a.id==='action.busk'){w.market.money-=12;w.market.demand--;p.spent.push('market_escrow:12');}
 w.schedule.push({id:id+'/0',sourceId:id,generation:0,dueTick:p.dueTick,phase:10});
 log(w,w.entities[b.actor].name+'开始'+a.name+'。');
 return p;
}
export function releaseProject(w:World,p:Project){
 for(const r of Object.values(w.reservations))if(r.projectId===p.id)delete w.reservations[r.id];
}
export function cancelProject(w:World,p:Project,interrupted=false){
 if(p.state!=='running')return;
 p.state=interrupted?'interrupted':'cancelled';p.generation++;p.receipt=p.id;
 w.receipts[p.id]=p.state;releaseProject(w,p);
 if(p.spent.includes('market_escrow:12')){w.market.money+=12;w.market.demand=Math.min(2,w.market.demand+1);}
 log(w,actionById(p.definitionId).name+(interrupted?'因条件变化而中断。':'已取消；未消耗的物资已归还。'),'warning');
}
export function giveItem(w:World,definitionId:string,owner:string,quantity:number,source:string){
 const old=Object.values(w.entities).find(e=>e.definitionId===definitionId&&e.ownerId===owner);
 if(old){old.quantity+=quantity;return;}
 const def=content.items.find(d=>d.id===definitionId)!;
 const e:Entity={...baseEntity('instance.'+source+'.'+definitionId,'item',def.name),definitionId,tags:def.tags,description:def.description,art:def.art,quantity,ownerId:owner,containerId:owner===PLAYER?PLAYER:null,location:owner===PLAYER?null:'location.garden'};
 w.entities[e.id]=e;
}
export function completeProject(w:World,p:Project){
 if(p.state!=='running'||w.receipts[p.id])return;
 const a=actionById(p.definitionId);
 try{validateBindings(w,a,p.boundSlots,true);}catch{cancelProject(w,p,true);return;}
 for(const r of Object.values(w.reservations))if(r.projectId===p.id&&r.mode==='quantity')w.entities[r.resourceId].quantity-=r.quantity;
 const actor=w.entities[p.boundSlots.actor];
 for(const e of a.effects){
  switch(e.op){
   case 'practice': {const target=w.entities[p.boundSlots[e.slot]];target.skills[e.skillId]=(target.skills[e.skillId]??0)+e.units;break;}
   case 'knowledge':{const target=w.entities[p.boundSlots[e.slot]];if(stages.indexOf(target.knowledge[e.knowledgeId])<stages.indexOf(e.stage))target.knowledge[e.knowledgeId]=e.stage;break;}
   case 'relationship':{const key=p.boundSlots[e.from]+'/'+p.boundSlots[e.to];w.relations[key]=Math.max(0,(w.relations[key]??0)+e.units);break;}
   case 'health':case 'fatigue': {const target=w.entities[p.boundSlots[e.slot]];target[e.op]=Math.max(0,Math.min(100,target[e.op]+e.units));break;}
   case 'fact':recordFact(w,e.factType,p.boundSlots[e.slot],p.id);break;
   case 'work':w.works.push({id:p.id+'/work',authorId:actor.id,title:e.title,topic:e.topic,tick:w.tick});log(w,'完成作品《'+e.title+'》。','success');break;
   case 'payment':if(e.source==='contract'){requireRule(w.contract.escrow>=e.amount,'MISSING_REQUIREMENT','合同预留款不足');w.contract.escrow-=e.amount;w.contract.state='completed';w.reputation.music=(w.reputation.music??0)+1;}w.money+=e.amount;log(w,'履行演出约定，收到 '+e.amount+' 枚灵钱。','success');break;
   case 'item':giveItem(w,e.definitionId,e.owner==='org'?'org':ownedBy(w,actor.id),e.quantity,p.id);break;
   case 'longevity':if(!hasFact(w,'longevity',actor.id)){actor.longevityDays+=e.days;recordFact(w,'longevity',actor.id,p.id);log(w,'松风调息法经实践验证，身体岁月余裕增加三十日。','success');}break;
   case 'travel':actor.location=e.location;break;
   case 'insight':{const id='insight.'+p.id;if(!w.insights.some(i=>i.id===id))w.insights.push({id,subjectId:actor.id,question:e.question,understanding:e.understanding,source:p.id});break;}
   case 'willing':w.entities[p.boundSlots[e.slot]].willing=e.value;break;
  }
 }
 if(a.id==='action.gather')w.counters.harvestDay=Math.floor(w.tick/1440);
 if(a.id==='action.duet'&&!w.insights.some(i=>i.id==='insight.listening'))w.insights.push({id:'insight.listening',subjectId:actor.id,question:'为何自己的节拍总抢在友人之前？',understanding:'在停顿处听见对方，再让自己的声音进入。',source:p.id});
 if(['action.converse','action.lore_talk','action.duet'].includes(a.id)&&!w.insights.some(i=>i.id==='insight.teacher_wrist'))w.insights.push({id:'insight.teacher_wrist',subjectId:actor.id,question:'他为何只允两次合奏？',understanding:'腕力不如从前。两次是体贴，不是吝啬。',source:p.id});
 if(a.id==='action.learn_breath'&&!w.insights.some(i=>i.id==='insight.physician_search'))w.insights.push({id:'insight.physician_search',subjectId:actor.id,question:'她为何在青溪停留？',understanding:'她在寻一味能稳住岁月的方。清和散只是路过的名字。',source:p.id});
 p.state='completed';p.receipt=p.id;w.receipts[p.id]='completed';releaseProject(w,p);
 if(p.delegated)w.organization.cycles++;
 log(w,a.name+'完成。','success');
}