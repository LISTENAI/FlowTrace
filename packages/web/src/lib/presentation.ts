import type {
  ExecutionStatus,
  HealthStatus,
  RequirementLifecycle,
  StageWorkDomain,
  VersionStatus,
} from '@flowtrace/shared';
import dayjs from 'dayjs';

export const statusLabels: Record<ExecutionStatus, string> = {
  not_started: '待开始',
  in_progress: '进行中',
  waiting: '等待中',
  blocked: '阻塞',
  done: '已完成',
  canceled: '已取消',
};

export const lifecycleLabels: Record<RequirementLifecycle, string> = {
  not_started: '待开始',
  in_progress: '进行中',
  done: '已完成',
  canceled: '已取消',
};

export const healthLabels: Record<HealthStatus, string> = {
  normal: '正常',
  waiting: '等待中',
  blocked: '阻塞',
};

export const versionLabels: Record<VersionStatus, string> = {
  planning: '规划中',
  active: '进行中',
  released: '已发布',
  canceled: '已取消',
};

export const stageWorkDomainLabels: Record<StageWorkDomain, string> = {
  product: '产品与需求',
  design: '方案与设计',
  implementation: '研发执行',
  verification: '联调与验证',
  delivery: '发布交付',
  other: '其他',
};

export const stageWorkDomainOptions = Object.entries(stageWorkDomainLabels).map(
  ([value, label]) => ({ value: value as StageWorkDomain, label }),
);

export const statusDot: Record<ExecutionStatus, string> = {
  not_started: 'bg-slate-300',
  in_progress: 'bg-indigo-500',
  waiting: 'bg-amber-400',
  blocked: 'bg-rose-500',
  done: 'bg-emerald-500',
  canceled: 'bg-slate-400',
};

export const statusTone: Record<ExecutionStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600 ring-slate-200',
  in_progress: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  waiting: 'bg-amber-50 text-amber-700 ring-amber-200',
  blocked: 'bg-rose-50 text-rose-700 ring-rose-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  canceled: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export const formatDate = (value?: string, fallback = '未排期') =>
  value ? dayjs(value).format('M月D日') : fallback;

export const formatDateRange = (
  start?: string,
  end?: string,
  options: { empty?: string; openEnd?: string } = {},
) => {
  if (!start && !end) return options.empty ?? '尚未排期';
  if (!start) return `截至 ${formatDate(end)}`;
  return `${formatDate(start)} → ${end ? formatDate(end) : (options.openEnd ?? '待定')}`;
};

export const formatDateTime = (value?: string) =>
  value ? dayjs(value).format('M月D日 HH:mm') : '—';

export const dayDelta = (from?: string, to?: string) => {
  if (!from || !to) return undefined;
  return dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day');
};

export const relativeDate = (value: string) => {
  const days = dayjs().startOf('day').diff(dayjs(value).startOf('day'), 'day');
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days > 1 && days < 7) return `${days} 天前`;
  if (days === -1) return '明天';
  return formatDate(value);
};
