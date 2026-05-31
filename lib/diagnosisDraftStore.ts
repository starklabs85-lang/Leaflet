import type { DiagnosisDraft, PlantDiagnosisResult } from "@/types/diagnosis";

const drafts = new Map<string, DiagnosisDraft>();

export function createDiagnosisDraft({
  photoUri,
  result,
  sourcePlantId,
  sourcePlantName
}: {
  photoUri: string;
  result: PlantDiagnosisResult;
  sourcePlantId?: string | null;
  sourcePlantName?: string | null;
}) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const draft: DiagnosisDraft = {
    id,
    photoUri,
    result,
    sourcePlantId: sourcePlantId ?? null,
    sourcePlantName: sourcePlantName ?? null
  };

  drafts.set(id, draft);

  return draft;
}

export function getDiagnosisDraft(id: string | undefined) {
  return id ? drafts.get(id) ?? null : null;
}

export function updateDiagnosisDraft(draft: DiagnosisDraft) {
  drafts.set(draft.id, draft);
}

