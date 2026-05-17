import type { UserType } from "./types";

export function createInitialMultiUserChart() {
  return {
    explorador: [],
    eficient: [],
    novell: [],
  } as Record<UserType, { step: number; reward: number }[]>;
}

export function buildCombinedChartData(
  multiUserChart: Record<UserType, { step: number; reward: number }[]>
) {
  const maxLength = Math.max(
    multiUserChart.explorador.length,
    multiUserChart.eficient.length,
    multiUserChart.novell.length
  );

  return Array.from({ length: maxLength }, (_, index) => ({
    step: index + 1,
    explorador: multiUserChart.explorador[index]?.reward ?? null,
    eficient: multiUserChart.eficient[index]?.reward ?? null,
    novell: multiUserChart.novell[index]?.reward ?? null,
  }));
}