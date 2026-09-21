import {assertResearch} from './research';
import {freshMortal} from './mortal-model';
import {assertMortal} from './mortal';
import { content } from '../content';
import { PLAYER, type World, type Entity, WorldSchema } from './model';
export const baseEntity=(id:string,kind:Entity['kind'],name:string):Entity=>({id,kind,name,definitionId:id,tags:[],location:'location.pavilion',containerId:null,ownerId:PLAYER,quantity:1,description:'',art:'person',skills:{},knowledge:{},professions:{},health:85,fatigue:0,ageMinutes:22*365*1440,longevityDays:0,willing:true,active:true});
export function createLegacyWorld(seed='shanhe-autumn-01'):World{
 const p=baseEntity(PLAYER,'character','陆青禾');Object.assign(p,{tags:['player','herbalist'],description:'二十二岁，音律见长。愿以一技谋生，也想看看长生的路。',art:'player',skills:{'skill.music':8,'skill.scholar':0,'skill.alchemy':0,'skill.cultivation':0},knowledge:{'knowledge.river_song':'understood'}});
 const teacher=baseEntity('character.teacher','character','沈知弦');Object.assign(teacher,{tags:['teacher'],description:'听雨亭的乐师。合奏只允两次，期限内有效。他看江水的时间，比看谱更长。',art:'teacher',skills:{'skill.music':60},knowledge:{'knowledge.river_song':'mastered'},professions:{'profession.musician':1}});
 const physician=baseEntity('character.physician','character','云岚');Object.assign(physician,{location:'location.study',tags:['physician'],description:'云游医师，行囊总搁在廊下。擅长调养，也肯为真心求学者讲解，却不像会长住。',art:'teacher'});
 const worker=baseEntity('character.worker','character','林小满');Object.assign(worker,{location:'location.garden',tags:['herbalist'],ownerId:'org',art:'worker',skills:{'skill.alchemy':20},knowledge:{'knowledge.herbal':'understood'},description:'药园学徒，长于药理。话少，把乱草和预算都看得很重，却不愿先开口求人。'});
 const entities:World['entities']={[p.id]:p,[teacher.id]:teacher,[physician.id]:physician,[worker.id]:worker};
 for(const def of content.items){
  if(['item.medicine','item.marginalia','item.draft'].includes(def.id))continue;
  const id='instance.'+def.id.split('.')[1];const e=baseEntity(id,'item',def.name);
  Object.assign(e,{definitionId:def.id,tags:def.tags,art:def.art,description:def.description,location:null,containerId:PLAYER,quantity:def.id==='item.herbs'?6:1});entities[id]=e;
 }
 const recipe=structuredClone(entities['instance.recipe']);Object.assign(recipe,{id:'instance.org_recipe',ownerId:'org',location:'location.garden',containerId:null});entities[recipe.id]=recipe;
 const herbs=structuredClone(entities['instance.herbs']);Object.assign(herbs,{id:'instance.org_herbs',ownerId:'org',location:'location.garden',containerId:null,quantity:6});entities[herbs.id]=herbs;
 for(const [id,name,tag,art] of [['garden','青竹药圃','garden','herb'],['furnace','小青铜炉','furnace','furnace']]){
 const e=baseEntity('facility.'+id,'facility',name);Object.assign(e,{location:'location.garden',ownerId:'org',tags:[tag],art,description:'药园共用设施，同一时间只接纳一项工作。'});entities[e.id]=e;
 }
 return WorldSchema.parse({mortal:freshMortal('legacy'),worldId:'world.'+seed,seed,revision:0,tick:0,rulesVersion:'2.0.0',contentVersion:'0.2.0',randomVersion:'keyed-v1',entities,projects:{},reservations:{},events:{},rolls:{},receipts:{},commandReceipts:{},schedule:[],facts:{'fact.mountain':{type:'ambush',subjectId:PLAYER,location:'location.mountain',source:'regional_event',revision:1,expiresTick:10080},'fact.lecture':{type:'lecture',subjectId:PLAYER,location:'location.study',source:'regional_event',revision:1,expiresTick:10080}},knowledge:[],reputation:{},relations:{[PLAYER+'/character.teacher']:5},works:[],insights:[],consents:{duet:{uses:2,expiresTick:720}},money:24,market:{money:200,herbs:18,demand:2},contract:{escrow:0,expiresTick:0,state:'none'},organization:{money:30,authorized:false,proxy:false,policy:'careful',delegation:false,budget:0,cycles:0,blocked:null},counters:{},log:[{id:'log.0',tick:0,text:'初至青溪。沈知弦在听雨亭等你，旧琴和曲谱已经备好。',kind:'story'}]});
}
export function locationOf(w:World,id:string,seen=new Set<string>()):string{
 const e=w.entities[id];if(!e)throw new Error('对象不存在: '+id);
 if(seen.has(id))throw new Error('容器引用成环');seen.add(id);
 if(e.containerId)return locationOf(w,e.containerId,seen);
 if(!e.location)throw new Error('对象缺少位置');return e.location;
}
export function ownedBy(w:World,actor:string){return actor===PLAYER?PLAYER:w.entities[actor].ownerId;}
export function available(w:World,id:string){const e=w.entities[id];return e?e.quantity-Object.values(w.reservations).filter(r=>r.resourceId===id).reduce((n,r)=>n+r.quantity,0):0;}
export function busy(w:World,id:string){return Object.values(w.reservations).some(r=>r.resourceId===id&&r.mode==='exclusive');}
export function log(w:World,text:string,kind:'story'|'success'|'warning'='story'){w.counters.log=(w.counters.log??0)+1;w.log.push({id:'log.'+w.counters.log,tick:w.tick,text,kind});if(w.log.length>160)w.log.shift();}
export function recordFact(w:World,type:string,subjectId:string,source:string){
 const id=type+'/'+subjectId;w.facts[id]={type,subjectId,location:locationOf(w,subjectId),source,revision:1,expiresTick:Number.MAX_SAFE_INTEGER};
 if(!w.knowledge.some(k=>k.factId===id&&k.observerId===PLAYER))w.knowledge.push({factId:id,observerId:PLAYER,source});
}
export function hasFact(w:World,type:string,subject=PLAYER){return !!w.facts[type+'/'+subject];}
export function assertWorld(input:unknown):asserts input is World{
 const w=WorldSchema.parse(input);assertMortal(w);assertResearch(w);
 for(const [id,e]of Object.entries(w.entities)){
  if(id!==e.id)throw new Error('实体索引不一致');
  if((e.location===null)===(e.containerId===null))throw new Error('物品位置来源必须唯一');
  if(!content.locations.some(l=>l.id===locationOf(w,id)))throw new Error('未知地点');
  for(const skill of Object.keys(e.skills))if(!content.skills.some(s=>s.id===skill))throw new Error('未知技艺');
  for(const k of Object.keys(e.knowledge))if(!content.knowledge.some(d=>d.id===k))throw new Error('未知知识');
  for(const p of Object.keys(e.professions))if(!content.professions.some(d=>d.id===p))throw new Error('未知职业');
  if(e.kind==='item'&&!content.items.some(d=>d.id===e.definitionId))throw new Error('未知物品定义');
  if(available(w,id)<0)throw new Error('资源超额预留');
 }
 for(const r of Object.values(w.reservations)){
  if(!w.entities[r.resourceId]||w.projects[r.projectId]?.state!=='running')throw new Error('无效资源预留');
 }
 for(const p of Object.values(w.projects)){
  if(!content.actions.some(a=>a.id===p.definitionId))throw new Error('未知行动');
  if(p.dueTick<=p.startedTick)throw new Error('行动时长无效');
  for(const id of Object.values(p.boundSlots))if(!w.entities[id])throw new Error('行动引用丢失');
  if(p.state==='running'){
   const def=content.actions.find(a=>a.id===p.definitionId)!;
   if(Object.keys(p.boundSlots).length!==def.slots.length||new Set(Object.values(p.boundSlots)).size!==def.slots.length)throw new Error('行动槽位不一致');
   for(const slot of def.slots){const entity=w.entities[p.boundSlots[slot.name]];if(!entity||entity.kind!==slot.kind||!slot.tags.every(t=>entity.tags.includes(t)))throw new Error('无效槽位绑定');if(slot.usage!=='reference'&&!Object.values(w.reservations).some(r=>r.projectId===p.id&&r.resourceId===entity.id&&r.mode==='exclusive'&&r.quantity===1))throw new Error('运行行动缺少独占资源');}
   for(const cost of def.costs.filter(c=>c.phase==='finish'&&c.resource!=='currency')){const owner=cost.owner==='org'?'org':ownedBy(w,p.boundSlots.actor);const total=Object.values(w.reservations).filter(r=>r.projectId===p.id&&r.mode==='quantity'&&w.entities[r.resourceId].definitionId===cost.resource&&w.entities[r.resourceId].ownerId===owner).reduce((sum,r)=>sum+r.quantity,0);if(total!==cost.quantity)throw new Error('运行行动的材料预留不完整');}
   if(w.receipts[p.id])throw new Error('运行行动不能已有终局凭据');
  }
  if(p.state==='running'&&(!w.schedule.some(s=>s.sourceId===p.id&&s.generation===p.generation)||p.dueTick<w.tick))throw new Error('运行行动缺少有效调度');
 }
 for(const s of w.schedule)if(!w.projects[s.sourceId])throw new Error('调度引用丢失');
 for(const k of w.knowledge)if(!w.facts[k.factId]||!w.entities[k.observerId])throw new Error('情报引用丢失');
}
export function createWorld(seed='shanhe-autumn-02'):World{
 const w=createLegacyWorld(seed),p=w.entities[PLAYER];
 p.name='陆青禾';p.description='独自抵达青溪的旅人。';p.tags=['player'];p.skills={};p.knowledge={};p.professions={};p.location='location.market';
 w.entities={[PLAYER]:p};w.mortal=freshMortal();w.facts={};w.knowledge=[];w.relations={};w.consents={};w.organization.money=0;
 w.log=[{id:'log.0',tick:0,text:'渡船把你放在青溪岸边。集口贴着几张用工告示。',kind:'story'}];return w;
}
