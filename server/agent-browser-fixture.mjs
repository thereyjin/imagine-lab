// Explicit, isolated UI test harness. Never used by preview:real.
import http from 'node:http';
import {spawn} from 'node:child_process';
const model=http.createServer(async(req,res)=>{
  let text='';for await(const c of req)text+=c;const data=JSON.parse(text);
  if(!data.stream){res.setHeader('Content-Type','application/json');res.end('{"status":"completed"}');return;}
  const results=data.input.filter(i=>i.type==='function_call_output');
  const context=results[0]?JSON.parse(results[0].output):null;
  const page=results[1]?JSON.parse(results[1].output):null;
  let name,args;
  if(!context){name='read_project';args={};}
  else if(!page){name='inspect_page';args={pageId:context.pages[0].id};}
  else if(results.length===2){
    const leaves=[];const walk=n=>{if(n.text&&!n.children.length)leaves.push(n);n.children.forEach(walk);};walk(page.tree);
    const add=data.input.some(i=>i.role==='user'&&i.content.includes('新增验收页面'));
    name='propose_changes';args={summary:add?'新增一个验收页面':'将首个文本节点更新为验收标题',changes:[add?{type:'add_page',pageId:'acceptance-page',nodeId:null,text:null,style:null,title:'验收页面',tree:JSON.stringify({id:'new-root',name:'验收页面',type:'div',style:{width:390,height:600,display:'flex',flexDirection:'column',padding:32,gap:16,backgroundColor:'#FFFFFF'},children:[{id:'new-title',name:'页面标题',type:'h1',text:'新页面已生成',style:{fontSize:28,color:'#234a39'},children:[]}]})}:{type:'update_node',pageId:page.id,nodeId:leaves[0].id,text:'验收测试：标题已更新',style:null,title:null,tree:null}]};
  }
  const slow=data.input.some(i=>i.role==='user'&&i.content.includes('停止测试'));
  const timer=setTimeout(()=>{if(res.destroyed)return;res.writeHead(200,{'Content-Type':'text/event-stream'});const output=name?[{id:'fn'+results.length,type:'function_call',call_id:'call'+results.length,name,arguments:JSON.stringify(args)}]:[];if(!name)res.write('data: '+JSON.stringify({type:'response.output_text.delta',delta:'这是隔离测试返回的方案，点击应用后更新画布。'})+'\n\n');res.end('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',output}})+'\n\n');},slow?5000:150);
  res.on('close',()=>clearTimeout(timer));
});
await new Promise((resolve,reject)=>{model.once('error',reject);model.listen(0,'127.0.0.1',resolve);});
const child=spawn(process.execPath,['server/preview.mjs'],{stdio:'inherit',env:{...process.env,PORT:'4185',OPENAI_BASE_URL:`http://127.0.0.1:${model.address().port}`,OPENAI_API_KEY:'fixture-only-not-a-real-key',OPENAI_MODEL:'integration-test'}});
const close=()=>{child.kill();model.closeAllConnections();model.close();};process.on('SIGINT',close);process.on('SIGTERM',close);
