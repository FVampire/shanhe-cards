import { freshTabletop,TabletopSchema,type TabletopState,type UiSaveState } from './ui-state';
import { createWorld,hasFact } from '../domain/world';
import { dispatch,advanceWorld } from '../domain/engine';
import { matchActions,suggestedBindings } from '../domain/actions';
import { PLAYER,type World,type Command,type Result } from '../domain/model';
import { content } from '../content';
import { SaveRepository,envelope,parseSave } from '../infrastructure/save';
type Pause='user'|'hidden'|'event'|'save_error'|'read_only'|'system_error';
export type Snapshot={world:World;pauses:Pause[];speed:number;saveStatus:string;ready:boolean;notice:string;tabletop:TabletopState};
export class GameSession{
 private world=createWorld();private listeners=new Set<()=>void>();private pauses=new Set<Pause>(['user']);private speed=1;
 private repository=new SaveRepository();private pending:{world:World;ui:UiSaveState}|null=null;private writing:Promise<void>|null=null;private releaseLock:(()=>void)|null=null;
 private tabletop=freshTabletop();
 private snapshot!:Snapshot;private ready=false;private saveStatus='正在读取存档';private notice='';private writable=false;private started=false;
 constructor(){this.publish();}
 getSnapshot=()=>this.snapshot;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(){
  const known=new Set(this.world.knowledge.filter(k=>k.observerId===PLAYER).map(k=>k.factId));
  const visible={...this.world,facts:Object.fromEntries(Object.entries(this.world.facts).filter(([id])=>known.has(id))),rolls:{},knowledge:this.world.knowledge.filter(k=>k.observerId===PLAYER)};
  this.snapshot={world:visible,pauses:[...this.pauses],speed:this.speed,saveStatus:this.saveStatus,ready:this.ready,notice:this.notice,tabletop:this.tabletop};this.listeners.forEach(l=>l());
 }
 async boot(){
  if(this.started)return;this.started=true;
  try{
   if(navigator.locks){
    await new Promise<void>(resolve=>{
     void navigator.locks.request('shanhe-cards-main-writer',{ifAvailable:true},async lock=>{
      if(!lock){this.pauses.add('read_only');resolve();return;}
      this.writable=true;resolve();await new Promise<void>(done=>{this.releaseLock=done;});
     }).catch(()=>{this.pauses.add('read_only');resolve();});
    });
   }else this.pauses.add('read_only');
   const result=await this.repository.load();
   if(result.save){this.world=result.save.world;this.tabletop=result.save.ui.tabletop??{...freshTabletop(),collected:Object.values(this.world.projects).filter(p=>p.state!=='running').map(p=>p.id)};}
   this.saveStatus=this.writable?(result.recovered?'已恢复上一份完整快照':result.save?'已读取本地存档':'尚未保存'):'只读模式 · 另一窗口正在游玩或浏览器不支持写锁';
   this.ready=true;this.syncEventPause();this.publish();
   if(this.writable)await this.save();
  }catch(e){this.ready=true;this.failSave(e);this.publish();}
 }
 private syncEventPause(){if(Object.values(this.world.events).some(e=>e.major&&!e.settled))this.pauses.add('event');else this.pauses.delete('event');}
 command(c:Command):Result{
  if(!this.ready||!this.writable)return{ok:false,code:'PERMISSION_DENIED',message:'当前存档为只读，请在最初打开的窗口操作。'};
  if(this.pauses.has('system_error'))return{ok:false,code:'SYSTEM_ERROR',message:'规则运行异常，请导出存档后重新载入。'};
  const result=dispatch(this.world,{commandId:crypto.randomUUID(),expectedRevision:this.world.revision,actorId:PLAYER,payload:c});
  this.world=result.world;
  if(result.result.ok){this.notice='';this.syncEventPause();void this.save();}
  else {this.notice=result.result.message;if(result.result.code==='SYSTEM_ERROR')this.pauses.add('system_error');}
  this.publish();return result.result;
 }
 preview(ids:string[]){return matchActions(this.world,ids);}
 recipe(id:string){const a=content.actions.find(a=>a.id===id);return a?suggestedBindings(this.world,a):null;}
 setSpeed(speed:number){if([1,3,6].includes(speed)){this.speed=speed;this.publish();}}
 togglePause(){
  if(!document.hidden){if(this.pauses.has('user')||this.pauses.has('hidden')){this.pauses.delete('user');this.pauses.delete('hidden');}else this.pauses.add('user');}
  this.publish();
 }
 hidden(){this.pauses.add('hidden');this.pauses.add('user');this.publish();void this.save();}
 advance(minutes:number){
  if(!this.ready||this.pauses.size||!this.writable||this.world.mortal.mode==='chapter'&&!this.world.mortal.created)return;
  try{
   const previousReceipts=Object.keys(this.world.receipts).length;
   this.world=advanceWorld(this.world,this.world.tick+minutes);this.syncEventPause();this.publish();
   if(previousReceipts!==Object.keys(this.world.receipts).length||this.world.tick%60===0||this.pauses.has('event')||Object.values(this.world.projects).some(p=>p.state==='completed'&&p.dueTick===this.world.tick))void this.save();
  }catch(e){this.notice='结算已暂停：'+(e as Error).message;this.pauses.add('system_error');this.publish();}
 }
 waitForAction(){
  if(!this.writable||['event','save_error','hidden','read_only','system_error'].some(p=>this.pauses.has(p as Pause)))return;
  const next=Math.min(...Object.values(this.world.projects).filter(p=>p.state==='running').map(p=>p.dueTick),...(this.world.mortal.task?[this.world.mortal.task.dueTick]:[]),this.world.mortal.mode==='chapter'&&this.world.mortal.task?this.world.mortal.task.dueTick:this.world.tick+180);
  this.pauses.delete('user');this.advance(next-this.world.tick);this.pauses.add('user');this.publish();
 }
 startStack(verb:import('../domain/mortal-model').StackVerb,bindings:Record<string,string>){const result=this.command({type:'MortalStack',verb,bindings});if(result.ok&&!document.hidden){this.pauses.delete('user');this.publish();}return result;}
 start(actionId:string,bindings:Record<string,string>){
  const result=this.command({type:'StartAction',actionId,bindings});
  if(result.ok&&!document.hidden){this.pauses.delete('user');this.publish();}return result;
 }
 updateTabletop(next:TabletopState){this.tabletop=TabletopSchema.parse(next);this.publish();void this.save();}
 clearNotice(){this.notice='';this.publish();}
 private failSave(error:unknown){this.saveStatus='保存失败 · 请导出备份或重试';this.notice=(error as Error).message;this.pauses.add('save_error');}
 async save(){
  if(!this.writable||!this.ready)return;
  this.pending={world:structuredClone(this.world),ui:{tab:'board',tabletop:structuredClone(this.tabletop)}};
  if(this.writing)return this.writing;
  this.writing=(async()=>{
   while(this.pending){
    const next=this.pending;this.pending=null;this.saveStatus='保存中…';this.publish();
    try{await this.repository.save(next.world,next.ui);this.saveStatus='已保存到本机';this.pauses.delete('save_error');}
    catch(e){this.pending=null;this.failSave(e);break;}
    this.publish();
   }
  })().finally(()=>{this.writing=null;this.publish();});
  return this.writing;
 }
 export(){return JSON.stringify(envelope(this.world,this.repository.sequence,{tab:'board',tabletop:this.tabletop}),null,2);}
 async import(text:string){
  if(!this.writable)throw new Error('当前窗口没有存档写入权限');
  if(text.length>8*1024*1024)throw new Error('存档超过 8 MB 限制');
  const candidate=parseSave(JSON.parse(text));await this.writing;
  await this.repository.save(candidate.world,candidate.ui);this.world=candidate.world;this.tabletop=candidate.ui.tabletop??{...freshTabletop(),collected:Object.values(this.world.projects).filter(p=>p.state!=='running').map(p=>p.id)};this.pauses=new Set(['user']);this.notice='存档已载入，时间保持暂停。';this.syncEventPause();this.publish();
 }
 async recover(){
  const list=await this.repository.backups();const sorted=list.sort((a,b)=>b.sequence-a.sequence);
  for(const s of sorted){try{await this.import(JSON.stringify(s.envelope));return;}catch{/* continue */}}
  throw new Error('没有可恢复的有效备份');
 }
 async reset(){await this.import(JSON.stringify(envelope(createWorld('shanhe-'+crypto.randomUUID()))));}
 milestone(){return hasFact(this.world,'performed');}
 dispose(){this.releaseLock?.();this.repository.close();}
}
export const session=new GameSession();