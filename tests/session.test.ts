import 'fake-indexeddb/auto';
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { GameSession } from '../src/application/game-session';
import { SaveRepository,envelope } from '../src/infrastructure/save';
import { createLegacyWorld as createWorld } from '../src/domain/world';
import { PLAYER } from '../src/domain/model';
import { freshTabletop } from '../src/application/ui-state';
import {createWorld as createChapter} from '../src/domain/world';
import {researchDomains} from '../src/content/research';
const sessions:GameSession[]=[];
let holder=false;
beforeEach(()=>{
 vi.stubGlobal('document',{hidden:false});
 vi.stubGlobal('navigator',{locks:{request:async(_name:string,_options:unknown,callback:(lock:object|null)=>Promise<void>)=>{if(holder)return callback(null);holder=true;try{await callback({});}finally{holder=false;}}}});
});
afterEach(async()=>{
 for(const session of sessions)session.dispose();sessions.length=0;await Promise.resolve();holder=false;vi.unstubAllGlobals();
 await new Promise<void>(resolve=>{const req=indexedDB.deleteDatabase('shanhe-cards-v1');req.onsuccess=()=>resolve();});
});
async function boot(){const session=new GameSession();sessions.push(session);await session.boot();if(!session.getSnapshot().pauses.includes('read_only'))await session.import(JSON.stringify(envelope(createWorld())));return session;}
describe('会话生命周期',()=>{
 it('研究结果隐藏，收藏准备不执行，重建旅程保留独立图鉴和收藏但不继承局内证据',async()=>{
  const s=await boot();await s.import(JSON.stringify(envelope(createChapter('notebook-test'))));s.command({type:'CreateMortal',name:'独行者',origin:'traveller',talent:'steady',acquaintance:false});s.command({type:'Research',operation:'enable',domain:'alchemy'});s.command({type:'Research',operation:'gather',domain:'alchemy'});s.waitForAction();
  const setup={domain:'alchemy' as const,inputs:[{id:researchDomains.alchemy.base,quantity:1}],step:'steady' as const,intensity:'low' as const};
  const w=s.getSnapshot().world;s.saveCollection({id:'note',name:'草稿',notes:'',tags:[],pinned:false,order:1,version:1,entries:[{ref:'kind',id:'xp.herb',name:'青叶草',quantity:1}],setup,journey:w.worldId,history:[]});s.prepareCollection('note');expect(s.getSnapshot().world).toEqual(w);expect(s.getSnapshot().prepared).toEqual(['xp.herb']);
  s.command({type:'Research',operation:'experiment',domain:'alchemy',setup});expect(s.getSnapshot().world.research?.rules).toEqual({});expect(s.getSnapshot().world.research?.action?.outcome).toBe('');const running=JSON.parse(s.export()).world;expect(running.research.action.outcome).toBe('xp.salve');s.waitForAction();await s.save();
  const repository=new SaveRepository();expect((await repository.loadNotebook()).fixed).toContain('alchemy');repository.close();await s.reset();expect(s.getSnapshot().notebook.collections).toHaveLength(1);expect(s.getSnapshot().notebook.archive).toHaveLength(1);expect(s.getSnapshot().world.research).toBeUndefined();expect(s.getSnapshot().prepared).toEqual([]);expect(s.getSnapshot().world.mortal.assets['xp.herb']).toBeUndefined();
  await s.importNotebook(s.exportNotebook());expect(s.getSnapshot().notebook.collections).toHaveLength(2);expect(new Set(s.getSnapshot().notebook.collections.map(c=>c.id)).size).toBe(2);await s.save();
 });
 it('旧存档的已完成经历不重复变成待收取，运行经历仍保持占用',async()=>{
  const s=await boot();s.start('action.duet',s.recipe('action.duet')!);s.waitForAction();const old=JSON.parse(s.export());delete old.ui.tabletop;await s.import(JSON.stringify(old));expect(s.getSnapshot().tabletop.collected).toContain('project.1');expect(s.getSnapshot().world.entities[PLAYER].skills['skill.music']).toBe(14);await s.save();
 });
 it('连续桌面保存只改变UI，最后一次布局与世界一同写入',async()=>{
  const s=await boot(),before=structuredClone(s.getSnapshot().world);for(let i=0;i<8;i++)s.updateTabletop({...freshTabletop(),positions:{[PLAYER]:{x:100+i,y:200}},camera:{x:20,y:30,zoom:.8}});await s.save();expect(s.getSnapshot().world).toEqual(before);const exported=JSON.parse(s.export());expect(exported.ui.tabletop.positions[PLAYER].x).toBe(107);const r=new SaveRepository();expect((await r.load()).save?.ui.tabletop).toEqual(exported.ui.tabletop);r.close();
 });
 it('后台暂停后恢复可见仍暂停，手动继续才推进',async()=>{
  const s=await boot();s.togglePause();s.advance(10);expect(s.getSnapshot().world.tick).toBe(10);
  s.hidden();s.advance(100);expect(s.getSnapshot().world.tick).toBe(10);expect(s.getSnapshot().pauses).toContain('hidden');
  s.togglePause();s.advance(10);expect(s.getSnapshot().world.tick).toBe(20);await s.save();
 });
 it('关闭用户暂停不能解除事件暂停',async()=>{
  const s=await boot(),w=createWorld();w.events['event.test']={id:'event.test',kind:'health',title:'test',text:'test',createdTick:0,expiresTick:720,settled:false,choice:null,major:true};
  await s.import(JSON.stringify(envelope(w)));s.togglePause();s.advance(100);expect(s.getSnapshot().world.tick).toBe(0);expect(s.getSnapshot().pauses).toContain('event');
  s.command({type:'ChooseEventOption',eventId:'event.test',option:'later'});expect(s.getSnapshot().pauses).not.toContain('event');await s.save();
 });
 it('只读投影不暴露未知事实和随机抽样',async()=>{
  const s=await boot();expect(s.getSnapshot().world.facts).toEqual({});expect(s.getSnapshot().world.rolls).toEqual({});expect(JSON.parse(s.export()).world.facts['fact.mountain']).toBeTruthy();
 });
 it('第二个会话无写权限，不能用开始行动解除只读',async()=>{
  const a=await boot(),b=await boot();expect(b.getSnapshot().pauses).toContain('read_only');expect(b.command({type:'StartAction',actionId:'action.rest',bindings:{actor:PLAYER}}).ok).toBe(false);b.togglePause();b.advance(100);expect(b.getSnapshot().world.tick).toBe(0);await a.save();
 });
 it('导入失败不部分替换当前世界',async()=>{
  const s=await boot();const before=s.export();await expect(s.import('{"saveSchemaVersion":999}')).rejects.toThrow();expect(s.export()).toContain('"money": 24');expect(JSON.parse(s.export()).world).toEqual(JSON.parse(before).world);
 });
 it('真实写入故障会暂停，重试成功后仍保留用户暂停',async()=>{
  const s=await boot();const spy=vi.spyOn(SaveRepository.prototype,'save').mockRejectedValueOnce(new Error('QuotaExceededError'));
  await s.save();expect(s.getSnapshot().saveStatus).toContain('失败');expect(s.getSnapshot().pauses).toContain('save_error');
  spy.mockRestore();await s.save();expect(s.getSnapshot().pauses).not.toContain('save_error');expect(s.getSnapshot().pauses).toContain('user');
 });
});
