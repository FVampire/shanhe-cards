import { describe,it,expect } from 'vitest';
import { createLegacyWorld as createWorld,busy,available,hasFact,assertWorld,recordFact } from '../src/domain/world';
import { dispatch,advanceWorld } from '../src/domain/engine';
import { PLAYER,type World,type Command } from '../src/domain/model';
import { matchActions,suggestedBindings,completeProject } from '../src/domain/actions';
import { content,validateContent,actionById } from '../src/content';
import { specialProbability,omenProbability } from '../src/domain/dao';
import { samplePpm,checksum,roll } from '../src/domain/random';
import { followups,investigate } from '../src/domain/events';
import { peopleSituations } from '../src/domain/people';
let sequence=0;
function command(w:World,payload:Command){const r=dispatch(w,{commandId:'test.'+sequence++,expectedRevision:w.revision,actorId:PLAYER,payload});if(!r.result.ok)throw new Error(r.result.code+': '+r.result.message);return r.world;}
function start(w:World,id:string){const a=actionById('action.'+id);return command(w,{type:'StartAction',actionId:a.id,bindings:suggestedBindings(w,a)!});}
function finish(w:World){return advanceWorld(w,Math.min(...Object.values(w.projects).filter(p=>p.state==='running').map(p=>p.dueTick)));}
function music(){let w=createWorld();w=finish(start(w,'duet'));w=finish(start(w,'duet'));return finish(start(w,'compose'));}
function brewWorld(){const w=createWorld();w.entities[PLAYER].location='location.garden';w.entities[PLAYER].skills['skill.alchemy']=5;w.entities[PLAYER].knowledge['knowledge.herbal']='understood';return w;}
describe('音乐与职业闭环',()=>{
 it('两次合奏得到具体技艺和关系，然后创作、签约、履约与晋升',()=>{
  let w=music();expect(w.entities[PLAYER].skills['skill.music']).toBe(20);expect(w.works).toHaveLength(1);expect(w.relations[PLAYER+'/character.teacher']).toBe(7);expect(w.money).toBe(24);expect(w.entities[PLAYER].professions).toEqual({});
  w=command(w,{type:'ChooseEventOption',eventId:'event.recital',option:'accept'});expect(w.money).toBe(24);expect(w.contract.escrow).toBe(36);
  w=finish(start(w,'perform'));expect(w.money).toBe(60);expect(w.contract.escrow).toBe(0);expect(hasFact(w,'performed')).toBe(true);
  w=command(w,{type:'AdvanceProfession',professionId:'profession.musician',targetLevel:1});expect(w.entities[PLAYER].professions['profession.musician']).toBe(1);expect(w.entities[PLAYER].health).toBe(85);expect(w.entities[PLAYER].longevityDays).toBe(0);
  const repeated=dispatch(w,{commandId:'again',expectedRevision:w.revision,actorId:PLAYER,payload:{type:'AdvanceProfession',professionId:'profession.musician',targetLevel:1}});expect(repeated.result.ok).toBe(false);expect(repeated.world).toBe(w);
 });
 it('拒绝邀约后仍能独立谋生',()=>{
  let w=music();w=command(w,{type:'ChooseEventOption',eventId:'event.recital',option:'decline'});w=finish(start(w,'visit_market'));w=finish(start(w,'busk'));expect(w.money).toBe(36);
 });
 it('未理解药理不能炼制，普通文字获取不等于掌握',()=>{
  const w=brewWorld();w.entities[PLAYER].knowledge['knowledge.herbal']='acquired';expect(()=>start(w,'brew')).toThrow('需理解');
 });
 it('学问独立成文，不依赖战斗或道行',()=>{
  let w=createWorld();w=finish(start(w,'read'));w=finish(start(w,'read'));w=finish(start(w,'annotate'));expect(w.works[0].title).toBe('青溪水道考');expect(w.entities[PLAYER].professions).toEqual({});
 });
});
describe('事务与唯一占用',()=>{
 it('只与沈知弦对坐不消耗合奏许可，也不增加音律',()=>{
  let w=start(createWorld(),'converse');expect(busy(w,PLAYER)).toBe(true);expect(busy(w,'character.teacher')).toBe(true);expect(busy(w,'instance.qin')).toBe(false);
  w=finish(w);expect(w.consents.duet.uses).toBe(2);expect(w.entities[PLAYER].skills['skill.music']).toBe(8);expect(w.relations[PLAYER+'/character.teacher']).toBe(6);
 });
 it('故人有去处与秘密：小坐后有去信和腕力心得，过期离开，挽留需信任',()=>{
  let w=finish(start(createWorld(),'converse'));
  expect(w.events['event.teacher_road']?.major).toBe(false);
  expect(w.insights.some(i=>i.id==='insight.teacher_wrist')).toBe(true);
  expect(peopleSituations(w).some(s=>s.id==='character.teacher'&&s.status.includes('听雨亭'))).toBe(true);
  w=command(w,{type:'ChooseEventOption',eventId:'event.teacher_road',option:'stay'});
  expect(hasFact(w,'teacher_stayed')).toBe(true);
  w=advanceWorld(w,w.events['event.teacher_road'].expiresTick);expect(w.entities['character.teacher'].active).toBe(true);
  let gone=finish(start(createWorld(),'converse'));gone=advanceWorld(gone,gone.events['event.teacher_road'].expiresTick);
  expect(gone.entities['character.teacher'].active).toBe(false);expect(peopleSituations(gone).some(s=>s.id==='character.teacher'&&s.status.includes('下游'))).toBe(true);
 });
 it('云岚会离开书院，请益或请她再留则可留下；小满的托付过期会添疲劳',()=>{
  let left=advanceWorld(createWorld(),2160);expect(left.entities['character.physician'].active).toBe(false);
  let kept=createWorld();kept.entities[PLAYER].location='location.study';kept=finish(start(kept,'learn_breath'));kept=advanceWorld(kept,3000);expect(kept.entities['character.physician'].active).toBe(true);
  let garden=createWorld();garden.entities[PLAYER].location='location.garden';followups(garden);garden=command(garden,{type:'ChooseEventOption',eventId:'event.garden',option:'join'});
  expect(garden.events['event.worker_plea']).toBeTruthy();
  const fatigue=garden.entities['character.worker'].fatigue;garden=advanceWorld(garden,garden.events['event.worker_plea'].expiresTick);
  expect(garden.entities['character.worker'].fatigue).toBe(fatigue+15);
 });
 it('开局器物走旁枝：抚琴入静、谈掌故、默读手札、生嚼灵草、未成之曲',()=>{
  const tired=createWorld();tired.entities[PLAYER].fatigue=30;const rest=finish(start(tired,'qin_rest'));
  expect(rest.entities[PLAYER].fatigue).toBe(10);expect(rest.entities[PLAYER].skills['skill.music']).toBe(9);expect(rest.entities[PLAYER].skills['skill.cultivation']).toBe(0);expect(busy(rest,'instance.qin')).toBe(false);
  let lore=finish(start(createWorld(),'lore_talk'));
  expect(lore.relations[PLAYER+'/character.teacher']).toBe(6);expect(Object.values(lore.entities).some(e=>e.definitionId==='item.marginalia')).toBe(true);expect(lore.consents.duet.uses).toBe(2);
  let breath=finish(start(createWorld(),'read_breath'));
  expect(breath.entities[PLAYER].knowledge['knowledge.breath']).toBe('understood');expect(breath.entities[PLAYER].skills['skill.cultivation']).toBe(3);
  let taste=finish(start(createWorld(),'taste_herb'));
  expect(taste.entities['instance.herbs'].quantity).toBe(5);expect(taste.entities[PLAYER].health).toBe(83);expect(taste.insights.some(i=>i.understanding.includes('药性'))).toBe(true);
  let draft=finish(start(createWorld(),'draft_qin'));
  expect(draft.works).toHaveLength(0);expect(Object.values(draft.entities).some(e=>e.definitionId==='item.draft')).toBe(true);expect(hasFact(draft,'drafted')).toBe(true);
 });
 it('许可用尽后仍可强求合奏，伤关系且沈先生不愿再合奏；小坐可解开',()=>{
  let w=finish(start(createWorld(),'duet'));w=finish(start(w,'duet'));expect(()=>start(w,'duet')).toThrow('许可');
  expect(w.entities['character.teacher'].willing).toBe(true);
  w=finish(start(w,'insist_duet'));expect(w.consents.duet.uses).toBe(0);expect(w.relations[PLAYER+'/character.teacher']).toBe(6);expect(w.entities['character.teacher'].willing).toBe(false);expect(w.entities[PLAYER].skills['skill.music']).toBe(20);
  expect(()=>start(w,'insist_duet')).toThrow('不愿');
  w=finish(start(w,'converse'));expect(w.entities['character.teacher'].willing).toBe(true);expect(w.relations[PLAYER+'/character.teacher']).toBe(7);
 });
 it('预览无副作用，拖拽顺序不影响绑定，重复实体不能填两个槽',()=>{
  const w=createWorld(),before=JSON.stringify(w);const ids=[PLAYER,'character.teacher','instance.qin','instance.score'];expect(matchActions(w,ids)[0].bindings).toEqual(matchActions(w,ids.reverse())[0].bindings);expect(JSON.stringify(w)).toBe(before);expect(matchActions(w,[PLAYER,PLAYER,'instance.qin','instance.score']).every(p=>p.action.id!=='action.duet')).toBe(true);
 });
 it('合奏锁住两人及琴谱，取消归还且不返还许可',()=>{
  let w=start(createWorld(),'duet');for(const id of [PLAYER,'character.teacher','instance.qin','instance.score'])expect(busy(w,id)).toBe(true);
  expect(()=>start(w,'practice')).toThrow('ACTOR_BUSY');w=command(w,{type:'CancelAction',projectId:'project.1'});expect(Object.keys(w.reservations)).toHaveLength(0);expect(w.consents.duet.uses).toBe(1);
  w=advanceWorld(w,240);expect(w.entities[PLAYER].skills['skill.music']).toBe(8);
 });
 it('旧版本与重复命令均不会多次结算',()=>{
  const w=createWorld(),payload={type:'StartAction' as const,actionId:'action.duet',bindings:suggestedBindings(w,actionById('action.duet'))!};
  const e={commandId:'same',expectedRevision:0,actorId:PLAYER,payload};const first=dispatch(w,e);const repeat=dispatch(first.world,e);expect(repeat.world).toBe(first.world);expect(Object.keys(repeat.world.projects)).toHaveLength(1);
  const stale=dispatch(first.world,{...e,commandId:'new'});expect(stale.result).toMatchObject({ok:false,code:'STALE_REVISION'});
 });
 it('末次材料被预留后不能调拨，完成时才扣除',()=>{
  let w=brewWorld();w.entities['instance.herbs'].quantity=2;w=start(w,'brew');expect(w.entities['instance.herbs'].quantity).toBe(2);expect(available(w,'instance.herbs')).toBe(0);w.organization.authorized=true;
  const r=dispatch(w,{commandId:'transfer',expectedRevision:w.revision,actorId:PLAYER,payload:{type:'TransferItem',direction:'to_org',quantity:2}});expect(r.result.ok).toBe(false);
  w=finish(w);expect(w.entities['instance.herbs'].quantity).toBe(0);expect(Object.values(w.entities).find(e=>e.definitionId==='item.medicine')?.quantity).toBe(1);
 });
 it('取消炼丹返还材料，旧到期任务不能生成成品',()=>{
  let w=start(brewWorld(),'brew');w=command(w,{type:'CancelAction',projectId:'project.1'});w=advanceWorld(w,200);expect(available(w,'instance.herbs')).toBe(6);expect(Object.values(w.entities).some(e=>e.definitionId==='item.medicine')).toBe(false);
 });
 it('重复完成回调不再发放奖励',()=>{
  const w=finish(start(createWorld(),'duet'));const before=structuredClone(w);completeProject(w,w.projects['project.1']);expect(w).toEqual(before);
 });
 it('参与者离开或设施损坏会中断，释放全部预留',()=>{
  let w=start(brewWorld(),'brew');w.entities['facility.furnace'].active=false;w=finish(w);expect(w.projects['project.1'].state).toBe('interrupted');expect(available(w,'instance.herbs')).toBe(6);
 });
 it('同一设施不能同时进行两份生产',()=>{
  const w=start(brewWorld(),'brew');w.organization.authorized=true;const next=command(w,{type:'AssignDelegate',enabled:true,proxy:true,budget:6});expect(next.organization.delegation).toBe(false);expect(Object.values(next.projects).filter(p=>p.state==='running')).toHaveLength(1);expect(next.organization.money).toBe(30);
 });
 it('错误命令完全回滚',()=>{
  const w=createWorld(),original=JSON.stringify(w);expect(()=>command(w,{type:'BuyHerbs',quantity:-2})).toThrow();expect(JSON.stringify(w)).toBe(original);
 });
});
describe('期限与时间',()=>{
 it('恰在期限时结束不算履约，之前的合法开始也会重新校验',()=>{
  let w=createWorld();w.entities[PLAYER].skills['skill.music']=20;w.contract={state:'accepted',escrow:36,expiresTick:180};expect(()=>start(w,'perform')).toThrow('截止');
  w.contract.expiresTick=181;w=start(w,'perform');w.contract.expiresTick=180;w=finish(w);expect(w.money).toBe(24);expect(w.projects['project.1'].state).toBe('interrupted');expect(w.contract.state).toBe('expired');
 });
 it('相同期限的教师许可不能开始',()=>{const w=createWorld();w.tick=600;expect(()=>start(w,'duet')).toThrow('期限');});
 it('大步与小步推进的业务、年龄、材料一致',()=>{
  const w=start(brewWorld(),'brew');const large=advanceWorld(w,300);let small=w;for(let i=1;i<=30;i++)small=advanceWorld(small,i*10);
  const project=(x:World)=>({entities:x.entities,projects:x.projects,money:x.money,log:x.log,reservations:x.reservations});expect(project(small)).toEqual(project(large));
 });
 it('重要事件在原子结算后暂停，保留完整作品',()=>{const w=music();expect(w.tick).toBe(480);expect(w.works).toHaveLength(1);expect(w.events['event.recital'].major).toBe(true);});
});
describe('有限组织委托',()=>{
 it('三轮耗尽六份原料后停止，且不重复刷异常',()=>{
  let w=createWorld();w.organization.authorized=true;w=command(w,{type:'AssignDelegate',enabled:true,proxy:true,budget:10});w=advanceWorld(w,1000);
  expect(w.organization.cycles).toBe(3);expect(w.entities['instance.org_herbs'].quantity).toBe(0);expect(w.organization.money).toBe(24);expect(w.organization.delegation).toBe(false);
  expect(Object.values(w.entities).find(e=>e.ownerId==='org'&&e.definitionId==='item.medicine')?.quantity).toBe(3);
  const n=Object.keys(w.events).length;w=advanceWorld(w,1100);expect(Object.keys(w.events)).toHaveLength(n);
 });
 it('闭关不安排代理则不能启动；有代理时可并行',()=>{
  let w=start(createWorld(),'practice');w.organization.authorized=true;const stopped=command(w,{type:'AssignDelegate',enabled:true,proxy:false,budget:6});expect(stopped.organization.blocked).toContain('负责人');
  const running=command(w,{type:'AssignDelegate',enabled:true,proxy:true,budget:6});expect(Object.values(running.projects).filter(p=>p.state==='running')).toHaveLength(2);
 });
 it('权限撤销后不再派出下一轮',()=>{
  let w=createWorld();w.organization.authorized=true;w=command(w,{type:'AssignDelegate',enabled:true,proxy:true,budget:8});w.organization.authorized=false;w=advanceWorld(w,400);expect(w.organization.cycles).toBe(1);expect(w.organization.blocked).toContain('权限');
 });
});
describe('道行、秘密与稳定随机',()=>{
 it('文档概率向量正确且单调',()=>{
  expect([0,20,60,180].map(d=>specialProbability(d))).toEqual([800000,410000,215000,98000]);
  expect([0,20,60,180].map(d=>omenProbability(d))).toEqual([100000,400000,550000,640000]);
  for(let d=0;d<1000;d++){expect(specialProbability(d+1)).toBeLessThanOrEqual(specialProbability(d));expect(omenProbability(d+1)).toBeGreaterThanOrEqual(omenProbability(d));}
  expect(()=>specialProbability(-1)).toThrow();expect(()=>omenProbability(0,1,1000000)).toThrow();
 });
 it('SHA-256 与 keyed-v1 已知向量',()=>{expect(checksum('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');expect(samplePpm('vector-seed','vector-key')).toBe(259284);});
 it('增加无关判定不改变旧抽样；概率变化不重抽同一情境',()=>{
  const w=createWorld();const a=roll(w,'omen','mountain/1',PLAYER,'danger',100000);roll(w,'omen','other/1',PLAYER,'good',700000);expect(roll(w,'omen','mountain/1',PLAYER,'danger',700000)).toEqual(a);
 });
 it('保存再载入同情境的抽样与结果一致',()=>{
  const w=createWorld();w.entities[PLAYER].location='location.mountain';followups(w);const copy=JSON.parse(JSON.stringify(w)) as World;followups(copy);expect(copy.rolls).toEqual(w.rolls);
 });
 it('秘密不会直接进入全体知情或公开评价',()=>{
  const w=createWorld();expect(w.facts['fact.mountain']).toBeTruthy();expect(w.knowledge).toHaveLength(0);expect(w.reputation).toEqual({});w.entities[PLAYER].location='location.mountain';investigate(w);expect(w.knowledge).toHaveLength(1);expect(w.knowledge[0].observerId).toBe(PLAYER);expect(w.reputation).toEqual({});
 });
 it('道行不改变普通伤害、普通学习、健康和调养产出',()=>{
  for(const level of [0,20,180]){
   let w=createWorld();w.entities[PLAYER].professions['profession.musician']=level;w.entities[PLAYER].location='location.mountain';investigate(w);w=command(w,{type:'Encounter',choice:'endure'});expect(w.entities[PLAYER].health).toBe(82);
   const ordinary=createWorld();ordinary.entities[PLAYER].professions['profession.musician']=level;const done=finish(start(ordinary,'practice'));expect(done.entities[PLAYER].skills['skill.music']).toBe(11);expect(done.entities[PLAYER].longevityDays).toBe(0);
  }
 });
 it('随机分布在预设宽容差内',()=>{let hit=0;for(let i=0;i<2000;i++)if(samplePpm('distribution','key/'+i)<500000)hit++;expect(hit).toBeGreaterThan(900);expect(hit).toBeLessThan(1100);});
});
describe('内容与快照的运行时校验',()=>{
 it('正式内容通过结构与引用校验',()=>{expect(validateContent(content).actions).toHaveLength(33);assertWorld(createWorld());});
 it.each(['dao','unknown'])('普通条件无法访问 %s',op=>{const bad=structuredClone(content) as any;bad.actions[0].conditions=[{op,value:20}];expect(()=>validateContent(bad)).toThrow();});
 it('拒绝错误技能、负数材料、未知效果、额外字段与重复槽位',()=>{
  for(const change of [(c:any)=>c.actions[0].effects[0].skillId='skill.typo',(c:any)=>c.actions[0].costs.push({resource:'item.herbs',quantity:-1,owner:'actor',phase:'start'}),(c:any)=>c.actions[0].effects.push({id:'bad',op:'resolve_special_effect'}),(c:any)=>c.actions[0].dao=1,(c:any)=>c.actions[0].slots.push(c.actions[0].slots[0])]){const bad=structuredClone(content);change(bad);expect(()=>validateContent(bad)).toThrow();}
 });
 it('拒绝存档中的负数、无效物品、容器环与超额预留',()=>{
  for(const change of [(w:World)=>w.money=-1,(w:World)=>w.entities['instance.qin'].definitionId='wrong',(w:World)=>{w.entities['instance.qin'].containerId='instance.qin';},(w:World)=>{w.entities['instance.herbs'].quantity=0;}]){const w=start(brewWorld(),'brew');change(w);expect(()=>assertWorld(w)).toThrow();}
 });
});

it('存档缺失运行行动的占用不可载入',()=>{const w=start(createWorld(),'duet');w.reservations={};expect(()=>assertWorld(w)).toThrow('独占');});
