import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export function localPreview(value){
  try{const url=new URL(value);return url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export async function deliveryTask(root,id){
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(id||''))throw new Error('任务编号无效');
  root=await realpath(root);
  const relative=`.imagine/task-${id}.json`;
  let file;
  try{file=await realpath(path.join(root,relative));}catch(e){if(e.code==='ENOENT')return {ok:true,status:'waiting',taskId:id};throw e;}
  if(!file.startsWith(root+path.sep))throw new Error('任务记录必须位于项目内');
  if((await stat(file)).size>128*1024)throw new Error('任务记录过大');
  let task,bytes;
  try{bytes=await readFile(file);task=JSON.parse(bytes);}catch{return {ok:true,status:'writing',taskId:id};}
  if(task.taskId!==id)return {ok:true,status:'waiting',taskId:id};
  const ready=task.status==='ready'&&typeof task.revision==='string'&&task.revision.length>0&&task.source?.artboard&&task.source?.nodeId&&Array.isArray(task.components)&&task.components.length>0;
  return {ok:true,taskId:id,status:ready?'ready':'writing',revision:createHash('sha256').update(bytes).digest('hex'),previewUrl:localPreview(task.previewUrl),source:task.source,components:task.components};
}
