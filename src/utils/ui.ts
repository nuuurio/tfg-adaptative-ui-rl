import type { Action } from "@/rl/types";

export function contentLabel(action: Action) {
  const labels = {
    tutorials: "Tutorials i contingut exploratori",
    quick_access: "Accés ràpid a tasques principals",
    guided_help: "Ajuda guiada pas a pas",
    recommendations: "Recomanacions personalitzades",
    visual_summary: "Resum visual del contingut",
    detailed_explanation: "Explicació detallada",
  };

  return labels[action];
}
