import type { Action, UserType } from "./types";

export const actions: Action[] = [
  "tutorials",
  "quick_access",
  "guided_help",
  "recommendations",
  "visual_summary",
  "detailed_explanation",
] as const;
export const userTypes: UserType[] = ["explorador", "eficient", "novell"];

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
  novell: {
    preferences: {
      tutorials: 0.9,
      quick_access: 0.25,
      guided_help: 0.88,
      recommendations: 0.45,
      visual_summary: 0.55,
      detailed_explanation: 0.85,
    },
    curiosity: 0.35,
    patience: 0.85,
    consistency: 0.65,
    fatigueSensitivity: 0.25,
  },
} as const;
