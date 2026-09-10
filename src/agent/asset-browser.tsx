import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,ArrowDown,List,LayoutGrid,Search,X,Check,ArrowRight,SlidersHorizontal} from 'lucide-react';
import './asset-browser.css';

export type BrowsableAsset={id:string;name:string;type:'component'|'block';group:string;blockGroup?:string;terminal:string;scope:string;source?:string;temp?:boolean;description:string;scene:string[];createdAt?:number};
type Usage=Record<string,{lastUsed:number;count:number}>;
const defaults=['current','common'];
const orders=['最近使用','使用频率','最近添加','名称 A → Z','项目顺序'];
export function assetSource(item:BrowsableAsset,projectName:string){return item.scope==='core'?'通用':item.temp?projectName:item.source||projectName;}

export function AssetBrowser<T extends BrowsableAsset>({items,projectName,query,type,onType,view,onView,renderItems}:{items:T[];projectName:string;query:string;type:'component'|'block';onType:(v:'component'|'block')=>void;view:'card'|'list';onView:(v:'card'|'list')=>void;renderItems:(items:T[])=>React.ReactNode}){
  const root=useRef<HTMLDivElement>(null),opener=useRef<HTMLButtonElement|null>(null);
  const [menuTop,setMenuTop]=useState(0);
  const openMenu=(next:'filter'|'sort',event:React.MouseEvent<HTMLButtonElement>)=>{opener.current=event.currentTarget;setMenuTop(event.currentTarget.getBoundingClientRect().bottom-(root.current?.getBoundingClientRect().top||0)+6);setMenu(current=>current===next?null:next);};
  const closeMenu=()=>{setMenu(null);opener.current?.focus();};
  const [menu,setMenu]=useState<'filter'|'sort'|null>(null),[categories,setCategories]=useState<string[]>([]),[sources,setSources]=useState(defaults),[status,setStatus]=useState('published'),[platform,setPlatform]=useState('all'),[order,setOrder]=useState(orders[0]),[cross,setCross]=useState(false);
  const [usage,setUsage]=useState<Usage>(()=>{try{return JSON.parse(localStorage.getItem('imagine-lab.asset-usage')||'{}');}catch{return {};}});
  useEffect(()=>{const record=(e:Event)=>{const id=(e as CustomEvent<{id?:string}>).detail?.id;if(!id)return;setUsage(current=>{const next={...current,[id]:{lastUsed:Date.now(),count:(current[id]?.count||0)+1}};try{localStorage.setItem('imagine-lab.asset-usage',JSON.stringify(next));}catch{}return next;});};window.addEventListener('imagine-asset-used',record);return()=>window.removeEventListener('imagine-asset-used',record);},[]);
  useEffect(()=>{if(!query.trim()){setCross(false);setSources(defaults);}},[query]);
  useEffect(()=>{setCross(false);setSources(defaults);setCategories([]);setStatus('published');setPlatform('all');},[projectName]);
  useEffect(()=>{if(!menu)return;const dismiss=(e:PointerEvent)=>{if(!(e.target as Element).closest('.asset-filter-popover,.asset-sort-popover,.asset-filter-toggle,.asset-sort-toggle'))setMenu(null);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();closeMenu();}};document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',key);};},[menu]);
  const sourceKey=(item:T)=>item.scope==='core'?'common':assetSource(item,projectName)===projectName?'current':assetSource(item,projectName);
  const projects=Array.from(new Set(items.map(sourceKey))).filter(v=>!defaults.includes(v));
  const toggle=(values:string[],v:string)=>values.includes(v)?values.filter(x=>x!==v):[...values,v];
  const reset=()=>{setCategories([]);setSources(defaults);setStatus('published');setPlatform('all');setCross(false);};
  const matches=(item:T,ignoreType=false)=>{
    if(!ignoreType&&item.type!==type)return false;
    if(!cross&&!sources.includes(sourceKey(item)))return false;
    if(categories.length&&!categories.includes(item.type==='block'?item.blockGroup||item.group:item.group))return false;
    if(status==='published'&&item.temp||status==='draft'&&!item.temp)return false;
    if(platform!=='all'&&item.terminal!==platform&&item.terminal!=='universal')return false;
    return !query.trim()||[item.name,item.description,...item.scene,assetSource(item,projectName)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  };
  const counts=items.filter(i=>matches(i,true));
  const result=items.filter(i=>matches(i)).sort((a,b)=>{
    if(order===orders[0])return (usage[b.id]?.lastUsed||0)-(usage[a.id]?.lastUsed||0);
    if(order===orders[1])return (usage[b.id]?.count||0)-(usage[a.id]?.count||0);
    if(order===orders[2])return (b.createdAt||0)-(a.createdAt||0);
    if(order===orders[3])return a.name.localeCompare(b.name,'zh-CN');
    return sourceKey(a).localeCompare(sourceKey(b),'zh-CN');
  });
  const filterCount=categories.length+defaults.filter(s=>!sources.includes(s)).length+sources.filter(s=>!defaults.includes(s)).length+(status!=='published'?1:0)+(platform!=='all'?1:0);
  const noun=type==='component'?'组件':'区块';
  const filterLabel=filterCount===0?'全部'+noun:categories.length===1&&filterCount===1?categories[0]+noun:'已筛选 · '+filterCount;
  const categoryOptions=Array.from(new Set(items.filter(i=>i.type===type).map(i=>type==='block'?i.blockGroup||i.group:i.group)));
  const option=(label:string,active:boolean,fn:()=>void)=><button type="button" key={label} className={active?'is-active':''} aria-pressed={active} onClick={fn}><span className="asset-check">{active&&<Check/>}</span><span>{label}</span></button>;
  return <div className="asset-browser" ref={root}>
    <div className="asset-type-tabs" role="tablist" aria-label="内容类型">{(['component','block'] as const).map(t=><button key={t} role="tab" aria-selected={t===type} className={t===type?'active':''} onClick={()=>{onType(t);setCategories([]);setMenu(null);}}>{t==='component'?'组件':'区块'}<span>{counts.filter(i=>i.type===t).length}</span></button>)}</div>
    <div className="asset-browse-bar">
      <div className="asset-condition-field"><div className="asset-field-heading"><span>筛选</span>{filterCount>0&&<button className="asset-reset-inline" onClick={reset}>重置</button>}</div><button className={'asset-filter-toggle '+(filterCount?'has-filters':'')} aria-haspopup="dialog" aria-expanded={menu==='filter'} onClick={e=>openMenu('filter',e)} title="筛选资产"><span>{filterLabel}</span><ChevronDown/></button></div>
      <div className="asset-condition-field"><div className="asset-field-heading"><span>排序</span></div><button className="asset-sort-toggle" aria-haspopup="dialog" aria-expanded={menu==='sort'} onClick={e=>openMenu('sort',e)}><span>{order}</span><ChevronDown/></button></div>
      <div className="asset-display-field"><span className="asset-field-label">显示方式</span><div className="asset-view-toggle" role="group" aria-label="显示方式"><button title="列表视图" aria-pressed={view==='list'} className={view==='list'?'active':''} onClick={()=>{onView('list');setMenu(null);}}><List/><span>列表</span></button><button title="网格视图" aria-pressed={view==='card'} className={view==='card'?'active':''} onClick={()=>{onView('card');setMenu(null);}}><LayoutGrid/><span>卡片</span></button></div></div>
    </div>
    {menu==='filter'&&<div className="asset-filter-popover" style={{top:menuTop}} role="dialog" aria-label="筛选资产"><header><b>浏览{noun}</b><button onClick={closeMenu} aria-label="关闭筛选"><X/></button></header><div className="asset-filter-scroll"><section><h4>分类</h4>{option('全部',!categories.length,()=>setCategories([]))}{categoryOptions.map(c=>option(c,categories.includes(c),()=>setCategories(toggle(categories,c))))}</section><section><h4>来源</h4>{option('当前项目 · '+projectName,sources.includes('current'),()=>{setCross(false);setSources(toggle(sources,'current'));})}{option('通用资产',sources.includes('common'),()=>{setCross(false);setSources(toggle(sources,'common'));})}</section>{projects.length>0&&<section><h4>其他项目</h4>{projects.map(p=>option(p,sources.includes(p),()=>{setCross(false);setSources(toggle(sources,p));}))}</section>}<section><h4>状态</h4>{[['published','已发布'],['draft','草稿'],['all','全部状态']].map(([v,l])=>option(l,status===v,()=>setStatus(v)))}</section><section><h4>平台</h4>{[['all','全部平台'],['web','Web'],['h5','H5'],['app','App'],['miniprogram','小程序']].map(([v,l])=>option(l,platform===v,()=>setPlatform(v)))}</section></div><footer><button onClick={reset}>重置</button><button onClick={closeMenu}>完成</button></footer></div>}
    {menu==='sort'&&<div className="asset-sort-popover" style={{top:menuTop}} role="dialog" aria-label="排序方式">{orders.map(o=>o==='最近添加'&&!items.some(i=>i.createdAt)?<button key={o} disabled title="现有资产尚无添加时间记录"><span className="asset-check"/><span>{o}</span></button>:option(o,order===o,()=>{setOrder(o);closeMenu();}))}<small>使用记录统计本机提交的组件引用。旧资产暂无添加时间，不推测排序。</small></div>}
    <div className={'asset-result-caption '+(!cross&&!filterCount?'is-default':'')}>{cross?<><span>跨项目搜索结果</span><button onClick={()=>{setCross(false);setSources(defaults);}}>返回当前范围</button></>:<><span>{sources.length===2&&defaults.every(s=>sources.includes(s))?'当前项目 + 通用资产':'已选来源'}</span><span>{result.length} 项</span></>}</div>
    <div className="lib-scroll asset-results">{result.length?renderItems(result):<div className="asset-empty"><Search/><b>{query.trim()?'未找到匹配的'+noun:'暂无可用'+noun}</b><p>{cross?'已搜索所有可用项目。':filterCount?'试试减少筛选条件。':'当前项目与通用资产中未找到结果。'}</p>{filterCount>0&&<button onClick={reset}><SlidersHorizontal/>重置筛选</button>}{!!query.trim()&&!cross&&projects.length>0&&<button onClick={()=>setCross(true)}>在其他项目中搜索<ArrowRight/></button>}</div>}</div>
  </div>;
}
