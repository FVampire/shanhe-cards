import { describe,it,expect } from 'vitest';
import { createLegacyWorld as createWorld } from '../src/domain/world';
import { PLAYER,type World } from '../src/domain/model';
import { content,actionById } from '../src/content';
import { dispatch,advanceWorld } from '../src/domain/engine';
import { suggestedBindings } from '../src/domain/actions';
import { cardsFor,slotsFor,resolveDraft,sanitizeDraft,fitSlot,screenToWorld,zoomAt,returnCards,pendingProjects,verbs,projectVerb,placeReturnedCards,defaultLayout,layoutRects,rectsOverlap,openingFocusRects,cameraToFit,LAYOUT_VERSION,migrateTabletop,CARD_SIZE,VERB_SIZE } from '../src/presentation/tabletop';
import { freshTabletop } from '../src/application/ui-state';
import { envelope,parseSave } from '../src/infrastructure/save';
const player=PLAYER,teacher='character.teacher',qin='instance.qin',score='instance.score';
function finish(w:World,id:string){const r=dispatch(w,{commandId:'test.'+w.revision,expectedRevision:w.revision,actorId:PLAYER,payload:{type:'StartAction',actionId:id,bindings:suggestedBindings(w,actionById(id))!}});expect(r.result.ok).toBe(true);return advanceWorld(r.world,Math.min(...Object.values(r.world.projects).filter(p=>p.state==='running').map(p=>p.dueTick)));}
describe('桌面组合映射',()=>{
 it('属性过滤与动态槽位拒绝错误卡，不修改世界',()=>{const w=createWorld(),before=structuredClone(w),cards=cardsFor(w);expect(fitSlot(cards.find(c=>c.id===qin)!,'talk',{},cards,w,'actor')).toBeNull();expect(fitSlot(cards.find(c=>c.id===qin)!,'talk',{},cards,w)).toBeNull();expect(fitSlot(cards.find(c=>c.id===player)!,'talk',{},cards,w)).toBe('actor');expect(fitSlot(cards.find(c=>c.id===player)!,'talk',{actor:player},cards,w)).toBeNull();expect(resolveDraft('talk',{actor:player,companion:teacher},cards,w)).toEqual({actionId:'action.converse',bindings:{actor:player,teacher}});expect(resolveDraft('talk',{actor:player,companion:teacher,instrument:qin},cards,w)).toBeNull();expect(resolveDraft('talk',{actor:player,companion:teacher,instrument:qin,score},cards,w)).toEqual({actionId:'action.duet',bindings:{actor:player,teacher,instrument:qin,score}});expect(w).toEqual(before);});
 it('交游先见人，乐器、曲谱与典籍只在沈知弦在座时作为可留空的准备',()=>{const w=createWorld(),cards=cardsFor(w);expect(slotsFor('talk',{},cards,w).map(s=>s.id)).toEqual(['actor','companion']);expect(slotsFor('talk',{actor:player,companion:teacher},cards,w).map(s=>({id:s.id,optional:!!s.optional}))).toEqual([{id:'actor',optional:false},{id:'companion',optional:false},{id:'instrument',optional:true},{id:'score',optional:true},{id:'lore',optional:true}]);expect(fitSlot(cards.find(c=>c.id===qin)!,'talk',{actor:player,companion:teacher},cards,w)).toBe('instrument');expect(fitSlot(cards.find(c=>c.id==='instance.history')!,'talk',{actor:player,companion:teacher},cards,w)).toBe('lore');});
 it('同一张开局卡在不同动词下走出旁枝，混装则仍是未完成的准备',()=>{
  const w=createWorld(),cards=cardsFor(w),history='instance.history',breath='instance.breath',herbs='instance.herbs';
  expect(resolveDraft('talk',{actor:player,companion:teacher,lore:history},cards,w)).toEqual({actionId:'action.lore_talk',bindings:{actor:player,teacher,book:history}});
  expect(resolveDraft('talk',{actor:player,companion:teacher,lore:history,instrument:qin},cards,w)).toBeNull();
  expect(resolveDraft('study',{actor:player,focus:breath},cards,w)?.actionId).toBe('action.read_breath');
  expect(resolveDraft('study',{actor:player,focus:herbs},cards,w)?.actionId).toBe('action.taste_herb');
  expect(resolveDraft('cultivate',{actor:player,focus:qin},cards,w)?.actionId).toBe('action.qin_rest');
  expect(resolveDraft('create',{actor:player,focus:qin},cards,w)?.actionId).toBe('action.draft_qin');
  expect(resolveDraft('create',{actor:player,focus:'instance.score'},cards,w)?.actionId).toBe('action.draft_score');
  expect(slotsFor('create',{actor:player,focus:qin},cards,w).find(s=>s.id==='score')?.optional).toBe(true);
  w.consents.duet.uses=0;
  expect(resolveDraft('talk',{actor:player,companion:teacher,instrument:qin,score:'instance.score'},cards,w)?.actionId).toBe('action.insist_duet');
 });
 it('同一乐器因动词及地点得到不同实践，完整组合才可执行',()=>{const w=createWorld(),cards=cardsFor(w),d={actor:player,focus:qin,score};expect(resolveDraft('study',d,cards,w)?.actionId).toBe('action.practice');expect(resolveDraft('create',d,cards,w)?.actionId).toBe('action.compose');expect(resolveDraft('work',d,cards,w)?.actionId).toBe('action.perform');w.entities[player].location='location.market';expect(resolveDraft('work',{actor:player,focus:qin},cardsFor(w),w)?.actionId).toBe('action.busk');});
 it('医生替代教师时收起乐器槽，并释放不再适用的准备卡',()=>{const w=createWorld();w.entities[player].location='location.study';const cards=cardsFor(w),d={actor:player,companion:'character.physician',instrument:qin,score};expect(slotsFor('talk',d,cards,w).map(s=>s.id)).toEqual(['actor','companion']);expect(sanitizeDraft('talk',d,cards,w)).toEqual({actor:player,companion:'character.physician'});expect(resolveDraft('talk',d,cards,w)?.actionId).toBe('action.learn_breath');});
 it('离开的故人不再出现在案上，在场时字幕是处境而不是空泛的友人',()=>{
  const w=createWorld();expect(cardsFor(w).find(c=>c.id===teacher)?.subtitle).toMatch(/信任/);
  w.entities[teacher].active=false;expect(cardsFor(w).some(c=>c.id===teacher)).toBe(false);
 });
 it('修养的空槽、手札、闭关打算分别对应三种行动',()=>{const w=createWorld();w.entities[player].knowledge['knowledge.breath']='understood';const cards=cardsFor(w);expect(resolveDraft('cultivate',{actor:player},cards,w)?.actionId).toBe('action.rest');expect(resolveDraft('cultivate',{actor:player,focus:'instance.breath'},cards,w)?.actionId).toBe('action.nurture');expect(resolveDraft('cultivate',{actor:player,focus:'instance.breath',intent:'intent.retreat'},cards,w)?.actionId).toBe('action.retreat');expect(sanitizeDraft('cultivate',{actor:player,intent:'intent.retreat'},cards,w)).toEqual({actor:player});});
 it('每个原有行动都归属一个动词方块，已知地点都能映射出行',()=>{for(const action of content.actions)expect(verbs.map(v=>v.id)).toContain(projectVerb({definitionId:action.id} as never));const w=createWorld(),cards=cardsFor(w);for(const location of content.locations){const resolved=resolveDraft('travel',{actor:player,destination:location.id},cards,w)!;expect(actionById(resolved.actionId)).toBeDefined();expect(resolved.bindings).toEqual({actor:player});}});
 it('完成后待收取，人物、乐器、心得与作品不会因收取再次奖励',()=>{let w=finish(createWorld(),'action.duet');const before=structuredClone(w);const ui=freshTabletop(),project=w.projects['project.1'];expect(pendingProjects(w,ui)).toHaveLength(1);expect(returnCards(project,cardsFor(w),w).map(c=>c.id)).toEqual(expect.arrayContaining([player,teacher,qin,score,...w.insights.map(i=>i.id)]));ui.collected.push(project.id);expect(pendingProjects(w,ui)).toHaveLength(0);expect(w).toEqual(before);w=finish(w,'action.duet');w=finish(w,'action.compose');expect(returnCards(w.projects['project.3'],cardsFor(w),w).map(c=>c.id)).toContain(w.works[0].id);});
});
describe('开局案面',()=>{
 it('默认摆放时人物器物不压动词，卡牌彼此留出空位',()=>{
  const cards=cardsFor(createWorld()),positions=defaultLayout(cards),rects=layoutRects(positions,cards);
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)expect(rectsOverlap(rects[i],rects[j]),rects[i].id+' 压住 '+rects[j].id).toBe(false);
 });
 it('开局四人与器物排在交游下方，地点在行游右侧',()=>{
  const cards=cardsFor(createWorld()),positions=defaultLayout(cards),talk=positions['verb.talk'],study=positions['verb.study'],work=positions['verb.work'],travel=positions['verb.travel'];
  for(const id of [player,teacher,qin,score]){
   expect(positions[id].y).toBeGreaterThan(talk.y+VERB_SIZE.h);
   expect(positions[id].x).toBeGreaterThan(study.x-40);
   expect(positions[id].x).toBeLessThan(work.x+VERB_SIZE.w);
  }
  expect(positions[player].y).toBe(positions[teacher].y);
  expect(positions[teacher].x).toBeGreaterThan(positions[player].x);
  for(const location of content.locations)expect(positions[location.id].x).toBeGreaterThan(travel.x+VERB_SIZE.w-40);
 });
 it('开局视角只框定案上动词与手头卡牌，1440 宽桌面可读',()=>{
  const cards=cardsFor(createWorld()),positions=defaultLayout(cards);
  const camera=cameraToFit(openingFocusRects(positions,cards),{width:1440,height:1000});
  expect(camera.zoom).toBeGreaterThanOrEqual(.75);
  const full=cameraToFit(layoutRects(positions,cards),{width:1440,height:1000});
  expect(camera.zoom).toBeGreaterThan(full.zoom-.01);
 });
 it('旧存档无 layoutVersion 时改为新摆放，已是当前版本的自定义位置保持不变',()=>{
  const cards=cardsFor(createWorld()),custom={...freshTabletop(),layoutVersion:LAYOUT_VERSION,positions:{[player]:{x:12,y:34}}};
  expect(migrateTabletop(custom,cards).positions[player]).toEqual({x:12,y:34});
  const upgraded=migrateTabletop(freshTabletop(),cards);
  expect(upgraded.layoutVersion).toBe(LAYOUT_VERSION);
  expect(upgraded.positions[player]).toEqual(defaultLayout(cards)[player]);
  expect(upgraded.positions['verb.talk']).toEqual(defaultLayout(cards)['verb.talk']);
 });
});
describe('桌面视角与旧存档',()=>{
 it('收取保留原摆放，若新卡片占位则寻找空位，不遮住已有卡牌',()=>{const w=createWorld(),cards=cardsFor(w),actor=cards.find(c=>c.id===player)!;const positions={[player]:{x:700,y:400},[qin]:{x:700,y:400}};const next=placeReturnedCards([actor],cards,positions,{x:600,y:300});expect(next[player]).not.toEqual(next[qin]);expect(Math.abs(next[player].x-next[qin].x)>=122||Math.abs(next[player].y-next[qin].y)>=170).toBe(true);expect(positions[player]).toEqual({x:700,y:400});const restored=placeReturnedCards([actor],cards,{[player]:{x:100,y:100}},{x:600,y:300});expect(restored[player]).toEqual({x:100,y:100});});
 it('缩放以鼠标为锚点，世界坐标保持不变且缩放有界',()=>{const camera={x:-300,y:220,zoom:.8},cursor={x:345,y:345};const point=screenToWorld(cursor,camera);expect(screenToWorld(cursor,zoomAt(camera,cursor,1.3))).toEqual(point);expect(zoomAt(camera,cursor,10).zoom).toBe(1.5);expect(zoomAt(camera,cursor,.01).zoom).toBe(.45);});
 it('新桌面可往返导出，旧版只有tab也兼容；UI不能篡改世界',()=>{const w=createWorld(),ui={...freshTabletop(),positions:{[player]:{x:400,y:300}},camera:{x:-100,y:40,zoom:.8},collected:['project.1']};expect(parseSave(envelope(w,4,{tab:'board',tabletop:ui})).ui.tabletop).toEqual(ui);expect(parseSave(envelope(w)).ui).toEqual({tab:'board'});expect(()=>parseSave({...envelope(w),ui:{tab:'board',tabletop:{...ui,camera:{...ui.camera,zoom:0}}}})).toThrow();const modified=envelope(w);modified.world.money=500;expect(()=>parseSave(modified)).toThrow('校验');});
});
