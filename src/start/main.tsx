import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {BoilingLines} from './BoilingLines';
import {Timeline} from './Timeline';

type Stage='idle'|'prepare'|'paper'|'handoff'|'waiting'|'checking'|'fix'|'pass'|'github'|'syncing'|'done'|'catalog';
type Component={componentId:string;name:string;category:string;path:string;source:string;url?:string;previewUrl?:string};
type Report={ok:boolean;issues?:string[];checks?:{name:string;ok:boolean}[];components?:Component[];commit?:string;url?:string;message?:string;id?:string};
const text:Record<Stage,string>={idle:'从设计稿整理组件？',prepare:'',paper:'先在 Paper 里选中要整理的页面。',handoff:'交给 AI 吧。',waiting:'AI 整理好了？',checking:'我看看有没有漏东西。',fix:'有一点要补齐。',pass:'都齐了。',github:'放进去了吗？',syncing:'去 GitHub 看看。',done:'看到了，已经进组件库。',catalog:'你的组件，下次接着用。'};
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
  const [paperMotion,setPaperMotion]=useState<'react'|'peace'>('react');
  const paperWait=useRef<number|undefined>(undefined);
  const [notice,setNotice]=useState('');
  const [catalog,setCatalog]=useState<Report|null>(null);
  const [timelineStep,setTimelineStep]=useState(0);
  const manualRef=useRef<HTMLTextAreaElement>(null);
  const active=useRef(false);
  const blinkPause=useRef<number|undefined>(undefined);
  useEffect(()=>()=>{window.clearTimeout(blinkPause.current);window.clearTimeout(paperWait.current);},[]);
  useEffect(()=>{['/mascot/idle-blink-sheet.png','/mascot/idle-gesture-sheet.png','/mascot/thinking2-sheet.png','/mascot/react-sheet.png','/mascot/peace-sheet.png'].forEach(src=>{const image=new Image();image.src=src;});},[]);
  useEffect(()=>{fetch('/api/lab/catalog').then(r=>r.json()).then(d=>{if(d.ok)setCatalog(d);}).catch(()=>{});},[]);
  useEffect(()=>{fetch('/api/lab/context').then(r=>r.json()).then(d=>setRoot(d.root||'')).catch(()=>{});const q=matchMedia('(prefers-reduced-motion: reduce)');setReduced(q.matches);const change=()=>setReduced(q.matches);q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
  useEffect(()=>{try{localStorage.setItem('imagine-v1',JSON.stringify({repo,branch}));}catch{/* Optional storage. */}},[stage,repo,branch]);
  useEffect(()=>{if(stage==='prepare'){const id=setTimeout(()=>setStage('paper'),reduced?0:1650);return()=>clearTimeout(id);}if(stage==='handoff'){const id=setTimeout(()=>setStage('waiting'),reduced?300:1400);return()=>clearTimeout(id);}if(stage==='paper'){setPaperUI(false);setPaperMotion('react');const id=setTimeout(()=>setPaperUI(true),reduced?0:900);return()=>clearTimeout(id);}},[stage,reduced]);
  useEffect(()=>{const steps:Partial<Record<Stage,number>>={idle:0,paper:1,handoff:2,checking:3,fix:3,pass:4,github:4,syncing:4,done:4,catalog:5};const step=steps[stage];if(step!==undefined)setTimelineStep(step);},[stage]);
  useEffect(()=>{if(stage==='idle')setIdleMotion('blink-one');else{window.clearTimeout(blinkPause.current);setLeaving(false);}if(stage!=='paper')window.clearTimeout(paperWait.current);},[stage]);
  async function copy(value:string,next:Stage){
    setError('');try{await navigator.clipboard.writeText(value);setManual('');setNotice('已复制');setStage(next);}catch{setManual(value);setPending(next);setError('自动复制未成功，选中下方文字手动复制。');requestAnimationFrame(()=>{manualRef.current?.focus();manualRef.current?.select();});}
  }
  async function startCopy(){
    const rules=new URL('/imagine/rules.md',location.href).href;
    await copy(`请按 Imagine Lab 组件整理规则，读取我在 Paper 中选中的页面。先识别值得复用的组件并给我确认；确认后在独立副本中整理，生成可运行代码、预览和使用说明。能读取的信息不要重复问我，不明确的业务行为集中询问。\n\n先读取完整规则：${rules}\n同一仓库中也可读 public/imagine/rules.md 和 public/imagine/schema.json；若无法访问规则，请让我提供内容，不要跳过。\n本地交付目标：${root||'先与我确认项目根目录'}。完成后按规则生成 .imagine/manifest.json，不要提交或推送，等检查与授权。`,'handoff');
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
    if(index!==5&&!(index===0&&stage==='catalog'))return;
    setTimelineStep(index);setError('');setNotice('');setManual('');
    if(index===0){setStage('idle');setReport(null);}
    else {setReport(catalog);setStage('catalog');}
  }
  const fix=report?.issues?.[0]||error||'检查未完成，请检查本地服务与 manifest。';
  const working=['prepare','checking','syncing','handoff'].includes(stage);
  return <div className="app">
    <BoilingLines/>
    <header><nav>{catalog&&<button className="text-button" onClick={()=>{setReport(catalog);setStage('catalog');setError('');setNotice('');}}>组件目录</button>}<a className="quiet-link rules-link" href="/imagine/rules.md" target="_blank" rel="noreferrer"><span className="rules-link-paper boil-slogan" aria-hidden="true"/><span className="rules-link-label boil-slogan">整理规则 ↗</span></a><div className="project-help"><button type="button" aria-label="当前项目说明"><img src="/timeline/circle-question-mark.svg" alt=""/></button><div className="project-note-body"><strong>{root?'组件会整理到这里':'还没有连接项目'}</strong><p>{root?'AI 会把组件代码放进这个项目，Imagine Lab 会在这里检查文件是否齐全。':'请让帮你启动 Imagine Lab 的 AI 连接本地项目，再继续整理。'}</p>{root&&<code>{root}</code>}<p className="project-note-help">{root?'平时不用修改。要换项目？告诉 AI 你想使用哪个文件夹，请它切换后重新启动预览。':'连接成功后，这里会显示项目文件夹。'}</p></div></div></nav></header>
    <main className={'scene stage-'+stage} aria-busy={working}>
      {stage!=='catalog'&&<>
        <div className="speech-area" aria-live="polite">{stage==='idle'?<a href="/" className="brand hero-brand" aria-label="Imagine Lab 首页"><img className="hero-brand-mark boil-logo" src="/imagine/brand-mark.png" alt="" aria-hidden="true"/><span className="brand-wordmark boil-logo">imagine lab<span>.</span></span></a>:<span className="hero-brand-spacer" aria-hidden="true"/>}<h1 key={stage} className="speech">{stage==='prepare'?<span className="ink-dots" aria-label="准备整理规则"><i/><i/><i/></span>:stage==='paper'?<span key={paperUI?'paper-text':'paper-wait'} className={paperUI?'boil-copy pop-in':'ink-dots'} aria-label={paperUI?undefined:'准备整理规则'}>{paperUI?text.paper:<><i/><i/><i/></>}</span>:stage==='idle'?<span className="idle-title"><img src="/imagine/smile.svg" alt="" aria-hidden="true"/><span className="boil-copy">{text.idle}</span><img src="/imagine/pencil.svg" alt="" aria-hidden="true"/></span>:<span className="boil-copy">{stage==='fix'?(fix.length>65?'有一点要补齐。':fix):stage==='pass'&&!report?.ok?'完成检查后，就可以用了。':text[stage]}</span>}</h1></div>
        <div className={'character '+(['idle','waiting'].includes(stage)?'breathing':'')}>
          <img className="idle-scene-art boil-scene" src="/mascot/idle-scene.png" alt="" aria-hidden="true"/>
          {stage==='prepare'?<span className="thinking2-sprite boil-character" role="img" aria-label="小人正在想下一步"/>:stage==='paper'?(paperMotion==='peace'?<span key="peace" className="peace-sprite boil-character" role="img" aria-label="小人比了个剪刀手"/>:<span key="react" className="react-sprite boil-character" role="img" aria-label="小人想出了主意" onAnimationEnd={()=>{if(!reduced){paperWait.current=window.setTimeout(()=>setPaperMotion('peace'),2000);}}}/>):stage==='idle'?<span key={idleMotion} className={`idle-sprite ${idleMotion==='gesture'?'motion-gesture':idleMotion==='rest'?'motion-rest':'motion-blink'} boil-character`} role="img" aria-label="戴着帽子和圆眼镜的小人" onAnimationEnd={()=>{if(reduced)return;if(idleMotion==='blink-one'){setIdleMotion('rest');blinkPause.current=window.setTimeout(()=>setIdleMotion('blink-two'),2500);}else if(idleMotion==='blink-two'){setIdleMotion('gesture');}else{setIdleMotion('blink-one');}}}/>:<img className="boil-character" width="336" height="304" src="/mascot/idle-00.png" alt="戴着帽子和圆眼镜的小人"/>}
          {stage==='idle'&&<button className={'doodle-start'+(leaving?' leaving':'')} onClick={()=>{if(leaving)return;setLeaving(true);window.setTimeout(()=>setStage('prepare'),320);}} aria-label="开始">
            <img className="doodle-start-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-start-label boil-copy">开始</span>
          </button>}
          {stage==='handoff'&&<span className="paper-note" aria-hidden="true">↗</span>}
          {stage==='checking'&&<span className="small-symbol" aria-hidden="true">⌕</span>}
          {(stage==='done'||(stage==='pass'&&report?.ok))&&<span className="parcel" aria-hidden="true">▧</span>}
        </div>
        <div className="actions">
          {stage==='paper'&&paperUI&&<><button className="doodle-confirm pop-in" onClick={startCopy} aria-label="选好了，复制给 AI">
            <img className="doodle-confirm-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-confirm-label boil-copy">选好了，复制给 AI</span>
          </button><p className="hint pop-in-late">粘贴到已连接 Paper 的 AI 对话里。</p></>}
          {stage==='handoff'&&<p className="hint">已复制</p>}
          {stage==='waiting'&&<><button className="primary" onClick={()=>void request('check')}>检查一下 <span>→</span></button><button className="text-button" onClick={()=>setStage('idle')}>稍后</button><p className="hint">检查本地文件与编译，不读取 AI 对话。</p></>}
          {stage==='checking'&&<p className="hint">正在验证代码、依赖和示例构建，请稍候。</p>}
          {stage==='fix'&&<><button className="primary" onClick={()=>void copy(`请修复 Imagine Lab 检查发现的问题，项目：${root}。\n${report?.issues?.join('\n')||fix}\n按 public/imagine/rules.md 和 schema.json 补齐交付。不要绕过检查，不要提交 GitHub。修复后提醒我回 Imagine Lab 重新检查。`,'waiting')}>告诉 AI 修一下 <span>↗</span></button><button className="text-button" onClick={()=>void request('check')}>已修好，重新检查</button></>}
          {stage==='pass'&&(report?.ok?<><button className="primary" onClick={()=>void copy(`Imagine Lab 已完成本地结构、TypeScript 与示例构建检查（检查 ID：${report?.id}）。项目：${root}。请先确认目标 GitHub 仓库、分支及本次文件清单，确认无敏感信息后，仅提交本次组件、.imagine/manifest.json 和必要依赖文件。不要上传无关修改，不要强推。返回 owner/repo、分支和 commit SHA。检查不代表视觉验收。`,'github')}>交给 AI 收尾 <span>↗</span></button><p className="hint">只检查了完整性与构建，视觉仍由你确认。</p></>:<><p className="hint">这是完成后的状态。需要先通过真实检查。</p><button className="text-button" onClick={()=>{setTimelineStep(3);setStage('waiting');}}>回到检查 →</button></>)}
          {stage==='github'&&<form onSubmit={e=>{e.preventDefault();void request('sync');}}><label>GitHub 仓库<input required value={repo} onChange={e=>setRepo(e.target.value.trim())} placeholder="owner/repo" autoComplete="off"/></label><label>分支<input required value={branch} onChange={e=>setBranch(e.target.value)} placeholder="AI 刚提交的分支" autoComplete="off"/></label><button className="primary" type="submit">看看有没有回来 <span>↙</span></button><p className="hint">只读 GitHub，核对本次交付的文件内容。</p><button type="button" className="text-button" onClick={()=>void request('check')}>重新检查本地交付</button></form>}
          {stage==='done'&&<><button className="primary" onClick={()=>setStage('catalog')}>看看组件 <span>→</span></button><a className="text-button" href={report?.url} target="_blank" rel="noreferrer">提交 {report?.commit?.slice(0,7)} ↗</a></>}
        </div>
      </>}
      {stage==='catalog'&&<section className="catalog">
        <h1>下次，接着用。</h1>{report?.commit&&<p className="hint">已核对 GitHub · {report.commit.slice(0,7)}</p>}
        {report?.components?.map(c=><article key={c.componentId}>
          {c.previewUrl&&<img className="component-preview" src={c.previewUrl} alt={c.name+' 运行预览'}/>}
          <div><small>{c.category}</small><h2>{c.name}</h2><p>{c.componentId}</p>{!c.previewUrl&&<small>未提供预览图</small>}</div>
          <div className="catalog-actions"><a href={c.url} target="_blank" rel="noreferrer">查看代码 ↗</a><button onClick={()=>void copy(`请复用这个 GitHub 组件：${c.url}。组件 ID：${c.componentId}，固定 commit：${report?.commit}。先读取 README、index.tsx、example.tsx 和依赖，遵守项目规则，不要凭名称重新画一个。`,'catalog')}>复制给 AI</button></div>
        </article>)}
        {!report?.components?.length&&<p className="hint">组件整理并同步后，会出现在这里。</p>}
        <p className="hint" role="status">{notice}</p><button className="text-button" onClick={()=>{setStage('idle');setReport(null);}}>再整理一份 →</button>
      </section>}
      {error&&stage!=='fix'&&<p className="error" role="alert">{error}</p>}
      {['fix','pass'].includes(stage)&&<details open={details} onToggle={e=>setDetails(e.currentTarget.open)}><summary>检查详情</summary>{report?.checks?.map(c=><p key={c.name}>{c.ok?'✓':'—'} {c.name}</p>)}{stage==='fix'&&<pre>{report?.issues?.join('\n')||fix}</pre>}</details>}
      {manual&&<section className="manual"><label htmlFor="manual-copy">手动复制指令</label><textarea id="manual-copy" ref={manualRef} value={manual} readOnly/><button className="primary" onClick={()=>{setManual('');setError('');setStage(pending);}}>我已复制 →</button></section>}
    </main>
    <Timeline currentStep={timelineStep} onStepChange={navigateTimeline}/>

  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
