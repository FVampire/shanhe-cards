import {describe,it,expect} from 'vitest';
import {createWorld,assertWorld} from '../src/domain/world';
import {dispatch,advanceWorld} from '../src/domain/engine';
import {PLAYER,type World,type Command} from '../src/domain/model';
import {createResearch,researchCommand,ruleExplanation,setupKey} from '../src/domain/research';
import {researchDomains,checkResearchContent} from '../src/content/research';
import {collectionStock,updateCollection,mergeNotebook} from '../src/domain/notebook';
import {freshNotebook,type ResearchDomain,type ResearchSetup,type Collection} from '../src/domain/research-model';
import {parseSave,envelope} from '../src/infrastructure/save';
function world(seed='research-test'){const w=createWorld(seed);w.mortal.created=true;researchCommand(w,{type:'Research',operation:'enable',domain:'alchemy'});return w;}
let sequence=0;
function cmd(w:World,c:Command){const result=dispatch(w,{commandId:'test.'+(sequence++),expectedRevision:w.revision,actorId:PLAYER,payload:c});expect(result.result,JSON.stringify(result.result)).toMatchObject({ok:true});return result.world;}
function gather(w:World,domain:ResearchDomain){w=cmd(w,{type:'Research',operation:'gather',domain});return advanceWorld(w,w.research!.action!.dueTick);}
function fixed(domain:ResearchDomain):ResearchSetup{return {domain,inputs:[{id:researchDomains[domain].base,quantity:1}],step:'steady',intensity:'low'};}
function experiment(w:World,s:ResearchSetup){w=cmd(w,{type:'Research',operation:'experiment',domain:s.domain,setup:s});return advanceWorld(w,w.research!.action!.dueTick);}
function correct(w:World,domain:ResearchDomain):ResearchSetup{const r=w.research!.rules[domain];return {domain,inputs:[{id:researchDomains[domain].base,quantity:1},{id:r.material,quantity:1}],step:r.step,intensity:'low'};}
describe('知识、情报与自由探索',()=>{
 it('候选内容与 256 个种子都有独行可得的材料、固定炉具和有效方法',()=>{
  checkResearchContent();const variants=new Set<string>();
  for(let i=0;i<256;i++){let w=world('seed-'+i);variants.add(JSON.stringify(w.research!.rules));
   for(const domain of ['craft','alchemy','practice'] as const){w=gather(w,domain);w=experiment(w,fixed(domain));expect(w.mortal.assets[researchDomains[domain].fixed].quantity).toBeGreaterThan(0);const s=correct(w,domain);w=experiment(w,s);expect(w.research!.records.at(-1)?.setup).toEqual(s);expect(w.research!.rules[domain].weights.reduce((a,b)=>a+b,0)).toBe(1000000);assertWorld(w);}
  }expect(variants.size).toBeGreaterThan(1);
 });
 it('同局规则稳定，查询情报不改变后续随机；无情报可执行相同正确组合，道行不加成',()=>{
  let w=gather(world(),'craft');w=experiment(w,fixed('craft'));w=gather(w,'alchemy');const s=correct(w,'alchemy'),other=structuredClone(w);other.entities[PLAYER].professions={'profession.musician':20};
  const before=JSON.stringify(w);ruleExplanation(w.research!,'alchemy',true);expect(JSON.stringify(w)).toBe(before);
  expect(experiment(w,s).research!.records.at(-1)?.outcome).toBe(experiment(other,s).research!.records.at(-1)?.outcome);
 });
 it('试验开始后读档保持既定结果，重复命令与重复推进均不重复扣料或发奖',()=>{
  let w=gather(world(),'alchemy');const s=fixed('alchemy');const e={commandId:'same',expectedRevision:w.revision,actorId:PLAYER,payload:{type:'Research',operation:'experiment',domain:'alchemy',setup:s} as Command};
  w=dispatch(w,e).world;const saved=parseSave(envelope(w)).world;expect(dispatch(w,e).world).toEqual(w);const done=advanceWorld(saved,w.research!.action!.dueTick);expect(done.mortal.assets['xp.salve'].quantity).toBe(1);expect(advanceWorld(done,done.tick).mortal.assets['xp.salve'].quantity).toBe(1);
 });
 it('非操作组合与缺少工具不扣料；已有情报不绕过实际条件',()=>{
  let w=gather(world(),'alchemy');const before=structuredClone(w);expect(()=>researchCommand(w,{type:'Research',operation:'experiment',domain:'alchemy',setup:{...fixed('alchemy'),inputs:[]}})).toThrow();expect(w).toEqual(before);
  expect(()=>researchCommand(w,{type:'Research',operation:'experiment',domain:'alchemy',setup:{...correct(w,'alchemy'),step:'reverse'}})).toThrow('调火炉');expect(w).toEqual(before);
 });
 it('情报引用实际规则、重复讲解不收费，一次随机成功只记观察',()=>{
  let w=world();w=cmd(w,{type:'Research',operation:'explain',domain:'alchemy'});w=advanceWorld(w,w.research!.action!.dueTick);expect(w.research!.evidence[0].text).toBe(ruleExplanation(w.research!,'alchemy',true));expect(()=>researchCommand(w,{type:'Research',operation:'explain',domain:'alchemy'})).toThrow('不必重复');
  w=gather(w,'alchemy');w=experiment(w,fixed('alchemy'));expect(w.research!.evidence.at(-1)?.status).toBe('observed');
 });
 it('付费讲解不扰动产出随机流，功法成果开启内观入口',()=>{
  let w=gather(world(),'craft');w=experiment(w,fixed('craft'));w=gather(w,'alchemy');const s=correct(w,'alchemy');let informed=cmd(w,{type:'Research',operation:'explain',domain:'alchemy'});informed=advanceWorld(informed,informed.research!.action!.dueTick);expect(experiment(w,s).research!.records.at(-1)?.outcome).toBe(experiment(informed,s).research!.records.at(-1)?.outcome);
  w=gather(w,'practice');expect(()=>researchCommand(w,{type:'Research',operation:'introspect',domain:'practice'})).toThrow('心得');w=experiment(w,correct(w,'practice'));w=cmd(w,{type:'Research',operation:'introspect',domain:'practice'});w=advanceWorld(w,w.research!.action!.dueTick);expect(w.research!.evidence.at(-1)?.source).toBe('协同内观');
 });
 it('冲突功法先预警，不损伤；可中断、低强度观察，明确继续才产生可恢复后果',()=>{
  let w=gather(world(),'practice');const s={...correct(w,'practice'),step:(w.research!.rules.practice.step==='gentle'?'reverse':'gentle') as ResearchSetup['step'],intensity:'high' as const},health=w.entities[PLAYER].health;
  w=cmd(w,{type:'Research',operation:'experiment',domain:'practice',setup:s});w=advanceWorld(w,w.research!.action!.dueTick);expect(w.research!.warning).toEqual(s);expect(w.research!.action).toBeNull();expect(w.entities[PLAYER].health).toBe(health);
  w=cmd(w,{type:'Research',operation:'stop',domain:'practice'});w=experiment(w,{...s,intensity:'low'});expect(w.research!.injury).toBe(false);
  w=cmd(w,{type:'Research',operation:'experiment',domain:'practice',setup:s});w=advanceWorld(w,w.research!.action!.dueTick);w=cmd(w,{type:'Research',operation:'continue',domain:'practice'});w=advanceWorld(w,w.research!.action!.dueTick);expect(w.research!.injury).toBe(true);expect(w.entities[PLAYER].health).toBe(health-8);
  w=cmd(w,{type:'Research',operation:'recover',domain:'practice'});w=advanceWorld(w,w.research!.action!.dueTick);expect(w.research!.injury).toBe(false);
 });
 it('研究与原有主要行动互斥，取消不返还已消耗材料',()=>{
  let w=gather(world(),'alchemy');w=cmd(w,{type:'Research',operation:'experiment',domain:'alchemy',setup:fixed('alchemy')});expect(()=>researchCommand(w,{type:'Research',operation:'gather',domain:'alchemy'})).toThrow('正在行事');const result=dispatch(w,{commandId:'work',expectedRevision:w.revision,actorId:PLAYER,payload:{type:'MortalAction',actionId:'rest',choice:''}});expect(result.result.ok).toBe(false);w=cmd(w,{type:'Research',operation:'stop',domain:'alchemy'});expect(w.mortal.assets['xp.herb'].quantity).toBe(2);expect(w.mortal.assets['xp.salve']).toBeUndefined();
 });
 it('功法复验只验证相同条件，新旅程没有旧证据',()=>{
  let w=gather(world(),'practice');const s=correct(w,'practice');w=experiment(experiment(w,s),s);expect(w.research!.evidence.at(-1)?.status).toBe('verified');expect(createResearch('next','world.next').evidence).toEqual([]);expect(setupKey({...s,intensity:'high'})).not.toBe(setupKey(s));
 });
});
describe('个人收藏边界',()=>{
 const collection=(w:World):Collection=>({id:'A',name:'必成筑基法',notes:'只是个人猜想',tags:['待试'],pinned:false,order:0,version:1,entries:[{ref:'kind',id:'xp.herb',name:'青叶草',quantity:2},{ref:'kind',id:'xp.water',name:'寒泉液',quantity:1}],journey:w.worldId,history:[]});
 it('同名独立、引用不造物；编辑组合才升版本，旧观察不覆盖新组合',()=>{
  const w=gather(world(),'alchemy'),before=structuredClone(w);let book=updateCollection(freshNotebook(),collection(w));book=updateCollection(book,{...collection(w),id:'B'});expect(book.collections).toHaveLength(2);expect(w).toEqual(before);book=updateCollection(book,{...book.collections[0],name:'改名'});expect(book.collections.at(-1)?.version).toBe(1);book=updateCollection(book,{...book.collections.at(-1)!,entries:[{ref:'kind',id:'xp.herb',name:'青叶草',quantity:3}]});expect(book.collections.at(-1)?.version).toBe(2);expect(book.collections.at(-1)?.history).toHaveLength(1);
 });
 it('重复引用不重复计算可用量，旧实例不自动替换；查看和准备查询不扣物品',()=>{
  const w=gather(world(),'alchemy'),c=collection(w);c.entries=[c.entries[0],c.entries[0]];const before=structuredClone(w),stock=collectionStock(w,c);expect(stock.map(x=>x.available)).toEqual([2,1]);expect(w).toEqual(before);c.entries=[{...c.entries[0],ref:'instance',journey:'other'}];expect(collectionStock(w,c)[0].available).toBe(0);
 });
 it('导入同 ID 保留副本，名称不作为唯一标识',()=>{const w=world(),book=updateCollection(freshNotebook(),collection(w));expect(mergeNotebook(book,book,()=> 'copy').collections.map(c=>c.id)).toEqual(['A','copy']);});
 it('指定实例耗尽后重新取得同名物品不重绑，运行中的功法不被准备抢占',()=>{
  let w=gather(world(),'alchemy');const c=collection(w);c.entries=[{ref:'instance',id:'xp.herb',instanceId:w.mortal.assets['xp.herb'].instanceId,name:'青叶草',journey:w.worldId,quantity:1}];
  w=experiment(experiment(experiment(w,fixed('alchemy')),fixed('alchemy')),fixed('alchemy'));w=gather(w,'alchemy');expect(collectionStock(w,c)[0].available).toBe(0);
  w=gather(w,'practice');c.entries=[{ref:'kind',id:'xp.breath',name:'吐纳篇',quantity:1}];w=cmd(w,{type:'Research',operation:'experiment',domain:'practice',setup:fixed('practice')});expect(collectionStock(w,c)[0].available).toBe(0);
 });
});
