import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {session,type Snapshot} from '../application/game-session';
import type {TabletopState} from '../application/ui-state';
import {backgrounds} from '../content/mortal';
import {Illustration,Glyph} from './Glyph';
import './mortal.css';
import './creation.css';
type Draft=NonNullable<TabletopState['creationDraft']>;
const initial:Draft={step:'name',name:'',origin:'traveller',talent:'steady',acquaintance:false};
const talents=[{id:'steady',name:'耐心',text:'遇见难处，愿意再试一次。',detail:'试行练习缩短 30 分钟。',art:'lotus'},{id:'observant',name:'善察',text:'相似的叶子，也有细微不同。',detail:'辨药学习缩短 30 分钟。',art:'insight'},{id:'focused',name:'专注',text:'纷扰之中，仍能留住一个念头。',detail:'理解方法缩短 30 分钟。',art:'book'}] as const;
export function MortalApp({state}:{state:Snapshot}){
 const [notice,setNotice]=useState('');
 const d=state.tabletop.creationDraft??initial,b=backgrounds.find(x=>x.id===d.origin)!,talent=talents.find(x=>x.id===d.talent)!;
 const readonly=!state.ready||state.pauses.includes('read_only');
 const change=(patch:Partial<Draft>)=>{if(!readonly)session.updateTabletop({...state.tabletop,creationDraft:{...d,...patch}});};
 const create=()=>{const r=session.command({type:'CreateMortal',name:d.name,origin:d.origin,talent:d.talent,acquaintance:d.acquaintance});if(!r.ok)setNotice(r.message);};
 return <main className="game-tabletop birth-table"><div className="table-grain"/><div className="table-vignette"/><header className="birth-header"><span>山 河 问 道</span><small>一段人生，尚未落笔</small></header>
 <section className="birth-scene" aria-label="创建人物"><div className="birth-verb"><Glyph kind={d.step==='name'?'quill':d.step==='origin'?'book':d.step==='talent'?'insight':'compass'}/><span>{d.step==='name'?'落笔':d.step==='origin'?'忆起':d.step==='talent'?'自省':'启程'}</span></div>
 {d.step==='name'&&<><p className="birth-kicker">先有一个名字，才有往后的故事。</p><h1>此身何名？</h1><div className="birth-name-card"><Illustration kind="player"/><label>你的姓名<input autoFocus aria-label="你的姓名" placeholder="写下你的名字" maxLength={16} value={d.name} disabled={readonly} onChange={e=>change({name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&d.name.trim())change({step:'origin'});}}/></label><small>未写的人生</small></div><button className="brass-button" disabled={readonly||!d.name.trim()} onClick={()=>change({step:'origin'})}>记下姓名 <ArrowRight size={15}/></button></>}
 {d.step==='origin'&&<><p className="birth-kicker">{d.name}，你并非从今日才开始生活。</p><h1>包袱里，留着什么？</h1><p className="birth-story">选择一件从前带来的东西。它是来路，也是一点赖以谋生的本领。</p><div className="birth-choices">{backgrounds.map(x=><button className="birth-choice" disabled={readonly} key={x.id} data-testid={'origin-'+x.id} onClick={()=>change({origin:x.id,acquaintance:false,step:'talent'})} aria-label={'选择出身：'+x.name}><Illustration kind={x.id==='herbalist'?'herb':x.id==='musician'?'qin':x.id==='scribe'?'book':'work'}/><b>{x.tool}</b><span>{x.name}</span><small>{x.skill?'有一点从业基础':'尚无既定职业'}</small></button>)}</div><button className="text-button" onClick={()=>change({step:'name'})}>重写姓名</button></>}
 {d.step==='talent'&&<><p className="birth-kicker">{b.tool}，陪你走过一段旧时光。</p><h1>你如何看待眼前的事？</h1><div className="birth-choices">{talents.map(t=><button className="birth-choice" disabled={readonly} key={t.id} data-testid={'talent-'+t.id} aria-label={'选择天赋：'+t.name} onClick={()=>change({talent:t.id,step:'ready'})}><Illustration kind={t.art}/><b>{t.name}</b><span>{t.text}</span><small>{t.detail}</small></button>)}</div><button className="text-button" onClick={()=>change({step:'origin'})}>重新想想来路</button></>}
 {d.step==='ready'&&<><p className="birth-kicker">你已经带着过去，来到此刻。</p><h1>渡口有人唤你的名字。</h1><div className="birth-result"><div className="birth-choice"><Illustration kind="player"/><b>{d.name}</b><span>{b.name} · {talent.name}</span><small>此身 · 二十二岁</small></div><div className="birth-departure"><p>随身带着{b.tool}，二十四文钱，两日干粮。</p><p>岸上贴着一张告示。除此以外，青溪于你尚且陌生。</p>{d.origin!=='traveller'&&<label><input type="checkbox" checked={d.acquaintance} disabled={readonly} onChange={e=>change({acquaintance:e.target.checked})}/>记得一位在外地的旧同行，可以寄信问候。</label>}<button className="brass-button" disabled={readonly||!d.name.trim()} onClick={create}>踏上青溪岸 <ArrowRight size={15}/></button><button className="text-button" onClick={()=>change({step:'talent'})}>再想一想</button></div></div></>}
 {notice&&<p role="alert">{notice}</p>}<small className="birth-save" role="status">{state.ready?state.saveStatus:'正在展开旧时记忆…'}</small></section></main>;
}
