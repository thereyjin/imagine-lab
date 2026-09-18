import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {BoilingLines} from './BoilingLines';
import {Timeline,timelineSteps} from './Timeline';
import {HandoffSprite} from './HandoffSprite';
import {DeliveryMascot} from './DeliveryMascot';
import {DeliveryTransition} from './DeliveryTransition';
import {useDeliveryWatch,type DeliveryStatus} from './DeliveryWatch';
import './delivery.css';

type Stage='idle'|'prepare'|'paper'|'handoff'|'waiting'|'checking'|'fix'|'pass'|'github'|'syncing'|'done'|'catalog';
type Component={componentId:string;name:string;category:string;path:string;source:string;url?:string;previewUrl?:string;projectId?:string;description?:string;tags?:string[];updatedAt?:string|number};
type SortMode='default'|'recent'|'name';
type Report={ok:boolean;issues?:string[];checks?:{name:string;ok:boolean}[];components?:Component[];commit?:string;url?:string;message?:string;id?:string;syncedAt?:string;previewUrl?:string;revision?:string;connection?:{repo:string;ref:string}};
const text:Record<Stage,string>={idle:'从设计稿整理组件？',prepare:'',paper:'先在 Paper 里选中要整理的页面。',handoff:'复制好了，粘贴给 AI 吧。',waiting:'等 AI 把组件整理好。',checking:'我看看有没有漏东西。',fix:'有一点要补齐。',pass:'代码过关，看看效果。',github:'等 AI 把组件送到 GitHub。',syncing:'去 GitHub 看看。',done:'收到了，下次直接用。',catalog:'你的组件，下次接着用。'};
const demoComponents:Component[]=[
  ['typography','Typography 排版','通用'],['grid','Grid 栅格','布局'],['layout','Layout 布局','布局'],['space','Space 间距','通用'],['button','Button 按钮','通用'],['splitter','Splitter 分隔面板','布局'],
  ['divider','Divider 分割线','通用'],['anchor','Anchor 锚点','导航'],['tabs','Tabs 标签页','导航'],['course-card','Course Card 课程卡片','数据展示'],['progress','Progress 学习进度','数据展示'],['upload','Upload 文件导入','数据导入'],
  ['feedback','Feedback 反馈条','反馈'],['modal','Modal 对话框','反馈'],['table','Table 数据表格','重型组件'],['chart','Trend Chart 趋势图','可视化图表'],['nav','Side Nav 侧导航','导航'],['empty','Empty 空状态','反馈'],
  ['filter','Filter 筛选器','数据展示'],['stat','Stat 数据概览','数据展示'],['form','Form 表单','重型组件'],['avatar','Avatar 用户头像','其他'],['badge','Badge 状态标签','其他'],['pagination','Pagination 分页','导航']
].map(([componentId,name,category],index)=>({componentId,name,category,path:`projects/suxuehui/components/${componentId}`,source:'Paper',projectId:index%7===0?'shared':'suxuehui',description:`用于${name.split(' ')[1]||name}场景的可复用组件。`,tags:[name,category]}));
const projects=[{id:'suxuehui',name:'速学慧'},{id:'imagine-lab',name:'Imagine Lab'},{id:'other',name:'其他项目'},{id:'shared',name:'通用组件'}];
const categoryOrder=['全部','通用','布局','导航','数据导入','数据展示','反馈','其他','重型组件','可视化图表'];
const sortOptions:{id:SortMode;label:string}[]=[{id:'default',label:'默认排序'},{id:'recent',label:'最近更新'},{id:'name',label:'名称 A–Z'}];
function Magnifier(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5"/></svg>}
function StarIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>}
function syncTime(value?:string){if(!value)return '尚未同步';const date=new Date(value);if(Number.isNaN(date.getTime()))return '已同步';const today=new Date();const sameDay=date.toDateString()===today.toDateString();return `${sameDay?'今天':date.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})} ${date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}`;}
function ComponentPreview({component,index}:{component:Component;index:number}){return component.previewUrl?<img className="component-preview" src={component.previewUrl} alt={component.name+' 运行预览'}/>:<div className={`component-preview component-preview-${index%9}`} aria-hidden="true"><i/><i/><i/><i/></div>}
function saved(){try{return JSON.parse(localStorage.getItem('imagine-v1')||'{}');}catch{return {};}}
function App(){
  const [stage,setStage]=useState<Stage>('idle');
  const [root,setRoot]=useState('');
  const [workspaceOpen,setWorkspaceOpen]=useState(false);
  const [taskId,setTaskId]=useState<string>(()=>saved().taskId||crypto.randomUUID());
  const [visualApproved,setVisualApproved]=useState(false);
  const [delivery,setDelivery]=useState<DeliveryStatus>({status:'waiting'});
  const [taskActive,setTaskActive]=useState<boolean>(()=>Boolean(saved().taskActive));
  const stageRef=useRef(stage);stageRef.current=stage;
  useDeliveryWatch({enabled:stage==='waiting'||stage==='fix',taskId,onStatus:setDelivery,onReady:()=>void request('check')});
  async function saveWorkspace(){
    try{const response=await fetch('/api/lab/workspace',{method:'POST',headers:{'Content-Type':'application/json','X-Imagine-Request':'local'},body:JSON.stringify({root,repo,ref:branch})});const data=await response.json();if(!response.ok)throw new Error(data.error);setRoot(data.root);setWorkspaceOpen(false);setReport(null);setVisualApproved(false);setTaskId(crypto.randomUUID());setError('');}catch(e){setError(e instanceof Error?e.message:'保存失败');}
  }
  const [repo,setRepo]=useState<string>(saved().repo||'');
  const [branch,setBranch]=useState<string>(saved().branch||'');
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [manual,setManual]=useState('');
  const [pending,setPending]=useState<Stage>('waiting');
  const [reduced,setReduced]=useState(false);
  const [idleMotion,setIdleMotion]=useState<'blink-one'|'blink-two'|'rest'|'gesture'>('blink-one');
  const [leaving,setLeaving]=useState(false);
  const [paperUI,setPaperUI]=useState(false);
  const [paperBurst,setPaperBurst]=useState(false);
  const [paperMotion,setPaperMotion]=useState<'react'|'peace'>('react');
  const [,setHandoffPlayed]=useState(false);
  const [,setShowCheckEarly]=useState(false);
  const [handoffBridge,setHandoffBridge]=useState(false);
  const paperWait=useRef<number|undefined>(undefined);
  const [notice,setNotice]=useState('');
  const [catalog,setCatalog]=useState<Report|null>(null);
  const [timelineStep,setTimelineStep]=useState(0);
  const [projectId,setProjectId]=useState('suxuehui');
  const [projectMenu,setProjectMenu]=useState(false);
  const [category,setCategory]=useState('全部');
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState<SortMode>('default');
  const [sortMenu,setSortMenu]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [copiedComponentId,setCopiedComponentId]=useState<string|null>(null);
  const [trayMode,setTrayMode]=useState<'closed'|'expanded'|'minimized'>('closed');
  const [pendingTimelineStep,setPendingTimelineStep]=useState<number|null>(null);
  const manualRef=useRef<HTMLTextAreaElement>(null);
  const active=useRef(false);
  const blinkPause=useRef<number|undefined>(undefined);
  useEffect(()=>()=>{window.clearTimeout(blinkPause.current);window.clearTimeout(paperWait.current);},[]);
  useEffect(()=>{['/mascot/idle-blink-sheet.png','/mascot/idle-gesture-sheet.png','/mascot/thinking2-sheet.png','/mascot/react-sheet.png','/mascot/peace-sheet.png','/mascot/button-burst-sheet.png','/mascot/handoff-character-sheet-v8.png','/mascot/handoff-to-waiting-v2.png','/mascot/delivery-atlas-v3.png'].forEach(src=>{const image=new Image();image.src=src;});},[]);
  useEffect(()=>{fetch('/api/lab/catalog').then(r=>r.json()).then(d=>{if(d.ok){setCatalog(d);if(d.connection?.repo)setRepo(d.connection.repo);if(d.connection?.ref)setBranch(d.connection.ref);}}).catch(()=>{});},[]);
  useEffect(()=>{fetch('/api/lab/context').then(r=>r.json()).then(d=>{setRoot(d.root||'');if(d.workspace?.repo||d.connection?.repo)setRepo(d.workspace?.repo||d.connection.repo);if(d.workspace?.ref||d.connection?.ref)setBranch(d.workspace?.ref||d.connection.ref);if(taskActive)setStage('waiting');}).catch(()=>{});const q=matchMedia('(prefers-reduced-motion: reduce)');setReduced(q.matches);const change=()=>setReduced(q.matches);q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
  useEffect(()=>{try{localStorage.setItem('imagine-v1',JSON.stringify({repo,branch,taskId,taskActive}));}catch{/* Optional storage. */}},[repo,branch,taskId,taskActive]);
  useEffect(()=>{
    if(stage!=='github')return;
    let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
    async function poll(){
      try{const response=await fetch('/api/lab/sync',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-Imagine-Request':'local'},body:JSON.stringify({repo,ref:branch})});const data=await response.json();if(stopped)return;
        if(response.ok&&data.ok){setReport(data);setCatalog(data);setTaskActive(false);setStage('done');setError('');return;}
        if(!response.ok)setError(data.error||'暂时连不上 GitHub，稍后会自动重试。');else setError('');
      }catch{if(!stopped)setError('暂时连不上 GitHub，稍后会自动重试。');}
      if(!stopped)timer=setTimeout(poll,15000);
    }
    timer=setTimeout(poll,3000);return()=>{stopped=true;clearTimeout(timer);controller.abort();};
  },[stage,repo,branch]);
  useEffect(()=>{if(stage==='prepare'){const id=setTimeout(()=>setStage('paper'),reduced?0:1650);return()=>clearTimeout(id);}if(stage==='handoff'){setShowCheckEarly(false);const early=setTimeout(()=>setShowCheckEarly(true),reduced?0:1600);const done=setTimeout(()=>{setHandoffBridge(!reduced);setStage('waiting');},reduced?300:2600);return()=>{clearTimeout(early);clearTimeout(done);};}if(stage==='paper'){setShowCheckEarly(false);setPaperUI(false);setPaperBurst(false);setPaperMotion('react');const id=setTimeout(()=>setPaperUI(true),reduced?0:900);return()=>clearTimeout(id);}},[stage,reduced]);
  useEffect(()=>{const steps:Partial<Record<Stage,number>>={idle:0,paper:1,handoff:2,waiting:2,checking:2,fix:2,pass:3,github:3,syncing:3,done:4,catalog:4};const step=steps[stage];if(step!==undefined)setTimelineStep(step);},[stage]);
  useEffect(()=>{if(stage==='idle')setIdleMotion('blink-one');else{window.clearTimeout(blinkPause.current);setLeaving(false);}if(stage==='idle'||stage==='paper')setHandoffPlayed(false);if(stage!=='paper')window.clearTimeout(paperWait.current);},[stage]);
  useEffect(()=>{
    if(!projectMenu&&!sortMenu)return;
    const closeMenus=(event:PointerEvent)=>{
      const target=event.target instanceof Element?event.target:null;
      if(projectMenu&&!target?.closest('.project-switcher'))setProjectMenu(false);
      if(sortMenu&&!target?.closest('.sort-control'))setSortMenu(false);
    };
    document.addEventListener('pointerdown',closeMenus);
    return()=>document.removeEventListener('pointerdown',closeMenus);
  },[projectMenu,sortMenu]);
  async function copy(value:string,next:Stage){
    setError('');setHandoffPlayed(false);try{await navigator.clipboard.writeText(value);setManual('');setNotice('已复制');setStage(next);return true;}catch{setManual(value);setPending(next);setError('自动复制未成功，选中下方文字手动复制。');requestAnimationFrame(()=>{manualRef.current?.focus();manualRef.current?.select();});return false;}
  }
  async function startCopy(){
    if(!root||!repo||!branch){setWorkspaceOpen(true);setError('请先绑定本地交付目录、GitHub 仓库和分支。');return;}
    const rules=new URL('/imagine/rules.md',location.href).href;
    const value=`Imagine Lab 组件整理任务 ${taskId}\n本地交付目录：${root}\n目标仓库：${repo}\n目标分支：${branch}\n规则：${rules}\n\n请完成当前 Paper 选择的组件整理和本地实现。\n1. 通过 Paper MCP 读取当前选择、节点树、JSX、样式、字体和资源。先展示文件名、画板名、节点 ID、截图及简短组件清单，随后直接执行；只有选择不明确或涉及无法推断的业务行为才集中询问。保留原稿，必要时复制 Code Ready 副本。\n2. 按独立用途与复用价值拆分，优先复用已有组件。写入组件 index.tsx、example.tsx、README.md、样式和 assets，并更新 .imagine/manifest.json。\n3. 开始写代码前创建 .imagine/task-${taskId}.json，格式为 {"taskId":"${taskId}","status":"writing","revision":"1","source":{"file":"Paper 文件名","artboard":"画板名","nodeId":"节点 ID"},"components":["组件 ID"],"previewUrl":""}。不得使用其他任务的记录。\n4. 完成构建、实际运行预览及视觉交互复核后，在记录中写入可访问的 http://127.0.0.1:端口 预览地址、交付文件和限制。最后原子更新 status 为 ready。每次修改先改为 writing，写完后增加 revision 并设为 ready。Imagine Lab 会自动检查，用户不需要手动确认交付或点击检查。\n5. 告诉用户回 Imagine Lab 看效果；明确本地完成，尚未发布。此阶段不 commit/push。无法访问本地目录或预览时请明确说明。`;
    setError('');setPaperBurst(true);
    const clipboard=navigator.clipboard.writeText(value);
    await new Promise(resolve=>window.setTimeout(resolve,reduced?0:900));
    setHandoffPlayed(true);setStage('handoff');
    try{await clipboard;setTaskActive(true);setManual('');setNotice('已复制');}
    catch{setStage('paper');setPaperBurst(false);setManual(value);setPending('handoff');setError('自动复制未成功，选中下方文字手动复制。');requestAnimationFrame(()=>{manualRef.current?.focus();manualRef.current?.select();});}
  }
  async function request(kind:'check'|'sync'|'connect'){
    if(active.current)return;active.current=true;setError('');setStage(kind==='check'?'checking':'syncing');
    if(kind==='check')setVisualApproved(false);
    const expected=kind==='check'?'checking':'syncing';
    try{
      const response=await fetch('/api/lab/'+kind,{method:'POST',headers:{'Content-Type':'application/json','X-Imagine-Request':'local'},body:JSON.stringify({repo,ref:branch,...(kind==='check'?{taskId}:{})})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'服务暂时不可用');
      if(stageRef.current!==expected)return;
      setReport(data);if(kind!=='check'&&data.ok)setCatalog(data);setStage(kind==='check'?(data.ok?'pass':'fix'):(data.ok?'done':'github'));if(kind!=='check'&&!data.ok)setError(data.message);
    }catch(e){if(stageRef.current!==expected)return;setError(e instanceof Error?e.message:'无法连接本地检查服务');setStage(kind==='check'?'fix':'github');if(kind==='check')setReport(null);}
    finally{active.current=false;}
  }
  function navigateTimeline(_id:string,index:number){
    if(index<timelineStep){setPendingTimelineStep(index);return;}
    if(index!==4)return;
    setTimelineStep(index);setError('');setNotice('');setManual('');
    setReport(catalog);setStage('catalog');
  }
  function returnToStep(index:number){
    setTimelineStep(index);setError('');setNotice('');setManual('');
    if(index===0)setStage('idle');
    else if(index===1)setStage('paper');
    else if(index===2)setStage('waiting');
    else setStage(report?.ok?'pass':'waiting');
  }
  function confirmTimelineReturn(){
    if(pendingTimelineStep===null)return;
    const index=pendingTimelineStep;
    setPendingTimelineStep(null);
    returnToStep(index);
  }
  async function publishTask(){
    if(!report?.ok||!visualApproved)return;
    try{const response=await fetch('/api/lab/publish-intent',{method:'POST',headers:{'Content-Type':'application/json','X-Imagine-Request':'local'},body:JSON.stringify({id:report.id})});const data=await response.json();if(!response.ok){setVisualApproved(false);setError(data.error);void request('check');return;}}catch{setError('暂时连不上本地服务，请稍后重试。');return;}
    await copy(`发布 Imagine Lab 任务 ${taskId}。用户已经查看效果并点击发布，授权发布本次组件，无需再次询问相同确认。\n本地目录：${root}\n仓库：${repo}\n分支：${branch}\n检查编号：${report.id}\n先通过 ${location.origin}/api/lab/check 对 taskId=${taskId} 重新检查（POST JSON，X-Imagine-Request: local），失败则修复并回到预览，停止发布。核对 origin 和目标分支，只提交本次组件、manifest、必要资源与依赖；保留无关修改，不强推、不提交密钥。若实际范围超出本次授权再询问。执行 commit 和 push 后返回完整 SHA。Imagine Lab 自动核对远端文件，不需要用户再点击确认。`,'github');
  }
  function nextTask(){setTaskActive(false);setTaskId(crypto.randomUUID());setDelivery({status:'waiting'});setReport(null);setVisualApproved(false);setError('');setStage('paper');}
  const fix=report?.issues?.[0]||error||'检查未完成，请检查本地服务与 manifest。';
  const fixSummary=/尚未交付|写完|status/.test(fix)?'本地交付还没齐。复制修改任务给 AI，修好后会自动再检查。':fix;
  const waitingBubbles=delivery.error
    ?['暂时没读到任务记录','正在重试本地连接','未读取 AI 对话','不会修改本地文件','也可以立即手动检查']
    :delivery.status==='writing'
      ?['已读取当前任务记录','AI 正在写入本地组件','等待 revision 更新','ready 后检查代码与依赖','同时核对资源与预览地址']
      :['正在读取当前任务记录','等待 AI 写入本地目录','等待任务状态标记 ready','每 2 秒读取一次状态','ready 后自动开始检查'];
  const working=['prepare','checking','syncing','handoff'].includes(stage);
  const components=(report?.components?.length?report.components:demoComponents);
  const projectComponents=useMemo(()=>components.filter(c=>projectId==='shared'?c.projectId==='shared':projectId==='suxuehui'?c.projectId!=='shared':true),[components,projectId]);
  const categoryCounts=useMemo(()=>Object.fromEntries(categoryOrder.map(item=>[item,item==='全部'?projectComponents.length:projectComponents.filter(c=>c.category===item).length])),[projectComponents]);
  const filtered=useMemo(()=>projectComponents.filter(c=>(category==='全部'||c.category===category)&&(!query.trim()||[c.name,c.category,c.description,...(c.tags||[])].join(' ').toLowerCase().includes(query.trim().toLowerCase()))).sort((a,b)=>{if(sort==='name')return a.name.localeCompare(b.name,'zh-CN');if(sort==='recent'){const time=(value?:string|number)=>typeof value==='number'?value:Date.parse(value||'')||0;return time(b.updatedAt)-time(a.updatedAt);}return 0;}),[projectComponents,category,query,sort]);
  const selectedComponents=selected.map(id=>components.find(c=>c.componentId===id)).filter((c):c is Component=>Boolean(c));
  function toggleSelected(id:string){setSelected(items=>items.includes(id)?items.filter(item=>item!==id):[...items,id]);setTrayMode(mode=>mode==='minimized'?'minimized':'closed');}
  function removeFromExpandedTray(id:string){setSelected(items=>items.filter(item=>item!==id));setTrayMode('expanded');}
  async function copyComponent(c:Component){const copied=await copy(`Imagine Lab Component\n\n项目：${projects.find(p=>p.id===(c.projectId||projectId))?.name||'速学慧'}\n组件：${c.name}\nComponent ID：${c.projectId||projectId}/${c.componentId}\n\nGitHub：${c.url||c.path}\n代码：component.tsx\n示例：example.tsx\n使用说明：contract.md\n\n请读取该组件的真实代码、示例和 Component Contract。保持组件的视觉语言、信息层级和核心设计特征，并根据当前项目的真实容器尺寸、屏幕尺寸和内容进行合理适配。不要机械复制 demo 尺寸。`,'catalog');if(copied)setCopiedComponentId(c.componentId)}
  return <div className={'app'+(stage==='catalog'?' catalog-mode':'')}>
    <BoilingLines/>
    {stage!=='catalog'&&<div className="workspace-settings"><button className="text-button" onClick={()=>setWorkspaceOpen(v=>!v)}>本地交付目录</button>{workspaceOpen&&<form onSubmit={e=>{e.preventDefault();void saveWorkspace()}}><label>本地仓库绝对路径<input required value={root} onChange={e=>setRoot(e.target.value)}/></label><label>GitHub 仓库<input required value={repo} onChange={e=>setRepo(e.target.value)} placeholder="owner/repo"/></label><label>发布分支<input required value={branch} onChange={e=>setBranch(e.target.value)}/></label><button type="submit">验证并保存</button><p>AI 需要访问这个目录，检查器会读取同一目录。</p></form>}</div>}
    <header>{stage==='catalog'&&<a href="/" className="catalog-top-logo boil-catalog" aria-label="Imagine Lab 首页"><img src="/imagine/brand-mark.png" alt=""/></a>}<nav>{catalog&&<button className="text-button" onClick={()=>{setReport(catalog);setStage('catalog');setError('');setNotice('');}}>组件目录</button>}{stage==='catalog'&&<a className="github-star" href="https://github.com/thereyjin/imagine-lab" target="_blank" rel="noreferrer"><StarIcon/><span>在 GitHub 上点赞</span></a>}<a className="quiet-link rules-link" href="/imagine/rules.md" target="_blank" rel="noreferrer"><span className="rules-link-paper boil-slogan" aria-hidden="true"/><span className="rules-link-label boil-slogan">{stage==='catalog'?'整理规则':'整理规则 ↗'}</span></a><div className="project-help"><button type="button" aria-label="当前项目说明"><img src="/timeline/circle-question-mark.svg" alt=""/></button><div className="project-note-body"><strong>{root?'组件会整理到这里':'还没有连接项目'}</strong><p>{root?'AI 会把组件代码放进这个项目，Imagine Lab 会在这里检查文件是否齐全。':'请让帮你启动 Imagine Lab 的 AI 连接本地项目，再继续整理。'}</p>{root&&<code>{root}</code>}<p className="project-note-help">{root?'平时不用修改。要换项目？告诉 AI 你想使用哪个文件夹，请它切换后重新启动预览。':'连接成功后，这里会显示项目文件夹。'}</p></div></div></nav></header>
    <main className={'scene stage-'+stage} aria-busy={working}>
      {stage!=='catalog'&&<>
        <div className="speech-area" aria-live="polite">{stage==='idle'?<a href="/" className="brand hero-brand" aria-label="Imagine Lab 首页"><img className="hero-brand-mark boil-logo" src="/imagine/brand-mark.png" alt="" aria-hidden="true"/><span className="brand-wordmark boil-logo">imagine lab<span>.</span></span></a>:<span className="hero-brand-spacer" aria-hidden="true"/>}<h1 key={stage} className="speech">{stage==='prepare'?<span className="ink-dots" aria-label="准备整理规则"><i/><i/><i/></span>:stage==='paper'?<span key={paperUI?'paper-text':'paper-wait'} className={paperUI?'boil-copy pop-in':'ink-dots'} aria-label={paperUI?undefined:'准备整理规则'}>{paperUI?text.paper:<><i/><i/><i/></>}</span>:stage==='idle'?<span className="idle-title"><img src="/imagine/smile.svg" alt="" aria-hidden="true"/><span className="boil-copy">{text.idle}</span><img src="/imagine/pencil.svg" alt="" aria-hidden="true"/></span>:<span className="boil-copy">{stage==='fix'?'还差一点，很快就好。':stage==='pass'&&!report?.ok?'完成检查后，就可以用了。':text[stage]}</span>}</h1></div>
        <div className={'character '+(stage==='idle'?'breathing':'')}>
          <img className="idle-scene-art boil-scene" src="/mascot/idle-scene.png" alt="" aria-hidden="true"/>
          {stage==='handoff'&&<HandoffSprite finished={false}/>}
          {stage==='waiting'&&handoffBridge&&<DeliveryTransition reduced={reduced} onDone={()=>setHandoffBridge(false)}/>}
          {stage!=='handoff'&&stage!=='waiting'&&(stage==='prepare'?<span className="thinking2-sprite boil-character" role="img" aria-label="小人正在想下一步"/>:stage==='paper'?(paperMotion==='peace'?<span key="peace" className="peace-sprite boil-character" role="img" aria-label="小人比了个剪刀手"/>:<span key="react" className="react-sprite boil-character" role="img" aria-label="小人想出了主意" onAnimationEnd={()=>{if(!reduced){paperWait.current=window.setTimeout(()=>setPaperMotion('peace'),2000);}}}/>):stage==='idle'?<span key={idleMotion} className={`idle-sprite ${idleMotion==='gesture'?'motion-gesture':idleMotion==='rest'?'motion-rest':'motion-blink'} boil-character`} role="img" aria-label="戴着帽子和圆眼镜的小人" onAnimationEnd={()=>{if(reduced)return;if(idleMotion==='blink-one'){setIdleMotion('rest');blinkPause.current=window.setTimeout(()=>setIdleMotion('blink-two'),2500);}else if(idleMotion==='blink-two'){setIdleMotion('gesture');}else{setIdleMotion('blink-one');}}}/>:<DeliveryMascot stage={stage} reduced={reduced}/>)}
          {stage==='waiting'&&!handoffBridge&&<DeliveryMascot stage={stage} reduced={reduced}/>}
          {stage==='waiting'&&!handoffBridge&&<div className="waiting-bubbles" aria-live="polite">{waitingBubbles.map((line,index)=><span className={`waiting-bubble waiting-bubble-${index+1}`} key={line}>{line}</span>)}</div>}
          {stage==='idle'&&<button className={'doodle-start'+(leaving?' leaving':'')} onClick={()=>{if(leaving)return;setLeaving(true);window.setTimeout(()=>setStage('prepare'),320);}} aria-label="开始">
            <img className="doodle-start-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-start-label boil-copy">开始</span>
          </button>}
          {stage==='fix'&&<button className="doodle-start fix-repair-button" onClick={()=>void copy(`修复 Imagine Lab 任务 ${taskId}，本地目录：${root}。先读取 .imagine/task-${taskId}.json 和源画板。\n检查报告：${JSON.stringify(report)||fix}\n核对文件指纹，按文件、行列、错误码修复，保留设计；先设 status=writing，完成后增加 revision 并设 ready，Imagine Lab 会自动重新检查。不要发布 GitHub。`,'waiting')} aria-label="复制修改任务"><img className="doodle-start-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/><span className="doodle-start-label boil-copy">复制修改</span></button>}
        </div>
        <div className="actions">
          {stage==='paper'&&paperUI&&!paperBurst&&<><button className="doodle-confirm pop-in" onClick={startCopy} aria-label="选好了，复制给 AI">
            <img className="doodle-confirm-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-confirm-label boil-copy">选好了，交给 AI</span>
          </button><p className="hint pop-in-late">粘贴到已连接 Paper 的 AI 对话里。</p></>}
          {stage==='paper'&&paperBurst&&<span className="paper-burst-sprite" role="img" aria-label="按钮爆炸，纸条飞出"/>}
          {stage==='waiting'&&<>{delivery.source?.artboard&&<p className="source-caption">来自 {delivery.source.artboard}</p>}<button className="waiting-check-button" onClick={()=>void request('check')}><img className="waiting-check-icon" src="/imagine/search.svg" alt="" aria-hidden="true"/><span className="waiting-check-label boil-copy">立即检查本地文件</span></button></>}
          {stage==='checking'&&<p className="hint">正在检查真实代码与运行示例。</p>}
          {stage==='fix'&&<p className="fix-summary">{fixSummary}</p>}
          {stage==='pass'&&(report?.ok?<>{!visualApproved?(report.previewUrl?<a className="primary" href={report.previewUrl} target="_blank" rel="noreferrer" onClick={()=>setVisualApproved(true)}>看看效果 ↗</a>:<><p className="hint">还缺运行预览，让 AI 补上就能查看。</p><button className="primary" onClick={()=>void copy(`请为任务 ${taskId} 在 ${root} 启动真实组件预览，更新 .imagine/task-${taskId}.json 的 previewUrl 为本机 HTTP 地址，并增加 revision，完成后设 status=ready。`,'waiting')}>复制预览任务 ↗</button></>):<><button className="primary" onClick={()=>void publishTask()}>效果可以，发布到 GitHub ↗</button><p className="hint">复制发布任务，粘贴给 AI 即可。</p></>}<div className="delivery-secondary">{visualApproved&&report.previewUrl&&<a className="text-button" href={report.previewUrl} target="_blank" rel="noreferrer">再看一眼 ↗</a>}<button className="text-button" onClick={()=>void copy(`继续修改 Imagine Lab 任务 ${taskId}，目录 ${root}。读取 .imagine/task-${taskId}.json，按我接下来描述的视觉或交互问题调整。先设 writing，完成后增加 revision 并设 ready。保留 Paper 来源和预览地址，不发布。请等我描述要改的地方。`,'waiting')}>还要改一下</button></div></>:<button className="text-button" onClick={()=>setStage('waiting')}>回到自动检查 →</button>)}
          {stage==='github'&&<><p className="hint"><span className="live-dot"/>任务已复制，粘贴给 AI；发布后这里自动收录。</p><p className="source-caption">{repo} · {branch}</p><button className="text-button" onClick={()=>void publishTask()}>重新复制发布任务</button><button className="text-button" onClick={()=>void request('check')}>本地有修改？重新检查</button></>}
          {stage==='done'&&<><button className="primary" onClick={()=>setStage('catalog')}>查看组件 →</button><div className="delivery-secondary"><button className="text-button" onClick={nextTask}>继续整理下一张</button><a className="text-button" href={report?.url} target="_blank" rel="noreferrer">查看 GitHub ↗</a></div></>}
        </div>
      </>}
      {stage==='catalog'&&<section className="catalog" aria-label="组件库">
        <div className="catalog-heading"><h1 className="boil-copy"><span className="catalog-title-cn">Imagine Lab的官方组件</span></h1><div className="sync-status boil-catalog" title={catalog?.connection?`${catalog.connection.repo} · ${catalog.connection.ref}`:undefined}><i/> {catalog?.syncedAt?'已同步':'本地目录'} <span/> {syncTime(catalog?.syncedAt)}</div></div>
        <div className="catalog-controls">
          <div className="project-switcher"><button className="project-trigger" aria-expanded={projectMenu} onClick={()=>setProjectMenu(open=>!open)}>{projects.find(p=>p.id===projectId)?.name}<img className="control-chevron" src={projectMenu?'/imagine/chevron-up.svg':'/imagine/chevron-down.svg'} alt=""/></button>{projectMenu&&<div className="project-dropdown" role="menu">{projects.map(p=><button key={p.id} className={p.id===projectId?'active':''} onClick={()=>{setProjectId(p.id);setProjectMenu(false)}}><span>{p.id===projectId?'✓':''}</span>{p.name}</button>)}<hr/><button><span>＋</span>新建项目</button></div>}</div>
          <label className="catalog-search"><Magnifier/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索组件、用途、页面……"/></label>
          <div className="sort-control"><button className="sort-button" aria-expanded={sortMenu} onClick={()=>setSortMenu(open=>!open)}>{sortOptions.find(option=>option.id===sort)?.label}<img className="control-chevron" src={sortMenu?'/imagine/chevron-up.svg':'/imagine/chevron-down.svg'} alt=""/></button>{sortMenu&&<div className="sort-dropdown" role="menu">{sortOptions.map(option=><button key={option.id} className={sort===option.id?'active':''} onClick={()=>{setSort(option.id);setSortMenu(false)}}><span>{sort===option.id?'✓':''}</span>{option.label}</button>)}</div>}</div>
        </div>
        <div className="category-bar" aria-label="组件分类">{categoryOrder.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item} <small>{categoryCounts[item]||0}</small></button>)}</div>
        <div className="component-grid">{filtered.map((c,index)=>{const isSelected=selected.includes(c.componentId);return <article key={c.componentId} className={'component-card'+(isSelected?' selected':'')} onClick={()=>toggleSelected(c.componentId)}>
          <button className="card-select" aria-label={isSelected?'从组件托盘移除':'加入组件托盘'} aria-pressed={isSelected}>{isSelected&&<img src={`/imagine/check.svg?component=${encodeURIComponent(c.componentId)}`} alt=""/>}</button><ComponentPreview component={c} index={index}/><h2>{c.name}</h2><button className="copy-component" onMouseLeave={()=>{if(copiedComponentId===c.componentId)setCopiedComponentId(null)}} onClick={e=>{e.stopPropagation();void copyComponent(c)}}><span>{copiedComponentId===c.componentId?'已复制':'复制组件给 AI'}</span>{copiedComponentId!==c.componentId&&<img src="/imagine/arrow-right.svg" alt=""/>}</button>
        </article>})}</div>
        {!filtered.length&&<div className="catalog-empty"><b>这里暂时没有组件</b><p>换个项目、分类或搜索词试试。</p></div>}
        <p className="catalog-notice" role="status">{notice}</p>
        {selectedComponents.length>0&&<>
          {trayMode==='minimized'?<div className="tray-minimized right"><button className="boil-catalog" onClick={()=>setTrayMode('closed')}>组件托盘 <b>{selectedComponents.length}</b> ↗</button></div>:
          <aside className={'component-tray'+(trayMode==='expanded'?' expanded':'')} aria-label="组件托盘"><div className="tray-summary"><strong className="boil-copy">组件托盘 <b>{selectedComponents.length}</b></strong><div className="tray-thumbs">{selectedComponents.slice(0,trayMode==='expanded'?selectedComponents.length:7).map((c,index)=><button key={c.componentId} title={c.name} onClick={()=>toggleSelected(c.componentId)}><ComponentPreview component={c} index={index}/><span><img src={`/imagine/close.svg?component=${encodeURIComponent(c.componentId)}`} alt=""/></span></button>)}{selectedComponents.length>7&&trayMode!=='expanded'&&<em>+{selectedComponents.length-7}</em>}</div><div className="tray-actions"><button className="boil-copy" onClick={()=>setTrayMode(mode=>mode==='expanded'?'closed':'expanded')}>{trayMode==='expanded'?'收起 ↓':'查看全部 ↑'}</button><button className="boil-copy" onClick={()=>setTrayMode('minimized')}>缩到角落 ↘</button></div></div>{trayMode==='expanded'&&<div className="tray-list">{selectedComponents.map((c,index)=><article key={c.componentId}><ComponentPreview component={c} index={index}/><div><h3>{c.name}</h3><p>项目：{projects.find(p=>p.id===(c.projectId||projectId))?.name||'速学慧'} · 分类：{c.category}</p></div><button className="boil-copy" onMouseLeave={()=>{if(copiedComponentId===c.componentId)setCopiedComponentId(null)}} onClick={()=>{setTrayMode('expanded');void copyComponent(c)}}>{copiedComponentId===c.componentId?'已复制':'复制组件给 AI'}</button><button className="boil-copy" onClick={()=>removeFromExpandedTray(c.componentId)}>移除</button></article>)}</div>}</aside>}
        </>}
      </section>}
      {error&&stage!=='fix'&&<p className="error" role="alert">{error}</p>}
      {manual&&<section className="manual"><label htmlFor="manual-copy">手动复制指令</label><textarea id="manual-copy" ref={manualRef} value={manual} readOnly/><button className="primary" onClick={()=>{setManual('');setError('');setStage(pending);}}>我已复制 →</button></section>}
    </main>
    {stage!=='catalog'&&<Timeline currentStep={timelineStep} onStepChange={navigateTimeline}/>}
    {pendingTimelineStep!==null&&<div className="timeline-confirm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPendingTimelineStep(null)}}><section className="timeline-confirm" role="dialog" aria-modal="true" aria-labelledby="timeline-confirm-title"><h2 id="timeline-confirm-title">返回「{timelineSteps[pendingTimelineStep].label}」？</h2><p>当前进度仍会保留在本地。返回后，你可以重新查看或调整前面的步骤。</p><div><button type="button" onClick={()=>setPendingTimelineStep(null)}>留在这里</button><button type="button" onClick={confirmTimelineReturn}>确认返回</button></div></section></div>}

  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
