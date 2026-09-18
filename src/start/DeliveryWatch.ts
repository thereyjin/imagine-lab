import {useEffect,useRef} from 'react';

export type DeliveryStatus={status:'waiting'|'writing'|'ready';revision?:string;previewUrl?:string;source?:{artboard?:string;nodeId?:string};error?:string};
export function useDeliveryWatch({enabled,taskId,onStatus,onReady}:{enabled:boolean;taskId:string;onStatus:(s:DeliveryStatus)=>void;onReady:()=>void}){
  const callbacks=useRef({onStatus,onReady});callbacks.current={onStatus,onReady};
  const seen=useRef('');
  useEffect(()=>{seen.current='';},[taskId]);
  useEffect(()=>{
    if(!enabled)return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll(){
      try{
        const response=await fetch(`/api/lab/task?id=${encodeURIComponent(taskId)}`,{signal:controller.signal});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'暂时连不上本地服务');
        if(stopped)return;callbacks.current.onStatus(data);
        if(data.status==='ready'&&data.revision!==seen.current){seen.current=data.revision;callbacks.current.onReady();}
      }catch(e){if(!stopped)callbacks.current.onStatus({status:'waiting',error:e instanceof Error?e.message:'暂时连不上本地服务'});}
      if(!stopped)timer=setTimeout(poll,document.hidden?6000:2000);
    }
    void poll();return()=>{stopped=true;clearTimeout(timer);controller.abort();};
  },[enabled,taskId]);
}
