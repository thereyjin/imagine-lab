// Isolated UI acceptance fixture: real TSX checks, simulated GitHub only.
// Never writes to the official component repository or pushes a commit.
import {mkdtemp,mkdir,writeFile,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const app=process.cwd();
if(process.argv[2]==='ready'){
 const [,, ,root,taskId,revision='1']=process.argv;
 if(!root?.startsWith(path.join(tmpdir(),'imagine-flow-')))throw new Error('Expected isolated QA directory');
 await writeFile(path.join(root,`.imagine/task-${taskId}.json`),JSON.stringify({taskId,status:'ready',revision,source:{file:'Acceptance fixture',artboard:'Button demo',nodeId:'fixture-button'},components:['button'],previewUrl:'http://127.0.0.1:4187/'}));
 process.exit(0);
}
const root=await mkdtemp(path.join(tmpdir(),'imagine-flow-'));
await mkdir(path.join(root,'.imagine'));await mkdir(path.join(root,'.state'));await mkdir(path.join(root,'src/components/Button/assets'),{recursive:true});
await symlink(path.join(app,'node_modules'),path.join(root,'node_modules'),'dir');
const put=(p,data)=>writeFile(path.join(root,p),typeof data==='string'?data:JSON.stringify(data));
await put('package.json',{dependencies:{react:'latest','react-dom':'latest'}});
await put('tsconfig.json',{compilerOptions:{jsx:'react-jsx',moduleResolution:'Bundler',module:'ESNext',target:'ES2022',skipLibCheck:true,strict:true,esModuleInterop:true}});
await put('src/components/Button/index.tsx','import {useState} from "react"; export default function Button(){const [count,setCount]=useState(0);return <button style={{padding:"14px 26px",background:"#b9d9ff",border:"2px solid #29282f",borderRadius:18,fontSize:18}} onClick={()=>setCount(count+1)}>点一下 · {count}</button>}');
await put('src/components/Button/example.tsx','import Button from "./index"; export default function Example(){return <Button/>}');
await put('src/components/Button/README.md','# 用途\n交互检查\n# Props\n无\n# 依赖\nReact\n# 限制\n测试夹具\n# 示例\nexample.tsx');
await put('src/components/Button/assets/.gitkeep','');
await put('.imagine/manifest.json',{schemaVersion:1,project:'UI acceptance fixture',components:[{componentId:'button',name:'Button 验证组件',category:'通用',path:'src/components/Button',source:'fixture',status:'ready',framework:'react'}]});
await put('index.html','<html lang="zh"><head><meta charset="utf-8"><title>组件运行预览 · 验证环境</title></head><body style="background:#f8f7f3;display:grid;place-items:center;min-height:90vh"><div><h1>Button 运行预览</h1><p>此页仅用于验证 Imagine Lab 流程，不会发布到 GitHub。</p><div id="root"></div></div><script type="module" src="/preview.tsx"></script></body></html>');
await put('preview.tsx','import React from "react";import {createRoot} from "react-dom/client";import Example from "./src/components/Button/example";createRoot(document.getElementById("root")!).render(<Example/>);');
await put('.state/workspace.json',{root,repo:'fixture/repo',ref:'main'});
await put('mock-github.mjs',`import {readFileSync,readdirSync} from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';const root=process.env.IMAGINE_PROJECT_ROOT;globalThis.fetch=async()=>{const files=['.imagine/manifest.json','package.json','tsconfig.json'];const walk=p=>{for(const e of readdirSync(path.join(root,p),{withFileTypes:true})){const next=p+'/'+e.name;e.isDirectory()?walk(next):files.push(next)}};walk('src/components');const sha=p=>{const b=readFileSync(path.join(root,p));return createHash('sha1').update('blob '+b.length+'\\0').update(b).digest('hex')};return Response.json({sha:'fixture-only-no-push',commit:{tree:{sha:'fixture-tree'}},tree:files.map(p=>({path:p,type:'blob',sha:sha(p)}))});};`);
const child=spawn(process.execPath,['--import',path.join(root,'mock-github.mjs'),'server/lab.mjs'],{cwd:app,env:{...process.env,PORT:'4174',IMAGINE_PROJECT_ROOT:root,IMAGINE_STATE_DIR:path.join(root,'.state')},stdio:'inherit'});
const preview=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:4187,strictPort:true}});await preview.listen();
process.on('SIGTERM',()=>{child.kill();void preview.close();});process.on('SIGINT',()=>{child.kill();void preview.close();});
console.log('QA_ROOT='+root);
