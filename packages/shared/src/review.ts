import type { Bug, Requirement, Stage } from './models.js';

export type RequirementReviewIssueCode =
  | 'requirement_owner_missing'
  | 'work_owner_missing'
  | 'work_plan_missing'
  | 'version_missing';

export interface RequirementReviewIssue {
  code: RequirementReviewIssueCode;
  message: string;
  targetType: 'requirement' | 'stage' | 'bug';
  targetId: string;
  targetName: string;
}

export function selectCurrentStage(stages: Stage[]) {
  return (
    stages.find((stage) => stage.status === 'blocked') ??
    stages.find((stage) => stage.status === 'waiting') ??
    stages.find((stage) => stage.status === 'in_progress') ??
    stages.find((stage) => !['done', 'canceled'].includes(stage.status))
  );
}

export function reviewRequirement(
  requirement: Requirement,
): RequirementReviewIssue[] {
  if (['done', 'canceled'].includes(requirement.lifecycle)) return [];

  const issues: RequirementReviewIssue[] = [];
  const addWorkIssues = (item: Stage | Bug, targetType: 'stage' | 'bug') => {
    const name = 'key' in item ? item.key : item.name;
    if (!item.ownerIds.length) {
      issues.push({
        code: 'work_owner_missing',
        message: `${name} 未分配执行人`,
        targetType,
        targetId: item.id,
        targetName: name,
      });
    }
    if (!item.plannedEndAt) {
      issues.push({
        code: 'work_plan_missing',
        message: `${name} 未排完成时间`,
        targetType,
        targetId: item.id,
        targetName: name,
      });
    }
  };

  if (requirement.lifecycle === 'in_progress') {
    if (!requirement.ownerIds.length) {
      issues.push({
        code: 'requirement_owner_missing',
        message: '需求缺少整体协调人',
        targetType: 'requirement',
        targetId: requirement.id,
        targetName: requirement.key,
      });
    }
    if (!requirement.versionId) {
      issues.push({
        code: 'version_missing',
        message: '已开始推进但未排目标版本',
        targetType: 'requirement',
        targetId: requirement.id,
        targetName: requirement.key,
      });
    }
  }

  const currentStage = selectCurrentStage(requirement.stages);
  if (
    currentStage &&
    ['in_progress', 'waiting', 'blocked'].includes(currentStage.status)
  )
    addWorkIssues(currentStage, 'stage');

  requirement.bugs
    .filter((bug) => ['in_progress', 'waiting', 'blocked'].includes(bug.status))
    .forEach((bug) => addWorkIssues(bug, 'bug'));

  return issues;
}
