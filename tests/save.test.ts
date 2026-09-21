import 'fake-indexeddb/auto';
import { afterEach,describe,it,expect } from 'vitest';
import { SaveRepository,envelope,parseSave } from '../src/infrastructure/save';
import { createLegacyWorld as createWorld } from '../src/domain/world';
import { dispatch,advanceWorld } from '../src/domain/engine';
import { suggestedBindings } from '../src/domain/actions';
import { actionById } from '../src/content';
import { PLAYER } from '../src/domain/model';
const repos:SaveRepository[]=[];
const repo=()=>{const r=new SaveRepository();repos.push(r);return r;};
afterEach(async()=>{for(const r of repos)r.close();repos.length=0;await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('shanhe-cards-v1');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});});
describe('一致存档与恢复',()=>{
 it('运行项目往返保存保留剩余时间、所有占用和随机记录',async()=>{
  let w=createWorld();w=dispatch(w,{commandId:'start',expectedRevision:0,actorId:PLAYER,payload:{type:'StartAction',actionId:'action.duet',bindings:suggestedBindings(w,actionById('action.duet'))!}}).world;w=advanceWorld(w,50);
  const r=repo();await r.save(w);const loaded=await r.load();expect(loaded.save?.world).toEqual(w);expect(loaded.save?.world.projects['project.1'].dueTick).toBe(120);
 });
 it('两个存储实例的旧版本不能覆盖新头',async()=>{const a=repo(),b=repo();await a.load();await b.load();await a.save(createWorld());await expect(b.save(createWorld('other'))).rejects.toThrow('另一个');expect((await a.load()).save?.world.seed).toBe('shanhe-autumn-01');});
 it('校验失败不写入，旧快照仍存在',async()=>{const r=repo();const w=createWorld();await r.save(w);const bad=structuredClone(w);bad.money=-2;await expect(r.save(bad)).rejects.toThrow();expect((await r.load()).save?.world.money).toBe(24);});
 it('损坏快照自动退回完整备份且保留旧头序号',async()=>{const r=repo();await r.save(createWorld());const next=createWorld();next.money=30;await r.save(next);const db=await r.open();await new Promise<void>(resolve=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({id:'main/2',sequence:2,envelope:{bad:true}});tx.oncomplete=()=>resolve();});const data=await r.load();expect(data.recovered).toBe(true);expect(data.save?.world.money).toBe(24);expect(r.sequence).toBe(2);await r.save(data.save!.world);expect(r.sequence).toBe(3);});
 it('保留最近五份快照',async()=>{const r=repo();for(let i=0;i<8;i++){const w=createWorld();w.revision=i;await r.save(w);}expect(await r.backups()).toHaveLength(5);});
 it('损坏校验和、不兼容版本或内容均被拒绝',()=>{const e=envelope(createWorld());expect(()=>parseSave({...e,payloadChecksum:'wrong'})).toThrow('校验');expect(()=>parseSave({...e,saveSchemaVersion:0})).toThrow();expect(()=>parseSave({...e,contentHash:'old'})).toThrow('不兼容');expect(e.world.money).toBe(24);});
});
