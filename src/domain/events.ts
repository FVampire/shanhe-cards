import { PLAYER,type World } from './model';
import { hasFact,recordFact,locationOf,log,busy } from './world';
import { requireRule } from './actions';
import { probabilityForOmen,probabilityForSpecialEffect } from './dao';
import { roll } from './random';
export function addEvent(w:World,id:string,kind:string,title:string,text:string,duration=720,major=false){
 if(w.events[id])return;
 w.events[id]={id,kind,title,text,createdTick:w.tick,expiresTick:w.tick+duration,settled:false,choice:null,major};
}
export const eventOptions:Record<string,{id:string;text:string;detail:string}[]>={
 invitation:[{id:'accept',text:'应下邀约',detail:'预留演出报酬 36 灵钱；需在截止前亲自完成演出。'},{id:'decline',text:'暂且婉拒',detail:'保留作品与友谊，仍可在茶席谋生。'}],
 health:[{id:'teacher',text:'寻访云游医师',detail:'得知县学书院的传承线索。'},{id:'independent',text:'独自研读手札',detail:'花费 4 灵钱取得注释；仍需调息实践。'},{id:'later',text:'先好好歇息',detail:'保留日后请益与自学的道路。'}],
 garden:[{id:'join',text:'接下药园职事',detail:'获得委托权限，负责预算与成员安排。'},{id:'independent',text:'保持独行',detail:'可继续借用药炉与自行炼丹，之后也可重新应聘。'}],
 lecture:[{id:'listen',text:'记下讲学线索',detail:'获知水道考辨的研究方向；亲自读书、成文。'},{id:'pass',text:'留待来日',detail:'学问与研究仍可随时继续。'}],
 danger:[{id:'investigate',text:'探问山道消息',detail:'查明实情，获得撤离、协商或雇援的选择。'},{id:'leave',text:'先避开此处',detail:'动身返回听雨亭需要时间，可在桌面选择出行。'}],
 anomaly:[{id:'ack',text:'知道了',detail:'调整预算、物资或代理后，可以重新启动委托。'}],
 teacher_road:[{id:'stay',text:'请他再留些时日',detail:'需有足够信任。他会留下，并把合奏的许可再延六个时辰。'},{id:'part',text:'尊重他的去处',detail:'沈知弦即刻动身。听雨亭里，合奏再也约不成。'}],
 physician_road:[{id:'keep',text:'请她再看几位病人',detail:'花费 4 灵钱安置行装。她愿再停一停。'},{id:'ask',text:'只问调息的门路',detail:'得知请益的线索。她仍可能按期离开。'}],
 worker_plea:[{id:'help',text:'答应亲自采一轮',detail:'记下这份托付。她会把心里的话先按下。'},{id:'later',text:'让她先顶着',detail:'她不说什么，只是更累一些。'}]
};
export function followups(w:World){
 if(hasFact(w,'composed'))addEvent(w,'event.recital','invitation','一封小集邀约','你的《江上曲》传到茶社。一位熟人想邀你在听雨亭演出。约定的银钱已备，只等你答复。',720,true);
 if(hasFact(w,'performed')||hasFact(w,'nurtured'))addEvent(w,'event.health','health','琴声以外，岁月之内','散场时，沈知弦提起一位云游医师。曲艺能养活当下，身体的长久却需要另外求索。',1440,true);
 if((hasFact(w,'duet')||hasFact(w,'met_teacher'))&&w.entities['character.teacher'].active)addEvent(w,'event.teacher_road','teacher_road','沈先生的去处','下游有人请他去教一季琴童。他本就把合奏的许可限在两遍——不是吝啬，是腕力不如从前。',720);
 const loc=locationOf(w,PLAYER);
 if(loc==='location.study'&&w.entities['character.physician'].active)addEvent(w,'event.physician_road','physician_road','云岚的行囊','书院廊下搁着一只行囊。云岚说她只停三两日，寻一味能稳住岁月的方，青溪不过路过。',2160);
 if(loc==='location.garden'&&!w.organization.authorized)addEvent(w,'event.garden','garden','青竹药园的托付','管事缺一位肯留心的人。若你愿意，可以在这里学习炼丹，也可照看小满的工作与药园的物资。',1440);
 if(w.organization.authorized)addEvent(w,'event.worker_plea','worker_plea','小满求你看一眼药圃','草长得乱。她能炼，却不敢一个人定哪几畦该先采。她把这件事说得轻，像怕耽误你的琴。',720);
 for(const [factId,kind,text]of [['fact.lecture','good','书院里似有值得一访的人。可以主动探问讲学。'],['fact.mountain','danger','望向山道，心头掠过一丝不安。可以探问消息，或改变行程。']]){
  const f=w.facts[factId];if(f.location!==loc||w.tick>=f.expiresTick)continue;
  const result=roll(w,'omen',factId+'/'+f.revision,PLAYER,kind,probabilityForOmen(w.entities[PLAYER]));
  if(result.succeeded&&!w.receipts['omen/'+factId]){
   w.receipts['omen/'+factId]='shown';log(w,text,'warning');
   addEvent(w,'event.omen.'+factId,kind==='good'?'lecture':'danger',kind==='good'?'偶有所感 · 趋吉':'偶有所感 · 避凶',text,f.expiresTick-w.tick);
  }
 }
}
function departTeacher(w:World){
 const t=w.entities['character.teacher'];if(!t.active||hasFact(w,'teacher_stayed'))return;
 t.active=false;log(w,'沈知弦赴下游教习去了。听雨亭空着，合奏的许可一并带走。','warning');
}
function departPhysician(w:World){
 const p=w.entities['character.physician'];if(!p.active||hasFact(w,'physician_stayed')||hasFact(w,'learned_breath'))return;
 p.active=false;log(w,'云岚打点行囊，离开书院。请益要再寻她，已来不及。','warning');
}
export function expire(w:World){
 for(const e of Object.values(w.events))if(!e.settled&&w.tick>=e.expiresTick){
  e.settled=true;e.choice='expired';w.receipts[e.id]='expired';log(w,'「'+e.title+'」已过期。','warning');
  if(e.kind==='worker_plea'){const worker=w.entities['character.worker'];worker.fatigue=Math.min(100,worker.fatigue+15);log(w,'小满自己把乱草顶了下来，话更少了。','warning');}
  if(e.kind==='teacher_road')departTeacher(w);
  if(e.kind==='physician_road')departPhysician(w);
 }
 if(w.contract.state==='accepted'&&w.tick>=w.contract.expiresTick){w.market.money+=w.contract.escrow;w.contract.escrow=0;w.contract.state='expired';log(w,'小集演出约定已过期，预留报酬归还茶社。茶席仍可谋生。','warning');}
 if(w.tick>=2160)departPhysician(w);
}
export function chooseEvent(w:World,eventId:string,option:string){
 const e=w.events[eventId];requireRule(e,'MISSING_REQUIREMENT','事件不存在');
 requireRule(!e.settled,'ALREADY_SETTLED','此事已有答复');
 requireRule(w.tick<e.expiresTick,'EVENT_EXPIRED','事件已过期限');
 requireRule(eventOptions[e.kind]?.some(o=>o.id===option),'MISSING_REQUIREMENT','未知选项');
 if(e.kind==='invitation'){
  if(option==='accept'){requireRule(w.market.money>=36,'MISSING_REQUIREMENT','茶社预算不足');w.market.money-=36;w.contract={state:'accepted',escrow:36,expiresTick:w.tick+720};log(w,'演出合同已订：须在六个时辰内完成。报酬暂由茶社保管。');}
  else w.contract.state='declined';
 }else if(e.kind==='health'){
  if(option==='independent'){requireRule(w.money>=4,'MISSING_REQUIREMENT','灵钱不足');w.money-=4;w.entities[PLAYER].knowledge['knowledge.breath']='understood';recordFact(w,'self_study',PLAYER,e.id);}
  else if(option==='teacher')recordFact(w,'physician_lead',PLAYER,e.id);
 }else if(e.kind==='garden'){
  if(option==='join'){w.organization.authorized=true;recordFact(w,'garden_membership',PLAYER,e.id);}
 }else if(e.kind==='lecture'){
  if(option==='listen')reveal(w,'fact.lecture','书院门前的公示');
 }else if(e.kind==='danger'&&option==='investigate')investigate(w);
 else if(e.kind==='teacher_road'){
  if(option==='stay'){requireRule((w.relations[PLAYER+'/character.teacher']??0)>=6,'PERMISSION_DENIED','信任不足，他不能为你再改行期。');recordFact(w,'teacher_stayed',PLAYER,e.id);w.consents.duet.expiresTick+=720;log(w,'沈知弦把行囊又放下。下游的请帖，再等六个时辰。');}
  else departTeacher(w);
 }else if(e.kind==='physician_road'){
  if(option==='keep'){requireRule(w.money>=4,'MISSING_REQUIREMENT','灵钱不足');w.money-=4;recordFact(w,'physician_stayed',PLAYER,e.id);log(w,'云岚收下安置行装的银钱，答应再停一停。');}
  else recordFact(w,'physician_lead',PLAYER,e.id);
 }else if(e.kind==='worker_plea'){
  if(option==='help')recordFact(w,'worker_helped',PLAYER,e.id);
  else {const worker=w.entities['character.worker'];worker.fatigue=Math.min(100,worker.fatigue+10);log(w,'小满应了一声，把腰又弯下去。','warning');}
 }
 e.settled=true;e.choice=option;w.receipts[eventId]=option;log(w,'「'+e.title+'」：'+eventOptions[e.kind].find(o=>o.id===option)?.text+'。');
}
export function reveal(w:World,factId:string,source:string){
 if(!w.knowledge.some(k=>k.factId===factId&&k.observerId===PLAYER))w.knowledge.push({factId,observerId:PLAYER,source});
}
export function investigate(w:World){
 requireRule(!busy(w,PLAYER),'ACTOR_BUSY','请先结束当前行动');
 const loc=locationOf(w,PLAYER);
 if(loc==='location.mountain'){
  requireRule(w.tick<w.facts['fact.mountain'].expiresTick,'EVENT_EXPIRED','这条山道消息已不再有效');
  reveal(w,'fact.mountain','问询山脚樵夫');log(w,'樵夫说：山道有持拘魂铃的流寇。你可撤离、协商，或雇人护送。','warning');
 }else if(loc==='location.study'){reveal(w,'fact.lecture','县学公示');addEvent(w,'event.lecture','lecture','县学春秋讲席','主讲人愿讨论地方水道考据。你可以研读县志，再写下自己的考辨。',720);}
 else if(loc==='location.garden'&&!w.organization.authorized){
  const e=w.events['event.garden'];if(e?.settled){delete w.events[e.id];delete w.receipts[e.id];}followups(w);
 }else log(w,'这里暂时没有新的消息。');
}
export function encounter(w:World,choice:'withdraw'|'negotiate'|'hire'|'endure'){
 requireRule(locationOf(w,PLAYER)==='location.mountain'&&!busy(w,PLAYER),'WRONG_LOCATION','需身处山道且空闲');
 requireRule(w.knowledge.some(k=>k.factId==='fact.mountain'&&k.observerId===PLAYER),'MISSING_REQUIREMENT','先探问消息');
 requireRule(!hasFact(w,'encounter_resolved'),'ALREADY_SETTLED','这次遭遇已结束');
 requireRule(w.tick<w.facts['fact.mountain'].expiresTick,'EVENT_EXPIRED','遭遇已经结束');
 if(choice==='negotiate'){requireRule(w.money>=8,'MISSING_REQUIREMENT','协商需 8 灵钱');w.money-=8;}
 if(choice==='hire'){requireRule(w.money>=12,'MISSING_REQUIREMENT','护送需 12 灵钱');w.money-=12;}
 if(choice==='endure'){
  const p=w.entities[PLAYER];p.health=Math.max(0,p.health-3);
  const r=roll(w,'special_effect','mountain-bell/1',PLAYER,'soul_capture',probabilityForSpecialEffect(p),1);
  if(r.succeeded)p.fatigue=Math.min(100,p.fatigue+25);
  log(w,'拘魂铃击来：普通伤害 3；'+(r.succeeded?'摄魂生效，疲劳 +25。':'抵抗了摄魂效果。'),'warning');
  recordFact(w,'bell_used',PLAYER,'encounter.mountain');
 }
 recordFact(w,'encounter_resolved',PLAYER,'encounter.mountain');
 log(w,choice==='withdraw'?'你避开流寇，退到山道的安全处。':'山道遭遇已经解决。');
}