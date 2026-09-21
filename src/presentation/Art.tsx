import { useId } from 'react';
export function Landscape({small=false}:{small?:boolean}){
 const id=useId().replaceAll(':','');
 return <svg className={small?'landscape small':'landscape'} viewBox="0 0 900 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
 <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#8ca291" stopOpacity=".32"/><stop offset="1" stopColor="#536e5f" stopOpacity=".05"/></linearGradient></defs>
 <circle cx="680" cy="77" r="32" fill="#d7c293" opacity=".53"/>
 <path d="M150 270 286 127 319 160 392 74 438 109 492 31 546 93 597 69 697 200 739 150 900 250Z" fill={'url(#'+id+')'}/>
 <path d="M300 270 440 169 484 202 601 115 628 154 686 123 797 213 826 186 920 245Z" fill="#8ba58e" opacity=".18"/>
 <path d="M0 238Q160 195 284 237T559 234T900 225" fill="none" stroke="#a4bda5" opacity=".13"/>
 <path d="M430 240Q520 205 660 216T950 216M530 254Q650 235 830 248" fill="none" stroke="#b7c7b5" opacity=".18"/>
 <g fill="#1a322b"><path d="M754 196h77v4h-77zM764 173h3v25h-3zM819 173h3v25h-3zM749 175l44-24 47 24-12-2h-71z"/><path d="M717 204q-8-42 0-72h3q-5 40 1 72z"/><path d="m718 151-29-20 26 9-18-28 27 29 25-13-24 20 27 5-30 1z"/></g>
 <g stroke="#c1c9aa" opacity=".45" fill="none"><path d="m574 64 7-4 7 4m12 14 5-3 5 3m-66-25 5-3 5 3"/></g>
 </svg>;
}
export function CardArt({kind}:{kind:string}){
 const person=['player','teacher','worker','person'].includes(kind);
 return <svg className={'card-art art-'+kind} viewBox="0 0 150 125" aria-hidden="true">
 <circle cx="75" cy="60" r="46" fill="currentColor" opacity=".07"/><circle cx="75" cy="60" r="44" fill="none" stroke="currentColor" opacity=".18"/>
 <path d="M6 111q24-22 43-8t55-8 44 10" stroke="currentColor" opacity=".15" fill="none"/>
 {person?<g><path d="M35 119q4-39 23-47l32-1q24 16 27 48" fill="currentColor" opacity=".68"/><path d="m60 73 13 29 15-30 12 8-14 44H56L48 83Z" fill="#e9e3cb" opacity=".86"/><path d="m61 74 13 28-17 22m31-50-15 28 9 22" stroke="currentColor" strokeWidth="2" fill="none" opacity=".6"/><ellipse cx="75" cy="52" rx="17" ry="23" fill="#d9c7a6"/><path d="M57 53q-7-28 16-29 23-1 22 29l-8-17q-12 7-26 2Z" fill="#38473b"/><path d="M63 27q-3-16 12-16 13 0 12 16" fill="#38473b"/><path d="M63 17h25" stroke="#b8965f" strokeWidth="3"/><path d="M80 55h4m-16 0h4" stroke="#6c6453" strokeWidth="1.2"/>{kind==='teacher'&&<path d="m64 67 11 22 11-22q-11 9-22 0" fill="#dcd8c7"/>}<path d="M34 109q29-20 54-9l28 17" fill="none" stroke="currentColor" strokeWidth="8" opacity=".8"/></g>
 :kind==='qin'?<g transform="rotate(-24 75 65)"><path d="M25 46q42-8 104-1l-8 27q-58 8-97-1l6-12z" fill="#675538"/><path d="m32 47-2 23 90 1 5-24" fill="#a08a5d"/>{[49,52,55,58,61,64,67].map(y=><path key={y} d={'M30 '+y+'H124'} stroke="#e7d9b0" strokeWidth=".65"/>)}<path d="m38 43-3 31m77-31-3 31" stroke="#443f2b" strokeWidth="2"/></g>
 :kind==='herb'?<g fill="none" stroke="currentColor" strokeWidth="2"><path d="M72 109q5-39-1-79m2 47q-22-10-32-32m34 17q24-18 32-41m-32 70q22-2 41-21"/>{[[53,56,-35],[86,45,30],[63,34,-15],[98,73,50],[43,44,-40]].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="6" ry="16" transform={'rotate('+r+' '+x+' '+y+')'} fill="currentColor" opacity=".62"/>)}<path d="m68 107-12 13m17-14 4 15m-2-16 11 12"/></g>
 :kind==='lotus'?<g fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M75 88Q43 56 75 24q31 30 0 64Z" fill="currentColor" fillOpacity=".18"/><path d="M75 88Q31 87 27 49q39 1 48 39Z M75 88q46 1 48-39-36 1-48 39Z" fill="currentColor" fillOpacity=".13"/><path d="M75 88q-45 21-57-7 25-10 57 7Zm0 0q45 21 57-7-25-10-57 7Z"/><path d="M35 103h80m-62 7h43" opacity=".5"/></g>
 :kind==='furnace'||kind==='bottle'?<g stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity=".25"><path d="M55 33h40l-4 16q27 13 18 42-4 15-35 15S39 96 40 78q-1-19 19-29Z"/><path d="M53 26h43v8H53Zm5 80-7 13m40-13 8 13" fillOpacity=".6"/><path d="M54 60h40M56 94h39" fill="none"/><circle cx="75" cy="77" r="11" fill="none"/><path d="m71 79 4-8 5 8-5 7Z" fillOpacity=".65"/>{kind==='furnace'&&<path d="M43 59Q17 48 28 82l12 4m67-27q26-11 15 23l-12 4" fill="none"/>}</g>
 :<g transform="rotate(-9 75 65)"><path d="M43 28h71v78H43z" fill="#d6ccb0" stroke="currentColor" strokeWidth="1.4"/><path d="M38 25h69v78H38z" fill="#e9e0c7" stroke="currentColor" strokeWidth="1.4"/><path d="M48 25v78m-8-63h13m-13 16h13m-13 16h13m-13 16h13" stroke="currentColor" opacity=".65"/><path d="M82 39h14v40H82z" fill="none" stroke="currentColor" opacity=".5"/><text x="85" y="51" fontSize="8" fill="currentColor">{kind==='scroll'?'江':kind==='history'?'青':'草'}</text><text x="85" y="62" fontSize="8" fill="currentColor">{kind==='scroll'?'上':kind==='history'?'溪':'木'}</text><text x="85" y="73" fontSize="8" fill="currentColor">{kind==='scroll'?'曲':kind==='history'?'志':'解'}</text><path d="M61 40v43m9-43v35" stroke="currentColor" opacity=".3"/></g>}
 </svg>;
}