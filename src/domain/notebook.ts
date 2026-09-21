import {PLAYER,type World} from './model';
import {available} from './world';
import {mortalDeck,lockedMortalCards} from './mortal-cards';
import {CollectionSchema,NotebookSchema,type Collection,type Notebook} from './research-model';
export function collectionSignature(c:Collection){return JSON.stringify({entries:c.entries,setup:c.setup});}
export function updateCollection(book:Notebook,input:Collection){
 const c=CollectionSchema.parse(input),old=book.collections.find(x=>x.id===c.id);
 if(old){c.history=[...old.history];c.version=old.version;if(collectionSignature(old)!==collectionSignature(c)){c.history.push({version:old.version,journey:old.journey,signature:collectionSignature(old)});c.version++;}}
 return NotebookSchema.parse({...book,collections:[...book.collections.filter(x=>x.id!==c.id),c]});
}
export function collectionStock(w:World,c:Collection){
 const deck=mortalDeck(w),locked=lockedMortalCards(w);if(w.research?.action){locked.add(PLAYER);for(const i of w.research.action.setup.inputs)locked.add(i.id);}const used=new Map<string,number>();
 return c.entries.map(entry=>{
  const other=entry.ref==='instance'&&entry.journey!==w.worldId;
  const candidates=other?[]:deck.filter(card=>entry.ref==='instance'?card.id===entry.id&&(!entry.instanceId||w.mortal.assets[card.id]?.instanceId===entry.instanceId):card.id===entry.id||w.entities[card.id]?.definitionId===entry.id);
  let total=0,free=0;const ids:string[]=[];
  for(const card of candidates){const a=w.mortal.assets[card.id],e=w.entities[card.id];const count=a?.quantity??e?.quantity??1;total+=count;
   const own=a?a.ownerId===PLAYER:e?e.ownerId===PLAYER:card.kind!=='location'&&card.kind!=='event';
   const local=!a||a.location==='carried'||a.location===w.entities[PLAYER].location;
   const countFree=own&&local&&!locked.has(card.id)&&a?.status!=='reserved'?Math.max(0,(e?available(w,e.id):count)-(used.get(card.id)??0)):0;
   const take=Math.min(countFree,Math.max(0,entry.quantity-free));if(take){ids.push(card.id);used.set(card.id,(used.get(card.id)??0)+take);}free+=take;
  }
  return {entry,total,available:free,missing:Math.max(0,entry.quantity-free),ids,status:other?'来自其他旅程／当前不可用':!total?'已耗尽、离开或引用已失效':free<entry.quantity?'数量不足、被占用或非本人所有':'可准备'};
 });
}
export function mergeNotebook(current:Notebook,incoming:unknown,id:()=>string){const next=NotebookSchema.parse(incoming);return NotebookSchema.parse({version:1,archive:[...new Map([...(current.archive??[]),...(next.archive??[])].map(r=>[r.journey+'/'+r.id,r])).values()],fixed:[...new Set([...current.fixed,...next.fixed])],collections:[...current.collections,...next.collections.map(c=>current.collections.some(x=>x.id===c.id)?{...c,id:id()}:c)]});}
