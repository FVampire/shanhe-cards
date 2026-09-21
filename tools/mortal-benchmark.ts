import {writeFileSync} from 'node:fs';
import {cpus,totalmem,platform,release} from 'node:os';
import {performance} from 'node:perf_hooks';
import {createWorld,assertWorld} from '../src/domain/world';
import {meetRole,releasePerson} from '../src/domain/mortal';
import {envelope,parseSave} from '../src/infrastructure/save';
const timings=(fn:()=>unknown)=>{const values:number[]=[];for(let i=0;i<8;i++){const start=performance.now();fn();values.push(performance.now()-start);}values.sort((a,b)=>a-b);return {p50Ms:+values[3].toFixed(2),p95Ms:+values[7].toFixed(2)};};
const results=[];
for(const [runtime,summary,archive]of [[24,120,1000],[32,120,10000]]){
 const w=createWorld('benchmark'),p=meetRole(w,'R03','fixture');releasePerson(w,p.id);w.mortal.people={};w.mortal.encounters={};
 for(let i=0;i<runtime+summary+archive;i++){
  const person=structuredClone(p);person.id='bench.'+i;person.name='药工'+i;person.simulationTier=i<runtime?'L2':i<runtime+summary?'L1':'A';w.mortal.people[person.id]=person;
 }
 assertWorld(w);const e=envelope(w),bytes=Buffer.byteLength(JSON.stringify(e));
 results.push({runtime,summary,archive,bytes,importLimitBytes:8*1024*1024,withinImportLimit:bytes<8*1024*1024,contactQuery:timings(()=>Object.values(w.mortal.people).filter(p=>p.name.includes('99'))),saveEnvelope:timings(()=>envelope(w)),validateAndLoad:timings(()=>parseSave(e))});
}
const report={measuredAt:new Date().toISOString(),hardware:{cpu:cpus()[0].model,logicalCpus:cpus().length,memoryGB:Math.round(totalmem()/1024**3),os:platform()+' '+release()},scope:'Node 本地身份查询、存档序列化与完整校验；不是浏览器最慢帧或人工游玩时长',results};
writeFileSync('docs/凡尘篇/性能测量.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
