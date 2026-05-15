import { userProfiles } from "./config";
import type { Action, UserType } from "./types";

export function getPreferredContent(userType: UserType): Action {
  return userProfiles[userType].preferred as Action;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function getSessionStage(historyLength: number) {
  if (historyLength < 5) return "early";
  if (historyLength < 12) return "mid";
  return "late";
}

export function simulateUserResponse(
  userType: UserType,
  action: Action,
  context: { historyLength: number; lastAction: Action | null } = {
    historyLength: 0,
    lastAction: null,
  }
) {
  const profile = userProfiles[userType];
  const preferred = profile.preferred as Action;

  const historyLength = context.historyLength ?? 0;
  const sessionStage = getSessionStage(historyLength);
  const wasRepeated = context.lastAction === action;

  const isPreferred = action === preferred;
  const noveltyBonus = wasRepeated ? -0.15 : 0.2;

  const stagePenalty =
    sessionStage === "late"
      ? profile.fatigueSensitivity * 0.6
      : sessionStage === "mid"
      ? profile.fatigueSensitivity * 0.3
      : 0;

  let clickProbability: number;
  let baseTime: number;

  if (isPreferred) {
    clickProbability = 0.45 + profile.consistency * 0.4;
    baseTime = 5 + profile.patience * 8;
  } else {
    clickProbability =
      0.12 + profile.curiosity * 0.45 + noveltyBonus - stagePenalty;
    baseTime =
      2 + profile.curiosity * 5 + profile.patience * 2 - stagePenalty * 4;
  }

  if (wasRepeated) {
    clickProbability -= 0.1 + profile.fatigueSensitivity * 0.15;
    baseTime -= 1.5;
  }

  clickProbability = clamp(clickProbability, 0.05, 0.95);
  baseTime = clamp(baseTime, 1.5, 15);

  const clicks = Math.random() < clickProbability ? 1 : 0;
  const timeSpent = Math.round(
    clamp(baseTime + randomBetween(-1.5, 2.5), 1, 18)
  );

  const satisfaction = isPreferred ? 1 : 0;

  const reward = Number(
    (
      clicks * 2 +
      timeSpent * 0.12 +
      satisfaction * 0.8 +
      noveltyBonus -
      stagePenalty
    ).toFixed(2)
  );

  return {
    clicks,
    timeSpent,
    reward,
    preferred,
    sessionStage,
    wasRepeated,
    clickProbability: Number(clickProbability.toFixed(2)),
  };
}