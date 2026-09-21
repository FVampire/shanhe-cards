import { content,actionById } from '../content';
import { PLAYER,type World,type Entity,type Project } from '../domain/model';
import { busy,locationOf } from '../domain/world';
import { characterFlavor,insightTitle } from '../domain/people';
import type { Point,TabletopState } from '../application/ui-state';
export type VerbId='study'|'talk'|'create'|'work'|'cultivate'|'travel';
export const LAYOUT_VERSION=2;
export const CARD_SIZE={w:110,h:158};
export const VERB_SIZE={w:120,h:140};
export type LayoutRect={id:string;x:number;y:number;w:number;h:number};
export const verbs:{id:VerbId;name:string;symbol:string;color:string;description:string;hint:string;position:Point}[]=[
 {id:'study',name:'研习',symbol:'book',color:'#75b5bb',description:'把书页翻开，把一门技艺再练一遍。',hint:'放入自己，以及书卷、乐器或灵草。同一物在别的方块里，会是另一件事。',position:{x:340,y:200}},
 {id:'talk',name:'交游',symbol:'talk',color:'#c88373',description:'独自难解的疑问，也许在另一个人的回应里。',hint:'放入自己与一位同伴。合奏再加琴谱；谈掌故则加县志。许可用尽后仍可强求。',position:{x:530,y:180}},
 {id:'create',name:'创作',symbol:'quill',color:'#b1a0c9',description:'学过的、听过的、亲见的，终有一日成为自己的作品。',hint:'琴与谱可以成曲；缺一则留下未成之曲。县志可以成为一篇考辨。',position:{x:720,y:200}},
 {id:'work',name:'谋生',symbol:'work',color:'#b29b62',description:'本领应当能换来一顿饭，也能照拂眼前的生活。',hint:'放入乐器、药圃或丹炉，看看在此地能做些什么。',position:{x:910,y:200}},
 {id:'cultivate',name:'修养',symbol:'lotus',color:'#93b28f',description:'停一停。呼吸、伤痛与岁月，也各有自己的功课。',hint:'只放自己可以歇息；手札是调息，旧琴是入静，两者不是同一条路。',position:{x:340,y:590}},
 {id:'travel',name:'行游',symbol:'compass',color:'#b79260',description:'一段路程，一处故地，或一个尚未谋面的人。',hint:'放入自己，再放入一个地点。出行同样占用时间。',position:{x:910,y:590}}
];
export type TableCard={id:string;name:string;kind:'entity'|'location'|'intent'|'work'|'insight'|'event';subtitle:string;description:string;art:string;aspects:string[];color:string;entity?:Entity};
export const aspectNames:Record<string,string>={player:'自身',herbalist:'药理',teacher:'音律·师友',physician:'医者',instrument:'乐器',score:'曲谱',history:'地方学问',recipe:'药方',breath:'调息法',material:'药材',medicine:'疗伤',garden:'药圃',furnace:'丹炉',character:'人物',item:'器物',facility:'设施',place:'地点',intention:'意愿',work:'作品',music:'音律',scholar:'学问',insight:'心得',event:'来信',draft:'残稿'};
export function cardsFor(w:World):TableCard[]{
 const here=locationOf(w,PLAYER);
 const entities=Object.values(w.entities).filter(e=>e.active&&e.quantity>0&&locationOf(w,e.id)===here).map((e):TableCard=>{
  const flavor=characterFlavor(e,w);
  return{id:e.id,name:e.name,kind:'entity',entity:e,art:e.tags.includes('history')?'history':e.art,subtitle:flavor.subtitle,description:flavor.description,aspects:[e.kind,...e.tags],color:e.kind==='character'?(e.id===PLAYER?'#536e61':'#827453'):e.tags.includes('material')?'#748753':'#6e8275'};
 });
 const places=content.locations.map((l):TableCard=>({id:l.id,name:l.name,kind:'location',subtitle:l.id===here?'此刻所在':'已知地点',description:l.description,art:l.id.split('.')[1],aspects:['place'],color:'#b2936c'}));
 const works=w.works.filter(x=>x.authorId===PLAYER).map((x):TableCard=>({id:x.id,name:x.title,kind:'work',subtitle:'亲手完成的作品',description:'这件作品记下了你的学习与实践。它本身就是一种成果。',art:'scroll',aspects:['work',x.topic==='river'?'music':'scholar'],color:'#c7b274'}));
 const insights=w.insights.filter(x=>x.subjectId===PLAYER).map((x):TableCard=>({id:x.id,name:insightTitle(x.id,x.question),kind:'insight',subtitle:'一次具体的心得',description:x.question+' '+x.understanding,art:'insight',aspects:['insight'],color:'#ac98b8'}));
 const events=Object.values(w.events).filter(e=>!e.settled).map((e):TableCard=>({id:e.id,name:e.title,kind:'event',subtitle:'尚待回应',description:e.text,art:'event',aspects:['event',e.kind],color:'#bf7970'}));
 const intents:TableCard[]=['understood','mastered'].includes(w.entities[PLAYER].knowledge['knowledge.breath'])?[{id:'intent.retreat',name:'闭关的打算',kind:'intent',subtitle:'静修 · 一日',description:'将这份打算与自己、调息手札一起投入「修养」。闭关须有足够的调养实践。',art:'lotus',aspects:['intention'],color:'#9b86b1'}]:[];
 return [...entities,...places,...works,...insights,...events,...intents];
}
export function projectVerb(p:Project):VerbId{
 const id=p.definitionId;
 if(['action.converse','action.duet','action.learn_breath','action.lore_talk','action.insist_duet'].includes(id))return 'talk';
 if(['action.compose','action.annotate','action.draft_qin','action.draft_score'].includes(id))return 'create';
 if(['action.perform','action.busk','action.gather','action.brew'].includes(id))return 'work';
 if(['action.rest','action.nurture','action.retreat','action.medicine','action.qin_rest'].includes(id))return 'cultivate';
 if(actionById(id).category==='travel')return 'travel';
 return 'study';
}
export type Draft=Record<string,string>;
export type Slot={id:string;name:string;hint:string;optional?:boolean;accept:(card:TableCard)=>boolean;aspects:string[]};
const tagged=(...tags:string[])=>(c:TableCard)=>tags.some(t=>c.aspects.includes(t));
const actor:Slot={id:'actor',name:'自身',hint:'投入陆青禾',accept:c=>c.id===PLAYER,aspects:['player']};
export function slotsFor(verb:VerbId,draft:Draft,cards:TableCard[],w:World):Slot[]{
 const focus=cards.find(c=>c.id===draft.focus),companion=cards.find(c=>c.id===draft.companion);
 if(verb==='talk'){
  const slots:Slot[]=[actor,{id:'companion',name:'同伴',hint:'愿与你交往的人',accept:tagged('teacher','physician'),aspects:['teacher','physician']}];
  if(companion?.aspects.includes('teacher'))slots.push(
   {id:'instrument',name:'乐器',hint:'可留空。合奏时放入旧琴',optional:true,accept:tagged('instrument'),aspects:['instrument']},
   {id:'score',name:'曲谱',hint:'可留空。合奏时放入曲谱',optional:true,accept:tagged('score'),aspects:['score']},
   {id:'lore',name:'典籍',hint:'可留空。谈掌故时放入县志',optional:true,accept:tagged('history'),aspects:['history']}
  );
  return slots;
 }
 if(verb==='travel')return [actor,{id:'destination',name:'去处',hint:'投入一个已知地点',accept:c=>c.kind==='location',aspects:['place']}];
 if(verb==='cultivate'){
  const slots:Slot[]=[actor,{id:'focus',name:'调养方法',hint:'留空歇息 · 手札调息 · 旧琴入静 · 药物疗伤',optional:true,accept:tagged('breath','medicine','instrument'),aspects:['breath','medicine','instrument']}];
  if(focus?.aspects.includes('breath'))slots.push({id:'intent',name:'打算',hint:'留空调息 · 可放闭关打算',optional:true,accept:c=>c.id==='intent.retreat',aspects:['intention']});
  return slots;
 }
 const tags=verb==='study'?['instrument','history','recipe','breath','material']:verb==='create'?['instrument','history','score']:['instrument','garden','furnace'];
 const slots:Slot[]=[actor,{id:'focus',name:verb==='work'?'所用之物':'所学之物',hint:verb==='work'?'乐器、药圃或丹炉':verb==='create'?'乐器、曲谱或县志':'书卷、乐器或灵草',accept:tagged(...tags),aspects:tags}];
 if(focus?.aspects.includes('instrument')&&(verb!=='work'||locationOf(w,PLAYER)==='location.pavilion'))slots.push({id:'score',name:'曲谱',hint:verb==='create'?'可留空。没有曲谱会留下残稿':'弹奏与创作所据',optional:verb==='create',accept:tagged('score'),aspects:['score']});
 if(focus?.aspects.includes('furnace'))slots.push({id:'recipe',name:'药方',hint:'可供研读的方书',accept:tagged('recipe'),aspects:['recipe']});
 return slots;
}
export function resolveDraft(verb:VerbId,draft:Draft,cards:TableCard[],w:World):{actionId:string;bindings:Record<string,string>}|null{
 const slots=slotsFor(verb,draft,cards,w);
 if(slots.some(s=>!s.optional&&(!draft[s.id]||!cards.some(c=>c.id===draft[s.id]&&s.accept(c)))))return null;
 const focus=cards.find(c=>c.id===draft.focus),companion=cards.find(c=>c.id===draft.companion);
 const a={actor:draft.actor};
 if(verb==='talk'){
  if(companion?.aspects.includes('physician'))return{actionId:'action.learn_breath',bindings:{...a,mentor:draft.companion}};
  if(draft.lore&&(draft.instrument||draft.score))return null;
  if(draft.lore)return companion?.aspects.includes('teacher')?{actionId:'action.lore_talk',bindings:{...a,teacher:draft.companion,book:draft.lore}}:null;
  if(draft.instrument&&draft.score){
   const duet=actionById('action.duet');
   const allowed=w.consents.duet.uses>=1&&w.tick+duet.duration<w.consents.duet.expiresTick;
   return{actionId:allowed?'action.duet':'action.insist_duet',bindings:{...a,teacher:draft.companion,instrument:draft.instrument,score:draft.score}};
  }
  if(draft.instrument||draft.score)return null;
  return companion?.aspects.includes('teacher')?{actionId:'action.converse',bindings:{...a,teacher:draft.companion}}:null;
 }
 if(verb==='travel')return {actionId:'action.visit_'+draft.destination.split('.')[1],bindings:a};
 if(verb==='cultivate'){
  if(focus?.aspects.includes('medicine'))return{actionId:'action.medicine',bindings:a};
  if(focus?.aspects.includes('breath'))return{actionId:draft.intent==='intent.retreat'?'action.retreat':'action.nurture',bindings:{...a,manual:draft.focus}};
  if(focus?.aspects.includes('instrument'))return{actionId:'action.qin_rest',bindings:{...a,instrument:draft.focus}};
  return{actionId:'action.rest',bindings:a};
 }
 if(verb==='study'){
  if(focus?.aspects.includes('instrument'))return{actionId:'action.practice',bindings:{...a,instrument:draft.focus,score:draft.score}};
  if(focus?.aspects.includes('history'))return{actionId:'action.read',bindings:{...a,book:draft.focus}};
  if(focus?.aspects.includes('breath'))return{actionId:'action.read_breath',bindings:{...a,manual:draft.focus}};
  if(focus?.aspects.includes('material'))return{actionId:'action.taste_herb',bindings:{...a,herbs:draft.focus}};
  return{actionId:'action.herbal_study',bindings:{...a,recipe:draft.focus}};
 }
 if(verb==='create'){
  if(focus?.aspects.includes('history'))return{actionId:'action.annotate',bindings:{...a,book:draft.focus}};
  if(focus?.aspects.includes('instrument')&&draft.score)return{actionId:'action.compose',bindings:{...a,instrument:draft.focus,score:draft.score}};
  if(focus?.aspects.includes('instrument'))return{actionId:'action.draft_qin',bindings:{...a,instrument:draft.focus}};
  if(focus?.aspects.includes('score'))return{actionId:'action.draft_score',bindings:{...a,score:draft.focus}};
  return null;
 }
 if(focus?.aspects.includes('garden'))return{actionId:'action.gather',bindings:{...a,garden:draft.focus}};
 if(focus?.aspects.includes('furnace'))return{actionId:'action.brew',bindings:{...a,furnace:draft.focus,recipe:draft.recipe}};
 return locationOf(w,PLAYER)==='location.pavilion'?{actionId:'action.perform',bindings:{...a,instrument:draft.focus,score:draft.score}}:{actionId:'action.busk',bindings:{...a,instrument:draft.focus}};
}
export function sanitizeDraft(verb:VerbId,draft:Draft,cards:TableCard[],w:World){
 const next:Draft={};const used=new Set<string>();
 for(const slot of slotsFor(verb,draft,cards,w)){
  const card=cards.find(c=>c.id===draft[slot.id]);
  if(card&&slot.accept(card)&&!used.has(card.id)){next[slot.id]=card.id;used.add(card.id);}
 }return next;
}
export function fitSlot(card:TableCard,verb:VerbId,draft:Draft,cards:TableCard[],w:World,preferred?:string){
 const slots=slotsFor(verb,draft,cards,w);
 if(Object.values(draft).includes(card.id))return null;
 return slots.find(s=>(!preferred||s.id===preferred)&&!draft[s.id]&&s.accept(card))?.id??null;
}
export function initialCardPosition(card:TableCard,index:number):Point{
 const presets:Record<string,Point>={
  [PLAYER]:{x:400,y:365},'character.teacher':{x:530,y:365},'instance.qin':{x:660,y:365},'instance.score':{x:790,y:365},
  'instance.breath':{x:480,y:605},'instance.history':{x:610,y:605},'instance.recipe':{x:740,y:605},'instance.herbs':{x:910,y:365}
 };
 if(presets[card.id])return presets[card.id];
 if(card.kind==='location'){const i=content.locations.findIndex(l=>l.id===card.id);return{x:1120+(i%2)*126,y:190+Math.floor(i/2)*178};}
 if(card.kind==='event')return{x:1120+(index%2)*126,y:740};
 if(card.kind==='work'||card.kind==='insight')return{x:400+(index%4)*126,y:780};
 return{x:280+(index%6)*126,y:780+Math.floor(index/6)*175};
}
export function defaultLayout(cards:TableCard[]):Record<string,Point>{
 const positions:Record<string,Point>={};
 for(const v of verbs)positions['verb.'+v.id]={...v.position};
 cards.forEach((c,i)=>{positions[c.id]=initialCardPosition(c,i);});
 return positions;
}
export function rectsOverlap(a:LayoutRect,b:LayoutRect,gap=8){
 return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
}
export function layoutRects(positions:Record<string,Point>,cards:TableCard[]):LayoutRect[]{
 return [
  ...verbs.map(v=>({id:'verb.'+v.id,...(positions['verb.'+v.id]??v.position),w:VERB_SIZE.w,h:VERB_SIZE.h})),
  ...cards.map((c,i)=>({id:c.id,...(positions[c.id]??initialCardPosition(c,i)),w:CARD_SIZE.w,h:CARD_SIZE.h}))
 ];
}
export function openingFocusRects(positions:Record<string,Point>,cards:TableCard[]){
 const ids=new Set(['verb.study','verb.talk','verb.create','verb.work',PLAYER,'character.teacher','instance.qin','instance.score']);
 return layoutRects(positions,cards).filter(r=>ids.has(r.id));
}
export function deskFocusRects(positions:Record<string,Point>,cards:TableCard[]){
 const ids=new Set([...verbs.map(v=>'verb.'+v.id),...cards.filter(c=>c.kind!=='location'||c.subtitle==='此刻所在').map(c=>c.id)]);
 return layoutRects(positions,cards).filter(r=>ids.has(r.id));
}
export function cameraToFit(rects:LayoutRect[],viewport:{width:number;height:number}){
 const padLeft=70,padRight=70,padTop=90,padBottom=80;
 const minX=Math.min(...rects.map(r=>r.x))-padLeft,minY=Math.min(...rects.map(r=>r.y))-padTop;
 const maxX=Math.max(...rects.map(r=>r.x+r.w))+padRight,maxY=Math.max(...rects.map(r=>r.y+r.h))+padBottom;
 const bw=Math.max(1,maxX-minX),bh=Math.max(1,maxY-minY);
 const zoom=Math.max(.45,Math.min(1,Math.min(viewport.width/bw,viewport.height/bh)));
 return {zoom,x:(viewport.width-bw*zoom)/2-minX*zoom,y:(viewport.height-bh*zoom)/2-minY*zoom};
}
export function migrateTabletop(ui:TabletopState,cards:TableCard[]):TabletopState{
 if(ui.layoutVersion===LAYOUT_VERSION)return ui;
 return {...ui,layoutVersion:LAYOUT_VERSION,positions:defaultLayout(cards)};
}
export const screenToWorld=(p:Point,camera:{x:number;y:number;zoom:number}):Point=>({x:(p.x-camera.x)/camera.zoom,y:(p.y-camera.y)/camera.zoom});
export function zoomAt(camera:{x:number;y:number;zoom:number},point:Point,zoom:number){
 const z=Math.min(1.5,Math.max(.45,zoom));const fixed=screenToWorld(point,camera);return{x:point.x-fixed.x*z,y:point.y-fixed.y*z,zoom:z};
}
export function cardAvailable(card:TableCard,w:World,held:Set<string>){return !held.has(card.id)&&(!card.entity||!busy(w,card.id));}
export function pendingProjects(w:World,ui:TabletopState){return Object.values(w.projects).filter(p=>p.state==='completed'&&!ui.collected.includes(p.id));}
export function returnCards(p:Project,cards:TableCard[],w:World):TableCard[]{
 const ids=new Set(Object.values(p.boundSlots));
 for(const c of cards){if(c.kind==='work'&&c.id.startsWith(p.id+'/'))ids.add(c.id);if(c.kind==='insight'&&w.insights.some(i=>i.id===c.id&&i.source===p.id))ids.add(c.id);}
 const def=actionById(p.definitionId);for(const effect of def.effects)if(effect.op==='item')for(const c of cards)if(c.entity?.definitionId===effect.definitionId&&c.entity.ownerId===(p.delegated?'org':PLAYER))ids.add(c.id);
 return cards.filter(c=>ids.has(c.id));
}

// Preserve a player's layout when returning cards. New outputs seek an unoccupied
// position near their verb; collecting a result never mutates simulation state.
export function placeReturnedCards(returned:TableCard[],cards:TableCard[],positions:Record<string,Point>,origin:Point):Record<string,Point>{
 const next={...positions},ids=new Set(returned.map(c=>c.id));
 const occupied=cards.filter(c=>!ids.has(c.id)).map(c=>positions[c.id]??initialCardPosition(c,cards.indexOf(c)));
 const free=(point:Point)=>occupied.every(p=>Math.abs(p.x-point.x)>=122||Math.abs(p.y-point.y)>=170);
 for(const card of returned){
  let point=positions[card.id]??initialCardPosition(card,cards.indexOf(card));
  if(!free(point)){
   let found=false;
   for(let radius=0;radius<30&&!found;radius++)for(let row=-radius;row<=radius&&!found;row++)for(let col=-radius;col<=radius;col++){
    if(Math.max(Math.abs(col),Math.abs(row))!==radius)continue;
    const candidate={x:Math.max(-3000,Math.min(6000,origin.x-70+col*124)),y:Math.max(-3000,Math.min(6000,origin.y+165+row*174))};
    const overVerb=verbs.some(v=>{const p=positions['verb.'+v.id]??v.position;return candidate.x<p.x+120&&candidate.x+110>p.x&&candidate.y<p.y+150&&candidate.y+158>p.y;});
    if(free(candidate)&&!overVerb){point=candidate;found=true;break;}
   }
  }
  next[card.id]=point;occupied.push(point);
 }
 return next;
}
