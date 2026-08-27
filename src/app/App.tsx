import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  ArrowUp, BookOpenText, Boxes, ChevronDown, ChevronRight, CircleAlert, CircleCheck,
  CircleDashed, Download, FileText, FolderKanban, FolderOpen, Import, Layers3,
  Link2, Menu, MessageCircle, MonitorUp, MoreHorizontal, PackageOpen, Plus,
  RotateCcw, ScanSearch, Settings2, ShieldCheck, Sparkles, Trash2, Upload,
  Users, WandSparkles, X, Zap,
} from 'lucide-react';
import { downloadWorkspace, uid, useWorkspace } from './store';
import type { Asset, BoardNode, ChatMessage, DesignToken, ProductUnderstanding, Project, SkillItem, SourceKind, WorkspaceData } from './types';
import brandMotto from '../assets/brand/brand-motto-bg.png';

type Route = 'home' | 'projects' | 'assets' | 'tokens' | 'skills' | 'connectors' | 'settings';
type ModalName = 'analysis' | 'project' | null;
type NoticeTone = 'success' | 'info' | 'error';
type Notice = { text: string; tone: NoticeTone } | null;

const label: Record<Route, string> = { home: '首页', projects: '项目', assets: '资产库', tokens: '设计规范', skills: '技能库', connectors: '连接器', settings: '团队设置' };
const time = (iso: string) => new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function linesOf(value: string) {
  return value.replace(/```[\s\S]*?```/g, '').split(/\n|。|！|？/).map((item) => item.replace(/^\s*[-#>*\d.、]+/, '').trim()).filter((item) => item.length > 7);
}

function pick(lines: string[], terms: string[], fallback: string[]) {
  const found = lines.filter((line) => terms.some((term) => line.includes(term))).slice(0, 3);
  return found.length ? found : fallback;
}

function extractUnderstanding(raw: string, sourceName: string, kind: SourceKind): ProductUnderstanding {
  const lines = linesOf(raw);
  const heading = raw.match(/^#\s+(.+)$/m)?.[1] ?? sourceName.replace(/\.[^.]+$/, '') ?? '未命名产品资料';
  const excerpt = lines.slice(0, 2).join('；') || '资料正文较短，建议补充产品定位、用户问题与关键流程。';
  return {
    id: uid('understanding'),
    productName: heading.slice(0, 32),
    oneLineSummary: lines[0] ?? '基于导入资料建立的产品理解，等待团队确认。',
    positioning: pick(lines, ['定位', '价值', '面向', '产品是'], ['资料未明确给出产品定位，建议由负责人补充一句话价值主张。'])[0],
    targetUsers: pick(lines, ['用户', '客户', '学生', '设计师', '团队'], ['目标用户尚待确认']),
    problems: pick(lines, ['问题', '痛点', '困难', '低效', '无法', '缺少'], ['需要确认该产品希望优先解决的用户问题']),
    solutions: pick(lines, ['解决', '提供', '帮助', '支持', '通过', '能力'], ['需要确认关键解决方案与最小可用范围']),
    businessObjects: pick(lines, ['项目', '订单', '课程', '成员', '文档', '任务'], ['业务对象待补充']),
    keyFlows: pick(lines, ['流程', '步骤', '创建', '提交', '进入', '完成'], ['核心业务流程待补充']),
    constraints: pick(lines, ['约束', '权限', '规则', '限制', '必须', '不能'], ['资料中未识别到明确约束']),
    openQuestions: ['是否覆盖了当前阶段最重要的产品资料？', '业务规则是否存在版本冲突？', '哪些关键指标用于验证方案？'],
    sources: [{ id: uid('source'), title: sourceName || '本地演示资料', excerpt, kind, confidence: raw.trim().length > 180 ? 0.82 : 0.58 }],
    createdAt: new Date().toISOString(),
  };
}

export function App() {
  const workspace = useWorkspace();
  const [route, setRoute] = useState<Route>('home');
  const [modal, setModal] = useState<ModalName>(null);
  const [activeProjectId, setActiveProjectId] = useState(workspace.data.projects[0]?.id ?? '');
  const [notice, setNotice] = useState<Notice>(null);
  const [collapsed, setCollapsed] = useState(false);
  const activeProject = workspace.data.projects.find((item) => item.id === activeProjectId) ?? workspace.data.projects[0];
  const notify = (text: string, tone: NoticeTone = 'success') => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice(null), 3200);
  };
  const selectProject = (id: string) => { setActiveProjectId(id); setRoute('projects'); };
  const addProject = (project: Project) => {
    workspace.saveProject(project);
    workspace.addActivity({ type: 'project', title: `已创建项目「${project.name}」`, detail: '项目已保存在当前浏览器的本地工作区。' });
    setActiveProjectId(project.id);
    setModal(null);
    setRoute('projects');
    notify('项目已创建，可从画板继续推进。');
  };
  const saveUnderstanding = (understanding: ProductUnderstanding) => {
    workspace.saveUnderstanding(understanding);
    workspace.addActivity({ type: 'analysis', title: `产品理解「${understanding.productName}」已确认`, detail: '已建立可追溯的本地来源引用。' });
    addProject({
      id: uid('project'), name: understanding.productName, description: understanding.oneLineSummary,
      status: 'draft', updatedAt: new Date().toISOString(), members: ['林夕'], understandingId: understanding.id,
      pages: [], messages: [], comments: [], branches: ['主线'],
    });
  };
  return <div className="app-shell">
    <Sidebar route={route} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} onNavigate={setRoute} onNewProject={() => setModal('project')} />
    <main className="app-main">
      <Topbar title={label[route]} onToggle={() => setCollapsed((value) => !value)} onAnalysis={() => setModal('analysis')} />
      {route === 'home' && <Home data={workspace.data} onNavigate={setRoute} onProject={selectProject} onAnalysis={() => setModal('analysis')} onNewProject={() => setModal('project')} />}
      {route === 'projects' && activeProject && <Board projects={workspace.data.projects} project={activeProject} understandings={workspace.data.understandings} onSelect={selectProject} onSave={workspace.saveProject} onActivity={workspace.addActivity} onNew={() => setModal('project')} notify={notify} />}
      {route === 'assets' && <Assets assets={workspace.data.assets} onSave={workspace.saveAssets} onActivity={workspace.addActivity} notify={notify} />}
      {route === 'tokens' && <Tokens tokens={workspace.data.tokens} onSave={workspace.saveTokens} notify={notify} />}
      {route === 'skills' && <Skills skills={workspace.data.skills} onSave={workspace.saveSkills} onActivity={workspace.addActivity} notify={notify} />}
      {route === 'connectors' && <Connectors onAnalysis={() => setModal('analysis')} notify={notify} />}
      {route === 'settings' && <Settings data={workspace.data} onImport={workspace.importWorkspace} onReset={workspace.reset} notify={notify} />}
    </main>
    {modal === 'analysis' && <Analysis onClose={() => setModal(null)} onConfirm={saveUnderstanding} notify={notify} />}
    {modal === 'project' && <ProjectDialog onClose={() => setModal(null)} onCreate={addProject} />}
    {notice && <div className={`notice ${notice.tone}`} role="status"><CircleCheck />{notice.text}</div>}
  </div>;
}

function Sidebar({ route, collapsed, onToggle, onNavigate, onNewProject }: { route: Route; collapsed: boolean; onToggle: () => void; onNavigate: (route: Route) => void; onNewProject: () => void }) {
  const primary: Array<[Route, string, ReactNode]> = [['home', '首页', <Sparkles />], ['projects', '项目', <FolderKanban />], ['assets', '资产库', <Boxes />]];
  const product: Array<[Route, string, ReactNode]> = [['tokens', '设计规范', <Layers3 />], ['skills', '技能库', <Zap />], ['connectors', '连接器', <Link2 />], ['settings', '团队设置', <Users />]];
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="sidebar-brand"><span><Sparkles /></span><b>Imagine Lab</b><button onClick={onToggle} aria-label="收起导航"><Menu /></button></div>
    <button className="workspace"><WandSparkles /><span>UI设计</span><ChevronDown /></button>
    <nav>{primary.map(([id, name, icon]) => <button key={id} className={route === id ? 'active' : ''} onClick={() => onNavigate(id)}>{icon}<span>{name}</span>{id === 'projects' && <i onClick={(event) => { event.stopPropagation(); onNewProject(); }}><Plus /></i>}</button>)}</nav>
    <p className="nav-caption">产品</p>
    <nav>{product.map(([id, name, icon]) => <button key={id} className={route === id ? 'active' : ''} onClick={() => onNavigate(id)}>{icon}<span>{name}</span></button>)}</nav>
    <div className="sidebar-fill" />
    <div className="motto" style={{ backgroundImage: `linear-gradient(rgba(253,252,250,.14), rgba(253,252,250,.20)), url(${brandMotto})` }}><strong>让想象力，<br />成为团队的生产力。</strong><small><Sparkles /> Imagine Lab</small></div>
    <button className="local-status" onClick={() => onNavigate('settings')}><span><Settings2 /> API 设置</span><b>本地</b><i><em /></i></button>
  </aside>;
}

function Topbar({ title, onToggle, onAnalysis }: { title: string; onToggle: () => void; onAnalysis: () => void }) {
  return <header className="topbar"><div><button onClick={onToggle} aria-label="切换导航"><Menu /></button><b>{title}</b></div><nav><button className="analysis-trigger" onClick={onAnalysis}><ScanSearch />产品理解</button><button className="icon-button" aria-label="消息"><MessageCircle /></button><button className="team">想象力产品部 <i>林</i></button></nav></header>;
}

function Home({ data, onNavigate, onProject, onAnalysis, onNewProject }: { data: WorkspaceData; onNavigate: (route: Route) => void; onProject: (id: string) => void; onAnalysis: () => void; onNewProject: () => void }) {
  const quick: Array<{ title: string; detail: string; icon: ReactNode; action: () => void }> = [
    { title: '原型分析', detail: '读取产品资料，建立可确认、可引用的产品理解。', icon: <ScanSearch />, action: onAnalysis },
    { title: '从模板创建', detail: '从团队已验证的页面结构和资产开始。', icon: <Layers3 />, action: () => onNavigate('assets') },
    { title: '快速开始', detail: '创建空白项目，将一句需求转化为可推进任务。', icon: <Sparkles />, action: onNewProject },
    { title: '导入资产', detail: '沉淀组件、模板、品牌资产和团队规范。', icon: <Import />, action: () => onNavigate('assets') },
  ];
  return <section className="page home-page"><header className="hero"><div><p>想象力产品部</p><h1>从理解产品开始，<br />让团队持续把想法推进到交付。</h1><span>在同一个工作台中沉淀资料、规范、资产、设计决策和协作过程。</span></div><button className="primary" onClick={onNewProject}><Plus />创建项目</button></header>
    <div className="quick-grid">{quick.map((item, index) => <button className={`quick-card card-${index + 1}`} key={item.title} onClick={item.action}><i>{item.icon}</i><b>{item.title}</b><small>{item.detail}</small><ChevronRight /></button>)}</div>
    <div className="dashboard-grid"><section className="surface recent"><SectionTitle title="最近项目" action="查看全部" onClick={() => onNavigate('projects')} /><div className="recent-grid">{data.projects.slice(0, 3).map((project) => <button key={project.id} onClick={() => onProject(project.id)}><span>{project.name.slice(0, 1)}<i>{project.status === 'active' ? '进行中' : project.status === 'review' ? '待评审' : '草稿'}</i></span><b>{project.name}</b><p>{project.description}</p><small>{project.members.map((member) => member.slice(0, 1)).join(' · ')} <time>{time(project.updatedAt)}</time></small></button>)}</div></section>
      <section className="surface activity"><SectionTitle title="工作记录" action="查看全部" onClick={() => onNavigate('projects')} />{data.activities.slice(0, 5).map((item) => <article key={item.id}><i><CircleDashed /></i><div><b>{item.title}</b><p>{item.detail}</p><time>{time(item.createdAt)}</time></div></article>)}</section></div>
    <div className="dashboard-grid bottom"><section className="surface share"><SectionTitle title="团队分享" action="前往资产库" onClick={() => onNavigate('assets')} /><div><span>IMAGINE<br />NOTES</span><p>把每次尝试变成团队下一次更快的开始。</p><small>本周精选 · 设计协作</small></div></section><section className="surface readiness"><p>工作区状态</p><h2>产品上下文已经形成<br />可复用的设计起点。</h2><span><CircleCheck />{data.understandings.length} 份产品理解</span><span><PackageOpen />{data.assets.length} 项可复用资产</span><span><Zap />{data.skills.filter((item) => item.enabled).length} 项已启用技能</span></section></div>
  </section>;
}

function SectionTitle({ title, action, onClick }: { title: string; action: string; onClick: () => void }) { return <header className="section-title"><h2>{title}</h2><button onClick={onClick}>{action}<ChevronRight /></button></header>; }

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) { return <div className="modal-layer" role="dialog" aria-modal="true"><div className="modal"><header><div><h2>{title}</h2><p>{description}</p></div><button onClick={onClose}><X /></button></header>{children}</div></div>; }

function ProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (project: Project) => void }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; onCreate({ id: uid('project'), name: name.trim(), description: description.trim() || '尚未补充项目背景。', status: 'draft', updatedAt: new Date().toISOString(), members: ['林夕'], pages: [], messages: [], comments: [], branches: ['主线'] }); };
  return <Modal title="创建项目" description="项目会保存在当前浏览器的本地工作区，可在后续接入团队服务。" onClose={onClose}><form className="form" onSubmit={submit}><label>项目名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：会员增长体验升级" /></label><label>项目背景<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="用一两句话说明要解决的问题与预期结果。" /></label><footer><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!name.trim()}><Plus />创建并进入画板</button></footer></form></Modal>;
}

function Analysis({ onClose, onConfirm, notify }: { onClose: () => void; onConfirm: (item: ProductUnderstanding) => void; notify: (text: string, tone?: NoticeTone) => void }) {
  const [method, setMethod] = useState<SourceKind>('local'); const [sourceName, setSourceName] = useState(''); const [reference, setReference] = useState(''); const [raw, setRaw] = useState(''); const [state, setState] = useState<'choose' | 'running' | 'review'>('choose'); const [result, setResult] = useState<ProductUnderstanding | null>(null); const [error, setError] = useState(''); const input = useRef<HTMLInputElement>(null);
  const readFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!/\.(md|mdx|txt)$/i.test(file.name)) { setError('仅支持 Markdown、MDX 或 TXT 文件。'); return; } const reader = new FileReader(); reader.onload = () => { setRaw(String(reader.result ?? '')); setSourceName(file.name); setError(''); }; reader.onerror = () => setError('文件读取失败，请重新选择。'); reader.readAsText(file); };
  const analyze = async () => { const demo = `资料来源：${reference}\n产品目标：让产品团队将需求、规范和资产沉淀到一条连续工作流中。\n目标用户：产品经理、设计师与前端工程师。\n核心问题：信息分散导致 AI 缺少产品上下文，团队经验无法复用。\n解决方案：先建立产品理解，再在项目画板中协作、迭代和交付。\n关键流程：导入资料、确认理解、创建项目、生成页面、评审与导出。`;
    const content = method === 'local' ? raw : demo; if (!content.trim()) { setError(method === 'local' ? '请先选择一份本地资料。' : '请填写精确的文档或项目链接。'); return; } setState('running'); await pause(560); await pause(560); setResult(extractUnderstanding(content, sourceName || reference || '在线资料', method)); setState('review'); };
  const edit = (key: 'productName' | 'oneLineSummary' | 'positioning' | 'targetUsers' | 'problems' | 'solutions' | 'keyFlows', value: string) => { if (!result) return; const arrayKeys = ['targetUsers', 'problems', 'solutions', 'keyFlows']; setResult({ ...result, [key]: arrayKeys.includes(key) ? value.split('\n').map((item) => item.trim()).filter(Boolean) : value }); };
  const sources: Array<{ id: SourceKind; title: string; detail: string; icon: ReactNode; providers: string[] }> = [
    { id: 'local', title: '直接读取本地资料', detail: '选择资料后，只提炼产品相关内容。', icon: <FolderOpen />, providers: ['Obsidian Vault', 'Markdown / TXT'] },
    { id: 'connector', title: '连接在线文档', detail: '通过已授权连接器按需读取指定范围。', icon: <Link2 />, providers: ['飞书文档', 'Notion'] },
    { id: 'browser', title: '浏览器辅助读取', detail: '仅在无直接连接方式时读取产品文本。', icon: <MonitorUp />, providers: ['蓝湖', '墨刀'] },
  ];
  if (state === 'review' && result) return <div className="modal-layer"><div className="analysis-modal"><header><div><p>产品理解</p><h2>确认产品理解</h2><span>请修正不准确的内容，再将其作为项目的可追溯上下文。</span></div><button onClick={onClose}><X /></button></header><div className="review"><div className="review-banner"><CircleCheck /><div><b>已生成可编辑的产品理解</b><p>内容基于 {result.sources[0].title} 整理，置信度 {Math.round(result.sources[0].confidence * 100)}%。</p></div></div><div className="review-grid"><EditField label="产品名称" value={result.productName} onChange={(value) => edit('productName', value)} /><EditField label="一句话定义" multiline value={result.oneLineSummary} onChange={(value) => edit('oneLineSummary', value)} /><EditField label="产品定位" multiline value={result.positioning} onChange={(value) => edit('positioning', value)} /><EditField label="目标用户" multiline value={result.targetUsers.join('\n')} onChange={(value) => edit('targetUsers', value)} /><EditField label="核心问题" multiline value={result.problems.join('\n')} onChange={(value) => edit('problems', value)} /><EditField label="解决方案" multiline value={result.solutions.join('\n')} onChange={(value) => edit('solutions', value)} /><EditField label="关键业务流程" multiline value={result.keyFlows.join('\n')} onChange={(value) => edit('keyFlows', value)} /><article className="source-reference"><span><FileText />来源引用</span><b>{result.sources[0].title}</b><p>{result.sources[0].excerpt}</p><small>仅保留来源摘要和引用，不存储原始全文。</small></article></div></div><footer><button className="secondary" onClick={() => setState('choose')}>返回修改来源</button><button className="primary" onClick={() => { onConfirm(result); notify('产品理解已确认，并已创建关联项目。'); }}><CircleCheck />确认并创建项目</button></footer></div></div>;
  return <div className="modal-layer"><div className="analysis-modal"><header><div><p>产品理解</p><h2>让 AI 先理解你的产品</h2><span>只读取产品定位、目标用户、问题、解决方案和业务逻辑，不读取 UI、交互标注或代码。</span></div><button onClick={onClose}><X /></button></header><div className="analysis-body"><div className="source-list">{sources.map((source) => <button key={source.id} className={method === source.id ? 'selected' : ''} onClick={() => { setMethod(source.id); setError(''); }}><i>{source.icon}</i><div><b>{source.title}</b><p>{source.detail}</p></div>{method === source.id && <CircleCheck />}</button>)}</div><div className="provider"><b>读取来源</b>{sources.find((item) => item.id === method)?.providers.map((item) => <span key={item}>{item}</span>)}</div>{method === 'local' ? <div className="file-drop"><input ref={input} hidden type="file" accept=".md,.mdx,.txt,text/plain,text/markdown" onChange={readFile} /><button onClick={() => input.current?.click()}><Upload /><b>{sourceName || '选择 Markdown、MDX 或 TXT 文件'}</b><small>支持 .md / .mdx / .txt</small></button>{sourceName && <p><CircleCheck />已选择 {sourceName}，{raw.length.toLocaleString()} 个字符。</p>}</div> : <label className="form-label">精确链接或项目名称<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={method === 'connector' ? '粘贴飞书或 Notion 文档链接' : '粘贴蓝湖或墨刀项目链接'} /><small>{method === 'connector' ? '未配置 OAuth 时，仅以安全的本地演示资料完成流程，不会访问外部账号。' : '真实浏览器辅助读取需要在连接器中完成授权和用户接管。'}</small></label>}{state === 'running' && <div className="progress"><RotateCcw /><div><b>正在整理产品事实</b><p>正在提取产品定位、目标用户、问题、解决方案与关键流程。</p></div></div>}{error && <p className="error"><CircleAlert />{error}</p>}</div><footer><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={state === 'running'} onClick={analyze}>{state === 'running' ? <RotateCcw className="spin" /> : <Sparkles />}{state === 'running' ? '正在整理' : '开始分析'}</button></footer></div></div>;
}

function EditField({ label, value, multiline, onChange }: { label: string; value: string; multiline?: boolean; onChange: (value: string) => void }) { return <label className="edit-field"><b>{label}</b>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>; }

function Board({ projects, project, understandings, onSelect, onSave, onActivity, onNew, notify }: { projects: Project[]; project: Project; understandings: ProductUnderstanding[]; onSelect: (id: string) => void; onSave: (project: Project) => void; onActivity: (item: { type: 'project' | 'comment'; title: string; detail: string }) => void; onNew: () => void; notify: (text: string) => void }) {
  const [tab, setTab] = useState<'config' | 'pages' | 'comments'>('config'); const [prompt, setPrompt] = useState(''); const [comment, setComment] = useState(''); const [branches, setBranches] = useState(false); const [branchName, setBranchName] = useState(''); const [menu, setMenu] = useState<string | null>(null);
  const understanding = understandings.find((item) => item.id === project.understandingId); const patch = (value: Partial<Project>) => onSave({ ...project, ...value, updatedAt: new Date().toISOString() });
  const send = (event: FormEvent) => { event.preventDefault(); if (!prompt.trim()) return; const content = prompt.trim(); const user: ChatMessage = { id: uid('message'), role: 'user', content, createdAt: new Date().toISOString() }; const response: ChatMessage = { id: uid('message'), role: 'assistant', content: `已将「${content.slice(0, 36)}」加入主线。建议先确认目标用户、关键任务和成功指标，再以已启用规范生成页面方案。`, createdAt: new Date().toISOString() }; const node: BoardNode = { id: uid('node'), title: content.length > 18 ? `${content.slice(0, 18)}…` : content, subtitle: '待细化的页面或设计任务', kind: 'page', x: 120 + project.pages.length * 45, y: 260 + (project.pages.length % 2) * 102, status: 'draft' }; patch({ messages: [...project.messages, user, response], pages: [...project.pages, node] }); onActivity({ type: 'project', title: `项目「${project.name}」新增设计任务`, detail: content }); setPrompt(''); notify('任务已加入画板。'); };
  const addBranch = () => { if (!branchName.trim() || project.branches.includes(branchName.trim())) return; patch({ branches: [...project.branches, branchName.trim()] }); setBranchName(''); setBranches(false); };
  const addComment = (event: FormEvent) => { event.preventDefault(); if (!comment.trim()) return; patch({ comments: [{ id: uid('comment'), author: '林夕', content: comment.trim(), resolved: false, createdAt: new Date().toISOString() }, ...project.comments] }); onActivity({ type: 'comment', title: `在「${project.name}」留下评论`, detail: comment.trim() }); setComment(''); notify('评论已保存。'); };
  const exportProject = () => { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), project, productUnderstanding: understanding ?? null }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${project.name}-交付包.json`; link.click(); URL.revokeObjectURL(url); notify('项目交付包已下载。'); };
  return <section className="board page"><aside className="project-panel"><header><b>项目</b><button onClick={onNew}><Plus /></button></header><div>{projects.map((item) => <article key={item.id} className={item.id === project.id ? 'selected' : ''}><button onClick={() => onSelect(item.id)}><i>{item.name.slice(0, 1)}</i><span><b>{item.name}</b><small>{item.status === 'active' ? '进行中' : item.status === 'review' ? '待评审' : '草稿'} · {time(item.updatedAt)}</small></span></button><button className="more" onClick={() => setMenu(menu === item.id ? null : item.id)}><MoreHorizontal /></button>{menu === item.id && <div className="project-menu"><button onClick={() => { onSelect(item.id); setMenu(null); }}><FolderOpen />打开项目</button><button onClick={() => setMenu(null)}><Trash2 />仅本地可删除</button></div>}</article>)}</div><button className="new-project" onClick={onNew}><Plus />创建空白项目</button></aside><main className="canvas-panel"><header><div><p>项目工作台</p><h1>{project.name}</h1></div><nav><button className="secondary" onClick={exportProject}><Download />导出</button><button className="primary" onClick={() => patch({ status: project.status === 'review' ? 'active' : 'review' })}>{project.status === 'review' ? <RotateCcw /> : <CircleCheck />}{project.status === 'review' ? '恢复编辑' : '提交评审'}</button></nav></header><div className="canvas"><div className="canvas-tip"><span><Sparkles />{understanding ? `已引用：${understanding.productName}` : '尚未关联产品理解'}</span><small>可直接管理节点和任务；自由拖拽将在接入画布引擎后启用。</small></div>{project.pages.length ? project.pages.map((node) => <article className={`node ${node.kind} ${node.status}`} key={node.id} style={{ left: node.x, top: node.y }}><i>{node.kind === 'page' ? <FileText /> : node.kind === 'decision' ? <CircleAlert /> : <Layers3 />}</i><b>{node.title}</b><p>{node.subtitle}</p><small>{node.status === 'ready' ? '已确认' : node.status === 'review' ? '待评审' : '待完善'}</small></article>) : <div className="empty-canvas"><Layers3 /><b>从一个页面或任务开始</b><p>在底部输入框描述需要推进的内容，工作台会创建可持续编辑的节点。</p></div>}</div><form className="composer" onSubmit={send}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="描述需要推进的页面、需求或评审问题……" /><footer><div className="branch"><button type="button" onClick={() => setBranches((value) => !value)}><Zap />主线<ChevronDown /></button>{branches && <div>{project.branches.map((item) => <button type="button" key={item} onClick={() => setBranches(false)}>{item}{item === '主线' && <CircleCheck />}</button>)}<form onSubmit={(event) => { event.preventDefault(); addBranch(); }}><input value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="新分支名称" /><button><Plus /></button></form></div>}</div><button type="button" className="attach"><Upload />添加资料</button><button className="send" disabled={!prompt.trim()}><ArrowUp /></button></footer></form></main><aside className="inspector"><header><b>{project.name}</b><button onClick={exportProject}><Download /></button></header><nav>{(['config', 'pages', 'comments'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'config' ? '配置' : item === 'pages' ? '页面' : `评论${project.comments.filter((entry) => !entry.resolved).length ? ` ${project.comments.filter((entry) => !entry.resolved).length}` : ''}`}</button>)}</nav>{tab === 'config' && <div className="inspector-content"><InspectorSection title="项目背景"><textarea value={project.description} onChange={(event) => patch({ description: event.target.value })} /></InspectorSection><InspectorSection title="产品理解">{understanding ? <div className="linked"><CircleCheck /><span><b>{understanding.productName}</b><p>{understanding.oneLineSummary}</p></span></div> : <div className="missing"><CircleAlert />尚未关联产品理解</div>}</InspectorSection><InspectorSection title="已启用能力"><div className="setting-row"><Zap />页面结构设计<CircleCheck /></div><div className="setting-row"><Boxes />信息卡片组件组<CircleCheck /></div></InspectorSection></div>}{tab === 'pages' && <div className="inspector-content"><button className="add-page" onClick={() => patch({ pages: [...project.pages, { id: uid('node'), title: '未命名页面', subtitle: '等待补充页面目标', kind: 'page', x: 160, y: 160, status: 'draft' }] })}><Plus />新建页面</button>{project.pages.map((item) => <article className="page-row" key={item.id}><FileText /><span><b>{item.title}</b><small>{item.subtitle}</small></span><button onClick={() => patch({ pages: project.pages.filter((entry) => entry.id !== item.id) })}><X /></button></article>)}</div>}{tab === 'comments' && <div className="inspector-content comments"><form onSubmit={addComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="写下可执行的反馈……" /><button className="primary" disabled={!comment.trim()}>发送评论</button></form>{project.comments.map((item) => <article className={item.resolved ? 'resolved' : ''} key={item.id}><header><i>{item.author.slice(0, 1)}</i><b>{item.author}</b><time>{time(item.createdAt)}</time></header><p>{item.content}</p><button onClick={() => patch({ comments: project.comments.map((entry) => entry.id === item.id ? { ...entry, resolved: !entry.resolved } : entry) })}>{item.resolved ? '恢复' : '标记已解决'}</button></article>)}</div>}</aside></section>;
}

function InspectorSection({ title, children }: { title: string; children: ReactNode }) { return <section className="inspector-section"><h3>{title}</h3>{children}</section>; }

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <header className="page-header"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action}</header>; }

function Assets({ assets, onSave, onActivity, notify }: { assets: Asset[]; onSave: (value: Asset[]) => void; onActivity: (value: { type: 'asset'; title: string; detail: string }) => void; notify: (text: string) => void }) {
  const [query, setQuery] = useState(''); const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [description, setDescription] = useState(''); const list = assets.filter((item) => `${item.name}${item.type}${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const add = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; const item: Asset = { id: uid('asset'), name: name.trim(), description: description.trim() || '待补充资产说明。', type: '文档', updatedAt: new Date().toISOString(), usage: 0 }; onSave([item, ...assets]); onActivity({ type: 'asset', title: `新增资产「${item.name}」`, detail: '资产已保存到本地工作区。' }); setAdding(false); setName(''); setDescription(''); notify('资产已添加到团队资产库。'); };
  return <section className="page management"><PageHeader eyebrow="团队复利" title="资产库" description="将可复用的组件、模板、品牌资产和交付文档沉淀为团队下一次更快的开始。" action={<button className="primary" onClick={() => setAdding(true)}><Plus />添加资产</button>} /><div className="toolbar"><label><ScanSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资产、模板或文档" /></label><small>{assets.length} 项已沉淀资产</small></div>{adding && <form className="inline-form" onSubmit={add}><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="资产名称" /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="一句话说明使用场景" /><button className="primary">保存</button><button type="button" className="secondary" onClick={() => setAdding(false)}>取消</button></form>}<div className="card-grid">{list.map((item) => <article className="asset-card" key={item.id}><i><PackageOpen /></i><small>{item.type}</small><h2>{item.name}</h2><p>{item.description}</p><footer><span>已使用 {item.usage} 次</span><time>{time(item.updatedAt)}</time></footer><button onClick={() => { onSave(assets.map((entry) => entry.id === item.id ? { ...entry, usage: entry.usage + 1, updatedAt: new Date().toISOString() } : entry)); notify(`已记录复用「${item.name}」。`); }}><Layers3 />在项目中复用</button></article>)}</div></section>;
}

function Tokens({ tokens, onSave, notify }: { tokens: DesignToken[]; onSave: (value: DesignToken[]) => void; notify: (text: string) => void }) {
  const groups: DesignToken['group'][] = ['颜色', '字体', '间距', '圆角']; const update = (id: string, patch: Partial<DesignToken>) => onSave(tokens.map((item) => item.id === id ? { ...item, ...patch } : item)); const add = () => onSave([...tokens, { id: uid('token'), name: '新 Token', value: '#000000', group: '颜色', description: '待补充用途。' }]);
  return <section className="page management"><PageHeader eyebrow="一致性基础" title="设计规范" description="用可维护的 Token 管理颜色、字体、间距和圆角；修改会自动保存在本地工作区。" action={<button className="primary" onClick={add}><Plus />新增 Token</button>} />{groups.map((group) => <section className="token-group" key={group}><header><h2>{group}</h2><small>{tokens.filter((item) => item.group === group).length} 项</small></header>{tokens.filter((item) => item.group === group).map((item) => <article key={item.id}><i style={item.value.startsWith('#') ? { background: item.value } : undefined}>{!item.value.startsWith('#') && <FileText />}</i><span><b>{item.name}</b><small>{item.description}</small></span><input value={item.value} onChange={(event) => update(item.id, { value: event.target.value })} onBlur={() => notify('设计 Token 已自动保存。')} /><select value={item.group} onChange={(event) => update(item.id, { group: event.target.value as DesignToken['group'] })}>{groups.map((entry) => <option key={entry}>{entry}</option>)}</select><button onClick={() => { onSave(tokens.filter((entry) => entry.id !== item.id)); notify('Token 已删除。'); }}><Trash2 /></button></article>)}</section>)}<div className="callout"><ShieldCheck /><p><b>使用建议：</b>在团队视觉确认前，先新增而非大范围替换现有 Token；上线前再建立视觉回归基线。</p></div></section>;
}

function Skills({ skills, onSave, onActivity, notify }: { skills: SkillItem[]; onSave: (value: SkillItem[]) => void; onActivity: (value: { type: 'skill'; title: string; detail: string }) => void; notify: (text: string) => void }) {
  const [name, setName] = useState(''); const add = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; const item: SkillItem = { id: uid('skill'), name: name.trim(), description: '待补充该技能的触发条件、输入与输出标准。', version: '0.1', usage: 0, enabled: true }; onSave([...skills, item]); onActivity({ type: 'skill', title: `创建技能「${item.name}」`, detail: '技能已加入当前团队的本地技能库。' }); setName(''); notify('技能已创建，可在项目中启用。'); };
  return <section className="page management"><PageHeader eyebrow="团队方法论" title="技能库" description="将经过验证的工作方法、评审框架和生成策略沉淀为可复用的项目能力。" action={<form className="header-form" onSubmit={add}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="技能名称" /><button className="primary" disabled={!name.trim()}><Plus />创建技能</button></form>} /><div className="card-grid skills">{skills.map((item) => <article className="skill-card" key={item.id}><header><i><Zap /></i><label><input type="checkbox" checked={item.enabled} onChange={() => { onSave(skills.map((entry) => entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry)); notify(`${item.name} 已${item.enabled ? '停用' : '启用'}。`); }} /><span /></label></header><h2>{item.name}</h2><p>{item.description}</p><footer><span>v{item.version}</span><span>{item.usage} 次使用</span></footer><button onClick={() => { onSave(skills.map((entry) => entry.id === item.id ? { ...entry, usage: entry.usage + 1 } : entry)); notify(`已记录调用「${item.name}」。`); }}>查看使用说明<ChevronRight /></button></article>)}</div></section>;
}

function Connectors({ onAnalysis, notify }: { onAnalysis: () => void; notify: (text: string, tone?: NoticeTone) => void }) {
  const list = [{ name: '本地资料读取', status: '可用', detail: '支持用户主动选择的 Markdown、MDX 和 TXT 文件。', icon: <FolderOpen /> }, { name: '飞书文档', status: '待授权', detail: '需配置官方 OAuth 或受支持的连接器，并由用户选择读取范围。', icon: <FileText /> }, { name: 'Notion', status: '待授权', detail: '需配置官方 OAuth 或受支持的连接器，并由用户选择读取范围。', icon: <BookOpenText /> }, { name: '蓝湖 / 墨刀', status: '需用户接管', detail: '仅在无开放读取能力时通过浏览器辅助读取产品文本。', icon: <MonitorUp /> }];
  return <section className="page management"><PageHeader eyebrow="安全连接" title="连接器" description="先选择读取方式，再在最小授权范围内获取资料；系统不会默认遍历任何账号或项目。" action={<button className="primary" onClick={onAnalysis}><ScanSearch />开始产品分析</button>} /><div className="connector-list">{list.map((item) => <article key={item.name}><i>{item.icon}</i><div><h2>{item.name}</h2><p>{item.detail}</p></div><small className={item.status === '可用' ? 'ready' : ''}>{item.status}</small><button className="secondary" onClick={() => item.status === '可用' ? onAnalysis() : notify('该连接器需要在接入真实服务后由管理员完成配置；当前不会跳转或请求任何外部账号。', 'info')}>{item.status === '可用' ? '使用' : '查看要求'}</button></article>)}</div><div className="callout"><ShieldCheck /><p><b>隐私边界：</b>真实连接器接入后仍应仅读取用户明确选择的范围，并在登录、验证码或高风险授权时请求用户接管操作。</p></div></section>;
}

function Settings({ data, onImport, onReset, notify }: { data: WorkspaceData; onImport: (value: WorkspaceData) => void; onReset: () => void; notify: (text: string, tone?: NoticeTone) => void }) {
  const input = useRef<HTMLInputElement>(null); const restore = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const value = JSON.parse(String(reader.result)) as WorkspaceData; if (value.version !== 1 || !Array.isArray(value.projects)) throw new Error('invalid'); onImport(value); notify('本地工作区已恢复。'); } catch { notify('无法识别该备份文件，请选择 Imagine Lab 导出的 JSON 文件。', 'error'); } }; reader.readAsText(file); };
  return <section className="page management"><PageHeader eyebrow="工作区管理" title="团队设置" description="本地优先版本将工作区数据保存在当前浏览器。可随时导出备份或恢复到已导出的文件。" /><div className="settings-grid"><article><i><Users /></i><h2>团队与工作区</h2><p>当前团队：想象力产品部</p><p>成员：林夕、周子航、陈默</p><button className="secondary" onClick={() => notify('多人权限、邀请和实时协作将在接入服务端后启用。', 'info')}>管理成员</button></article><article><i><Download /></i><h2>备份工作区</h2><p>导出项目、产品理解、资产、技能和设计 Token 的本地 JSON 备份。</p><button className="primary" onClick={() => { downloadWorkspace(data); notify('本地工作区备份已下载。'); }}><Download />导出备份</button></article><article><i><Upload /></i><h2>恢复工作区</h2><p>恢复不会请求外部网络。请仅导入可信的 Imagine Lab 导出文件。</p><input ref={input} hidden type="file" accept="application/json,.json" onChange={restore} /><button className="secondary" onClick={() => input.current?.click()}><Upload />选择备份文件</button></article><article className="danger-zone"><i><RotateCcw /></i><h2>恢复演示数据</h2><p>清除当前浏览器中保存的工作区数据，并重新加载预置演示内容。</p><button className="danger" onClick={() => { if (window.confirm('确定要清除当前浏览器中的 Imagine Lab 本地工作区数据吗？')) { onReset(); notify('已恢复预置演示数据。'); } }}>恢复演示数据</button></article></div><div className="summary"><b>当前数据概览</b><span>{data.projects.length} 个项目</span><span>{data.understandings.length} 份产品理解</span><span>{data.assets.length} 项资产</span><span>{data.skills.length} 项技能</span></div></section>;
}
