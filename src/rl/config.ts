import type { Action, UserType } from "./types";

export const actions: Action[] = [
  "tutorials",
  "quick_access",
  "guided_help",
  "recommendations",
  "visual_summary",
  "detailed_explanation",
] as const;
export const userTypes: UserType[] = ["explorador", "eficient", "indecis"];

export const userProfiles = {
  explorador: {
    preferences: {
      tutorials: 0.7,
      quick_access: 0.65,
      guided_help: 0.7,
      recommendations: 0.72,
      visual_summary: 0.71,
      detailed_explanation: 0.7,
    },
    curiosity: 0.95,
    patience: 0.8,
    consistency: 0.3,
    fatigueSensitivity: 0.2,
  },
  eficient: {
    preferences: {
      tutorials: 0.3,
      quick_access: 1.0,
      guided_help: 0.4,
      recommendations: 0.5,
      visual_summary: 0.3,
      detailed_explanation: 0.2,
    },
    curiosity: 0.2,
    patience: 0.35,
    consistency: 0.9,
    fatigueSensitivity: 0.35,
  },
  indecis: {
    preferences: {
      tutorials: 0.6,
      quick_access: 0.55,
      guided_help: 0.78,
      recommendations: 0.76,
      visual_summary: 0.68,
      detailed_explanation: 0.72,
    },
    curiosity: 0.55,
    patience: 0.55,
    consistency: 0.3,
    fatigueSensitivity: 0.3,
  }
} as const;