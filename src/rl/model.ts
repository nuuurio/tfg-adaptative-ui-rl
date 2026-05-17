import { actions } from "./config";
import type { Action, QTable } from "./types";

export function createInitialQ(): QTable {
  return {
    explorador: {
      tutorials: 0,
      quick_access: 0,
      guided_help: 0,
      recommendations: 0,
      visual_summary: 0,
      detailed_explanation: 0,
    },
    eficient: {
      tutorials: 0,
      quick_access: 0,
      guided_help: 0,
      recommendations: 0,
      visual_summary: 0,
      detailed_explanation: 0,
    },
    novell: {
      tutorials: 0,
      quick_access: 0,
      guided_help: 0,
      recommendations: 0,
      visual_summary: 0,
      detailed_explanation: 0,
    },
  };
}

export function loadInitialQ(): QTable {
  const saved = localStorage.getItem("qTable");
  return saved ? JSON.parse(saved) : createInitialQ();
}

export function chooseAction(qForState: Record<Action, number>, epsilon = 0.2) {
  if (Math.random() < epsilon) {
    return {
      action: actions[Math.floor(Math.random() * actions.length)],
      strategy: "exploration" as const,
    };
  }

  const best = actions.reduce((best, current) =>
    qForState[current] > qForState[best] ? current : best,
  );

  return {
    action: best,
    strategy: "exploitation" as const,
  };
}

export function updateQValue(oldQ: number, reward: number, alpha = 0.1) {
  return oldQ + alpha * (reward - oldQ);
}
