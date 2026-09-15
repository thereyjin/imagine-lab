import {type CSSProperties, useEffect, useRef, useState} from 'react';
import './timeline.css';

export const timelineSteps=[
  {id:'start',label:'开始',short:'开始',helper:'进入整理流程'},
  {id:'select-page',label:'选中页面',short:'选中',helper:'在 Paper 里选中页面'},
  {id:'handoff-ai',label:'交给 AI',short:'AI',helper:'复制这句话给 AI'},
  {id:'check',label:'检查一下',short:'检查',helper:'检查代码和资源是否齐全'},
  {id:'ready',label:'可以用了',short:'完成',helper:'组件已整理完成'},
  {id:'find-components',label:'找组件',short:'找组件',helper:'去组件库里快速查找'},
] as const;

type Props={currentStep:number;onStepChange:(stepId:string,index:number)=>void};
const percent=(index:number)=>index/(timelineSteps.length-1)*100;

export function Timeline({currentStep,onStepChange}:Props){
  const previousStep=useRef(currentStep);
  const railRef=useRef<HTMLDivElement>(null);
  const [hoveredStep,setHoveredStep]=useState<number|null>(null);
  const [moving,setMoving]=useState(false);
  const [dragStep,setDragStep]=useState<number|null>(null);

  useEffect(()=>{
    if(previousStep.current===currentStep)return;
    previousStep.current=currentStep;
    setMoving(true);
    const timer=setTimeout(()=>setMoving(false),240);
    return()=>clearTimeout(timer);
  },[currentStep]);

  const visibleStep=dragStep??currentStep;
  const helperStep=hoveredStep??visibleStep;
  const helper=timelineSteps[helperStep];
  const helperVisible=hoveredStep!==null||!moving;
  const helperEdge=helperStep===0?' is-first':helperStep===timelineSteps.length-1?' is-last':'';

  return <section className="timeline-shell" aria-label="组件整理流程">
    <div ref={railRef} className={`timeline-rail${moving?' is-snapping':''}${dragStep!==null?' is-dragging':''}`} style={{'--timeline-progress':`${percent(visibleStep)}%`,'--helper-progress':`${percent(helperStep)}%`} as CSSProperties}>
      <svg className="timeline-track boil-timeline" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 20C125 18 220 22 330 20S545 18 660 20s220 2 340 0"/></svg>
      <svg className="timeline-track timeline-track-complete boil-timeline" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="timeline-complete"><rect width={percent(currentStep)*10} height="40"/></clipPath></defs><path clipPath="url(#timeline-complete)" d="M0 20C125 18 220 22 330 20S545 18 660 20s220 2 340 0"/></svg>
      <img className="timeline-arrow-end boil-timeline" src="/timeline/timeline-arrow-end.svg" alt="" aria-hidden="true"/>
      {timelineSteps.map((step,index)=>{
        const complete=index<currentStep;
        const direct=complete||index===timelineSteps.length-1;
        return <button key={step.id} type="button" className={`timeline-node${index===0?' is-first':''}${index===timelineSteps.length-1?' is-last':''}${complete?' is-complete':''}${direct?' is-direct':' is-locked'}${index===currentStep?' is-current':''}`} style={{left:`${percent(index)}%`}} onClick={direct?()=>onStepChange(step.id,index):undefined} onMouseEnter={()=>setHoveredStep(index)} onMouseLeave={()=>setHoveredStep(null)} onFocus={()=>setHoveredStep(index)} onBlur={()=>setHoveredStep(null)} aria-label={complete?`返回：${step.label}`:direct?`打开：${step.label}`:`${step.label}：随流程自动推进`} aria-disabled={!direct} tabIndex={direct?0:-1}>
          <img className="boil-timeline" src={complete||index===timelineSteps.length-1?'/timeline/timeline-node.svg':'/timeline/timeline-node-light.svg'} alt="" aria-hidden="true"/>
          <span className="timeline-label"><span className="timeline-label-full">{step.label}</span><span className="timeline-label-short">{step.short}</span></span>
        </button>;
      })}
      <div role="slider" tabIndex={0} className="timeline-thumb" aria-label={`当前流程步骤：${timelineSteps[currentStep].label}，可向左拖动返回`} aria-valuemin={0} aria-valuemax={currentStep} aria-valuenow={visibleStep}
        onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);setDragStep(currentStep)}}
        onPointerMove={event=>{if(dragStep===null||!railRef.current)return;const bounds=railRef.current.getBoundingClientRect();const ratio=Math.max(0,Math.min(currentStep/(timelineSteps.length-1),(event.clientX-bounds.left)/bounds.width));setDragStep(Math.round(ratio*(timelineSteps.length-1)))}}
        onPointerUp={event=>{if(dragStep===null)return;event.currentTarget.releasePointerCapture(event.pointerId);const target=dragStep;setDragStep(null);if(target<currentStep)onStepChange(timelineSteps[target].id,target)}}>
        <img className="boil-timeline" src="/timeline/timeline-thumb.svg" alt="" aria-hidden="true"/>
      </div>
      <div className={`timeline-helper${helperEdge}${helperVisible?' is-visible':''}`} aria-live="polite"><img src="/timeline/current-helper-arrow.svg" alt="" aria-hidden="true"/><span>{helper.helper}</span></div>
    </div>
  </section>;
}
