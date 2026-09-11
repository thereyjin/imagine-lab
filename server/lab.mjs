import http from 'node:http';
import {readFile, realpath, stat, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=await realpath(process.env.IMAGINE_PROJECT_ROOT || appRoot);
const port=Number(process.env.PORT || 4174);
let checked=null, busy=false, catalog=null;
const previews=new Map();
const hash=b=>createHash('sha256').update(b).digest('hex');
const gitHash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function safeFile(relative){
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..')) throw new Error('组件路径必须位于当前项目内');
  const p=await realpath(path.join(root,relative));
  if(!p.startsWith(root+path.sep)) throw new Error('不能读取项目外的文件');
  return p;
}
async function inspect(){
  const issues=[],files=new Map();
  const read=async p=>{const b=await readFile(await safeFile(p));files.set(p,b);return b;};
  let manifest;
  try {manifest=JSON.parse((await read('.imagine/manifest.json')).toString());}catch{throw new Error('还没找到有效的 .imagine/manifest.json。让 AI 按规则生成它。');}
  if(manifest.schemaVersion!==1||typeof manifest.project!=='string'||!manifest.project.trim()||!Array.isArray(manifest.components)||!manifest.components.length||manifest.components.length>100)throw new Error('manifest 需要 schemaVersion: 1、project 和非空 components 数组（最多 100 项）。');
  const ids=new Set();
  for(const c of manifest.components){
    if(!c||!['componentId','name','path','framework','source','status','category'].every(k=>typeof c[k]==='string'&&c[k].trim())||!/^src\/components\/[\w/-]+$/.test(c.path)||c.framework!=='react'||c.status!=='ready'||ids.has(c.componentId)){issues.push('组件字段、路径、状态或 ID 不符合规则。');continue;}
    ids.add(c.componentId);
    if(c.preview!==undefined&&(!/^assets\/[\w./-]+\.(png|jpg|webp)$/.test(c.preview)||c.preview.includes('..'))){issues.push(`${c.name} 预览图路径无效。`);continue;}
    for(const name of ['index.tsx','example.tsx','README.md']){
      try{const b=await read(`${c.path}/${name}`);if(!b.length)throw new Error('empty');if(name==='README.md')for(const label of ['用途','Props','依赖','限制','示例'])if(!b.toString().includes(label))issues.push(`${c.name} 的 README 缺少「${label}」。`);}catch{issues.push(`${c.name} 缺少 ${name}。`);}
    }
    try{
      const dir=await safeFile(c.path+'/assets');if(!(await stat(dir)).isDirectory())throw new Error('not directory');
      // Capture all component files, including styles, supporting modules and assets.
      async function walk(p){for(const item of await readdir(await safeFile(p),{withFileTypes:true})){const next=p+'/'+item.name;if(item.isSymbolicLink())throw new Error('不支持组件内的符号链接');if(item.isDirectory())await walk(next);else {const s=await stat(await safeFile(next));if(s.size>10*1024*1024)throw new Error('单文件超过 10 MB');await read(next);}}}
      await walk(c.path);
      if(c.preview)await read(c.path+'/'+c.preview);
    }catch(e){issues.push(`${c.name} 资源检查：${e.message}`);}
  }
  for(const p of ['package.json','tsconfig.json'])try{await read(p);}catch{issues.push(`缺少 ${p}。`);}
  return {manifest,issues,files};
}
async function check(){
  checked=null;
  const {manifest,issues,files}=await inspect();
  const checks=[{name:'代码与交付结构',ok:!issues.length}];
  if(issues.length)return {ok:false,issues,checks};
  const output=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(appRoot,'server/component-check.mjs'),root,...manifest.components.map(c=>c.path+'/example.tsx')],{cwd:root,stdio:['ignore','pipe','pipe']});
    let text='',errors='';const timer=setTimeout(()=>child.kill('SIGKILL'),90000);
    child.stdout.on('data',b=>{text+=b;if(text.length>100000)child.kill();});child.stderr.on('data',b=>{errors=(errors+b).slice(-2000);});
    child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);resolve({code,text,errors});});
  });
  const events=output.text.trim().split('\n').flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}});
  checks.push({name:'TypeScript 与依赖',ok:events.some(e=>e.phase==='types')},{name:'示例构建与资源引用',ok:output.code===0});
  if(output.code!==0)return {ok:false,checks,issues:[events.find(e=>e.phase==='failure')?.message || '检查未完成或超过 90 秒，请在 AI 中查看编译结果。']};
  // Don't certify stale files changed during compilation.
  const fresh=await inspect();
  if(fresh.issues.length||[...files].some(([p,b])=>!fresh.files.has(p)||hash(b)!==hash(fresh.files.get(p)))||fresh.files.size!==files.size)throw new Error('检查期间文件有变化，请重新检查。');
  checked={id:randomUUID(),manifest,files,at:new Date().toISOString()};
  return {ok:true,checks,issues:[],id:checked.id,components:manifest.components,at:checked.at};
}
async function github(repo,ref){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||typeof ref!=='string'||!ref.trim()||ref.length>200)throw new Error('请填写 owner/repo 和分支名。');
  if(!checked)throw new Error('请先完成本地检查。服务重启后需重新检查。');
  const local=await inspect();
  if(local.issues.length||local.files.size!==checked.files.size||[...checked.files].some(([p,b])=>!local.files.has(p)||hash(b)!==hash(local.files.get(p)))){checked=null;throw new Error('本地交付已变化，请先重新检查。');}
  const api=async suffix=>{
    const response=await fetch(`https://api.github.com/repos/${repo}/${suffix}`,{headers:{Accept:'application/vnd.github+json',...(process.env.IMAGINE_GITHUB_TOKEN?{Authorization:`Bearer ${process.env.IMAGINE_GITHUB_TOKEN}`}:{})},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(response.status===404?'仓库或分支不可见。私有仓库需在本地服务配置只读 Token。':response.status===403||response.status===429?'GitHub 权限不足或请求限流，请稍后再试。':`GitHub 读取失败（${response.status}）`);
    return response.json();
  };
  const commit=await api('commits/'+encodeURIComponent(ref));
  const tree=await api(`git/trees/${commit.commit.tree.sha}?recursive=1`);
  if(tree.truncated)throw new Error('仓库目录过大，尚不支持完整验证。');
  const blobs=new Map(tree.tree.filter(e=>e.type==='blob').map(e=>[e.path,e.sha]));
  const mismatch=[...checked.files].filter(([p,b])=>blobs.get(p)!==gitHash(b)).map(([p])=>p);
  if(mismatch.length)return {ok:false,message:`还没看到本次交付：${mismatch[0]} 尚未同步。`,commit:commit.sha};
  const components=checked.manifest.components.map(c=>{
    const preview=c.preview?checked.files.get(c.path+'/'+c.preview):null;
    const key=preview?hash(preview):null;if(key)previews.set(key,{bytes:preview,type:types[path.extname(c.preview)]});
    return {...c,previewUrl:key?`/api/lab/preview/${key}`:undefined,url:`https://github.com/${repo}/tree/${commit.sha}/${c.path}`};
  });
  catalog={ok:true,commit:commit.sha,url:`https://github.com/${repo}/commit/${commit.sha}`,components};return catalog;
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    // Local only; reject cross-origin writes and DNS rebinding.
    if(!['127.0.0.1','localhost'].includes((req.headers.host||'').split(':')[0]))return json(res,403,{error:'仅支持本地访问'});
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/api/lab/context')return json(res,200,{root,privateRead:!!process.env.IMAGINE_GITHUB_TOKEN});
    if(req.method==='GET'&&url.pathname==='/api/lab/catalog')return json(res,200,catalog||{ok:false,components:[]});
    if(req.method==='GET'&&url.pathname.startsWith('/api/lab/preview/')){
      const image=previews.get(url.pathname.split('/').pop());if(!image)return json(res,404,{error:'暂无预览'});
      res.writeHead(200,{'Content-Type':image.type,'X-Content-Type-Options':'nosniff'});res.end(image.bytes);return;
    }
    if(url.pathname.startsWith('/api/lab/')){
      if(req.method!=='POST'||req.headers['x-imagine-request']!=='local'||(req.headers.origin&&!['http://127.0.0.1:4174','http://localhost:4174','http://localhost:5173','http://127.0.0.1:5173'].includes(req.headers.origin)))return json(res,403,{error:'请求来源不允许'});
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return json(res,413,{error:'请求过大'});}
      if(busy)return json(res,409,{error:'正在检查，请稍候。'});busy=true;
      try {const data=JSON.parse(body||'{}');if(url.pathname==='/api/lab/check')return json(res,200,await check());if(url.pathname==='/api/lab/sync')return json(res,200,await github(data.repo,data.ref));return json(res,404,{error:'未知操作'});}finally{busy=false;}
    }
    if(req.method!=='GET')return json(res,405,{error:'不支持此方法'});
    let p=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');
    if(p.includes('..'))return json(res,403,{error:'路径无效'});
    const file=path.join(appRoot,'dist',p);
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(bytes);
  }catch(error){json(res,400,{error:String(error.message).slice(0,2600)});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Imagine Lab: http://127.0.0.1:${server.address().port} · project: ${root}`));
