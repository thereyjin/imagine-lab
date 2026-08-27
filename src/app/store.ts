import { useEffect, useMemo, useState } from 'react';
import type { Activity, Asset, DesignToken, Project, SkillItem, WorkspaceData } from './types';

const STORAGE_KEY = 'imagine-lab.workspace.v1';
const now = () => new Date().toISOString();
export const uid = (prefix: string) => `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

const initialProjects: Project[] = [
  {
    id: 'project-learning',
    name: '速学慧学习成长体验',
    description: '面向中学生的学习计划与课程分享体验。',
    status: 'active',
    updatedAt: now(),
    members: ['林夕', '周子航', '陈默'],
    branches: ['主线', '课程分享探索'],
    pages: [
      { id: 'node-home', title: '学习首页', subtitle: '目标、进度与今日建议', kind: 'page', x: 80, y: 100, status: 'ready' },
      { id: 'node-share', title: '课程分享页', subtitle: '邀请同学加入学习计划', kind: 'page', x: 360, y: 210, status: 'draft' },
      { id: 'node-rule', title: '分享奖励规则', subtitle: '待产品确认', kind: 'decision', x: 650, y: 110, status: 'review' },
    ],
    messages: [{ id: 'welcome', role: 'system', content: '已载入项目上下文。所有后续建议都会引用项目背景、设计规范和已确认的产品理解。', createdAt: now() }],
    comments: [{ id: 'comment-1', author: '林夕', content: '分享页需优先解释对同学的实际价值，避免只强调奖励。', resolved: false, createdAt: now() }],
  },
  {
    id: 'project-agent',
    name: '代理商小程序',
    description: '代理商获客、任务与线索管理。',
    status: 'review',
    updatedAt: now(),
    members: ['陈默', '林夕'],
    branches: ['主线'],
    pages: [],
    messages: [],
    comments: [],
  },
];

const initialTokens: DesignToken[] = [
  { id: 'color-text', name: '文本 / 主色', value: '#0f0e0d', group: '颜色', description: '标题与核心信息' },
  { id: 'color-surface', name: '表面 / 暖白', value: '#fdfcfc', group: '颜色', description: '主页面背景' },
  { id: 'font-body', name: '正文 / 基准', value: '14px', group: '字体', description: '导航与正文的默认字号' },
  { id: 'space-4', name: '间距 / 4', value: '16px', group: '间距', description: '常用组件间距' },
  { id: 'radius-card', name: '圆角 / 卡片', value: '16px', group: '圆角', description: '普通内容卡片' },
];

const initialAssets: Asset[] = [
  { id: 'asset-onboarding', name: '新手引导页面模板', type: '模板', description: '适用于首次进入产品的目标导向页面。', updatedAt: now(), usage: 18 },
  { id: 'asset-card', name: '信息卡片组件组', type: '组件', description: '统一的信息密度、状态与操作层级。', updatedAt: now(), usage: 36 },
  { id: 'asset-tone', name: '品牌语气与文案规范', type: '文档', description: '克制、清晰、以用户行动为中心的表达方式。', updatedAt: now(), usage: 12 },
];

const initialSkills: SkillItem[] = [
  { id: 'skill-brief', name: '需求澄清', description: '从模糊输入中识别目标、约束与待确认事项。', version: '1.2', usage: 28, enabled: true },
  { id: 'skill-page', name: '页面结构设计', description: '基于产品理解输出任务流、信息架构与页面优先级。', version: '1.4', usage: 46, enabled: true },
  { id: 'skill-review', name: '设计评审', description: '以已确认规范和业务目标检查设计方案。', version: '1.0', usage: 9, enabled: false },
];

const initialActivities: Activity[] = [
  { id: 'activity-1', type: 'project', title: '速学慧学习成长体验已恢复', detail: '项目画板、分支与评论已准备就绪。', createdAt: now() },
  { id: 'activity-2', type: 'asset', title: '信息卡片组件组被复用', detail: '已在学习首页方案中引用。', createdAt: now() },
];

export const seedWorkspace = (): WorkspaceData => ({
  version: 1,
  projects: initialProjects,
  understandings: [],
  tokens: initialTokens,
  assets: initialAssets,
  skills: initialSkills,
  activities: initialActivities,
});

function readWorkspace(): WorkspaceData {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return seedWorkspace();
    const value = JSON.parse(stored) as WorkspaceData;
    return value?.version === 1 ? value : seedWorkspace();
  } catch {
    return seedWorkspace();
  }
}

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>(readWorkspace);
  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  const api = useMemo(() => ({
    reset: () => setData(seedWorkspace()),
    addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => setData((current) => ({
      ...current,
      activities: [{ ...activity, id: uid('activity'), createdAt: now() }, ...current.activities].slice(0, 40),
    })),
    saveProject: (project: Project) => setData((current) => ({
      ...current,
      projects: current.projects.some((item) => item.id === project.id)
        ? current.projects.map((item) => item.id === project.id ? project : item)
        : [project, ...current.projects],
    })),
    saveTokens: (tokens: DesignToken[]) => setData((current) => ({ ...current, tokens })),
    saveAssets: (assets: Asset[]) => setData((current) => ({ ...current, assets })),
    saveSkills: (skills: SkillItem[]) => setData((current) => ({ ...current, skills })),
    saveUnderstanding: (understanding: WorkspaceData['understandings'][number]) => setData((current) => ({
      ...current,
      understandings: [understanding, ...current.understandings],
    })),
    importWorkspace: (next: WorkspaceData) => setData(next),
  }), []);
  return { data, ...api };
}

export function downloadWorkspace(data: WorkspaceData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `imagine-lab-workspace-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
