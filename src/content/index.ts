import { z } from 'zod';
import raw from './game.json' with {type:'json'};
import { int } from '../domain/model';
const slotName=z.string();
const condition=z.discriminatedUnion('op',[
 z.object({op:z.literal('skill'),slot:slotName,skillId:z.string(),value:int}).strict(),
 z.object({op:z.literal('knowledge'),slot:slotName,knowledgeId:z.string(),stage:z.enum(['acquired','understood','mastered'])}).strict(),
 z.object({op:z.literal('no_work'),topic:z.string()}).strict(),
 z.object({op:z.enum(['location','not_location']),value:z.string()}).strict(),
 z.object({op:z.enum(['consent','consent_spent','contract','market_demand','daily_harvest'])}).strict()
]);
const effect=z.discriminatedUnion('op',[
 z.object({id:z.string(),op:z.literal('practice'),slot:slotName,skillId:z.string(),units:int}).strict(),
 z.object({id:z.string(),op:z.literal('knowledge'),slot:slotName,knowledgeId:z.string(),stage:z.enum(['acquired','understood','mastered'])}).strict(),
 z.object({id:z.string(),op:z.enum(['fatigue','health']),slot:slotName,units:z.number().int().min(-100).max(100)}).strict(),
 z.object({id:z.string(),op:z.literal('relationship'),from:slotName,to:slotName,units:z.number().int().min(-20).max(20)}).strict(),
 z.object({id:z.string(),op:z.literal('fact'),factType:z.string(),slot:slotName}).strict(),
 z.object({id:z.string(),op:z.literal('work'),slot:slotName,topic:z.string(),title:z.string()}).strict(),
 z.object({id:z.string(),op:z.literal('payment'),source:z.enum(['contract','market']),amount:int}).strict(),
 z.object({id:z.string(),op:z.literal('item'),definitionId:z.string(),owner:z.enum(['actor','org']),quantity:int.positive()}).strict(),
 z.object({id:z.string(),op:z.literal('longevity'),slot:slotName,days:int}).strict(),
 z.object({id:z.string(),op:z.literal('travel'),location:z.string()}).strict(),
 z.object({id:z.string(),op:z.literal('insight'),question:z.string(),understanding:z.string()}).strict(),
 z.object({id:z.string(),op:z.literal('willing'),slot:slotName,value:z.boolean()}).strict()
]);
const definition=z.object({id:z.string(),name:z.string()}).strict();
export const ContentSchema=z.object({
 schemaVersion:z.literal(2),contentVersion:z.literal('0.2.0'),
 skills:z.array(definition),knowledge:z.array(definition),
 locations:z.array(definition.extend({description:z.string()})),
 items:z.array(definition.extend({tags:z.array(z.string()),art:z.string(),description:z.string()})),
 professions:z.array(definition.extend({skillId:z.string(),required:int,knowledgeId:z.string(),fact:z.string(),description:z.string()})),
 actions:z.array(definition.extend({
  description:z.string(),category:z.enum(['music','scholar','cultivation','life','alchemy','travel']),
  slots:z.array(z.object({name:z.string(),kind:z.enum(['character','item','facility']),tags:z.array(z.string()),usage:z.enum(['major_actor','exclusive_tool','reference'])}).strict()),
  duration:int.positive(),conditions:z.array(condition),
  costs:z.array(z.object({resource:z.string(),quantity:int.positive(),owner:z.enum(['actor','org']),phase:z.enum(['start','finish'])}).strict()),
  effects:z.array(effect),cancelPolicy:z.literal('release_unspent_keep_spent')
 }))
}).strict();
export type Content=z.infer<typeof ContentSchema>;
export type ActionDef=Content['actions'][number];
export type Effect=ActionDef['effects'][number];
export function validateContent(input:unknown):Content{
 const c=ContentSchema.parse(input);const seen=new Set<string>();
 for(const group of [c.skills,c.knowledge,c.locations,c.items,c.professions,c.actions]){
  for(const d of group){if(seen.has(d.id))throw new Error('重复定义 ID: '+d.id);seen.add(d.id);}
 }
 const ref=(list:{id:string}[],id:string,path:string)=>{if(!list.some(d=>d.id===id))throw new Error(path+' 引用不存在: '+id);};
 for(const [i,a] of c.actions.entries()){
  const slots=new Set(a.slots.map(s=>s.name));if(slots.size!==a.slots.length)throw new Error('重复槽位 '+a.id);
  if(a.slots.some(s=>s.kind==='character'&&s.usage!=='major_actor'))throw new Error('参与人物必须占用主要行动');
  for(const n of [...a.conditions,...a.effects]){
   if('skillId' in n)ref(c.skills,n.skillId,'actions['+i+'].skillId');
   if('knowledgeId' in n)ref(c.knowledge,n.knowledgeId,'actions['+i+'].knowledgeId');
   if('slot' in n&&!slots.has(n.slot))throw new Error('未知槽位 '+n.slot);
   if('definitionId' in n)ref(c.items,n.definitionId,'effects.definitionId');
   if('location' in n)ref(c.locations,n.location,'effects.location');
   if('from' in n&&(!slots.has(n.from)||!slots.has(n.to)))throw new Error('关系槽位不存在');
   if('id' in n){if(seen.has(n.id))throw new Error('重复效果 ID');seen.add(n.id);}
  }
  for(const cost of a.costs)if(cost.resource!=='currency')ref(c.items,cost.resource,'costs.resource');
 }
 for(const p of c.professions){ref(c.skills,p.skillId,'professions.skillId');ref(c.knowledge,p.knowledgeId,'professions.knowledgeId');}
 return c;
}
export const content=validateContent(raw);
export const actionById=(id:string)=>{const a=content.actions.find(a=>a.id===id);if(!a)throw new Error('未知行动 '+id);return a;};