import React,{useCallback,useEffect,useRef,useState} from 'react';
import {CanvasFeedback} from './canvas-feedback';
import {ReferenceRangeMenu} from './reference-range-menu';
import {ArrowUp,Check,Component,Trash2,X} from 'lucide-react';

export type CanvasComment={id:number;number:number;text:string;nodeId:string;targetId?:string;x:number;y:number;time:string;resolved:boolean;resolvedBy?:string;resolvedAt?:string;replies:{id:number;author:string;text:string;time:string}[]};
type Point={x:number;y:number};
type Hit=Point&{pageId:string;nodeId:string;name:string;width:number;height:number};
type Note=Hit&{id:number;text:string;confirmed:boolean};
type Asset={name:string;kind:string;description?:string};
type Range={hit:Hit;anchor:Point;mode:null|'frame'|'lasso';points:Point[];drawing:boolean;complete:boolean;prompt:string;targets:string[]};

// The imported page uses the same inline annotation and reference surfaces as DotCanvas.
// Only page-local coordinates and stable node IDs are sent to the Agent.
export function useCanvasInteractions({canvas,scale,onSelect,onAddComments,onRequest}:{canvas:React.RefObject<HTMLDivElement|null>;scale:number;onSelect:(id:string)=>void;onAddComments:(items:CanvasComment[])=>boolean|void;onRequest:(pageId:string,items:{target:string;text:string}[])=>void}){
  const [mode,setMode]=useState<'modify'|'comment'|'component'|null>(null);
  const [feedback,setFeedback]=useState<{id:number;message:string}|null>(null);
  const dismissFeedback=useCallback(()=>setFeedback(null),[]);
  const [notes,setNotes]=useState<Note[]>([]),[asset,setAsset]=useState<Asset|null>(null),[range,setRange]=useState<Range|null>(null);
  const hover=useRef<Element|null>(null),drawPointer=useRef<number|null>(null);
  const clearHover=()=>{hover.current?.removeAttribute('data-annotation-hover');hover.current=null;};
  const stop=()=>{clearHover();setMode(null);setNotes([]);setAsset(null);setRange(null);drawPointer.current=null;window.dispatchEvent(new Event('imagine-component-reference-complete'));};
  const start=(next:'modify'|'comment')=>{stop();setMode(next);};
  useEffect(()=>{const begin=(e:Event)=>{clearHover();setNotes([]);setRange(null);setAsset((e as CustomEvent<Asset>).detail);setMode('component');};const cancel=()=>{clearHover();setMode(current=>current==='component'?null:current);setAsset(null);setRange(null);drawPointer.current=null;};window.addEventListener('imagine-component-reference-start',begin);window.addEventListener('imagine-component-reference-cancel',cancel);return()=>{cancel();window.removeEventListener('imagine-component-reference-start',begin);window.removeEventListener('imagine-component-reference-cancel',cancel);};},[]);
  useEffect(()=>{if(!mode)return;const key=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;e.preventDefault();const draft=notes.find(n=>!n.confirmed);if(draft)setNotes(ns=>ns.filter(n=>n.id!==draft.id));else stop();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[mode,notes]);
  const hitAt=(element:Element,clientX:number,clientY:number):Hit|null=>{
    if(element.closest('[data-canvas-control]'))return null;
    const node=element.closest('[data-agent-node]'),page=node?.closest('[data-agent-page]'),board=node?.closest('.code-artboard');
    if(!node||!page||!board)return null;const box=board.getBoundingClientRect();
    return {pageId:page.getAttribute('data-agent-page')!,nodeId:node.getAttribute('data-agent-node')!,name:(node.getAttribute('data-agent-name')||node.textContent||'页面元素').trim().slice(0,40),x:(clientX-box.left)/scale,y:(clientY-box.top)/scale,width:box.width/scale,height:box.height/scale};
  };
  const point=(e:React.PointerEvent):Point=>{const box=canvas.current!.getBoundingClientRect();return{x:e.clientX-box.left,y:e.clientY-box.top};};
  const submit=()=>{if(!notes.length||notes.some(n=>!n.confirmed))return;if(mode==='comment'){if(onAddComments(notes.map((n,i)=>({id:Date.now()+i,number:0,text:n.text,nodeId:n.pageId,targetId:n.nodeId,x:n.x,y:n.y,time:'刚刚',resolved:false,replies:[]})))===false)return;}else{for(const pageId of new Set(notes.map(n=>n.pageId)))onRequest(pageId,notes.filter(n=>n.pageId===pageId).map(n=>({target:n.nodeId,text:`${n.name}：${n.text}`})));}stop();};
  const submitReference=(direct=false)=>{if(!asset||!range)return;onRequest(range.hit.pageId,[{target:range.hit.nodeId,text:`${direct?'直接替换选中元素':'适配选中区域'}：参考组件「${asset.name}」（${asset.kind}）。${asset.description||''} ${range.prompt.trim()||'保留当前页面的信息层级与视觉规范。'}${range.targets.length?' 区域内节点：'+range.targets.join('、'):''}`}]);window.dispatchEvent(new Event('imagine-component-reference-submitted'));stop();if(direct)setFeedback({id:Date.now(),message:'已将替换指令添加到对话框'});};
  const handlers={
    onPointerDownCapture:(e:React.PointerEvent<HTMLDivElement>)=>{if(!mode||e.button!==0||(e.target as Element).closest('[data-canvas-control]'))return;e.preventDefault();e.stopPropagation();
      if(mode==='component'&&range){if(range.mode&&!range.complete){drawPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);setRange({...range,drawing:true,points:[point(e)],targets:[]});}return;}
      const hit=hitAt(e.target as Element,e.clientX,e.clientY);if(!hit)return;onSelect(hit.pageId);clearHover();
      if(mode==='component'){setRange({hit,anchor:point(e),mode:null,points:[],drawing:false,complete:false,prompt:'',targets:[]});window.dispatchEvent(new CustomEvent('imagine-component-reference-targeted',{detail:{clientX:e.clientX,clientY:e.clientY}}));}
      else if(!notes.some(n=>!n.confirmed))setNotes(ns=>[...ns,{...hit,id:Date.now(),text:'',confirmed:false}]);
    },
    onPointerMoveCapture:(e:React.PointerEvent<HTMLDivElement>)=>{if(!mode)return;
      if(range?.drawing&&drawPointer.current===e.pointerId){e.stopPropagation();const p=point(e);setRange(r=>r?{...r,points:r.mode==='lasso'?[...r.points,p]:[r.points[0],p]}:r);return;}
      const node=(e.target as Element).closest('[data-canvas-control]')?null:(e.target as Element).closest('[data-agent-node]');if(node!==hover.current){clearHover();node?.setAttribute('data-annotation-hover','');hover.current=node;}
    },
    onPointerLeave:clearHover,
    onPointerUpCapture:(e:React.PointerEvent<HTMLDivElement>)=>{if(!range?.drawing||drawPointer.current!==e.pointerId)return;e.stopPropagation();drawPointer.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      const points=[...range.points,point(e)],xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);const valid=right-left>12&&bottom-top>12;
      const box=canvas.current!.getBoundingClientRect();const inside=(x:number,y:number)=>{if(range.mode==='frame')return x>=left&&x<=right&&y>=top&&y<=bottom;let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const p=points[i],q=points[j];if((p.y>y)!==(q.y>y)&&x<(q.x-p.x)*(y-p.y)/(q.y-p.y)+p.x)yes=!yes;}return yes;};
      const targets=Array.from(canvas.current!.querySelectorAll('[data-agent-node]')).filter(n=>n.closest('[data-agent-page]')?.getAttribute('data-agent-page')===range.hit.pageId).filter(n=>{const r=n.getBoundingClientRect();return inside(r.left+r.width/2-box.left,r.top+r.height/2-box.top);}).map(n=>n.getAttribute('data-agent-node')!);
      setRange({...range,drawing:false,points:valid?points:[],complete:valid,targets});
    },
    onPointerCancelCapture:()=>{drawPointer.current=null;setRange(r=>r?{...r,drawing:false,complete:false,points:[]}:r);}
  };
  const pins=(pageId:string)=><>{notes.filter(n=>n.pageId===pageId).map(n=><div className={'design-annotation '+(n.confirmed?'is-confirmed':'')} data-canvas-control key={n.id}><span className="annotation-pin" style={{left:n.x,top:n.y,'--canvas-ui-scale':1/scale} as React.CSSProperties}>{notes.indexOf(n)+1}</span>{n.confirmed?<div className="annotation-confirmed-copy" style={{left:Math.max(12,Math.min(n.width-270/scale,n.x+18/scale)),top:n.y+15/scale,'--canvas-ui-scale':1/scale} as React.CSSProperties}>{n.text}</div>:<div className="annotation-composer" style={{left:Math.max(12,Math.min(n.width-270/scale,n.x+18/scale)),top:Math.max(12,Math.min(n.height-58/scale,n.y+15/scale)),'--canvas-ui-scale':1/scale} as React.CSSProperties}><textarea autoFocus aria-label={mode==='comment'?'输入评论':'输入修改意见'} value={n.text} rows={1} placeholder={mode==='comment'?'输入评论…':'输入修改意见…'} onChange={e=>setNotes(ns=>ns.map(i=>i.id===n.id?{...i,text:e.target.value}:i))}/>{n.text.trim()&&<button className="annotation-confirm" aria-label="确认这条内容" onClick={()=>setNotes(ns=>ns.map(i=>i.id===n.id?{...i,confirmed:true}:i))}><Check/></button>}</div>}</div>)}</>;
  const bounds=range?.points.length?{left:Math.min(...range.points.map(p=>p.x)),top:Math.min(...range.points.map(p=>p.y)),right:Math.max(...range.points.map(p=>p.x)),bottom:Math.max(...range.points.map(p=>p.y))}:null;
  const overlay=<>
    {feedback&&<CanvasFeedback key={feedback.id} message={feedback.message} onClose={dismissFeedback}/>}
    {mode&&mode!=='component'&&<div className="canvas-annotation-bar" data-canvas-control><button className="annotation-exit" aria-label="退出批注" onClick={stop}><X/></button><span><b>{mode==='comment'?'点击页面元素添加评论':'点击页面元素添加修改意见'}</b><small>{mode==='comment'?'评论将记录到右侧栏，可继续回复与解决':'可连续标注多个位置，完成后统一提交'}</small></span><button className="annotation-clear" disabled={!notes.length} onClick={()=>setNotes([])}><Trash2/>清空</button><button className="annotation-submit" disabled={!notes.length||notes.some(n=>!n.confirmed)} onClick={submit}>{mode==='comment'?'提交评论':'提交修改'}{!!notes.filter(n=>n.confirmed).length&&<em>{notes.filter(n=>n.confirmed).length}</em>}</button></div>}
    {asset&&range&&!range.mode&&<div className="component-reference-target" data-canvas-control style={{left:range.anchor.x,top:range.anchor.y}}><ReferenceRangeMenu onReplace={()=>submitReference(true)} onLasso={()=>setRange({...range,mode:'lasso'})} onFrame={()=>setRange({...range,mode:'frame'})}/></div>}
    {range?.mode&&!range.complete&&<div className="reference-draw-hint" data-canvas-control style={{left:range.anchor.x,top:range.anchor.y}}>按住鼠标左键划选范围</div>}
    {range?.mode==='frame'&&bounds&&<div className="reference-selection frame" style={{left:bounds.left,top:bounds.top,width:bounds.right-bounds.left,height:bounds.bottom-bounds.top}}/>}
    {range?.mode==='lasso'&&bounds&&<svg className="reference-lasso-layer"><path d={range.points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')+(range.complete?' Z':'')}/></svg>}
    {asset&&range?.complete&&bounds&&<section className="reference-prompt" data-canvas-control style={{left:Math.max(18,bounds.left),top:bounds.bottom+14}}><header><span><Component/><b>{asset.name}</b></span><button aria-label="取消组件参考" onClick={stop}><X/></button></header><p>告诉 AI 这个参考组件要如何适配当前区域</p><textarea autoFocus value={range.prompt} onChange={e=>setRange({...range,prompt:e.target.value})} placeholder="例如：保留当前品牌色，尺寸适配移动端，并沿用页面圆角…"/><footer><small>将作为组件参考加入对话</small><button onClick={()=>submitReference()}>添加到 AI 修改<ArrowUp/></button></footer></section>}
  </>;
  return {mode,start,stop,handlers,pins,overlay};
}
