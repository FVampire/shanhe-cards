import { PLAYER,type Entity,type World } from './model';
import { hasFact } from './world';
export type PersonSituation={id:string;name:string;status:string;detail:string};
export function characterFlavor(e:Entity,w:World):{subtitle:string;description:string}{
 if(e.id===PLAYER)return{subtitle:'此身 · '+Math.floor(e.ageMinutes/525600)+' 岁',description:e.description};
 if(e.id==='character.teacher'){
  const rel=w.relations[PLAYER+'/character.teacher']??0;
  const subtitle=!e.active?'已赴下游':!e.willing?'暂不愿合奏':'友人 · 信任 '+rel;
  const secret=w.insights.some(i=>i.id==='insight.teacher_wrist')?' 你已知他腕力不如从前，两次合奏是体贴。':'';
  return{subtitle,description:e.description+secret};
 }
 if(e.id==='character.physician'){
  const subtitle=!e.active?'已离书院':hasFact(w,'physician_stayed')||hasFact(w,'learned_breath')?'云游医师 · 愿再停一停':'云游医师 · 行囊已备';
  const secret=w.insights.some(i=>i.id==='insight.physician_search')?' 她在寻一味能稳住岁月的方。':'';
  return{subtitle,description:e.description+secret};
 }
 if(e.id==='character.worker'){
  const subtitle=!e.willing?'心里有话未说':hasFact(w,'worker_helped')?'药园学徒 · 你应过她':'药园学徒';
  return{subtitle,description:e.description};
 }
 return{subtitle:e.kind==='character'?'友人与同道':e.quantity>1?'物资 · '+e.quantity+' 份':e.kind==='facility'?'此地设施':'随身器物',description:e.description};
}
export function peopleSituations(w:World):PersonSituation[]{
 const teacher=w.entities['character.teacher'],physician=w.entities['character.physician'],worker=w.entities['character.worker'];
 const rel=w.relations[PLAYER+'/character.teacher']??0;
 return [
  {id:teacher.id,name:teacher.name,status:!teacher.active?'已赴下游教习':!teacher.willing?'此刻不愿再坐':'仍在听雨亭 · 信任 '+rel+' · 合奏许可 '+w.consents.duet.uses+' 次',detail:w.insights.some(i=>i.id==='insight.teacher_wrist')?'腕力不如从前。两次是体贴，不是吝啬。':teacher.description},
  {id:physician.id,name:physician.name,status:!physician.active?'已云游离去':hasFact(w,'learned_breath')||hasFact(w,'physician_stayed')?'仍在书院，愿再停一停':'仍在书院，行囊已搁在廊下',detail:w.insights.some(i=>i.id==='insight.physician_search')?'她路过青溪，是为寻一味能稳住岁月的方。':physician.description},
  {id:worker.id,name:worker.name,status:!worker.willing?'心里有话':w.organization.authorized?(hasFact(w,'worker_helped')?'职事里，你应过亲自采一轮':'药园职事里的学徒'):'药园学徒，尚未与你共事',detail:worker.description}
 ];
}
export const insightTitle=(id:string,question:string)=>id==='insight.listening'?'听见他人的停顿':id==='insight.teacher_wrist'?'两次是体贴':id==='insight.physician_search'?'她为何云游':question.slice(0,10);
