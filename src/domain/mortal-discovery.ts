import type {World} from './model';
import {PLAYER} from './model';
import type {StackVerb} from './mortal-model';
import {places} from '../content/mortal';
export const allVerbs:StackVerb[]=['study','talk','create','work','cultivate','travel'];
export const verbNames:Record<StackVerb,string>={study:'研习',talk:'交游',create:'创作',work:'谋生',cultivate:'修养',travel:'行游'};
// Absence means a save from before discovery was introduced: retain its available tools.
export const knownVerbs=(w:World):StackVerb[]=>w.mortal.created?(w.mortal.discoveries?.verbs??allVerbs):[];
export const knownPlaces=(w:World):string[]=>w.mortal.discoveries?.places??places.map(p=>p.id);
export function discoverFromExperience(w:World):StackVerb[]{
 const m=w.mortal,d=m.discoveries;if(!d)return [];
 const before=new Set(d.verbs),here=w.entities[PLAYER].location!,stage=(id:string)=>m.stages[id]??0;
 const verb=(v:StackVerb)=>{if(!d.verbs.includes(v))d.verbs.push(v);};
 const place=(id:string)=>{if(!d.places.includes(id))d.places.push(id);};
 place(here);
 if(stage('CH01')>=1){verb('talk');verb('work');place('location.inn');}
 if(m.paidUntil>0||w.entities[PLAYER].fatigue>=40)verb('cultivate');
 if(stage('CH01')>=3)for(const id of ['pharmacy','workshop','pavilion','study'])place('location.'+id);
 if(['location.pharmacy','location.workshop','location.study'].includes(here))verb('study');
 if(here==='location.pharmacy')place('location.garden');
 if(here==='location.pavilion')place('location.teahouse');
 if(here==='location.study')place('location.mountain');
 if(stage('CH09')>=3)place('location.temple');
 if(stage('CH02')>=1||stage('CH04')>=1||stage('CH05')>=2||stage('CH06')>=2)verb('create');
 return d.verbs.filter(v=>!before.has(v));
}
