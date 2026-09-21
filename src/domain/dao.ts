import type { Entity } from './model';
export function displayDao(e:Entity){return Object.values(e.professions).reduce((a,b)=>a+b,0);}
function valid(d:number){if(!Number.isSafeInteger(d)||d<0||d>1000000)throw new Error('道行参数越界');}
export function specialProbability(d:number,base=800000,floor=20000,strength=20){valid(d);if(!(floor>=0&&floor<=base&&base<=1000000&&strength>0&&strength<=1000000))throw new Error('特殊效果参数无效');return floor+Math.floor((base-floor)*strength/(strength+d));}
export function omenProbability(d:number,base=100000,cap=700000,scale=20){valid(d);if(!(base>=0&&base<=cap&&cap<1000000&&scale>0&&scale<=1000000))throw new Error('预感参数无效');return base+Math.floor((cap-base)*d/(scale+d));}
export const probabilityForSpecialEffect=(e:Entity)=>specialProbability(displayDao(e));
export const probabilityForOmen=(e:Entity)=>omenProbability(displayDao(e));