import React, {useEffect, useId, useState} from 'react';

// Explicit source rectangles prevent the first frame's low paper from leaking
// into the second row. Registration uses the feet, never the loose paper.
const centers=[211.1,648.8,1071.5,1496.9,213.1,642.3,1067.5,1488.7,210.5,643.8,1065.7,1503.9];
const feet=[279,279,279,279,585,585,585,585,877,877,877,877];
const columns=[0,426,852,1277,1703];
const rows=[0,356,624,924];
export function HandoffSprite({finished}:{finished:boolean}){
 const [frame,setFrame]=useState(finished?11:0);
 const id=useId().replace(/:/g,'');
 useEffect(()=>{
  if(finished){setFrame(11);return;}
  const start=performance.now();let raf=0;
  const tick=()=>{const n=Math.min(11,Math.floor((performance.now()-start)/(2600/12)));setFrame(n);if(n<11)raf=requestAnimationFrame(tick);};
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[finished]);
 const n=finished?11:frame,col=n%4,row=Math.floor(n/4);
 return <svg className={'handoff-registered boil-character'+(finished?' is-finished':'')} viewBox="-213 -250 426 360" role="img" aria-label="小人接住纸条、阅读并让纸条随风飘走" data-frame={n+1}>
  <defs><clipPath id={id}><rect x={columns[col]-centers[n]} y={rows[row]-feet[n]} width={columns[col+1]-columns[col]} height={rows[row+1]-rows[row]}/></clipPath></defs>
  <g clipPath={`url(#${id})`}><image href="/mascot/handoff-character-sheet-v8.png" width="1703" height="924" x={-centers[n]} y={-feet[n]}/></g>
 </svg>;
}
