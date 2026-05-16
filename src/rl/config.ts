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
      tutorials: 0.75,
      quick_access: 0.35,
      guided_help: 0.65,
      recommendations: 0.9,
      visual_summary: 0.8,
      detailed_explanation: 0.85,
    },
    curiosity: 0.9,
    patience: 0.8,
    consistency: 0.45,
    fatigueSensitivity: 0.1,
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
      tutorials: 0.5,
      quick_access: 0.5,
      guided_help: 0.9,
      recommendations: 0.8,
      visual_summary: 0.6,
      detailed_explanation: 0.7,
    },
    curiosity: 0.5,
    patience: 0.55,
    consistency: 0.4,
    fatigueSensitivity: 0.25,
  },
} as const;