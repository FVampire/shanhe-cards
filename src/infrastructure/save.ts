import {NotebookSchema,freshNotebook,type Notebook} from '../domain/research-model';
import {researchDomains,researchItems,researchVariants} from '../content/research';
import {freshMortal} from '../domain/mortal-model';
import {mortalContent} from '../content/mortal';
import { UiSaveSchema,type UiSaveState } from '../application/ui-state';
import { z } from 'zod';
import { WorldSchema,int,type World } from '../domain/model';
import { assertWorld } from '../domain/world';
import { checksum } from '../domain/random';
import { content } from '../content';
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const CONTENT_HASH=checksum(JSON.stringify({content,mortalContent,researchDomains,researchItems,researchVariants}));
const EnvelopeSchema=z.object({saveSchemaVersion:z.literal(2),rulesVersion:z.literal('2.0.0'),contentVersion:z.literal('0.2.0'),contentHash:z.string(),randomVersion:z.literal('keyed-v1'),slotId:z.string(),saveSequence:int,worldRevision:int,createdAtUtc:z.string(),payloadChecksum:z.string(),world:WorldSchema,ui:UiSaveSchema}).strict();
export type SaveEnvelope=z.infer<typeof EnvelopeSchema>;
export function envelope(world:World,seq=0,ui:UiSaveState={tab:'board'}):SaveEnvelope{return {saveSchemaVersion:2,rulesVersion:'2.0.0',contentVersion:'0.2.0',contentHash:CONTENT_HASH,randomVersion:'keyed-v1',slotId:'main',saveSequence:seq,worldRevision:world.revision,createdAtUtc:new Date().toISOString(),payloadChecksum:checksum(canonical(world)),world:structuredClone(world),ui:structuredClone(ui)};}
export function parseSave(raw:unknown){
 let input=raw;
 if(raw&&typeof raw==='object'&&'saveSchemaVersion' in raw&&raw.saveSchemaVersion===1){
  const old=z.object({saveSchemaVersion:z.literal(1),rulesVersion:z.literal('1.0.0'),contentVersion:z.literal('0.1.0'),contentHash:z.literal('73eec9433990df2aef85c33ee606024d8940ae7e04aeb7acc1344594b98ced48'),randomVersion:z.literal('keyed-v1'),world:z.record(z.string(),z.unknown()),payloadChecksum:z.string(),worldRevision:int,saveSequence:int,ui:UiSaveSchema}).passthrough().parse(raw);
  if(old.payloadChecksum!==checksum(canonical(old.world)))throw new Error('旧档校验失败，原档保留');
  if(old.worldRevision!==old.world.revision||old.world.rulesVersion!=='1.0.0'||old.world.contentVersion!=='0.1.0')throw new Error('旧档版本不一致');
  const world=WorldSchema.parse({...old.world,rulesVersion:'2.0.0',contentVersion:'0.2.0',mortal:freshMortal('legacy')});
  input=envelope(world,old.saveSequence,old.ui);
 }
 const e=EnvelopeSchema.parse(input);
 if(e.contentHash!==CONTENT_HASH)throw new Error('内容版本不兼容，请开启新旅程；原存档已保留');
 if(e.payloadChecksum!==checksum(canonical(e.world)))throw new Error('存档校验失败，文件可能已经损坏');
 if(e.worldRevision!==e.world.revision)throw new Error('存档版本号不一致');
 assertWorld(e.world);return e;
}
const req=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
export class SaveRepository{
 private db:IDBDatabase|null=null;
 sequence=0;
 async open(){
  if(this.db)return this.db;
  const request=indexedDB.open('shanhe-cards-v1',1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('slots',{keyPath:'id'});request.result.createObjectStore('snapshots',{keyPath:'id'});};
  this.db=await req(request);return this.db;
 }
 async load(){
  const db=await this.open();const tx=db.transaction(['slots','snapshots'],'readonly');
  const head=await req(tx.objectStore('slots').get('main'));this.sequence=head?.sequence??0;
  if(!head)return {save:null,recovered:false};
  const snapshots=await req(db.transaction('snapshots','readonly').objectStore('snapshots').getAll());
  const ordered=snapshots.filter(s=>s.sequence<=this.sequence).sort((a,b)=>b.sequence-a.sequence);
  for(const snapshot of ordered){try{return {save:parseSave(snapshot.envelope),recovered:snapshot.sequence!==this.sequence};}catch{/* Try retained consistent snapshot. */}}
  throw new Error('所有本地快照均无法读取。请导入备份，当前数据未被覆盖。');
 }
 async loadNotebook(){const db=await this.open();const row=await req(db.transaction('slots','readonly').objectStore('slots').get('notebook'));return row?NotebookSchema.parse(row.value):freshNotebook();}
 async save(world:World,ui:UiSaveState={tab:'board'},notebook?:Notebook){
  const db=await this.open();const next=this.sequence+1;const e=envelope(world,next,ui);parseSave(e);
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(['slots','snapshots'],'readwrite');let failure:Error|null=null;
   const slots=tx.objectStore('slots');const snapshots=tx.objectStore('snapshots');const head=slots.get('main');
   head.onsuccess=()=>{
    if((head.result?.sequence??0)!==this.sequence){failure=new Error('存档已被另一个会话更新，已停止写入。');tx.abort();return;}
    if(notebook)slots.put({id:'notebook',value:NotebookSchema.parse(notebook)});
    snapshots.put({id:'main/'+next,sequence:next,envelope:e});slots.put({id:'main',sequence:next,revision:world.revision});
    const old=snapshots.openCursor();old.onsuccess=()=>{const cursor=old.result;if(cursor){if(cursor.value.sequence<next-4&&cursor.value.envelope.saveSchemaVersion!==1)cursor.delete();cursor.continue();}};
   };
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??new Error('存档写入被中止'));tx.onerror=()=>{failure=tx.error;};
  });this.sequence=next;return e;
 }
 async backups(){const db=await this.open();return req(db.transaction('snapshots','readonly').objectStore('snapshots').getAll());}
 close(){this.db?.close();this.db=null;}
}