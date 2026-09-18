// Compile only. No application code or npm scripts are executed.
import {build} from 'vite';
import {parseSync} from 'rolldown/utils';
import path from 'node:path';
import {readFileSync, existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [root,...entries]=process.argv.slice(2);
let temp;
try{
  if(!existsSync(path.join(root,'tsconfig.json')))throw new Error('缺少 tsconfig.json');
  const pkg=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
  const declared={...pkg.dependencies,...pkg.devDependencies,...pkg.peerDependencies};
  const files=[];
  function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw new Error('组件不能包含符号链接');const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.[cm]?[jt]sx?$/.test(p))files.push(p);}}
  for(const entry of entries)walk(path.dirname(path.join(root,entry)));
  for(const file of new Set(files)){
    const parsed=parseSync(file,readFileSync(file,'utf8'));
    if(parsed.errors.length)throw new Error(`${file}: ${parsed.errors[0].message}`);
    if(entries.some(e=>path.join(root,e)===file)&&!parsed.program.body.some(n=>n.type==='ImportDeclaration'&&['.','./index','./index.tsx'].includes(n.source.value)))throw new Error(`${file}: example 必须显式导入同目录组件 ./index，不能用空示例代替。`);
    function visit(n){
      if(!n||typeof n!=='object')return;
      if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)&&n.source){
        const spec=n.source.value;
        if(!spec.startsWith('.')&&!spec.startsWith('/')&&!spec.startsWith('@/')){
          const name=spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0];
          if(!declared[name])throw new Error(`${file}: 依赖 ${name} 未在 package.json 中声明。`);
        }
      }
      if(n.type==='JSXAttribute'&&['src','poster'].includes(n.name.name)&&n.value?.type==='Literal'){
        const value=n.value.value;
        if(value&&!/^(https?:|data:|#)/.test(value)&&!existsSync(value.startsWith('/')?path.join(root,'public',value):path.resolve(path.dirname(file),value)))throw new Error(`资源不存在：${value}`);
      }
      for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);
    }visit(parsed.program);
  }
  temp=mkdtempSync(path.join(tmpdir(),'imagine-tsc-'));
  const config=path.join(temp,'tsconfig.json');
  writeFileSync(config,JSON.stringify({extends:path.join(root,'tsconfig.json'),compilerOptions:{noEmit:true,incremental:false,composite:false},files:[...new Set(files)],include:[],exclude:[]}));
  const cli=fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url));
  const result=spawnSync(process.execPath,[cli,'--project',config,'--pretty','false'],{cwd:root,timeout:60000,encoding:'utf8',maxBuffer:1024*1024});
  if(result.status!==0)throw new Error((result.stdout||result.stderr||result.error?.message||'TypeScript 检查失败').slice(0,2400));
  process.stdout.write(JSON.stringify({phase:'types',ok:true})+'\n');
  await build({root,configFile:false,envFile:false,logLevel:'silent',publicDir:false,build:{write:false,lib:{entry:entries.map(p=>path.join(root,p)),formats:['es']},rollupOptions:{external:['react','react-dom','react/jsx-runtime']}}});
  process.stdout.write(JSON.stringify({phase:'build',ok:true})+'\n');
}catch(error){const message=String(error.message).slice(0,2400);const diagnostics=message.split('\n').filter(Boolean).map(message=>{const m=message.match(/^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);return m?{file:path.relative(root,path.resolve(root,m[1])),line:Number(m[2]),column:Number(m[3]),code:m[4],message:m[5]}:{message};});process.stdout.write(JSON.stringify({phase:'failure',message,diagnostics})+'\n');process.exitCode=1;}
finally{if(temp)rmSync(temp,{recursive:true,force:true});}
