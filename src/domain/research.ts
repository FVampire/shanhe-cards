import {PLAYER,type World} from './model';
import {requireRule} from './actions';
import {log} from './world';
import {lockedMortalCards} from './mortal-cards';
import {samplePpm} from './random';
import {ResearchSchema,SetupSchema,type Research,type ResearchCommand,type ResearchDomain,type ResearchSetup} from './research-model';
import {researchDomains,researchItems,researchSteps,researchVariants} from '../content/research';

export function createResearch(seed:string,journey:string):Research{
 const rules:Research['rules']={};
 for(const domain of Object.keys(researchDomains) as ResearchDomain[]){const d=researchDomains[domain],variant=samplePpm(seed,'research-world-v1/'+domain)%2;
  const template=researchVariants[variant];rules[domain]={domain,material:d.choices[template.materialIndex],step:template.step,weights:[...template.weights]};}
 return {version:1,journey,seed,rules,counter:0,randomCounter:0,injury:false,evidence:[],records:[],action:null,warning:null,learned:[]};
}
export const setupKey=(s:ResearchSetup)=>JSON.stringify({...s,inputs:[...s.inputs].sort((a,b)=>a.id.localeCompare(b.id))});
export function researchAvailable(w:World,id:string){const a=w.mortal.assets[id];return a&&a.ownerId===PLAYER&&a.status==='available'&&(a.location===w.entities[PLAYER].location||a.location==='carried')?a.quantity:0;}
function give(w:World,id:string,quantity=1){const old=w.mortal.assets[id];w.mortal.assets[id]={instanceId:old?.quantity?old.instanceId:'research-item.'+(++w.research!.counter),id,kind:id==='xp.breath'||id==='xp.flow'||id==='xp.still'?'method':'item',name:researchItems[id],ownerId:PLAYER,source:'青溪试验坊 · '+w.worldId,quantity:(old?.quantity??0)+quantity,location:'carried',status:'available'};}
function use(w:World,id:string,n=1){requireRule(researchAvailable(w,id)>=n,'MISSING_REQUIREMENT','缺少可用的'+(researchItems[id]??id));const a=w.mortal.assets[id];a.quantity-=n;if(!a.quantity)a.status='consumed';}
function free(w:World){requireRule(w.mortal.created,'MISSING_REQUIREMENT','请先创建人物');requireRule(!w.mortal.task&&!w.research?.action&&!lockedMortalCards(w).has(PLAYER)&&!Object.values(w.projects).some(p=>p.state==='running'),'ACTOR_BUSY','此身正在行事或等待收取，请先处理。');requireRule(w.mortal.plan===0,'ACTOR_BUSY','请先停止连续谋生安排。');}
function evidence(w:World,domain:ResearchDomain,status:'rumor'|'explained'|'observed'|'verified',text:string,source:string,setup?:ResearchSetup){const r=w.research!;r.evidence.push({id:'evidence.'+(r.counter++),journey:w.worldId,domain,scope:'journey',status,text,source,tick:w.tick,...(setup?{setup:setupKey(setup)}:{})});}
export function ruleExplanation(r:Research,domain:ResearchDomain,full=false){const d=researchDomains[domain],rule=r.rules[domain];return `${researchItems[d.base]}可配${researchItems[rule.material]}。`+(full?`步骤：${researchSteps[rule.step]}。${domain==='practice'?'低强度可稳定衔接；其它组合高强度运行会出现冲突征兆。':`通常得到${researchItems[d.normal]}（${rule.weights[0]/10000}%）或${researchItems[d.alternate]}（${rule.weights[1]/10000}%）；偏差${researchItems[d.deviation]} ${rule.weights[2]/10000}%，反应未成 ${rule.weights[3]/10000}%。逆炼需要调火炉。`}`:'步骤仍需试行核验。');}
export function researchStructure(w:World,s:ResearchSetup){
 const d=researchDomains[s.domain];if(s.inputs.length<1||s.inputs.length>2||new Set(s.inputs.map(i=>i.id)).size!==s.inputs.length)return '放入一种主材，或主材与一种辅料；每种一份。';
 if(!s.inputs.some(i=>i.id===d.base)||s.inputs.some(i=>i.quantity!==1||![d.base,...d.choices].includes(i.id)))return '这些卡牌尚未构成该领域的操作。';
 if(s.inputs.length===1&&s.step!=='steady')return '单一主材仅能执行基础稳行。';
 if(s.inputs.length===2&&s.step==='steady')return '合炼／两法衔接需要选择缓火或逆炼步骤。';
 if(s.inputs.some(i=>researchAvailable(w,i.id)<i.quantity))return '材料缺少、被占用或不在当前地点。';
 if(s.step==='reverse'&&s.domain!=='practice'&&!researchAvailable(w,'xp.furnace'))return '逆炼需要调火炉；可用青铁执行基础稳行制作。';
 return '';
}
function start(w:World,kind:NonNullable<Research['action']>['kind'],domain:ResearchDomain,setup:ResearchSetup,outcome:string,text:string,cost:number,minutes:number){const r=w.research!;w.money-=cost;r.action={id:'research.'+(++r.counter),kind,domain,setup:structuredClone(setup),startedTick:w.tick,dueTick:w.tick+minutes,outcome,text,cost};r.warning=null;}
export function researchCommand(w:World,c:ResearchCommand){
 requireRule(w.mortal.mode==='chapter','MISSING_REQUIREMENT','试验坊接入凡尘旅程。');
 if(c.operation==='enable'){free(w);requireRule(!w.research,'ALREADY_SETTLED','研究手札已开启');w.research=createResearch(w.seed,w.worldId);log(w,'打开青溪试验坊的公开手札：可独自采集、小量试作，也可请教散修。');return;}
 const r=w.research;requireRule(r,'MISSING_REQUIREMENT','请先开启研究手札');
 if(c.operation==='stop'){if(r!.action){w.receipts[r!.action.id]='cancelled';log(w,'已中断试验，开工材料不退还。');r!.action=null;}r!.warning=null;return;}
 free(w);const domain=c.domain,d=researchDomains[domain];requireRule(d,'MISSING_REQUIREMENT','未知领域');
 const blank:ResearchSetup={domain,inputs:[],step:'steady',intensity:'low'};
 if(c.operation==='gather'){start(w,'gather',domain,blank,'','取得三组可试用材料；功法抄本可重复使用。',0,90);return;}
 if(c.operation==='recover'){start(w,'recover',domain,blank,'','收功调息，逆行不适消退，恢复 5 点健康。',0,120);return;}
 if(c.operation==='rumor'||c.operation==='explain'){
  requireRule(!r!.evidence.some(e=>e.domain===domain&&(e.status==='explained'||c.operation==='rumor'&&e.status==='rumor')),'ALREADY_SETTLED','这份情报已记入笔记，不必重复付费。');
  const cost=c.operation==='explain'?3:1;requireRule(w.money>=cost,'MISSING_REQUIREMENT','钱文不足；仍可独立采集并试验。');start(w,c.operation,domain,blank,'',ruleExplanation(r!,domain,c.operation==='explain'),cost,c.operation==='explain'?60:30);return;
 }
 if(c.operation==='introspect'){requireRule(researchAvailable(w,'xp.link')>0,'MISSING_REQUIREMENT','需要亲身获得协同运转心得');start(w,'introspect','practice',{...blank,domain:'practice'},'',ruleExplanation(r!,'practice',true),0,30);return;}
 if(c.operation==='observe'){requireRule(researchAvailable(w,'xp.probe')>0,'MISSING_REQUIREMENT','需要探灵器；可通过炼器获得。');start(w,'observe',domain,blank,'',ruleExplanation(r!,domain,false),0,30);return;}
 if(c.operation==='apply'){
  const id=c.item??'';requireRule(['xp.salve','xp.restorative','xp.mind','xp.warm','xp.reservoir','xp.unstable','xp.calm','xp.link'].includes(id),'MISSING_REQUIREMENT','该成果通过试验或观察入口使用。');use(w,id);const p=w.entities[PLAYER];
  if(id==='xp.salve'||id==='xp.restorative')p.health=Math.min(100,p.health+(id==='xp.salve'?3:10));
  else if(id==='xp.warm'){r!.injury=false;p.fatigue=Math.min(100,p.fatigue+3);log(w,'温脉偏丹解除逆行不适，但燥热增加 3 点疲劳。');}
  else if(id==='xp.calm'||id==='xp.link'){w.mortal.skills.scholar=(w.mortal.skills.scholar??0)+1;p.fatigue=Math.max(0,p.fatigue-5);log(w,'按亲身实践的心得收气，学识与调息得到实际提升。');}
  else p.fatigue=Math.max(0,p.fatigue-(id==='xp.unstable'?4:10));
  log(w,'使用'+researchItems[id]+'，成果已消耗。','success');return;
 }
 const s=SetupSchema.parse(c.operation==='continue'?r!.warning:c.setup);requireRule(s.domain===domain,'MISSING_REQUIREMENT','领域与组合不一致');
 requireRule(!r!.injury,'MISSING_REQUIREMENT','先收功调息，或使用温脉偏丹恢复。');const error=researchStructure(w,s);requireRule(!error,'MISSING_REQUIREMENT',error);
 const rule=r!.rules[domain],fixed=s.inputs.length===1,compatible=s.inputs.some(i=>i.id===rule.material)&&s.step===rule.step;
 if(domain==='practice'&&!fixed&&s.intensity==='high'&&c.operation!=='continue'){start(w,'assessment',domain,s,compatible?'safe':'warning',compatible?'试运行气息平稳，继续既定运转。':'试运行出现逆行征兆；可停止、降强度或请教。强行继续将损失 8 点健康并产生不适。',0,15);return;}
 let outcome=fixed?d.fixed:'none',text='';
 if(!fixed&&compatible){if(domain==='practice')outcome=d.normal;else{const roll=samplePpm(r!.seed,'research-outcome-v1/'+(r!.randomCounter+1));let sum=0;outcome=[d.normal,d.alternate,d.deviation,'none'][rule.weights.findIndex(n=>(sum+=n)>roll)];}}
 else if(!fixed&&domain==='practice')outcome=s.intensity==='high'?'injury':d.deviation;
 if(outcome==='none')text=compatible?'有反应但未成，留下残渣；一次失败不否定已知倾向。':s.inputs.some(i=>i.id===rule.material)?'材料有响应，但此步骤无法衔接。可换另一种步骤复验。':'主辅相斥，没有形成成果。可换另一种辅料小试。';
 else if(outcome==='injury')text='强行续转导致逆行不适，健康 -8；停止试验并收功调息可恢复。';
 else if(outcome===d.deviation)text=domain==='practice'?'低强度观察到气息相冲；未受严重损伤。换辅法或运行顺序再试。':'产生偏差成果：'+researchItems[outcome]+'。保留用途，也记录代价。';
 else text='得到'+researchItems[outcome]+'。'+(fixed?'固定方法，已记入通用图鉴。':domain==='practice'?'本次条件下稳定衔接，可复验确认。':'这是一次观察，不等于概率已经证实。');
 if(domain!=='practice')for(const input of s.inputs)use(w,input.id,input.quantity);
 r!.randomCounter++;
 start(w,'experiment',domain,s,outcome,text,0,s.intensity==='high'?90:60);
}
export function finishResearch(w:World){const r=w.research,a=r?.action;if(!r||!a||a.dueTick>w.tick||w.receipts[a.id])return;
 const d=researchDomains[a.domain];
 if(a.kind==='assessment'){w.receipts[a.id]='completed';r.action=null;r.warning=structuredClone(a.setup);log(w,a.text,a.outcome==='warning'?'warning':'story');if(a.outcome==='safe')researchCommand(w,{type:'Research',operation:'continue',domain:a.domain});return;}
 if(a.kind==='gather'){for(const id of [d.base,...d.choices])give(w,id,a.domain==='practice'?researchAvailable(w,id)?0:1:3);}
 else if(a.kind==='recover'){r.injury=false;w.entities[PLAYER].health=Math.min(100,w.entities[PLAYER].health+5);}
 else if(a.kind==='experiment'){
  if(a.outcome==='injury'){r.injury=true;w.entities[PLAYER].health=Math.max(0,w.entities[PLAYER].health-8);}
  else if(a.outcome!=='none')give(w,a.outcome);
  if(a.setup.inputs.length===1&&!r.learned.includes(a.domain))r.learned.push(a.domain);
  const prior=r.records.some(x=>setupKey(x.setup)===setupKey(a.setup)&&x.outcome===d.normal);
  evidence(w,a.domain,a.domain==='practice'&&prior&&a.outcome===d.normal?'verified':'observed',a.text,'自行试验',a.setup);
  r.records.push({id:a.id,journey:w.worldId,setup:a.setup,outcome:a.outcome,text:a.text,tick:w.tick,cost:a.cost});
 }else evidence(w,a.domain,a.kind==='explain'?'explained':a.kind==='observe'||a.kind==='introspect'?'observed':'rumor',a.text,a.kind==='explain'?'散修完整讲解':a.kind==='observe'?'探灵器鉴定':a.kind==='introspect'?'协同内观':'集市打探',a.kind==='explain'?{domain:a.domain,inputs:[{id:d.base,quantity:1},{id:r.rules[a.domain].material,quantity:1}],step:r.rules[a.domain].step,intensity:'low'}:undefined);
 log(w,a.text,a.outcome==='injury'?'warning':'success');w.receipts[a.id]='completed';r.action=null;
}
export function assertResearch(w:World){if(!w.research)return;const r=ResearchSchema.parse(w.research);if(r.journey!==w.worldId)throw new Error('研究旅程不一致');for(const domain of Object.keys(researchDomains)){const x=r.rules[domain];if(!x||x.domain!==domain||!['gentle','reverse'].includes(x.step)||!researchDomains[x.domain].choices.includes(x.material)||x.weights.reduce((s,n)=>s+n,0)!==1000000)throw new Error('探索规则不完整');}if(r.action&&(r.action.dueTick<=r.action.startedTick||r.action.dueTick<w.tick||w.receipts[r.action.id]||w.mortal.task))throw new Error('研究行动状态不一致');}
