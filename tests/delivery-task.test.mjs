import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {deliveryTask,localPreview} from '../server/delivery-task.mjs';

test('delivery only becomes ready for this completed task, revisions trigger another check',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'imagine-delivery-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'.imagine'));
 const file=path.join(root,'.imagine/task-current.json');
 assert.equal((await deliveryTask(root,'current')).status,'waiting');
 await writeFile(file,'{"taskId":');assert.equal((await deliveryTask(root,'current')).status,'writing');
 const task={taskId:'old',status:'ready',revision:'1',source:{artboard:'Home',nodeId:'A-1'},components:['button'],previewUrl:'http://127.0.0.1:4180/'};
 await writeFile(file,JSON.stringify(task));assert.equal((await deliveryTask(root,'current')).status,'waiting');
 task.taskId='current';task.status='writing';await writeFile(file,JSON.stringify(task));assert.equal((await deliveryTask(root,'current')).status,'writing');
 task.status='ready';await writeFile(file,JSON.stringify(task));const ready=await deliveryTask(root,'current');assert.equal(ready.status,'ready');assert.equal(ready.previewUrl,task.previewUrl);
 task.revision='2';await writeFile(file,JSON.stringify(task));assert.notEqual((await deliveryTask(root,'current')).revision,ready.revision);
 await assert.rejects(()=>deliveryTask(root,'../../bad'),/任务编号/);
});
test('preview links only allow credential-free local HTTP previews',()=>{
 for(const value of ['javascript:alert(1)','file:///etc/passwd','https://example.com','http://user:pass@localhost:4180/'])assert.equal(localPreview(value),null);
 assert.equal(localPreview('http://localhost:4180'),'http://localhost:4180/');
});
