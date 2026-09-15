import {useEffect, useState} from 'react';
import './boiling-lines.css';

// Reference: oreo-design/doodle-icons src/boil.ts (6 frames / 0.86s,
// frequency 0.055, 2 octaves, default amplitude 4). These are ink
// displacements, never layout translations. Small utility text stays unfiltered.
const presets = [
  {id:'logo', scale:4},
  {id:'copy', scale:4},
  {id:'slogan', scale:2},
  {id:'character', scale:3.2},
  {id:'scene', scale:1.8},
  {id:'timeline', scale:1.5},
  {id:'catalog', scale:1.35},
] as const;

export function BoilingLines(){
  const [running,setRunning]=useState(()=>!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setRunning(!document.hidden&&!media.matches);
    update();media.addEventListener('change',update);document.addEventListener('visibilitychange',update);
    return()=>{media.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
  },[]);
  return <svg className="boil-definitions" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>{presets.map(({id,scale})=><filter key={id} id={`imagine-boil-${id}`} x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="1" result="noise">
        {running&&<animate attributeName="seed" values="1;2;3;4;5;6" dur="0.86s" repeatCount="indefinite" calcMode="discrete"/>}
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G"/>
    </filter>)}</defs>
  </svg>;
}
