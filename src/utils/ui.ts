import type { Action } from "@/rl/types";

export function contentLabel(action: Action) {
  if (action === "A") return "Contingut A · tutorials i exploració";
  if (action === "B") return "Contingut B · accés ràpid i tasques";
  return "Contingut C · suggeriments i ajuda guiada";
}