export function createEmptyFidelityReport() {
  return {
    level: "editable",
    objects: [],
    issues: [],
  };
}

export function mergeFidelityLevels(current, next) {
  const rank = {
    editable: 0,
    bridge_editable: 1,
    approximate: 2,
    fallback: 3,
    unsupported: 4,
  };
  return rank[next] > rank[current] ? next : current;
}