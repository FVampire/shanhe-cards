import { CardArt } from './Art';
export function Glyph({kind}:{kind:string}){
 const paths:Record<string,string[]>={
 coins:['M30 13a20 20 0 1 0 0 40 20 20 0 1 0 0-40','M24 27h12v12H24Z','M50 27a20 20 0 1 1-23 29M49 41h10v12H48'],
 inn:['M10 32 40 10 70 32M17 29v38h46V29M8 68h64','M29 67V43h22v24M24 30h10v8H24Zm22 0h10v8H46Z'],
 pharmacy:['M13 65V29h54v36ZM8 29 18 15h44l10 14M8 68h64','M27 42h26v17H27ZM35 38h10M40 44v12m-6-6h12'],
 workshop:['M12 65V32l28-18 28 18v33H12Z','M23 56h34M30 55l6-17h16l-5 17M31 39l-8-8 7-7 10 9M48 26l10 7'],
 temple:['M9 32 40 12 71 32H9ZM16 37h48v27H16ZM8 69h64','M26 40v24m28-24v24M34 64V47h12v17M36 8h8'],
 teahouse:['M15 29h43v24q0 15-22 15T15 53V29Z','M58 34h7q14 13-7 19M10 72h55M25 23q-9-7 0-15m14 15q-9-7 0-15m14 15q-9-7 0-15'],
 pavilion:['M9 32 40 12 71 32 60 29H20Z','M21 31v29m38-29v29M12 61h56M28 34v25m24-25v25M9 68h62'],
 market:['M13 32h54v31H13Z','M8 31 17 15h46l9 16M11 32q7 10 15 0 7 10 14 0 8 10 15 0 7 10 14 0','M26 63V46h16v17m8-17h9v10h-9M7 69h66'],
 study:['M10 35 40 18 70 35H10Zm8 2v28m44-28v28M7 67h66','M28 41q6-4 12 1v18q-6-4-12-1Zm12 1q6-5 12-1v18q-6-3-12 1M35 12h10'],
 garden:['M11 63q25-12 57 0M16 69q20-8 48 0','M27 58V24m0 17Q9 36 13 22q17 0 14 19Zm0-8q1-19 17-20 0 18-17 20M51 59V35m0 17q-14-2-15-14 15-3 15 14Zm0-9q1-16 14-20 5 18-14 20'],
 mountain:['M4 65 26 29 40 48 54 12 77 65H4Z','M47 32l8 5 6-6M16 46l9 5 6-7M42 65l8-12-6-8M13 17a4 4 0 1 0 0-8 4 4 0 1 0 0 8'],
 book:['M14 15q15-7 26 1v37q-11-7-26-1Z','M40 16q11-8 26-1v37q-15-7-26 1','M22 22l11 3m-11 5 11 3m-11 5 11 3m14-17 11-3m-11 11 11-3m-11 11 11-3'],
 talk:['M19 44c-16-13-6-34 12-29l9 4 9-4c18-5 28 16 12 29L40 61Z','M24 28q16 16 32 0M20 41l-9 18 21-6m28-12 9 18-21-6'],
 quill:['M17 65 58 12q21 10 1 28L29 57Z','M23 58 56 23M37 42l-1-17m8 7 18-2M16 68h44'],
 work:['M20 29h40l5 29H15ZM29 28l3-12h16l3 12M13 36h54','M28 36v21m24-21v21M33 43h14v8H33Z'],
 lotus:['M40 57Q15 37 40 12q25 25 0 45Z','M40 57Q11 59 8 29q28 0 32 28Zm0 0q29 2 32-28-28 0-32 28Z','M40 57Q13 74 6 53q16-8 34 4Zm0 0q27 17 34-4-16-8-34 4ZM24 69h32'],
 compass:['M40 6v9m0 50v9M6 40h9m50 0h9','M40 16a24 24 0 1 0 0 48 24 24 0 1 0 0-48','M49 26 44 45 28 56l8-22Z'],
 place:['M6 60 24 34 35 47 49 20 73 60ZM22 67h36','M19 20a5 5 0 1 0 0-10 5 5 0 1 0 0 10','M42 53h17v10H42Zm-4-1 13-10 13 10'],
 event:['M14 22h52v38H14Z','M15 24 40 44 65 24M15 58l19-18m31 18L46 40','M39 37a5 5 0 1 0 0 10 5 5 0 1 0 0-10'],
 insight:['M40 9a25 25 0 0 0-17 42l4 9h26l4-9A25 25 0 0 0 40 9Z','M31 65h18m-16 6h14M31 32l9 10 10-13M40 42v17'],
 };
 const lines=paths[kind]??paths.book;
 return <svg viewBox="0 0 80 80" className="glyph" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{lines.map((d,i)=><path d={d} key={i}/>)}</g></svg>;
}
export function Illustration({kind}:{kind:string}){return ['coins','work','inn','pharmacy','workshop','temple','teahouse','place','pavilion','market','study','garden','mountain','event','insight','lotus','book'].includes(kind)?<Glyph kind={kind}/>:<CardArt kind={kind}/>;}
