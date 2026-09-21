import {researchDomains} from '../content/research';
import type {ResearchDomain} from '../domain/research-model';
import {newCollection} from './ResearchPanel';
import {knownVerbs} from '../domain/mortal-discovery';
import {MortalApp} from './MortalApp';
import {chapter,desktopProjects,desktopAction,desktopEvents,desktopOptions,stackPreview,chapterHints} from './mortal-tabletop';
import { useEffect,useRef,useState,useSyncExternalStore,type CSSProperties,type PointerEvent as ReactPointerEvent,type ReactNode } from 'react';
import { Pause,Play,X,Plus,Minus,Maximize,LayoutGrid,Archive,Users,Leaf,BookOpen,HelpCircle,Coins,Sparkles,Clock3,ArrowRight,ChevronDown,CornerDownLeft,SkipForward,MapPin } from 'lucide-react';
import { session } from '../application/game-session';
import { freshTabletop,type Point,type TabletopState } from '../application/ui-state';
import { PLAYER,type World } from '../domain/model';
import { available,busy,locationOf,hasFact } from '../domain/world';
import { displayDao } from '../domain/dao';
import { content } from '../content';
import { verbs,cardsFor,projectVerb,slotsFor,resolveDraft,fitSlot,sanitizeDraft,initialCardPosition,screenToWorld,zoomAt,cardAvailable,pendingProjects,returnCards,placeReturnedCards,aspectNames,defaultLayout,openingFocusRects,deskFocusRects,cameraToFit,migrateTabletop,LAYOUT_VERSION,type VerbId,type TableCard,type Draft } from './tabletop';
import { Glyph,Illustration } from './Glyph';
import { PanelContents,panelNames,dateText,timeLabel,type PanelId } from './Panels';

type Gesture={kind:'pan'|'card'|'verb'|'window';pointerId:number;start:Point;origin:Point;id:string;fromSlot?:string;moved:boolean;last:Point;offset?:Point};
type Drafts=Partial<Record<VerbId,Draft>>;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
function CardFace({card,small=false}:{card:TableCard;small?:boolean}){
 return <div className={'card-face '+(small?'mini ':'')+'kind-'+card.kind} style={{'--card-accent':card.color} as CSSProperties}>
 <span className="card-corner tl"/><span className="card-corner tr"/><span className="card-corner bl"/><span className="card-corner br"/>
 <div className="card-illustration"><Illustration kind={card.art}/></div><div className="card-name">{card.name}</div><div className="card-divider"><i/>◇<i/></div><div className="card-subtitle">{card.subtitle}</div>
 <div className="card-aspects">{card.aspects.filter(t=>t!=='mortal').slice(0,3).map(t=><i key={t} title={aspectNames[t]??t}>{(aspectNames[t]??'缘')[0]}</i>)}</div>
 {card.entity&&card.entity.quantity>1&&<span className="card-count">{card.entity.quantity}</span>}
 </div>;
}
function Window({name,position,onClose,onMove,children,accent,className=''}:{name:string;position:Point;onClose:()=>void;onMove:(e:ReactPointerEvent)=>void;children:ReactNode;accent?:string;className?:string}){
 return <section role="dialog" aria-label={name} className={'floating-window '+className} style={{left:position.x,top:position.y,maxHeight:'calc(100dvh - '+(position.y+52)+'px)','--accent':accent??'#b5a173'} as CSSProperties}>
 <header className="window-handle" onPointerDown={onMove}><span className="handle-ornament">◇</span><h2>{name}</h2><span className="handle-lines"/><button aria-label="关闭窗口" onPointerDown={e=>e.stopPropagation()} onClick={onClose}><X size={18}/></button></header>
 <div className="window-body">{children}</div>
 </section>;
}
function TabletopApp(){
 const state=useSyncExternalStore(session.subscribe,session.getSnapshot),w=state.world,p=w.entities[PLAYER],mortal=chapter(w);
 const rootRef=useRef<HTMLDivElement>(null),viewportRef=useRef<HTMLDivElement>(null);
 const [ui,setUi]=useState<TabletopState>(freshTabletop),uiRef=useRef(ui);
 const [activeVerb,setActiveVerb]=useState<VerbId|null>(null),[drafts,setDrafts]=useState<Drafts>({}),draftRef=useRef(drafts);
 const [activeSlot,setActiveSlot]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(null),[panel,setPanel]=useState<PanelId|null>(null),[activeEvent,setActiveEvent]=useState<string|null>(null),[answer,setAnswer]=useState<string|null>(null);
 const [windowPositions,setWindowPositions]=useState<Record<string,Point>>({}),windowPositionsRef=useRef(windowPositions);
 const [toast,setToast]=useState(''),[dragging,setDragging]=useState<string|null>(null),[ghost,setGhost]=useState<{card:TableCard;point:Point;width:number}|null>(null),[hoverDrop,setHoverDrop]=useState<string|null>(null);
 const gesture=useRef<Gesture|null>(null),suppressClick=useRef(0),initialized=useRef(''),zoomSave=useRef<ReturnType<typeof setTimeout>|null>(null);
 const cards=cardsFor(w),cardsRef=useRef(cards),worldRef=useRef(w);cardsRef.current=cards;worldRef.current=w;
 const pending=pendingProjects(w,ui),running=desktopProjects(w).filter(x=>x.state==='running');
 const held=new Set(pending.flatMap(proj=>returnCards(proj,cards,w).map(c=>c.id)));
 const loaded=new Set(Object.values(drafts).flatMap(d=>Object.values(d??{})));
 const hidden=new Set([...(w.research?.action?[PLAYER,...w.research.action.setup.inputs.map(i=>i.id)]:[]),...held,...running.flatMap(proj=>Object.values(proj.boundSlots)),...loaded]);
 const shownCards=cards.filter(c=>!hidden.has(c.id));
 const visibleVerbs=mortal?verbs.filter(v=>knownVerbs(w).includes(v.id)):verbs;
 const verb=visibleVerbs.find(v=>v.id===activeVerb),draft=activeVerb?drafts[activeVerb]??{}:{};
 const verbProjects=activeVerb?[...pending,...running].filter(pr=>projectVerb(pr)===activeVerb):[];
 const project=verbProjects[0],slots=activeVerb?slotsFor(activeVerb,draft,cards,w):[];
 const resolved=activeVerb?resolveDraft(activeVerb,draft,cards,w):null;
 const preview=mortal&&activeVerb?stackPreview(w,activeVerb,draft):resolved?session.preview(Object.values(resolved.bindings)).find(x=>x.action.id===resolved.actionId):null;
 const focusedCard=cards.find(c=>c.id===selected),dragCard=cards.find(c=>c.id===dragging);
 const highlightSlot=slots.find(s=>s.id===activeSlot);
 const here=content.locations.find(l=>l.id===locationOf(w,PLAYER))!;
 const events=desktopEvents(w),openEvents=Object.values(events).filter(e=>!e.settled);
 const event=activeEvent?events[activeEvent]:null;
 const readonly=state.pauses.includes('read_only');
 useEffect(()=>{const locate=(event:Event)=>{const id=(event as CustomEvent<string>).detail;setSelected(id);const point=uiRef.current.positions[id];if(point){const box=viewportRef.current?.getBoundingClientRect();if(box){const next={...uiRef.current,camera:{...uiRef.current.camera,x:box.width/2-point.x*uiRef.current.camera.zoom,y:box.height/2-point.y*uiRef.current.camera.zoom}};uiRef.current=next;setUi(next);}}};window.addEventListener('research-locate',locate);return()=>window.removeEventListener('research-locate',locate);},[]);

 const persist=(next:TabletopState)=>{uiRef.current=next;setUi(next);session.updateTabletop(next);};
 const local=(next:TabletopState)=>{uiRef.current=next;setUi(next);};
 const setDraft=(next:Drafts)=>{draftRef.current=next;setDrafts(next);};
 const notify=(text:string)=>setToast(text);
 const pointer=(e:ReactPointerEvent)=>({x:e.clientX,y:e.clientY});
 const position=(id:string,fallback:Point)=>ui.positions[id]??fallback;
 const windowPosition=(id:string)=>{
  const width=Math.min(window.innerWidth-24,window.innerWidth<=800?390:window.innerWidth<=1100?410:430);
  const fallback=id==='verb'&&window.innerWidth<1200?{x:Math.max(12,window.innerWidth-width-12),y:Math.max(120,Math.round(window.innerHeight*.38))}:{x:Math.max(16,window.innerWidth-480),y:135};
  const pos=windowPositions[id]??fallback;
  return{x:clamp(pos.x,12,Math.max(12,window.innerWidth-width-12)),y:clamp(pos.y,70,Math.max(70,window.innerHeight-180))};
 };
 const raiseWindow=(id:string)=>{if(!windowPositionsRef.current[id]){const next={...windowPositionsRef.current,[id]:{x:Math.max(16,window.innerWidth-480),y:135}};windowPositionsRef.current=next;setWindowPositions(next);}};
 const begin=(e:ReactPointerEvent,g:Omit<Gesture,'pointerId'|'moved'|'last'>)=>{if(e.button!==0&&e.button!==1)return;e.stopPropagation();suppressClick.current=0;gesture.current={...g,pointerId:e.pointerId,moved:false,last:pointer(e)};};
 const moveWindow=(id:string,e:ReactPointerEvent)=>{raiseWindow(id);begin(e,{kind:'window',id,start:pointer(e),origin:windowPositionsRef.current[id]??windowPosition(id)});};
 const beginCard=(card:TableCard,e:ReactPointerEvent,fromSlot?:string)=>{
  if(!cardAvailable(card,w,held))return;
  const box=e.currentTarget.getBoundingClientRect();
  begin(e,{kind:'card',id:card.id,start:pointer(e),origin:position(card.id,initialCardPosition(card,cards.indexOf(card))),fromSlot,offset:{x:e.clientX-box.left,y:e.clientY-box.top}});
 };
 const beginVerb=(id:VerbId,e:ReactPointerEvent)=>begin(e,{kind:'verb',id,start:pointer(e),origin:position('verb.'+id,verbs.find(v=>v.id===id)!.position)});
 const dropTarget=(point:Point)=>document.elementsFromPoint(point.x,point.y).map(e=>e.closest<HTMLElement>('[data-slot],[data-verb-drop]')).find(Boolean);
 const insert=(cardId:string,toVerb:VerbId,preferred?:string)=>{
  const card=cardsRef.current.find(c=>c.id===cardId);if(!card)return false;
  const currentWorld=worldRef.current;
  const pendingHold=new Set(pendingProjects(currentWorld,uiRef.current).flatMap(pr=>returnCards(pr,cardsRef.current,currentWorld).map(c=>c.id)));
  if(!cardAvailable(card,currentWorld,pendingHold)){notify('这张卡牌还在行事中，或等待收取。');return false;}
  if(desktopProjects(currentWorld).some(pr=>projectVerb(pr)===toVerb&&(pr.state==='running'||(pr.state==='completed'&&!uiRef.current.collected.includes(pr.id))))){notify('请先处理这项行事中的卡牌。');return false;}
  const targetDraft={...(draftRef.current[toVerb]??{})};
  // Moving a card between slots is visual preparation, not a domain command.
  for(const key of Object.keys(targetDraft))if(targetDraft[key]===cardId)delete targetDraft[key];
  const slotId=fitSlot(card,toVerb,targetDraft,cardsRef.current,currentWorld,preferred);
  if(!slotId){notify('这处槽位容不下这张卡牌。查看槽位下的属性提示。');return false;}
  const next:Drafts={};
  targetDraft[slotId]=cardId;next[toVerb]=sanitizeDraft(toVerb,targetDraft,cardsRef.current,currentWorld);
  setDraft(next);setActiveVerb(toVerb);setActiveSlot(null);setSelected(null);raiseWindow('verb');return true;
 };
 useEffect(()=>{const prepare=(event:Event)=>{const {verb,ids}=(event as CustomEvent<{verb:VerbId;ids:string[]}>).detail;setDraft({});let inserted=false;for(const id of [...ids].sort((a,b)=>Number(b===PLAYER)-Number(a===PLAYER)))inserted=insert(id,verb)||inserted;if(inserted)setPanel(null);};window.addEventListener('research-prepare',prepare);return()=>window.removeEventListener('research-prepare',prepare);},[w]);
 const removeSlot=(slotId:string)=>{if(!activeVerb)return;const next={...draft};delete next[slotId];setDraft({...drafts,[activeVerb]:sanitizeDraft(activeVerb,next,cards,w)});setActiveSlot(null);};
 const closeAction=()=>{setDraft({});setActiveVerb(null);setActiveSlot(null);};
 const openVerb=(id:VerbId)=>{
  setDraft({[id]:draftRef.current[id]??{}});setSelected(null);setActiveVerb(id);setActiveSlot(id==='talk'?'actor':null);raiseWindow('verb');
 };
 const clickCard=(card:TableCard)=>{
  if(Date.now()<suppressClick.current)return;
  if(activeVerb&&activeSlot&&!project){insert(card.id,activeVerb,activeSlot);return;}
  setSelected(card.id);
  if(card.kind==='event'){setActiveEvent(card.id);setAnswer(null);raiseWindow('event');}
 };
 const doubleCard=(card:TableCard)=>{
  if(Date.now()<suppressClick.current)return;
  if(activeVerb&&!project){insert(card.id,activeVerb);return;}
  clickCard(card);
 };
 const home=()=>{
  const all=cardsRef.current,box=viewportRef.current?.getBoundingClientRect();if(!box)return;
  const positions={...defaultLayout(all),...uiRef.current.positions};
  const rects=uiRef.current.introductionDismissed?deskFocusRects(positions,all):openingFocusRects(positions,all);
  persist({...uiRef.current,camera:cameraToFit(rects,{width:box.width,height:box.height})});
 };
 const changeZoom=(amount:number,anchor?:Point)=>{
  const box=viewportRef.current?.getBoundingClientRect();if(!box)return;
  const point=anchor??{x:box.width/2,y:box.height/2};const camera=zoomAt(uiRef.current.camera,point,uiRef.current.camera.zoom+amount);
  local({...uiRef.current,camera});if(zoomSave.current)clearTimeout(zoomSave.current);zoomSave.current=setTimeout(()=>persist(uiRef.current),180);
 };
 const arrange=()=>{
  const next=defaultLayout(cardsRef.current);
  for(const c of shownCards.filter(c=>c.kind==='event'))if(uiRef.current.positions[c.id])next[c.id]=uiRef.current.positions[c.id];
  persist({...uiRef.current,positions:next,layoutVersion:LAYOUT_VERSION});notify('只整理了桌面，时光与物资未变。');
 };
 const move=(e:ReactPointerEvent)=>{
  const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;
  const point=pointer(e);g.last=point;const dx=point.x-g.start.x,dy=point.y-g.start.y;
  if(!g.moved&&Math.hypot(dx,dy)<5)return;if(!g.moved)rootRef.current?.setPointerCapture(e.pointerId);g.moved=true;
  if(g.kind==='pan'){local({...uiRef.current,camera:{...uiRef.current.camera,x:clamp(g.origin.x+dx,-8000,8000),y:clamp(g.origin.y+dy,-8000,8000)}});return;}
  if(g.kind==='window'){const pos={x:clamp(g.origin.x+dx,8,window.innerWidth-300),y:clamp(g.origin.y+dy,65,window.innerHeight-100)};const next={...windowPositionsRef.current,[g.id]:pos};windowPositionsRef.current=next;setWindowPositions(next);return;}
  if(g.kind==='verb'){const point={x:clamp(g.origin.x+dx/uiRef.current.camera.zoom,-3000,6000),y:clamp(g.origin.y+dy/uiRef.current.camera.zoom,-3000,6000)};local({...uiRef.current,positions:{...uiRef.current.positions,['verb.'+g.id]:point}});return;}
  const card=cardsRef.current.find(c=>c.id===g.id);if(!card)return;
  setDragging(g.id);setGhost({card,point:{x:point.x-(g.offset?.x??40),y:point.y-(g.offset?.y??60)},width:110*uiRef.current.camera.zoom});
  const target=dropTarget(point);setHoverDrop(target?.dataset.slot??target?.dataset.verbDrop??null);
 };
 const up=(e:ReactPointerEvent)=>{
  const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;
  gesture.current=null;if(rootRef.current?.hasPointerCapture(e.pointerId))rootRef.current.releasePointerCapture(e.pointerId);
  if(g.moved){
   suppressClick.current=Date.now()+180;
   if(g.kind==='card'){
    const point=pointer(e),target=dropTarget(point);
    const slot=target?.dataset.slot,toVerb=(target?.dataset.verbDrop??(slot?activeVerb:null)) as VerbId|null;
    if(toVerb)insert(g.id,toVerb,slot);
    else if(!document.elementFromPoint(point.x,point.y)?.closest('.floating-window,.hud,.inspector,.table-controls,.bottom-ribbon')){
     const rect=viewportRef.current!.getBoundingClientRect(),pos=screenToWorld({x:point.x-rect.left-(g.offset?.x??40),y:point.y-rect.top-(g.offset?.y??60)},uiRef.current.camera);
     const positions={...uiRef.current.positions,[g.id]:{x:Math.round(clamp(pos.x,-3000,6000)/8)*8,y:Math.round(clamp(pos.y,-3000,6000)/8)*8}};
     if(g.fromSlot&&activeVerb){const d={...(draftRef.current[activeVerb]??{})};delete d[g.fromSlot];setDraft({...draftRef.current,[activeVerb]:sanitizeDraft(activeVerb,d,cardsRef.current,worldRef.current)});}
     persist({...uiRef.current,positions});setSelected(g.id);
    }
   }else if(g.kind==='pan'||g.kind==='verb')persist(uiRef.current);
  }
  setDragging(null);setGhost(null);setHoverDrop(null);
 };
 const startAction=()=>{
  if(!resolved||!preview||preview.errors.length||!activeVerb)return;
  const result=mortal?session.startStack(activeVerb,resolved.bindings):session.start(resolved.actionId,resolved.bindings);
  if(!result.ok){notify(result.message);return;}
  const ids=new Set(Object.values(draft));const next:Drafts={};for(const [key,value]of Object.entries(drafts)){next[key as VerbId]=Object.fromEntries(Object.entries(value??{}).filter(([,id])=>!ids.has(id)));}
  setDraft(next);setActiveSlot(null);setSelected(null);
  if(!uiRef.current.introductionDismissed)persist({...uiRef.current,introductionDismissed:true});
 };
 const collect=()=>{
  if(!project||project.state!=='completed')return;
  const origin=position('verb.'+projectVerb(project),verbs.find(v=>v.id===projectVerb(project))!.position);
  const positions=placeReturnedCards(returnCards(project,cards,w),cards,uiRef.current.positions,origin);
  if(mortal){const r=session.command({type:'MortalCollect',runId:project.id});if(!r.ok){notify(r.message);return;}}
  persist({...uiRef.current,positions,collected:[...new Set([...uiRef.current.collected,project.id])]});notify('卡牌与成果已回到桌面。');
 };
 useEffect(()=>{void session.boot();const timer=setInterval(()=>session.advance(5*session.getSnapshot().speed),500);const vis=()=>{if(document.hidden)session.hidden();};document.addEventListener('visibilitychange',vis);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',vis);};},[]);
 useEffect(()=>{if(!gesture.current){uiRef.current=state.tabletop;setUi(state.tabletop);}},[state.tabletop]);
 useEffect(()=>{if(!state.ready)return;if(initialized.current!==w.worldId){initialized.current=w.worldId;setDraft({});setSelected(null);setActiveVerb(null);setActiveEvent(null);const next=migrateTabletop(state.tabletop,cards);const migrated=next!==state.tabletop;if(migrated)persist(next);if(migrated||(!Object.keys(state.tabletop.positions).length&&state.tabletop.camera.x===0&&state.tabletop.camera.zoom===1))requestAnimationFrame(home);}},[state.ready,w.worldId]);
 useEffect(()=>{if(!state.ready||!mortal)return;const incoming=shownCards.filter(c=>!uiRef.current.positions[c.id]);if(incoming.length)persist({...uiRef.current,positions:placeReturnedCards(incoming,cards,uiRef.current.positions,{x:530,y:700})});},[state.ready,w.worldId,w.revision]);
 useEffect(()=>{const canvas=viewportRef.current;if(!canvas)return;const wheel=(e:WheelEvent)=>{e.preventDefault();const box=canvas.getBoundingClientRect();changeZoom(e.deltaY<0?.06:-.06,{x:e.clientX-box.left,y:e.clientY-box.top});};canvas.addEventListener('wheel',wheel,{passive:false});return()=>canvas.removeEventListener('wheel',wheel);},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement).tagName))return;if(e.code==='Space'&&(e.target as HTMLElement).tagName!=='BUTTON'){e.preventDefault();session.togglePause();}if(e.key==='Escape'){setActiveSlot(null);setSelected(null);if(activeEvent)setActiveEvent(null);else if(panel)setPanel(null);else closeAction();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[activeEvent,panel]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(id);},[toast]);
 useEffect(()=>{if(event?.settled){setActiveEvent(null);setAnswer(null);}},[event?.settled]);

 return <div className="game-tabletop" ref={rootRef} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setGhost(null);setDragging(null);setHoverDrop(null);}}>
 <div className="table-viewport" ref={viewportRef} data-testid="tabletop" onPointerDown={e=>{if(e.target===e.currentTarget||(e.target as HTMLElement).closest('.table-decoration'))begin(e,{kind:'pan',id:'table',start:pointer(e),origin:{x:ui.camera.x,y:ui.camera.y}});}}>
  <div className="table-grain"/><div className="table-vignette"/>
  <div className="table-world" style={{transform:'translate('+ui.camera.x+'px,'+ui.camera.y+'px) scale('+ui.camera.zoom+')'}} data-testid="table-world">
   <div className="table-decoration compass-rose" style={{left:430,top:150}}><svg viewBox="0 0 500 500"><g fill="none" stroke="currentColor"><circle cx="250" cy="250" r="230"/><circle cx="250" cy="250" r="205"/><circle cx="250" cy="250" r="135"/><path d="M250 0v500M0 250h500M72 72l356 356M72 428 428 72M250 42l67 208-67 208-67-208Z"/></g></svg><span>万般本领<br/>各有所归</span></div>
   <div className="table-decoration table-letter" style={{left:300,top:118}}>青 溪 · 人 间</div>
   <div className="table-decoration table-label" style={{left:1120,top:150}}>远近山河</div>
   <div className="table-decoration table-label table-hand-label" style={{left:400,top:328}}>案上所携</div>
   {visibleVerbs.map(v=>{
    const tasks=[...pending,...running].filter(pr=>projectVerb(pr)===v.id),task=tasks[0],ready=task?.state==='completed',isRunning=task?.state==='running';
    const progress=task?clamp((w.tick-task.startedTick)/(task.dueTick-task.startedTick),0,1):0;
    const accepts=dragCard&&!task&&!!fitSlot(dragCard,v.id,drafts[v.id]??{},cards,w);
    return <div key={v.id} className={'verb-node '+(activeVerb===v.id?'selected ':'')+(ready?'result-ready ':'')+(isRunning?'is-running ':'')+(accepts?'accepts ':'')+(hoverDrop===v.id?'drop-over':'')} style={{left:position('verb.'+v.id,v.position).x,top:position('verb.'+v.id,v.position).y,'--accent':v.color} as CSSProperties}>
    <button className="verb-token" data-verb-drop={v.id} data-testid={'verb-'+v.id} aria-label={v.name} onPointerDown={e=>beginVerb(v.id,e)} onClick={()=>{if(Date.now()>=suppressClick.current)openVerb(v.id);}}>
     <span className="token-corner tl"/><span className="token-corner tr"/><span className="token-corner bl"/><span className="token-corner br"/><Glyph kind={v.symbol}/>
     {task&&<svg className="timer-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" pathLength="100" strokeDasharray={progress*100+' 100'}/></svg>}
     {ready&&<span className="result-spark">✦</span>}
     {tasks.length>1&&<span className="task-count">{tasks.length}</span>}
    </button><span className="verb-label">{v.name}</span><small className="verb-state">{ready?'成果待收取':isRunning?timeLabel(task.dueTick-w.tick):Object.keys(drafts[v.id]??{}).length?'已放入 '+Object.keys(drafts[v.id]!).length+' 张卡牌':''}</small>
    {task&&<div className="token-card-stack">{Object.values(task.boundSlots).slice(0,3).map((id,i)=><i key={id} style={{transform:'rotate('+(i*7-6)+'deg)'}}/>)}</div>}
    </div>;
   })}
   {shownCards.map((card,index)=>{
    const pos=position(card.id,initialCardPosition(card,cards.indexOf(card)));
    const eligible=!!highlightSlot?.accept(card)&&cardAvailable(card,w,held);
    const newEvent=card.kind==='event'&&!ui.seenEvents.includes(card.id);
    return <button key={card.id} className={'table-card '+(selected===card.id?'selected ':'')+(eligible?'eligible ':'')+(dragging===card.id?'drag-source ':'')+(newEvent?'new-arrival ':'')} style={{left:pos.x,top:pos.y,zIndex:selected===card.id?12:card.kind==='event'?10:2+index%4}} data-testid={'card-'+card.id} data-card-id={card.id} aria-label={'卡牌：'+card.name} onPointerDown={e=>beginCard(card,e)} onClick={()=>clickCard(card)} onDoubleClick={()=>doubleCard(card)} onKeyDown={e=>{if(e.key==='Enter'&&activeVerb){e.preventDefault();insert(card.id,activeVerb,activeSlot??undefined);}}}>
    <CardFace card={card}/>{newEvent&&<span className="new-seal">新</span>}{card.kind==='event'&&<span className="card-expiry"><Clock3 size={10}/>{mortal?'待回应':timeLabel(events[card.id].expiresTick-w.tick)}</span>}
    </button>;
   })}
  </div>
 </div>
 <header className="hud"><div className="table-brand"><span className="brand-mark">山<br/>河</span><div><h1>山河问道</h1><span>此生由你落笔</span></div></div><div className="hud-center"><span><Coins size={15}/><b data-testid="money">{w.money}</b><small>文</small></span><span><Sparkles size={14}/><b>{displayDao(p)}</b><small>道行</small></span><span className="location-now"><MapPin size={14}/>{here.name}</span></div><div className="table-clock"><span>{dateText(w.tick)}</span><button className="clock-pause" aria-label={state.pauses.length?'继续时间':'暂停时间'} onClick={()=>session.togglePause()}>{state.pauses.length?<Play size={16}/>:<Pause size={16}/>}</button>{[1,3,6].map(speed=><button key={speed} aria-label={speed+'倍速度'} className={state.speed===speed?'active':''} onClick={()=>session.setSpeed(speed)}>{speed}×</button>)}</div></header>
 <div className="top-utilities">{([{id:'character',icon:Users,label:'人物志'},{id:'organization',icon:Leaf,label:mortal?'起居':'宗务'},{id:'research',icon:BookOpen,label:'手札'},{id:'journal',icon:BookOpen,label:'日录'},{id:'save',icon:Archive,label:'存档'},{id:'help',icon:HelpCircle,label:'指引'}] as const).filter(({id})=>!mortal||id!=='organization'||knownVerbs(w).includes('talk')).map(({id,icon:Icon,label})=><button key={id} onClick={()=>{setPanel(panel===id?null:id);raiseWindow('panel');}} aria-label={label}><Icon size={16}/><span>{label}</span></button>)}</div>
 {w.research?.action&&<aside className="card-locations" aria-label="研究行事"><h2>此身正在研究</h2><button className="cargo-action" onClick={()=>{setPanel('research');raiseWindow('panel');}}><strong>试验坊 · 还需 {w.research.action.dueTick-w.tick} 分钟</strong><span>查看准备、进展或中断研究</span></button></aside>}
 {([...running,...pending].length>0)&&<aside className="card-locations" aria-label="卡牌去向" data-testid="card-locations"><h2>卡牌去向</h2>{[...running,...pending].map(pr=>{const v=verbs.find(v=>v.id===projectVerb(pr))!;const cargo=pr.state==='completed'?returnCards(pr,cards,w):Object.values(pr.boundSlots).map(id=>cards.find(c=>c.id===id)).filter((c):c is TableCard=>!!c);return <button key={pr.id} className="cargo-action" onClick={()=>openVerb(v.id)} aria-label={v.name+' · '+(pr.state==='completed'?'待收取':'进行中')+'：'+cargo.map(c=>c.name).join('、')}><strong>{v.name}<small>{pr.state==='completed'?'待收取':'进行中 · '+timeLabel(pr.dueTick-w.tick)}</small></strong><span className="cargo-cards">{cargo.map(c=><span key={c.id}><Illustration kind={c.art}/>{c.name}</span>)}</span><small>点击查看{pr.state==='completed'?'并收取':''}</small></button>;})}</aside>}
 <div className="table-time-status">{mortal&&<small className="mortal-vitals">粮 {w.mortal.foodDays} 日 · {w.mortal.paidUntil>w.tick?'有住处':'待安顿'} · 疲劳 {p.fatigue}</small>}<i className={state.pauses.length?'paused':''}/>{state.pauses.includes('event')?(w.research?.warning?'研究征兆 · 时光暂停':'来信待答 · 时光暂停'):state.pauses.includes('hidden')?'离开期间已暂停':readonly?'只读桌面':state.pauses.length?'时光暂停':'时光流逝'}<small>空格切换</small></div>
 {!state.ready&&<div className="loading-table">正在展开一段人生…</div>}
 {state.pauses.includes('save_error')&&<div className="system-banner">保存失败，时光已暂停。请打开存档导出当前进度或重试。</div>}
 {readonly&&<div className="system-banner">只读窗口：请在最初打开游戏的窗口继续。桌面整理不会写入此存档。</div>}
 {!ui.introductionDismissed&&state.ready&&<div className="first-whisper" data-testid="opening-whisper"><span>{mortal?'一只包袱，一张告示。':'一把旧琴，一位故人。'}</span><p>{mortal?'打开「行游」，投入自身和用工告示。开始后等候回响，再收取新的线索。':'打开「交游」，放入自己与沈知弦即可小坐。若要合奏，再放入旧琴和曲谱。'}</p><button data-testid="begin-meeting" onClick={e=>{e.stopPropagation();openVerb(mortal?'travel':'talk');}}>{mortal?'从告示开始':'从相遇开始'} <ArrowRight size={13}/></button><button className="dismiss-whisper" aria-label="收起提示" onClick={e=>{e.stopPropagation();persist({...uiRef.current,introductionDismissed:true});}}>先四处看看</button></div>}
 {verb&&<Window name={verb.name} position={windowPosition('verb')} onMove={e=>moveWindow('verb',e)} onClose={closeAction} accent={verb.color} className="verb-window">
  <button className="text-button" disabled={!Object.keys(draft).length||readonly} onClick={()=>{session.saveCollection(newCollection(w,Object.values(draft).map(id=>({ref:'kind',id,name:cards.find(c=>c.id===id)?.name??id,quantity:1}))));notify('准备区组合已收藏，可在手札中编辑。');}}>收藏准备区</button><div className="verb-window-emblem"><Glyph kind={verb.symbol}/></div>
  {project?<><p className="window-kicker">{project.state==='completed'?'一段经历，已有回响':'时光正在其中流转'}</p><h3 className="action-title">{desktopAction(w,project.definitionId).name}</h3>
   {project.state==='running'?<><p className="story-text">{desktopAction(w,project.definitionId).description}</p><div className="running-cards">{Object.values(project.boundSlots).map(id=>{const card=cards.find(c=>c.id===id);return card?<div key={id}><CardFace card={card} small/></div>:null;})}</div><div className="action-timer"><span>还需 {timeLabel(project.dueTick-w.tick)}</span><div><i style={{width:((w.tick-project.startedTick)/(project.dueTick-project.startedTick)*100)+'%'}}/></div></div><div className="button-row"><button className="subtle-button" onClick={()=>session.waitForAction()}><SkipForward size={14}/>等候下一进展</button><button className="text-button" onClick={()=>{const r=session.command(mortal?{type:'CancelMortal'}:{type:'CancelAction',projectId:project.id});if(!r.ok)notify(r.message);}}>取消行事</button></div><p className="muted">取消将归还未消耗的物资；已付出的许可、材料和时间不会返还。</p></>
   :<><p className="story-text">{mortal?desktopAction(w,project.definitionId).description:'一段时间过去。属于你的本领与经历已经留下，案上的人和物也将各归其位。'}</p><div className="outcome-list">{desktopAction(w,project.definitionId).effects.filter(e=>['practice','relationship','payment','work','health','longevity','item','insight'].includes(e.op)).map(e=><span key={e.id}>{e.op==='practice'?(content.skills.find(s=>s.id===e.skillId)?.name??'技艺')+' +'+e.units:e.op==='relationship'?(e.units<0?'默契受了损伤':'默契与信任有所增加'):e.op==='payment'?'履约所得 '+e.amount+' 文':e.op==='work'?'完成《'+e.title+'》':e.op==='health'?(e.units<0?'身体受了损耗':'身体得到调养'):e.op==='item'?'炼成或收得新的物资':e.op==='insight'?'留下一句心得':e.op==='longevity'?'验证具体调养方法':''}</span>)}</div><div className="result-cards">{returnCards(project,cards,w).map(card=><div key={card.id}><CardFace card={card} small/></div>)}</div><button className="brass-button wide" onClick={collect}>收取成果 <CornerDownLeft size={15}/></button><p className="muted">收起这段经历，让人物与器物回到案上。</p></>}
   {verbProjects.length>1&&<p className="muted">这个方块还有 {verbProjects.length-1} 段进行中或待收取的经历。</p>}
  </>:<><p className="window-kicker">{verb.description}</p><h3 className="action-title">{preview?.action.name??'你想如何'+verb.name+'？'}</h3><p className="story-text">{preview?.action.description??(mortal?chapterHints[verb.id]:verb.hint)}</p>
   <div className="action-slots">{slots.map(slot=>{
    const card=cards.find(c=>c.id===draft[slot.id]);const canDrop=dragCard&&slot.accept(dragCard)&&(!card||card.id===dragCard.id);
    return <div key={slot.id} className="slot-column"><div className={'action-slot '+(card?'filled ':'')+(activeSlot===slot.id?'listening ':'')+(canDrop?'accepts ':'')+(hoverDrop===slot.id?'drop-over':'')} role="button" tabIndex={0} data-slot={slot.id} data-testid={'slot-'+slot.id} aria-label={'槽位：'+slot.name} onClick={()=>setActiveSlot(slot.id)} onKeyDown={e=>{if(e.key==='Enter')setActiveSlot(slot.id);}}>
    {card?<><div className="slotted-card" onPointerDown={e=>beginCard(card,e,slot.id)}><CardFace card={card} small/></div><button className="remove-slot" aria-label={'取回'+card.name} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();removeSlot(slot.id);}}><X size={12}/></button></>:<><Plus size={19}/><span>{slot.name}</span><small>{slot.optional?'可以留空':'等待一张卡牌'}</small></>}</div><div className="slot-aspects">{slot.aspects.map(t=><span key={t} title={aspectNames[t]}>{aspectNames[t]??t}</span>)}</div></div>;
   })}</div>
   {activeSlot&&<p className="slot-help">{slots.find(s=>s.id===activeSlot)?.hint}。桌面上合适的卡牌会发亮。</p>}
   <div className="recipe-consequence">{preview?<><span><Clock3 size={13}/>{timeLabel(preview.action.duration)}</span><span>{preview.action.costs.length?preview.action.costs.map(c=>(c.resource==='currency'?'文':content.items.find(x=>x.id===c.resource)?.name)+' ×'+c.quantity+'（'+(c.phase==='start'?'开始':'完成')+'消耗）').join(' · '):'只占用时间与投入的人、物'}</span></>:<span>放入卡牌，才能看见这段故事的可能。</span>}</div>
   {preview?.errors.length?<p className="requirement">{preview.errors[0]}</p>:null}
   <button className="brass-button wide" disabled={!preview||preview.errors.length>0||readonly} onClick={startAction}>开始行事 <ArrowRight size={15}/></button>
   {Object.keys(draft).length>0&&<button className="text-button return-all" onClick={()=>{setDraft({...drafts,[activeVerb!]:{}});setActiveSlot(null);}}>将这些卡牌放回桌面</button>}<p className="muted">关闭或切换行动会将尚未开始的卡牌退回原位。</p>
  </>}
 </Window>}
 {focusedCard&&<aside className="inspector" aria-label="卡牌详情"><button className="inspector-close" aria-label="收起卡牌详情" onClick={()=>setSelected(null)}><X size={14}/></button><span className="inspector-subtitle">{focusedCard.subtitle}</span><h2>{focusedCard.name}</h2><p>{focusedCard.description}</p><div className="aspect-tags">{focusedCard.aspects.map(t=><span key={t}>{aspectNames[t]??'一段缘分'}</span>)}</div>
  <button disabled={readonly} className="subtle-button wide" onClick={()=>{const c=newCollection(w,[{ref:'kind',id:focusedCard.id,name:focusedCard.name,quantity:1}]);c.name=focusedCard.name;session.saveCollection(c);setPanel('research');raiseWindow('panel');notify('已收藏，可在个人收藏中命名和编辑。');}}>收藏此卡</button>{Object.entries(researchDomains).filter(([,d])=>[d.base,...d.choices].includes(focusedCard.id)).map(([domain])=><button key={domain} className="subtle-button wide" onClick={()=>{const previous=state.researchDraft?.domain===domain?state.researchDraft.inputs:[];session.setResearchDraft({domain:domain as ResearchDomain,inputs:[...previous.filter(i=>i.id!==focusedCard.id),{id:focusedCard.id,quantity:1}],step:state.researchDraft?.domain===domain?state.researchDraft.step:'steady',intensity:'low'});setPanel('research');raiseWindow('panel');}}>放入试验准备区</button>)}{state.notebook.collections.filter(c=>c.entries.some(e=>e.id===focusedCard.id)).map(c=><small key={c.id}>收录于：{c.name}</small>)}
  {focusedCard.entity?.id===PLAYER&&<small>音律 {mortal?w.mortal.skills.music:p.skills['skill.music']} · 健康 {p.health} · 疲劳 {p.fatigue}</small>}
  {activeVerb&&!project&&fitSlot(focusedCard,activeVerb,draft,cards,w)&&<button className="subtle-button wide" onClick={()=>insert(focusedCard.id,activeVerb)}>投入「{verb?.name}」</button>}
  {!mortal&&focusedCard.kind==='location'&&focusedCard.id===here.id&&<button className="subtle-button wide" onClick={()=>{const r=session.command({type:'Investigate'});if(!r.ok)notify(r.message);}}>探问此地消息</button>}
  {!mortal&&focusedCard.id==='location.market'&&here.id==='location.market'&&<button className="subtle-button wide" onClick={()=>{const r=session.command({type:'BuyHerbs',quantity:2});if(!r.ok)notify(r.message);}}>买入两份灵草 · 4 文</button>}
  {!mortal&&focusedCard.id==='location.mountain'&&here.id==='location.mountain'&&w.knowledge.some(k=>k.factId==='fact.mountain')&&!hasFact(w,'encounter_resolved')&&<div className="encounter-choices">{[['withdraw','退到安全处'],['negotiate','协商 · 8 文'],['hire','雇援 · 12 文'],['endure','承受铃击']].map(([id,label])=><button key={id} className="subtle-button" onClick={()=>{const r=session.command({type:'Encounter',choice:id as 'withdraw'|'negotiate'|'hire'|'endure'});if(!r.ok)notify(r.message);}}>{label}</button>)}</div>}
 </aside>}
 {event&&!event.settled&&<Window name={event.title} position={windowPosition('event')} onMove={e=>moveWindow('event',e)} onClose={()=>setActiveEvent(null)} accent="#bf7970" className="event-window">
 <p className="window-kicker">{mortal?'身边小事 · 尚待回应':'案头来信 · 仍有 '+timeLabel(event.expiresTick-w.tick)}</p><div className="letter-symbol"><Glyph kind="event"/></div><p className="event-story">{event.text}</p><div className="answer-cards">{desktopOptions(w,event.kind)?.map(option=><button key={option.id} className={answer===option.id?'chosen':''} aria-label={option.text} onClick={()=>setAnswer(option.id)}><span>◇</span><b>{option.text}</b><small>{option.detail}</small></button>)}</div><div className="answer-slot"><span>你的回应</span><b>{desktopOptions(w,event.kind)?.find(o=>o.id===answer)?.text??'尚未落定'}</b></div><button className="brass-button wide" disabled={!answer||readonly} onClick={()=>{if(!answer)return;const r=session.command(mortal?{type:'MortalEvent',eventId:event.id,choice:answer as 'act'|'decline'}:{type:'ChooseEventOption',eventId:event.id,option:answer});if(!r.ok)notify(r.message);else {persist({...uiRef.current,seenEvents:[...new Set([...uiRef.current.seenEvents,event.id])]});setActiveEvent(null);setSelected(null);setAnswer(null);}}}>落定这一选择 <ArrowRight size={14}/></button>
 </Window>}
 {panel&&<Window name={mortal&&panel==='organization'?'食宿与起居':panelNames[panel]} position={windowPosition('panel')} onMove={e=>moveWindow('panel',e)} onClose={()=>setPanel(null)} className="ledger-window"><PanelContents panel={panel} w={w} notify={notify} onClose={()=>{setPanel(null);setDraft({});setSelected(null);setActiveVerb(null);}}/></Window>}
 <div className="bottom-ribbon"><button className="save-dot" aria-label="保存状态" onClick={()=>{setPanel('save');raiseWindow('panel');}}><i className={state.saveStatus.includes('失败')?'error':''}/>{state.saveStatus}</button><div className="pending-ribbon">{openEvents.map(e=><button key={e.id} onClick={()=>{setActiveEvent(e.id);setAnswer(null);raiseWindow('event');}}><span>✉</span>{e.title}{e.major&&<i/>}</button>)}</div><span className="table-instruction">拖动空白移动桌面 · 滚轮缩放 · 双击投入卡牌</span></div>
 <div className="table-controls"><button aria-label="缩小桌面" onClick={()=>changeZoom(-.1)}><Minus size={15}/></button><span data-testid="zoom-label">{Math.round(ui.camera.zoom*100)}%</span><button aria-label="放大桌面" onClick={()=>changeZoom(.1)}><Plus size={15}/></button><i/><button aria-label="视角归位" title="视角归位" onClick={home}><Maximize size={16}/></button><button aria-label="整理桌面" title="整理桌面，只改变摆放" onClick={arrange}><LayoutGrid size={16}/></button></div>
 {ghost&&<div className="drag-ghost" style={{left:ghost.point.x,top:ghost.point.y,width:ghost.width,transform:'rotate(3deg)'}}><CardFace card={ghost.card}/></div>}
 {(toast||state.notice)&&<div className="table-toast" role="status"><span>◇</span>{toast||state.notice}<button aria-label="关闭提示" onClick={()=>{setToast('');session.clearNotice();}}><X size={14}/></button></div>}
 </div>;
}

export function App(){
 const state=useSyncExternalStore(session.subscribe,session.getSnapshot);
 useEffect(()=>{void session.boot();},[]);
 return state.world.mortal.mode==='chapter'&&!state.world.mortal.created?<MortalApp state={state}/>:<TabletopApp/>;
}
