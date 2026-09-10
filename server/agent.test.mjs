import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {applyChanges,validateTree} from './agent-model.mjs';

const tree={id:'root',name:'页面',type:'div',style:{width:390,height:844},children:[{id:'title',name:'标题',type:'h1',text:'原标题',style:{},children:[]}]};
const pages=[{id:'p1',title:'测试页面',tree}];
const change={type:'update_node',pageId:'p1',nodeId:'title',text:'新的标题',style:null,title:null,tree:null};
test('修改文案与样式是原子操作，原页面不变',()=>{const result=applyChanges(pages,[change,{...change,text:null,style:'{"fontSize":28}'}]);assert.equal(result.pages[0].tree.children[0].text,'新的标题');assert.equal(result.pages[0].tree.children[0].style.fontSize,28);assert.equal(pages[0].tree.children[0].text,'原标题');});
test('任一目标不存在时整批失败',()=>{assert.throws(()=>applyChanges(pages,[change,{...change,nodeId:'missing'}]),/元素不存在/);assert.equal(pages[0].tree.children[0].text,'原标题');});
test('拒绝脚本、外部样式 URL 和画布外定位',()=>{for(const style of [{backgroundImage:'url(https://x.test)'},{color:'url(https://x.test)'},{position:'fixed'},{position:'sticky'},{dangerouslySetInnerHTML:'x'}])assert.throws(()=>applyChanges(pages,[{...change,style}]));assert.throws(()=>validateTree({...tree,type:'script'}));});
test('不覆盖非叶子节点的子内容',()=>assert.throws(()=>applyChanges(pages,[{...change,nodeId:'root'}]),/纯文本/));
test('新增页面结构完整且 ID 不重复',()=>{const result=applyChanges(pages,[{type:'add_page',pageId:'p2',title:'新页',tree:JSON.stringify(tree)}]);assert.equal(result.pages.length,2);assert.throws(()=>applyChanges(pages,[{type:'add_page',pageId:'p1',title:'新页',tree}]),/重复/);assert.throws(()=>validateTree({...tree,children:[tree]}),/重复/);});

let upstream,app,base,mode='normal',requests=0,aborted=false;
before(async()=>{
  upstream=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;const data=JSON.parse(raw);requests++;
    if(mode==='refuse'){res.writeHead(401);res.end('{}');return;}
    if(mode==='slow'){res.on('close',()=>{aborted=true;});return;}
    if(!data.stream){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'completed'}));return;}
    const toolsDone=data.input.filter(i=>i.type==='function_call_output').length;
    const name=toolsDone===0?'read_project':toolsDone===1?'inspect_page':toolsDone===2?'propose_changes':null;
    const args=name==='read_project'?{}:name==='inspect_page'?{pageId:'p1'}:{summary:'精简标题',changes:[change]};
    const output=name?[{type:'function_call',id:'fc'+toolsDone,call_id:'call'+toolsDone,name,arguments:JSON.stringify(args)}]:[];
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    if(!name)res.write('data: '+JSON.stringify({type:'response.output_text.delta',delta:'方案已准备，请应用。'})+'\r\n\r\n');
    const encoded=Buffer.from('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output}})+'\r\n\r\n');
    // Deliberately split a UTF-8 stream over network chunks.
    res.write(encoded.subarray(0,57));res.end(encoded.subarray(57));
  });
  await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
  process.env.OPENAI_BASE_URL=`http://127.0.0.1:${upstream.address().port}`;delete process.env.OPENAI_API_KEY;
  const {handleAgent}=await import('./agent.mjs');
  app=http.createServer(async(req,res)=>{if(!await handleAgent(req,res)){res.writeHead(404);res.end();}});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.address().port}`;
});
after(async()=>{app?.closeAllConnections();upstream?.closeAllConnections();await Promise.all([new Promise(r=>app?.close(r)),new Promise(r=>upstream?.close(r))]);});
const post=(path,data,options={})=>fetch(base+'/api/agent/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),...options});
const runData={context:{projectId:'isolated-test',name:'测试项目',pages,revision:0,selectedPageId:'p1'},messages:[{role:'user',content:'精简标题'}]};
test('没有密钥时明确报错，不产生假执行',async()=>{const res=await post('run',runData);assert.equal(res.status,428);assert.equal(requests,0);});
test('配置接口不回传密钥，测试连接实际访问模型',async()=>{const res=await post('config',{model:'test-model',key:'test-only-key'});const data=await res.json();assert.equal(data.configured,true);assert.ok(!JSON.stringify(data).includes('test-only-key'));assert.equal((await post('test',{})).status,200);assert.equal(requests,1);});
test('执行真实 HTTP 工具循环并形成未应用方案',async()=>{const res=await post('run',runData);assert.equal(res.status,200);const events=(await res.text()).trim().split('\n').map(JSON.parse);assert.equal(events.at(-1).type,'done');const proposal=events.find(e=>e.type==='proposal').proposal;assert.equal(proposal.baseRevision,0);assert.equal(events.filter(e=>e.type==='step'&&e.status==='done').length,4);assert.ok(events.some(e=>e.type==='delta'&&e.text.includes('方案')));assert.equal(pages[0].tree.children[0].text,'原标题');const applied=await post('apply',{context:runData.context,changes:proposal.changes});assert.equal((await applied.json()).pages[0].tree.children[0].text,'新的标题');});
test('跨站写请求被拒绝',async()=>{const res=await post('config',{model:'test',key:'x'},{headers:{'Content-Type':'application/json',Origin:'https://untrusted.test'}});assert.equal(res.status,403);});
test('模型认证失败进入明确错误终态',async()=>{mode='refuse';const events=(await (await post('run',runData)).text()).trim().split('\n').map(JSON.parse);assert.equal(events.at(-1).type,'error');assert.match(events.at(-1).message,/密钥无效/);mode='normal';});
test('同项目阻止并发，取消后释放任务锁和上游连接',async()=>{mode='slow';aborted=false;const controller=new AbortController();const response=await post('run',runData,{signal:controller.signal});const reader=response.body.getReader();await reader.read();await new Promise(r=>setTimeout(r,40));assert.equal((await post('run',runData)).status,409);controller.abort();await new Promise(r=>setTimeout(r,80));assert.equal(aborted,true);mode='normal';assert.equal((await post('run',runData)).status,200);});
test('损坏上下文、超量操作和错误页面不写入',async()=>{assert.equal((await post('run',{...runData,context:{pages:null}})).status,400);assert.equal((await post('apply',{context:runData.context,changes:[{...change,pageId:'other-project'}]})).status,400);assert.throws(()=>applyChanges(pages,Array(41).fill(change)));});
