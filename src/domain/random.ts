import { sha256 } from '@noble/hashes/sha2.js';
import type { World } from './model';
export const checksum=(s:string)=>Array.from(sha256(new TextEncoder().encode(s)),b=>b.toString(16).padStart(2,'0')).join('');
// keyed-v1: UTF-8 JSON [seed, semantic-key, rejection-index]; first uint32, big endian.
export function samplePpm(seed:string,key:string){
 for(let retry=0;retry<100;retry++){
  const bytes=sha256(new TextEncoder().encode(JSON.stringify([seed,key,retry])));
  const value=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,false);
  if(value<4294000000)return value%1000000;
 } throw new Error('随机拒绝采样超限');
}
export function roll(w:World,kind:'omen'|'special_effect',occurrence:string,subject:string,effect:string,probability:number,attempt=0){
 const key=JSON.stringify([w.worldId,w.randomVersion,kind,occurrence,subject,effect,attempt]);
 if(w.rolls[key])return w.rolls[key];
 const sample=samplePpm(w.seed,key);
 return w.rolls[key]={key,kind,occurrenceId:occurrence,subjectId:subject,probabilityPpm:probability,sampledPpm:sample,succeeded:sample<probability,tick:w.tick};
}