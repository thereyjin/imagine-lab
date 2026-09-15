import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {BoilingLines} from './BoilingLines';
import {Timeline,timelineSteps} from './Timeline';
import {HandoffSprite} from './HandoffSprite';

type Stage='idle'|'prepare'|'paper'|'handoff'|'waiting'|'checking'|'fix'|'pass'|'github'|'syncing'|'done'|'catalog';
type Component={componentId:string;name:string;category:string;path:string;source:string;url?:string;previewUrl?:string;projectId?:string;description?:string;tags?:string[];updatedAt?:string|number};
type SortMode='default'|'recent'|'name';
type Report={ok:boolean;issues?:string[];checks?:{name:string;ok:boolean}[];components?:Component[];commit?:string;url?:string;message?:string;id?:string;syncedAt?:string;connection?:{repo:string;ref:string}};
const text:Record<Stage,string>={idle:'从设计稿整理组件？',prepare:'',paper:'先在 Paper 里选中要整理的页面。',handoff:'交给 AI 吧。',waiting:'AI 整理好了？',checking:'我看看有没有漏东西。',fix:'有一点要补齐。',pass:'都齐了。',github:'放进去了吗？',syncing:'去 GitHub 看看。',done:'看到了，已经进组件库。',catalog:'你的组件，下次接着用。'};
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
  const [repo,setRepo]=useState<string>(saved().repo||'');
  const [branch,setBranch]=useState<string>(saved().branch||'');
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [manual,setManual]=useState('');
  const [pending,setPending]=useState<Stage>('waiting');
  const [details,setDetails]=useState(false);
  const [reduced,setReduced]=useState(false);
  const [idleMotion,setIdleMotion]=useState<'blink-one'|'blink-two'|'rest'|'gesture'>('blink-one');
  const [leaving,setLeaving]=useState(false);
  const [paperUI,setPaperUI]=useState(false);
  const [paperBurst,setPaperBurst]=useState(false);
  const [paperMotion,setPaperMotion]=useState<'react'|'peace'>('react');
  const [handoffPlayed,setHandoffPlayed]=useState(false);
  const [showCheckEarly,setShowCheckEarly]=useState(false);
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
  useEffect(()=>{['/mascot/idle-blink-sheet.png','/mascot/idle-gesture-sheet.png','/mascot/thinking2-sheet.png','/mascot/react-sheet.png','/mascot/peace-sheet.png','/mascot/button-burst-sheet.png','/mascot/handoff-character-sheet-v8.png'].forEach(src=>{const image=new Image();image.src=src;});},[]);
  useEffect(()=>{fetch('/api/lab/catalog').then(r=>r.json()).then(d=>{if(d.ok){setCatalog(d);if(d.connection?.repo)setRepo(d.connection.repo);if(d.connection?.ref)setBranch(d.connection.ref);}}).catch(()=>{});},[]);
  useEffect(()=>{fetch('/api/lab/context').then(r=>r.json()).then(d=>{setRoot(d.root||'');if(d.connection?.repo)setRepo(d.connection.repo);if(d.connection?.ref)setBranch(d.connection.ref);}).catch(()=>{});const q=matchMedia('(prefers-reduced-motion: reduce)');setReduced(q.matches);const change=()=>setReduced(q.matches);q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
  useEffect(()=>{try{localStorage.setItem('imagine-v1',JSON.stringify({repo,branch}));}catch{/* Optional storage. */}},[stage,repo,branch]);
  useEffect(()=>{if(stage==='prepare'){const id=setTimeout(()=>setStage('paper'),reduced?0:1650);return()=>clearTimeout(id);}if(stage==='handoff'){setShowCheckEarly(false);const early=setTimeout(()=>setShowCheckEarly(true),reduced?0:1600);const done=setTimeout(()=>setStage('waiting'),reduced?300:2600);return()=>{clearTimeout(early);clearTimeout(done);};}if(stage==='paper'){setShowCheckEarly(false);setPaperUI(false);setPaperBurst(false);setPaperMotion('react');const id=setTimeout(()=>setPaperUI(true),reduced?0:900);return()=>clearTimeout(id);}},[stage,reduced]);
  useEffect(()=>{const steps:Partial<Record<Stage,number>>={idle:0,paper:1,handoff:2,checking:3,fix:3,pass:4,github:4,syncing:4,done:4,catalog:5};const step=steps[stage];if(step!==undefined)setTimelineStep(step);},[stage]);
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
    const rules=new URL('/imagine/rules.md',location.href).href;
    const value=`请按 Imagine Lab 组件整理规则，读取我在 Paper 中选中的页面。先识别值得复用的组件并给我确认；确认后在独立副本中整理，生成可运行代码、预览和使用说明。能读取的信息不要重复问我，不明确的业务行为集中询问。\n\n先读取完整规则：${rules}\n同一仓库中也可读 public/imagine/rules.md 和 public/imagine/schema.json；若无法访问规则，请让我提供内容，不要跳过。\n本地交付目标：${root||'先与我确认项目根目录'}。完成后按规则生成 .imagine/manifest.json，不要提交或推送，等检查与授权。`;
    setError('');setPaperBurst(true);
    const clipboard=navigator.clipboard.writeText(value);
    await new Promise(resolve=>window.setTimeout(resolve,reduced?0:900));
    setHandoffPlayed(true);setStage('handoff');
    try{await clipboard;setManual('');setNotice('已复制');}
    catch{setStage('paper');setPaperBurst(false);setManual(value);setPending('handoff');setError('自动复制未成功，选中下方文字手动复制。');requestAnimationFrame(()=>{manualRef.current?.focus();manualRef.current?.select();});}
  }
  async function request(kind:'check'|'sync'){
    if(active.current)return;active.current=true;setError('');setDetails(false);setStage(kind==='check'?'checking':'syncing');
    try{
      const response=await fetch('/api/lab/'+kind,{method:'POST',headers:{'Content-Type':'application/json','X-Imagine-Request':'local'},body:JSON.stringify({repo,ref:branch})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'服务暂时不可用');
      setReport(data);if(kind==='sync'&&data.ok)setCatalog(data);setStage(kind==='check'?(data.ok?'pass':'fix'):(data.ok?'done':'github'));if(kind==='sync'&&!data.ok)setError(data.message);
    }catch(e){setError(e instanceof Error?e.message:'无法连接本地检查服务');setStage(kind==='check'?'fix':'github');if(kind==='check')setReport(null);}
    finally{active.current=false;}
  }
  function navigateTimeline(_id:string,index:number){
    if(index<timelineStep){setPendingTimelineStep(index);return;}
    if(index!==5)return;
    setTimelineStep(index);setError('');setNotice('');setManual('');
    setReport(catalog);setStage('catalog');
  }
  function confirmTimelineReturn(){
    if(pendingTimelineStep===null)return;
    const index=pendingTimelineStep;
    setPendingTimelineStep(null);setTimelineStep(index);setError('');setNotice('');setManual('');setDetails(false);
    if(index===0){setStage('idle');setReport(null);}
    else if(index===1){setStage('paper');setReport(null);}
    else if(index===2||index===3){setStage('waiting');setReport(null);}
    else setStage(report?.ok?'pass':'waiting');
  }
  const fix=report?.issues?.[0]||error||'检查未完成，请检查本地服务与 manifest。';
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
    <header>{stage==='catalog'&&<a href="/" className="catalog-top-logo boil-catalog" aria-label="Imagine Lab 首页"><img src="/imagine/brand-mark.png" alt=""/></a>}<nav>{catalog&&<button className="text-button" onClick={()=>{setReport(catalog);setStage('catalog');setError('');setNotice('');}}>组件目录</button>}{stage==='catalog'&&<a className="github-star" href="https://github.com/thereyjin/imagine-lab" target="_blank" rel="noreferrer"><StarIcon/><span>在 GitHub 上点赞</span></a>}<a className="quiet-link rules-link" href="/imagine/rules.md" target="_blank" rel="noreferrer"><span className="rules-link-paper boil-slogan" aria-hidden="true"/><span className="rules-link-label boil-slogan">{stage==='catalog'?'整理规则':'整理规则 ↗'}</span></a><div className="project-help"><button type="button" aria-label="当前项目说明"><img src="/timeline/circle-question-mark.svg" alt=""/></button><div className="project-note-body"><strong>{root?'组件会整理到这里':'还没有连接项目'}</strong><p>{root?'AI 会把组件代码放进这个项目，Imagine Lab 会在这里检查文件是否齐全。':'请让帮你启动 Imagine Lab 的 AI 连接本地项目，再继续整理。'}</p>{root&&<code>{root}</code>}<p className="project-note-help">{root?'平时不用修改。要换项目？告诉 AI 你想使用哪个文件夹，请它切换后重新启动预览。':'连接成功后，这里会显示项目文件夹。'}</p></div></div></nav></header>
    <main className={'scene stage-'+stage} aria-busy={working}>
      {stage!=='catalog'&&<>
        <div className="speech-area" aria-live="polite">{stage==='idle'?<a href="/" className="brand hero-brand" aria-label="Imagine Lab 首页"><img className="hero-brand-mark boil-logo" src="/imagine/brand-mark.png" alt="" aria-hidden="true"/><span className="brand-wordmark boil-logo">imagine lab<span>.</span></span></a>:<span className="hero-brand-spacer" aria-hidden="true"/>}<h1 key={stage} className="speech">{stage==='prepare'?<span className="ink-dots" aria-label="准备整理规则"><i/><i/><i/></span>:stage==='paper'?<span key={paperUI?'paper-text':'paper-wait'} className={paperUI?'boil-copy pop-in':'ink-dots'} aria-label={paperUI?undefined:'准备整理规则'}>{paperUI?text.paper:<><i/><i/><i/></>}</span>:stage==='idle'?<span className="idle-title"><img src="/imagine/smile.svg" alt="" aria-hidden="true"/><span className="boil-copy">{text.idle}</span><img src="/imagine/pencil.svg" alt="" aria-hidden="true"/></span>:<span className="boil-copy">{stage==='fix'?(fix.length>65?'有一点要补齐。':fix):stage==='pass'&&!report?.ok?'完成检查后，就可以用了。':text[stage]}</span>}</h1></div>
        <div className={'character '+(['idle','waiting'].includes(stage)?'breathing':'')}>
          <img className="idle-scene-art boil-scene" src="/mascot/idle-scene.png" alt="" aria-hidden="true"/>
          {stage==='handoff'||(stage==='waiting'&&handoffPlayed)?<HandoffSprite finished={stage==='waiting'}/>:stage==='prepare'?<span className="thinking2-sprite boil-character" role="img" aria-label="小人正在想下一步"/>:stage==='paper'?(paperMotion==='peace'?<span key="peace" className="peace-sprite boil-character" role="img" aria-label="小人比了个剪刀手"/>:<span key="react" className="react-sprite boil-character" role="img" aria-label="小人想出了主意" onAnimationEnd={()=>{if(!reduced){paperWait.current=window.setTimeout(()=>setPaperMotion('peace'),2000);}}}/>):stage==='idle'?<span key={idleMotion} className={`idle-sprite ${idleMotion==='gesture'?'motion-gesture':idleMotion==='rest'?'motion-rest':'motion-blink'} boil-character`} role="img" aria-label="戴着帽子和圆眼镜的小人" onAnimationEnd={()=>{if(reduced)return;if(idleMotion==='blink-one'){setIdleMotion('rest');blinkPause.current=window.setTimeout(()=>setIdleMotion('blink-two'),2500);}else if(idleMotion==='blink-two'){setIdleMotion('gesture');}else{setIdleMotion('blink-one');}}}/>:<img className="boil-character" width="336" height="304" src="/mascot/idle-00.png" alt="戴着帽子和圆眼镜的小人"/>}
          {stage==='idle'&&<button className={'doodle-start'+(leaving?' leaving':'')} onClick={()=>{if(leaving)return;setLeaving(true);window.setTimeout(()=>setStage('prepare'),320);}} aria-label="开始">
            <img className="doodle-start-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-start-label boil-copy">开始</span>
          </button>}
          {stage==='checking'&&<span className="small-symbol" aria-hidden="true">⌕</span>}
          {(stage==='done'||(stage==='pass'&&report?.ok))&&<span className="parcel" aria-hidden="true">▧</span>}
        </div>
        <div className="actions">
          {stage==='paper'&&paperUI&&!paperBurst&&<><button className="doodle-confirm pop-in" onClick={startCopy} aria-label="选好了，复制给 AI">
            <img className="doodle-confirm-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-confirm-label boil-copy">选好了，复制给 AI</span>
          </button><p className="hint pop-in-late">粘贴到已连接 Paper 的 AI 对话里。</p></>}
          {stage==='paper'&&paperBurst&&<span className="paper-burst-sprite" role="img" aria-label="按钮爆炸，纸条飞出"/>}
          {(stage==='waiting'||(stage==='handoff'&&showCheckEarly))&&<button className="doodle-confirm pop-in" onClick={()=>void request('check')} aria-label="检查一下">
            <img className="doodle-confirm-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-confirm-label boil-copy">检查一下 →</span>
          </button>}
          {stage==='waiting'&&<p className="hint">检查本地文件与编译，不读取 AI 对话。</p>}
          {stage==='checking'&&<p className="hint">正在验证代码、依赖和示例构建，请稍候。</p>}
          {stage==='fix'&&<><button className="primary" onClick={()=>void copy(`请修复 Imagine Lab 检查发现的问题，项目：${root}。\n${report?.issues?.join('\n')||fix}\n按 public/imagine/rules.md 和 schema.json 补齐交付。不要绕过检查，不要提交 GitHub。修复后提醒我回 Imagine Lab 重新检查。`,'waiting')}>告诉 AI 修一下 <span>↗</span></button><button className="text-button" onClick={()=>void request('check')}>已修好，重新检查</button></>}
          {stage==='pass'&&(report?.ok?<><button className="primary" onClick={()=>void copy(`Imagine Lab 已完成本地结构、TypeScript 与示例构建检查（检查 ID：${report?.id}）。项目：${root}。请先确认目标 GitHub 仓库、分支及本次文件清单，确认无敏感信息后，仅提交本次组件、.imagine/manifest.json 和必要依赖文件。不要上传无关修改，不要强推。返回 owner/repo、分支和 commit SHA。检查不代表视觉验收。`,'github')}>交给 AI 收尾 <span>↗</span></button><p className="hint">只检查了完整性与构建，视觉仍由你确认。</p></>:<><p className="hint">这是完成后的状态。需要先通过真实检查。</p><button className="text-button" onClick={()=>{setTimelineStep(3);setStage('waiting');}}>回到检查 →</button></>)}
          {stage==='github'&&<form onSubmit={e=>{e.preventDefault();void request('sync');}}><label>GitHub 仓库<input required value={repo} onChange={e=>setRepo(e.target.value.trim())} placeholder="owner/repo" autoComplete="off"/></label><label>分支<input required value={branch} onChange={e=>setBranch(e.target.value)} placeholder="AI 刚提交的分支" autoComplete="off"/></label><button className="primary" type="submit">看看有没有回来 <span>↙</span></button><p className="hint">只读 GitHub，核对本次交付的文件内容。</p><button type="button" className="text-button" onClick={()=>void request('check')}>重新检查本地交付</button></form>}
          {stage==='done'&&<><button className="primary" onClick={()=>setStage('catalog')}>看看组件 <span>→</span></button><a className="text-button" href={report?.url} target="_blank" rel="noreferrer">提交 {report?.commit?.slice(0,7)} ↗</a></>}
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
      {['fix','pass'].includes(stage)&&<details open={details} onToggle={e=>setDetails(e.currentTarget.open)}><summary>检查详情</summary>{report?.checks?.map(c=><p key={c.name}>{c.ok?'✓':'—'} {c.name}</p>)}{stage==='fix'&&<pre>{report?.issues?.join('\n')||fix}</pre>}</details>}
      {manual&&<section className="manual"><label htmlFor="manual-copy">手动复制指令</label><textarea id="manual-copy" ref={manualRef} value={manual} readOnly/><button className="primary" onClick={()=>{setManual('');setError('');setStage(pending);}}>我已复制 →</button></section>}
    </main>
    {stage!=='catalog'&&<Timeline currentStep={timelineStep} onStepChange={navigateTimeline}/>}
    {pendingTimelineStep!==null&&<div className="timeline-confirm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPendingTimelineStep(null)}}><section className="timeline-confirm" role="dialog" aria-modal="true" aria-labelledby="timeline-confirm-title"><h2 id="timeline-confirm-title">返回「{timelineSteps[pendingTimelineStep].label}」？</h2><p>返回后，当前流程中尚未保存的信息会被取消。确认要返回吗？</p><div><button type="button" onClick={()=>setPendingTimelineStep(null)}>取消</button><button type="button" onClick={confirmTimelineReturn}>确认返回</button></div></section></div>}

  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
