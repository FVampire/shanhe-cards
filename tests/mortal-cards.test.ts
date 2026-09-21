import {describe,it,expect} from 'vitest';
import {createWorld,assertWorld} from '../src/domain/world';
import {dispatch,advanceWorld} from '../src/domain/engine';
import {PLAYER,type World,type Command} from '../src/domain/model';
import {mortalDeck,resolveMortalStack,lockedMortalCards,stageVerb,focusId} from '../src/domain/mortal-cards';
import {previewMortal} from '../src/domain/mortal';
import {stackPreview} from '../src/presentation/mortal-tabletop';
import {envelope,parseSave} from '../src/infrastructure/save';
import {chains} from '../src/content/mortal';
import type {StackVerb} from '../src/domain/mortal-model';
let seq=0;
function cmd(w:World,payload:Command){const r=dispatch(w,{actorId:PLAYER,expectedRevision:w.revision,commandId:'cards.'+(++seq),payload});if(!r.result.ok)throw Error(r.result.message);assertWorld(r.world);return r.world;}
const fresh=()=>cmd(createWorld('cards'),{type:'CreateMortal',name:'禾',origin:'traveller',talent:'steady',acquaintance:false});
function start(w:World,verb:StackVerb,focus?:string,supplement?:string){return cmd(w,{type:'MortalStack',verb,bindings:{actor:PLAYER,...(focus?{focus}:{}),...(supplement?{supplement}:{})}});}
function run(w:World,verb:StackVerb,focus?:string,supplement?:string){w=start(w,verb,focus,supplement);const id=w.mortal.task!.id;w=advanceWorld(w,w.mortal.task!.dueTick);assertWorld(w);return cmd(w,{type:'MortalCollect',runId:id});}
const travel=(w:World,to:string)=>w.entities[PLAYER].location===to?w:run(w,'travel',to);
function rest(w:World){w=travel(w,'location.inn');if(w.mortal.paidUntil<w.tick+1440)w=run(w,'talk','location.inn');return run(w,'cultivate');}
function chain(w:World,id:string){const c=chains.find(x=>x.id===id)!;while((w.mortal.stages[id]??0)<c.stages.length){if(w.entities[PLAYER].fatigue>=60)w=rest(w);w=travel(w,c.location);const i=w.mortal.stages[id]??0;w=run(w,stageVerb(id,i),focusId(id,i));}return w;}
describe('凡尘卡牌组合与收取',()=>{
 it('集市租好铺位即可休息：计入返程，完成后在客舍，不重复收租',()=>{let w=fresh();w=run(w,'travel','thread.CH01.0');w=run(w,'talk','thread.CH01.1');expect(w.entities[PLAYER].location).toBe('location.market');w.entities[PLAYER].fatigue=80;const money=w.money,tick=w.tick;const pre=previewMortal(w,'rest');expect(pre.errors).toEqual([]);expect(pre.minutes).toBe(380);w=run(w,'cultivate','shelter.bed');expect(w.tick-tick).toBe(380);expect(w.entities[PLAYER].location).toBe('location.inn');expect(w.entities[PLAYER].fatigue).toBe(27);expect(w.money).toBe(money);expect(previewMortal(w,'rest').minutes).toBe(360);});
 it('返程休息取消不瞬移，铺位不足以覆盖全程时拒绝开始',()=>{let w=fresh();w=run(w,'travel','thread.CH01.0');w=run(w,'talk','thread.CH01.1');const fatigue=w.entities[PLAYER].fatigue;w=start(w,'cultivate','shelter.bed');w=cmd(w,{type:'CancelMortal'});expect(w.entities[PLAYER].location).toBe('location.market');expect(w.entities[PLAYER].fatigue).toBe(fatigue);w.mortal.paidUntil=w.tick+365;expect(previewMortal(w,'rest').errors.join('')).toContain('返程和休息');w.entities[PLAYER].location='location.mountain';w.mortal.paidUntil=w.tick+1440;expect(previewMortal(w,'rest').minutes).toBe(540);});

 it('预览不改变世界；同一告示放入不同动词产生不同做法',()=>{const w=fresh(),before=structuredClone(w),b={actor:PLAYER,focus:'thread.CH01.0'};expect(resolveMortalStack(w,'travel',b)?.choice).toBe('notice');expect(resolveMortalStack(w,'talk',b)).toBeNull();const opened=run(w,'travel','thread.CH01.0');expect(resolveMortalStack(opened,'talk',{actor:PLAYER,focus:'thread.CH01.1'})?.choice).toBe('rent');expect(resolveMortalStack(opened,'work',{actor:PLAYER,focus:'thread.CH01.1'})?.choice).toBe('relief');expect(stackPreview(w,'travel',b)?.errors).toEqual([]);mortalDeck(w);expect(w).toEqual(before);expect(resolveMortalStack(w,'create',b)).toBeNull();expect(resolveMortalStack(w,'travel',{actor:PLAYER,focus:PLAYER})).toBeNull();});
 it('投入被占用，结果跨存档保留，收取不重复支付',()=>{let w=start(fresh(),'travel','thread.CH01.0');const id=w.mortal.task!.id;expect(lockedMortalCards(w).has(PLAYER)).toBe(true);w=advanceWorld(w,w.mortal.task!.dueTick);expect(w.mortal.cardRuns![id].outputs.some(c=>c.id==='thread.CH01.1')).toBe(true);w=parseSave(envelope(w)).world;expect(lockedMortalCards(w).has(PLAYER)).toBe(true);expect(()=>start(w,'talk','thread.CH01.1')).toThrow('占用');const money=w.money;w=cmd(w,{type:'MortalCollect',runId:id});w=cmd(w,{type:'MortalCollect',runId:id});expect(w.money).toBe(money);expect(lockedMortalCards(w).has(PLAYER)).toBe(false);});
 it('取消解除卡牌占用，不付款，不推进阶段',()=>{let w=fresh();w=run(w,'travel','thread.CH01.0');w=start(w,'work','thread.CH01.1');const id=w.mortal.task!.id;w=cmd(w,{type:'CancelMortal'});expect(w.money).toBe(24);expect(w.mortal.stages.CH01).toBe(1);expect(w.mortal.cardRuns![id].state).toBe('cancelled');expect(lockedMortalCards(w).size).toBe(0);});
 for(const route of ['CH02','CH04','CH05','CH06'])it(route+' 全程以卡牌完成生计、求法与初次应用',()=>{let w=chain(fresh(),'CH01');w=chain(w,route);expect(w.works.length).toBe(1);w=chain(w,'CH09');w=chain(w,'CH10');w=run(w,'study','MT01');w=rest(w);w=run(w,'study','MT01');w=run(w,'study','MT01');w=run(w,'cultivate','MT01');w=run(w,'cultivate','MT01','public.manual');w=run(w,'cultivate','MT01');if(w.entities[PLAYER].fatigue>50)w=rest(w);w=run(w,'cultivate','MT01');w=run(w,'cultivate','MT01','location.inn');expect(w.mortal.completed).toBe(true);expect(w.entities[PLAYER].longevityDays).toBe(0);expect(parseSave(envelope(w)).world).toEqual(w);});
});

