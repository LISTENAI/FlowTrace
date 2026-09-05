import type {
  AttentionItem,
  CoordinatedRequirement,
  DeliveryCheck,
  DeliveryCheckItem,
  PersonWorkItem,
  VersionSnapshot,
} from '@flowtrace/shared';

const open = (status: string) => !['done', 'canceled'].includes(status);

export function personalAttention(
  items: PersonWorkItem[],
  coordinated: CoordinatedRequirement[],
  now: Date,
): AttentionItem[] {
  const result: AttentionItem[] = [];
  for (const item of items.filter((item) => open(item.status))) {
    const reasons: AttentionItem['reasons'] = [];
    if (
      ['waiting', 'blocked'].includes(item.status) &&
      item.expectedResumeAt &&
      new Date(item.expectedResumeAt) < now
    )
      reasons.push({
        code: 'resume_overdue',
        message: '预计恢复时间已过，请确认现状或更新恢复安排',
      });
    if (item.status === 'blocked')
      reasons.push({
        code: 'blocked',
        message: item.statusReason ?? '恢复路径尚待明确',
      });
    if (item.plannedEndAt && new Date(item.plannedEndAt) < now)
      reasons.push({
        code: 'plan_overdue',
        message: '计划完成时间已过，请确认实际进展与后续安排',
      });
    if (item.status === 'in_progress' && !item.plannedEndAt)
      reasons.push({
        code: 'missing_plan',
        message: '已在推进但未记录完成计划，请确认是否已有承诺',
      });
    if (!reasons.length) continue;
    result.push({
      id: `execution:${item.id}`,
      role: 'execution',
      targetType: item.type,
      targetId: item.id,
      requirementId: item.requirement?.id,
      projectId: item.project?.id,
      label:
        item.type === 'stage' && item.requirement
          ? `${item.requirement.key}「${item.requirement.title}」/ ${item.name}`
          : `${item.key ?? ''}「${item.name}」`,
      context: item.project?.name,
      reasons,
      dueAt: item.expectedResumeAt ?? item.plannedEndAt,
    });
  }
  for (const requirement of coordinated.filter((item) =>
    open(item.lifecycle),
  )) {
    const reasons: AttentionItem['reasons'] = [];
    if (requirement.health === 'blocked')
      reasons.push({
        code: 'blocked',
        message: '所协调需求存在阻塞，请协助明确恢复路径',
      });
    if (requirement.overdue)
      reasons.push({
        code: 'plan_overdue',
        message: '所协调需求已超过计划完成时间',
      });
    if (requirement.reviewIssues.length)
      reasons.push({
        code: 'missing_information',
        message: requirement.reviewIssues
          .map((issue) => issue.message)
          .join('；'),
      });
    if (!reasons.length) continue;
    result.push({
      id: `coordination:${requirement.id}`,
      role: 'coordination',
      targetType: 'requirement',
      targetId: requirement.id,
      requirementId: requirement.id,
      projectId: requirement.project.id,
      label: `${requirement.key}「${requirement.title}」`,
      context: requirement.project.name,
      reasons,
      dueAt: requirement.plannedEndAt,
    });
  }
  const ranks = {
    resume_overdue: 0,
    blocked: 1,
    plan_overdue: 2,
    missing_plan: 3,
    missing_information: 3,
  };
  const rank = (item: AttentionItem) =>
    Math.min(...item.reasons.map((reason) => ranks[reason.code]));
  return result.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (Date.parse(a.dueAt ?? '') || Number.MAX_SAFE_INTEGER) -
        (Date.parse(b.dueAt ?? '') || Number.MAX_SAFE_INTEGER) ||
      a.id.localeCompare(b.id),
  );
}

export function versionDeliveryCheck(snapshot: VersionSnapshot): DeliveryCheck {
  const items: DeliveryCheckItem[] = [];
  const add = (item: DeliveryCheckItem) => items.push(item);
  for (const item of snapshot.requirements.filter((item) =>
    open(item.lifecycle),
  ))
    add({
      id: `requirement:${item.id}`,
      category: 'requirements',
      targetId: item.id,
      requirementId: item.id,
      label: `${item.key}「${item.title}」`,
      message: '需求尚未完成；确认本次交付范围和验收结果',
      ownerIds: item.ownerIds,
    });
  for (const item of snapshot.openBugs)
    add({
      id: `bug:${item.id}`,
      category: 'bugs',
      targetId: item.id,
      requirementId: item.requirementId,
      label: `${item.key}「${item.name}」`,
      message: `待交付修复 · ${item.requirementKey}「${item.requirementTitle}」`,
      ownerIds: item.ownerIds,
    });
  for (const [category, work] of [
    ['waiting', snapshot.waitingItems],
    ['blocked', snapshot.blockedItems],
  ] as const) {
    for (const item of work)
      add({
        id: `${category}:${item.id}`,
        category,
        targetId: item.id,
        requirementId: item.requirementId,
        label: `${item.requirementKey}「${item.requirementTitle}」/ ${item.name}`,
        message: item.reason ?? '需要确认恢复条件',
        ownerIds: item.ownerIds,
        expectedResumeAt: item.expectedResumeAt,
      });
  }
  for (const item of snapshot.externalDependencies.filter(
    (item) =>
      item.active &&
      !item.satisfied &&
      item.successor &&
      open(item.successor.status),
  ))
    add({
      id: `dependency:${item.id}`,
      category: 'dependencies',
      targetId: item.successorId,
      requirementId: item.successor!.requirementId,
      label: `${item.successor!.requirementKey}「${snapshot.requirements.find((requirement) => requirement.id === item.successor!.requirementId)?.title ?? snapshot.openBugs.find((bug) => bug.requirementId === item.successor!.requirementId)?.requirementTitle ?? item.successor!.name}」/ ${item.successor!.name}`,
      message: `等待 ${item.predecessor?.projectName ?? '外部项目'} / ${item.predecessor?.name ?? '前置事项'}${item.note ? `：${item.note}` : ''}`,
      relatedRequirementId: item.predecessor?.requirementId,
      ownerIds: [],
    });
  for (const [index, item] of snapshot.reviewItems.entries())
    add({
      id: `review:${item.requirementId}:${index}`,
      category: 'information',
      targetId: item.requirementId,
      requirementId: item.requirementId,
      label: `${item.requirementKey}「${item.requirementTitle}」`,
      message: item.message,
      ownerIds:
        snapshot.requirements.find(
          (requirement) => requirement.id === item.requirementId,
        )?.ownerIds ?? [],
    });
  const categories = [
    'requirements',
    'bugs',
    'waiting',
    'blocked',
    'dependencies',
    'information',
  ] as const;
  const counts = Object.fromEntries(
    categories.map((category) => [
      category,
      items.filter((item) => item.category === category).length,
    ]),
  ) as DeliveryCheck['counts'];
  return {
    project: snapshot.project,
    version: snapshot.version,
    items,
    counts,
    recentChanges: snapshot.recentChanges,
    generatedAt: snapshot.generatedAt,
  };
}
