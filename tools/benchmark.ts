import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { cpus,platform,release } from 'node:os';
import { createLegacyWorld as createWorld,assertWorld } from '../src/domain/world';
import { advanceWorld } from '../src/domain/engine';
import { envelope } from '../src/infrastructure/save';
import { PLAYER,type World } from '../src/domain/model';
const w=createWorld('benchmark');
for(let i=0;i<196;i++){const e=structuredClone(w.entities[PLAYER]);e.id='character.bench.'+i;e.ownerId=e.id;w.entities[e.id]=e;}
for(let i=0;i<1992;i++){const e=structuredClone(w.entities['instance.herbs']);e.id='item.bench.'+i;w.entities[e.id]=e;}
for(let i=0;i<100;i++){
 const actor='character.bench.'+i;
 for(const kind of ['qin','score']){const e=structuredClone(w.entities['instance.'+kind]);e.id=kind+'.bench.'+i;e.containerId=actor;e.ownerId=actor;w.entities[e.id]=e;}
 const id='project.bench.'+i;
 w.projects[id]={id,definitionId:'action.practice',boundSlots:{actor,instrument:'qin.bench.'+i,score:'score.bench.'+i},state:'running',startedTick:0,dueTick:90,generation:0,spent:[],delegated:false,receipt:null};
 for(const [slot,resourceId]of Object.entries(w.projects[id].boundSlots)){const key=id+'/'+slot;w.reservations[key]={id:key,projectId:id,resourceId,quantity:1,mode:'exclusive'};}
 w.schedule.push({id:id+'/0',sourceId:id,generation:0,dueTick:90,phase:10});
}
assertWorld(w);
const measure=(f:()=>unknown)=>{const start=performance.now();const result=f();return {ms:Number((performance.now()-start).toFixed(2)),result};};
const tick=measure(()=>advanceWorld(w,90));
const save=measure(()=>JSON.stringify(envelope(tick.result as World)));
const report={date:new Date().toISOString(),device:{os:platform()+' '+release(),cpu:cpus()[0]?.model},characters:Object.values(w.entities).filter(e=>e.kind==='character').length,items:Object.values(w.entities).filter(e=>e.kind==='item').length,projects:100,advance90MinutesMs:tick.ms,serializeAndChecksumMs:save.ms,snapshotBytes:Buffer.byteLength(save.result as string),scope:'单次 Node.js 规则压力测量，不代表浏览器 60fps、150 张卡片交互或 4ms 预算达标。'};
writeFileSync('docs/性能测量.json',JSON.stringify(report,null,2));console.log(report);