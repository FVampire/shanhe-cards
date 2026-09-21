import { isMortal,mortalCommand,mortalDeadline,tickMortal } from './mortal';
import type { MortalCommand } from './mortal-model';
import { PLAYER,type World,type Envelope,type Result,type Command } from './model';
import { assertWorld,busy,available,locationOf,ownedBy,log,hasFact,recordFact } from './world';
import { startAction,cancelProject,completeProject,requireRule,RuleError,giveItem } from './actions';
import { followups,expire,chooseEvent,investigate,encounter,addEvent } from './events';
import { content } from '../content';
function delegate(w:World){
 const o=w.organization;if(!o.delegation)return;
 if(Object.values(w.projects).some(p=>p.delegated&&p.state==='running'))return;
 let reason='';
 if(!o.authorized)reason='负责人的委托权限已失效';
 else if(!o.proxy&&busy(w,PLAYER))reason='负责人正在忙碌，请安排代理';
 else if(!w.entities['character.worker'].active||!w.entities['character.worker'].willing)reason='小满暂不愿或无法工作';
 else if(!w.entities['facility.furnace'].active)reason='药炉需要修理';
 else if(o.budget<2||o.money<2)reason='授权预算或药园资金不足';
 if(!reason){
  const worker=w.entities['character.worker'];
  if(worker.fatigue>= (o.policy==='careful'?60:80))reason='小满疲劳过高，需要休息';
 }
 if(reason){blockDelegate(w,reason);return;}
 // Draft each cycle so failed resource acquisition cannot leave partial reservations.
 const draft=structuredClone(w);
 try{
  startAction(draft,'action.brew',{actor:'character.worker',furnace:'facility.furnace',recipe:'instance.org_recipe'},true);
  draft.organization.money-=2;draft.organization.budget-=2;draft.organization.blocked=null;
  Object.assign(w,draft);
 }catch(e){blockDelegate(w,(e as Error).message);}
}
function blockDelegate(w:World,reason:string){
 w.organization.blocked=reason;w.organization.delegation=false;
 w.counters.anomaly=(w.counters.anomaly??0)+1;
 addEvent(w,'event.anomaly.'+w.counters.anomaly,'anomaly','药园来报',reason+'。下一轮没有启动，也没有生成药物。',2880);
 log(w,'药园委托暂停：'+reason,'warning');
}
function apply(w:World,c:Command){
 if(isMortal(w)){
  requireRule(c.type.startsWith('Mortal')||c.type==='CreateMortal'||c.type==='CancelMortal','PERMISSION_DENIED','凡尘篇请使用当前行事与生活入口。');
  mortalCommand(w,c as MortalCommand);return;
 }

 switch(c.type){
 case 'StartAction':startAction(w,c.actionId,c.bindings);break;
 case 'CancelAction':{const p=w.projects[c.projectId];requireRule(p,'MISSING_REQUIREMENT','行动不存在');requireRule(p.boundSlots.actor===PLAYER||w.organization.authorized,'PERMISSION_DENIED','没有取消权限');cancelProject(w,p);if(p.delegated)w.organization.delegation=false;break;}
 case 'ChooseEventOption':chooseEvent(w,c.eventId,c.option);break;
 case 'AdvanceProfession':{
  const p=w.entities[PLAYER];const def=content.professions.find(d=>d.id===c.professionId);requireRule(def,'MISSING_REQUIREMENT','未知职业');
  requireRule(c.targetLevel===1&&c.targetLevel===(p.professions[c.professionId]??0)+1,'ALREADY_SETTLED','本原型提供该职业一级晋升，已获得的等级不可重复领取');
  requireRule((p.skills[def!.skillId]??0)>=def!.required&&['understood','mastered'].includes(p.knowledge[def!.knowledgeId])&&hasFact(w,def!.fact),'MISSING_REQUIREMENT',def!.description);
  const key=PLAYER+'/'+c.professionId+'/'+c.targetLevel;requireRule(!w.receipts[key],'ALREADY_SETTLED','该晋升已经结算');
  p.professions[c.professionId]=c.targetLevel;w.receipts[key]='advanced';log(w,'晋为'+def!.name+'一级。道行因已获职业等级增加一点。','success');break;
 }
 case 'AssignDelegate':{
  requireRule(w.organization.authorized,'PERMISSION_DENIED','请先接受药园职事');requireRule(Number.isSafeInteger(c.budget)&&c.budget>=0&&c.budget<=w.organization.money,'MISSING_REQUIREMENT','授权预算不可超过药园资金');
  w.organization.delegation=c.enabled;w.organization.proxy=c.proxy;w.organization.budget=c.budget;w.organization.blocked=null;break;
 }
 case 'SetPolicy':requireRule(w.organization.authorized,'PERMISSION_DENIED','无制度调整权限');w.organization.policy=c.policy;break;
 case 'TransferItem':{
  requireRule(w.organization.authorized,'PERMISSION_DENIED','无库存调拨权限');
  requireRule(locationOf(w,PLAYER)==='location.garden'&&!busy(w,PLAYER),'WRONG_LOCATION','请在药园空闲时调拨');
  requireRule(Number.isSafeInteger(c.quantity)&&c.quantity>0,'MISSING_REQUIREMENT','数量无效');
  const from=c.direction==='to_org'?PLAYER:'org',to=from===PLAYER?'org':PLAYER;
  const items=Object.values(w.entities).filter(e=>e.ownerId===from&&e.definitionId==='item.herbs');
  requireRule(items.reduce((s,e)=>s+available(w,e.id),0)>=c.quantity,'RESOURCE_RESERVED','可调拨药材不足');
  let left=c.quantity;for(const e of items){const n=Math.min(left,available(w,e.id));e.quantity-=n;left-=n;}
  giveItem(w,'item.herbs',to,c.quantity,'transfer');log(w,'调拨灵草 '+c.quantity+' 份。');break;
 }
 case 'BuyHerbs':requireRule(locationOf(w,PLAYER)==='location.market'&&!busy(w,PLAYER),'WRONG_LOCATION','请在集市空闲时购买');requireRule(Number.isSafeInteger(c.quantity)&&c.quantity>0&&c.quantity<=w.market.herbs&&w.money>=c.quantity*2,'MISSING_REQUIREMENT','钱款或商家库存不足');w.money-=c.quantity*2;w.market.money+=c.quantity*2;w.market.herbs-=c.quantity;giveItem(w,'item.herbs',PLAYER,c.quantity,'market');break;
 case 'Investigate':investigate(w);break;
 case 'Encounter':encounter(w,c.choice);break;
 }
 followups(w);delegate(w);
}
export function dispatch(w:World,e:Envelope):{world:World;result:Result}{
 if(w.commandReceipts[e.commandId])return{world:w,result:w.commandReceipts[e.commandId]};
 if(e.expectedRevision!==w.revision)return{world:w,result:{ok:false,code:'STALE_REVISION',message:'世界状态已变化，请重新查看组合。'}};
 try{
  requireRule(e.actorId===PLAYER,'PERMISSION_DENIED','没有操作权限');const draft=structuredClone(w);apply(draft,e.payload);draft.revision++;
  const result={ok:true as const,revision:draft.revision};draft.commandReceipts[e.commandId]=result;
  const ids=Object.keys(draft.commandReceipts);for(const id of ids.slice(0,Math.max(0,ids.length-200)))delete draft.commandReceipts[id];
  assertWorld(draft);return{world:draft,result};
 }catch(err){return{world:w,result:{ok:false,code:err instanceof RuleError?err.code:'SYSTEM_ERROR',message:(err as Error).message}};}
}
export function advanceWorld(w:World,target:number):World{
 if(!Number.isSafeInteger(target)||target<w.tick)throw new Error('无效时间');
 const d=structuredClone(w);let iterations=0;
 while(d.tick<target){
  if(++iterations>10000)throw new Error('调度超出单批预算');
  const queued=d.schedule.filter(s=>s.dueTick>=d.tick&&d.projects[s.sourceId]?.generation===s.generation&&d.projects[s.sourceId].state==='running');
  const deadlines=Object.values(d.events).filter(e=>!e.settled).map(e=>e.expiresTick);
  if(d.contract.state==='accepted')deadlines.push(d.contract.expiresTick);
  const next=Math.min(isMortal(d)?mortalDeadline(d,target):target,(Math.floor(d.tick/1440)+1)*1440,...queued.map(s=>s.dueTick),...deadlines.filter(t=>t>d.tick));
  const delta=next-d.tick;for(const e of Object.values(d.entities))if(e.kind==='character')e.ageMinutes+=delta;d.tick=next;
  if(isMortal(d)){if(tickMortal(d))break;continue;}
  expire(d);
  const due=d.schedule.filter(s=>s.dueTick<=d.tick).sort((a,b)=>a.dueTick-b.dueTick||a.phase-b.phase||a.id.localeCompare(b.id));
  d.schedule=d.schedule.filter(s=>s.dueTick>d.tick);
  for(const task of due){const p=d.projects[task.sourceId];if(p?.generation===task.generation&&p.state==='running')completeProject(d,p);}
  if(d.tick%1440===0){
   d.market.demand=2;
   // Town trade has a bounded regional operating budget, recorded as a real daily source.
   if((d.counters.subsidyDays??0)<7){d.market.money+=24;d.counters.subsidyDays=(d.counters.subsidyDays??0)+1;}
   d.entities['character.worker'].fatigue=Math.max(0,d.entities['character.worker'].fatigue-40);
  }
  followups(d);delegate(d);
  if(Object.values(d.events).some(e=>e.major&&!e.settled))break;
 }
 if(d.tick!==w.tick){d.revision++;assertWorld(d);}return d;
}