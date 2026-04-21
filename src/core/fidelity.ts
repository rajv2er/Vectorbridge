export type FidelityLevel =
  | "editable"
  | "bridge_editable"
  | "approximate"
  | "fallback"
  | "unsupported";

export interface FidelityIssue {
  code: string;
  message: string;
  level: FidelityLevel;
  objectId?: string;
}

export interface ObjectFidelity {
  objectId: string;
  level: FidelityLevel;
  issues: FidelityIssue[];
}

export interface FidelityReport {
  level: FidelityLevel;
  objects: ObjectFidelity[];
  issues: FidelityIssue[];
}

export function createEmptyFidelityReport(): FidelityReport {
  return {
    level: "editable",
    objects: [],
    issues: [],
  };
}

export function mergeFidelityLevels(
  current: FidelityLevel,
  next: FidelityLevel,
): FidelityLevel {
  const rank: Record<FidelityLevel, number> = {
    editable: 0,
    bridge_editable: 1,
    approximate: 2,
    fallback: 3,
    unsupported: 4,
  };

  return rank[next] > rank[current] ? next : current;
}
