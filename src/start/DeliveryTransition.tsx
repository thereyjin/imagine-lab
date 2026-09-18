import {useEffect,useState} from 'react';

const frameCount=6;
const frameDuration=125;
const registration=[
  {x:0,y:0},
  {x:-1.3,y:0},
  {x:-2.79,y:-.98},
  {x:-1.74,y:2.15},
  {x:-1.76,y:2.15},
  {x:-2.5,y:2.15}
];

export function DeliveryTransition({onDone,reduced}:{onDone:()=>void;reduced:boolean}){
  const [frame,setFrame]=useState(0);

  useEffect(()=>{
    if(reduced){onDone();return;}
    const started=performance.now();
    let raf=0;
    const tick=()=>{
      const next=Math.min(frameCount-1,Math.floor((performance.now()-started)/frameDuration));
      setFrame(next);
      if(next<frameCount-1)raf=requestAnimationFrame(tick);
      else window.setTimeout(onDone,frameDuration);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[onDone,reduced]);

  const column=frame%3;
  const row=Math.floor(frame/3);
  const registered=registration[frame];
  return <span className="delivery-transition boil-character" role="img" aria-label="小人接住清单并开始阅读" data-frame={frame+1}>
    <span className="delivery-transition-frame" style={{backgroundPosition:`${column*50}% ${row*100}%`,transform:`translate(${registered.x}%,${registered.y}%)`}}/>
  </span>;
}
