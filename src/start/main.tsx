import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {BoilingLines} from './BoilingLines';

type Stage='idle'|'prepare'|'paper'|'handoff'|'waiting'|'checking'|'fix'|'pass'|'github'|'syncing'|'done'|'catalog';
type Component={componentId:string;name:string;category:string;path:string;source:string;url?:string;previewUrl?:string};
type Report={ok:boolean;issues?:string[];checks?:{name:string;ok:boolean}[];components?:Component[];commit?:string;url?:string;message?:string;id?:string};
const text:Record<Stage,string>={idle:'从设计稿整理组件？',prepare:'',paper:'先在 Paper 里选中要整理的页面。',handoff:'交给 AI 吧。',waiting:'AI 整理好了？',checking:'我看看有没有漏东西。',fix:'有一点要补齐。',pass:'都齐了。',github:'放进去了吗？',syncing:'去 GitHub 看看。',done:'看到了，已经进组件库。',catalog:'你的组件，下次接着用。'};
function saved(){try{return JSON.parse(localStorage.getItem('imagine-v1')||'{}');}catch{return {};}}
function App(){
  const [stage,setStage]=useState<Stage>(saved().waiting?'waiting':'idle');
  const [root,setRoot]=useState('');
  const [repo,setRepo]=useState<string>(saved().repo||'');
  const [branch,setBranch]=useState<string>(saved().branch||'');
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [manual,setManual]=useState('');
  const [pending,setPending]=useState<Stage>('waiting');
  const [details,setDetails]=useState(false);
  const [reduced,setReduced]=useState(false);
  const [frame,setFrame]=useState(0);
  const [notice,setNotice]=useState('');
  const [catalog,setCatalog]=useState<Report|null>(null);
  const manualRef=useRef<HTMLTextAreaElement>(null);
  const active=useRef(false);
  useEffect(()=>{[0,1,2].forEach(n=>{const image=new Image();image.src=`/mascot/idle-${String(n).padStart(2,'0')}.png`;});},[]);
  useEffect(()=>{fetch('/api/lab/catalog').then(r=>r.json()).then(d=>{if(d.ok)setCatalog(d);}).catch(()=>{});},[]);
  useEffect(()=>{fetch('/api/lab/context').then(r=>r.json()).then(d=>setRoot(d.root||'')).catch(()=>{});const q=matchMedia('(prefers-reduced-motion: reduce)');setReduced(q.matches);const change=()=>setReduced(q.matches);q.addEventListener('change',change);return()=>q.removeEventListener('change',change);},[]);
  useEffect(()=>{try{localStorage.setItem('imagine-v1',JSON.stringify({waiting:!['idle','prepare','paper'].includes(stage),repo,branch}));}catch{/* Optional storage. */}},[stage,repo,branch]);
  useEffect(()=>{if(stage==='prepare'){const id=setTimeout(()=>setStage('paper'),reduced?0:750);return()=>clearTimeout(id);}if(stage==='handoff'){const id=setTimeout(()=>setStage('waiting'),reduced?300:1400);return()=>clearTimeout(id);}},[stage,reduced]);
  useEffect(()=>{
    setFrame(0);if(reduced||!['idle','waiting'].includes(stage))return;
    const frames=[0,1,0,2,0,1,0],timing=[3100,130,2200,700,2400,150,1800];let index=0, timer:ReturnType<typeof setTimeout>;
    const tick=()=>{timer=setTimeout(()=>{index=(index+1)%frames.length;setFrame(frames[index]);tick();},timing[index]);};tick();return()=>clearTimeout(timer);
  },[stage,reduced]);
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
  const fix=report?.issues?.[0]||error||'检查未完成，请检查本地服务与 manifest。';
  const working=['prepare','checking','syncing','handoff'].includes(stage);
  return <div className="app">
    <BoilingLines/>
    <header><a href="/" className="brand" aria-label="Imagine Lab 首页"><span className="brand-wordmark boil-logo">imagine lab<span>.</span></span></a><nav>{catalog&&<button className="text-button" onClick={()=>{setReport(catalog);setStage('catalog');setError('');setNotice('');}}>组件目录</button>}<a className="quiet-link" href="/imagine/rules.md" target="_blank" rel="noreferrer">整理规则 ↗</a></nav></header>
    <main className={'scene stage-'+stage} aria-busy={working}>
      {stage!=='catalog'&&<>
        <div className="speech-area" aria-live="polite"><h1 key={stage} className="speech">{stage==='prepare'?<span className="ink-dots" aria-label="准备整理规则"><i/><i/><i/></span>:<span className="boil-copy">{stage==='fix'?(fix.length>65?'有一点要补齐。':fix):text[stage]}</span>}</h1></div>
        <div className={'character '+(['idle','waiting'].includes(stage)?'breathing':'')}>
          <img className="boil-character" width="336" height="304" src={`/mascot/idle-${String(frame).padStart(2,'0')}.png`} alt="戴着帽子和圆眼镜的小人"/>
          {stage==='idle'&&<button className="doodle-start" onClick={()=>setStage('prepare')} aria-label="开始">
            <img className="doodle-start-art boil-character" src="/mascot/start-button.png" alt="" aria-hidden="true"/>
            <span className="doodle-start-label boil-copy">开始</span>
          </button>}
          {stage==='handoff'&&<span className="paper-note" aria-hidden="true">↗</span>}
          {stage==='checking'&&<span className="small-symbol" aria-hidden="true">⌕</span>}
          {['pass','done'].includes(stage)&&<span className="parcel" aria-hidden="true">▧</span>}
        </div>
        <div className="actions">
          {stage==='paper'&&<><button className="primary" onClick={startCopy}>选好了，复制给 AI <span>↗</span></button><p className="hint">粘贴到已连接 Paper 的 AI 对话里。</p></>}
          {stage==='handoff'&&<p className="hint">已复制</p>}
          {stage==='waiting'&&<><button className="primary" onClick={()=>void request('check')}>检查一下 <span>→</span></button><button className="text-button" onClick={()=>setStage('idle')}>稍后</button><p className="hint">检查本地文件与编译，不读取 AI 对话。</p></>}
          {stage==='checking'&&<p className="hint">正在验证代码、依赖和示例构建，请稍候。</p>}
          {stage==='fix'&&<><button className="primary" onClick={()=>void copy(`请修复 Imagine Lab 检查发现的问题，项目：${root}。\n${report?.issues?.join('\n')||fix}\n按 public/imagine/rules.md 和 schema.json 补齐交付。不要绕过检查，不要提交 GitHub。修复后提醒我回 Imagine Lab 重新检查。`,'waiting')}>告诉 AI 修一下 <span>↗</span></button><button className="text-button" onClick={()=>void request('check')}>已修好，重新检查</button></>}
          {stage==='pass'&&<><button className="primary" onClick={()=>void copy(`Imagine Lab 已完成本地结构、TypeScript 与示例构建检查（检查 ID：${report?.id}）。项目：${root}。请先确认目标 GitHub 仓库、分支及本次文件清单，确认无敏感信息后，仅提交本次组件、.imagine/manifest.json 和必要依赖文件。不要上传无关修改，不要强推。返回 owner/repo、分支和 commit SHA。检查不代表视觉验收。`,'github')}>交给 AI 收尾 <span>↗</span></button><p className="hint">只检查了完整性与构建，视觉仍由你确认。</p></>}
          {stage==='github'&&<form onSubmit={e=>{e.preventDefault();void request('sync');}}><label>GitHub 仓库<input required value={repo} onChange={e=>setRepo(e.target.value.trim())} placeholder="owner/repo" autoComplete="off"/></label><label>分支<input required value={branch} onChange={e=>setBranch(e.target.value)} placeholder="AI 刚提交的分支" autoComplete="off"/></label><button className="primary" type="submit">看看有没有回来 <span>↙</span></button><p className="hint">只读 GitHub，核对本次交付的文件内容。</p><button type="button" className="text-button" onClick={()=>void request('check')}>重新检查本地交付</button></form>}
          {stage==='done'&&<><button className="primary" onClick={()=>setStage('catalog')}>看看组件 <span>→</span></button><a className="text-button" href={report?.url} target="_blank" rel="noreferrer">提交 {report?.commit?.slice(0,7)} ↗</a></>}
        </div>
      </>}
      {stage==='catalog'&&<section className="catalog">
        <h1>下次，接着用。</h1><p className="hint">已核对 GitHub · {report?.commit?.slice(0,7)}</p>
        {report?.components?.map(c=><article key={c.componentId}>
          {c.previewUrl&&<img className="component-preview" src={c.previewUrl} alt={c.name+' 运行预览'}/>}
          <div><small>{c.category}</small><h2>{c.name}</h2><p>{c.componentId}</p>{!c.previewUrl&&<small>未提供预览图</small>}</div>
          <div className="catalog-actions"><a href={c.url} target="_blank" rel="noreferrer">查看代码 ↗</a><button onClick={()=>void copy(`请复用这个 GitHub 组件：${c.url}。组件 ID：${c.componentId}，固定 commit：${report?.commit}。先读取 README、index.tsx、example.tsx 和依赖，遵守项目规则，不要凭名称重新画一个。`,'catalog')}>复制给 AI</button></div>
        </article>)}
        <p className="hint" role="status">{notice}</p><button className="text-button" onClick={()=>{setStage('idle');setReport(null);}}>再整理一份 →</button>
      </section>}
      {error&&stage!=='fix'&&<p className="error" role="alert">{error}</p>}
      {['fix','pass'].includes(stage)&&<details open={details} onToggle={e=>setDetails(e.currentTarget.open)}><summary>检查详情</summary>{report?.checks?.map(c=><p key={c.name}>{c.ok?'✓':'—'} {c.name}</p>)}{stage==='fix'&&<pre>{report?.issues?.join('\n')||fix}</pre>}</details>}
      {manual&&<section className="manual"><label htmlFor="manual-copy">手动复制指令</label><textarea id="manual-copy" ref={manualRef} value={manual} readOnly/><button className="primary" onClick={()=>{setManual('');setError('');setStage(pending);}}>我已复制 →</button></section>}
    </main>
    <footer><span className="boil-slogan">一小步，让设计再用一次。</span><details><summary>本地工作目录</summary><p>{root||'未连接本地服务，请运行 npm run preview:real。'}</p><p>更换项目：设置 IMAGINE_PROJECT_ROOT 后重启服务。刷新后需重新检查，不沿用旧的通过结果。</p></details></footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
