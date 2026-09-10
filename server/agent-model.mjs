// Shared, deterministic canvas operations. Model output never becomes executable HTML/JS.
export const styleKeys = new Set('color backgroundColor borderColor borderWidth borderStyle borderRadius padding paddingTop paddingRight paddingBottom paddingLeft gap rowGap columnGap fontSize fontWeight lineHeight letterSpacing textAlign width height minWidth minHeight maxWidth maxHeight display flexDirection alignItems justifyContent flexWrap flexGrow flexShrink opacity left top position overflow'.split(' '));
const tags = new Set('div span p h1 h2 h3 h4 section article header footer main nav button small b strong em i br'.split(' '));
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
export function cleanStyle(value) {
  if (!plain(value)) throw new Error('样式必须是对象');
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (!styleKeys.has(key) || !['string','number'].includes(typeof item) || (typeof item === 'number' && !Number.isFinite(item)) || String(item).length > 100 || /url\s*\(|expression|javascript|[<>;{}]|var\s*\(/i.test(String(item))) throw new Error(`不支持的样式：${key}`);
    if (key === 'position' && !['relative','absolute','static'].includes(item)) throw new Error('页面元素只能在自己的画板内定位');
    result[key] = item;
  }
  return result;
}
export function validateTree(tree) {
  const ids = new Set(); let count = 0;
  function visit(node, depth) {
    if (++count > 600 || depth > 25 || !plain(node) || typeof node.id !== 'string' || !node.id || node.id.length > 120 || ids.has(node.id)) throw new Error('页面结构无效、重复或过大');
    ids.add(node.id);
    if (!tags.has(node.type)) throw new Error('页面包含不支持的元素');
    if (typeof node.name !== 'string' || node.name.length > 120 || (node.text != null && (typeof node.text !== 'string' || node.text.length > 10000)) || !Array.isArray(node.children)) throw new Error('页面节点字段无效');
    return {id:node.id,name:node.name,type:node.type,text:node.text,style:cleanStyle(node.style || {}),children:node.children.map(child=>visit(child,depth+1))};
  }
  return visit(tree,0);
}
export function findNode(tree,id) { if(tree.id===id)return tree;for(const child of tree.children||[]){const found=findNode(child,id);if(found)return found;} }
export function applyChanges(pages, changes) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 40) throw new Error('修改数量必须在 1–40 项之间');
  const next=structuredClone(pages), descriptions=[];
  for(const change of changes){
    if(!plain(change))throw new Error('修改格式无效');
    if(change.type==='add_page'){
      if(next.length>=20 || typeof change.pageId!=='string' || !change.pageId || next.some(p=>p.id===change.pageId))throw new Error('新页面标识重复或页面数量已达上限');
      if(typeof change.title!=='string'||!change.title.trim()||change.title.length>100)throw new Error('新页面需要有效标题');
      const tree=validateTree(typeof change.tree==='string'?JSON.parse(change.tree):change.tree);
      next.push({id:change.pageId,title:change.title,tree});descriptions.push(`新增页面「${change.title}」`);continue;
    }
    const page=next.find(p=>p.id===change.pageId);if(!page)throw new Error('目标页面不存在，请重新读取项目');
    if(change.type!=='update_node')throw new Error('不支持的修改操作');
    const node=findNode(page.tree,change.nodeId);if(!node)throw new Error('目标元素不存在，请重新读取页面');
    if(change.text!=null){if(typeof change.text!=='string'||change.text.length>10000||node.children?.length)throw new Error('只允许修改纯文本节点的文案');descriptions.push(`${node.name}：${String(node.text||'').slice(0,70)} → ${change.text.slice(0,70)}`);node.text=change.text;}
    if(change.style!=null){const style=cleanStyle(typeof change.style==='string'?JSON.parse(change.style):change.style);node.style={...node.style,...style};descriptions.push(`${node.name}：调整 ${Object.keys(style).join('、')}`);}
    if(change.text==null&&change.style==null)throw new Error('修改内容为空');
  }
  return {pages:next,descriptions};
}
