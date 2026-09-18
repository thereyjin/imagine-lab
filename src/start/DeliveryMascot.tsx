import {useEffect,useState} from 'react';

const poses:Record<string,number>={waiting:0,checking:1,fix:0,pass:3,github:4,syncing:4,done:3};
const labels:Record<string,string>={
  checking:'小人拿着放大镜检查组件',
  pass:'小人举着带蓝色勾的检查单',
  github:'小人递出装好组件的信封',
  syncing:'小人抱着等待核对的信封',
  done:'小人举着带蓝色勾的完成单'
};
/** All six poses share one generated atlas, crop size and baseline. */
export function DeliveryMascot({stage,reduced}:{stage:string;reduced:boolean}){
  const [pose,setPose]=useState(poses[stage]??0);
  useEffect(()=>{
    setPose(poses[stage]??0);
    if(reduced)return;
    if(stage==='checking'){const timer=setInterval(()=>setPose(p=>p===1?2:1),850);return()=>clearInterval(timer);}
    if(stage==='github'){const timer=setTimeout(()=>setPose(5),700);return()=>clearTimeout(timer);}
  },[stage,reduced]);
  if(stage==='waiting')return <span className="delivery-mascot delivery-waiting boil-character" role="img" aria-label={labels[stage]||'戴帽子和圆眼镜的小人拿着组件清单'}><span className="delivery-waiting-pose"/></span>;
  return <span className={`delivery-mascot delivery-${stage} boil-character`} role="img" aria-label={labels[stage]||'戴帽子和圆眼镜的小人拿着组件清单'}>{[0,1,2,3,4,5].map(i=><span key={i} className={'delivery-pose'+(pose===i?' is-visible':'')} style={{backgroundPosition:`${i%3*50}% ${Math.floor(i/3)*100}%`}}/>)}</span>;
}
