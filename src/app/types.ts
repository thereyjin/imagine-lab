export type SourceKind = 'local' | 'connector' | 'browser';
export type ProjectStatus = 'draft' | 'active' | 'review';
export type ActivityKind = 'analysis' | 'project' | 'asset' | 'skill' | 'comment';

export interface SourceReference {
  id: string;
  title: string;
  excerpt: string;
  kind: SourceKind;
  confidence: number;
}

export interface ProductUnderstanding {
  id: string;
  productName: string;
  oneLineSummary: string;
  positioning: string;
  targetUsers: string[];
  problems: string[];
  solutions: string[];
  businessObjects: string[];
  keyFlows: string[];
  constraints: string[];
  openQuestions: string[];
  sources: SourceReference[];
  createdAt: string;
}

export interface BoardNode {
  id: string;
  title: string;
  subtitle: string;
  kind: 'page' | 'note' | 'decision';
  x: number;
  y: number;
  status: 'draft' | 'ready' | 'review';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  references?: string[];
}

export interface CommentItem {
  id: string;
  author: string;
  content: string;
  resolved: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  updatedAt: string;
  members: string[];
  understandingId?: string;
  pages: BoardNode[];
  messages: ChatMessage[];
  comments: CommentItem[];
  branches: string[];
}

export interface DesignToken {
  id: string;
  name: string;
  value: string;
  group: '颜色' | '字体' | '间距' | '圆角';
  description: string;
}

export interface Asset {
  id: string;
  name: string;
  type: '组件' | '模板' | '品牌资产' | '文档';
  description: string;
  updatedAt: string;
  usage: number;
}

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  version: string;
  usage: number;
  enabled: boolean;
}

export interface Activity {
  id: string;
  type: ActivityKind;
  title: string;
  detail: string;
  createdAt: string;
}

export interface WorkspaceData {
  version: 1;
  projects: Project[];
  understandings: ProductUnderstanding[];
  tokens: DesignToken[];
  assets: Asset[];
  skills: SkillItem[];
  activities: Activity[];
}
