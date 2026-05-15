import type { Action, UserType } from "./types";

export const actions: Action[] = ["A", "B", "C"];
export const userTypes: UserType[] = ["explorador", "eficient", "indecis"];

export const userProfiles = {
  explorador: {
    preferred: "A",
    curiosity: 0.75,
    patience: 0.8,
    consistency: 0.65,
    fatigueSensitivity: 0.15,
  },
  eficient: {
    preferred: "B",
    curiosity: 0.2,
    patience: 0.35,
    consistency: 0.9,
    fatigueSensitivity: 0.35,
  },
  indecis: {
    preferred: "C",
    curiosity: 0.5,
    patience: 0.55,
    consistency: 0.4,
    fatigueSensitivity: 0.25,
  },
} as const;