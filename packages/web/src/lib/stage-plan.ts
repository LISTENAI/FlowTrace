export interface StagePlanDraft {
  localId: string;
  id?: string;
  templateStageId?: string;
  name: string;
  note: string;
  ownerIds: string[];
  plannedStartAt: string;
  plannedEndAt: string;
}

let localSequence = 0;

export function newStagePlanDraft(
  input: Partial<Omit<StagePlanDraft, 'localId'>> = {},
): StagePlanDraft {
  localSequence += 1;
  return {
    localId: `stage-draft-${Date.now()}-${localSequence}`,
    name: '',
    note: '',
    ownerIds: [],
    plannedStartAt: '',
    plannedEndAt: '',
    ...input,
  };
}
