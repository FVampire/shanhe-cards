import {actionById,type ActionDef} from '../content';
import {shortSeeds} from '../content/mortal';
import {PLAYER,type World,type Project,type EventInstance} from '../domain/model';
import {mortalDeck,resolveMortalStack,lockedMortalCards,actionVerb} from '../domain/mortal-cards';
import {previewMortal} from '../domain/mortal';
import {eventOptions} from '../domain/events';
import type {TableCard,VerbId,Draft,Slot} from './tabletop';
export const chapter=(w:World)=>w.mortal.mode==='chapter';
export function mortalCards(w:World):TableCard[]{
 const cards=mortalDeck(w);
 for(const r of Object.values(w.mortal.cardRuns??{}))if(!r.collected&&r.state!=='cancelled')for(const c of r.state==='running'?r.inputs:r.outputs)if(!cards.some(x=>x.id===c.id))cards.push(c);
 return cards.map(c=>c.id===PLAYER?{...c,entity:w.entities[PLAYER]}:c);
}
export function desktopProjects(w:World):Project[]{
 if(!chapter(w))return Object.values(w.projects);
 const runs:Project[]=Object.values(w.mortal.cardRuns??{}).map(r=>({id:r.id,definitionId:'mortal-run/'+r.verb+'/'+r.id,boundSlots:r.bindings,state:r.state,startedTick:r.startedTick,dueTick:r.dueTick,generation:0,spent:[],delegated:false,receipt:w.receipts[r.id]??null}));
 const t=w.mortal.task;
 if(t&&!runs.some(r=>r.id===t.id))runs.push({id:t.id,definitionId:'mortal-run/'+actionVerb(t.actionId)+'/'+t.id,boundSlots:{actor:PLAYER},state:'running',startedTick:t.startedTick,dueTick:t.dueTick,generation:0,spent:[],delegated:false,receipt:null});
 return runs;
}
function action(id:string,name:string,description:string,duration:number,cost:number,reward:number):ActionDef{return {id,name,description,duration,category:'life',slots:[],conditions:[],costs:cost?[{resource:'currency',quantity:cost,owner:'actor',phase:'start'}]:[],effects:reward?[{id:id+'/reward',op:'payment',source:'market',amount:reward}]:[],cancelPolicy:'release_unspent_keep_spent'};}
export function desktopAction(w:World,id:string):ActionDef{
 if(!chapter(w))return actionById(id);
 const r=w.mortal.cardRuns?.[id.split('/')[2]];
 if(r)return action(id,r.name,r.state==='completed'?r.summary:r.description,r.dueTick-r.startedTick,r.cost,r.reward);
 const t=w.mortal.task!,p=previewMortal(w,t.actionId,t.choice);return action(id,p.name,p.detail,p.minutes,p.cost,p.reward);
}
export function stackPreview(w:World,verb:VerbId,b:Draft){
 const recipe=resolveMortalStack(w,verb,b);if(!recipe)return null;
 const p=previewMortal(w,recipe.actionId,recipe.choice);
 const errors=[...recipe.errors,...p.errors];if(Object.values(b).some(id=>lockedMortalCards(w).has(id)))errors.push('卡牌仍在行事中或等待收取。');
 return {action:action(recipe.actionId,p.name,p.detail,p.minutes,p.cost,p.reward),errors};
}
export function stackSlots(verb:VerbId,draft:Draft,cards:TableCard[]):Slot[]{
 const focus=cards.find(c=>c.id===draft.focus);
 const tags=verb==='study'?['clue','method','atlas']:verb==='talk'?['clue','person','place']:verb==='create'?['clue']:verb==='work'?['tool','clue','place','achievement']:verb==='travel'?['place','clue']:['method','shelter','clue'];
 const slots:Slot[]=[{id:'actor',name:'自身',hint:'投入自己，这段时间将由你亲历',aspects:['player'],accept:c=>c.id===PLAYER},{id:'focus',name:verb==='travel'?'去处或线索':'行事之物',hint:'投入地点、人或线索；查看卡牌说明寻找组合',optional:verb==='cultivate',aspects:tags,accept:c=>c.id!==PLAYER&&tags.some(t=>c.aspects.includes(t))}];
 if(focus){const extra=focus.aspects.includes('method')?['manual','place']:['approach','currency','atlas','person','tool'];slots.push({id:'supplement',name:'补充',hint:'可留空；谨慎的打算会改变部分行动的做法',optional:true,aspects:extra,accept:c=>extra.some(t=>c.aspects.includes(t))});}
 return slots;
}
export function desktopEvents(w:World):Record<string,EventInstance>{if(!chapter(w))return w.events;return Object.fromEntries(Object.values(w.mortal.shortEvents).map(e=>{const d=shortSeeds.find(s=>s.id===e.id)!;return [e.id,{id:e.id,kind:e.id,title:d.name,text:d.act+'；也可以'+d.decline+'。',createdTick:e.createdTick,expiresTick:9000000000000,settled:e.state==='resolved',choice:e.choice,major:false}];}));}
export function desktopOptions(w:World,kind:string){if(!chapter(w))return eventOptions[kind];const d=shortSeeds.find(s=>s.id===kind);return d?[{id:'act',text:d.act,detail:'留下这次回应的记录。'},{id:'decline',text:d.decline,detail:'记下决定，继续眼前的生活。'}]:[];}
export const chapterHints:Record<VerbId,string>={study:'把自己与线索、公开图册或方法放在一起研习。',talk:'把自己与相识、话头或客舍放在一起。钱文与青溪集可以备粮。',create:'修补、谱曲、著述，都从已经准备好的线索开始。',work:'工具可以做短工；客舍可以换食宿；完成的作品可以带来专业委托。',cultivate:'只放自己，或加上已租的铺位，即可返回客舍歇息，返程一并计时。方法加注本可以纠错，加地点可尝试应用。',travel:'把自己与地点放在一起出行，也可以带着用工告示寻找机会。'};
